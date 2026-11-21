/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, SettingsStore } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Embed } from "@vencord/discord-types";
import { useState } from "@webpack/common";

interface ToggleableDescriptionProps { embed: Embed, original: () => any; }

const settings = definePluginSettings({
    fixBlockedEmbeds: {
        type: OptionType.BOOLEAN,
        description: "Restore videos blocked from displaying in Discord, for example by UMG",
        default: true,
        restartNeeded: true
    },
    blockAds: {
        type: OptionType.BOOLEAN,
        description: "Blocks ads in YouTube embeds and WatchTogether. Video may take some seconds to load, due to YouTube's anti-ad measures",
        default: true
    },
    youtubeDescription: {
        type: OptionType.BOOLEAN,
        description: "Adds descriptions to youtube video embeds",
        default: false,
        restartNeeded: true
    }
});

const { plugins } = SettingsStore.plain;
const { BetterYouTubeEmbeds, FixYoutubeEmbeds, YoutubeAdblock } = plugins;
if (!BetterYouTubeEmbeds && (FixYoutubeEmbeds?.enabled || YoutubeAdblock?.enabled)) {
    plugins.BetterYouTubeEmbeds = { enabled: true, youtubeDescription: !!FixYoutubeEmbeds?.youtubeDescription };
    SettingsStore.markAsChanged();
}

export default definePlugin({
    name: "BetterYouTubeEmbeds",
    description: "Block ads & bypass UMG blocks",
    tags: ["Media", "Utility"],
    searchTerms: ["YoutubeAdblock", "FixYoutubeEmbeds", "YoutubeDescription"],
    authors: [Devs.coolelectronics, Devs.ImLvna, Devs.Ven, Devs.arHSM],
    isModified: true,
    requiresRestart: true,
    settings,
    patches: [
        {
            find: "this.renderContentPlaceholder({",
            predicate: () => settings.store.youtubeDescription,
            replacement: {
                match: /(\i)=(\i\.\i\.has\((\i)\.type\))\?null:(?:(this\.renderDescription)\(\))/,
                replace: '$1=$3.type==="video"?$self.ToggleableDescriptionWrapper({embed:this.props.embed,original:$4.bind(this)}):($2?null:$4())'
            }
        }
    ],
    ToggleableDescription: ErrorBoundary.wrap(({ embed, original }: ToggleableDescriptionProps) => {
        const [isOpen, setOpen] = useState(false);
        if (!embed.rawDescription) return null;
        if (embed.rawDescription.length <= 20) return original();

        return (
            <div
                style={{ cursor: "pointer", marginTop: isOpen ? "0px" : "8px" }}
                onClick={() => setOpen(o => !o)}
            >
                {isOpen
                    ? original()
                    : embed.rawDescription.substring(0, 20) + "..."}
            </div>
        );
    }),
    ToggleableDescriptionWrapper(props: ToggleableDescriptionProps) {
        return <this.ToggleableDescription {...props} ></this.ToggleableDescription >;
    }
});
