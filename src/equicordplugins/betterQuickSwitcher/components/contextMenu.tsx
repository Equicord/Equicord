/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Guild, User } from "@vencord/discord-types";
import { ChannelStore, Menu } from "@webpack/common";

import { settings } from "..";
import { type EntityType, getEntityTags, hasAnyTags } from "../utils/tagData";
import { openTagManagementModal } from "./TagManagementModal";

/**
 * Create "Manage Tags" menu item
 */
function createManageTagsMenuItem(
    entityId: string,
    entityType: EntityType,
    entityName: string
) {
    const hasTags = hasAnyTags(entityId);
    const tags = getEntityTags(entityId);

    return (
        <Menu.MenuItem
            id="better-quick-switcher-manage-tags"
            label={hasTags ? `Manage Tags (${tags.length})` : "Manage Tags"}
            action={() => openTagManagementModal(entityId, entityType, entityName)}
        />
    );
}

/**
 * Channel Context Menu (text channels, DMs, group DMs, threads, forums)
 */
export const ChannelContext: NavContextMenuPatchCallback = (children, props) => {
    if (!settings.store.enableTags) return;

    const { channel } = props;
    if (!channel) return;

    let entityType: EntityType;
    let entityName: string;

    switch (channel.type) {
        case 0: // GUILD_TEXT
        case 5: // GUILD_ANNOUNCEMENT
            entityType = "channel";
            entityName = channel.name || "Unknown Channel";
            break;
        case 2: // GUILD_VOICE
        case 13: // GUILD_STAGE_VOICE
            entityType = "voice";
            entityName = channel.name || "Unknown Voice Channel";
            break;
        case 1: // DM
            entityType = "dm";
            entityName = channel.name || "Unknown DM";
            break;
        case 3: // GROUP_DM
            entityType = "groupDm";
            entityName = channel.name || "Group DM";
            break;
        case 10: // ANNOUNCEMENT_THREAD
        case 11: // PUBLIC_THREAD
        case 12: // PRIVATE_THREAD
            const parentChannel = channel.parent_id ? ChannelStore.getChannel(channel.parent_id) : null;
            if (parentChannel?.type === 15) {
                entityType = "forumPost";
                entityName = channel.name || "Unknown Forum Post";
            } else {
                entityType = "thread";
                entityName = channel.name || "Unknown Thread";
            }
            break;
        case 15: // GUILD_FORUM
            entityType = "forum";
            entityName = channel.name || "Unknown Forum";
            break;
        default:
            return;
    }

    const group = findGroupChildrenByChildId("mark-channel-read", children) ?? children;

    group.push(createManageTagsMenuItem(
        channel.id,
        entityType,
        entityName
    ));
};

/**
 * User Context Menu (guild members and DMs)
 */
export const UserContext: NavContextMenuPatchCallback = (children, { user }: { user: User; }) => {
    if (!settings.store.enableTags || !user) return;

    children.push(createManageTagsMenuItem(
        user.id,
        "member",
        user.globalName || user.username || "Unknown User"
    ));
};

/**
 * Guild Context Menu
 */
export const GuildContext: NavContextMenuPatchCallback = (children, { guild }: { guild: Guild; }) => {
    if (!settings.store.enableTags || !guild) return;

    children.push(createManageTagsMenuItem(
        guild.id,
        "guild",
        guild.name || "Unknown Guild"
    ));
};

/**
 * Export context menu patches
 * Maps context menu names to their patch callbacks
 */
export const contextMenus = {
    "channel-context": ChannelContext, // text/voice channels
    "user-context": UserContext, // guild members
    "gdm-context": ChannelContext, // group DMs
    "thread-context": ChannelContext, // threads
    "guild-context": GuildContext,
    "guild-header-popout": GuildContext // alternative guild context menu
};
