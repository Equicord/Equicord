/*
 * EquicordPlus, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { useEffect } from "@webpack/common";

const hookSetTransceiverEncodingParameters = () => {
    const originalSetParameters = UnifiedConnection.prototype.setTransceiverEncodingParameters;
    UnifiedConnection.prototype.setTransceiverEncodingParameters = function (parameters) {
        if (parameters && parameters.encodings) {
            for (const encoding of parameters.encodings) {
                encoding.maxBitrate = 1329600; // Set this to the desired bitrate (1329.60 kbps)
                encoding.channels = 2; // Enable stereo
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
                channels: 2 // Enable stereo
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
    name: "HQ Sound and Stereo",
    description: "This plugin allows stereo mic and enforcing a higher bitrate.",
    authors: ["Chaython"],
});