/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const giphySettings = definePluginSettings({
    apiKey: {
        description: "Giphy API Key",
        type: OptionType.STRING,
        default: "Gc7131jiJuvI7IdN0HZ1D7nh0ow5BU6g", // directly from the giphy website webpack bundle, this is static
        placeholder: "Enter your Giphy API Key",
        restartNeeded: false
    }
});

export interface GiphyImage {
    url: string;
    width: string;
    height: string;
    mp4?: string;
}

export interface GiphyGif {
    id: string;
    title: string;
    images: {
        fixed_height: GiphyImage;
        original: GiphyImage;
    };
    url: string;
}

interface GiphyResponse {
    data: GiphyGif[];
    meta: {
        status: number;
        msg: string;
        response_id: string;
    };
    pagination: {
        total_count: number;
        count: number;
        offset: number;
    };
}

export async function searchGifs(query: string, limit = 25, offset = 0): Promise<GiphyGif[]> {
    const { apiKey } = giphySettings.store;
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Giphy API Error: ${response.statusText}`);
        const json: GiphyResponse = await response.json();
        return json.data;
    } catch (e) {
        console.error("Failed to search Giphy:", e);
        return [];
    }
}

export async function getTrendingGifs(limit = 25, offset = 0): Promise<GiphyGif[]> {
    const { apiKey } = giphySettings.store;
    const url = `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&offset=${offset}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Giphy API Error: ${response.statusText}`);
        const json: GiphyResponse = await response.json();
        return json.data;
    } catch (e) {
        console.error("Failed to fetch trending Gifs:", e);
        return [];
    }
}
