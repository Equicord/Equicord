/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const panelRegistry = {
    guildBar: {
        id: "guildBar",
        classId: "guild-bar",
        label: "Guild Bar",
        collapsedKey: "guildBarCollapsed",
    },
    channelList: {
        id: "channelList",
        classId: "channel-list",
        label: "Channel List",
        collapsedKey: "channelListCollapsed",
    },
    membersList: {
        id: "membersList",
        classId: "members-list",
        label: "Members List",
        collapsedKey: "membersListCollapsed",
    },
    chatButtons: {
        id: "chatButtons",
        classId: "chat-buttons",
        label: "Message Buttons",
        collapsedKey: "chatButtonsCollapsed",
    },
    titleBar: {
        id: "titleBar",
        classId: "title-bar",
        label: "Title Bar",
        collapsedKey: "titleBarCollapsed",
    },
    headerBar: {
        id: "headerBar",
        classId: "header-bar",
        label: "Header Bar",
        collapsedKey: "headerBarCollapsed",
    },
    userArea: {
        id: "userArea",
        classId: "user-area",
        label: "User Area",
        collapsedKey: "userAreaCollapsed",
    },
} as const;

export type PanelId = keyof typeof panelRegistry;

export const toolbarPanelOrder = ["guildBar", "channelList", "membersList", "chatButtons", "titleBar", "headerBar", "userArea"] as const satisfies readonly PanelId[];

type CollapseSettingChangeHandler = (panelId: PanelId, collapsed: boolean) => void;

let collapseSettingChangeHandler: CollapseSettingChangeHandler | undefined;

export function setCollapseSettingChangeHandler(handler: CollapseSettingChangeHandler | undefined) {
    collapseSettingChangeHandler = handler;
}

function onCollapseSettingChanged(panelId: PanelId) {
    return (collapsed: boolean) => collapseSettingChangeHandler?.(panelId, collapsed);
}

export const settings = definePluginSettings({
    guildBarCollapsed: {
        type: OptionType.BOOLEAN,
        description: "Persist the guild bar as collapsed.",
        default: false,
        hidden: true,
        onChange: onCollapseSettingChanged("guildBar"),
    },
    channelListCollapsed: {
        type: OptionType.BOOLEAN,
        description: "Persist the channel list as collapsed.",
        default: false,
        hidden: true,
        onChange: onCollapseSettingChanged("channelList"),
    },
    membersListCollapsed: {
        type: OptionType.BOOLEAN,
        description: "Persist the members list as collapsed.",
        default: false,
        hidden: true,
        onChange: onCollapseSettingChanged("membersList"),
    },
    chatButtonsCollapsed: {
        type: OptionType.BOOLEAN,
        description: "Persist the message button row as collapsed.",
        default: false,
        hidden: true,
        onChange: onCollapseSettingChanged("chatButtons"),
    },
    titleBarCollapsed: {
        type: OptionType.BOOLEAN,
        description: "Persist the title bar as collapsed.",
        default: false,
        hidden: true,
        onChange: onCollapseSettingChanged("titleBar"),
    },
    headerBarCollapsed: {
        type: OptionType.BOOLEAN,
        description: "Persist the header bar as collapsed.",
        default: false,
        hidden: true,
        onChange: onCollapseSettingChanged("headerBar"),
    },
    userAreaCollapsed: {
        type: OptionType.BOOLEAN,
        description: "Persist the user area as collapsed.",
        default: false,
        hidden: true,
        onChange: onCollapseSettingChanged("userArea"),
    },
});
