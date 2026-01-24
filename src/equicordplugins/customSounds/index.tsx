/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { AudioProcessor, PreprocessAudioData } from "@api/AudioPlayer";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { get as getFromDataStore } from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Heading } from "@components/Heading";
import { Devs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import type { Call, Channel, Message, MessageJSON, User } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { Button, ChannelStore, Menu, MessageStore, React, showToast, TextInput, UserStore } from "@webpack/common";

import { getAllAudio, getAudioDataURI } from "./audioStore";
import { SoundOverrideComponent } from "./SoundOverrideComponent";
import { makeEmptyOverride, seasonalSounds, SoundOverride, soundTypes } from "./types";
import { ensureUserEntry, getUserOverride, getUserOverridesCache, loadUserOverrides } from "./userOverrides";
import { UserOverridesComponent } from "./UserOverridesComponent";

const cl = classNameFactory("vc-custom-sounds-");

const allSoundTypes = soundTypes || [];

const AUDIO_STORE_KEY = "ScattrdCustomSounds";

const dataUriCache = new Map<string, string>();
const soundContextBySoundId = new Map<string, { userId: string; at: number }>();
const SOUND_CONTEXT_TTL_MS = 10_000;

interface UserContextProps {
    user?: User;
}

interface CallUpdatePayload {
    call?: Call;
    ringing?: string[];
    messageId?: string;
    channelId?: string;
}

type CallPayload = Call & {
    channel_id?: string;
    message_id?: string;
    channelId?: string;
    messageId?: string;
};

type ChannelWithRecipients = Channel & {
    rawRecipients?: User[];
    recipients?: User[];
    recipient_ids?: string[];
};

type RecipientLike = User | { id: string } | string;

type MessagePayload = Message | MessageJSON;

function getOverride(id: string): SoundOverride {
    const stored = settings.store[id];
    if (!stored) return makeEmptyOverride();

    if (typeof stored === "object") return stored;

    try {
        return JSON.parse(stored);
    } catch {
        return makeEmptyOverride();
    }
}

function setOverride(id: string, override: SoundOverride) {
    settings.store[id] = JSON.stringify(override);
}

function resolveBaseSoundId(soundId: string): string {
    if (!(soundId in seasonalSounds)) return soundId;

    const soundType = allSoundTypes.find(sound => sound.seasonal?.includes(soundId));
    return soundType?.id ?? soundId;
}

function setSoundContext(soundId: string, userId: string): void {
    soundContextBySoundId.set(soundId, { userId, at: Date.now() });
}

function getSoundContextUserId(soundId: string): string | null {
    const entry = soundContextBySoundId.get(soundId);
    if (!entry) return null;

    if (Date.now() - entry.at > SOUND_CONTEXT_TTL_MS) {
        soundContextBySoundId.delete(soundId);
        return null;
    }

    return entry.userId;
}

function applyOverride(
    data: PreprocessAudioData,
    override: SoundOverride,
    originalSoundId: string
): void {
    if (!override.enabled) return;

    if (override.selectedSound === "custom" && override.selectedFileId) {
        const dataUri = dataUriCache.get(override.selectedFileId);
        if (!dataUri) return;

        data.audio = dataUri;
        data.volume = override.volume;
        return;
    }

    if (override.selectedSound !== "default" && override.selectedSound !== "custom") {
        if (override.selectedSound in seasonalSounds) {
            data.audio = seasonalSounds[override.selectedSound];
            data.volume = override.volume;
            return;
        }

        const soundType = allSoundTypes.find(type => type.id === originalSoundId);
        const seasonalMatches = soundType?.seasonal;
        if (!seasonalMatches?.length) {
            data.volume = override.volume;
            return;
        }

        const seasonalId = seasonalMatches.find(seasonalId =>
            seasonalId.startsWith(`${override.selectedSound}_`)
        );

        if (seasonalId && seasonalId in seasonalSounds) {
            data.audio = seasonalSounds[seasonalId];
            data.volume = override.volume;
            return;
        }
    }

    data.volume = override.volume;
}

export const getCustomSoundURL: AudioProcessor = (data: PreprocessAudioData) => {
    const originalSoundId = data.audio;
    const baseSoundId = resolveBaseSoundId(originalSoundId);
    const userId = getSoundContextUserId(baseSoundId);

    if (userId) {
        const userOverride = getUserOverride(userId, baseSoundId);
        if (userOverride) {
            applyOverride(data, userOverride, originalSoundId);
            return;
        }
    }

    const override = getOverride(baseSoundId);
    if (!override?.enabled) return;

    applyOverride(data, override, originalSoundId);
};

export async function ensureDataURICached(fileId: string): Promise<string | null> {
    if (dataUriCache.has(fileId)) {
        return dataUriCache.get(fileId)!;
    }

    try {
        const dataUri = await getAudioDataURI(fileId);
        if (dataUri) {
            dataUriCache.set(fileId, dataUri);
            console.log(`[CustomSounds] Cached data URI for file ${fileId}`);
            return dataUri;
        }
    } catch (error) {
        console.error(`[CustomSounds] Error generating data URI for ${fileId}:`, error);
    }

    return null;
}

function recordMessageSoundContext(message: MessagePayload): void {
    if (!message?.author?.id) return;

    const channel = ChannelStore.getChannel(message.channel_id);
    if (!channel) return;

    const currentUserId = UserStore.getCurrentUser().id;
    if (message.author.id === currentUserId) return;

    const soundId = getMessageSoundId(message, channel, currentUserId);
    if (!soundId) return;

    setSoundContext(soundId, message.author.id);
}

function getMessageSoundId(message: MessagePayload, channel: Channel, currentUserId: string): string | null {
    if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM) {
        return "message3";
    }

    const mentionSound = getMentionSoundId(message);
    if (mentionSound) return mentionSound;

    if (isReplyToCurrentUser(message, currentUserId)) return "message2";

    return "message1";
}

function getMentionSoundId(message: MessagePayload): string | null {
    const mentionEveryone = getMentionEveryone(message);
    const mentionRoles = getMentionRoles(message);
    if (!mentionEveryone && !mentionRoles.length) return null;

    const content = message.content ?? "";
    if (content.includes("@everyone")) return "mention2";
    if (content.includes("@here")) return "mention3";
    if (mentionRoles.length) return "mention1";

    return null;
}

function getMentionEveryone(message: MessagePayload): boolean {
    if ("mentionEveryone" in message) return message.mentionEveryone;
    return message.mention_everyone;
}

function getMentionRoles(message: MessagePayload): string[] {
    if ("mentionRoles" in message) return message.mentionRoles ?? [];
    return message.mention_roles ?? [];
}

function getReferencedAuthorId(message: MessagePayload): string | null {
    if ("referenced_message" in message) {
        return message.referenced_message?.author?.id ?? null;
    }

    return null;
}

function isReplyToCurrentUser(message: MessagePayload, currentUserId: string): boolean {
    const repliedId = getReferencedAuthorId(message);
    return repliedId === currentUserId;
}

function recordCallSoundContext(payload: CallUpdatePayload): void {
    const details = getCallDetails(payload);
    if (!details) return;

    const currentUserId = UserStore.getCurrentUser().id;
    if (!details.ringing.includes(currentUserId)) return;

    const callerId = getCallerId(details);
    if (!callerId) return;

    setSoundContext("call_ringing", callerId);
}

function getCallDetails(payload: CallUpdatePayload): { channelId: string; messageId: string | null; ringing: string[]; } | null {
    const call = payload.call as CallPayload | undefined;
    let ringing: string[] = [];

    if (Array.isArray(call?.ringing)) {
        ringing = call.ringing;
    } else if (Array.isArray(payload.ringing)) {
        ringing = payload.ringing;
    }

    const channelId = call?.channelId ?? call?.channel_id ?? payload.channelId ?? null;
    const messageId = call?.messageId ?? call?.message_id ?? payload.messageId ?? null;

    if (!channelId || !ringing.length) return null;

    return { channelId, messageId, ringing };
}

function getCallerId(details: { channelId: string; messageId: string | null; ringing: string[]; }): string | null {
    if (details.messageId) {
        const message = MessageStore.getMessage(details.channelId, details.messageId);
        const authorId = message?.author?.id;
        if (authorId) return authorId;
    }

    const channel = ChannelStore.getChannel(details.channelId) as ChannelWithRecipients | undefined;
    if (!channel) return null;

    const recipientIds = getRecipientIds(channel);
    if (!recipientIds.length) return null;

    const currentUserId = UserStore.getCurrentUser().id;
    if (channel.type === ChannelType.DM) {
        return recipientIds.find(id => id !== currentUserId) ?? null;
    }

    if (channel.type === ChannelType.GROUP_DM) {
        const otherRecipients = recipientIds.filter(id => id !== currentUserId);
        if (otherRecipients.length === 1) return otherRecipients[0];

        const callerId = otherRecipients.find(id => !details.ringing.includes(id));
        return callerId ?? null;
    }

    return null;
}

function getRecipientIds(channel: ChannelWithRecipients): string[] {
    const rawRecipients = channel.rawRecipients as RecipientLike[] | undefined;
    if (rawRecipients?.length) return rawRecipients.map(getRecipientId);

    const recipients = channel.recipients as RecipientLike[] | undefined;
    if (recipients?.length) return recipients.map(getRecipientId);

    if (channel.recipient_ids?.length) return channel.recipient_ids;

    return [];
}

function getRecipientId(recipient: RecipientLike): string {
    return typeof recipient === "string" ? recipient : recipient.id;
}

export async function refreshDataURI(id: string): Promise<void> {
    const override = getOverride(id);
    if (!override?.selectedFileId) {
        console.log(`[CustomSounds] refreshDataURI called for ${id} but no selectedFileId`);
        return;
    }

    console.log(`[CustomSounds] Refreshing data URI for ${id} with file ID ${override.selectedFileId}`);

    const dataUri = await ensureDataURICached(override.selectedFileId);
    if (dataUri) {
        console.log(`[CustomSounds] Successfully cached data URI for ${id} (length: ${dataUri.length})`);
    } else {
        console.error(`[CustomSounds] Failed to cache data URI for ${id}`);
    }
}

async function preloadDataURIs() {
    console.log("[CustomSounds] Preloading data URIs into memory cache...");

    for (const soundType of allSoundTypes) {
        const override = getOverride(soundType.id);
        if (override?.enabled && override.selectedSound === "custom" && override.selectedFileId) {
            try {
                await ensureDataURICached(override.selectedFileId);
                console.log(`[CustomSounds] Preloaded data URI for ${soundType.id}`);
            } catch (error) {
                console.error(`[CustomSounds] Failed to preload data URI for ${soundType.id}:`, error);
            }
        }
    }

    await preloadUserOverrides();

    console.log(`[CustomSounds] Memory cache contains ${dataUriCache.size} data URIs`);
}

async function preloadUserOverrides() {
    const userOverrides = getUserOverridesCache();
    for (const overrides of Object.values(userOverrides)) {
        for (const override of Object.values(overrides)) {
            if (!override.enabled || override.selectedSound !== "custom" || !override.selectedFileId) continue;

            try {
                await ensureDataURICached(override.selectedFileId);
            } catch (error) {
                console.error("[CustomSounds] Failed to preload user override data URI:", error);
            }
        }
    }
}

export async function debugCustomSounds() {
    console.log("[CustomSounds] === DEBUG INFO ===");

    const rawDataStore = await getFromDataStore(AUDIO_STORE_KEY);
    console.log("[CustomSounds] Raw DataStore content:", rawDataStore);

    const allFiles = await getAllAudio();
    console.log(`[CustomSounds] Stored files: ${Object.keys(allFiles).length}`);

    let totalBufferSize = 0;
    let totalDataUriSize = 0;

    for (const [id, file] of Object.entries(allFiles)) {
        const bufferSize = file.buffer?.byteLength || 0;
        const dataUriSize = file.dataUri?.length || 0;
        totalBufferSize += bufferSize;
        totalDataUriSize += dataUriSize;

        console.log(`[CustomSounds] File ${id}:`, {
            name: file.name,
            type: file.type,
            bufferSize: `${(bufferSize / 1024).toFixed(1)}KB`,
            hasValidBuffer: file.buffer instanceof ArrayBuffer,
            hasDataUri: !!file.dataUri,
            dataUriSize: `${(dataUriSize / 1024).toFixed(1)}KB`
        });
    }

    console.log(`[CustomSounds] Total storage - Buffers: ${(totalBufferSize / 1024).toFixed(1)}KB, DataURIs: ${(totalDataUriSize / 1024).toFixed(1)}KB`);

    console.log(`[CustomSounds] Memory cache contains ${dataUriCache.size} data URIs`);

    console.log("[CustomSounds] Settings store structure:", Object.keys(settings.store));

    console.log("[CustomSounds] Sound override status:");
    let enabledCount = 0;
    let totalSettingsSize = 0;

    for (const [soundId, storedValue] of Object.entries(settings.store)) {
        if (soundId === "overrides") continue;

        const override = getOverride(soundId);
        const settingsSize = JSON.stringify(override).length;
        totalSettingsSize += settingsSize;

        console.log(`[CustomSounds] ${soundId}:`, {
            enabled: override.enabled,
            selectedSound: override.selectedSound,
            selectedFileId: override.selectedFileId,
            volume: override.volume,
            settingsSize: `${settingsSize}B`
        });

        if (override.enabled) enabledCount++;
    }

    console.log(`[CustomSounds] Total enabled overrides: ${enabledCount}`);
    console.log(`[CustomSounds] Estimated settings size: ${(totalSettingsSize / 1024).toFixed(1)}KB`);
    console.log("[CustomSounds] === END DEBUG ===");
}

const soundSettings = Object.fromEntries(
    allSoundTypes.map(type => [
        type.id,
        {
            type: OptionType.STRING,
            description: `Override for ${type.name}`,
            default: JSON.stringify(makeEmptyOverride()),
            hidden: true
        }
    ])
);

const settings = definePluginSettings({
    ...soundSettings,
    overrides: {
        type: OptionType.COMPONENT,
        description: "",
        component: () => {
            const [resetTrigger, setResetTrigger] = React.useState(0);
            const [searchQuery, setSearchQuery] = React.useState("");
            const fileInputRef = React.useRef<HTMLInputElement>(null);

            React.useEffect(() => {
                allSoundTypes.forEach(type => {
                    if (!settings.store[type.id]) {
                        setOverride(type.id, makeEmptyOverride());
                    }
                });
            }, []);

            const resetOverrides = () => {
                allSoundTypes.forEach(type => {
                    setOverride(type.id, makeEmptyOverride());
                });
                dataUriCache.clear();
                setResetTrigger(prev => prev + 1);
                showToast("All overrides reset successfully!");
            };

            const triggerFileUpload = () => {
                fileInputRef.current?.click();
            };

            const handleSettingsUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = async (e: ProgressEvent<FileReader>) => {
                        try {
                            resetOverrides();
                            const imported = JSON.parse(e.target?.result as string);

                            if (imported.overrides && Array.isArray(imported.overrides)) {
                                imported.overrides.forEach((setting: any) => {
                                    if (setting.id) {
                                        const override: SoundOverride = {
                                            enabled: setting.enabled ?? false,
                                            selectedSound: setting.selectedSound ?? "default",
                                            selectedFileId: setting.selectedFileId ?? undefined,
                                            volume: setting.volume ?? 100,
                                            useFile: false
                                        };
                                        setOverride(setting.id, override);
                                    }
                                });
                            }

                            setResetTrigger(prev => prev + 1);
                            showToast("Settings imported successfully!");
                        } catch (error) {
                            console.error("Error importing settings:", error);
                            showToast("Error importing settings. Check console for details.");
                        }
                    };

                    reader.readAsText(file);
                    event.target.value = "";
                }
            };

            const downloadSettings = async () => {
                const overrides = allSoundTypes.map(type => {
                    const override = getOverride(type.id);
                    return {
                        id: type.id,
                        enabled: override.enabled,
                        selectedSound: override.selectedSound,
                        selectedFileId: override.selectedFileId ?? undefined,
                        volume: override.volume
                    };
                }).filter(o => o.enabled || o.selectedSound !== "default");

                const exportPayload = {
                    overrides,
                    __note: "Audio files are not included in exports and will need to be re-uploaded after import"
                };

                const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "customSounds-settings.json";
                a.click();
                URL.revokeObjectURL(url);

                showToast(`Exported ${overrides.length} settings (audio files not included)`);
            };

            const filteredSoundTypes = allSoundTypes.filter(type =>
                type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                type.id.toLowerCase().includes(searchQuery.toLowerCase())
            );

            return (
                <div>
                    <div className="vc-custom-sounds-buttons">
                        <Button color={Button.Colors.BRAND} onClick={triggerFileUpload}>Import</Button>
                        <Button color={Button.Colors.PRIMARY} onClick={downloadSettings}>Export</Button>
                        <Button color={Button.Colors.RED} onClick={resetOverrides}>Reset All</Button>
                        <Button color={Button.Colors.WHITE} onClick={debugCustomSounds}>Debug</Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            style={{ display: "none" }}
                            onChange={handleSettingsUpload}
                        />
                    </div>

                    <div className={cl("search")}>
                        <Heading>Search Sounds</Heading>
                        <TextInput
                            value={searchQuery}
                            onChange={e => setSearchQuery(e)}
                            placeholder="Search by name or ID"
                        />
                    </div>

                    <div className={cl("sounds-list")}>
                        {filteredSoundTypes.map(type => {
                            const currentOverride = getOverride(type.id);

                            return (
                                <SoundOverrideComponent
                                    key={`${type.id}-${resetTrigger}`}
                                    type={type}
                                    override={currentOverride}
                                    onChange={async () => {

                                        setOverride(type.id, currentOverride);

                                        if (currentOverride.enabled && currentOverride.selectedSound === "custom" && currentOverride.selectedFileId) {
                                            try {
                                                await ensureDataURICached(currentOverride.selectedFileId);
                                            } catch (error) {
                                                console.error(`[CustomSounds] Failed to cache data URI for ${type.id}:`, error);
                                                showToast("Error loading custom sound file");
                                            }
                                        }

                                        console.log(`[CustomSounds] Settings saved for ${type.id}:`, currentOverride);
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            );
        }
    },
    userOverrides: {
        type: OptionType.COMPONENT,
        description: "Manage per-user sound overrides.",
        component: ErrorBoundary.wrap(UserOverridesComponent, { noop: true }) as any
    }
});

export function isOverriden(id: string): boolean {
    return !!getOverride(id)?.enabled;
}

export function findOverride(id: string): SoundOverride | null {
    const override = getOverride(id);
    return override?.enabled ? override : null;
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    if (!user) return;

    children.push(
        <Menu.MenuItem
            id="custom-sounds-user"
            label="Add to Custom Sounds"
            action={() => {
                void ensureUserEntry(user.id).then(() => {
                    showToast(`Added ${user.username} to Custom Sounds`);
                });
            }}
        />
    );
};

export default definePlugin({
    name: "CustomSounds",
    description: "Customize Discord's sounds.",
    authors: [Devs.ScattrdBlade, Devs.TheKodeToad],
    settings,
    startAt: StartAt.Init,
    audioProcessor: getCustomSoundURL,
    contextMenus: {
        "user-context": UserContextMenuPatch
    },
    flux: {
        MESSAGE_CREATE({ message, optimistic }: { message: MessagePayload; optimistic: boolean; }) {
            if (optimistic) return;
            if (!message?.channel_id) return;

            recordMessageSoundContext(message);
        },
        CALL_UPDATE(payload: CallUpdatePayload) {
            recordCallSoundContext(payload);
        }
    },

    async start() {
        console.log("[CustomSounds] Plugin starting...");

        try {
            await loadUserOverrides();
            await preloadDataURIs();
            console.log("[CustomSounds] Startup complete");
        } catch (error) {
            console.error("[CustomSounds] Startup failed:", error);
        }
    },

    stop() {
        console.log("[CustomSounds] Plugin stopped");
    }
});
