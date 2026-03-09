/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { proxyLazy } from "@utils/lazy";
import { Flux as TFlux } from "@vencord/discord-types";
import { Flux as FluxWP, FluxDispatcher } from "@webpack/common";

interface IFlux extends TFlux {
    PersistedStore: TFlux["Store"];
}

export interface ChannelPrefs {
    order: "asc" | "desc";
    hideClosed: boolean;
}

export const DEFAULT_PREFS: ChannelPrefs = { order: "desc", hideClosed: false };

const channelPrefsMap = new Map<string, ChannelPrefs>();

export const BetterForumsStore = proxyLazy(() => {
    class BetterForumsStore extends (FluxWP as IFlux).PersistedStore {
        static persistKey = "BetterForumsStore";

        initialize(previous?: [string, ChannelPrefs][]) {
            if (!previous) return;
            channelPrefsMap.clear();
            for (const [id, prefs] of previous) channelPrefsMap.set(id, prefs);
        }

        getState() {
            return Array.from(channelPrefsMap.entries());
        }

        getPrefs(channelId: string): ChannelPrefs {
            return channelPrefsMap.get(channelId) ?? DEFAULT_PREFS;
        }

        setPrefs(channelId: string, prefs: Partial<ChannelPrefs>) {
            channelPrefsMap.set(channelId, { ...this.getPrefs(channelId), ...prefs });
            this.emitChange();
        }
    }

    const store = new BetterForumsStore(FluxDispatcher, {});
    return store;
});
