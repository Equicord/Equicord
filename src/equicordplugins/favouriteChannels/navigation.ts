/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { filters, mapMangledModuleLazy } from "@webpack";
import { ChannelStore, NavigationRouter, SelectedChannelStore, UserStore } from "@webpack/common";

import { getOrderedChannelIds, isFavourite } from "./data";
import { settings } from "./settings";

interface RouterLocation {
    pathname: string;
    state?: unknown;
}

interface TransitionExtras {
    state?: Record<string, unknown>;
    [key: string]: unknown;
}

const STATE_KEY = "vcFavourites";
const LAST_CHANNEL_KEY = "FavouriteChannels_lastChannel";
export const FAVOURITES_GUILD_ID = "vc-favourites";
export const FAVOURITES_TRANSITION: TransitionExtras = { state: { [STATE_KEY]: true } };

const Router: { useLocation(): RouterLocation; } = mapMangledModuleLazy('"Router-History"', {
    useLocation: filters.byCode(").location}")
});

let lastChannels: Record<string, string> = {};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value != null;
const hasFavouritesFlag = (state: unknown) => isRecord(state) && state[STATE_KEY] === true;

export function isFavouritesActive() {
    const entry: unknown = window.history.state;
    return isRecord(entry) && hasFavouritesFlag(entry.state);
}

export function useFavouritesActive() {
    return hasFavouritesFlag(Router.useLocation().state);
}

export const getSelectedGuildScope = (guildId: string | null) => isFavouritesActive() ? FAVOURITES_GUILD_ID : guildId;

export const isStarVisible = () => settings.store.showButton;

export async function loadLastChannels() {
    lastChannels = await DataStore.get<Record<string, string>>(LAST_CHANNEL_KEY) ?? {};
}

export function rememberChannel(channelId: string) {
    const userId = UserStore.getCurrentUser().id;
    if (lastChannels[userId] === channelId) return;

    lastChannels = { ...lastChannels, [userId]: channelId };
    void DataStore.set(LAST_CHANNEL_KEY, lastChannels);
}

export function openFavourites() {
    const lastChannelId = lastChannels[UserStore.getCurrentUser().id];
    const channel = [lastChannelId, ...getOrderedChannelIds()]
        .filter(isFavourite)
        .map(id => ChannelStore.getChannel(id))
        .find(c => c != null);

    if (!channel) return NavigationRouter.transitionTo(location.pathname, FAVOURITES_TRANSITION);

    rememberChannel(channel.id);
    NavigationRouter.transitionTo(`/channels/${channel.guild_id ?? "@me"}/${channel.id}`, FAVOURITES_TRANSITION);
}

export function leaveFavourites() {
    if (isFavouritesActive()) NavigationRouter.transitionTo("/channels/@me");
}

export function carryFavouritesState(path: unknown, extras: TransitionExtras | undefined) {
    if (typeof path !== "string" || !isFavouritesActive() || (extras?.state != null && STATE_KEY in extras.state)) return extras;

    const match = /^\/channels\/[^/]+\/(\d+)(?:\/(\d+))?/.exec(path);
    if (!match) return extras;

    const [, channelId, messageId] = match;
    if (messageId == null && channelId === SelectedChannelStore.getChannelId()) return extras;

    const channel = ChannelStore.getChannel(channelId);
    const isFavouriteThread = channel?.isThread() === true && isFavourite(channel.parent_id);
    const keep = messageId != null ? isFavourite(channelId) || isFavouriteThread : isFavouriteThread;

    return keep ? { ...extras, state: { ...extras?.state, [STATE_KEY]: true } } : extras;
}
