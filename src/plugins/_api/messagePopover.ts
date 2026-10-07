/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "MessagePopoverAPI",
    description: "API to add buttons to message popovers.",
    authors: [Devs.KingFish, Devs.Ven, Devs.Nuckyz],
    patches: [
        {
            find: "#{intl::MESSAGE_UTILITIES_A11Y_LABEL}),children",
            replacement: [
                {
                    // TODO: (\i\.\i|\i) is for stable compat
                    match: /(?<=\]\}\)),(.{0,40}togglePopout:.+?\}\))\]\}\):null,(?<=\((\i\.\i|\i),\{label:.+?:null,(\i)\?\(0,\i\.jsxs?\)\(\i\.Fragment.+?message:(\i).+?)/,
                    replace: (_, ReactButton, ButtonComponent, showReactButton, message) => "" +
                        `]}):null,Vencord.Api.MessagePopover._buildPopoverElements(${ButtonComponent},${message}),${showReactButton}?${ReactButton}:null,`
                },
                {
                    match: /className:(\i\(\)\(\i\.className,)(?=.{0,200}?#{intl::MESSAGE_UTILITIES_A11Y_LABEL})/,
                    replace: 'className:"vc-message-popover "+$1'
                },
                {
                    match: /(?<=#{intl::MESSAGE_UTILITIES_A11Y_LABEL}.{0,30})className:(\i\.innerClassName)/,
                    replace: 'className:$1+" vc-message-popover-bar"'
                },
                {
                    match: /(?<=#{intl::MESSAGE_UTILITIES_A11Y_LABEL}.{0,100})children:(\[\i,\i\])/,
                    replace: "children:Vencord.Api.MessagePopover._wrapPopoverBar($1)"
                }
            ]
        },
        {
            find: 'role:"article",onMouseEnter',
            replacement: {
                match: /(?<=null!=(\i)\?\(0,\i\.jsxs?\)\("div",\{className:)\i\.\i(?=,children:\1\}\))/,
                replace: '$&+" vc-message-popover-slot"'
            }
        }
    ]
});
