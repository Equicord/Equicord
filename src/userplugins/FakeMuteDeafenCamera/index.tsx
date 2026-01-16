/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { UserAreaButton } from "@api/UserArea";
import { Devs, TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Menu, React } from "@webpack/common";

// --- Logic & Stores ---
const MediaEngineActions = findByPropsLazy("toggleSelfMute");
const NotificationSettingsStore = findByPropsLazy("getDisableAllSounds", "getState");

// --- Settings ---
export const settings = definePluginSettings({
    buttonControlsMute: {
        type: OptionType.BOOLEAN,
        description: "Button toggles Fake Mute",
        default: true,
        restartNeeded: false,
    },
    buttonControlsDeaf: {
        type: OptionType.BOOLEAN,
        description: "Button toggles Fake Deafen",
        default: true,
        restartNeeded: false,
    },
    buttonControlsVideo: {
        type: OptionType.BOOLEAN,
        description: "Button toggles Fake Video",
        default: true,
        restartNeeded: false,
    }
});

// --- Internal State ---
const activeState = {
    mute: false,
    deaf: false,
    video: false
};

const listeners = new Set<() => void>();
function emitChange() {
    listeners.forEach(l => l());
    triggerDiscordUpdate();
}

const fakeVoiceState = {
    get selfMute() { return activeState.mute; },
    set selfMute(v) { activeState.mute = v; emitChange(); },

    get selfDeaf() { return activeState.deaf; },
    set selfDeaf(v) { activeState.deaf = v; emitChange(); },

    get selfVideo() { return activeState.video; },
    set selfVideo(v) { activeState.video = v; emitChange(); }
};

let updating = false;
async function triggerDiscordUpdate() {
    if (updating) return setTimeout(triggerDiscordUpdate, 125);
    updating = true;
    
    // Suppress bloop sounds
    const state = NotificationSettingsStore.getState();
    const toDisable: string[] = [];
    if (!state.disabledSounds.includes("mute")) toDisable.push("mute");
    if (!state.disabledSounds.includes("unmute")) toDisable.push("unmute");

    state.disabledSounds.push(...toDisable);
    
    // Force Voice Update
    await new Promise(r => setTimeout(r, 50));
    await MediaEngineActions.toggleSelfMute();
    await new Promise(r => setTimeout(r, 100));
    await MediaEngineActions.toggleSelfMute();
    
    state.disabledSounds = state.disabledSounds.filter((i: string) => !toDisable.includes(i));
    updating = false;
}

// --- Components ---

function FakeDeafenIcon({ enabled }: { enabled: boolean }) {
    return (
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <rect x="6" y="8" width="20" height="4" rx="2" fill={enabled ? "#fff" : "#888"} />
            <rect x="11" y="3" width="10" height="8" rx="3" fill={enabled ? "#fff" : "#888"} />
            <circle cx="10" cy="21" r="4" stroke={enabled ? "#fff" : "#888"} strokeWidth="2" fill="none" />
            <circle cx="22" cy="21" r="4" stroke={enabled ? "#fff" : "#888"} strokeWidth="2" fill="none" />
            <path d="M14 21c1 1 3 1 4 0" stroke={enabled ? "#fff" : "#888"} strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function FakeActionsButton() {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const { buttonControlsMute, buttonControlsDeaf, buttonControlsVideo } = settings.use(["buttonControlsMute", "buttonControlsDeaf", "buttonControlsVideo"]);

    React.useEffect(() => {
        const listener = () => forceUpdate();
        listeners.add(listener);
        return () => void listeners.delete(listener);
    }, []);

    const isAnyActive = 
        (buttonControlsMute && activeState.mute) || 
        (buttonControlsDeaf && activeState.deaf) || 
        (buttonControlsVideo && activeState.video);

    const handleToggle = () => {
        const targets = [];
        if (buttonControlsMute) targets.push("mute");
        if (buttonControlsDeaf) targets.push("deaf");
        if (buttonControlsVideo) targets.push("video");

        if (targets.length === 0) return;

        // @ts-ignore
        const allTargetsOn = targets.every(t => activeState[t] === true);
        const newState = !allTargetsOn;

        // @ts-ignore
        targets.forEach(t => activeState[t] = newState);
        
        emitChange();
    };

    return (
        <UserAreaButton
            label="Fake Actions"
            tooltipText={isAnyActive ? "Disable Active Fake Actions" : "Enable Configured Fake Actions"}
            icon={<FakeDeafenIcon enabled={isAnyActive} />}
            onClick={handleToggle}
        />
    );
}

// --- Plugin Definition ---

const StateKeys = ["selfDeaf", "selfMute", "selfVideo"];

export default definePlugin({
    // KEEP THIS SAFE (No spaces/commas)
    name: "FakeMuteDeafenCamera",
    // Put the fancy text here
    description: "Fake mute, deafen & Camera. Configure button behavior in Settings. Contributed by Chaython.",
    authors: [TestcordDevs.x2b],
    settings,
    
    modifyVoiceState(e: any) {
        for (const stateKey of StateKeys) {
            // @ts-ignore
            e[stateKey] = fakeVoiceState[stateKey] || e[stateKey];
        }
        return e;
    },

    contextMenus: {
        "audio-device-context"(children, d) {
            if (d.renderInputDevices) {
                children.push(
                    <Menu.MenuSeparator />,
                    <Menu.MenuCheckboxItem
                        id="fake-mute"
                        label="Fake Mute"
                        checked={activeState.mute}
                        action={() => fakeVoiceState.selfMute = !fakeVoiceState.selfMute}
                    />
                );
            }

            if (d.renderOutputDevices) {
                children.push(
                    <Menu.MenuSeparator />,
                    <Menu.MenuCheckboxItem
                        id="fake-deafen"
                        label="Fake Deafen"
                        checked={activeState.deaf}
                        action={() => fakeVoiceState.selfDeaf = !fakeVoiceState.selfDeaf}
                    />
                );
            }
        },
        "video-device-context"(children) {
            children.push(
                <Menu.MenuSeparator />,
                <Menu.MenuCheckboxItem
                    id="fake-video"
                    label="Fake Camera"
                    checked={activeState.video}
                    action={() => fakeVoiceState.selfVideo = !fakeVoiceState.selfVideo}
                />
            );
        }
    },

    start() {
        Vencord.Api.UserArea.addUserAreaButton("fake-deafen-btn", () => <FakeActionsButton />);
    },

    stop() {
        Vencord.Api.UserArea.removeUserAreaButton("fake-deafen-btn");
    },

    patches: [
        {
            find: "voiceServerPing(){",
            replacement: [
                {
                    match: /voiceStateUpdate\((\w+)\){(.{0,10})guildId:/,
                    replace: "voiceStateUpdate($1){$1=$self.modifyVoiceState($1);$2guildId:"
                }
            ]
        }
    ],
});