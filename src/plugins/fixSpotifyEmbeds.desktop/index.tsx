/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/translation";
import definePlugin, { makeRange, OptionType } from "@utils/types";

const settings = definePluginSettings({
    volume: {
        type: OptionType.SLIDER,
        description: t("vencord.fixSpotifyEmbeds.settings.volume"),
        markers: makeRange(0, 100, 10),
        stickToMarkers: false,
        default: 10
    }
});

export default definePlugin({
    name: "FixSpotifyEmbeds",
    description: t("vencord.fixSpotifyEmbeds.description"),
    authors: [Devs.Ven],
    settings,
});
