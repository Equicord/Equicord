/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { HeadingSecondary } from "@components/Heading";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";
import { Activity, ActivityAssets, ActivityButton } from "@vencord/discord-types";
import { ActivityFlags, ActivityType } from "@vencord/discord-types/enums";
import { findByPropsLazy } from "@webpack";
import { ApplicationAssetUtils, FluxDispatcher } from "@webpack/common";

interface TrackData {
    name: string;
    album: string;
    artist: string;
    durationMs?: number;
    recordingMBID?: string;
    url: string;
    imageUrl?: string;
}

const enum NameFormat {
    StatusName = "status-name",
    ArtistFirst = "artist-first",
    SongFirst = "song-first",
    ArtistOnly = "artist",
    SongOnly = "song",
    AlbumName = "album",
}

const applicationId = "1090155131007406132";
const placeholderId = "2a96cbd8b46e442fc41c2b86b821562f";

const logger = new Logger("ListenBrainzRPC");

const PresenceStore = findByPropsLazy("getLocalPresence");

let updateInterval: NodeJS.Timeout | undefined;

async function getApplicationAsset(key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(applicationId, [key]))[0];
}

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "ListenBrainz",
    });
}

const settings = definePluginSettings({
    username: {
        description: t("listenBrainzRPC.settings.username"),
        type: OptionType.STRING,
    },
    mbContact: {
        description: t("listenBrainzRPC.settings.mbContact"),
        type: OptionType.STRING,
    },
    shareUsername: {
        description: t("listenBrainzRPC.settings.shareUsername"),
        type: OptionType.BOOLEAN,
        default: false,
    },
    shareSong: {
        description: t("listenBrainzRPC.settings.shareSong"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    hideWithSpotify: {
        description: t("listenBrainzRPC.settings.hideWithSpotify"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    hideWithActivity: {
        description: t("listenBrainzRPC.settings.hideWithActivity"),
        type: OptionType.BOOLEAN,
        default: false,
    },
    useTimeBar: {
        description: t("listenBrainzRPC.settings.useTimeBar"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    statusName: {
        description: t("listenBrainzRPC.settings.statusName"),
        type: OptionType.STRING,
        default: t("listenBrainzRPC.defaults.statusName"),
    },
    nameFormat: {
        description: t("listenBrainzRPC.settings.nameFormat"),
        type: OptionType.SELECT,
        options: [
            {
                label: t("listenBrainzRPC.nameFormatOptions.customStatus"),
                value: NameFormat.StatusName,
                default: true,
            },
            {
                label: t("listenBrainzRPC.nameFormatOptions.artistFirst"),
                value: NameFormat.ArtistFirst,
            },
            {
                label: t("listenBrainzRPC.nameFormatOptions.songFirst"),
                value: NameFormat.SongFirst,
            },
            {
                label: t("listenBrainzRPC.nameFormatOptions.artistOnly"),
                value: NameFormat.ArtistOnly,
            },
            {
                label: t("listenBrainzRPC.nameFormatOptions.songOnly"),
                value: NameFormat.SongOnly,
            },
            {
                label: t("listenBrainzRPC.nameFormatOptions.albumName"),
                value: NameFormat.AlbumName,
            },
        ],
    },
    useListeningStatus: {
        description: t("listenBrainzRPC.settings.useListeningStatus"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    missingArt: {
        description: t("listenBrainzRPC.settings.missingArt"),
        type: OptionType.SELECT,
        options: [
            {
                label: t("listenBrainzRPC.missingArtOptions.listenbrainzLogo"),
                value: "listenbrainzLogo",
                default: true,
            },
            {
                label: t("listenBrainzRPC.missingArtOptions.placeholder"),
                value: "placeholder",
            },
        ],
    },
    useLogo: {
        description: t("listenBrainzRPC.settings.useLogo"),
        type: OptionType.BOOLEAN,
        default: true,
    },
});

var currentRecordingMBID = "";
var currentStart = 0;

export default definePlugin({
    name: "ListenBrainzRPC",
    description: t("listenBrainzRPC.description"),
    authors: [EquicordDevs.qouesm],

    settingsAboutComponent: () => (
        <>
            <HeadingSecondary>{t("listenBrainzRPC.about.title")}</HeadingSecondary>
            <Paragraph>
                {t("listenBrainzRPC.about.description")}
                <Link href="https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting#Provide_meaningful_User-Agent_strings">
                    {" "}
                    {t("listenBrainzRPC.about.description").split("meaningful user-agent string")[1]?.trim() || ""}
                </Link>{" "}
                . For most, an email address should suffice.
            </Paragraph>
        </>
    ),

    settings,

    start() {
        this.updatePresence();
        updateInterval = setInterval(() => {
            this.updatePresence();
        }, 16000);
    },

    stop() {
        clearInterval(updateInterval);
        updateInterval = undefined;
    },

    async fetchTrackData(): Promise<TrackData | null> {
        if (!settings.store.username) return null;

        try {
            const lbRes = await fetch(
                `https://api.listenbrainz.org/1/user/${settings.store.username}/playing-now`,
            );
            if (!lbRes.ok) throw `${lbRes.status} ${lbRes.statusText}`;

            const lbJson = await lbRes.json();
            if (lbJson.error) {
                logger.error(
                    "Error from ListenBrainz API",
                    `${lbJson.error}: ${lbJson.message}`,
                );
                return null;
            }

            const listen = lbJson.payload?.listens?.[0];
            if (!listen?.playing_now) return null;

            const trackMetadata = listen.track_metadata;
            const albumName = trackMetadata.release_name || "Unknown";
            const artistName = trackMetadata.artist_name || "Unknown";

            const mbRes = await fetch(`https://musicbrainz.org/ws/2/release/?query=release:${encodeURIComponent(albumName)}%20AND%20artist:${encodeURIComponent(artistName)}&fmt=json`,);

            if (!mbRes.ok) throw `${mbRes.status} ${mbRes.statusText}`;

            const mbJson = await mbRes.json();
            const releases = mbJson.releases || [];

            const releaseGroup = releases[0]["release-group"].id;

            const caaRes = await fetch(
                `https://coverartarchive.org/release-group/${releaseGroup}`,
            );
            if (!caaRes.ok) throw `${caaRes.status} ${caaRes.statusText}`;
            const caaJson = await caaRes.json();

            const url: string = caaJson.release;

            const { images } = caaJson;
            let imageUrl: string = "";
            for (const image of images) {
                imageUrl = image.thumbnails.large || "";
                if (!imageUrl) continue;
                break;
            }

            return {
                name: trackMetadata.track_name || "Unknown",
                album: albumName,
                artist: artistName,
                durationMs: trackMetadata.additional_info.duration_ms,
                recordingMBID: trackMetadata.additional_info.recording_mbid,
                url: url,
                imageUrl: imageUrl,
            };
        } catch (e) {
            logger.error("Failed to query ListenBrainz API", e);
            // will clear the rich presence if API fails
            return null;
        }
    },

    async updatePresence() {
        setActivity(await this.getActivity());
    },

    getLargeImage(track: TrackData): string | undefined {
        if (track.imageUrl && !track.imageUrl.includes(placeholderId))
            return track.imageUrl;

        if (settings.store.missingArt === "placeholder") return "placeholder";
    },

    async getActivity(): Promise<Activity | null> {
        if (settings.store.hideWithActivity) {
            if (
                PresenceStore.getActivities().some(
                    a => a.application_id !== applicationId,
                )
            ) {
                return null;
            }
        }

        if (settings.store.hideWithSpotify) {
            if (
                PresenceStore.getActivities().some(
                    a =>
                        a.type === ActivityType.LISTENING &&
                        a.application_id !== applicationId,
                )
            ) {
                // there is already music status because of Spotify or richerCider (probably more)
                return null;
            }
        }

        const trackData = await this.fetchTrackData();
        if (!trackData) return null;

        const largeImage = this.getLargeImage(trackData);
        const assets: ActivityAssets = largeImage
            ? {
                large_image: await getApplicationAsset(largeImage),
                large_text: trackData.album || undefined,
                small_image: settings.store.useLogo
                    ? await getApplicationAsset("listenbrainz")
                    : undefined,
                small_text: "ListenBrainz",
            }
            : {
                large_image: await getApplicationAsset("listenbrainz"),
                large_text: trackData.album || undefined,
            };

        const buttons: ActivityButton[] = [];

        if (settings.store.shareUsername)
            buttons.push({
                label: t("listenBrainzRPC.buttons.profile"),
                url: `https://www.listenbrainz.org/user/${settings.store.username}`,
            });

        if (settings.store.shareSong)
            buttons.push({
                label: t("listenBrainzRPC.buttons.viewSong"),
                url: trackData.url,
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

        if (trackData.recordingMBID && trackData.recordingMBID !== currentRecordingMBID) {
            currentRecordingMBID = trackData.recordingMBID;
            currentStart = Date.now();
        }

        return {
            application_id: applicationId,
            name: statusName,

            details: trackData.name,
            state: trackData.artist,
            assets,

            timestamps: {
                start: settings.store.useTimeBar ? currentStart : undefined,
                end: settings.store.useTimeBar
                    ? currentStart + (trackData.durationMs ?? 0)
                    : undefined,
            },
            buttons: buttons.length ? buttons.map(v => v.label) : undefined,
            metadata: {
                button_urls: buttons.map(v => v.url),
            },

            type: settings.store.useListeningStatus
                ? ActivityType.LISTENING
                : ActivityType.PLAYING,
            flags: ActivityFlags.INSTANCE,
        };
    },
});
