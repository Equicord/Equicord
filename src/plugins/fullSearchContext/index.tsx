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
const INTERACTIVE_CONTEXT_MENU_SELECTOR = "button, [contenteditable='true']";

let CopyIdMenuItem: (props: { id: string; label: string; }) => React.ReactElement | null = NoopComponent;
waitFor(filters.componentByCode('"cannot copy null text"'), m => CopyIdMenuItem = m);

interface MessageMenuTargetInfo {
    itemHref?: string;
    itemSrc?: string;
    itemSafeSrc?: string;
    itemTextContent?: string;
}

function MessageMenu({ message, channel, onHeightUpdate, targetInfo }: {
    message: Message;
    channel: Channel;
    onHeightUpdate: (...args: unknown[]) => void;
    targetInfo: MessageMenuTargetInfo;
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
        itemHref: targetInfo.itemHref,
        itemSrc: targetInfo.itemSrc,
        itemSafeSrc: targetInfo.itemSafeSrc,
        itemTextContent: targetInfo.itemTextContent,

        isFullSearchContextMenu: true
    });
}

const contextMenuPatch: NavContextMenuPatchCallback = (children, props: { message: Message; isFullSearchContextMenu?: boolean; }) => {
    if (props?.isFullSearchContextMenu == null) return;
    const author = props.message.author;
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
                    match: /handleContextMenu=\((\i),(\i)\)=>\{/,
                    replace: "handleContextMenu=($1,$2)=>{if($self.shouldUseNativeContextMenu($1))return;"
                },
                {
                    match: /message:(\i),channel:\i,onContextMenu:\i=>this\.handleContextMenu\(\i,\1\),animateAvatar:!1/,
                    replace: "$&,onClickCapture:t=>$self.handlePreviewNameClick(t,$1)"
                },
                {
                    match: /handleMessageClick=(\i)=>\{/,
                    replace: "handleMessageClick=$1=>{if($self.handlePreviewNameClick($1,this.props.message))return;"
                },
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
                replace: "$&,onContextMenu:e=>$self.handleContextMenu(e,$1),onClickCapture:ev=>$self.handlePreviewNameClick(ev,$1)"
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

        const targetInfo = this.getMessageMenuTargetInfo(event);
        event.stopPropagation();

        ContextMenuApi.openContextMenu(event, contextMenuProps => (
            <MessageMenu message={message} channel={channel} onHeightUpdate={contextMenuProps.onHeightUpdate} targetInfo={targetInfo} />
        ));
    },

    handlePreviewNameClick(event: React.MouseEvent, message?: Message | null): boolean {
        if (!message?.author || !this.isAuthorLabelTarget(event)) return false;
        if (event.button !== 0) return false;

        if (event.currentTarget instanceof Node && !event.currentTarget.ownerDocument.getSelection()?.isCollapsed) return false;

        event.preventDefault();
        event.stopPropagation();
        void openUserProfile(message.author.id);
        return true;
    },

    shouldUseNativeContextMenu(event: React.MouseEvent): boolean {
        if (this.isAuthorLabelTarget(event)) return true;

        const target = event.target;
        if (!(target instanceof Element)) return false;

        return target.closest(INTERACTIVE_CONTEXT_MENU_SELECTOR) != null ||
            this.getComposedPathElements(event).some(node => node.matches(INTERACTIVE_CONTEXT_MENU_SELECTOR));
    },

    getMessageMenuTargetInfo(event: React.MouseEvent): MessageMenuTargetInfo {
        const target = event.target;
        if (!(target instanceof Element)) return {};

        let itemHref: string | undefined;
        let itemSrc: string | undefined;
        let itemSafeSrc: string | undefined;

        const stopAt = event.currentTarget instanceof Element ? event.currentTarget : null;
        let node: Node | null = target;

        while (node instanceof Element) {
            if (node instanceof HTMLImageElement && node.src) {
                itemSrc ??= node.src;
                itemSafeSrc ??= node.getAttribute("data-safe-src") ?? node.src;
            }

            if (node instanceof HTMLVideoElement || node instanceof HTMLAudioElement) {
                itemSrc ??= node.currentSrc || node.src || undefined;
                itemSafeSrc ??= node.getAttribute("data-safe-src") ?? itemSrc;
            }

            if (node instanceof HTMLAnchorElement && node.href) {
                itemHref ??= node.href;
            }

            itemSrc ??= node.getAttribute("src") ?? undefined;
            itemSafeSrc ??= node.getAttribute("data-safe-src") ?? itemSafeSrc;
            itemHref ??= node.getAttribute("href") ?? undefined;

            if (stopAt && node === stopAt) break;
            node = node.parentNode;
        }

        return { itemHref, itemSrc, itemSafeSrc: itemSafeSrc ?? itemSrc, itemTextContent: target.textContent?.trim() || undefined };
    },

    getComposedPathElements(event: React.MouseEvent): Element[] {
        const nativeEvent = event.nativeEvent as MouseEvent & { composedPath?: () => EventTarget[]; };
        return (typeof nativeEvent.composedPath === "function" ? nativeEvent.composedPath() : [])
            .filter((node): node is Element => node instanceof Element);
    },

    isAuthorLabelTarget(event: React.MouseEvent): boolean {
        const target = event.target;
        if (!(target instanceof Element)) return false;

        const candidates = [
            ...(event.currentTarget instanceof Element ? [event.currentTarget] : []),
            ...this.getComposedPathElements(event)
        ];

        for (const owner of candidates) {
            const labelledBy = owner.getAttribute("aria-labelledby");
            if (!labelledBy) continue;

            for (const id of labelledBy.split(/\s+/)) {
                if (!id) continue;
                const labelElement = owner.ownerDocument.getElementById(id);
                if (labelElement && (labelElement === target || labelElement.contains(target))) {
                    return true;
                }
            }
        }

        return false;
    },

    contextMenus: {
        "message-actions": contextMenuPatch
    }
});