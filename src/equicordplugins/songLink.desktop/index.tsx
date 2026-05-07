/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 nin0
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { Devs, EquicordDevs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import definePlugin, { OptionType, PluginNative } from "@utils/types";

import { Providers } from "./Providers";
import { Settings } from "./Settings";
import SongLinker from "./SongLinker";

export const settings = definePluginSettings({
    servicesSettings: {
        type: OptionType.CUSTOM,
        description: "settings for services",
        default: Object.fromEntries(Object.entries(Providers).map(([name, data]) => [name, {
            enabled: true,
            // @ts-ignore
            openInNative: data.native || false
        }]))
    },
    userCountry: {
        type: OptionType.STRING,
        description: "Country used for lookup (Two letter country code)",
        default: "US"
    },
    includeMetadata: {
        type: OptionType.BOOLEAN,
        description: "Include the track title and artist name as a header.",
        default: true,
    },
    servicesComponent: {
        type: OptionType.COMPONENT,
        component: () => <Settings />
    }
});

export type SongLinkResult = {
    info?: {
        title: string;
        artist: string;
    };
    links: {
        [platform: string]: {
            url: string;
            nativeUri?: string;
        };
    };
};

export const Native = VencordNative.pluginHelpers.SongLink as PluginNative<typeof import("./native")>;

function formatMessage(data: SongLinkResult): string | null {
    const lines: string[] = [];

    for (const [serviceKey, service] of Object.entries(settings.store.servicesSettings)) {
        if (!service.enabled) continue;

        const platformData = data.links[serviceKey];
        if (!platformData?.url) continue;

        const provider = Providers[serviceKey];
        const name = provider?.name ?? serviceKey;

        lines.push(`- [${name}](<${platformData.url}>)`);
    }

    if (lines.length === 0) return null;

    const parts: string[] = [];

    if (settings.store.includeMetadata && data.info?.title && data.info?.artist) {
        parts.push(`### **${data.info.title}** — *${data.info.artist}*`);
    }

    parts.push(lines.join("\n"));

    return parts.join("\n");
}

export default definePlugin({
    name: "SongLink",
    description: "Adds streaming service buttons below song links",
    dependencies: ["MessageAccessoriesAPI"],
    tags: ["Media", "Utility"],
    authors: [Devs.nin0dev, EquicordDevs.NassCT],
    settings,
    Providers,
    cache: ({} as Record<string, SongLinkResult>),
    addToCache(link, data: SongLinkResult) {
        this.cache[link] = data;
    },
    renderMessageAccessory(props: Record<string, any>) {
        const { content }: {
            content: string;
        } = props.message;
        if (!content) return;

        const regexes = [
            /https:\/\/(?:open|play)\.spotify\.com\/track\/[a-zA-Z0-9]+/, // spotify
            /https:\/\/(music|itunes)\.apple\.com\/[a-z]{2}\/album\/\S+/, // apple music/itunes
            /https:\/\/music\.youtube\.com\/watch\?v=[0-9A-Za-z_-]+/, // yt music
            /https:\/\/tidal\.com\/track\/[0-9]+\/u/ // tidal
        ];
        const musicLinks = content.match(new RegExp(regexes.map(r => r.source).join("|"), "g"));
        if (!musicLinks?.length) return;

        return <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginTop: "7px"
        }}>
            {
                musicLinks.map(item => <SongLinker key={item} url={item} />)
            }
        </div>;
    },
    commands: [
        {
            name: "musiclink",
            description: "Convert a music link to other streaming platforms.",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "url",
                    description: "Music link (Spotify, Deezer, YouTube, Tidal, Apple Music, SoundCloud)",
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

                sendBotMessage(ctx.channel.id, {
                    content: "This will take a moment...",
                });

                try {
                    const data = await Native.getTrackData(url);
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
                    sendBotMessage(ctx.channel.id, {
                        content: "Failed to resolve music link",
                    });
                }
            },
        },
    ],
});
