/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RenderSongInfo } from "@equicordplugins/songSpotlight.desktop/lib/ssapi/handlers";
import { Song } from "@equicordplugins/songSpotlight.desktop/lib/ssapi/structs";
import { sid } from "@equicordplugins/songSpotlight.desktop/lib/ssapi/util";
import { PluginNative } from "@utils/types";
import { useEffect, useState } from "@webpack/common";

export function useRender(song: Song) {
    const [failed, setFailed] = useState(false);
    const [render, setRender] = useState<RenderSongInfo | null>(null);

    useEffect(() => {
        setFailed(false);
        setRender(null);
        renderSong(song)
            .catch(() => null)
            .then(info => info ? setRender(info) : setFailed(true));
    }, [sid(song)]);

    return { failed, render };
}

export const { parseLink, renderSong, validateSong, clearCache } = VencordNative.pluginHelpers
    .SongSpotlight as PluginNative<typeof import("./native")>;
