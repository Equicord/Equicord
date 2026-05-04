/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    ApplicationCommandInputType,
    ApplicationCommandOptionType,
    findOption,
    sendBotMessage,
} from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin, { OptionType, PluginNative } from "@utils/types";

const Native = VencordNative.pluginHelpers.MusicLinker as PluginNative<
    typeof import("./native")
>;

interface SongLinkData {
    title?: string;
    artist?: string;
    linksByPlatform: Record<string, { url: string }>;
}

interface PlatformConfig {
    name: string;
    settingKey: keyof typeof settings.store;
    apiKey: string;
}

const settings = definePluginSettings({
    enableSpotify: {
        type: OptionType.BOOLEAN,
        description: "Include Spotify links.",
        default: true,
    },
    enableDeezer: {
        type: OptionType.BOOLEAN,
        description: "Include Deezer links.",
        default: true,
    },
    enableYoutube: {
        type: OptionType.BOOLEAN,
        description: "Include YouTube links.",
        default: false,
    },
    enableYoutubeMusic: {
        type: OptionType.BOOLEAN,
        description: "Include YouTube Music links.",
        default: false,
    },
    enableAppleMusic: {
        type: OptionType.BOOLEAN,
        description: "Include Apple Music links.",
        default: false,
    },
    enableTidal: {
        type: OptionType.BOOLEAN,
        description: "Include Tidal links.",
        default: false,
    },
    enableSoundcloud: {
        type: OptionType.BOOLEAN,
        description: "Include SoundCloud links (search-based).",
        default: false,
    },
    enableAmazonMusic: {
        type: OptionType.BOOLEAN,
        description: "Include Amazon Music links.",
        default: false,
    },
    enableNapster: {
        type: OptionType.BOOLEAN,
        description: "Include Napster links.",
        default: false,
    },
    enablePandora: {
        type: OptionType.BOOLEAN,
        description: "Include Pandora links.",
        default: false,
    },
    enableAnghami: {
        type: OptionType.BOOLEAN,
        description: "Include Anghami links.",
        default: false,
    },
    enableBoomplay: {
        type: OptionType.BOOLEAN,
        description: "Include Boomplay links.",
        default: false,
    },
    enableAudius: {
        type: OptionType.BOOLEAN,
        description: "Include Audius links.",
        default: false,
    },
    enableYandex: {
        type: OptionType.BOOLEAN,
        description: "Include Yandex Music links.",
        default: false,
    },
    includeMetadata: {
        type: OptionType.BOOLEAN,
        description: "Include the track title and artist name as a header.",
        default: true,
    },
    userCountry: {
        type: OptionType.STRING,
        description: "Your country code for better results (e.g. FR, US, GB).",
        default: "FR",
    },
});

const PLATFORMS: PlatformConfig[] = [
    { name: "Spotify", settingKey: "enableSpotify", apiKey: "spotify" },
    { name: "Deezer", settingKey: "enableDeezer", apiKey: "deezer" },
    { name: "Youtube", settingKey: "enableYoutube", apiKey: "youtube" },
    {
        name: "Youtube Music",
        settingKey: "enableYoutubeMusic",
        apiKey: "youtubeMusic",
    },
    {
        name: "Apple Music",
        settingKey: "enableAppleMusic",
        apiKey: "appleMusic",
    },
    { name: "Tidal", settingKey: "enableTidal", apiKey: "tidal" },
    {
        name: "SoundCloud",
        settingKey: "enableSoundcloud",
        apiKey: "soundcloud",
    },
    {
        name: "Amazon Music",
        settingKey: "enableAmazonMusic",
        apiKey: "amazonMusic",
    },
    { name: "Napster", settingKey: "enableNapster", apiKey: "napster" },
    { name: "Pandora", settingKey: "enablePandora", apiKey: "pandora" },
    { name: "Anghami", settingKey: "enableAnghami", apiKey: "anghami" },
    { name: "Boomplay", settingKey: "enableBoomplay", apiKey: "boomplay" },
    { name: "Audius", settingKey: "enableAudius", apiKey: "audius" },
    { name: "Yandex Music", settingKey: "enableYandex", apiKey: "yandex" },
];

const MAX_CACHE_SIZE = 200;
const cache = new Map<string, SongLinkData>();

function formatMessage(data: SongLinkData): string | null {
    const lines: string[] = [];

    for (const platform of PLATFORMS) {
        if (!settings.store[platform.settingKey]) continue;

        const platformData = data.linksByPlatform[platform.apiKey];
        if (platformData?.url) {
            lines.push(`- [${platform.name}](<${platformData.url}>)`);
        }
    }

    if (lines.length === 0) return null;

    const parts: string[] = [];

    if (settings.store.includeMetadata && data.title && data.artist) {
        parts.push(`### **${data.title}** — *${data.artist}*`);
    }

    parts.push(lines.join("\n"));

    return parts.join("\n");
}

async function fetchSongLinks(url: string): Promise<SongLinkData> {
    const cached = cache.get(url);
    if (cached) return cached;

    const data = await Native.getSongLinks(url);
    if (cache.size >= MAX_CACHE_SIZE) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
    }
    cache.set(url, data);
    return data;
}

export default definePlugin({
    name: "MusicLinker",
    description:
        "Use /musiclink to convert music links between Spotify, Deezer, YouTube, YouTube Music, Apple Music, Tidal and more.",
    dependencies: ["CommandsAPI"],
    authors: [EquicordDevs.NassCT],
    tags: ["Media", "Utility"],
    settings,

    commands: [
        {
            name: "musiclink",
            description: "Convert a music link to other streaming platforms.",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "url",
                    description:
                        "Music link (Spotify, Deezer, YouTube, Tidal, Apple Music, SoundCloud...)",
                    type: ApplicationCommandOptionType.STRING,
                    required: true,
                },
            ],
            execute: async (opts, ctx) => {
                const url = findOption<string>(opts, "url", "");

                if (!url) {
                    sendBotMessage(ctx.channel.id, {
                        content: "Please provide a music link.",
                    });
                    return;
                }

                try {
                    const data = await fetchSongLinks(url);
                    const formatted = formatMessage(data);

                    if (!formatted) {
                        sendBotMessage(ctx.channel.id, {
                            content:
                                "No alternative platforms found for this link.",
                        });
                        return;
                    }

                    sendMessage(ctx.channel.id, { content: formatted });
                } catch (e: any) {
                    let errorMsg = e?.message || String(e);
                    errorMsg = errorMsg.replace(
                        /Error invoking remote method '[^']+':\s*Error:\s*/,
                        "",
                    );

                    let userFriendlyMsg = `Failed to resolve music link: ${errorMsg}`;
                    if (errorMsg.includes("400")) {
                        userFriendlyMsg =
                            "Failed to resolve music link: The provided URL is invalid or not supported.";
                    } else if (errorMsg.includes("429")) {
                        userFriendlyMsg =
                            "Failed to resolve music link: You are being rate-limited by the service. Please try again later.";
                    } else if (errorMsg.includes("500")) {
                        userFriendlyMsg =
                            "Failed to resolve music link: The streaming service is currently unavailable.";
                    }

                    sendBotMessage(ctx.channel.id, {
                        content: userFriendlyMsg,
                    });
                }
            },
        },
    ],
});
