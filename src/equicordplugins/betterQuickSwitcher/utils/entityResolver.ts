/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChannelStore, GuildStore, IconUtils, UserStore } from "@webpack/common";

import { type EntityType } from "./tagData";

export interface ResolvedEntity {
    id: string;
    name: string;
    type: EntityType;
    isDeleted: boolean;
    icon?: string;
}

/**
 * Resolve entity ID to an actual readable name
 * Handles deleted entities gracefully
 */
export function resolveEntityName(entityId: string, entityType: EntityType): ResolvedEntity {
    switch (entityType) {
        case "channel":
        case "voice": {
            const channel = ChannelStore.getChannel(entityId);
            if (!channel) {
                return {
                    id: entityId,
                    name: "Deleted Channel",
                    type: entityType,
                    isDeleted: true
                };
            }
            return {
                id: entityId,
                name: channel.name,
                type: entityType,
                isDeleted: false
            };
        }

        case "member": {
            const user = UserStore.getUser(entityId);
            if (!user) {
                return {
                    id: entityId,
                    name: "Unknown User",
                    type: entityType,
                    isDeleted: true
                };
            }
            return {
                id: entityId,
                name: user.globalName || user.username,
                type: entityType,
                isDeleted: false,
                icon: user.getAvatarURL?.()
            };
        }

        case "guild": {
            const guild = GuildStore.getGuild(entityId);
            if (!guild) {
                return {
                    id: entityId,
                    name: "Unknown Server",
                    type: entityType,
                    isDeleted: true
                };
            }
            return {
                id: entityId,
                name: guild.name,
                type: entityType,
                isDeleted: false,
                icon: guild.icon ? IconUtils.getGuildIconURL({
                    id: guild.id,
                    icon: guild.icon,
                    size: 128
                }) : undefined
            };
        }

        case "dm": {
            const channel = ChannelStore.getChannel(entityId);
            if (!channel || channel.type !== 1) {
                return {
                    id: entityId,
                    name: "Deleted DM",
                    type: entityType,
                    isDeleted: true
                };
            }
            const recipientId = channel.recipients?.[0];
            const recipient = recipientId ? UserStore.getUser(recipientId) : null;
            if (!recipient) {
                return {
                    id: entityId,
                    name: "Unknown User",
                    type: entityType,
                    isDeleted: true
                };
            }
            return {
                id: entityId,
                name: recipient.globalName || recipient.username,
                type: entityType,
                isDeleted: false,
                icon: recipient.getAvatarURL?.()
            };
        }

        case "groupDm": {
            const channel = ChannelStore.getChannel(entityId);
            if (!channel || channel.type !== 3) {
                return {
                    id: entityId,
                    name: "Deleted Group DM",
                    type: entityType,
                    isDeleted: true
                };
            }
            const groupName = channel.name || channel.recipients?.slice(0, 3).map(userId => {
                const user = UserStore.getUser(userId);
                return user?.username || "Unknown";
            }).join(", ") || "Group DM";
            return {
                id: entityId,
                name: groupName,
                type: entityType,
                isDeleted: false
            };
        }

        case "thread": {
            const thread = ChannelStore.getChannel(entityId);
            if (!thread || (thread.type !== 10 && thread.type !== 11 && thread.type !== 12)) {
                return {
                    id: entityId,
                    name: "Deleted Thread",
                    type: entityType,
                    isDeleted: true
                };
            }
            const parentChannel = thread.parent_id ? ChannelStore.getChannel(thread.parent_id) : null;
            const threadName = parentChannel
                ? `${thread.name} (in #${parentChannel.name})`
                : thread.name;
            return {
                id: entityId,
                name: threadName,
                type: entityType,
                isDeleted: thread.threadMetadata?.archived || false
            };
        }

        case "forum":
        case "forumPost": {
            const channel = ChannelStore.getChannel(entityId);
            if (!channel) {
                return {
                    id: entityId,
                    name: entityType === "forum" ? "Deleted Forum" : "Deleted Forum Post",
                    type: entityType,
                    isDeleted: true
                };
            }
            if (entityType === "forumPost") {
                const parentForum = channel.parent_id ? ChannelStore.getChannel(channel.parent_id) : null;
                const postName = parentForum
                    ? `${channel.name} (in ${parentForum.name})`
                    : channel.name;
                return {
                    id: entityId,
                    name: postName,
                    type: entityType,
                    isDeleted: channel.threadMetadata?.archived || false
                };
            }
            return {
                id: entityId,
                name: channel.name,
                type: entityType,
                isDeleted: false
            };
        }

        default:
            return {
                id: entityId,
                name: "Unknown",
                type: entityType,
                isDeleted: true
            };
    }
}

/**
 * Get entity type name to be readable to users (for display purposes)
 */
export function getEntityTypeName(entityType: EntityType): string {
    switch (entityType) {
        case "channel": return "Text Channel";
        case "voice": return "Voice Channel";
        case "member": return "Member";
        case "guild": return "Server";
        case "dm": return "DM";
        case "groupDm": return "Group DM";
        case "thread": return "Thread";
        case "forum": return "Forum";
        case "forumPost": return "Forum Post";
        default: return "Unknown";
    }
}

/**
 * batch resolve entities (performance optimization)
 * Returns map of entityId ->ResolvedEntity
 */
export function batchResolveEntities(
    entityIds: string[],
    entityTypes: Record<string, EntityType>
): Map<string, ResolvedEntity> {
    const resolved = new Map<string, ResolvedEntity>();

    for (const entityId of entityIds) {
        const entityType = entityTypes[entityId];
        if (entityType) {
            resolved.set(entityId, resolveEntityName(entityId, entityType));
        }
    }

    return resolved;
}
