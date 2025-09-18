/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and Megumin
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
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

let clickCount = 0;
let croissant: AudioPlayerInterface | null = null;

function play() {
    croissant ??= createAudioPlayer("https://github.com/Equicord/Equibored/raw/main/sounds/equissant/croissant.mp3");
    clickCount++;

    if (clickCount % 10 === 0) {
        croissant.play();
    }
}

export default definePlugin({
    name: "Equissant",
    description: "Crossant every 10 clicks :trolley:",
    authors: [EquicordDevs.SomeAspy, Devs.thororen],
    dependencies: ["AudioPlayerAPI"],
    start() {
        document.addEventListener("click", play);
    },
    stop() {
        document.removeEventListener("click", play);
    }
});
