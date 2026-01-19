/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, migratePluginSettings, migrateSettingsFromPlugin } from "@api/Settings";
import { Button } from "@components/Button";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import { Activity, SelectOption } from "@vencord/discord-types";
import { openUserSettingsPanel, PresenceStore, UserStore } from "@webpack/common";

migratePluginSettings("ClipsEnhancements", "TimelessClips");
migrateSettingsFromPlugin("ClipsEnhancements", "TimelessClips", "clipLength");

const settings = definePluginSettings({
    richPresenceTagging: {
        type: OptionType.SELECT,
        description: "When should clips be tagged with the current Rich Presence?",
        options: [
            { label: "Always", value: "always" },
            { label: "Only when beginning or end of activity name matches", value: "whenMatched", default: true },
            { label: "Never", value: "never" },
        ]
    },
    clipLength: {
        description: "Custom clip length in minutes",
        type: OptionType.SLIDER,
        markers: makeRange(3, 30, 1),
        default: 5,
        stickToMarkers: true,
    },
    enableScreenshotKeybind: {
        type: OptionType.BOOLEAN,
        description: "Enable the screenshot keybind feature",
        default: true,
        restartNeeded: true
    },
    enableVoiceOnlyClips: {
        type: OptionType.BOOLEAN,
        description: "Enable voice-only clips (audio without video)",
        default: true,
        restartNeeded: true
    },
    enableAdvancedSignals: {
        type: OptionType.BOOLEAN,
        description: "Enable advanced clip signals (auto-clip triggers)",
        default: true,
        restartNeeded: true
    },
    clipsLink: {
        type: OptionType.COMPONENT,
        description: "",
        component: () => {
            return (
                <>
                    <Button
                        onClick={() => {
                            openUserSettingsPanel("clips");
                        }}
                    >
                        Change FPS and duration options in Clips settings!
                    </Button >
                </>
            );
        }
    },
});

export default definePlugin({
    name: "ClipsEnhancements",
    description: "Add more Clip FPS and duration options, custom clip length, RPC tagging and more",
    authors: [Devs.niko, Devs.Joona, EquicordDevs.keyages],
    settings,
    patches: [
        // FPS and duration options
        {
            find: "clips_recording_settings",
            replacement: [
                {
                    match: /\[\{.{0,25}\i.\i.FPS_15.{0,500}\}\]/,
                    replace: "$self.patchFramerates($&)"
                },
                {
                    match: /\[\{.{0,25}\i.\i.SECONDS_30.{0,500}\}\]/,
                    replace: "$self.patchTimeslots($&)"
                },
            ]
        },
        {
            find: "#{intl::CLIPS_UNKNOWN_SOURCE}",
            replacement: {
                match: /(applicationName:)(.{0,50})(,applicationId:)(\i)/,
                replace: "$1$2$3$self.getApplicationId($2)??$4"
            }
        },
        // TimelessClips custom clip length
        {
            find: '"Save clip keybind unset"',
            replacement: {
                match: /\)}](?<={value:.{14,17},label:(.{35,55}:).{3,7})/,
                replace: "$&.concat({value:$self.getClipLength(true),label:$1$self.getClipLength(false)})})"
            }
        },
        // enables clips
        {
            find: "2022-11_clips_experiment",
            replacement: {
                match: /defaultConfig:\{enableClips:!\d,ignorePlatformRestriction:!\d,showClipsHeaderEntrypoint:!\d,enableScreenshotKeybind:!\d,enableVoiceOnlyClips:!\d,enableAdvancedSignals:!\d\}/,
                replace: "defaultConfig:{enableClips:!0,ignorePlatformRestriction:!0,showClipsHeaderEntrypoint:!0,enableScreenshotKeybind:$self.settings.store.enableScreenshotKeybind,enableVoiceOnlyClips:$self.settings.store.enableVoiceOnlyClips,enableAdvancedSignals:$self.settings.store.enableAdvancedSignals}"
            }
        },
        {
            find: "2023-10_viewer_clipping",
            replacement: {
                match: /defaultConfig:\{enableViewerClipping:!\d,ignoreSenderPreference:!\d\}/,
                replace: "defaultConfig:{enableViewerClipping:!0,ignoreSenderPreference:!0}"
            }
        }
    ],

    patchTimeslots(timeslots: SelectOption[]) {
        const newTimeslots = [...timeslots];
        const extraTimeslots = [3, 5, 7, 10, 15, 20, 25, 30];

        extraTimeslots.forEach(timeslot => newTimeslots.push({ value: timeslot * 60000, label: `${timeslot} Minutes` }));

        return newTimeslots;
    },

    patchFramerates(framerates: SelectOption[]) {
        const newFramerates = [...framerates];
        const extraFramerates = [45, 90, 120, 144, 165, 240];

        // Lower framerates than 15FPS have adverse affects on compression, 3 minute clips at 10FPS skyrocket the filesize to 200mb!!
        extraFramerates.forEach(framerate => newFramerates.push({ value: framerate, label: `${framerate}FPS` }));

        return newFramerates.toSorted();
    },

    getApplicationId(activityName: string) {
        if (settings.store.richPresenceTagging === "never") {
            return null;
        }

        const activities: Activity[] = PresenceStore.getActivities(UserStore.getCurrentUser().id);
        const validActivities = activities.filter(activity => activity.type === 0 && activity.application_id !== null);
        const splitName = activityName.split(" ");

        // Try to match activity by it's start and end
        const matchedActivities = validActivities.filter(activity => activity.name.endsWith(splitName.at(-1)!) || activity.name.startsWith(splitName.at(0)!));

        if (matchedActivities.length > 0) {
            return matchedActivities[0].application_id;
        }

        if (settings.store.richPresenceTagging !== "whenMatched") {
            return validActivities[0]?.application_id ?? null;
        }

        return null;
    },

    getClipLength(millis: boolean) {
        const minutes = settings.store.clipLength;
        return millis ? minutes * 6e4 : minutes;
    }
});
