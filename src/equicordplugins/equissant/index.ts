/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { AudioPlayerInterface, createAudioPlayer } from "@api/AudioPlayer";
import { definePluginSettings } from "@api/Settings";
import { Devs, EquicordDevs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

let clickCount = 0;
let croissant: AudioPlayerInterface | null = null;

function play() {
    const triggerAmount = settings.store.amount;
    clickCount++;

    if (clickCount % triggerAmount === 0) {
        croissant?.play();
        clickCount = 0;
    }
}

const settings = definePluginSettings({
    amount: {
        type: OptionType.NUMBER,
        description: t("equissant.settings.amount"),
        default: 10,
    }
});

export default definePlugin({
    name: "Equissant",
    description: t("equissant.description"),
    authors: [EquicordDevs.SomeAspy, Devs.thororen],
    dependencies: ["AudioPlayerAPI"],
    settings,
    start() {
        croissant = createAudioPlayer("https://github.com/Equicord/Equibored/raw/main/sounds/equissant/croissant.mp3", { persistent: true });
        document.addEventListener("click", play);
    },
    stop() {
        croissant?.delete();
        document.removeEventListener("click", play);
    }
});
