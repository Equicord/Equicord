/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMemberListDecorator, removeMemberListDecorator } from "@api/MemberListDecorators";
import { definePluginSettings } from "@api/Settings";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { GuildMemberStore, GuildStore, NavigationRouter, RestAPI, useEffect, UserProfileStore, UserStore, useState } from "@webpack/common";

const settings = definePluginSettings({
    showBots: {
        type: OptionType.BOOLEAN,
        description: "Show the badge on bots and apps",
        default: true
    },
    color: {
        type: OptionType.STRING,
        description: "Badge color (hex, example: #b48ede)",
        default: "#b48ede",
        isValid: (v: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) || "Use a hex color like #b48ede"
    }
});

type Subscriber = (ids: string[]) => void;

const cache = new Map<string, string[]>();
const subs = new Map<string, Set<Subscriber>>();
const queue: string[] = [];
let active = 0;
let pause = 0;

const local = (id: string): string[] =>
    ((GuildMemberStore as any).memberOf?.(id) ?? []).filter((g: string) => GuildStore.getGuild(g));

function cached(id: string) {
    if (!cache.has(id)) {
        const known = (UserProfileStore as any).getMutualGuilds?.(id);
        if (known?.length) cache.set(id, known.map((m: any) => m.guild.id));
    }
    return cache.get(id);
}

function done(id: string, ids: string[]) {
    cache.set(id, ids);
    subs.get(id)?.forEach(fn => fn(ids));
    subs.delete(id);
}

function pump() {
    if (Date.now() < pause) return void setTimeout(pump, pause - Date.now() + 10);
    while (active < 6 && queue.length) {
        const id = queue.pop()!;
        if (!subs.get(id)?.size) continue;
        active++;
        RestAPI.get({ url: `/users/${id}/profile`, query: { with_mutual_guilds: true } })
            .then(r => done(id, (r.body.mutual_guilds ?? []).map((m: any) => m.id)))
            .catch(e => {
                if (e?.status === 429) {
                    queue.push(id);
                    pause = Date.now() + (e.body?.retry_after ?? 2) * 1000 + 200;
                } else done(id, local(id));
            })
            .finally(() => {
                active--;
                pump();
            });
    }
}

function MutualModal({ props, user, ids }: { props: any; user: any; ids: string[]; }) {
    const guilds = ids
        .map(i => GuildStore.getGuild(i))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <ModalRoot {...props} size={ModalSize.SMALL}>
            <ModalHeader>
                <div style={{ flex: 1, color: "var(--header-primary)", fontWeight: 600, fontSize: 18 }}>
                    {guilds.length} mutual {guilds.length === 1 ? "server" : "servers"} with {user.globalName ?? user.username}
                </div>
                <ModalCloseButton onClick={props.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ padding: "8px 0 16px" }}>
                    {guilds.map(g => (
                        <div
                            key={g.id}
                            onClick={() => {
                                props.onClose();
                                NavigationRouter.transitionToGuild(g.id);
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 8px", cursor: "pointer" }}
                        >
                            <img src={g.icon && `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${g.icon.startsWith("a_") ? "gif" : "png"}?size=64`} width={36} height={36} style={{ borderRadius: "50%", background: "var(--background-modifier-accent)" }} />
                            <span style={{ color: "var(--header-primary, #f2f3f5)", fontWeight: 500 }}>{g.name}</span>
                        </div>
                    ))}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

function Badge({ user }: { user: any; }) {
    const { color } = settings.use(["color"]);
    const [ids, setIds] = useState<string[]>(() => cached(user.id) ?? local(user.id));

    useEffect(() => {
        const { id } = user;
        const hit = cached(id);
        if (hit) return setIds(hit);
        setIds(local(id));
        const set = subs.get(id) ?? new Set<Subscriber>();
        subs.set(id, set.add(setIds));
        if (!queue.includes(id)) queue.push(id);
        pump();
        return () => void set.delete(setIds);
    }, [user.id]);

    if (!ids.length) return null;

    return (
        <span
            title="Mutual servers"
            onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                openModal(props => <MutualModal props={props} user={user} ids={ids} />);
            }}
            onMouseDown={e => e.stopPropagation()}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                marginLeft: 4,
                padding: "0 5px",
                height: 16,
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                color,
                background: `color-mix(in srgb, ${color} 12%, transparent)`,
                border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
                cursor: "pointer",
                flexShrink: 0
            }}
        >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8c0-3.3 3.6-6 8-6s8 2.7 8 6v1H4v-1Z" />
            </svg>
            {ids.length}
        </span>
    );
}

export default definePlugin({
    name: "MutualServersBadge",
    description: "Mutual server count next to members. Click it to see the list.",
    authors: [{ name: "ItzMeShadow999", id: 1065604516399026176n }],
    dependencies: ["MemberListDecoratorsAPI"],
    settings,

    start() {
        addMemberListDecorator("MutualServersBadge", ({ user, type }) =>
            !user || type === "dm" || user.id === UserStore.getCurrentUser().id || (user.bot && !settings.store.showBots) ? null : <Badge user={user} />
        );
    },

    stop() {
        removeMemberListDecorator("MutualServersBadge");
        queue.length = 0;
        subs.clear();
        cache.clear();
    }
});
