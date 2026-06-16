/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { _openGifPickerContextMenu } from "@api/GifPickerContextMenu";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "ExtraContextMenusAPI",
    description: "API that adds more context menus to patch.",
    authors: [EquicordDevs.thororen],
    required: true,

    patches: [
        {
            find: "renderEmptyFavorite",
            replacement: {
                match: /render\(\){.{1,500}onClick:this\.handleClick,/,
                replace: "$&onContextMenu: (e) => $self.openContextMenu(e, this),"
            }
        }
    ],

    openContextMenu(e: React.MouseEvent, instance) {
        if (!instance) return;
        _openGifPickerContextMenu(e, instance);
    },
});
