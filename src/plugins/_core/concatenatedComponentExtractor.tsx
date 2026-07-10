/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { setColorPicker, setCreateScroller, setNewCustomizationSection } from "@webpack/common";

export default definePlugin({
    name: "ConcatenatedComponentExtractor",
    description: "Extract components that have been concatenated by the bundler",
    authors: [Devs.sadan],
    tags: ["Developers", "Utility"],
    required: true,

    patches: [
        {
            find: "#{intl::USER_SETTINGS_PROFILE_COLOR_SELECT_COLOR}),focusProps:",
            replacement: {
                match: /(?=function (\i)\(\i\)\{let\{onChange:\i,onClose:\i,[^}]+?showEyeDropper:)/,
                replace: "$self.setColorPicker($1);"
            }
        },
        {
            find: /="ltr",orientation:\i="vertical"[^}]+?customTheme:/,
            replacement: {
                match: /(?=function (\i)\(\i,\i,\i\)\{.{0,20}?return \i\.forwardRef\(function\(\i,\i\)\{let\{[^}]+?="ltr",orientation:)/,
                replace: "$self.setCreateScroller($1);"
            }
        },
        {
            find: '("UserProfileModalV2EditingPanel")',
            replacement: [
                {
                    match: /function (\i).{0,50}showNitroIcon:.{0,500}\}\),\i\]\}\)\}/,
                    replace: "$&$self.setNewCustomizationSection($1);"
                }
            ]
        }
    ],

    setCreateScroller,
    setColorPicker,
    setNewCustomizationSection
});
