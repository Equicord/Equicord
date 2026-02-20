/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "DownloadButton",
    description: "Adds back Download Button to top right corner of file.",
    authors: [EquicordDevs.omaw],
    patches: [
        {
            find: "[\"VIDEO\",\"CLIP\",\"AUDIO\"]",
            replacement: {
                match: /showDownload:\i,onRemoveItem:(\i\?\i:void 0),isVisualMediaType:(\i)/,
                replace: "showDownload:!0,onRemoveItem:$1,isVisualMediaType:$2"
            }
        }
    ]
});
