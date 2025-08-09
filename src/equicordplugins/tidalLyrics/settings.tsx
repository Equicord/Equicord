/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { SliderSetting } from "@components/settings/tabs/plugins/components/SliderSetting";
import { makeRange, OptionType } from "@utils/types";

import { Lyrics } from "./components/lyrics";

const sliderOptions = {
    markers: makeRange(-2500, 2500, 250),
    stickToMarkers: true,
};

const settings = definePluginSettings({
    ShowMusicNoteOnNoLyrics: {
        description: "Show a music note icon when no lyrics are found",
        type: OptionType.BOOLEAN,
        default: true,
    },
    LyricsPosition: {
        description: "Position of the lyrics",
        type: OptionType.SELECT,
        options: [
            { value: "above", label: "Above TidalControls" },
            { value: "below", label: "Below TidalControls", default: true },
        ],
    },
    ShowFailedToasts: {
        description: "Hide toasts when lyrics fail to fetch",
        type: OptionType.BOOLEAN,
        default: true,
    },
    LyricDelay: {
        description: "",
        type: OptionType.SLIDER,
        default: 0,
        hidden: true,
        ...sliderOptions
    },
    SyncMode: {
        description: "Lyrics sync mode",
        type: OptionType.SELECT,
        options: [
            { value: "line", label: "Line" },
            { value: "word", label: "Word" },
            { value: "character", label: "Character", default: true },
        ],
        default: "word",
    },
    Display: {
        description: "",
        type: OptionType.COMPONENT,
        component: () => (
            <>
                <SliderSetting
                    option={{ ...sliderOptions } as any}
                    onChange={v => {
                        settings.store.LyricDelay = v;
                    }}
                    pluginSettings={Vencord.Settings.plugins.TidalLyrics}
                    id={"LyricDelay"}
                />
                <Lyrics />
            </>
        )
    },
});

export default settings;
