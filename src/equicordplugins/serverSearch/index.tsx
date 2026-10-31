/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated, camila314, and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addServerListElement, removeServerListElement, ServerListItem, ServerListRenderPosition } from "@api/ServerList";
import { SearchIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

export default definePlugin({
    name: "ServerSearch",
    authors: [EquicordDevs.camila314],
    description: "Navigate your servers better with a quick search button",
    tags: ["Shortcuts", "Servers"],

    renderButton() {
        return (
            <ServerListItem
                id="vc-searchbutton-container"
                icon={SearchIcon}
                tooltip="Search"
                onClick={() => {
                    FluxDispatcher.dispatch({
                        type: "QUICKSWITCHER_SHOW",
                        query: "",
                        queryMode: null
                    });
                }}
            />
        );
    },

    start() {
        addServerListElement(ServerListRenderPosition.Above, this.renderButton);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, this.renderButton);
    }
});
