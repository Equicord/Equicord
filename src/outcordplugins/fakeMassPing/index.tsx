/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { OutcordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Constants, Menu, RestAPI } from "@webpack/common";

const channelContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const channelId = props.channel?.id ?? props.user?.id;

    const handleAction = async () => {
        await RestAPI.post({
            url: Constants.Endpoints.MESSAGES(channelId) + "/0/ack",
            body: {
                manual: true,
                mention_count: 4294967295
            }
        });
    };

    children.push(
        <Menu.MenuItem
            id="fk-mass-ping-action"
            label="Fake Mass Ping"
            icon={(iconProps) => (
                <svg
                    {...iconProps}
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="z"
                    stroke="var(--background-floating, #2f3136)"
                >
                    <path
                        d="M9.7 2.89c.18-.07.32-.24.37-.43a2 2 0 0 1 3.86 0c.05.2.19.36.38.43A7 7 0 0 1 19 9.5v2.09c0 .12.05.24.13.33l1.1 1.22a3 3 0 0 1 .77 2.01v.28c0 .67-.34 1.29-.95 1.56-1.31.6-4 1.51-8.05 1.51-4.05 0-6.74-.91-8.05-1.5-.61-.28-.95-.9-.95-1.57v-.28a3 3 0 0 1 .77-2l1.1-1.23a.5.5 0 0 0 .13-.33V9.5a7 7 0 0 1 4.7-6.61ZM9.18 19.84A.16.16 0 0 0 9 20a3 3 0 1 0 6 0c0-.1-.09-.17-.18-.16a24.86 24.86 0 0 1-5.64 0Z"
                    ></path>
                    <circle cx="18" cy="5" r="3" fill="currentColor" stroke="var(--background-floating, #2f3136)"/>
                </svg>
            )}
            action={handleAction}
        />
    );
};

export default definePlugin({
    name: "FakeMassPing",
    description: "Affiche beaucoup de mentions dans un salon/dm. Marche pour tous les appareils. Relancer pour réinitialiser.",
    authors: [OutcordDevs.Out],
    contextMenus: {
        "channel-context": channelContextMenuPatch,
        "user-context": channelContextMenuPatch,
        "gdm-context": channelContextMenuPatch
    }
});
