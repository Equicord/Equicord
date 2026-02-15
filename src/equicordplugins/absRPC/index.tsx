/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// alot of the code is from JellyfinRPC
import { definePluginSettings } from "@api/Settings";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs } from "@utils/constants";
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

interface Activity {
    state: string;
    details?: string;
    timestamps?: {
        start?: number;
    };
    assets?: ActivityAssets;
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
    author?: string;
    series?: string;
    duration?: number;
    currentTime?: number;
    progress?: number;
    url?: string;
    imageUrl?: string;
    isFinished?: boolean;
}

const settings = definePluginSettings({
    serverUrl: {
        description: t("absRPC.settings.serverUrl"),
        type: OptionType.STRING,
    },
    username: {
        description: t("absRPC.settings.username"),
        type: OptionType.STRING,
    },
    password: {
        description: t("absRPC.settings.password"),
        type: OptionType.STRING,
    },
});

const applicationId = "1381423044907503636";

const logger = new Logger("AudioBookShelfRichPresence");

let authToken: string | null = null;
let updateInterval: NodeJS.Timeout | undefined;

async function getApplicationAsset(key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(applicationId, [key]))[0];
}

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "ABSRPC",
    });
}

export default definePlugin({
    name: "AudioBookShelfRichPresence",
    description: t("absRPC.description"),
    authors: [EquicordDevs.vmohammad],

    settingsAboutComponent: () => (
        <>
            <HeadingSecondary>{t("absRPC.about.title")}</HeadingSecondary>
            <Paragraph>
                {t("absRPC.about.description")}
                <br /><br />
                {t("absRPC.about.automaticAuth")}
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

    async authenticate(): Promise<boolean> {
        if (!settings.store.serverUrl || !settings.store.username || !settings.store.password) {
            logger.warn("AudioBookShelf server URL, username, or password is not set in settings.");
            showToast(t("absRPC.toasts.notConfigured"), "failure", {
                duration: 15000,
            });
            return false;
        }

        try {
            const baseUrl = settings.store.serverUrl.replace(/\/$/, "");
            const url = `${baseUrl}/login`;

            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: settings.store.username,
                    password: settings.store.password,
                }),
            });

            if (!res.ok) throw `${res.status} ${res.statusText}`;

            const data = await res.json();
            authToken = data.user?.token;
            return !!authToken;
        } catch (e) {
            logger.error("Failed to authenticate with AudioBookShelf", e);
            authToken = null;
            return false;
        }
    },

    async fetchMediaData(): Promise<MediaData | null> {
        if (!authToken && !(await this.authenticate())) {
            return null;
        }

        const isPlayingNow = session => {
            const now = Date.now();
            const lastUpdate = session.updatedAt;
            const diffSeconds = (now - lastUpdate) / 1000;
            return diffSeconds <= 30;
        };
        try {
            const baseUrl = settings.store.serverUrl!.replace(/\/$/, "");
            const url = `${baseUrl}/api/me/listening-sessions`;

            const res = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${authToken}`,
                },
            });

            if (!res.ok) {
                if (res.status === 401) {
                    authToken = null;
                    if (await this.authenticate()) {
                        return this.fetchMediaData();
                    }
                }
                throw `${res.status} ${res.statusText}`;
            }

            const { sessions } = await res.json();
            const activeSession = sessions.find((session: any) =>
                session.updatedAt && !session.isFinished
            );

            if (!activeSession || !isPlayingNow(activeSession)) return null;

            const { mediaMetadata: media, mediaType, duration, currentTime, libraryItemId } = activeSession;
            if (!media) return null;
            console.log(media);
            return {
                name: media.title || "Unknown",
                type: mediaType || "book",
                author: media.author || media.publisher,
                series: media.series[0]?.name,
                duration,
                currentTime,
                imageUrl: libraryItemId ? `${baseUrl}/api/items/${libraryItemId}/cover` : undefined,
                isFinished: activeSession.isFinished || false,
            };
        } catch (e) {
            logger.error("Failed to query AudioBookShelf API", e);
            return null;
        }
    },

    async updatePresence() {
        setActivity(await this.getActivity());
    },

    async getActivity(): Promise<Activity | null> {
        const mediaData = await this.fetchMediaData();
        if (!mediaData || mediaData.isFinished) return null;

        const largeImage = mediaData.imageUrl;
        console.log("Large Image URL:", largeImage);
        const assets: ActivityAssets = {
            large_image: largeImage ? await getApplicationAsset(largeImage) : await getApplicationAsset("audiobookshelf"),
            large_text: mediaData.series || mediaData.author || undefined,
        };

        const getDetails = () => {
            return mediaData.name;
        };

        const getState = () => {
            if (mediaData.series && mediaData.author) {
                return `${mediaData.series} • ${mediaData.author}`;
            }
            return mediaData.author || "AudioBook";
        };

        const timestamps = mediaData.currentTime && mediaData.duration ? {
            start: Date.now() - (mediaData.currentTime * 1000),
            end: Date.now() + ((mediaData.duration - mediaData.currentTime) * 1000)
        } : undefined;

        return {
            application_id: applicationId,
            name: "AudioBookShelf",

            details: getDetails(),
            state: getState(),
            assets,
            timestamps,

            type: 2,
            flags: 1,
        };
    }
});
