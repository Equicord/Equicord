/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import betterUserArea from "@equicordplugins/betterUserArea";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findCssClassesLazy } from "@webpack";

const { iconForeground } = findCssClassesLazy("iconForeground", "autocompleteRowContent");

export default definePlugin({
    name: "UserAreaAPI",
    description: "API to add buttons to the user area panel.",
    authors: [EquicordDevs.Prism],

    patches: [
        {
            find: "#{intl::ACCOUNT_SPEAKING_WHILE_MUTED}",
            replacement: {
                match: /(?<=className:(\i)\.\i,style:\i,)children:\[/,
                replace: "children:[...$self.renderButtons(arguments[0],$1),"
            }
        }
    ],

    renderButtons(props: { nameplate?: any; }) {
        return Vencord.Api.UserArea._renderButtons({
            nameplate: props.nameplate,
            iconForeground: props.nameplate != null ? iconForeground : void 0,
            hideTooltips: this.shouldHideTooltips()
        });
    },

    shouldHideTooltips() {
        return isPluginEnabled(betterUserArea.name) && betterUserArea.settings.store.removeButtonTooltips;
    }
});
