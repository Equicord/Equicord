/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 feelslove and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    preventCrash: {
        type: OptionType.BOOLEAN,
        description: "Prevent crashes when phone screen/camera is opened",
        default: true,
    },
    logEvents: {
        type: OptionType.BOOLEAN,
        description: "Log crash attempts",
        default: false,
    }
});

export default definePlugin({
    name: "VoiceCrashPreventer",
    description: "Prevents crashes for users with old voice modules when phone screen/camera is opened",
    authors:  [Devs.rz30,],
    settings,

    start() {
        this.patchVoiceModule();
        this.patchScreenShare();
    },

    stop() {
    },

    patchVoiceModule() {
        const originalSetSinkId = HTMLMediaElement.prototype.setSinkId;
        if (originalSetSinkId) {
            HTMLMediaElement.prototype.setSinkId = function (sinkId: string) {
                try {
                    return originalSetSinkId.call(this, sinkId);
                } catch (error: any) {
                    if (settings.store.preventCrash) {
                        console.warn("[VoiceCrashPreventer] setSinkId error prevented:", error);
                        if (settings.store.logEvents) {
                            console.log("Element:", this);
                        }
                        return Promise.resolve();
                    }
                    throw error;
                }
            };
        }
    },

    patchScreenShare() {
        const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia;
        navigator.mediaDevices.getDisplayMedia = function (constraints?: MediaStreamConstraints) {
            try {
                return originalGetDisplayMedia.call(this, constraints);
            } catch (error: any) {
                if (settings.store.preventCrash) {
                    console.warn("[VoiceCrashPreventer] getDisplayMedia error prevented:", error);
                    return Promise.resolve(new MediaStream());
                }
                throw error;
            }
        };

        const originalGetUserMedia = navigator.mediaDevices.getUserMedia;
        navigator.mediaDevices.getUserMedia = function (constraints?: MediaStreamConstraints) {
            try {
                return originalGetUserMedia.call(this, constraints);
            } catch (error: any) {
                if (settings.store.preventCrash && constraints?.video) {
                    console.warn("[VoiceCrashPreventer] getUserMedia video error prevented:", error);
                    if (settings.store.logEvents) {
                        console.log("Constraints:", constraints);
                    }
                    return originalGetUserMedia.call(this, { audio: constraints.audio });
                }
                throw error;
            }
        };
    }
});
