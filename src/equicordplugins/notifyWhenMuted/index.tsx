/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { Devs } from "@utils/constants";
import { React } from "@webpack/common";

import { ToggleButton } from "./components/ToggleButton";
import { settings } from "./settings";
import { MediaEngineStore } from "./stores";

let isPlaying = false;
let audio: HTMLAudioElement | undefined;
const defaultAudioUrl = "https://raw.githubusercontent.com/nicola02nb/notifyWhenMuted/c34a9d63bdd5fb119691aebb78be868a2f2d19aa/stop_talking.wav";
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export default definePlugin({
    name: "NotifyWhenMuted",
    description: "مالي خلق افهمه",
    authors: [Devs.rz30],
    settings,
    patches: [
        {
            find: "getSpeakingWhileMuted(){return ",
            replacement: {
                match: /(getSpeakingWhileMuted\(\){)(return) (\i)/,
                replace: "$1$self.handleSpeaking($3);$2 $3"
            }
        },
        {
            find: ".horizontal,HORIZONTAL_REVERSE:",
            replacement: {
                match: /(\i)=>{(var{children:\i,className:\i,direction:\i=\i.HORIZONTAL)/,
                replace: "$1=>{$self.getButton(e);$2"
            }
        }
    ],
    start: () => {
        isPlaying = false;
        audio = undefined;
    },
    stop: () => {
        audio?.pause();
        audio = undefined;
        isPlaying = false;
    },

    async handleSpeaking(isSpeaking: boolean) {
        if (!settings.store.notifyEnabled
            || !settings.store.notifyServerMuted && !MediaEngineStore.isSelfMute() && MediaEngineStore.isMute()
            || MediaEngineStore.isSelfDeaf() && !settings.store.notifyWhenDeafen) return;
        if (isSpeaking && !isPlaying) {
            isPlaying = true;
            audio = new Audio(isValidURL(settings.store.audioUrl));
            audio.addEventListener("error", () => {
                isPlaying = false;
                audio = undefined;
            });
            audio.addEventListener("ended", async () => {
                await delay(settings.store.delayBetweenNotifications);
                isPlaying = false;
                audio = undefined;
            });
            audio.volume = settings.store.audioVolume / 100;
            audio.play();
        }
    },

    getButton(e: { children?: React.ReactNode[], className?: string; }): void {
        if (!settings.store.showToggleButton) return;
        if (!e.className?.startsWith("voiceButtonsContainer_")) return;
        e.children?.unshift(<ToggleButton />);
    }
});


function isValidURL(string) {
    try {
        new URL(string);
        return string;
    } catch (e) {
        return defaultAudioUrl;
    }
}

