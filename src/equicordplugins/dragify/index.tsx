/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { getGuildAcronym } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import type { Channel } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { ChannelStore, ComponentDispatch, Constants, createRoot, DraftStore, DraftType, GuildChannelStore, GuildStore, IconUtils, PermissionsBits, PermissionStore, React, RestAPI, SelectedChannelStore, showToast, Toasts, UserStore, useStateFromStores, VoiceStateStore } from "@webpack/common";

type DropEntity =
    | { kind: "user"; id: string; }
    | { kind: "channel"; id: string; guildId?: string; }
    | { kind: "guild"; id: string; };

type DraftActions = {
    saveDraft(channelId: string, draft: string, draftType: number): void;
    changeDraft(channelId: string, draft: string, draftType: number): void;
    setDraft?: (channelId: string, draft: string, draftType: number) => void;
};

const settings = definePluginSettings({
    userOutput: {
        type: OptionType.SELECT,
        description: "User drop output.",
        options: [
            { label: "Mention user", value: "mention", default: true },
            { label: "User ID", value: "id" },
        ],
    },
    channelOutput: {
        type: OptionType.SELECT,
        description: "Channel drop output.",
        options: [
            { label: "#channel mention", value: "mention", default: true },
            { label: "Channel link", value: "link" },
        ],
    },
    inviteExpireAfter: {
        type: OptionType.SELECT,
        description: "Invite expiration.",
        options: [
            { label: "30 minutes", value: 1800 },
            { label: "1 hour", value: 3600 },
            { label: "6 hours", value: 21600 },
            { label: "12 hours", value: 43200 },
            { label: "1 day", value: 86400 },
            { label: "7 days", value: 604800 },
            { label: "Never", value: 0, default: true },
        ],
    },
    inviteMaxUses: {
        type: OptionType.SELECT,
        description: "Invite max uses.",
        options: [
            { label: "No limit", value: 0, default: true },
            { label: "1 use", value: 1 },
            { label: "5 uses", value: 5 },
            { label: "10 uses", value: 10 },
            { label: "25 uses", value: 25 },
            { label: "50 uses", value: 50 },
            { label: "100 uses", value: 100 },
        ],
    },
    inviteTemporaryMembership: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Grant temporary membership.",
    },
    reuseExistingInvites: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Reuse existing invite instead of creating a new one.",
    },
});

const DraftActions = findByPropsLazy("saveDraft", "changeDraft") as DraftActions;
const logger = new Logger("Dragify");
const ScreenArrowIcon = findComponentByCodeLazy("3V5Zm16") as React.ComponentType<{
    className?: string;
    width?: number;
    height?: number;
    size?: number;
    color?: any;
    colorClass?: string;
}>;
let pluginInstance: any = null;
let activeGuildDragId: string | null = null;
let activeUserDragId: string | null = null;
let activeDragEntity: DropEntity | null = null;
let lastDropAt = 0;
let ghostRoot: ReturnType<typeof createRoot> | null = null;
let ghostContainer: HTMLDivElement | null = null;
let ghostRaf: number | null = null;
let ghostPendingPos: { x: number; y: number; } | null = null;
let ghostHideTimer: number | null = null;
let lastHandledDrop: { at: number; key: string; } = { at: 0, key: "" };

type GhostState = {
    visible: boolean;
    x: number;
    y: number;
    kind: DropEntity["kind"];
    title: string;
    subtitle?: string;
    iconUrl?: string;
    symbol?: string;
    badge?: string;
    entityId?: string;
    exiting: boolean;
};

let ghostState: GhostState = {
    visible: false,
    x: 0,
    y: 0,
    kind: "channel",
    title: "",
    exiting: false
};

const ghostListeners = new Set<() => void>();

function notifyGhost() {
    ghostListeners.forEach(listener => listener());
}

function setGhostState(next: Partial<GhostState>) {
    ghostState = { ...ghostState, ...next };
    notifyGhost();
}

function scheduleGhostPosition(x: number, y: number) {
    ghostPendingPos = { x, y };
    if (ghostRaf !== null) return;
    setGhostState({ x, y });
    ghostRaf = requestAnimationFrame(() => {
        if (ghostPendingPos) setGhostState({ x: ghostPendingPos.x, y: ghostPendingPos.y });
        ghostPendingPos = null;
        ghostRaf = null;
    });
}

function hideGhost() {
    if (!ghostState.visible) return;
    if (ghostHideTimer !== null) {
        clearTimeout(ghostHideTimer);
        ghostHideTimer = null;
    }
    setGhostState({ exiting: true });
    ghostHideTimer = window.setTimeout(() => {
        ghostHideTimer = null;
        setGhostState({ visible: false, exiting: false });
    }, 200);
}

const DragGhost = () => {
    const [state, setState] = React.useState(ghostState);
    React.useEffect(() => {
        const listener = () => setState({ ...ghostState });
        ghostListeners.add(listener);
        return () => {
            ghostListeners.delete(listener);
        };
    }, []);

    const voiceState = useStateFromStores(
        [VoiceStateStore],
        () => (state.kind === "user" && state.entityId
            ? VoiceStateStore.getVoiceStateForUser(state.entityId)
            : null)
    );
    const inVoice = Boolean(voiceState?.channelId);
    const isMuted = Boolean(
        voiceState
        && (voiceState.selfMute || voiceState.mute || voiceState.selfDeaf || voiceState.deaf)
    );
    const isStreaming = Boolean(voiceState?.selfStream);

    if (!state.visible) return null;

    return (
        <div
            className={`vc-dragify-ghost${state.exiting ? " vc-dragify-ghost-exit" : ""}`}
            style={{ transform: `translate3d(${state.x}px, ${state.y}px, 0)` }}
        >
            <div className="vc-dragify-card">
                <div className="vc-dragify-icon">
                    {state.iconUrl
                        ? <img className="vc-dragify-icon-image" src={state.iconUrl} alt="" />
                        : <span className="vc-dragify-icon-text">{state.symbol ?? "#"}</span>
                    }
                </div>
                <div className="vc-dragify-body">
                    <div className="vc-dragify-title-row">
                        <div className="vc-dragify-title">{state.title}</div>
                        {state.kind === "user" && inVoice
                            ? (isMuted
                                ? <VoiceMutedIcon className="vc-dragify-voice-icon vc-dragify-voice-icon-muted" />
                                : <VoiceStateIcon className="vc-dragify-voice-icon" />)
                            : null}
                        {state.kind === "user" && inVoice && isStreaming
                            ? <ScreenArrowIcon
                                className="vc-dragify-voice-icon vc-dragify-voice-icon-stream"
                                size={14}
                                width={14}
                                height={14}
                            />
                            : null}
                    </div>
                    {state.subtitle && <div className="vc-dragify-subtitle">{state.subtitle}</div>}
                </div>
                <div className="vc-dragify-badge">{state.badge ?? state.kind}</div>
            </div>
        </div>
    );
};

function VoiceStateIcon({ className, size = 14 }: { className?: string; size?: number; }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            fill="none"
            viewBox="0 0 24 24"
        >
            <path
                fill="currentColor"
                d="M7 2a1 1 0 0 0-1 1v18a1 1 0 1 0 2 0V3a1 1 0 0 0-1-1ZM11 6a1 1 0 1 1 2 0v12a1 1 0 1 1-2 0V6ZM1 8a1 1 0 0 1 2 0v8a1 1 0 1 1-2 0V8ZM16 5a1 1 0 1 1 2 0v14a1 1 0 1 1-2 0V5ZM22 8a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1Z"
            />
        </svg>
    );
}

function VoiceMutedIcon({ className, size = 14 }: { className?: string; size?: number; }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            fill="none"
            viewBox="0 0 24 24"
        >
            <path
                fill="currentColor"
                d="M22.7 2.7a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4l20-20ZM6.85 13.15a.5.5 0 0 1-.85-.36V3a1 1 0 0 1 2 0v8.8a.5.5 0 0 1-.15.35l-1 1ZM11 17.2v.8a1 1 0 1 0 2 0v-1.8a.5.5 0 0 0-.85-.35l-1 1a.5.5 0 0 0-.15.36ZM11 7.8V6a1 1 0 1 1 2 0v.8a.5.5 0 0 1-.15.35l-1 1a.5.5 0 0 1-.85-.36ZM17.15 10.85a.5.5 0 0 1 .85.36V19a1 1 0 1 1-2 0v-6.8a.5.5 0 0 1 .15-.35l1-1ZM2 7a1 1 0 0 0-1 1v8a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1ZM21 9a1 1 0 1 1 2 0v6a1 1 0 1 1-2 0V9Z"
            />
        </svg>
    );
}
const inviteCache = new Map<string, { code: string; expiresAt: number | null; maxUses: number | null; uses: number | null; }>();
const userMentionRegex = /<@!?(\d{17,20})>/;
const userProfileUrlRegex = /discord(?:(?:app)?\.com|:\/\/-?)\/users\/(\d{17,20})/;
const userAvatarRegex = /cdn\.discordapp\.com\/(?:avatars|users)\/(\d{17,20})\//;
const guildUserAvatarRegex = /cdn\.discordapp\.com\/guilds\/\d{17,20}\/users\/(\d{17,20})\/avatars\//;
const channelMentionRegex = /<#(\d{17,20})>/;
const channelUrlRegex = /discord(?:(?:app)?\.com|:\/\/-?)\/channels\/(?:(@me)|(\d{17,20}))\/(\d{17,20})/;
const channelPathRegex = /\/channels\/(@me|\d{17,20})\/(\d{17,20})/;
const guildIconRegex = /cdn\.discordapp\.com\/icons\/(\d{17,20})\//;

export default definePlugin({
    name: "Dragify",
    description: "Drop users, channels, or servers into chat to insert mentions or invites.",
    authors: [EquicordDevs.justjxke],
    settings,

    patches: [
        // Chat input form (wire drop handlers)
        {
            find: "editor:eR,channelId:k.id,guildId:k.guild_id",
            replacement: {
                match: /className:\i\(\)\(\i,\i\.slateContainer\),/,
                replace: "$&onDragOver:e=>$self.onDragOver(e),onDrop:e=>$self.onDrop(e),"
            }
        },
        // Chat input text area (drop handlers for contenteditable)
        {
            find: "editor:eR,channelId:k.id,guildId:k.guild_id",
            replacement: {
                match: /className:\i\(\)\(\i\.slateTextArea,\i\),/,
                replace: "$&onDragOver:e=>$self.onDragOver(e),onDrop:e=>$self.onDrop(e),"
            }
        },
        // Voice user rows (voice channel sidebar)
        {
            find: "avatarContainer,onContextMenu",
            replacement: {
                match: /className:(\i)\.avatarContainer,onContextMenu:(\i)/,
                replace: "className:$1.avatarContainer,onContextMenu:$2,draggable:!0,onDragStart:e=>$self.onUserDragStart(e)"
            }
        },
        // Voice user rows (voice channel sidebar list)
        {
            find: "voiceUser]:!0",
            replacement: {
                match: /className:\i\(\)\(\i,\{[^}]*?\[\i\.voiceUser\]:!0[^}]*?\}\),/,
                replace: "$&\"data-user-id\":arguments[0].user?.id,draggable:!0,onDragStart:e=>$self.onUserDragStart(e,{id:arguments[0].user?.id}),"
            }
        },
        // Voice user rows (content node for data-user-id fallback)
        {
            find: "voiceUser]:!0",
            replacement: {
                match: /className:\i\(\)\(\i\.content,\{\[\i\.flipped\]:\i\}\)/,
                replace: "$&,\"data-user-id\":arguments[0].user?.id"
            }
        },
        // Voice channel container (voice channel sidebar)
        {
            find: "voiceUsers,!u",
            replacement: {
                match: /className:\i\(\)\(\i\.voiceUsers,!\i&&\i\.collapsed\),role:"group"/,
                replace: "$&,draggable:!0,onDragStart:e=>$self.onChannelDragStart(e)"
            }
        },
        // Member list rows (server member list)
        {
            find: "membersWrap",
            replacement: {
                match: /user:(\i),currentUser:(\i),/,
                replace: "user:$1,\"data-user-id\":$1.id,draggable:!0,onDragStart:e=>$self.onUserDragStart(e,{id:$1.id}),currentUser:$2,"
            }
        },
        // Voice channel list rows (guild sidebar)
        {
            find: "className:a()(this.getModeClass(),{[V.disabled]:this.isDisabled()}),\"data-dnd-name\":e.name,children:[(0,r.jsx)(u.yRy",
            replacement: {
                match: /"data-dnd-name":(\i)\.name,/,
                replace: "\"data-dnd-name\":$1.name,draggable:!0,onDragStart:t=>$self.onChannelDragStart(t,{id:$1.id,guild_id:$1.guild_id}),"
            }
        },
        // Channel list items (text/voice/thread/forum)
        {
            find: "\"data-dnd-name\":U.name",
            replacement: {
                match: /className:(\i)\.draggable,"data-dnd-name":(\i)\.name/,
                replace: "className:$1.draggable,draggable:!0,onDragStart:e=>$self.onChannelDragStart(e,{id:$2.id,guild_id:$2.guild_id}),\"data-dnd-name\":$2.name"
            }
        },
        // Thread rows in channel list (sidebar thread items)
        {
            find: "__invalid_threadMainContent",
            replacement: {
                match: /(?<=className:\i\.link,)/,
                replace: "draggable:!0,onDragStart:e=>$self.onChannelDragStart(e),"
            }
        },
        // Thread rows in channel list (threaded child rows)
        {
            find: "basicChannelRowLink",
            replacement: {
                match: /(className:\i\(\)\(\[\i\.link,\i\.basicChannelRowLink,\i\]\),)children:/,
                replace: "$1draggable:!0,onDragStart:e=>$self.onChannelDragStart(e),children:"
            }
        },
        // Channel list items (modern list wrapper)
        {
            find: "shouldShowThreadsPopout",
            replacement: {
                match: /"data-dnd-name":(\i)\.name,/,
                replace: "\"data-dnd-name\":$1.name,draggable:!0,onDragStart:e=>$self.onChannelDragStart(e,{id:$1.id,guild_id:$1.guild_id}),"
            }
        },
        // Thread rows (active threads popout)
        {
            find: "isForumPost()?e.shiftKey:!e.shiftKey",
            replacement: {
                match: /className:(\i)\.row,onClick:(\i)=>\{\(0,(\i)\.ok\)\((\i),/,
                replace: "className:$1.row,draggable:!0,onDragStart:$2=>$self.onChannelDragStart($2,{id:$4.id,guild_id:$4.guild_id}),onClick:$2=>{(0,$3.ok)($4,"
            }
        },
        // Member list rows
        {
            find: "onContextMenu:J,onMouseEnter:eD",
            replacement: {
                match: /onContextMenu:(\i),onMouseEnter:(\i)(?=.{0,500}?user:(\i),guildId:)/,
                replace: "onContextMenu:$1,draggable:!0,onDragStart:$2=>$self.onUserDragStart($2,$3),onMouseEnter:$2"
            }
        },
        // Chat usernames
        {
            find: "N.username",
            replacement: {
                match: /,"data-text":/,
                replace: ",draggable:!0,onDragStart:e=>$self.onUserDragStart(e,arguments[0].author),\"data-user-id\":arguments[0].author.id,\"data-text\":"
            }
        },
        // DM list entries
        {
            find: "href:eN?void 0:eh,target:\"_blank\",ref:ed,className:L.link",
            replacement: {
                match: /className:(\i)\.link,/,
                replace: "className:$1.link,draggable:!0,onDragStart:e=>$self.onDmDragStart(e),"
            }
        },
        // Forum post rows (forum channel list)
        {
            find: "\"data-item-id\":t,onClick:Z,onContextMenu:w",
            replacement: {
                match: /"data-item-id":(\i),/,
                replace: "\"data-item-id\":$1,draggable:!0,onDragStart:e=>$self.onChannelDragStart(e,{id:$1}),"
            }
        },
        {
            find: "[aria-owns=folder-items-",
            replacement: {
                match: /"data-dnd-name":(\i)\.name,"data-drop-hovering":(\i),children:\(0,(\i)\.jsx\)\((\i)\.LYs/,
                replace: "\"data-dnd-name\":$1.name,draggable:!0,onMouseDown:e=>$self.rememberGuildId($1.id),onDragStart:e=>$self.onGuildDragStart(e,$1.id),\"data-drop-hovering\":$2,children:(0,$3.jsx)($4.LYs"
            }
        },
        // Chat avatars (popout)
        {
            find: "className:K.avatar,src:u,avatarDecoration:d,status:a,size:f.EFr.SIZE_80",
            replacement: {
                match: /className:(\i)\.avatar,src:(\i),avatarDecoration:(\i),status:(\i),size:(\i)\.EFr\.SIZE_80,"aria-label":(\i)\.username/,
                replace: "className:$1.avatar,src:$2,avatarDecoration:$3,status:$4,size:$5.EFr.SIZE_80,draggable:!0,onDragStart:e=>$self.onUserDragStart(e),\"aria-label\":$6.username"
            }
        },
        // Chat avatars (no popout)
        {
            find: "children:ee(X(q({},W)",
            replacement: {
                match: /avatarSrc:(\i),avatarDecorationSrc:(\i),compact:(\i),onClick:(\i),onContextMenu:(\i),onMouseDown:void 0,onKeyDown:void 0,showCommunicationDisabledStyles:(\i),className:(\i)\}\)\)\}\)/,
                replace: "avatarSrc:$1,avatarDecorationSrc:$2,compact:$3,onClick:$4,onContextMenu:$5,onMouseDown:void 0,onKeyDown:void 0,showCommunicationDisabledStyles:$6,className:$7,draggable:!0,onDragStart:e=>$self.onUserDragStart(e)}))})"
            }
        },
    ],

    onDragOver(event: React.DragEvent) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    },

    async onDrop(event: React.DragEvent, channel?: Channel | null) {
        const { dataTransfer } = event;
        if (!dataTransfer || dataTransfer.files?.length) return;

        const dragifyData = dataTransfer.getData("application/dragify");
        if (dragifyData || activeUserDragId) {
            lastDropAt = Date.now();
            event.preventDefault();
            event.stopPropagation();
        }

        const resolvedChannel = channel
            ?? (SelectedChannelStore?.getChannelId?.()
                ? ChannelStore.getChannel(SelectedChannelStore.getChannelId())
                : null);
        if (!resolvedChannel) return;

        if (dragifyData) {
            const parsed = this.tryParseJson(dragifyData);
            if (parsed?.kind && parsed.id) {
                const fromDragify: DropEntity | null =
                    parsed.kind === "user"
                        ? { kind: "user", id: parsed.id }
                        : parsed.kind === "channel"
                            ? { kind: "channel", id: parsed.id, guildId: parsed.guildId }
                            : parsed.kind === "guild"
                                ? { kind: "guild", id: parsed.id }
                                : null;
                if (fromDragify) {
                    const key = `${fromDragify.kind}:${fromDragify.id}:${resolvedChannel.id}`;
                    const now = Date.now();
                    if (lastHandledDrop.key === key && now - lastHandledDrop.at < 150) return;
                    lastHandledDrop = { key, at: now };
                    await this.handleDropEntity(fromDragify, resolvedChannel, dragifyData);
                    return;
                }
            }
        }

        const payloads = await this.collectPayloadStrings(dataTransfer);
        let entity = this.parseFromStrings(payloads);
        if (!entity && activeDragEntity) {
            entity = activeDragEntity;
        } else if (!entity && activeUserDragId) {
            entity = { kind: "user", id: activeUserDragId };
        } else if (!entity && activeGuildDragId) {
            entity = { kind: "guild", id: activeGuildDragId };
        }
        if (!entity) {
            return;
        }

        const key = `${entity.kind}:${entity.id}:${resolvedChannel.id}`;
        const now = Date.now();
        if (lastHandledDrop.key === key && now - lastHandledDrop.at < 150) return;
        lastHandledDrop = { key, at: now };
        await this.handleDropEntity(entity, resolvedChannel, payloads);
    },

    async handleDropEntity(entity: DropEntity, channel: Channel, payloads: string[] | string) {
        try {
            const text = await this.buildText(entity, channel);
            if (!text) return;
            if (entity.kind === "user") {
                this.insertText(channel.id, text, { removeUnknownUser: true });
            } else {
                this.insertText(channel.id, text);
            }
            if (entity.kind === "guild") activeGuildDragId = null;
            if (entity.kind === "user") activeUserDragId = null;
            activeDragEntity = null;
        } catch (error) {
            logger.error("Failed handling drop", error);
            showToast("Dragify failed to handle drop.", Toasts.Type.FAILURE);
        }
    },

    parseFromStrings(payloads: string[]): DropEntity | null {
        if (payloads.length === 0) return null;

        for (const value of payloads) {
            const parsed = this.tryParseJson(value);
            if (parsed) {
                const id = parsed.id ?? parsed.userId ?? parsed.channelId ?? parsed.guildId;
                const type = (parsed.type ?? parsed.kind ?? parsed.itemType ?? "").toLowerCase();
                if (id) {
                    if (type.includes("user")) return { kind: "user", id };
                    if (type.includes("channel")) return { kind: "channel", id, guildId: parsed.guildId };
                    if (type.includes("guild") || type.includes("server")) return { kind: "guild", id };
                }
            }
        }

        for (const value of payloads) {
            const trimmed = value.trim();
            if (!trimmed) continue;
            const userFromMention = userMentionRegex.exec(trimmed);
            if (userFromMention) return { kind: "user", id: userFromMention[1] };
            const userFromProfile = userProfileUrlRegex.exec(trimmed);
            if (userFromProfile) return { kind: "user", id: userFromProfile[1] };
            const guildUserAvatar = guildUserAvatarRegex.exec(trimmed);
            if (guildUserAvatar) return { kind: "user", id: guildUserAvatar[1] };
            const userFromAvatar = userAvatarRegex.exec(trimmed);
            if (userFromAvatar) return { kind: "user", id: userFromAvatar[1] };
        }

        for (const value of payloads) {
            const trimmed = value.trim();
            if (!trimmed) continue;
            const channelFromMention = channelMentionRegex.exec(trimmed);
            if (channelFromMention) return { kind: "channel", id: channelFromMention[1] };
            const channelFromUrl = channelUrlRegex.exec(trimmed);
            if (channelFromUrl) {
                const guildId = channelFromUrl[1] === "@me" ? "@me" : channelFromUrl[2];
                return { kind: "channel", id: channelFromUrl[3], guildId: guildId ?? undefined };
            }
        }

        for (const value of payloads) {
            const trimmed = value.trim();
            if (!trimmed) continue;
            const guildFromIcon = guildIconRegex.exec(trimmed);
            if (guildFromIcon) return { kind: "guild", id: guildFromIcon[1] };
        }

        const candidates = this.extractSnowflakes(payloads);
        for (const candidate of candidates) {
            if (ChannelStore.getChannel(candidate)) return { kind: "channel", id: candidate };
            if (GuildStore.getGuild(candidate)) return { kind: "guild", id: candidate };
            if (UserStore.getUser(candidate)) return { kind: "user", id: candidate };
        }
        return null;
    },

    tryParseJson(value: string): Record<string, any> | null {
        if (!value || value.length < 2 || (value[0] !== "{" && value[0] !== "[")) return null;
        try {
            const parsed = JSON.parse(value);
            return typeof parsed === "object" && parsed ? parsed : null;
        } catch {
            return null;
        }
    },

    extractStrings(dataTransfer: DataTransfer): string[] {
        const collected = new Set<string>();
        const add = (v?: string) => v && collected.add(v);
        add(dataTransfer.getData("text/plain"));
        add(dataTransfer.getData("text/uri-list"));
        add(dataTransfer.getData("text/html"));
        add(dataTransfer.getData("text/x-moz-url"));
        add(dataTransfer.getData("application/json"));
        for (const type of dataTransfer.types ?? []) add(dataTransfer.getData(type));

        const split: string[] = [];
        for (const v of collected) {
            split.push(v);
            if (v.includes("\n")) split.push(...v.split(/\s+/).filter(Boolean));
        }
        return Array.from(new Set(split));
    },

    async collectPayloadStrings(dataTransfer: DataTransfer): Promise<string[]> {
        const sync = this.extractStrings(dataTransfer);
        const asyncValues: string[] = [];
        const itemPromises = Array.from(dataTransfer.items ?? [])
            .filter(item => item.kind === "string")
            .map(item => new Promise<void>(resolve => item.getAsString(val => {
                if (val) asyncValues.push(val);
                resolve();
            })));
        await Promise.all(itemPromises);
        return Array.from(new Set([...sync, ...asyncValues]));
    },

    extractSnowflakes(values: string[]): string[] {
        const ids = new Set<string>();
        const regex = /\d{17,20}/g;
        for (const value of values) {
            const matches = value.match(regex);
            if (matches) matches.forEach(id => ids.add(id));
        }
        return Array.from(ids);
    },

    shouldHandle(dataTransfer?: DataTransfer | null): boolean {
        if (!dataTransfer || dataTransfer.files?.length) return false;
        return this.parseFromStrings(this.extractStrings(dataTransfer)) !== null;
    },

    async buildText(entity: DropEntity, currentChannel: Channel): Promise<string | null> {
        switch (entity.kind) {
            case "user":
                return settings.store.userOutput === "id" ? entity.id : `<@${entity.id}>`;
            case "channel":
                return this.formatChannel(entity.id, entity.guildId);
            case "guild":
                return (await this.createInvite(entity.id, currentChannel)) ?? entity.id;
            default:
                return null;
        }
    },

    formatChannel(channelId: string, guildId?: string): string | null {
        if (settings.store.channelOutput === "link") {
            const channel = ChannelStore.getChannel(channelId);
            const effectiveGuildId = guildId ?? channel?.guild_id ?? "@me";
            return `https://discord.com/channels/${effectiveGuildId}/${channelId}`;
        }
        return `<#${channelId}>`;
    },

    async createInvite(guildId: string, currentChannel: Channel): Promise<string | null> {
        const inviteChannel = this.findInviteChannel(guildId, currentChannel);
        const fallbackChannelId = inviteChannel ? null : await this.fetchInviteChannelId(guildId);

        if (settings.store.reuseExistingInvites) {
            const cached = inviteCache.get(guildId);
            if (cached && !this.isInviteExpired(cached)) return `https://discord.gg/${cached.code}`;
            const reused = await this.fetchReusableInvite(guildId, inviteChannel ?? null);
            if (reused) return `https://discord.gg/${reused}`;
        }

        const inviteChannelId = inviteChannel?.id ?? fallbackChannelId;
        if (!inviteChannelId) {
            showToast("No channel available for invites.", Toasts.Type.FAILURE);
            return null;
        }
        if (inviteChannel && inviteChannel.guild_id !== guildId) {
            showToast("No channel available for invites.", Toasts.Type.FAILURE);
            return null;
        }

        try {
            const maxAge = Number(settings.store.inviteExpireAfter ?? 0);
            const maxUses = Number(settings.store.inviteMaxUses ?? 0);
            const { body } = await RestAPI.post({
                url: `/channels/${inviteChannelId}/invites`,
                body: {
                    max_age: Number.isFinite(maxAge) ? maxAge : 0,
                    max_uses: Number.isFinite(maxUses) ? maxUses : 0,
                    temporary: settings.store.inviteTemporaryMembership,
                    unique: true,
                },
            });
            const code = typeof body === "object" && body ? (body as { code?: string; }).code : null;
            if (!code) throw new Error("Invite response missing code");
            inviteCache.set(guildId, {
                code,
                expiresAt: maxAge > 0 ? Date.now() + maxAge * 1000 : null,
                maxUses: maxUses === 0 ? null : maxUses,
                uses: 0,
            });
            showToast("Invite created.", Toasts.Type.SUCCESS);
            return `https://discord.gg/${code}`;
        } catch (error) {
            logger.error("Failed to create invite", error);
            showToast("Unable to create invite.", Toasts.Type.FAILURE); // uh oh!
            return null;
        }
    },

    async fetchInviteChannelId(guildId: string): Promise<string | null> {
        try {
            const { body } = await RestAPI.get({ url: `/guilds/${guildId}/channels` });
            if (!Array.isArray(body)) return null;

            const candidates = (body as Array<any>)
                .filter(ch => ch && typeof ch.id === "string")
                .filter(ch => {
                    const { type } = ch;
                    return type === ChannelType.GUILD_TEXT
                        || type === ChannelType.GUILD_ANNOUNCEMENT
                        || type === ChannelType.GUILD_FORUM
                        || type === ChannelType.GUILD_MEDIA;
                })
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

            return candidates[0]?.id ?? null;
        } catch {
            return null;
        }
    },

    async fetchReusableInvite(guildId: string, inviteChannel: Channel | null): Promise<string | null> {
        const cached = inviteCache.get(guildId);
        if (cached && !this.isInviteExpired(cached)) return cached.code;

        try {
            const channelId = inviteChannel?.id ?? null;
            const url = channelId ? `/channels/${channelId}/invites` : `/guilds/${guildId}/invites`;

            const { body } = await RestAPI.get({ url });
            if (!Array.isArray(body)) return null;

            const now = Date.now();
            const invite = (body as Array<any>).find(inv => {
                const expiresAt = inv.expires_at ? Date.parse(inv.expires_at) : null;
                const maxUsesRaw = inv.max_uses ?? null;
                const maxUses = maxUsesRaw === 0 ? null : maxUsesRaw;
                const uses = inv.uses ?? null;
                const notExpired = expiresAt === null || expiresAt > now;
                const usesLeft = maxUses === null || uses === null || uses < maxUses;
                return notExpired && usesLeft && typeof inv.code === "string";
            });

            if (invite?.code) {
                inviteCache.set(guildId, {
                    code: invite.code,
                    expiresAt: invite.expires_at ? Date.parse(invite.expires_at) : null,
                    maxUses: invite.max_uses === 0 ? null : invite.max_uses ?? null,
                    uses: invite.uses ?? null,
                });
                return invite.code;
            }
        } catch {
            // If we cannot list invites (permissions/403), fall back silently.
            return null;
        }

        return null;
    },

    isInviteExpired(invite: { expiresAt: number | null; maxUses: number | null; uses: number | null; }): boolean {
        const now = Date.now();
        const expired = invite.expiresAt !== null && invite.expiresAt <= now;
        const exhausted = invite.maxUses !== null && invite.maxUses !== 0 && invite.uses !== null && invite.uses >= invite.maxUses;
        return expired || exhausted;
    },

    findInviteChannel(guildId: string, currentChannel: Channel): Channel | null {
        if (currentChannel.guild_id === guildId && this.canCreateInvite(currentChannel)) return currentChannel;

        const guild = GuildStore.getGuild(guildId);
        const preferredIds = [
            guild?.systemChannelId,
            guild?.rulesChannelId,
            guild?.publicUpdatesChannelId,
        ].filter(Boolean) as string[];
        for (const id of preferredIds) {
            const channel = ChannelStore.getChannel(id);
            if (this.canCreateInvite(channel)) return channel;
        }

        const selectableStore = (GuildChannelStore.getSelectableChannels?.(guildId) ?? []).map(e => e.channel).filter(Boolean) as Channel[];
        const selectableCollection = (() => {
            const collection = (GuildChannelStore as any).getChannels?.(guildId);
            const result: Channel[] = [];
            if (collection?.SELECTABLE) {
                const values = Object.values(collection.SELECTABLE) as any[];
                for (const val of values) {
                    const ch = (val as any).channel ?? val;
                    if (ch) result.push(ch as Channel);
                }
            }
            return result;
        })();

        const candidates = [...selectableStore, ...selectableCollection]
            .filter(ch => ch && ch.guild_id === guildId)
            .filter((ch, idx, arr) => arr.findIndex(c => c.id === ch.id) === idx)
            .sort((a, b) => {
                const pa = (a as any).position ?? 0;
                const pb = (b as any).position ?? 0;
                if (pa === pb) return a.id.localeCompare(b.id);
                return pa - pb;
            });

        for (const channel of candidates) {
            if (this.canCreateInvite(channel)) return channel;
        }

        return null;
    },

    canCreateInvite(channel?: Channel | null): channel is Channel {
        if (!channel || !channel.guild_id) return false;
        if (channel.type === ChannelType.DM || channel.type === ChannelType.GROUP_DM) return false;
        if (channel.type === ChannelType.GUILD_CATEGORY) return false;
        if (typeof channel.isThread === "function" && channel.isThread()) return false;
        return PermissionStore.can(PermissionsBits.CREATE_INSTANT_INVITE, channel);
    },

    insertText(channelId: string, text: string, options?: { removeUnknownUser?: boolean; }) {
        const insertAction = (Constants as any)?.CkL?.INSERT_TEXT ?? "INSERT_TEXT";
        const dispatcher = ComponentDispatch as any;
        if (dispatcher?.dispatchToLastSubscribed) {
            dispatcher.dispatchToLastSubscribed(insertAction, { plainText: text, rawText: text });
            return;
        }

        let existing = DraftStore.getDraft(channelId, DraftType.ChannelMessage) ?? "";
        if (options?.removeUnknownUser) {
            existing = existing.replace(/@unknown[- ]user/gi, "").trim();
        }
        const needsSpace = existing.length > 0 && !existing.endsWith(" ");
        const nextValue = needsSpace ? `${existing} ${text}` : `${existing}${text}`;

        const setDraftAction = (DraftActions as any).setDraft as DraftActions["setDraft"];
        const setDraftStore = (DraftStore as any).setDraft as DraftActions["setDraft"];
        const emitChange = (DraftStore as any).emitChange as (() => void) | undefined;

        if (setDraftAction) {
            setDraftAction(channelId, nextValue, DraftType.ChannelMessage);
        } else if (setDraftStore) {
            setDraftStore.call(DraftStore, channelId, nextValue, DraftType.ChannelMessage);
        } else {
            DraftActions.changeDraft(channelId, nextValue, DraftType.ChannelMessage);
        }

        DraftActions.saveDraft(channelId, nextValue, DraftType.ChannelMessage);
        if (emitChange) emitChange.call(DraftStore);
    },

    onChannelDragStart(event: DragEvent, channel?: Pick<Channel, "id" | "guild_id"> | { id: string; guildId?: string; }) {
        if (activeUserDragId) return;
        const existingDragify = event.dataTransfer?.getData("application/dragify") ?? "";
        if (existingDragify) {
            const parsed = this.tryParseJson(existingDragify);
            if (parsed?.kind === "user") return;
        }
        const targetEl = event.target as HTMLElement | null;
        if (targetEl?.closest?.("[class*=\"voiceUser\"]")) {
            logger.debug("Channel dragstart from voice user target");
        }
        if (targetEl?.closest?.("[data-user-id]")) return;

        const targetResolved = this.extractChannelIdFromTarget(event.target as HTMLElement | null);
        const resolved = channel ?? targetResolved;
        const channelId = resolved?.id ?? targetResolved?.id;
        if (!channelId) return;

        const channelObj = ChannelStore.getChannel(channelId);
        const resolvedGuildId = resolved ? ("guild_id" in resolved ? resolved.guild_id : resolved.guildId) : undefined;
        const guildId = resolvedGuildId ?? targetResolved?.guildId ?? channelObj?.guild_id;
        if (channelObj?.isDM?.() || channelObj?.type === ChannelType.DM) {
            const recipientId = this.getDmRecipientId(channelObj);
            if (recipientId) {
                this.onUserDragStart(event, { id: recipientId });
                return;
            }
        }
        this.showGhost({ kind: "channel", id: channelId, guildId }, event);
        const payload = JSON.stringify({ kind: "channel", id: channelId, guildId });
        activeDragEntity = { kind: "channel", id: channelId, guildId };
        const text = this.formatChannel(channelId, guildId) ?? channelId;
        const isMention = settings.store.channelOutput === "mention";
        if (isMention && event.dataTransfer?.clearData) {
            event.dataTransfer.clearData("text/uri-list");
            event.dataTransfer.clearData("text/html");
        }
        event.dataTransfer?.setData("text/plain", text);
        event.dataTransfer?.setData("application/json", payload);
        event.dataTransfer?.setData("application/dragify", payload);
    },

    onUserDragStart(event: DragEvent, user?: { id: string; }) {
        const searchTarget = event.target as HTMLElement | null;
        if (searchTarget && typeof (searchTarget as any).closest === "function") {
            const chatMessage = searchTarget.closest("[data-author-id]") as HTMLElement | null;
            if (chatMessage) {
                const authorId = chatMessage.getAttribute("data-author-id");
                const parsed = authorId ? this.extractSnowflakeFromString(authorId) : null;
                if (parsed) {
                    user = { id: parsed };
                }
            }
        }
        const currentTarget = (event as unknown as { currentTarget?: EventTarget | null; }).currentTarget as HTMLElement | null;
        const target = (event.target as HTMLElement | null) ?? null;
        const userIdFromParam =
            user?.id
            ?? (user as any)?.userId
            ?? (user as any)?.user?.id
            ?? null;
        const userIdFromDom =
            currentTarget?.getAttribute?.("data-user-id")
            ?? currentTarget?.closest?.("[data-user-id]")?.getAttribute?.("data-user-id")
            ?? target?.getAttribute?.("data-user-id")
            ?? target?.closest?.("[data-user-id]")?.getAttribute?.("data-user-id")
            ?? null;
        const userIdFromEvent = this.extractUserIdFromEvent(event);
        const rawUserId =
            userIdFromParam
            ?? userIdFromDom
            ?? this.extractUserIdFromTarget(currentTarget)
            ?? this.extractUserIdFromTarget(target)
            ?? userIdFromEvent
            ?? event.dataTransfer?.getData("data-user-id")
            ?? null;
        const userId = rawUserId ? (this.extractSnowflakeFromString(rawUserId) ?? rawUserId) : null;
        if (!userId || !/^\d{17,20}$/.test(userId)) return;
        const payload = JSON.stringify({ kind: "user", id: userId });
        event.stopPropagation();
        activeUserDragId = userId;
        activeDragEntity = { kind: "user", id: userId };
        this.showGhost({ kind: "user", id: userId }, event);
        const text = settings.store.userOutput === "id" ? userId : `<@${userId}>`;
        event.dataTransfer?.setData("text/plain", text);
        event.dataTransfer?.setData("data-user-id", userId);
        event.dataTransfer?.setData("application/json", payload);
        event.dataTransfer?.setData("application/dragify", payload);
    },

    onDmDragStart(event: DragEvent, channel?: Channel | null) {
        let resolvedChannel = channel ?? null;
        const channelId = resolvedChannel?.id ?? null;
        if (!resolvedChannel && event.target) {
            const targetChannel = this.extractChannelIdFromTarget(event.target as HTMLElement | null);
            if (targetChannel?.id) resolvedChannel = ChannelStore.getChannel(targetChannel.id) ?? null;
        } else if (channelId && !resolvedChannel?.getRecipientId) {
            resolvedChannel = ChannelStore.getChannel(channelId) ?? resolvedChannel;
        }
        if (!resolvedChannel) return;
        const recipientId = this.getDmRecipientId(resolvedChannel);
        if (recipientId) {
            this.onUserDragStart(event, { id: recipientId });
            return;
        }

        this.onChannelDragStart(event, resolvedChannel);
    },

    onGuildDragStart(event: DragEvent, guildId: string) {
        this.showGhost({ kind: "guild", id: guildId }, event);
        const payload = JSON.stringify({ kind: "guild", id: guildId });
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "copyMove";
        activeGuildDragId = guildId;
        activeDragEntity = { kind: "guild", id: guildId };
        event.dataTransfer?.setData("application/json", payload);
        event.dataTransfer?.setData("application/dragify", payload);
        event.dataTransfer?.setData("text/plain", guildId);
    },

    rememberGuildId(guildId: string) {
        activeGuildDragId = guildId;
    },

    start() {
        pluginInstance = this;
        this.mountGhost();
        window.addEventListener("dragover", this.globalDragOver, true);
        window.addEventListener("drop", this.globalDrop, true);
        window.addEventListener("dragstart", this.globalDragStart, true);
        window.addEventListener("mousemove", this.globalDragMove, true);
        window.addEventListener("drag", this.globalDragMove, true);
        window.addEventListener("dragover", this.globalDragMove, true);
        window.addEventListener("dragend", this.globalDragEnd, true);
    },

    stop() {
        window.removeEventListener("dragover", this.globalDragOver, true);
        window.removeEventListener("drop", this.globalDrop, true);
        window.removeEventListener("dragstart", this.globalDragStart, true);
        window.removeEventListener("mousemove", this.globalDragMove, true);
        window.removeEventListener("drag", this.globalDragMove, true);
        window.removeEventListener("dragover", this.globalDragMove, true);
        window.removeEventListener("dragend", this.globalDragEnd, true);
        activeUserDragId = null;
        activeGuildDragId = null;
        activeDragEntity = null;
        this.unmountGhost();
        pluginInstance = null;
    },

    globalDragOver: (event: DragEvent) => {
        const inst = pluginInstance;
        if (!inst) return;
        if (!inst.isMessageInputEvent(event)) return;
        const hasActiveGuildDrag = activeGuildDragId !== null;
        const shouldHandle = hasActiveGuildDrag || inst.shouldHandle(event.dataTransfer);
        if (!shouldHandle) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    },

    globalDrop: async (event: DragEvent) => {
        const inst = pluginInstance;
        if (!inst) return;
        if (!inst.isMessageInputEvent(event)) return;
        const channelId = SelectedChannelStore?.getChannelId?.();
        const channel = channelId ? ChannelStore.getChannel(channelId) : null;
        if (!channel) return;

        const types = event.dataTransfer?.types ?? [];
        const hasDragify = types.includes("application/dragify");
        const likelyJson = types.includes("application/json");
        const hasActiveGuildDrag = activeGuildDragId !== null;
        const hasActiveUserDrag = activeUserDragId !== null;
        const hasActiveEntity = activeDragEntity !== null;

        const payloads = await inst.collectPayloadStrings(event.dataTransfer as DataTransfer);
        const entity = inst.parseFromStrings(payloads);
        if (!hasDragify && !entity && !likelyJson && !hasActiveGuildDrag && !hasActiveUserDrag && !hasActiveEntity) return;

        lastDropAt = Date.now();
        event.preventDefault();
        event.stopPropagation();
        inst.onDrop(event as unknown as React.DragEvent, channel);
        hideGhost();
    },

    globalDragStart: (event: DragEvent) => {
        const inst = pluginInstance;
        if (!inst || !event.dataTransfer) return;

        const target = event.target as HTMLElement | null;
        if (!target) return;

        if (!event.dataTransfer.types?.includes("application/dragify")) {
            if (typeof document !== "undefined" && typeof event.clientX === "number" && typeof event.clientY === "number") {
                const atPoint = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
                const voiceAtPoint = atPoint?.closest?.("[class*=\"voiceUser\"]") as HTMLElement | null;
                if (voiceAtPoint) {
                    const nestedUserId = voiceAtPoint.querySelector?.("[data-user-id]")?.getAttribute("data-user-id") ?? null;
                    const userId = nestedUserId ?? inst.extractUserIdFromTarget(voiceAtPoint);
                    if (userId) {
                        inst.onUserDragStart(event, { id: userId });
                        return;
                    }
                }
            }

            const path = event.composedPath?.() ?? [];
            for (const entry of path) {
                const el = entry as HTMLElement | null;
                if (!el || typeof el.className !== "string") continue;
                if (!el.className.includes("voiceUser")) continue;
                const userId = inst.extractUserIdFromTarget(el);
                if (userId) {
                    inst.onUserDragStart(event, { id: userId });
                }
                return;
            }
        }

        const authorContainer = target.closest?.("[data-author-id]") as HTMLElement | null;
        const authorId = authorContainer?.getAttribute?.("data-author-id") ?? null;
        if (authorId && target.getAttribute?.("data-text") && !event.dataTransfer.types?.includes("application/dragify")) {
            inst.onUserDragStart(event, { id: authorId });
            return;
        }

        const userIdFromTarget = inst.extractUserIdFromEvent(event) ?? inst.extractUserIdFromTarget(target);
        if (userIdFromTarget && !event.dataTransfer.types?.includes("application/dragify")) {
            inst.onUserDragStart(event, { id: userIdFromTarget });
            return;
        }

        const channelFromTarget = inst.extractChannelIdFromTarget(target);
        if (channelFromTarget && !event.dataTransfer.types?.includes("application/dragify")) {
            if (target.closest?.("[data-user-id]")) return;
            inst.onChannelDragStart(event, channelFromTarget);
            return;
        }

        const guildId = inst.extractGuildIdFromTarget(target);
        if (!guildId) return;

        if (!event.dataTransfer.types?.includes("application/dragify")) {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "copyMove";
            activeGuildDragId = guildId;
            event.dataTransfer.setData("application/json", JSON.stringify({ kind: "guild", id: guildId }));
            event.dataTransfer.setData("application/dragify", JSON.stringify({ kind: "guild", id: guildId }));
            event.dataTransfer.setData("text/plain", guildId);
            inst.showGhost({ kind: "guild", id: guildId }, event);
        }
    },
    globalDragEnd: (_event: DragEvent) => {
        const now = Date.now();
        setTimeout(() => {
            if (Date.now() - lastDropAt < 100) return;
            activeUserDragId = null;
            activeGuildDragId = null;
            activeDragEntity = null;
            hideGhost();
        }, 0);
    },
    globalDragMove: (event: DragEvent | MouseEvent) => {
        if (!ghostState.visible) return;
        if (typeof event.clientX !== "number" || typeof event.clientY !== "number") return;
        scheduleGhostPosition(event.clientX + 16, event.clientY + 20);
    },
    isMessageInputEvent(event: DragEvent): boolean {
        const target = event.target as Element | null;
        if (this.isMessageInputElement(target)) return true;

        const path = event.composedPath?.() ?? [];
        for (const entry of path) {
            if (this.isMessageInputElement(entry as Element | null)) return true;
        }

        if (typeof document !== "undefined" && typeof event.clientX === "number" && typeof event.clientY === "number") {
            const elements = document.elementsFromPoint?.(event.clientX, event.clientY);
            if (elements && elements.length) {
                for (const el of elements) {
                    if (this.isMessageInputElement(el)) return true;
                }
            } else {
                const atPoint = document.elementFromPoint(event.clientX, event.clientY);
                if (this.isMessageInputElement(atPoint)) return true;
            }
        }

        return false;
    },

    isMessageInputElement(el: Element | null): boolean {
        if (!el) return false;
        const selector = "[data-slate-editor],[role=\"textbox\"],[contenteditable=\"true\"],[aria-label^=\"Message \"]";
        return Boolean((el as HTMLElement).closest?.(selector));
    },

    extractGuildIdFromTarget(target: HTMLElement): string | null {
        let el: HTMLElement | null = target;
        while (el) {
            const listId = el.getAttribute("data-list-id");
            const rawId = el.getAttribute("data-list-item-id") ?? "";
            const isGuildContext = (listId && /guild/i.test(listId)) || /guild/i.test(rawId);

            if (!isGuildContext) {
                el = el.parentElement;
                continue;
            }

            const parts = rawId.split("___");
            const candidate = parts[parts.length - 1] ?? rawId;
            if (/^\d{17,20}$/.test(candidate)) return candidate;

            const direct =
                this.extractSnowflakeFromString(rawId) ??
                this.extractSnowflakeFromString(listId ?? "") ??
                this.extractSnowflakeFromString(el.getAttribute("data-guild-id") ?? "");
            if (direct) return direct;

            el = el.parentElement;
        }
        return null;
    },

    extractChannelIdFromTarget(target: HTMLElement | null): { id: string; guildId?: string; } | null {
        let el: HTMLElement | null = target;
        while (el) {
            const listId = el.getAttribute("data-list-id") ?? "";
            const rawId = el.getAttribute("data-list-item-id") ?? "";
            const channelIdAttr = el.getAttribute("data-channel-id") ?? el.getAttribute("data-item-id") ?? "";
            const threadIdAttr = el.getAttribute("data-thread-id") ?? "";
            const href = el.getAttribute("href") ?? "";
            const isChannelContext = /(channel|thread|private|forum)/i.test(listId) || /(channel|thread|private|forum)/i.test(rawId);

            const pathMatch = href.match(channelPathRegex);
            if (pathMatch) {
                const guildId = pathMatch[1] === "@me" ? undefined : pathMatch[1];
                return { id: pathMatch[2], guildId };
            }

            const fullMatch = href.match(channelUrlRegex);
            if (fullMatch) {
                const guildId = fullMatch[1] ?? fullMatch[2];
                return { id: fullMatch[3], guildId: guildId === "@me" ? undefined : guildId };
            }

            const candidate = isChannelContext
                ? (this.extractSnowflakeFromString(threadIdAttr)
                    ?? this.extractSnowflakeFromString(channelIdAttr)
                    ?? this.extractSnowflakeFromString(rawId)
                    ?? this.extractSnowflakeFromString(listId))
                : null;
            if (candidate) {
                const guildId = this.extractSnowflakeFromString(el.getAttribute("data-guild-id") ?? "") ?? undefined;
                return { id: candidate, guildId };
            }

            el = el.parentElement;
        }
        return null;
    },

    extractUserIdFromTarget(target: HTMLElement | null): string | null {
        let el: HTMLElement | null = target;
        while (el) {
            if (typeof (el as any).getAttribute !== "function") {
                el = (el as any).parentElement ?? null;
                continue;
            }
            const dataUserId = el.getAttribute("data-user-id") ?? el.getAttribute("data-userid") ?? "";
            const dataAuthorId = el.getAttribute("data-author-id") ?? "";
            const listId = el.getAttribute("data-list-item-id") ?? el.getAttribute("data-item-id") ?? "";
            const href = el.getAttribute("href") ?? "";
            const src = el.getAttribute("src") ?? "";
            const aria = el.getAttribute("aria-label") ?? "";

            const explicit = this.extractSnowflakeFromString(dataUserId)
                ?? this.extractSnowflakeFromString(dataAuthorId);
            if (explicit) return explicit;

            const listCandidate = this.extractSnowflakeFromString(listId);
            if (listCandidate) {
                if (UserStore.getUser(listCandidate)) return listCandidate;
                const channel = ChannelStore.getChannel(listCandidate);
                if (channel?.isDM?.() || channel?.type === ChannelType.DM || channel?.type === ChannelType.GROUP_DM) {
                    return this.getDmRecipientId(channel);
                }
            }

            const profile = href.match(userProfileUrlRegex);
            if (profile?.[1]) return profile[1];

            const avatar = src.match(guildUserAvatarRegex) ?? src.match(userAvatarRegex);
            if (avatar?.[1]) return avatar[1];

            const styleAttr = el.getAttribute("style") ?? "";
            const bgImage = (el as HTMLElement).style?.backgroundImage ?? "";
            const styleAvatar = (styleAttr + " " + bgImage).match(guildUserAvatarRegex)
                ?? (styleAttr + " " + bgImage).match(userAvatarRegex);
            if (styleAvatar?.[1]) return styleAvatar[1];

            const ariaMatch = this.extractSnowflakeFromString(aria);
            if (ariaMatch) return ariaMatch;

            el = el.parentElement;
        }
        return null;
    },

    extractUserIdFromEvent(event: DragEvent): string | null {
        const path = event.composedPath?.() ?? [];
        for (const entry of path) {
            const candidate = this.extractUserIdFromTarget(entry as HTMLElement | null);
            if (candidate) return candidate;
        }

        const target = event.target as HTMLElement | null;
        if (target) {
            const direct = target.closest?.("[data-author-id],[data-user-id]") as HTMLElement | null;
            if (direct) {
                return this.extractUserIdFromTarget(direct);
            }
        }

        if (typeof document !== "undefined" && typeof event.clientX === "number" && typeof event.clientY === "number") {
            const elements = document.elementsFromPoint?.(event.clientX, event.clientY);
            if (elements && elements.length) {
                for (const el of elements) {
                    const candidate = this.extractUserIdFromTarget(el as HTMLElement | null);
                    if (candidate) return candidate;
                }
            }
        }

        return null;
    },

    extractSnowflakeFromString(value: string): string | null {
        const match = value.match(/\d{17,20}/);
        return match?.[0] ?? null;
    },

    mountGhost() {
        if (ghostRoot || typeof document === "undefined") return;
        ghostContainer = document.createElement("div");
        ghostContainer.className = "vc-dragify-ghost-root";
        document.body.appendChild(ghostContainer);
        ghostRoot = createRoot(ghostContainer);
        ghostRoot.render(
            <ErrorBoundary>
                <DragGhost />
            </ErrorBoundary>
        );
    },

    unmountGhost() {
        if (ghostRoot) ghostRoot.unmount();
        ghostRoot = null;
        ghostContainer?.remove();
        ghostContainer = null;
        if (ghostHideTimer !== null) {
            clearTimeout(ghostHideTimer);
            ghostHideTimer = null;
        }
        hideGhost();
    },

    showGhost(entity: DropEntity, event?: DragEvent) {
        const ghost = this.buildGhost(entity);
        if (!ghost) return;
        if (ghostHideTimer !== null) {
            clearTimeout(ghostHideTimer);
            ghostHideTimer = null;
        }
        if (event && typeof event.clientX === "number" && typeof event.clientY === "number") {
            scheduleGhostPosition(event.clientX + 16, event.clientY + 20);
        }
        setGhostState({ ...ghost, entityId: entity.id, visible: true, exiting: false });
    },

    buildGhost(entity: DropEntity): Omit<GhostState, "visible" | "x" | "y"> | null {
        if (entity.kind === "user") {
            const user = UserStore.getUser(entity.id);
            const title = user?.globalName ?? user?.username ?? "Unknown user";
            const subtitle = user?.username ? `@${user.username}` : "User";
            const iconUrl = user?.getAvatarURL?.(void 0, 80, true) ?? undefined;
            return { kind: "user", title, subtitle, iconUrl, symbol: "@", badge: "user", entityId: entity.id, exiting: false };
        }

        if (entity.kind === "channel") {
            const channel = ChannelStore.getChannel(entity.id);
            const isThread = Boolean(channel && typeof channel.isThread === "function" && channel.isThread());
            const title = channel?.name
                ? `${isThread ? "" : "#"}${channel.name}`
                : `${isThread ? "" : "#"}${entity.id}`;
            const guild = channel?.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
            const subtitle = guild?.name ?? (entity.guildId ? "Server" : "Direct Messages");
            let iconUrl: string | undefined;
            if (guild?.icon) {
                iconUrl = IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 64 }) ?? undefined;
            } else if (channel?.isDM?.() || channel?.type === ChannelType.DM || channel?.type === ChannelType.GROUP_DM) {
                const recipientId = this.getDmRecipientId(channel);
                const recipient = recipientId ? UserStore.getUser(recipientId) : null;
                iconUrl = recipient?.getAvatarURL?.(void 0, 80, true) ?? undefined;
            }
            let badge = "channel";
            if (channel) {
                if (isThread) {
                    badge = "thread";
                } else {
                    switch (channel.type) {
                        case ChannelType.GUILD_VOICE:
                        case ChannelType.GUILD_STAGE_VOICE:
                            badge = "voice";
                            break;
                        case ChannelType.GUILD_FORUM:
                            badge = "forum";
                            break;
                        case ChannelType.GUILD_MEDIA:
                            badge = "media";
                            break;
                        case ChannelType.GUILD_ANNOUNCEMENT:
                            badge = "announcement";
                            break;
                        case ChannelType.DM:
                        case ChannelType.GROUP_DM:
                            badge = "dm";
                            break;
                        default:
                            badge = "channel";
                    }
                }
            }
            return { kind: "channel", title, subtitle, iconUrl, badge, entityId: entity.id, exiting: false };
        }

        const guild = GuildStore.getGuild(entity.id);
        const title = guild?.name ?? "Server";
        const subtitle = "Server";
        const iconUrl = guild?.icon
            ? IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 64 }) ?? undefined
            : undefined;
        const symbol = guild ? getGuildAcronym(guild) : "S";
        return { kind: "guild", title, subtitle, iconUrl, symbol, badge: "server", entityId: entity.id, exiting: false };
    },

    getDmRecipientId(channel?: Channel | null): string | null {
        if (!channel) return null;
        const raw =
            (channel as any).getRecipientId?.()
            ?? (channel as any).recipientId
            ?? channel.recipients?.[0]
            ?? (channel as any).rawRecipients?.[0]
            ?? null;
        return typeof raw === "string" ? raw : null;
    },
});
