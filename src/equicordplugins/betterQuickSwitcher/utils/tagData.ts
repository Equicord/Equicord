/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserStore } from "@webpack/common";

import { clearSearchCache, settings } from "..";


export interface Tag {
    id: string;
    name: string;
    color: number;
}

export type EntityType =
    | "channel" // Text/announcement channels
    | "voice" // Voice/stage channels
    | "member" // Guild members
    | "guild" // Servers/guilds
    | "dm" // 1:1 Direct messages
    | "groupDm" // Group DMs
    | "thread" // Threads (public/private/announcement)
    | "forum" // Forum channels
    | "forumPost"; // Forum posts (threads in forums)

export interface EntityTags {
    [entityId: string]: {
        tagIds: string[];
        entityType: EntityType;
    };
}

export interface TagData {
    tags: Record<string, Tag>;
    entityTags: EntityTags;
    version: number;
}

const TAG_NAME_MAX_LENGTH = 20;
const CURRENT_VERSION = 1;

// get current user's tag data
export function getUserTagData(): TagData {
    const userId = UserStore.getCurrentUser()?.id;
    if (!userId) {
        return getEmptyTagData();
    }

    if (!settings.store.userBasedTagData) {
        settings.store.userBasedTagData = {};
    }

    if (!settings.store.userBasedTagData[userId]) {
        settings.store.userBasedTagData[userId] = getEmptyTagData();
    }

    return settings.store.userBasedTagData[userId];
}

// save tag data back to settings (important for persistence)
function saveUserTagData(tagData: TagData): void {
    const userId = UserStore.getCurrentUser()?.id;
    if (!userId) {
        console.warn("[BetterQS TagData] Cannot save - no user ID");
        return;
    }

    if (!settings.store.userBasedTagData) {
        settings.store.userBasedTagData = {};
    }

    settings.store.userBasedTagData[userId] = tagData;

    clearSearchCache();
}

function getEmptyTagData(): TagData {
    return {
        tags: {},
        entityTags: {},
        version: CURRENT_VERSION
    };
}

// create a new tag
export function createTag(name: string, color: number): Tag {
    const tagData = getUserTagData();

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > TAG_NAME_MAX_LENGTH) {
        throw new Error(`Tag name must be 1-${TAG_NAME_MAX_LENGTH} characters`);
    }

    const id = generateTagId();

    const tag: Tag = { id, name: trimmedName, color };
    tagData.tags[id] = tag;

    saveUserTagData(tagData);

    return tag;
}

// get tag by ID
export function getTag(tagId: string): Tag | null {
    const tagData = getUserTagData();
    return tagData.tags[tagId] || null;
}

// get all tags
export function getAllTags(): Tag[] {
    const tagData = getUserTagData();
    return Object.values(tagData.tags);
}

// update tag properties
export function updateTag(tagId: string, updates: Partial<Omit<Tag, "id">>): boolean {
    const tagData = getUserTagData();
    const tag = tagData.tags[tagId];

    if (!tag) return false;

    if (updates.name !== undefined) {
        const trimmedName = updates.name.trim();
        if (!trimmedName || trimmedName.length > TAG_NAME_MAX_LENGTH) {
            throw new Error(`Tag name must be 1-${TAG_NAME_MAX_LENGTH} characters`);
        }
        tag.name = trimmedName;
    }

    if (updates.color !== undefined) {
        tag.color = updates.color;
    }

    saveUserTagData(tagData);

    return true;
}

// delete a tag (also removes from all entities)
export function deleteTag(tagId: string): boolean {
    const tagData = getUserTagData();

    if (!tagData.tags[tagId]) return false;

    Object.keys(tagData.entityTags).forEach(entityId => {
        const entity = tagData.entityTags[entityId];
        entity.tagIds = entity.tagIds.filter(id => id !== tagId);

        if (entity.tagIds.length === 0) {
            delete tagData.entityTags[entityId];
        }
    });

    delete tagData.tags[tagId];

    saveUserTagData(tagData);

    return true;
}

// add tag to entity
export function addTagToEntity(entityId: string, tagId: string, entityType: EntityType): boolean {
    const tagData = getUserTagData();

    if (!tagData.tags[tagId]) return false;

    if (!tagData.entityTags[entityId]) {
        tagData.entityTags[entityId] = {
            tagIds: [],
            entityType
        };
    }

    if (!tagData.entityTags[entityId].tagIds.includes(tagId)) {
        tagData.entityTags[entityId].tagIds.push(tagId);
        saveUserTagData(tagData);
        return true;
    }

    return false;
}

// remove tag from entity
export function removeTagFromEntity(entityId: string, tagId: string): boolean {
    const tagData = getUserTagData();
    const entity = tagData.entityTags[entityId];

    if (!entity) return false;

    const initialLength = entity.tagIds.length;
    entity.tagIds = entity.tagIds.filter(id => id !== tagId);

    if (entity.tagIds.length === 0) {
        delete tagData.entityTags[entityId];
    }

    const wasRemoved = entity.tagIds.length !== initialLength;
    if (wasRemoved) {
        saveUserTagData(tagData);
    }

    return wasRemoved;
}

// get all tags for an entity
export function getEntityTags(entityId: string): Tag[] {
    const tagData = getUserTagData();
    const entity = tagData.entityTags[entityId];

    if (!entity) {
        return [];
    }

    const tags = entity.tagIds
        .map(tagId => tagData.tags[tagId])
        .filter(tag => tag !== undefined);

    return tags;
}

// get all entities with a specific tag
export function getEntitiesWithTag(tagId: string): string[] {
    const tagData = getUserTagData();

    return Object.keys(tagData.entityTags).filter(entityId =>
        tagData.entityTags[entityId].tagIds.includes(tagId)
    );
}

// check if entity has any tags
export function hasAnyTags(entityId: string): boolean {
    const tagData = getUserTagData();
    return !!tagData.entityTags[entityId]?.tagIds.length;
}

// replace all tags on entity
export function setEntityTags(entityId: string, tagIds: string[], entityType: EntityType): void {
    const tagData = getUserTagData();

    const validTagIds = tagIds.filter(tagId => tagData.tags[tagId]);

    if (validTagIds.length === 0) {
        delete tagData.entityTags[entityId];
    } else {
        tagData.entityTags[entityId] = {
            tagIds: validTagIds,
            entityType
        };
    }

    saveUserTagData(tagData);
}

function generateTagId(): string {
    return `tag_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function truncateTagName(name: string, maxLength: number = 15): string {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 1) + "…";
}

export function colorToRgb(color: number): string {
    const r = (color >> 16) & 0xFF;
    const g = (color >> 8) & 0xFF;
    const b = color & 0xFF;
    return `rgb(${r}, ${g}, ${b})`;
}
