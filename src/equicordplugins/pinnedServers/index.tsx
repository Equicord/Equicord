/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Guild } from "@vencord/discord-types";
import { Menu, React, useMemo, UserStore } from "@webpack/common";

interface GuildNode {
    type: "guild" | "folder";
    id: number | string;
    children?: GuildNode[];
    parentId?: number | string;
    [key: string]: unknown;
}

const SETTINGS_KEYS: (keyof typeof settings.store)[] = ["userBasedPinnedServers"];

export const settings = definePluginSettings({
    userBasedPinnedServers: {
        type: OptionType.CUSTOM,
        default: {} as Record<string, string[]>,
        description: "",
    },
});

function getUserId(): string {
    return UserStore.getCurrentUser()?.id ?? "default";
}

function getPinnedIds(): string[] {
    const userId = getUserId();
    return settings.store.userBasedPinnedServers[userId] ?? [];
}

function updatePinnedIds(pinned: string[]) {
    const userId = getUserId();
    settings.store.userBasedPinnedServers = {
        ...settings.store.userBasedPinnedServers,
        [userId]: pinned,
    };
}

function isPinned(id: string | number, isFolder = false): boolean {
    const key = isFolder ? `folder-${id}` : id.toString();
    return getPinnedIds().includes(key);
}

function pin(id: string | number, isFolder = false) {
    const key = isFolder ? `folder-${id}` : id.toString();
    const current = getPinnedIds();
    if (!current.includes(key)) {
        updatePinnedIds([...current, key]);
    }
}

function unpin(id: string | number, isFolder = false) {
    const key = isFolder ? `folder-${id}` : id.toString();
    const current = getPinnedIds();
    updatePinnedIds(current.filter(i => i !== key));
}

function canMove(id: string | number, delta: number, isFolder = false): boolean {
    const key = isFolder ? `folder-${id}` : id.toString();
    const current = getPinnedIds();
    const index = current.indexOf(key);
    if (index === -1) return false;
    const targetIndex = index + delta;
    return targetIndex >= 0 && targetIndex < current.length;
}

function movePinned(id: string | number, delta: number, isFolder = false) {
    const key = isFolder ? `folder-${id}` : id.toString();
    const current = [...getPinnedIds()];
    const index = current.indexOf(key);
    if (index === -1) return;
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= current.length) return;
    const [item] = current.splice(index, 1);
    current.splice(targetIndex, 0, item);
    updatePinnedIds(current);
}

function reorderGuildsTree(guilds: GuildNode[], pinnedIds: string[]): GuildNode[] {
    if (!pinnedIds.length) return guilds;

    const pinnedMap = new Map<string, GuildNode>();
    const unpinnedGuilds: GuildNode[] = [];

    for (const node of guilds) {
        const idStr = node.id.toString();
        const folderKey = `folder-${idStr}`;

        if (node.type === "folder") {
            if (pinnedIds.includes(folderKey)) {
                pinnedMap.set(folderKey, node);
            } else {
                const remainingChildren: GuildNode[] = [];
                for (const child of node.children ?? []) {
                    const childIdStr = child.id.toString();
                    if (pinnedIds.includes(childIdStr)) {
                        pinnedMap.set(childIdStr, child);
                    } else {
                        remainingChildren.push(child);
                    }
                }
                if (remainingChildren.length > 0) {
                    unpinnedGuilds.push({ ...node, children: remainingChildren });
                }
            }
        } else if (node.type === "guild") {
            if (pinnedIds.includes(idStr)) {
                pinnedMap.set(idStr, node);
            } else {
                unpinnedGuilds.push(node);
            }
        } else {
            unpinnedGuilds.push(node);
        }
    }

    const orderedPinned: GuildNode[] = [];
    for (const key of pinnedIds) {
        const node = pinnedMap.get(key);
        if (node) {
            orderedPinned.push(node);
        }
    }

    return [...orderedPinned, ...unpinnedGuilds];
}

function makeServerMenuItems(guildId: string) {
    const pinned = isPinned(guildId);
    return (
        <Menu.MenuGroup id="vc-pinned-servers">
            {!pinned && (
                <Menu.MenuItem
                    id="vc-pin-server"
                    label="Pin Server"
                    action={() => pin(guildId)}
                />
            )}
            {pinned && (
                <>
                    <Menu.MenuItem
                        id="vc-unpin-server"
                        label="Unpin Server"
                        color="danger"
                        action={() => unpin(guildId)}
                    />
                    {canMove(guildId, -1) && (
                        <Menu.MenuItem
                            id="vc-pin-server-move-up"
                            label="Move Up"
                            action={() => movePinned(guildId, -1)}
                        />
                    )}
                    {canMove(guildId, 1) && (
                        <Menu.MenuItem
                            id="vc-pin-server-move-down"
                            label="Move Down"
                            action={() => movePinned(guildId, 1)}
                        />
                    )}
                </>
            )}
        </Menu.MenuGroup>
    );
}

function makeFolderMenuItems(folderId: number | string) {
    const pinned = isPinned(folderId, true);
    return (
        <Menu.MenuGroup id="vc-pinned-folders">
            {!pinned && (
                <Menu.MenuItem
                    id="vc-pin-folder"
                    label="Pin Folder"
                    action={() => pin(folderId, true)}
                />
            )}
            {pinned && (
                <>
                    <Menu.MenuItem
                        id="vc-unpin-folder"
                        label="Unpin Folder"
                        color="danger"
                        action={() => unpin(folderId, true)}
                    />
                    {canMove(folderId, -1, true) && (
                        <Menu.MenuItem
                            id="vc-pin-folder-move-up"
                            label="Move Up"
                            action={() => movePinned(folderId, -1, true)}
                        />
                    )}
                    {canMove(folderId, 1, true) && (
                        <Menu.MenuItem
                            id="vc-pin-folder-move-down"
                            label="Move Down"
                            action={() => movePinned(folderId, 1, true)}
                        />
                    )}
                </>
            )}
        </Menu.MenuGroup>
    );
}

const GuildContextPatch: NavContextMenuPatchCallback = (children, props: { guild?: Guild; }) => {
    if (!props?.guild?.id) return;
    const group = findGroupChildrenByChildId("privacy", children)
        ?? findGroupChildrenByChildId("mark-guild-read", children);

    if (group) {
        group.push(makeServerMenuItems(props.guild.id));
    } else {
        children.push(makeServerMenuItems(props.guild.id));
    }
};

export default definePlugin({
    name: "PinnedServers",
    description: "Allows you to pin servers and folders to the top of your server list by right clicking them.",
    tags: ["Servers", "Organisation", "Utility"],
    authors: [EquicordDevs.tt],
    searchTerms: ["pin", "guild", "server", "folder", "top"],
    settings,

    contextMenus: {
        "guild-context": (children, props: { guild?: Guild; folderId?: number; }) => {
            if (props?.guild) {
                GuildContextPatch(children, props);
            } else if (props?.folderId != null) {
                children.push(makeFolderMenuItems(props.folderId));
            }
        },
        "guild-header-popout": GuildContextPatch,
    },

    patches: [
        {
            find: '("guildsnav")',
            replacement: [
                {
                    match: /(\i)(\.map\(.{0,30}\}\),\i)/,
                    replace: "$self.useReorderedGuilds($1)$2"
                }
            ]
        }
    ],

    useReorderedGuilds(guilds: GuildNode[]): GuildNode[] {
        settings.use(SETTINGS_KEYS);
        const pinnedIds = getPinnedIds();
        return useMemo(() => reorderGuildsTree(guilds, pinnedIds), [guilds, pinnedIds]);
    }
});
