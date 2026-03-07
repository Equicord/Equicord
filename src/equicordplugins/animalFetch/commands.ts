/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType } from "@api/Commands";
import { sendMessage } from "@utils/discord";

import { fetchCatImage, fetchDogImage, fetchFoxImage } from "./api";
import { CatImage, DogResponse, FoxResponse } from "./types";

export const animalFetchCommands = [
    {
        name: "cat",
        description: "Get a random cat image",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [],
        execute: async (args: any[], ctx: any) => {
            try {
                const catData: CatImage = await fetchCatImage();
                sendMessage(ctx.channel.id, { content: `${catData.url}` });
            } catch (error) {
                sendMessage(ctx.channel.id, { content: `Failed to fetch cat image: ${error}` });
            }
        }
    },
    {
        name: "dog",
        description: "Get a random dog image",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [],
        execute: async (args: any[], ctx: any) => {
            try {
                const dogData: DogResponse = await fetchDogImage();
                sendMessage(ctx.channel.id, { content: `${dogData.url}` });
            } catch (error) {
                sendMessage(ctx.channel.id, { content: `Failed to fetch dog image: ${error}` });
            }
        }
    },
    {
        name: "fox",
        description: "Get a random fox image",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [],
        execute: async (args: any[], ctx: any) => {
            try {
                const foxData: FoxResponse = await fetchFoxImage();
                sendMessage(ctx.channel.id, { content: `${foxData.image}` });
            } catch (error) {
                sendMessage(ctx.channel.id, { content: `Failed to fetch fox image: ${error}` });
            }
        }
    }
];
