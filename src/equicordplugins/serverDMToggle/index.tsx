/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import type { Guild } from "@vencord/discord-types";
import { Menu, UserSettingsActionCreators } from "@webpack/common";

function toggleGuildDMs(guildId: string) {
    UserSettingsActionCreators.PreloadedUserSettingsActionCreators.updateAsync("privacy", (privacy: any) => {
        const ids: string[] = privacy.restrictedGuildIds;
        const index = ids.indexOf(guildId);

        if (index > -1) ids.splice(index, 1);
        else ids.push(guildId);
    });
}

const contextMenuPatch: NavContextMenuPatchCallback = (children, { guild }: { guild: Guild; }) => {
    if (!guild) return;

    const group = findGroupChildrenByChildId("privacy", children);
    if (!group) return;

    const restricted = UserSettingsActionCreators.PreloadedUserSettingsActionCreators
        .getCurrentValue().privacy.restrictedGuildIds.includes(guild.id);

    group.push(
        <Menu.MenuCheckboxItem
            id="vc-server-dm-toggle"
            label="Allow DMs from Server"
            checked={!restricted}
            action={() => toggleGuildDMs(guild.id)}
        />
    );
};

export default definePlugin({
    name: "ServerDMToggle",
    description: "Adds a toggle to the server context menu to enable/disable DMs from server members.",
    authors: [EquicordDevs.korzi],
    contextMenus: {
        "guild-context": contextMenuPatch,
        "guild-header-popout": contextMenuPatch
    }
});
