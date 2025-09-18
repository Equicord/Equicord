/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { AudioPlayerInterface, createAudioPlayer } from "@api/AudioPlayer";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

let click1: AudioPlayerInterface, click2: AudioPlayerInterface, click3: AudioPlayerInterface, backspace: AudioPlayerInterface;
let sounds: Record<string, AudioPlayerInterface> = {};
const keysCurrentlyPressed = new Set<string>();

const ignoredKeys = ["CapsLock", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight", "ArrowUp", "ArrowRight", "ArrowLeft", "ArrowDown", "MediaPlayPause", "MediaStop", "MediaTrackNext", "MediaTrackPrevious", "MediaSelect", "MediaEject", "MediaVolumeUp", "MediaVolumeDown", "AudioVolumeUp", "AudioVolumeDown"];

const keyup = (e: KeyboardEvent) => { keysCurrentlyPressed.delete(e.code); };

const keydown = (e: KeyboardEvent) => {
    if (ignoredKeys.includes(e.code)) return;
    if (!Object.keys(sounds).length) return;
    if (!click1 || !click2 || !click3 || !backspace) return;
    if (keysCurrentlyPressed.has(e.code)) return;
    keysCurrentlyPressed.add(e.code);

    if (e.code === "Backspace") {
        sounds.backspace.restart();
    } else {
        const click = sounds[`click${Math.floor(Math.random() * 3) + 1}`];
        click.restart();
    }
};

function assignSounds(volume: number) {
    click1 = createAudioPlayer("https://github.com/Equicord/Equibored/raw/main/sounds/keyboard/click1.wav", { volume, preload: true, persistent: true });
    click2 = createAudioPlayer("https://github.com/Equicord/Equibored/raw/main/sounds/keyboard/click2.wav", { volume, preload: true, persistent: true });
    click3 = createAudioPlayer("https://github.com/Equicord/Equibored/raw/main/sounds/keyboard/click3.wav", { volume, preload: true, persistent: true });
    backspace = createAudioPlayer("https://github.com/Equicord/Equibored/raw/main/sounds/keyboard/backspace.wav", { volume, preload: true, persistent: true });
    sounds = {
        click1,
        click2,
        click3,
        backspace,
    };
}

const settings = definePluginSettings({
    volume: {
        description: "Volume of the keyboard sounds.",
        type: OptionType.SLIDER,
        markers: [0, 25, 50, 75, 100],
        stickToMarkers: false,
        default: 100,
        onChange: value => { assignSounds(value); }
    }
});

export default definePlugin({
    name: "KeyboardSounds",
    description: "Adds the Opera GX Keyboard Sounds to Discord",
    authors: [Devs.HypedDomi],
    dependencies: ["AudioPlayerAPI"],
    settings,
    start() {
        assignSounds(settings.store.volume);
        document.addEventListener("keyup", keyup);
        document.addEventListener("keydown", keydown);
    },
    stop: () => {
        Object.values(sounds).forEach(sound => sound.delete());
        document.removeEventListener("keyup", keyup);
        document.removeEventListener("keydown", keydown);
    },
});
