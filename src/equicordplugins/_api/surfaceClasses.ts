/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "SurfaceClassesAPI",
    description: "API to add plugin-owned state classes and limited props to stable Discord layout surfaces.",
    authors: [EquicordDevs.benjii],

    patches: [
        {
            find: "CHANNEL_SIDEBAR_RESIZED,{width:",
            replacement: [
                {
                    match: /(?="data-fullscreen":\i)/,
                    replace: '...Vencord.Api.SurfaceClasses._useSurfaceProps("base"),'
                },
                {
                    match: /"data-collapsed":\i,/,
                    replace: '$&...Vencord.Api.SurfaceClasses._useSurfaceProps("sidebar"),'
                },
                {
                    match: /(let \i=\{)(?=className:)/,
                    replace: '$1...Vencord.Api.SurfaceClasses._useSurfaceProps("channelList"),'
                }
            ]
        },
        {
            find: "--custom-app-panels-height",
            replacement: {
                match: /("AppPanels"\}\);return\(0,\i\.jsx\)\("section",\{)/,
                replace: '$1...Vencord.Api.SurfaceClasses._useSurfaceProps("userArea"),'
            }
        },
        {
            find: "#{intl::GUILDS_BAR_A11Y_LABEL}",
            replacement: {
                match: /(?="aria-label":\i\.intl\.string\(\i\.t#{intl::GUILDS_BAR_A11Y_LABEL}\))/,
                replace: '...Vencord.Api.SurfaceClasses._useSurfaceProps("guildBar"),'
            }
        },
        {
            find: "#{intl::MEMBERS_LIST_LANDMARK_LABEL}",
            replacement: {
                match: /(?="aria-labelledby":)/,
                replace: '...(Vencord.Api.SurfaceClasses._trackSurfaceInstance("membersList",this),Vencord.Api.SurfaceClasses._getSurfaceProps("membersList")),'
            }
        },
        {
            find: '"data-window-chrome":"true"',
            replacement: {
                match: /(?="data-window-chrome":"true")/,
                replace: '...Vencord.Api.SurfaceClasses._useSurfaceProps("headerBar"),'
            }
        },
        {
            // Cant find a better one for channel title toolbar button.
            // matches against one module.
            find: /badgePosition:\i="bottom",color:\i,foreground:\i,background:\i,icon:\i,iconSize:\i=24/,
            replacement: {
                match: /return\(0,(\i)\.jsx\)\("section",\{/,
                replace: 'return(0,$1.jsx)("section",{...Vencord.Api.SurfaceClasses._useSurfaceProps("titleBar"),'
            }
        }
    ]
});
