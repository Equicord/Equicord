/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Guild } from "@vencord/discord-types";
import { proxyLazyWebpack } from "@webpack";
import { Flux, FluxDispatcher, Menu, useStateFromStores } from "@webpack/common";

const DB_KEY = "PinnedServers_ids";

const PinnedStore = proxyLazyWebpack(() => {
    const { Store } = Flux;

    class PinnedServersStore extends Store {
        public _ids: string[] = [];

        public get ids() { return this._ids; }

        public async load() {
            const data = await DataStore.get(DB_KEY);
            if (Array.isArray(data)) this._ids = data.filter(i => typeof i === "string");
        }

        public save() {
            DataStore.set(DB_KEY, this._ids);
        }

        public toggle(id: string) {
            if (this._ids.includes(id)) this._ids = this._ids.filter(i => i !== id);
            else this._ids = [...this._ids, id];
            this.save();
            this.emitChange();
        }
    }

    return new PinnedServersStore(FluxDispatcher);
});

type Node = {
    type: "guild" | "folder";
    id: number | string;
    children: Node[];
};

function togglePin(id: string) {
    PinnedStore.toggle(id);
}

export default definePlugin({
    name: "PinnedServers",
    description: "Pin favourite servers to the top of the server list. They stay on top.",
    authors: [EquicordDevs.leoallday],
    tags: ["Servers", "Utility"],

    patches: [
        {
            find: '("guildsnav")',
            replacement: [
                {
                    match: /([\w$).]{1,150}?)(\.map\(.{0,30}\}\),\i)/,
                    replace: "$self.useSortedGuilds($1)$2"
                },
                {
                    match: /let{disableAppDownload.{0,10}isPlatformEmbedded/,
                    replace: "$self.useStore();$&",
                }
            ]
        }
    ],

    contextMenus: {
        "guild-context"(children, { guild }: { guild: Guild; }) {
            const id = guild.id.toString();
            const pinned = PinnedStore.ids.includes(id);
            children.push(
                <Menu.MenuItem
                    id="vc-pin-server"
                    label={pinned ? "Unpin Server" : "Pin Server to Top"}
                    action={() => togglePin(id)}
                />
            );
        }
    },

    async start() {
        await PinnedStore.load();
    },

    useStore() {
        useStateFromStores([PinnedStore], () => PinnedStore.ids);
    },

    useSortedGuilds(guilds: Node[]): Node[] {
        const pinned: string[] = useStateFromStores([PinnedStore], () => PinnedStore.ids);
        if (!pinned.length) return guilds;

        const byId = new Map<string, Node>();
        for (const g of guilds) {
            if (g.type === "guild") byId.set(g.id.toString(), g);
            for (const c of g.children) byId.set(c.id.toString(), c);
        }

        const top: Node[] = [];
        for (const id of pinned) {
            const node = byId.get(id);
            if (node) top.push(node);
        }
        if (!top.length) return guilds;
        const pinnedSet = new Set(pinned);

        const rest: Node[] = [];
        for (const g of guilds) {
            if (g.type === "guild") {
                if (!pinnedSet.has(g.id.toString())) rest.push(g);
                continue;
            }
            const children = g.children.filter(c => !pinnedSet.has(c.id.toString()));
            if (children.length) rest.push({ ...g, children });
        }
        return [...top, ...rest];
    }
});
