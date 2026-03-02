/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { migratePluginSettings } from "@api/Settings";
import { Devs, EquicordDevs } from "@utils/constants";
import { getIntlMessage, insertTextIntoChatInputBox, openUserProfile } from "@utils/discord";
import { NoopComponent } from "@utils/react";
import definePlugin from "@utils/types";
import { Channel, Message } from "@vencord/discord-types";
import { filters, findByCodeLazy, waitFor } from "@webpack";
import { ChannelStore, ContextMenuApi, Menu, UserStore } from "@webpack/common";

const useMessageMenu = findByCodeLazy(".MESSAGE,commandTargetId:");

let CopyIdMenuItem: (props: { id: string; label: string; }) => React.ReactElement | null = NoopComponent;
waitFor(filters.componentByCode('"cannot copy null text"'), m => CopyIdMenuItem = m);

function MessageMenu({ message, channel, onHeightUpdate }: {
    message: Message;
    channel: Channel;
    onHeightUpdate: (...args: unknown[]) => void;
}) {
    const canReport = message.author &&
        !(message.author.id === UserStore.getCurrentUser().id || message.author.system);

    return useMessageMenu({
        navId: "message-actions",
        ariaLabel: getIntlMessage("MESSAGE_UTILITIES_A11Y_LABEL"),
        message,
        channel,
        canReport,
        onHeightUpdate,
        onClose: () => ContextMenuApi.closeContextMenu(),

        textSelection: "",
        favoriteableType: null,
        favoriteableId: null,
        favoriteableName: null,
        itemHref: void 0,
        itemSrc: void 0,
        itemSafeSrc: void 0,
        itemTextContent: void 0,

        isFullSearchContextMenu: true
    });
}

const contextMenuPatch: NavContextMenuPatchCallback = (children, props: { message: Message; isFullSearchContextMenu?: boolean; }) => {
    if (props?.isFullSearchContextMenu == null) return;
    const { author } = props.message;
    if (!author) return;

    children.unshift(
        <Menu.MenuGroup id="vc-full-search-context-user-actions">
            <Menu.MenuItem
                id="vc-full-search-context-profile"
                label="Profile"
                action={() => void openUserProfile(author.id)}
            />
            <Menu.MenuItem
                id="vc-full-search-context-mention"
                label="Mention"
                action={() => insertTextIntoChatInputBox(`<@${author.id}> `)}
            />
        </Menu.MenuGroup>
    );

    findGroupChildrenByChildId("devmode-copy-id", children, true)
        ?.push(CopyIdMenuItem({ id: author.id, label: getIntlMessage("COPY_ID_AUTHOR") }));
};

migratePluginSettings("FullSearchContext", "SearchReply");
export default definePlugin({
    name: "FullSearchContext",
    description: "Makes the message context menu in message search results have all options you'd expect",
    authors: [Devs.Ven, Devs.Aria, EquicordDevs.omaw],
    requiresRestart: true,
    isModified: true,
    patches: [
        {
            find: "onClick:this.handleMessageClick,",
            replacement: [
                {
                    match: /this(?=\.handleContextMenu\(\i,\i\))/,
                    replace: "$self"
                }
            ]
        },
        {
            find: "renderJumpButton(){",
            replacement: {
                match: /className:\i\.\i,message:(\i),channel:\i/,
                replace: "$&,onContextMenu:e=>$self.handleContextMenu(e,$1)"
            }
        },
        {
            find: "listName:\"recents\"",
            replacement: {
                match: /message:(\i),channel:\i,className:\i\.\i/,
                replace: "$&,onContextMenu:e=>$self.handleContextMenu(e,$1)"
            }
        },
        {
            find: "location:\"NotificationsInboxMessageUnit\"",
            replacement: {
                match: /onContextMenu:\i=>\{\i\.preventDefault\(\),[\s\S]{0,180}?interactionType:\i\.\i\.CONTEXT_MENU,message:(\i),viewId:\i\}[\s\S]{0,320}?disableClickTrap:!0\}\)\}/,
                replace: "onContextMenu:e=>$self.handleContextMenu(e,$1)"
            }
        }
    ],

    handleContextMenu(event: React.MouseEvent, message: Message) {
        const channel = ChannelStore.getChannel(message.channel_id);
        if (!channel) return;

        event.stopPropagation();

        ContextMenuApi.openContextMenu(event, contextMenuProps => (
            <MessageMenu message={message} channel={channel} onHeightUpdate={contextMenuProps.onHeightUpdate} />
        ));
    },

    contextMenus: {
        "message-actions": contextMenuPatch
    }
});
