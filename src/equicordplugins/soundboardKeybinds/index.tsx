/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { playAudio } from "@api/AudioPlayer";
import type { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { UserSettings } from "@api/UserSettings";
import { Button } from "@components/Button";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import type { ModalAction, RenderModalProps } from "@vencord/discord-types";
import {
    Constants,
    FluxDispatcher,
    GuildStore,
    lodash,
    MediaEngineStore,
    Menu,
    Modal,
    openModal,
    React,
    RestAPI,
    SelectedChannelStore,
    showToast,
    SoundboardStore,
    TextInput,
    Toasts,
    useEffect,
    useMemo,
    UserSettingsActionCreators,
    UserSettingsProtoStore,
    UserStore,
    useState,
    useStateFromStores
} from "@webpack/common";

interface SoundboardKeybind {
    keybind: string;
    soundId: string;
    guildId: string;
    name?: string;
    emojiName?: string | null;
    emojiId?: string | null;
    volume?: number;
    available?: boolean;
}

interface SoundboardSound {
    soundId: string;
    guildId: string;
    name?: string;
    emojiName?: string | null;
    emojiId?: string | null;
    volume?: number;
    available?: boolean;
}

const DEFAULT_KEYBINDS = "{}";
const KEYBIND_SETTINGS: "keybinds"[] = ["keybinds"];
let isRecordingKeybind = false;

const settings = definePluginSettings({
    keybinds: {
        type: OptionType.COMPONENT,
        description: "Configure keyboard shortcuts for soundboard sounds.",
        component: SoundboardKeybindsInput,
        default: DEFAULT_KEYBINDS
    }
});

function PlayIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ display: "inline-block", verticalAlign: "middle" }}>
            <path d="M8 5v14l11-7z" />
        </svg>
    );
}

function getSoundUrl(soundId: string): string {
    const cdnHost = window.GLOBAL_ENV?.CDN_HOST ?? "cdn.discordapp.com";
    return `https://${cdnHost}/soundboard-sounds/${soundId}`;
}

function getSoundboardSliderVolume(): number {
    try {
        const protoSetting = (UserSettingsProtoStore?.settings as any)?.voiceAndVideo?.soundboardSettings;
        if (protoSetting && typeof protoSetting.volume === "number" && !isNaN(protoSetting.volume)) {
            return Math.max(0, Math.min(100, protoSetting.volume));
        }
    } catch {}

    try {
        const protoSettingSnake = (UserSettingsProtoStore?.settings as any)?.voiceAndVideo?.soundboard_settings;
        if (protoSettingSnake && typeof protoSettingSnake.volume === "number" && !isNaN(protoSettingSnake.volume)) {
            return Math.max(0, Math.min(100, protoSettingSnake.volume));
        }
    } catch {}

    try {
        const currentValue = (UserSettingsActionCreators?.PreloadedUserSettingsActionCreators?.getCurrentValue?.() as any)?.voiceAndVideo?.soundboardSettings;
        if (currentValue && typeof currentValue.volume === "number" && !isNaN(currentValue.volume)) {
            return Math.max(0, Math.min(100, currentValue.volume));
        }
    } catch {}

    try {
        const currentValueSnake = (UserSettingsActionCreators?.PreloadedUserSettingsActionCreators?.getCurrentValue?.() as any)?.voiceAndVideo?.soundboard_settings;
        if (currentValueSnake && typeof currentValueSnake.volume === "number" && !isNaN(currentValueSnake.volume)) {
            return Math.max(0, Math.min(100, currentValueSnake.volume));
        }
    } catch {}

    try {
        if (UserSettings) {
            for (const key of Object.keys(UserSettings)) {
                const s = UserSettings[key];
                if (s?.userSettingsAPIGroup === "voiceAndVideo" && (s?.userSettingsAPIName === "soundboardSettings" || s?.userSettingsAPIName === "soundboard_settings")) {
                    const setting = s.getSetting?.();
                    if (setting && typeof setting.volume === "number" && !isNaN(setting.volume)) {
                        return Math.max(0, Math.min(100, setting.volume));
                    }
                }
            }
        }
    } catch {}

    try {
        const anyProto = (UserSettingsProtoStore as any)?.getSettings?.()?.voiceAndVideo?.soundboardSettings;
        if (anyProto && typeof anyProto.volume === "number" && !isNaN(anyProto.volume)) {
            return Math.max(0, Math.min(100, anyProto.volume));
        }
    } catch {}

    return 100;
}

function calculateEffectiveVolume(soundVolume = 1): number {
    if (MediaEngineStore.isDeaf?.() || MediaEngineStore.isSelfDeaf?.()) return 0;

    const sliderVolume = getSoundboardSliderVolume();
    if (sliderVolume <= 0) return 0;

    const normalizedSoundVolume = soundVolume > 1 ? soundVolume / 100 : soundVolume;
    if (normalizedSoundVolume <= 0) return 0;

    const n = sliderVolume / 100;
    const scaledSlider = n < 1 ? Math.pow(n, 0.35714285714285715) : (20 * Math.log10(n) / 6 + 1);

    const masterVolume = typeof MediaEngineStore.getOutputVolume === "function"
        ? Math.min(MediaEngineStore.getOutputVolume() / 100, 1)
        : 1;

    const finalMultiplier = Math.min(normalizedSoundVolume * scaledSlider * masterVolume, 1);
    return Math.max(0, Math.min(100, finalMultiplier * 100));
}

function playSoundPreview(soundId: string, volume = 1) {
    try {
        const effectiveVolume = calculateEffectiveVolume(volume);
        if (effectiveVolume <= 0) return;
        playAudio(getSoundUrl(soundId), { volume: effectiveVolume });
    } catch {
        showToast("Failed to preview sound.", Toasts.Type.FAILURE);
    }
}

function formatEventToKeybind(event: KeyboardEvent): string | null {
    if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return null;

    const parts: string[] = [];
    if (event.ctrlKey) parts.push("Control");
    if (event.shiftKey) parts.push("Shift");
    if (event.altKey) parts.push("Alt");
    if (event.metaKey) parts.push("Meta");

    let key = event.code;
    if (key.startsWith("Key") && key.length === 4) {
        key = key.slice(3).toUpperCase();
    } else if (key.startsWith("Digit") && key.length === 6) {
        key = key.slice(5);
    } else if (key.startsWith("Numpad") && key.length === 7 && !isNaN(Number(key.slice(6)))) {
        key = `Num${key.slice(6)}`;
    } else if (/^F\d{1,2}$/i.test(event.key)) {
        key = event.key.toUpperCase();
    } else {
        const specialKeyMap: Record<string, string> = {
            " ": "Space",
            "Space": "Space",
            "Escape": "Escape",
            "Enter": "Enter",
            "Tab": "Tab",
            "ArrowUp": "Up",
            "ArrowDown": "Down",
            "ArrowLeft": "Left",
            "ArrowRight": "Right",
            "Minus": "-",
            "Equal": "=",
            "BracketLeft": "[",
            "BracketRight": "]",
            "Backslash": "\\",
            "Semicolon": ";",
            "Quote": "'",
            "Backquote": "`",
            "Comma": ",",
            "Period": ".",
            "Slash": "/"
        };
        key = specialKeyMap[event.code] || specialKeyMap[event.key] || event.key.toUpperCase();
    }

    parts.push(key);
    return parts.join("+");
}

function normalizeKeybind(k: string): string {
    return k.toLowerCase()
        .replace(/\bctrl\b/g, "control")
        .replace(/\bcmd\b/g, "meta")
        .split("+")
        .map(p => p.trim())
        .sort()
        .join("+");
}

function isSameKeybind(a: string, b: string): boolean {
    return normalizeKeybind(a) === normalizeKeybind(b);
}

function matchesKeybind(event: KeyboardEvent, keybind: string): boolean {
    const target = formatEventToKeybind(event);
    if (!target) return false;
    return isSameKeybind(target, keybind);
}

function getCurrentUserId(): string {
    try {
        return UserStore.getCurrentUser()?.id || "global";
    } catch {
        return "global";
    }
}

function getAllUserKeybinds(raw = settings.store.keybinds): Record<string, SoundboardKeybind[]> {
    try {
        const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
            const currentId = getCurrentUserId();
            const valid = parsed.filter((entry): entry is SoundboardKeybind =>
                typeof entry === "object" && entry !== null
                && typeof entry.keybind === "string" && typeof entry.soundId === "string" && entry.guildId != null
            );
            return { [currentId]: valid };
        }
        if (parsed && typeof parsed === "object") {
            const result: Record<string, SoundboardKeybind[]> = {};
            for (const [uid, list] of Object.entries(parsed)) {
                if (Array.isArray(list)) {
                    result[uid] = list.filter((entry): entry is SoundboardKeybind =>
                        typeof entry === "object" && entry !== null
                        && typeof entry.keybind === "string" && typeof entry.soundId === "string" && entry.guildId != null
                    );
                }
            }
            return result;
        }
    } catch {}
    return {};
}

function getKeybinds(userId = getCurrentUserId(), raw = settings.store.keybinds): SoundboardKeybind[] {
    const all = getAllUserKeybinds(raw);
    return all[userId] ?? all.global ?? [];
}

function resolveSoundMeta(soundId: string, guildId?: string): Partial<SoundboardSound> {
    try {
        if (typeof SoundboardStore !== "undefined") {
            const sound = SoundboardStore.getSoundById?.(soundId)
                ?? (guildId ? SoundboardStore.getSound?.(guildId, soundId) : undefined);
            if (sound) {
                return {
                    name: sound.name,
                    emojiName: sound.emojiName,
                    emojiId: sound.emojiId,
                    volume: sound.volume,
                    guildId: sound.guildId || guildId
                };
            }
        }
    } catch {}
    return {};
}

function saveKeybind(keybind: string, sound: SoundboardSound) {
    const userId = getCurrentUserId();
    const meta = resolveSoundMeta(sound.soundId, sound.guildId);
    const enriched: SoundboardKeybind = {
        soundId: sound.soundId,
        guildId: String(sound.guildId),
        name: sound.name || meta.name || `Sound ${sound.soundId}`,
        emojiName: sound.emojiName ?? meta.emojiName ?? null,
        emojiId: sound.emojiId ?? meta.emojiId ?? null,
        volume: sound.volume ?? meta.volume ?? 1,
        keybind
    };

    const all = getAllUserKeybinds();
    const userKeybinds = (all[userId] ?? all.global ?? []).filter(entry =>
        entry.soundId !== sound.soundId && !isSameKeybind(entry.keybind, keybind)
    );
    userKeybinds.push(enriched);
    all[userId] = userKeybinds;
    settings.store.keybinds = JSON.stringify(all, null, 2);
    showToast(`Saved shortcut "${keybind}" for ${enriched.name}.`, Toasts.Type.SUCCESS);
}

function removeKeybind(soundId: string) {
    const userId = getCurrentUserId();
    const all = getAllUserKeybinds();
    const userKeybinds = all[userId] ?? all.global ?? [];
    const target = userKeybinds.find(k => k.soundId === soundId);
    all[userId] = userKeybinds.filter(k => k.soundId !== soundId);
    settings.store.keybinds = JSON.stringify(all, null, 2);
    if (target) {
        showToast(`Removed shortcut for ${target.name || "sound"}.`, Toasts.Type.MESSAGE);
    }
}

function KeybindDisplay({ keybind }: { keybind: string }) {
    const keys = keybind.split("+").map(k => k.trim());
    return (
        <div
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 8px",
                borderRadius: 6,
                background: "var(--background-tertiary, #1e1f22)",
                border: "1px solid var(--background-floating, #35363c)",
                cursor: "default",
                userSelect: "none"
            }}
        >
            <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--header-secondary, #b5bac1)",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
            }}>
                Key:
            </span>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                {keys.map((key, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && (
                            <span style={{
                                color: "var(--text-muted, #949ba4)",
                                fontWeight: 700,
                                fontSize: 12
                            }}>
                                +
                            </span>
                        )}
                        <kbd style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "2px 7px",
                            fontSize: 12,
                            fontWeight: 700,
                            fontFamily: "Consolas, Monaco, monospace, sans-serif",
                            color: "#ffffff",
                            background: "var(--background-secondary-alt, #2b2d31)",
                            border: "1px solid #4e5058",
                            borderBottom: "2px solid #111214",
                            borderRadius: 4,
                            minWidth: 22,
                            height: 22,
                            boxSizing: "border-box",
                            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.4)"
                        }}>
                            {key}
                        </kbd>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}

interface KeybindRecorderModalProps {
    sound: SoundboardSound;
    initialKeybind?: string;
    modalProps: RenderModalProps;
    onSave(keybind: string, sound: SoundboardSound): void;
    onRemove?(): void;
}

function KeybindRecorderModal({ sound, initialKeybind = "", modalProps, onSave, onRemove }: KeybindRecorderModalProps) {
    const [keybind, setKeybind] = useState(initialKeybind);
    const [isListening, setIsListening] = useState(false);
    const [modifiers, setModifiers] = useState<string[]>([]);

    const conflictingEntry = useMemo(() => {
        if (!keybind) return null;
        return getKeybinds().find(entry => entry.soundId !== sound.soundId && isSameKeybind(entry.keybind, keybind));
    }, [keybind, sound.soundId]);

    const guildName = useMemo(() => {
        return GuildStore.getGuild(sound.guildId)?.name ?? (sound.guildId === "0" ? "Discord Default" : `Server: ${sound.guildId}`);
    }, [sound.guildId]);

    useEffect(() => {
        if (!isListening) return;
        isRecordingKeybind = true;

        const handleKeyDown = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (event.key === "Escape") {
                setIsListening(false);
                setModifiers([]);
                return;
            }

            if (event.key === "Backspace" || event.key === "Delete") {
                setKeybind("");
                setIsListening(false);
                setModifiers([]);
                return;
            }

            const mods: string[] = [];
            if (event.ctrlKey) mods.push("Ctrl");
            if (event.shiftKey) mods.push("Shift");
            if (event.altKey) mods.push("Alt");
            if (event.metaKey) mods.push("Cmd");

            if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
                setModifiers(mods);
                return;
            }

            const formatted = formatEventToKeybind(event);
            if (formatted) {
                setKeybind(formatted);
                setIsListening(false);
                setModifiers([]);
            }
        };

        const handleBlur = () => {
            setIsListening(false);
            setModifiers([]);
        };

        window.addEventListener("keydown", handleKeyDown, true);
        window.addEventListener("blur", handleBlur);
        return () => {
            isRecordingKeybind = false;
            window.removeEventListener("keydown", handleKeyDown, true);
            window.removeEventListener("blur", handleBlur);
        };
    }, [isListening]);

    const actions: ModalAction[] = [
        {
            text: "Cancel",
            variant: "secondary",
            onClick: modalProps.onClose
        }
    ];

    if (initialKeybind && onRemove) {
        actions.push({
            text: "Remove Shortcut",
            variant: "critical-primary" as const,
            onClick: () => {
                onRemove();
                modalProps.onClose();
            }
        });
    }

    actions.push({
        text: "Save Shortcut",
        variant: "primary" as const,
        disabled: !keybind,
        onClick: () => {
            if (!keybind) return;
            onSave(keybind, sound);
            modalProps.onClose();
        }
    });

    return (
        <Modal
            {...modalProps}
            title="Set Keyboard Shortcut"
            subtitle="Configure a keyboard shortcut to play this soundboard sound."
            size="md"
            actions={actions}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    borderRadius: 8,
                    background: "var(--background-secondary)",
                    border: "1px solid var(--background-tertiary)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {sound.emojiName ? (
                            <span style={{ fontSize: 24 }}>{sound.emojiName}</span>
                        ) : (
                            <span style={{ fontSize: 20 }}>🔊</span>
                        )}
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--header-primary)" }}>
                                {sound.name || `Sound ${sound.soundId}`}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                {guildName}
                            </div>
                        </div>
                    </div>
                    <Button
                        size="small"
                        variant="secondary"
                        onClick={() => playSoundPreview(sound.soundId, sound.volume)}
                        title="Preview sound"
                    >
                        <PlayIcon /> Play
                    </Button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--header-secondary)" }}>
                        Keyboard Combination
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsListening(true)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: 56,
                            borderRadius: 8,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            border: isListening ? "2px solid var(--brand-500)" : "1px solid var(--background-tertiary)",
                            background: isListening ? "var(--brand-500-10, rgba(88, 101, 242, 0.15))" : "var(--background-secondary)",
                            color: "var(--text-normal)",
                            outline: "none"
                        }}
                    >
                        {isListening ? (
                            <span style={{ fontWeight: 600, color: "var(--brand-500)", fontSize: 14 }}>
                                {modifiers.length ? `${modifiers.join(" + ")} + ...` : "Press any key combination (Esc to cancel)..."}
                            </span>
                        ) : keybind ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                {keybind.split("+").map(k => k.trim()).map((k, i) => (
                                    <React.Fragment key={i}>
                                        {i > 0 && <span style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: 16 }}>+</span>}
                                        <kbd style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            padding: "4px 12px",
                                            fontSize: 16,
                                            fontWeight: 700,
                                            fontFamily: "Consolas, Monaco, monospace, sans-serif",
                                            color: "#ffffff",
                                            background: "var(--background-secondary-alt, #2b2d31)",
                                            border: "1px solid #4e5058",
                                            borderBottom: "3px solid #111214",
                                            borderRadius: 6,
                                            minWidth: 32,
                                            height: 36,
                                            boxSizing: "border-box",
                                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.4)"
                                        }}>
                                            {k}
                                        </kbd>
                                    </React.Fragment>
                                ))}
                            </div>
                        ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                                Click here and press keys to record
                            </span>
                        )}
                    </button>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Tips: Press combinations like <strong>Ctrl + Shift + 1</strong>, <strong>Alt + Q</strong>, or <strong>F8</strong>. Press <strong>Backspace</strong> to clear, <strong>Escape</strong> to cancel.
                    </div>
                </div>

                {conflictingEntry && (
                    <div style={{
                        padding: 10,
                        borderRadius: 6,
                        background: "rgba(250, 166, 26, 0.12)",
                        border: "1px solid #faa61a",
                        color: "var(--text-normal)",
                        fontSize: 13
                    }}>
                        ⚠️ <strong>Conflict warning:</strong> Shortcut <code>{keybind}</code> is already assigned to <strong>{conflictingEntry.name || conflictingEntry.soundId}</strong>. Saving will reassign it to this sound.
                    </div>
                )}
            </div>
        </Modal>
    );
}

function openSoundboardKeybindModal(props: Omit<KeybindRecorderModalProps, "modalProps">) {
    openModal(modalProps => <KeybindRecorderModal {...props} modalProps={modalProps} />);
}

function SoundPickerModal({ modalProps, onSelect }: { modalProps: RenderModalProps; onSelect(sound: SoundboardSound): void; }) {
    const [search, setSearch] = useState("");
    const allSounds = useStateFromStores([SoundboardStore], () =>
        Array.from(SoundboardStore.getSounds().values()).flat(), [], lodash.isEqual
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return allSounds;
        return allSounds.filter(s =>
            s.name?.toLowerCase().includes(q) ||
            s.soundId.includes(q) ||
            GuildStore.getGuild(s.guildId)?.name?.toLowerCase().includes(q)
        );
    }, [allSounds, search]);

    return (
        <Modal
            {...modalProps}
            title="Select a Soundboard Sound"
            subtitle="Choose a sound from your servers to configure a keyboard shortcut."
            size="md"
            actions={[
                {
                    text: "Close",
                    variant: "secondary",
                    onClick: modalProps.onClose
                }
            ]}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <TextInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search sounds by name or server..."
                    autoFocus
                />
                <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                            {allSounds.length === 0 ? "No soundboard sounds loaded yet. Try opening Discord's soundboard in a channel first." : "No sounds matching your search."}
                        </div>
                    ) : (
                        filtered.map(sound => {
                            const existing = getKeybinds().find(k => k.soundId === sound.soundId);
                            const guildName = GuildStore.getGuild(sound.guildId)?.name ?? (sound.guildId === "0" ? "Discord Default" : `Server: ${sound.guildId}`);
                            return (
                                <div
                                    key={`${sound.guildId}-${sound.soundId}`}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "8px 12px",
                                        borderRadius: 6,
                                        background: "var(--background-secondary)",
                                        gap: 8
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                                        {sound.emojiName ? <span style={{ fontSize: 20 }}>{sound.emojiName}</span> : <span>🔊</span>}
                                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                                            <div style={{ fontWeight: 600, color: "var(--header-primary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                                {sound.name}
                                            </div>
                                            <div style={{ fontSize: 12, color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                                {guildName}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {existing && (
                                            <KeybindDisplay keybind={existing.keybind} />
                                        )}
                                        <Button
                                            size="small"
                                            variant="secondary"
                                            onClick={() => playSoundPreview(sound.soundId, sound.volume)}
                                            title="Preview Sound"
                                        >
                                            <PlayIcon />
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="primary"
                                            onClick={() => {
                                                modalProps.onClose();
                                                onSelect(sound);
                                            }}
                                        >
                                            {existing ? "Edit" : "Select"}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Modal>
    );
}

function openSoundPickerModal(onSelect: (sound: SoundboardSound) => void) {
    openModal(modalProps => <SoundPickerModal modalProps={modalProps} onSelect={onSelect} />);
}

function SoundboardKeybindsInput() {
    const { keybinds } = settings.use(KEYBIND_SETTINGS);
    const currentUser = useStateFromStores([UserStore], () => UserStore.getCurrentUser());
    const currentUserId = currentUser?.id || "global";
    const rawValue = typeof keybinds === "string" ? keybinds : DEFAULT_KEYBINDS;
    const entries = getKeybinds(currentUserId, rawValue).filter(entry => Boolean(entry.soundId && entry.guildId != null && entry.soundId !== ""));

    const [currentTab, setCurrentTab] = useState<"configured" | "all">("configured");
    const [search, setSearch] = useState("");

    const allSounds = useStateFromStores([SoundboardStore], () =>
        Array.from(SoundboardStore.getSounds().values()).flat(), [], lodash.isEqual
    );

    const duplicateKeybinds = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const entry of entries) {
            const norm = normalizeKeybind(entry.keybind);
            counts[norm] = (counts[norm] ?? 0) + 1;
        }
        return Object.keys(counts).filter(k => counts[k] > 1);
    }, [entries]);

    const filteredConfiguredEntries = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter(e =>
            e.name?.toLowerCase().includes(q) ||
            e.keybind.toLowerCase().includes(q) ||
            e.soundId.includes(q) ||
            GuildStore.getGuild(e.guildId)?.name?.toLowerCase().includes(q)
        );
    }, [entries, search]);

    const filteredAllSounds = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return allSounds;
        return allSounds.filter(s => {
            const bound = entries.find(e => e.soundId === s.soundId);
            return (
                s.name?.toLowerCase().includes(q) ||
                s.soundId.includes(q) ||
                GuildStore.getGuild(s.guildId)?.name?.toLowerCase().includes(q) ||
                (bound && bound.keybind.toLowerCase().includes(q))
            );
        });
    }, [allSounds, search, entries]);

    function handleClearAll() {
        const all = getAllUserKeybinds();
        all[currentUserId] = [];
        settings.store.keybinds = JSON.stringify(all, null, 2);
        showToast("All soundboard shortcuts cleared for this account.", Toasts.Type.MESSAGE);
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: 6,
                background: "var(--background-secondary)",
                border: "1px solid var(--background-tertiary)",
                fontSize: 12,
                color: "var(--text-muted)"
            }}>
                <span>
                    Account: <strong style={{ color: "var(--header-primary)" }}>{currentUser?.globalName ? `${currentUser.globalName} (@${currentUser.username})` : (currentUser?.username ? `@${currentUser.username}` : currentUserId)}</strong>
                </span>
                <span style={{ fontSize: 11, fontStyle: "italic" }}>
                    Shortcuts isolated per account
                </span>
            </div>

            <div style={{
                display: "flex",
                gap: 8,
                borderBottom: "1px solid var(--background-modifier-accent)",
                paddingBottom: 8
            }}>
                <button
                    type="button"
                    onClick={() => setCurrentTab("configured")}
                    style={{
                        background: currentTab === "configured" ? "var(--brand-500)" : "var(--background-secondary)",
                        color: currentTab === "configured" ? "#fff" : "var(--text-normal)",
                        border: "none",
                        borderRadius: 6,
                        padding: "7px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                    }}
                >
                    Configured Shortcuts ({entries.length})
                </button>
                <button
                    type="button"
                    onClick={() => setCurrentTab("all")}
                    style={{
                        background: currentTab === "all" ? "var(--brand-500)" : "var(--background-secondary)",
                        color: currentTab === "all" ? "#fff" : "var(--text-normal)",
                        border: "none",
                        borderRadius: 6,
                        padding: "7px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                    }}
                >
                    All Soundboard Sounds ({allSounds.length})
                </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <TextInput
                        value={search}
                        onChange={setSearch}
                        placeholder={
                            currentTab === "configured"
                                ? "Search configured shortcuts, sounds, or servers..."
                                : "Search soundboard sounds or server names..."
                        }
                    />
                </div>
                {currentTab === "configured" && (
                    <Button
                        size="small"
                        variant="primary"
                        onClick={() => openSoundPickerModal(sound => {
                            const existing = entries.find(e => e.soundId === sound.soundId);
                            openSoundboardKeybindModal({
                                sound,
                                initialKeybind: existing?.keybind,
                                onSave: saveKeybind,
                                onRemove: () => removeKeybind(sound.soundId)
                            });
                        })}
                    >
                        + Add Shortcut
                    </Button>
                )}
                {currentTab === "configured" && entries.length > 0 && (
                    <Button
                        size="small"
                        variant="dangerSecondary"
                        onClick={handleClearAll}
                    >
                        Clear All
                    </Button>
                )}
            </div>

            {duplicateKeybinds.length > 0 && (
                <div style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "rgba(250, 166, 26, 0.12)",
                    border: "1px solid #faa61a",
                    fontSize: 13,
                    color: "var(--text-normal)"
                }}>
                    ⚠️ <strong>Duplicate shortcuts detected:</strong> Multiple sounds share the same key combination. Only the first matching sound will trigger when pressed.
                </div>
            )}

            {currentTab === "configured" && (
                <div>
                    {filteredConfiguredEntries.length === 0 ? (
                        <div style={{
                            padding: "24px 16px",
                            borderRadius: 8,
                            background: "var(--background-secondary)",
                            textAlign: "center",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 12
                        }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--header-primary)" }}>
                                {entries.length === 0 ? "No soundboard shortcuts configured yet" : "No shortcuts matching your search"}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 380 }}>
                                {entries.length === 0
                                    ? "You can switch to the \"All Soundboard Sounds\" tab to pick a sound, or right-click any sound in Discord's soundboard to set a shortcut."
                                    : "Try searching for different keywords or clear the search filter."}
                            </div>
                            {entries.length === 0 && (
                                <Button
                                    size="small"
                                    variant="primary"
                                    onClick={() => setCurrentTab("all")}
                                >
                                    Browse Soundboard Sounds
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {filteredConfiguredEntries.map(entry => {
                                const isDuplicate = duplicateKeybinds.includes(normalizeKeybind(entry.keybind));
                                const meta = resolveSoundMeta(entry.soundId, entry.guildId);
                                const displayName = entry.name || meta.name || `Sound ${entry.soundId}`;
                                const displayEmoji = entry.emojiName ?? meta.emojiName;
                                const guildName = GuildStore.getGuild(entry.guildId)?.name ?? (entry.guildId === "0" ? "Discord Default" : `Server: ${entry.guildId}`);

                                return (
                                    <div
                                        key={`${entry.soundId}-${entry.keybind}`}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "10px 14px",
                                            borderRadius: 8,
                                            background: "var(--background-secondary)",
                                            border: isDuplicate ? "1px solid #faa61a" : "1px solid var(--background-tertiary)",
                                            gap: 12
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                                            {displayEmoji ? (
                                                <span style={{ fontSize: 22, lineHeight: 1 }}>{displayEmoji}</span>
                                            ) : (
                                                <span style={{ fontSize: 18 }}>🔊</span>
                                            )}
                                            <div style={{ minWidth: 0, overflow: "hidden" }}>
                                                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-normal)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                                    {displayName}
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                                    Soundboard: {guildName}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            {isDuplicate && (
                                                <span style={{ fontSize: 11, color: "#faa61a", fontWeight: 600 }}>
                                                    Duplicate
                                                </span>
                                            )}
                                            <KeybindDisplay keybind={entry.keybind} />

                                            <Button
                                                size="small"
                                                variant="primary"
                                                onClick={() => openSoundboardKeybindModal({
                                                    sound: entry,
                                                    initialKeybind: entry.keybind,
                                                    onSave: saveKeybind,
                                                    onRemove: () => removeKeybind(entry.soundId)
                                                })}
                                                title="Modify shortcut"
                                            >
                                                Modify
                                            </Button>

                                            <Button
                                                size="small"
                                                variant="secondary"
                                                onClick={() => playSoundPreview(entry.soundId, entry.volume)}
                                                title="Preview sound"
                                            >
                                                <PlayIcon />
                                            </Button>

                                            <Button
                                                size="small"
                                                variant="dangerPrimary"
                                                onClick={() => removeKeybind(entry.soundId)}
                                                title="Remove shortcut"
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {currentTab === "all" && (
                <div>
                    {filteredAllSounds.length === 0 ? (
                        <div style={{
                            padding: "24px 16px",
                            borderRadius: 8,
                            background: "var(--background-secondary)",
                            textAlign: "center",
                            color: "var(--text-muted)",
                            fontSize: 14
                        }}>
                            {allSounds.length === 0
                                ? "No soundboard sounds loaded yet. Please make sure Discord is connected and soundboards are available."
                                : "No sounds matching your search."}
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {filteredAllSounds.map(sound => {
                                const bound = entries.find(e => e.soundId === sound.soundId);
                                const guildName = GuildStore.getGuild(sound.guildId)?.name ?? (sound.guildId === "0" ? "Discord Default" : `Server: ${sound.guildId}`);

                                return (
                                    <div
                                        key={sound.soundId}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "10px 14px",
                                            borderRadius: 8,
                                            background: bound ? "rgba(88, 101, 242, 0.08)" : "var(--background-secondary)",
                                            border: bound ? "1px solid var(--brand-500)" : "1px solid var(--background-tertiary)",
                                            gap: 12
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                                            {sound.emojiName ? (
                                                <span style={{ fontSize: 22, lineHeight: 1 }}>{sound.emojiName}</span>
                                            ) : (
                                                <span style={{ fontSize: 18 }}>🔊</span>
                                            )}
                                            <div style={{ minWidth: 0, overflow: "hidden" }}>
                                                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-normal)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                                    {sound.name}
                                                </div>
                                                <div style={{ fontSize: 12, color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                                    Soundboard: {guildName}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            {bound ? (
                                                <KeybindDisplay keybind={bound.keybind} />
                                            ) : (
                                                <span style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    padding: "3px 8px",
                                                    borderRadius: 4,
                                                    background: "rgba(255, 255, 255, 0.04)",
                                                    border: "1px dashed #4e5058",
                                                    fontSize: 12,
                                                    color: "var(--text-muted, #949ba4)",
                                                    fontStyle: "italic"
                                                }}>
                                                    No shortcut
                                                </span>
                                            )}

                                            <Button
                                                size="small"
                                                variant="primary"
                                                onClick={() => openSoundboardKeybindModal({
                                                    sound,
                                                    initialKeybind: bound?.keybind,
                                                    onSave: saveKeybind,
                                                    onRemove: bound ? () => removeKeybind(sound.soundId) : undefined
                                                })}
                                                title={bound ? "Modify shortcut" : "Set shortcut"}
                                            >
                                                {bound ? "Modify" : "+ Set Shortcut"}
                                            </Button>

                                            <Button
                                                size="small"
                                                variant="secondary"
                                                onClick={() => playSoundPreview(sound.soundId, sound.volume)}
                                                title="Preview sound"
                                            >
                                                <PlayIcon />
                                            </Button>

                                            {bound && (
                                                <Button
                                                    size="small"
                                                    variant="dangerPrimary"
                                                    onClick={() => removeKeybind(sound.soundId)}
                                                    title="Remove shortcut"
                                                >
                                                    Remove
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

const SoundContextMenu: NavContextMenuPatchCallback = (children, { sound }: { sound: SoundboardSound; }) => {
    if (!sound?.soundId) return;

    const meta = resolveSoundMeta(sound.soundId, sound.guildId);
    const enrichedSound: SoundboardSound = {
        soundId: sound.soundId,
        guildId: String(sound.guildId),
        name: sound.name || meta.name || `Sound ${sound.soundId}`,
        emojiName: sound.emojiName ?? meta.emojiName ?? null,
        emojiId: sound.emojiId ?? meta.emojiId ?? null,
        volume: sound.volume ?? meta.volume ?? 1
    };

    const existing = getKeybinds().find(k => k.soundId === sound.soundId);

    children.push(
        <Menu.MenuGroup>
            {existing ? (
                <>
                    <Menu.MenuItem
                        id="soundboard-keybind-edit"
                        label={`Shortcut: ${existing.keybind}`}
                        subtext="Click to change shortcut"
                        action={() => openSoundboardKeybindModal({
                            sound: enrichedSound,
                            initialKeybind: existing.keybind,
                            onSave: saveKeybind,
                            onRemove: () => removeKeybind(sound.soundId)
                        })}
                    />
                    <Menu.MenuItem
                        id="soundboard-keybind-remove"
                        label="Remove keyboard shortcut"
                        color="danger"
                        action={() => removeKeybind(sound.soundId)}
                    />
                </>
            ) : (
                <Menu.MenuItem
                    id="soundboard-keybind-set"
                    label="Set keyboard shortcut"
                    action={() => openSoundboardKeybindModal({
                        sound: enrichedSound,
                        onSave: saveKeybind
                    })}
                />
            )}
        </Menu.MenuGroup>
    );
};

export default definePlugin({
    name: "SoundboardKeybinds",
    description: "Play soundboard sounds with configurable keyboard shortcuts.",
    authors: [EquicordDevs.Kurt],
    tags: ["Fun", "Voice"],
    dependencies: ["AudioPlayerAPI", "UserSettingsAPI"],
    settings,
    contextMenus: { "sound-button-context": SoundContextMenu },
    start() {
        window.addEventListener("keydown", onKeyDown, true);
    },
    stop() {
        window.removeEventListener("keydown", onKeyDown, true);
    }
});

async function onKeyDown(event: KeyboardEvent) {
    if (isRecordingKeybind || event.repeat || event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]")) return;

    const binding = getKeybinds().find(entry => entry.soundId && entry.guildId != null && matchesKeybind(event, entry.keybind));
    if (!binding) return;

    const channelId = SelectedChannelStore.getVoiceChannelId();
    if (!channelId) return;

    event.preventDefault();

    const rawSound = SoundboardStore.getSound?.(binding.guildId, binding.soundId)
        ?? SoundboardStore.getSoundById?.(binding.soundId);

    const sound = {
        soundId: binding.soundId,
        guildId: String(binding.guildId),
        volume: typeof rawSound?.volume === "number" ? rawSound.volume : (binding.volume ?? 1),
        name: binding.name ?? rawSound?.name,
        emojiId: binding.emojiId ?? rawSound?.emojiId,
        emojiName: binding.emojiName ?? rawSound?.emojiName
    };

    try {
        FluxDispatcher.dispatch({
            type: "GUILD_SOUNDBOARD_SOUND_PLAY_LOCALLY",
            sound,
            channelId
        });

        const body: Record<string, string> = {
            sound_id: binding.soundId
        };
        if (String(binding.guildId) !== "0") {
            body.source_guild_id = String(binding.guildId);
        }
        if (sound.emojiId) {
            body.emoji_id = sound.emojiId;
        }
        if (sound.emojiName) {
            body.emoji_name = sound.emojiName;
        }

        await RestAPI.post({
            url: Constants.Endpoints.SEND_SOUNDBOARD_SOUND(channelId),
            body
        });
    } catch {
        showToast("Could not play the soundboard sound in channel.", Toasts.Type.FAILURE);
    }
}
