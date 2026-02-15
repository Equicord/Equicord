/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Sofia Lima
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

import { definePluginSettings } from "@api/Settings";
import { LinkButton } from "@components/Button";
import { Card } from "@components/Card";
import { Heading } from "@components/Heading";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { t, Translate } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";
import { Activity, ActivityAssets, ActivityButton } from "@vencord/discord-types";
import { ActivityFlags, ActivityStatusDisplayType, ActivityType } from "@vencord/discord-types/enums";
import { ApplicationAssetUtils, AuthenticationStore, FluxDispatcher, PresenceStore } from "@webpack/common";

interface TrackData {
    name: string;
    album: string;
    artist: string;
    url: string;
    imageUrl?: string;
}

const enum NameFormat {
    StatusName = "status-name",
    ArtistFirst = "artist-first",
    SongFirst = "song-first",
    ArtistOnly = "artist",
    SongOnly = "song",
    AlbumName = "album"
}

// Last.fm API keys are essentially public information and have no access to your account, so including one here is fine.
const API_KEY = "790c37d90400163a5a5fe00d6ca32ef0";
const DISCORD_APP_ID = "1108588077900898414";
const LASTFM_PLACEHOLDER_IMAGE_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

const logger = new Logger("LastFMRichPresence");

let updateInterval: NodeJS.Timeout | undefined;

async function getApplicationAsset(key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(DISCORD_APP_ID, [key]))[0];
}

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "LastFM",
    });
}

const settings = definePluginSettings({
    apiKey: {
        description: t("lastfmRichPresence.settings.apiKey"),
        type: OptionType.STRING,
    },
    username: {
        description: t("lastfmRichPresence.settings.username"),
        type: OptionType.STRING,
    },
    shareUsername: {
        description: t("lastfmRichPresence.settings.shareUsername"),
        type: OptionType.BOOLEAN,
        default: false,
    },
    clickableLinks: {
        description: t("lastfmRichPresence.settings.clickableLinks"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    hideWithSpotify: {
        description: t("lastfmRichPresence.settings.hideWithSpotify"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    hideWithActivity: {
        description: t("lastfmRichPresence.settings.hideWithActivity"),
        type: OptionType.BOOLEAN,
        default: false,
    },
    statusName: {
        description: t("lastfmRichPresence.settings.statusName"),
        type: OptionType.STRING,
        default: "some music",
    },
    statusDisplayType: {
        description: t("lastfmRichPresence.settings.statusDisplayType"),
        type: OptionType.SELECT,
        options: [
            {
                label: t("lastfmRichPresence.statusDisplayType.off"),
                value: "off"
            },
            {
                label: t("lastfmRichPresence.statusDisplayType.artist"),
                value: "artist",
                default: true
            },
            {
                label: t("lastfmRichPresence.statusDisplayType.track"),
                value: "track"
            }
        ]
    },
    nameFormat: {
        description: t("lastfmRichPresence.settings.nameFormat"),
        type: OptionType.SELECT,
        options: [
            {
                label: t("lastfmRichPresence.nameFormat.statusName"),
                value: NameFormat.StatusName,
                default: true
            },
            {
                label: t("lastfmRichPresence.nameFormat.artistFirst"),
                value: NameFormat.ArtistFirst
            },
            {
                label: t("lastfmRichPresence.nameFormat.songFirst"),
                value: NameFormat.SongFirst
            },
            {
                label: t("lastfmRichPresence.nameFormat.artistOnly"),
                value: NameFormat.ArtistOnly
            },
            {
                label: t("lastfmRichPresence.nameFormat.songOnly"),
                value: NameFormat.SongOnly
            },
            {
                label: t("lastfmRichPresence.nameFormat.albumName"),
                value: NameFormat.AlbumName
            }
        ],
    },
    useListeningStatus: {
        description: t("lastfmRichPresence.settings.useListeningStatus"),
        type: OptionType.BOOLEAN,
        default: false,
    },
    missingArt: {
        description: t("lastfmRichPresence.settings.missingArt"),
        type: OptionType.SELECT,
        options: [
            {
                label: t("lastfmRichPresence.missingArt.lastfmLogo"),
                value: "lastfmLogo",
                default: true
            },
            {
                label: t("lastfmRichPresence.missingArt.placeholder"),
                value: "placeholder"
            }
        ],
    },
    showLastFmLogo: {
        description: t("lastfmRichPresence.settings.showLastFmLogo"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    alwaysHideArt: {
        description: t("lastfmRichPresence.settings.alwaysHideArt"),
        type: OptionType.BOOLEAN,
        default: false,
    },
});

export default definePlugin({
    name: "LastFMRichPresence",
    description: t("lastfmRichPresence.description"),
    authors: [Devs.dzshn, Devs.RuiNtD, Devs.blahajZip, Devs.archeruwu],

    settings,

    settingsAboutComponent() {
        return (
            <Card>
                <Heading tag="h5">{t("lastfmRichPresence.howToCreateApiKey")}</Heading>
                <Paragraph>
                    <Translate i18nKey="lastfmRichPresence.apiKeyInstructions">Set <b>Application name</b> and <b>Application description</b> to anything and leave the rest blank.</Translate>
                </Paragraph>
                <LinkButton size="small" href="https://www.last.fm/api/account/create" className={Margins.top8}>{t("lastfmRichPresence.createApiKey")}</LinkButton>
            </Card>
        );
    },

    start() {
        this.updatePresence();
        updateInterval = setInterval(() => { this.updatePresence(); }, 16000);
    },

    stop() {
        clearInterval(updateInterval);
        updateInterval = undefined;
    },

    async fetchTrackData(): Promise<TrackData | null> {
        if (!settings.store.username)
            return null;

        try {
            const params = new URLSearchParams({
                method: "user.getrecenttracks",
                api_key: settings.store.apiKey || API_KEY,
                user: settings.store.username,
                limit: "1",
                format: "json"
            });

            const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
            if (!res.ok) throw `${res.status} ${res.statusText}`;

            const json = await res.json();
            if (json.error) {
                logger.error("Error from Last.fm API", `${json.error}: ${json.message}`);
                return null;
            }

            const trackData = json.recenttracks?.track[0];

            if (!trackData?.["@attr"]?.nowplaying)
                return null;

            // why does the json api have xml structure
            return {
                name: trackData.name || "Unknown",
                album: trackData.album["#text"],
                artist: trackData.artist["#text"] || "Unknown",
                url: trackData.url,
                imageUrl: trackData.image?.find((x: any) => x.size === "large")?.["#text"]
            };
        } catch (e) {
            logger.error("Failed to query Last.fm API", e);
            // will clear the rich presence if API fails
            return null;
        }
    },

    async updatePresence() {
        setActivity(await this.getActivity());
    },

    getLargeImage(track: TrackData): string | undefined {
        if (!settings.store.alwaysHideArt && track.imageUrl && !track.imageUrl.includes(LASTFM_PLACEHOLDER_IMAGE_HASH))
            return track.imageUrl;

        if (settings.store.missingArt === "placeholder")
            return "placeholder";
    },

    async getActivity(): Promise<Activity | null> {
        if (settings.store.hideWithActivity) {
            if (PresenceStore.getActivities(AuthenticationStore.getId()).some(a => a.application_id !== DISCORD_APP_ID && a.type !== ActivityType.CUSTOM_STATUS)) {
                return null;
            }
        }

        if (settings.store.hideWithSpotify) {
            if (PresenceStore.getActivities(AuthenticationStore.getId()).some(a => a.type === ActivityType.LISTENING && a.application_id !== DISCORD_APP_ID)) {
                // there is already music status because of Spotify or richerCider (probably more)
                return null;
            }
        }

        const trackData = await this.fetchTrackData();
        if (!trackData) return null;

        const largeImage = this.getLargeImage(trackData);
        const assets: ActivityAssets = largeImage ?
            {
                large_image: await getApplicationAsset(largeImage),
                large_text: trackData.album || undefined,
                ...(settings.store.showLastFmLogo && {
                    small_image: await getApplicationAsset("lastfm-small"),
                    small_text: "Last.fm"
                }),
            } : {
                large_image: await getApplicationAsset("lastfm-large"),
                large_text: trackData.album || undefined,
            };

        const buttons: ActivityButton[] = [];

        if (settings.store.shareUsername)
            buttons.push({
                label: t("lastfmRichPresence.lastfmProfile"),
                url: `https://www.last.fm/user/${settings.store.username}`,
            });

        const statusName = (() => {
            switch (settings.store.nameFormat) {
                case NameFormat.ArtistFirst:
                    return trackData.artist + " - " + trackData.name;
                case NameFormat.SongFirst:
                    return trackData.name + " - " + trackData.artist;
                case NameFormat.ArtistOnly:
                    return trackData.artist;
                case NameFormat.SongOnly:
                    return trackData.name;
                case NameFormat.AlbumName:
                    return trackData.album || settings.store.statusName;
                default:
                    return settings.store.statusName;
            }
        })();

        const activity: Activity = {
            application_id: DISCORD_APP_ID,
            name: statusName,

            details: trackData.name,
            state: trackData.artist,
            status_display_type: {
                "off": ActivityStatusDisplayType.NAME,
                "artist": ActivityStatusDisplayType.STATE,
                "track": ActivityStatusDisplayType.DETAILS
            }[settings.store.statusDisplayType],

            assets,

            buttons: buttons.length ? buttons.map(v => v.label) : undefined,
            metadata: {
                button_urls: buttons.map(v => v.url),
            },

            type: settings.store.useListeningStatus ? ActivityType.LISTENING : ActivityType.PLAYING,
            flags: ActivityFlags.INSTANCE,
        };

        if (settings.store.clickableLinks) {
            activity.details_url = trackData.url;
            activity.state_url = `https://www.last.fm/music/${encodeURIComponent(trackData.artist)}`;

            if (trackData.album) {
                activity.assets!.large_url = `https://www.last.fm/music/${encodeURIComponent(trackData.artist)}/${encodeURIComponent(trackData.album)}`;
            }
        }

        return activity;
    }
});
