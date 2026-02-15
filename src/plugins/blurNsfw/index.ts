/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { managedStyleRootNode } from "@api/Styles";
import { Devs } from "@utils/constants";
import { createAndAppendStyle } from "@utils/css";
import { t } from "@utils/translation";
import definePlugin, { OptionType } from "@utils/types";

let style: HTMLStyleElement;

function setCss() {
    style.textContent = `
        .vc-nsfw-img [class*=imageContainer],
        .vc-nsfw-img [class*=wrapperPaused] {
            filter: blur(${settings.store.blurAmount}px);
            transition: filter 0.2s;

            &:hover {
                filter: blur(0);
            }
        }
        `;
}

const settings = definePluginSettings({
    blurAmount: {
        type: OptionType.NUMBER,
        description: t("blurNsfw.settings.blurAmount"),
        default: 10,
        onChange: setCss
    },
    blurAllChannels: {
        type: OptionType.BOOLEAN,
        description: t("blurNsfw.settings.blurAllChannels"),
        default: false
    },
});

export default definePlugin({
    name: "BlurNSFW",
    description: t("blurNsfw.description"),
    authors: [Devs.Ven],
    isModified: true,
    settings,

    patches: [
        {
            find: "}renderStickersAccessories(",
            replacement: [
                {
                    match: /(\.renderReactions\(\i\).+?className:)/,
                    replace: '$&(this.props?.channel?.nsfw || $self.settings.store.blurAllChannels ? "vc-nsfw-img ": "")+'
                }
            ]
        }
    ],

    start() {
        style = createAndAppendStyle("VcBlurNsfw", managedStyleRootNode);

        setCss();
    },

    stop() {
        style?.remove();
    }
});
