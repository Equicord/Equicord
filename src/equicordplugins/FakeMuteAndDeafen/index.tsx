/*
 * Equicord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { React } from "@webpack/common";

const MediaEngineActions = findByPropsLazy("toggleSelfMute");
const NotificationSettingsStore = findByPropsLazy("getDisableAllSounds", "getState");

const fakeVoiceState = {
    _selfMute: false,
    get selfMute() { return this.selfDeaf || this._selfMute; },
    set selfMute(v: boolean) { this._selfMute = v; },
    selfDeaf: false,
};

let updating = false;
async function triggerVoiceUpdate() {
    if (updating) return setTimeout(triggerVoiceUpdate, 125);
    updating = true;
    const state = NotificationSettingsStore.getState();
    const toDisable: string[] = [];
    if (!state.disabledSounds.includes("mute")) toDisable.push("mute");
    if (!state.disabledSounds.includes("unmute")) toDisable.push("unmute");
    state.disabledSounds.push(...toDisable);
    await new Promise(r => setTimeout(r, 50));
    await MediaEngineActions.toggleSelfMute();
    await new Promise(r => setTimeout(r, 100));
    await MediaEngineActions.toggleSelfMute();
    state.disabledSounds = state.disabledSounds.filter((i: string) => !toDisable.includes(i));
    updating = false;
}

export const settings = definePluginSettings({
    autoMute: {
        type: OptionType.BOOLEAN,
        description: "Automatically mute when Fake Deaf is enabled.",
        default: true,
    },
});

function MuteIcon({ active, className }: { active: boolean; className?: string; }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            {active && <line x1="3" y1="3" x2="21" y2="21" stroke="var(--status-danger)" strokeWidth="2.5" strokeLinecap="round" />}
        </svg>
    );
}

function DeafIcon({ active, className }: { active: boolean; className?: string; }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h1v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-2v8h1c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z" />
            {active && <line x1="3" y1="3" x2="21" y2="21" stroke="var(--status-danger)" strokeWidth="2.5" strokeLinecap="round" />}
        </svg>
    );
}

function FakeButtons({ iconForeground }: UserAreaRenderProps) {
    const [muted, setMuted] = React.useState(fakeVoiceState._selfMute);
    const [deafened, setDeafened] = React.useState(fakeVoiceState.selfDeaf);

    const toggleMute = () => {
        const next = !fakeVoiceState._selfMute;
        fakeVoiceState.selfMute = next;
        if (!next) fakeVoiceState.selfDeaf = false;
        setMuted(next);
        setDeafened(fakeVoiceState.selfDeaf);
        triggerVoiceUpdate();
    };

    const toggleDeaf = () => {
        const next = !fakeVoiceState.selfDeaf;
        fakeVoiceState.selfDeaf = next;
        if (next && settings.store.autoMute) fakeVoiceState.selfMute = true;
        setDeafened(next);
        setMuted(fakeVoiceState._selfMute);
        triggerVoiceUpdate();
    };

    return (
        <>
            <UserAreaButton
                tooltipText="Fake Mute"
                icon={<MuteIcon active={muted} className={iconForeground} />}
                role="switch"
                aria-checked={muted}
                redGlow={muted}
                onClick={toggleMute}
            />
            <UserAreaButton
                tooltipText="Fake Deaf"
                icon={<DeafIcon active={deafened} className={iconForeground} />}
                role="switch"
                aria-checked={deafened}
                redGlow={deafened}
                onClick={toggleDeaf}
            />
        </>
    );
}

export default definePlugin({
    name: "FakeMuteAndDeafen",
    description: "Aparece mutado/ensurdecido para os outros mas vocÃª ouve e fala normalmente.",
    authors: [EquicordDevs.luka],
    settings,
    dependencies: ["UserAreaAPI"],

    userAreaButton: {
        icon: MuteIcon,
        render: FakeButtons,
    },

    patches: [
        {
            find: "voiceServerPing(){",
            replacement: {
                match: /voiceStateUpdate\((\w+)\){(.{0,10})guildId:/,
                replace: "voiceStateUpdate($1){$1=$self.modifyVoiceState($1);$2guildId:",
            },
        },
    ],

    modifyVoiceState(e: any) {
        e.selfMute = fakeVoiceState.selfMute || e.selfMute;
        e.selfDeaf = fakeVoiceState.selfDeaf || e.selfDeaf;
        return e;
    },
});

