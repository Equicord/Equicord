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

import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

const smallWords = new Set([
    "a", "an", "and", "as", "at", "but", "by", "for",
    "in", "nor", "of", "on", "or", "so", "the", "to", "up", "yet"
]);

function toTitleCase(text: string) {
    const words = text.toLowerCase().split(/\s+/);
    return words.map((word, i) => {
        if (
            i === 0 || i === words.length - 1 || !smallWords.has(word)
        ) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        } else {
            return word;
        }
    }).join(" ");
}

const listener = async (_, message) => {
    if (message.content) message.content = toTitleCase(message.content);
};

export default definePlugin({
    name: "TitleCase",
    authors: [EquicordDevs.zyqunix],
    description: "Applies Title Case to Your Messages, Just like This One.",
    dependencies: ["MessageEventsAPI"],

    start: () => addMessagePreSendListener(listener),
    stop: () => removeMessagePreSendListener(listener)
});
