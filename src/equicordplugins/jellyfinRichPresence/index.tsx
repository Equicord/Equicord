/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// alot of the code is from LastFMRichPresence
import { definePluginSettings } from "@api/Settings";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Devs, EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";
import { ApplicationAssetUtils, FluxDispatcher, showToast } from "@webpack/common";

interface ActivityAssets {
    large_image?: string;
    large_text?: string;
    small_image?: string;
    small_text?: string;
}

interface ActivityButton {
    label: string;
    url: string;
}

interface Activity {
    state: string;
    details?: string;
    timestamps?: {
        start?: number;
    };
    assets?: ActivityAssets;
    buttons?: Array<string>;
    name: string;
    application_id: string;
    metadata?: {
        button_urls?: Array<string>;
    };
    type: number;
    flags: number;
}

interface MediaData {
    name: string;
    type: string;
    artist?: string;
    album?: string;
    seriesName?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    year?: number;
    url?: string;
    imageUrl?: string;
    duration?: number;
    position?: number;
    isPaused?: boolean;
}

const settings = definePluginSettings({
    serverUrl: {
        description: t("jellyfinRichPresence.settings.serverUrl"),
        type: OptionType.STRING,
    },
    apiKey: {
        description: t("jellyfinRichPresence.settings.apiKey"),
        type: OptionType.STRING,
    },
    userId: {
        description: t("jellyfinRichPresence.settings.userId"),
        type: OptionType.STRING,
    },
    nameDisplay: {
        description: t("jellyfinRichPresence.settings.nameDisplay"),
        type: OptionType.SELECT,
        options: [
            { label: t("jellyfinRichPresence.nameFormatOptions.seriesMovieName"), value: "default", default: true },
            { label: t("jellyfinRichPresence.nameFormatOptions.seriesEpisodeName"), value: "full" },
            { label: t("jellyfinRichPresence.nameFormatOptions.custom"), value: "custom" },
        ],
    },
    customName: {
        description: t("jellyfinRichPresence.settings.customName"),
        type: OptionType.STRING,
    },
    coverType: {
        description: t("jellyfinRichPresence.settings.coverType"),
        type: OptionType.SELECT,
        options: [
            { label: t("jellyfinRichPresence.coverTypeOptions.seriesCover"), value: "series", default: true },
            { label: t("jellyfinRichPresence.coverTypeOptions.episodeCover"), value: "episode" },
        ],
    },
    episodeFormat: {
        description: t("jellyfinRichPresence.settings.episodeFormat"),
        type: OptionType.SELECT,
        options: [
            { label: t("jellyfinRichPresence.episodeFormatOptions.s01e01"), value: "long", default: true },
            { label: t("jellyfinRichPresence.episodeFormatOptions.short"), value: "short" },
            { label: t("jellyfinRichPresence.episodeFormatOptions.fulltext"), value: "fulltext" },
        ],
    },
    showEpisodeName: {
        description: t("jellyfinRichPresence.settings.showEpisodeName"),
        type: OptionType.BOOLEAN,
        default: false,
    },
    overrideRichPresenceType: {
        description: t("jellyfinRichPresence.settings.overrideRichPresenceType"),
        type: OptionType.SELECT,
        options: [
            {
                label: t("jellyfinRichPresence.overrideTypeOptions.off"),
                value: false,
                default: true,
            },
            {
                label: t("jellyfinRichPresence.overrideTypeOptions.listening"),
                value: 2,
            },
            {
                label: t("jellyfinRichPresence.overrideTypeOptions.playing"),
                value: 0,
            },
            {
                label: t("jellyfinRichPresence.overrideTypeOptions.streaming"),
                value: 1,
            },
            {
                label: t("jellyfinRichPresence.overrideTypeOptions.watching"),
                value: 3
            },
        ],
    },
    showPausedState: {
        description: t("jellyfinRichPresence.settings.showPausedState"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    privacyMode: {
        description: t("jellyfinRichPresence.settings.privacyMode"),
        type: OptionType.BOOLEAN,
        default: false,
    },
});

const applicationId = "1381368130164625469";

const logger = new Logger("JellyfinRichPresence");

let updateInterval: NodeJS.Timeout | undefined;

async function getApplicationAsset(key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(applicationId, [key]))[0];
}

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "Jellyfin",
    });
}

export default definePlugin({
    name: "JellyfinRichPresence",
    description: t("jellyfinRichPresence.description"),
    authors: [EquicordDevs.vmohammad, Devs.SerStars, EquicordDevs.ZcraftElite],

    settingsAboutComponent: () => (
        <>
            <HeadingSecondary>{t("jellyfinRichPresence.howToGetApiKey.title")}</HeadingSecondary>
            <Paragraph>
                {t("jellyfinRichPresence.howToGetApiKey.description")}
                <ol style={{ marginTop: 8, marginBottom: 8, paddingLeft: 20 }}>
                    <li>1. Log into your Jellyfin instance</li>
                    <li>2. Open your browser's Developer Tools (usually F12 or right-click then Inspect)</li>
                    <li>3. Go to the <b>Network</b> tab in Developer Tools</li>
                    <li>4. Look for requests to your Jellyfin server</li>
                    <li>
                        5. In the request headers, find <code>X-MediaBrowser-Token</code> or <code>Authorization</code>
                        <br />
                        <i>
                            Easiest way: press <b>Ctrl+F</b> in the Developer Tools and search for <code>X-MediaBrowser-Token</code>
                        </i>
                    </li>
                </ol>
                <br />
                {t("jellyfinRichPresence.howToGetApiKey.userIdInfo")}
            </Paragraph>
        </>
    ),

    settings,

    start() {
        this.updatePresence();
        updateInterval = setInterval(() => { this.updatePresence(); }, 10000);
    },

    stop() {
        clearInterval(updateInterval);
        updateInterval = undefined;
    },

    async fetchMediaData(): Promise<MediaData | null> {
        if (!settings.store.serverUrl || !settings.store.apiKey || !settings.store.userId) {
            logger.warn("Jellyfin server URL, API key, or user ID is not set in settings.");
            showToast(t("jellyfinRichPresence.toasts.notConfigured"), "failure", {
                duration: 15000,
            });
            return null;
        }

        try {
            const baseUrl = settings.store.serverUrl.replace(/\/$/, "");
            const url = `${baseUrl}/Sessions?api_key=${settings.store.apiKey}`;

            const res = await fetch(url);
            if (!res.ok) throw `${res.status} ${res.statusText}`;

            const sessions = await res.json();
            const userSession = sessions.find((session: any) =>
                session.UserId === settings.store.userId && session.NowPlayingItem
            );

            if (!userSession || !userSession.NowPlayingItem) return null;

            const item = userSession.NowPlayingItem;
            const playState = userSession.PlayState;

            if (playState?.IsPaused && !settings.store.showPausedState) return null;

            const imageUrl = item.ImageTags?.Primary
                ? `${baseUrl}/Items/${item.Type === "Episode" &&
                    item.SeriesId &&
                    settings.store.coverType === "series"
                    ? item.SeriesId
                    : item.Id
                }/Images/Primary`
                : undefined;

            return {
                name: item.Name || "Unknown",
                type: item.Type,
                artist: item.Artists?.[0] || item.AlbumArtist,
                album: item.Album,
                seriesName: item.SeriesName,
                seasonNumber: item.ParentIndexNumber,
                episodeNumber: item.IndexNumber,
                year: item.ProductionYear,
                url: `${baseUrl}/web/#!/details?id=${item.Id}`,
                imageUrl,
                duration: item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 10000000) : undefined,
                position: playState?.PositionTicks ? Math.floor(playState.PositionTicks / 10000000) : undefined,
                isPaused: !!playState?.IsPaused,
            };
        } catch (e) {
            logger.error("Failed to query Jellyfin API", e);
            return null;
        }
    },

    async updatePresence() {
        setActivity(await this.getActivity());
    },

    async getActivity(): Promise<Activity | null> {
        let richPresenceType;
        let appName: string;
        const nameSetting = settings.store.nameDisplay || "default";

        const mediaData = await this.fetchMediaData();
        if (!mediaData) return null;

        if (settings.store.overrideRichPresenceType) {
            richPresenceType = settings.store.overrideRichPresenceType;
        } else {
            switch (mediaData.type) {
                case "Audio":
                    richPresenceType = 2;
                    break;
                default:
                    richPresenceType = 3;
                    break;
            }
        }

        const templateReplace = (template: string) => {
            return template
                .replace(/\{name\}/g, mediaData.name || "")
                .replace(/\{series\}/g, mediaData.seriesName || "")
                .replace(/\{season\}/g, mediaData.seasonNumber?.toString() || "")
                .replace(/\{episode\}/g, mediaData.episodeNumber?.toString() || "")
                .replace(/\{artist\}/g, mediaData.artist || "")
                .replace(/\{album\}/g, mediaData.album || "")
                .replace(/\{year\}/g, mediaData.year?.toString() || "");
        };

        switch (nameSetting) {
            case "full":
                if (mediaData.type === "Episode" && mediaData.seriesName) {
                    appName = settings.store.privacyMode
                        ? `${mediaData.seriesName} - ${t("jellyfinRichPresence.privacyMode.episodeHidden")}`
                        : `${mediaData.seriesName} - ${mediaData.name}`;
                } else if (mediaData.type === "Audio") {
                    appName = settings.store.privacyMode
                        ? t("jellyfinRichPresence.privacyMode.trackHidden")
                        : `${mediaData.artist || "Unknown Artist"} - ${mediaData.name}`;
                } else {
                    appName = settings.store.privacyMode
                        ? t("jellyfinRichPresence.privacyMode.movieHidden")
                        : mediaData.name || "Jellyfin";
                }
                break;
            case "custom":
                appName = templateReplace(settings.store.customName || "{name} on Jellyfin");
                if (settings.store.privacyMode) {
                    appName = appName
                        .replace(mediaData.name || "", t("jellyfinRichPresence.privacyMode.titleHidden"))
                        .replace(mediaData.seriesName || "", t("jellyfinRichPresence.privacyMode.seriesHidden"))
                        .replace(mediaData.artist || "", t("jellyfinRichPresence.privacyMode.artistHidden"))
                        .replace(mediaData.album || "", t("jellyfinRichPresence.privacyMode.albumHidden"));
                }
                break;
            case "default":
            default:
                if (mediaData.type === "Episode" && mediaData.seriesName) {
                    appName = mediaData.seriesName;
                } else {
                    appName = settings.store.privacyMode
                        ? t("jellyfinRichPresence.privacyMode.mediaHidden")
                        : mediaData.name || "Jellyfin";
                }
                break;
        }

        const assets: ActivityAssets = {
            large_image: (mediaData.imageUrl
                ? await getApplicationAsset(mediaData.imageUrl)
                : undefined),
            large_text: mediaData.seriesName || mediaData.album || undefined,
        };

        if (settings.store.privacyMode) {
            assets.large_image = undefined;
        }

        const buttons: ActivityButton[] = [];

        const getDetails = () => {
            if (mediaData.type === "Episode" && mediaData.seriesName) {
                return settings.store.privacyMode ? t("jellyfinRichPresence.privacyMode.watchingTvShow") : mediaData.seriesName;
            }
            return settings.store.privacyMode ? t("jellyfinRichPresence.privacyMode.watchingSomething") : mediaData.name;
        };

        const getState = () => {
            if (mediaData.isPaused) {
                return t("jellyfinRichPresence.state.paused");
            }
            if (mediaData.type === "Episode" && mediaData.seriesName) {
                let episodeFormat = "";
                const season = mediaData.seasonNumber;
                const episode = mediaData.episodeNumber;
                const format = settings.store.episodeFormat || "long";

                if (season != null && episode != null) {
                    switch (format) {
                        case "long":
                            episodeFormat = `S${season.toString().padStart(2, "0")}E${episode.toString().padStart(2, "0")}`;
                            break;
                        case "short":
                            episodeFormat = `${season}x${episode.toString().padStart(2, "0")}`;
                            break;
                        case "fulltext":
                            episodeFormat = t("jellyfinRichPresence.state.season", { season }) + " " + t("jellyfinRichPresence.state.episode", { episode });
                            break;
                    }
                } else if (season != null) {
                    episodeFormat = format === "fulltext" ? t("jellyfinRichPresence.state.season", { season }) : `S${season.toString().padStart(2, "0")}`;
                } else if (episode != null) {
                    episodeFormat = format === "fulltext" ? t("jellyfinRichPresence.state.episode", { episode }) : `E${episode.toString().padStart(2, "0")}`;
                }

                if (settings.store.showEpisodeName && mediaData.name && !settings.store.privacyMode) {
                    return `${episodeFormat} - ${mediaData.name}`;
                }
                return episodeFormat;
            }
            if (settings.store.privacyMode) {
                return mediaData.type === "Audio" ? t("jellyfinRichPresence.privacyMode.listeningToMusic") : (mediaData.year ? "(????)" : undefined);
            }
            return mediaData.artist || (mediaData.year ? `(${mediaData.year})` : undefined);
        };

        const timestamps = (!mediaData.isPaused && mediaData.position != null && mediaData.duration != null) ? {
            start: Date.now() - (mediaData.position * 1000),
            end: Date.now() + ((mediaData.duration - mediaData.position) * 1000)
        } : undefined;

        return {
            application_id: applicationId,
            name: appName,
            details: getDetails(),
            state: getState() || "something",
            assets,
            timestamps,

            buttons: buttons.length ? buttons.map(v => v.label) : undefined,
            metadata: {
                button_urls: buttons.map(v => v.url),
            },
            type: richPresenceType,
            flags: 1
        };
    }
});
