/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Paragraph } from "@components/Paragraph";
import { Devs, IS_MAC } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { OptionType, PluginNative, ReporterTestable } from "@utils/types";
import { Activity, ActivityAssets, ActivityButton } from "@vencord/discord-types";
import { ActivityFlags, ActivityStatusDisplayType, ActivityType } from "@vencord/discord-types/enums";
import { ApplicationAssetUtils, FluxDispatcher } from "@webpack/common";

const Native = VencordNative.pluginHelpers.AppleMusicRichPresence as PluginNative<typeof import("./native")>;

export interface TrackData {
    name: string;
    album?: string;
    artist?: string;

    appleMusicLink?: string;
    songLink?: string;

    albumArtwork?: string;
    artistArtwork?: string;

    playerPosition?: number;
    duration?: number;
}

const enum AssetImageType {
    Album = "Album",
    Artist = "Artist",
    Disabled = "Disabled"
}

const applicationId = "1239490006054207550";

let updateInterval: NodeJS.Timeout | undefined;

function setActivity(activity: Activity | null) {
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        activity,
        socketId: "AppleMusic",
    });
}

const settings = definePluginSettings({
    activityType: {
        type: OptionType.SELECT,
        description: t("appleMusicRichPresence.settings.activityType"),
        options: [
            { label: t("appleMusicRichPresence.activityTypes.playing"), value: ActivityType.PLAYING, default: true },
            { label: t("appleMusicRichPresence.activityTypes.listening"), value: ActivityType.LISTENING }
        ],
    },
    statusDisplayType: {
        description: t("appleMusicRichPresence.settings.statusDisplayType"),
        type: OptionType.SELECT,
        options: [
            {
                label: t("appleMusicRichPresence.statusDisplayTypes.off"),
                value: "off",
                default: true
            },
            {
                label: t("appleMusicRichPresence.statusDisplayTypes.artist"),
                value: "artist"
            },
            {
                label: t("appleMusicRichPresence.statusDisplayTypes.track"),
                value: "track"
            }
        ]
    },
    refreshInterval: {
        type: OptionType.SLIDER,
        description: t("appleMusicRichPresence.settings.refreshInterval"),
        markers: [1, 2, 2.5, 3, 5, 10, 15],
        default: 5,
        restartNeeded: true,
    },
    enableTimestamps: {
        type: OptionType.BOOLEAN,
        description: t("appleMusicRichPresence.settings.enableTimestamps"),
        default: true,
    },
    enableButtons: {
        type: OptionType.BOOLEAN,
        description: t("appleMusicRichPresence.settings.enableButtons"),
        default: true,
    },
    nameString: {
        type: OptionType.STRING,
        description: t("appleMusicRichPresence.settings.nameString"),
        default: t("appleMusicRichPresence.defaultName")
    },
    detailsString: {
        type: OptionType.STRING,
        description: t("appleMusicRichPresence.settings.detailsString"),
        default: t("appleMusicRichPresence.defaultDetails")
    },
    stateString: {
        type: OptionType.STRING,
        description: t("appleMusicRichPresence.settings.stateString"),
        default: t("appleMusicRichPresence.defaultState")
    },
    largeImageType: {
        type: OptionType.SELECT,
        description: t("appleMusicRichPresence.settings.largeImageType"),
        options: [
            { label: t("appleMusicRichPresence.assetImageTypes.album"), value: AssetImageType.Album, default: true },
            { label: t("appleMusicRichPresence.assetImageTypes.artist"), value: AssetImageType.Artist },
            { label: t("appleMusicRichPresence.assetImageTypes.disabled"), value: AssetImageType.Disabled }
        ],
    },
    largeTextString: {
        type: OptionType.STRING,
        description: t("appleMusicRichPresence.settings.largeTextString"),
        default: t("appleMusicRichPresence.defaultLargeText")
    },
    smallImageType: {
        type: OptionType.SELECT,
        description: t("appleMusicRichPresence.settings.smallImageType"),
        options: [
            { label: t("appleMusicRichPresence.assetImageTypes.album"), value: AssetImageType.Album },
            { label: t("appleMusicRichPresence.assetImageTypes.artist"), value: AssetImageType.Artist, default: true },
            { label: t("appleMusicRichPresence.assetImageTypes.disabled"), value: AssetImageType.Disabled }
        ],
    },
    smallTextString: {
        type: OptionType.STRING,
        description: t("appleMusicRichPresence.settings.smallTextString"),
        default: t("appleMusicRichPresence.defaultSmallText")
    },
});

function customFormat(formatStr: string, data: TrackData) {
    return formatStr
        .replaceAll("{name}", data.name)
        .replaceAll("{album}", data.album ?? "")
        .replaceAll("{artist}", data.artist ?? "");
}

function getImageAsset(type: AssetImageType, data: TrackData) {
    const source = type === AssetImageType.Album
        ? data.albumArtwork
        : data.artistArtwork;

    if (!source) return undefined;

    return ApplicationAssetUtils.fetchAssetIds(applicationId, [source]).then(ids => ids[0]);
}

export default definePlugin({
    name: "AppleMusicRichPresence",
    description: t("appleMusicRichPresence.description"),
    authors: [Devs.RyanCaoDev],
    hidden: !IS_MAC,
    reporterTestable: ReporterTestable.None,

    settingsAboutComponent() {
        return <>
            <Paragraph>
                {t("appleMusicRichPresence.settingsAbout.intro")}{" "}
                <code>{"{name}"}</code> {t("appleMusicRichPresence.settingsAbout.namePlaceholder")}; <code>{"{artist}"}</code> {t("appleMusicRichPresence.settingsAbout.artistPlaceholder")}; and <code>{"{album}"}</code> {t("appleMusicRichPresence.settingsAbout.albumPlaceholder")}
            </Paragraph>
        </>;
    },

    settings,

    start() {
        this.updatePresence();
        updateInterval = setInterval(() => { this.updatePresence(); }, settings.store.refreshInterval * 1000);
    },

    stop() {
        clearInterval(updateInterval);
        updateInterval = undefined;
        FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null });
    },

    updatePresence() {
        this.getActivity().then(activity => { setActivity(activity); });
    },

    async getActivity(): Promise<Activity | null> {
        const trackData = await Native.fetchTrackData();
        if (!trackData) return null;

        const [largeImageAsset, smallImageAsset] = await Promise.all([
            getImageAsset(settings.store.largeImageType, trackData),
            getImageAsset(settings.store.smallImageType, trackData)
        ]);

        const assets: ActivityAssets = {};

        const isRadio = Number.isNaN(trackData.duration) && (trackData.playerPosition === 0);

        if (settings.store.largeImageType !== AssetImageType.Disabled) {
            assets.large_image = largeImageAsset;
            if (!isRadio) assets.large_text = customFormat(settings.store.largeTextString, trackData);
        }

        if (settings.store.smallImageType !== AssetImageType.Disabled) {
            assets.small_image = smallImageAsset;
            if (!isRadio) assets.small_text = customFormat(settings.store.smallTextString, trackData);
        }

        const buttons: ActivityButton[] = [];

        if (settings.store.enableButtons) {
            if (trackData.appleMusicLink)
                buttons.push({
                    label: t("appleMusicRichPresence.buttons.listenOnAppleMusic"),
                    url: trackData.appleMusicLink,
                });

            if (trackData.songLink)
                buttons.push({
                    label: t("appleMusicRichPresence.buttons.viewOnSongLink"),
                    url: trackData.songLink,
                });
        }

        return {
            application_id: applicationId,

            name: customFormat(settings.store.nameString, trackData),
            details: customFormat(settings.store.detailsString, trackData),
            state: isRadio ? undefined : customFormat(settings.store.stateString, trackData),

            timestamps: (trackData.playerPosition && trackData.duration && settings.store.enableTimestamps) ? {
                start: Date.now() - (trackData.playerPosition * 1000),
                end: Date.now() - (trackData.playerPosition * 1000) + (trackData.duration * 1000),
            } : undefined,

            assets,

            buttons: !isRadio && buttons.length ? buttons.map(v => v.label) : undefined,
            metadata: !isRadio && buttons.length ? { button_urls: buttons.map(v => v.url) } : undefined,

            type: settings.store.activityType,
            status_display_type: {
                "off": ActivityStatusDisplayType.NAME,
                "artist": ActivityStatusDisplayType.STATE,
                "track": ActivityStatusDisplayType.DETAILS
            }[settings.store.statusDisplayType],
            flags: ActivityFlags.INSTANCE,
        };
    }
});
