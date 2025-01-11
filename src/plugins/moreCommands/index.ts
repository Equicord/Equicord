/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated, Samu and contributors
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

import { ApplicationCommandInputType, findOption, OptionalMessageOption, RequiredMessageOption, sendBotMessage } from "@api/Commands";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import axios from "axios";

function mock(input: string): string {
    let output = "";
    for (let i = 0; i < input.length; i++) {
        output += i % 2 ? input[i].toUpperCase() : input[i].toLowerCase();
    }
    return output;
}

export default definePlugin({
    name: "MoreCommands",
    description: "Echo, Lenny, Mock, and More",
    authors: [Devs.Arjix, Devs.echo, Devs.Samu],
    commands: [
        {
            name: "echo",
            description: "Sends a message as Clyde (locally)",
            options: [OptionalMessageOption],
            inputType: ApplicationCommandInputType.BOT,
            execute: (opts, ctx) => {
                const content = findOption(opts, "message", "");
                sendBotMessage(ctx.channel.id, { content });
            },
        },
        {
            name: "lenny",
            description: "Sends a lenny face",
            options: [OptionalMessageOption],
            execute: opts => ({
                content: findOption(opts, "message", "") + " ( ͡° ͜ʖ ͡°)"
            }),
        },
        {
            name: "mock",
            description: "mOcK PeOpLe",
            options: [RequiredMessageOption],
            execute: opts => ({
                content: mock(findOption(opts, "message", ""))
            }),
        },
        {
            name: "reverse",
            description: "Reverses the input message",
            options: [RequiredMessageOption],
            execute: opts => ({
                content: findOption(opts, "message", "").split("").reverse().join("")
            }),
        },
        {
            name: "uppercase",
            description: "Converts the message to uppercase",
            options: [RequiredMessageOption],
            execute: opts => ({
                content: findOption(opts, "message", "").toUpperCase()
            }),
        },
        {
            name: "lowercase",
            description: "Converts the message to lowercase",
            options: [RequiredMessageOption],
            execute: opts => ({
                content: findOption(opts, "message", "").toLowerCase()
            }),
        },
        {
            name: "wordcount",
            description: "Counts the number of words in the message",
            options: [RequiredMessageOption],
            execute: opts => {
                const message = findOption(opts, "message", "");
                const wordCount = message.trim().split(/\s+/).length;
                return {
                    content: `The message contains ${wordCount} words.`
                };
            },
        },
        {
            name: "shrinkurl",
            description: "Shrinks a long URL",
            options: [RequiredMessageOption],
            execute: async opts => {
                const url = findOption(opts, "message", "");
                try {
                    const response = await axios.post("https://api.shrtco.de/v2/shorten", {
                        url: url
                    });
                    return {
                        content: `Shortened URL: ${response.data.result.full_short_link}`
                    };
                } catch (error) {
                    return {
                        content: "There was an error shortening the URL."
                    };
                }
            },
        },
        {
            name: "joke",
            description: "Tells a random joke",
            options: [],
            execute: async () => {
                try {
                    const response = await axios.get("https://official-joke-api.appspot.com/jokes/random");
                    const joke = response.data[0];
                    return {
                        content: `${joke.setup} - ${joke.punchline}`
                    };
                } catch (error) {
                    return {
                        content: "Sorry, I couldn't fetch a joke right now."
                    };
                }
            },
        },
        {
            name: "servertime",
            description: "Displays the current server time",
            options: [],
            execute: () => {
                const currentTime = new Date().toLocaleString();
                return {
                    content: `The current server time is: ${currentTime}`
                };
            },
        },
        {
            name: "ping",
            description: "Pings the bot to check if it's responding",
            options: [],
            execute: () => ({
                content: "Pong!"
            }),
        },
        {
            name: "rolldice",
            description: "Roll a die with the specified number of sides",
            options: [RequiredMessageOption],
            execute: opts => {
                const sides = parseInt(findOption(opts, "message", "6"));
                const roll = Math.floor(Math.random() * sides) + 1;
                return {
                    content: `You rolled a ${roll}!`
                };
            },
        },
        {
            name: "flipcoin",
            description: "Flips a coin and returns heads or tails",
            options: [],
            execute: () => {
                const flip = Math.random() < 0.5 ? "Heads" : "Tails";
                return {
                    content: `The coin landed on: ${flip}`
                };
            },
        },
        {
            name: "ask",
            description: "Ask a yes/no question and get an answer",
            options: [RequiredMessageOption],
            execute: opts => {
                const question = findOption(opts, "message", "");
                const responses = [
                    "Yes", "No", "Maybe", "Ask again later", "Definitely not", "It is certain"
                ];
                const response = responses[Math.floor(Math.random() * responses.length)];
                return {
                    content: `${question} - ${response}`
                };
            },
        },
    ]
});

