/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UserStore, useStateFromStores } from "@webpack/common";

import { FavouriteCategory, FavouriteChannel, settings, UserFavourites } from "./settings";

export type DropPosition = "before" | "after";

const EMPTY: UserFavourites = { categories: [], channels: [] };
const FAVOURITES_KEYS: "favourites"[] = ["favourites"];

const currentUserId = (): string | undefined => UserStore.getCurrentUser()?.id;

export function getFavourites(): UserFavourites {
    const userId = currentUserId();
    return userId != null ? settings.plain.favourites?.[userId] ?? EMPTY : EMPTY;
}

export function useFavourites(): UserFavourites {
    settings.use(FAVOURITES_KEYS);
    useStateFromStores([UserStore], currentUserId);
    return getFavourites();
}

function update(fn: (data: UserFavourites) => UserFavourites) {
    const userId = UserStore.getCurrentUser().id;
    settings.store.favourites[userId] = fn(settings.plain.favourites?.[userId] ?? EMPTY);
}

export function getFavourite(id: string | null | undefined): FavouriteChannel | undefined {
    return getFavourites().channels.find(c => c.id === id);
}

export const isFavourite = (id: string | null | undefined) => getFavourite(id) != null;

export function getCategoryChannels(data: UserFavourites, categoryId: string | null) {
    return data.channels.filter(c => c.categoryId === categoryId);
}

export function getOrderedChannelIds(data = getFavourites()) {
    return [null, ...data.categories.map(c => c.id)].flatMap(id => getCategoryChannels(data, id).map(c => c.id));
}

function insertChannel(channels: FavouriteChannel[], channel: FavouriteChannel, targetId: string | null, position: DropPosition) {
    const rest = channels.filter(c => c.id !== channel.id);
    const targetIndex = targetId == null ? -1 : rest.findIndex(c => c.id === targetId);

    if (targetIndex !== -1) {
        rest.splice(position === "before" ? targetIndex : targetIndex + 1, 0, channel);
        return rest;
    }

    const lastInCategory = rest.findLastIndex(c => c.categoryId === channel.categoryId);
    rest.splice(lastInCategory === -1 ? rest.length : lastInCategory + 1, 0, channel);
    return rest;
}

export function addFavourites(ids: string[], categoryId: string | null = null) {
    update(data => ({
        ...data,
        channels: ids.reduce(
            (channels, id) => insertChannel(channels, { id, categoryId, nickname: channels.find(c => c.id === id)?.nickname ?? null }, null, "after"),
            data.channels
        )
    }));
}

export const addFavourite = (id: string, categoryId: string | null = null) => addFavourites([id], categoryId);

export function resetFavourites() {
    delete settings.store.favourites[UserStore.getCurrentUser().id];
    settings.store.suggestionsDismissed = false;
}

export function removeFavourite(id: string) {
    if (!isFavourite(id)) return;
    update(data => ({ ...data, channels: data.channels.filter(c => c.id !== id) }));
}

export function setNickname(id: string, nickname: string) {
    update(data => ({
        ...data,
        channels: data.channels.map(c => c.id === id ? { ...c, nickname: nickname.trim() || null } : c)
    }));
}

export function moveFavourite(id: string, categoryId: string | null, targetId: string | null = null, position: DropPosition = "after") {
    const favourite = getFavourite(id);
    if (!favourite || id === targetId) return;

    update(data => ({
        ...data,
        channels: insertChannel(data.channels, { ...favourite, categoryId }, targetId, position)
    }));
}

export function createCategory(name: string) {
    const id = crypto.randomUUID();
    update(data => ({ ...data, categories: [...data.categories, { id, name: name.trim(), collapsed: false }] }));
    return id;
}

function updateCategories(fn: (categories: FavouriteCategory[]) => FavouriteCategory[]) {
    update(data => ({ ...data, categories: fn(data.categories) }));
}

export function renameCategory(id: string, name: string) {
    updateCategories(categories => categories.map(c => c.id === id ? { ...c, name: name.trim() } : c));
}

export function setCategoryCollapsed(id: string, collapsed: boolean) {
    updateCategories(categories => categories.map(c => c.id === id ? { ...c, collapsed } : c));
}

export function moveCategory(id: string, targetId: string, position: DropPosition) {
    if (id === targetId) return;

    updateCategories(categories => {
        const category = categories.find(c => c.id === id);
        if (!category) return categories;

        const rest = categories.filter(c => c.id !== id);
        const targetIndex = rest.findIndex(c => c.id === targetId);
        rest.splice(position === "before" ? targetIndex : targetIndex + 1, 0, category);
        return rest;
    });
}

export function deleteCategory(id: string) {
    update(data => ({
        categories: data.categories.filter(c => c.id !== id),
        channels: [
            ...data.channels.filter(c => c.categoryId !== id),
            ...data.channels.filter(c => c.categoryId === id).map(c => ({ ...c, categoryId: null }))
        ]
    }));
}

export function addToNamedCategory(id: string, name: string) {
    const lowerName = name.toLowerCase();
    const existing = getFavourites().categories.find(c => c.name.toLowerCase() === lowerName);
    addFavourite(id, existing?.id ?? createCategory(name));
}
