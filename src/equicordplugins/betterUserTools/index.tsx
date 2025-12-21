/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { addUserAreaButton, removeUserAreaButton, UserAreaButton, UserAreaButtonFactory, UserAreaRenderProps } from "@api/UserArea";
import { getUserSettingLazy } from "@api/UserSettings";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, MediaEngineStore, React, showToast, Toasts, UserStore, VoiceActions, VoiceStateStore } from "@webpack/common";

type LoopbackActions = {
    setLoopback(tag: string, enabled: boolean): unknown;
    toggleSelfDeaf(): unknown;
};

const ShowCurrentGame = getUserSettingLazy<boolean>("status", "showCurrentGame")!;
const StatusSetting = getUserSettingLazy<string>("status", "status")!;

const settings = definePluginSettings({
    micLoopbackButton: {
        description: "Show Mic Test Loopback button",
        type: OptionType.BOOLEAN,
        default: true
    },
    offTheRadarButton: {
        description: "Show Off The Radar button",
        type: OptionType.BOOLEAN,
        default: true
    }
});

const log = new Logger("BetterUserTools");

const MIC_BUTTON_ID = "BetterUserTools:MicLoopback";
const OTR_BUTTON_ID = "BetterUserTools:OffTheRadar";

let loopbackActive = false;
let selfDeafenedByPlugin = false;
let missingModuleNotified = false;

const OTR_DATA_KEY = "BetterUserTools_OffTheRadar_State";
interface OffTheRadarState {
    enabled: boolean;
    prevStatus?: string;
    prevShowCurrentGame?: boolean;
}
let otrState: OffTheRadarState = { enabled: false };

function notifyMic(msg: string, type: string) {
    showToast(msg, type);
}

function getVoiceActions(): LoopbackActions | null {
    try {
        const actions = VoiceActions;
        if (!actions?.setLoopback || !actions?.toggleSelfDeaf) {
            if (!missingModuleNotified) {
                missingModuleNotified = true;
                notifyMic("Mic test controls unavailable (missing VoiceActions module)", Toasts.Type.FAILURE);
            }
            return null;
        }
        return actions;
    } catch (err) {
        if (!missingModuleNotified) {
            missingModuleNotified = true;
            notifyMic("Mic test controls unavailable (see console)", Toasts.Type.FAILURE);
        }
        log.error("Failed to resolve VoiceActions module", err);
        return null;
    }
}

function isInVoiceChannel() {
    const id = UserStore.getCurrentUser()?.id;
    if (!id) return false;
    const state = VoiceStateStore.getVoiceStateForUser(id);
    return Boolean(state?.channelId);
}

async function enableLoopback() {
    const actions = getVoiceActions();
    if (!actions) return false;

    try {
        await actions.setLoopback("mic_test", true);
        loopbackActive = true;

        if (isInVoiceChannel() && !MediaEngineStore.isSelfDeaf()) {
            await actions.toggleSelfDeaf();
            selfDeafenedByPlugin = true;
        } else {
            selfDeafenedByPlugin = false;
        }

        notifyMic("Mic test loopback enabled", Toasts.Type.SUCCESS);
        return true;
    } catch (err) {
        log.error("Failed to enable mic test loopback", err);
        notifyMic("Failed to start mic test loopback (see console)", Toasts.Type.FAILURE);
        return false;
    }
}

async function disableLoopback(silent = false) {
    const actions = getVoiceActions();
    if (!actions) {
        loopbackActive = false;
        selfDeafenedByPlugin = false;
        return;
    }

    try {
        await actions.setLoopback("mic_test", false);
        loopbackActive = false;

        if (selfDeafenedByPlugin && MediaEngineStore.isSelfDeaf()) {
            await actions.toggleSelfDeaf();
        }
        selfDeafenedByPlugin = false;

        if (!silent) notifyMic("Mic test loopback disabled", Toasts.Type.SUCCESS);
    } catch (err) {
        log.error("Failed to disable mic test loopback", err);
        if (!silent) notifyMic("Failed to stop mic test loopback (see console)", Toasts.Type.FAILURE);
    }
}

function MicLoopbackIcon({ active = false, className = "" }: { active: boolean; className?: string; }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect
                x="9"
                y="4"
                width="6"
                height="10"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.6"
            />
            <path
                d="M7 10a5 5 0 0 0 10 0"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
            <path
                d="M12 15v4m-3 1h6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
            />
            <path
                d="M6 7c-1.333 1.333-1.333 4.667 0 6m12-6c1.333 1.333 1.333 4.667 0 6"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeDasharray="2 2"
            />
            {active && (
                <path
                    d="M4 20 20 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                />
            )}
        </svg>
    );
}

function MicLoopbackButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const { micLoopbackButton } = settings.use(["micLoopbackButton"]);
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    if (!micLoopbackButton) return null;

    const handleToggle = React.useCallback(async () => {
        if (loopbackActive) {
            await disableLoopback();
        } else {
            await enableLoopback();
        }
        forceUpdate();
    }, []);

    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : "Mic Test Loopback"}
            icon={<MicLoopbackIcon active={loopbackActive} className={iconForeground} />}
            role="switch"
            aria-checked=!loopbackActive}
            redGlow={loopbackActive}
            plated={nameplate != null}
            onClick={handleToggle}
        />
    );
}

function RadarIcon({ active, className }: { active: boolean; className?: string; }) {
    return (
        <svg
            className={className}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M11.291 11.295a1 1 0 0 0 .709 1.705v8c2.488 0 4.74 -1.01 6.37 -2.642m1.675 -2.319a8.962 8.962 0 0 0 .955 -4.039h-5" />
            <path d="M16 9a5 5 0 0 0 -5.063 -1.88m-2.466 1.347a5 5 0 0 0 .53 7.535" />
            <path d="M20.486 9a9 9 0 0 0 -12.525 -5.032m-2.317 1.675a9 9 0 0 0 3.36 14.852" />
            {active && <path d="M3 3l18 18" />}
        </svg>
    );
}

async function loadOtrState() {
    otrState = await DataStore.get<OffTheRadarState>(OTR_DATA_KEY) || { enabled: false };
}

function persistOtrState() {
    return DataStore.set(OTR_DATA_KEY, otrState);
}

async function applyOtrEnable() {
    if (!ShowCurrentGame || !StatusSetting) return;
    const currentStatus = StatusSetting.getSetting?.();
    const currentShow = ShowCurrentGame.getSetting?.();

    if (otrState.prevStatus === undefined) otrState.prevStatus = currentStatus;
    if (otrState.prevShowCurrentGame === undefined) otrState.prevShowCurrentGame = currentShow;

    await ShowCurrentGame.updateSetting(false);
    await StatusSetting.updateSetting("idle");
    FluxDispatcher.dispatch({ type: "IDLE", idle: true });
    otrState.enabled = true;
    await persistOtrState();
}

async function applyOtrDisable() {
    if (!ShowCurrentGame || !StatusSetting) return;
    await ShowCurrentGame.updateSetting(otrState.prevShowCurrentGame ?? true);
    if (otrState.prevStatus) await StatusSetting.updateSetting(otrState.prevStatus);
    if (otrState.prevStatus !== "idle") {
        FluxDispatcher.dispatch({ type: "IDLE", idle: false });
    }
    otrState.enabled = false;
    await persistOtrState();
}

function OffTheRadarButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const { offTheRadarButton } = settings.use(["offTheRadarButton"]);
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    if (!offTheRadarButton) return null;

    const toggle = async () => {
        try {
            if (otrState.enabled) {
                await applyOtrDisable();
            } else {
                await applyOtrEnable();
            }
            forceUpdate();
        } catch (err) {
            log.error("OffTheRadar toggle failed", err);
            Toasts.show({
                message: "OffTheRadar toggle failed",
                id: Toasts.genId(),
                type: Toasts.Type.FAILURE
            });
        }
    };

    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : (otrState.enabled ? "Off The Radar (on)" : "Off The Radar (off)")}
            icon={<RadarIcon active={otrState.enabled} className={iconForeground} />}
            role="switch"
            aria-checked={otrState.enabled}
            redGlow={otrState.enabled}
            plated={nameplate != null}
            onClick={toggle}
        />
    );
}

const MicLoopbackUserAreaButton: UserAreaButtonFactory = props => <MicLoopbackButton {...props} />;
const OffTheRadarUserAreaButton: UserAreaButtonFactory = props => <OffTheRadarButton {...props} />;

export default definePlugin({
    name: "BetterUserTools",
    description: "Adds mic test shortcut button and off-the-radar button to the user panel, both are toggles. MicTest Simply lets you test your mic without entering the settings page. OffTheRadar Enables idle status and hides activity while enabled.",
    authors: [EquicordDevs.benjii],
    dependencies: ["UserSettingsAPI", "UserAreaAPI"],
    settings,

    async start() {
        await loadOtrState();
        if (otrState.enabled) await applyOtrEnable();
        addUserAreaButton(MIC_BUTTON_ID, MicLoopbackUserAreaButton);
        addUserAreaButton(OTR_BUTTON_ID, OffTheRadarUserAreaButton);
    },

    stop() {
        removeUserAreaButton(MIC_BUTTON_ID);
        removeUserAreaButton(OTR_BUTTON_ID);

        void disableLoopback(true);
        loopbackActive = false;
        selfDeafenedByPlugin = false;
        missingModuleNotified = false;

        if (otrState.enabled) void applyOtrDisable();
    },
});
