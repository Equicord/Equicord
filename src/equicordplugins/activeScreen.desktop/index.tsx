/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { UserAreaButton, UserAreaButtonFactory, UserAreaRenderProps } from "@api/UserArea";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { findByCodeLazy } from "@webpack";
import {
    ApplicationStreamingSettingsStore,
    ApplicationStreamingStore,
    showToast,
    useEffect,
    useState
} from "@webpack/common";

const logger = new Logger("ActiveScreen");
const startStream = findByCodeLazy('type:"STREAM_START"');
const MIN_SWAP_COOLDOWN = 800;

function KeybindRecorderSetting() {
    const { shortcut } = settings.use(["shortcut"]);
    const [recording, setRecording] = useState(false);

    useEffect(() => {
        if (!recording) return;

        const onKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

            if (e.key === "Escape") {
                setRecording(false);
                return;
            }

            const parts: string[] = [];
            if (e.ctrlKey || e.metaKey) parts.push("CTRL");
            if (e.shiftKey) parts.push("SHIFT");
            if (e.altKey) parts.push("ALT");

            let key = e.key.toUpperCase();
            if (key === " ") key = "SPACE";

            parts.push(key);
            settings.store.shortcut = parts.join("+");
            setRecording(false);
        };

        const onBlur = () => setRecording(false);

        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("blur", onBlur);
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("blur", onBlur);
        };
    }, [recording]);

    return (
        <Flex gap="8px" alignItems="center">
            <Button
                size="small"
                variant={recording ? "positive" : "secondary"}
                onClick={() => setRecording(!recording)}
            >
                {recording ? "Recording... (Esc to cancel)" : shortcut}
            </Button>
            <Button
                size="small"
                variant="dangerSecondary"
                onClick={() => {
                    settings.store.shortcut = settings.def.shortcut.default ?? "CTRL+SHIFT+S";
                    setRecording(false);
                }}
            >
                Reset
            </Button>
        </Flex>
    );
}

const settings = definePluginSettings({
    autoSwitch: {
        type: OptionType.BOOLEAN,
        description: "Automatically switch screens based on cursor position.",
        default: true
    },
    invertScreens: {
        type: OptionType.BOOLEAN,
        description: "Invert screen mapping (swap which screen is selected).",
        default: false
    },
    showButton: {
        type: OptionType.BOOLEAN,
        description: "Show a toggle button next to mute/deafen in the user panel.",
        default: true
    },
    showToast: {
        type: OptionType.BOOLEAN,
        description: "Show a toast notification when toggled or switched.",
        default: true
    },
    delay: {
        type: OptionType.SLIDER,
        description: "Dwell time before switching screens in milliseconds.",
        markers: [250, 500, 750, 1000, 1500, 2000, 3000],
        default: 500,
        stickToMarkers: false
    },
    onlyWhenStreamingScreen: {
        type: OptionType.BOOLEAN,
        description: "Only switch when sharing a full screen rather than a specific window.",
        default: true
    },
    shortcut: {
        type: OptionType.STRING,
        description: "Shortcut to toggle Active Screen.",
        default: "CTRL+SHIFT+S",
        hidden: true
    },
    shortcutRecorder: {
        type: OptionType.COMPONENT,
        description: "Shortcut to toggle Active Screen. Click to record a key combination.",
        component: KeybindRecorderSetting
    }
});

let pollInterval: number | undefined;
let currentTargetSourceId: string | null = null;
let pendingSourceId: string | null = null;
let dwellStartTime = 0;
let lastSwapTime = 0;
let isTicking = false;

const Native = VencordNative.pluginHelpers.ActiveScreen as PluginNative<
    typeof import("./native")
>;

function resetState() {
    currentTargetSourceId = null;
    pendingSourceId = null;
    dwellStartTime = 0;
}

function toggle() {
    const next = !settings.plain.autoSwitch;
    settings.store.autoSwitch = next;
    if (!next) resetState();

    if (settings.plain.showToast) {
        showToast({
            text: next ? "Active Screen resumed" : "Active Screen paused",
            variant: next ? "success" : "critical",
            duration: 1500
        });
    }
}

function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
    if (!shortcut) return false;
    const parts = shortcut.toUpperCase().split("+").map(p => p.trim());
    const needCtrl = parts.includes("CTRL");
    const needShift = parts.includes("SHIFT");
    const needAlt = parts.includes("ALT");
    const mainKey = parts[parts.length - 1];

    if ((e.ctrlKey || e.metaKey) !== needCtrl || e.shiftKey !== needShift || e.altKey !== needAlt) {
        return false;
    }

    const key = e.key.toUpperCase();
    const code = e.code.toUpperCase();
    return key === mainKey || code === mainKey || (mainKey === "SPACE" && key === " ") || (mainKey === "ESC" && key === "ESCAPE");
}

function handleKeydown(e: KeyboardEvent) {
    if (e.repeat) return;
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

    if (matchesShortcut(e, settings.plain.shortcut)) {
        e.preventDefault();
        toggle();
    }
}

async function tick() {
    if (!settings.plain.autoSwitch || isTicking) return;
    isTicking = true;

    try {
        const stream = ApplicationStreamingStore?.getCurrentUserActiveStream?.();
        if (!stream) {
            if (Date.now() - lastSwapTime > 2500) {
                resetState();
            }
            return;
        }

        const streamerMeta = ApplicationStreamingStore?.getStreamerActiveStreamMetadata?.();
        const currentSourceId = streamerMeta?.sourceId ?? streamerMeta?.id;
        const isScreenShare = Boolean(currentSourceId && currentSourceId.startsWith("screen:"));
        const isWindowShare = (streamerMeta?.pid != null && streamerMeta?.pid !== 0) || (Boolean(currentSourceId) && !isScreenShare);

        if (settings.plain.onlyWhenStreamingScreen && isWindowShare) {
            resetState();
            return;
        }

        const active = await Native?.getActiveScreenSource?.(settings.plain.invertScreens);
        if (!active?.sourceId) return;

        if (!currentTargetSourceId) {
            currentTargetSourceId = (isScreenShare && currentSourceId) ? currentSourceId : active.sourceId;
        }

        if (active.sourceId === currentTargetSourceId) {
            pendingSourceId = null;
            dwellStartTime = 0;
            return;
        }

        const now = Date.now();
        if (pendingSourceId !== active.sourceId) {
            pendingSourceId = active.sourceId;
            dwellStartTime = now;
            return;
        }

        const delay = settings.plain.delay ?? 500;
        if (now - dwellStartTime < delay) return;
        if (now - lastSwapTime < MIN_SWAP_COOLDOWN) return;

        lastSwapTime = now;
        currentTargetSourceId = active.sourceId;
        pendingSourceId = null;
        dwellStartTime = 0;

        switchSource(active.sourceId, active.sourceName);
    } catch (e) {
        logger.error("Error in tick:", e);
    } finally {
        isTicking = false;
    }
}

function switchSource(sourceId: string, sourceName: string) {
    try {
        if (typeof startStream !== "function") {
            logger.error("startStream is not available");
            return;
        }

        const stream = ApplicationStreamingStore?.getCurrentUserActiveStream?.();
        if (!stream) return;

        const streamerMeta = ApplicationStreamingStore?.getStreamerActiveStreamMetadata?.();
        const state = ApplicationStreamingSettingsStore?.getState?.() ?? {};
        const sound = state.soundshareEnabled ?? true;
        const previewDisabled = streamerMeta?.previewDisabled ?? false;

        logger.info(`Switching stream to ${sourceName} (${sourceId})`);

        startStream(stream.guildId ?? null, stream.channelId, {
            pid: null,
            sourceId,
            sourceName,
            audioSourceId: null,
            sound,
            previewDisabled
        });

        if (settings.plain.showToast) {
            showToast({
                text: `Switched stream to ${sourceName}`,
                variant: "success",
                duration: 1200
            });
        }
    } catch (e) {
        logger.error("Error switching stream:", e);
    }
}

function startPolling() {
    if (pollInterval !== undefined) return;
    pollInterval = window.setInterval(tick, 200);
}

function stopPolling() {
    if (pollInterval !== undefined) {
        clearInterval(pollInterval);
        pollInterval = undefined;
    }
    resetState();
    isTicking = false;
}

function ActiveScreenIcon({ enabled = true, className }: { enabled?: boolean; className?: string; }) {
    return (
        <svg
            className={className}
            width="20"
            height="20"
            viewBox="0 0 24 24"
        >
            <path
                fill={!enabled ? "var(--status-danger)" : "currentColor"}
                mask={!enabled ? "url(#activescreenmask)" : void 0}
                d="M2 4.5C2 3.397 2.897 2.5 4 2.5H20C21.103 2.5 22 3.397 22 4.5V15.5C22 16.604 21.103 17.5 20 17.5H13V19.5H17V21.5H7V19.5H11V17.5H4C2.897 17.5 2 16.604 2 15.5V4.5ZM13.2 14.3375V11.6C9.864 11.6 7.668 12.6625 6 15C6.672 11.6625 8.532 8.3375 13.2 7.6625V5L18 9.6625L13.2 14.3375Z"
            />
            {!enabled && (
                <>
                    <path fill="var(--status-danger)" d="M22.7 2.7a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4Z" />
                    <mask id="activescreenmask">
                        <rect fill="white" x="0" y="0" width="24" height="24" />
                        <path fill="black" d="M23.27 4.73 19.27 .73 -.27 20.27 3.73 24.27Z" />
                    </mask>
                </>
            )}
        </svg>
    );
}

function ActiveScreenButton(props: UserAreaRenderProps) {
    const { showButton, autoSwitch } = settings.use(["showButton", "autoSwitch"]);
    if (!showButton) return null;

    return (
        <UserAreaButton
            tooltipText={props.hideTooltips ? void 0 : autoSwitch ? "Pause Active Screen" : "Resume Active Screen"}
            icon={<ActiveScreenIcon enabled={autoSwitch} className={props.iconForeground} />}
            role="switch"
            aria-checked={autoSwitch}
            redGlow={!autoSwitch}
            plated={props.nameplate != null}
            onClick={toggle}
        />
    );
}

const ActiveScreenUserAreaButton: UserAreaButtonFactory = props => <ActiveScreenButton {...props} />;

export default definePlugin({
    name: "ActiveScreen",
    description: "Automatically switches your screen share to the monitor containing your cursor.",
    tags: ["Media", "Voice", "Utility"],
    authors: [EquicordDevs.l1uka1],
    dependencies: ["UserAreaAPI"],
    settings,

    userAreaButton: {
        icon: ActiveScreenIcon,
        render: ActiveScreenUserAreaButton
    },

    start() {
        window.addEventListener("keydown", handleKeydown);
        startPolling();
    },

    stop() {
        window.removeEventListener("keydown", handleKeydown);
        stopPolling();
    },

    flux: {
        STREAM_CREATE: resetState,
        VOICE_CHANNEL_SELECT({ channelId }: { channelId: string | null; }) {
            if (!channelId) resetState();
        }
    }
});
