/*
 * EquicordPlus, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin, { OptionType } from "@utils/types";
import { useEffect } from "@webpack/common";
import { Devs } from "@utils/constants";
import { definePluginSettings } from "@api/Settings";

const settings = definePluginSettings({
    enableStereo: {
        type: OptionType.BOOLEAN,
        description: "Enable stereo audio",
        default: true,
        restartNeeded: true,
    },
    bitrate: {
        type: OptionType.STRING,
        description: "Set the audio bitrate (e.g., 1329600 for 1329.60 kbps)",
        default: "1329600",
        onChange: (value) => {
            if (!/^\d+$/.test(value)) {
                settings.store.bitrate = "1329600"; // reset to default if invalid
            }
        },
    },
});

const hookSetTransceiverEncodingParameters = () => {
    const originalSetParameters = UnifiedConnection.prototype.setTransceiverEncodingParameters;
    UnifiedConnection.prototype.setTransceiverEncodingParameters = function (parameters) {
        if (parameters && parameters.encodings) {
            for (const encoding of parameters.encodings) {
                encoding.maxBitrate = parseInt(settings.store.bitrate, 10); // Set bitrate from settings
                encoding.channels = settings.store.enableStereo ? 2 : 1; // Toggle stereo or mono
            }
        }
        return originalSetParameters.apply(this, arguments);
    };
};

const hookSetTransportOptions = () => {
    const originalSetTransportOptions = RTCRtpSender.prototype.setTransportOptions;
    RTCRtpSender.prototype.setTransportOptions = function (options) {
        if (options && options.audio && options.audio.transportOptions) {
            options.audio.transportOptions.encodingParams = {
                channels: settings.store.enableStereo ? 2 : 1 // Toggle stereo or mono
            };
        }
        return originalSetTransportOptions.apply(this, arguments);
    };
};

const init = () => {
    hookSetTransceiverEncodingParameters();
    hookSetTransportOptions();
};

window.addEventListener('load', init);

export default definePlugin({
    name: "HQ Stereo Mic",
    description: "This plugin allows stereo mic and enforcing a higher bitrate.",
    authors: [{ name: "Chaython", id: 799911395797893120n }],
settings,
});
