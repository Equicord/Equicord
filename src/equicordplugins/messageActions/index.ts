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

import { ApplicationCommandOptionType } from "@api/Commands";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "MessageActions",
    description: "A slash command to change how your text is sent",
    authors: [EquicordDevs.zyqunix],
    commands: [
        {
            name: "toLowerCase",
            description: "all text will be lowercase",
            options: [
                {
                    name: "text",
                    description: "text to lowercase",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: opts => {
                const input = opts.find(o => o.name === "text")?.value as string;
                const content = input.toLowerCase();
                return { content: content };
            },
        },
        {
            name: "toUpperCase",
            description: "ALL TEXT WILL BE UPPERCASE",
            options: [
                {
                    name: "text",
                    description: "TEXT TO UPPERCASE",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: opts => {
                const input = opts.find(o => o.name === "text")?.value as string;
                const content = input.toUpperCase();
                return { content: content };
            },
        },
        {
            name: "toLocaleLowerCase",
            description: "all text will be locale lowercase",
            options: [
                {
                    name: "text",
                    description: "text to lowercase",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: opts => {
                const input = opts.find(o => o.name === "text")?.value as string;
                const content = input.toLocaleLowerCase();
                return { content: content };
            },
        },
        {
            name: "toLocaleUpperCase",
            description: "ALL TEXT WILL BE LOCALE UPPERCASE",
            options: [
                {
                    name: "text",
                    description: "TEXT TO UPPERCASE",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: opts => {
                const input = opts.find(o => o.name === "text")?.value as string;
                const content = input.toLocaleUpperCase();
                return { content: content };
            },
        },
        {
            name: "normalize",
            description: "Returns Unicode Normalization Form of string",
            options: [
                {
                    name: "text",
                    description: "Text to normalize",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: opts => {
                const input = opts.find(o => o.name === "text")?.value as string;
                const content = input.normalize();
                return { content: content };
            },
        },
        {
            name: "repeat",
            description: "Repeats the string count times",
            options: [
                {
                    name: "text",
                    description: "Text to repeat",
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                },
                {
                    name: "count",
                    description: "Amount of repetitions",
                    type: ApplicationCommandOptionType.INTEGER,
                    required: true
                }
            ],
            execute: opts => {
                const text = opts.find(o => o.name === "text")?.value as string;
                const count = (opts.find(o => o.name === "count")?.value ?? 1) as number;
                const content = text.repeat(count);
                return { content: content };
            },
        },
    ]
});
