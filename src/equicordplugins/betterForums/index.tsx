/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { findComponentByCodeLazy } from "@webpack";
import { ActiveJoinedThreadsStore, ChannelStore, Menu, React, SelectedChannelStore, useStateFromStores } from "@webpack/common";

import { BetterForumsStore, DEFAULT_PREFS } from "./ThreadStore";

const NumberBadge = findComponentByCodeLazy("BADGE_NOTIFICATION_BACKGROUND", "let{count:");

// ChannelFlags.PINNED = 1 << 1
const PINNED_FLAG = 1 << 1;

type HasProps<T extends object> = { props?: T };

type HasChildren = HasProps<{ children?: unknown }>;

type HasMenuId = HasProps<{ id?: unknown }>;

type ElementLike = {
    type: React.ElementType;
    props: Record<string, unknown>;
    key?: React.Key | null;
};

const isElementLike = (node: unknown): node is ElementLike => {
    if (!node || typeof node !== "object") return false;
    const obj = node as Record<string, unknown>;
    return "type" in obj && "props" in obj;
};

const getChildren = (node: unknown): unknown => {
    if (!node || typeof node !== "object") return undefined;
    return (node as HasChildren).props?.children;
};

const flattenDepth = (value: unknown, depth: number): unknown[] => {
    if (depth < 0) return [];
    if (!Array.isArray(value)) return value === undefined ? [] : [value];

    if (depth === 0) return value;

    const out: unknown[] = [];
    for (const v of value) out.push(...flattenDepth(v, depth - 1));
    return out;
};

const isResetAllItem = (node: unknown): boolean => {
    if (!node || typeof node !== "object") return false;
    return (node as HasMenuId).props?.id === "reset-all";
};

const isString = (value: unknown): value is string => typeof value === "string";

const getThreadIds = (value: unknown): string[] => {
    if (value == null) return [];

    if (value instanceof Set) return Array.from(value.values()).filter(isString);
    if (value instanceof Map) return Array.from(value.keys()).filter(isString);
    if (Array.isArray(value)) return value.filter(isString);

    if (typeof value === "object") return Object.keys(value as Record<string, unknown>);

    return [];
};

const settings = definePluginSettings({
    showOpenThreadCount: {
        type: OptionType.BOOLEAN,
        description: "Show open thread count badge on forum channels in the sidebar",
        default: true,
    }
});

export default definePlugin({
    name: "BetterForums",
    description: "Adds per-channel sort order (ascending/descending), hide closed threads filter, and open thread count badges to Discord forum channels",
    authors: [EquicordDevs.iPixelGalaxy],
    settings,

    patches: [
        // Intercept activeThreadIds (g) and archivedThreadIds (f) in the forum channel
        // list component right before Discord derives hasActiveThreads (V) and hasAnyThread (W).
        // The }($1) captures the channel variable from the IIFE call that precedes V/W.
        // Using the comma operator inside V's initializer we:
        //   1. Call useForumPrefs() as a React hook so the component re-renders on pref changes
        //   2. Reassign g in-place with applySort  (reverses for ascending order)
        //   3. Reassign f in-place with applyFilter (empties array when Hide Closed is on)
        // Both eG (section counts) and ez (section data) are computed after this point,
        // so they naturally pick up the modified arrays.
        {
            find: "forum-grid-header-section-",
            replacement: {
                match: /\}\((\i)\),(\i)=(\i)\.length>0,(\i)=\2\|\|(\i)\.length>0/,
                replace: "}($1),$2=($self.useForumPrefs(),$3=$self.applySort($3,$1.id),$5=$self.applyFilter($5,$1.id),$3.length>0),$4=$2||$5.length>0"
            }
        },
        // Sidebar open thread count badge
        {
            find: "UNREAD_IMPORTANT:",
            replacement: {
                match: /\.Children\.count.{0,200}?:null(?<=,channel:(\i).+?)/,
                replace: "$&,$self.ForumBadge({channel: $1})"
            }
        }
    ],

    contextMenus: {
        "sort-and-view": (children, props) => {
            const channelId = props?.channel?.id ?? props?.channelId;
            if (typeof channelId !== "string") return;
            const channel = ChannelStore.getChannel(channelId);
            if (!channel?.isForumChannel()) return;

            const prefs = BetterForumsStore.getPrefs(channelId);

            const resetIdx = children.findIndex(child => {
                const nested = flattenDepth(getChildren(child), 2);
                return nested.some(isResetAllItem);
            });

            if (resetIdx !== -1) {
                const group = children[resetIdx];

                const wrapResetInChildren = (value: unknown): { value: unknown; wrapped: boolean } => {
                    if (Array.isArray(value)) {
                        let didWrap = false;
                        const next = value.map(v => {
                            const r = wrapResetInChildren(v);
                            didWrap ||= r.wrapped;
                            return r.value;
                        });
                        return { value: next, wrapped: didWrap };
                    }

                    if (!isElementLike(value)) return { value, wrapped: false };

                    const id = (value.props as { id?: unknown }).id;
                    if (id !== "reset-all") return { value, wrapped: false };

                    const action = (value.props as { action?: unknown }).action;
                    if (typeof action !== "function") return { value, wrapped: false };

                    const wrappedAction = () => {
                        (action as () => void)();
                        BetterForumsStore.setPrefs(channelId, DEFAULT_PREFS);
                    };

                    return {
                        value: React.createElement(value.type, { ...value.props, action: wrappedAction, key: value.key }),
                        wrapped: true,
                    };
                };

                if (isElementLike(group)) {
                    const groupChildren = (group.props as { children?: unknown }).children;
                    const wrapped = wrapResetInChildren(groupChildren);
                    if (wrapped.wrapped) {
                        children[resetIdx] = React.createElement(group.type, { ...group.props, children: wrapped.value, key: group.key }) as React.ReactElement<Record<string, unknown>>;
                    }
                }
            }

            const items = [
                <Menu.MenuGroup label="Order" key="bf-order-group">
                    <Menu.MenuRadioItem
                        id="bf-order-desc"
                        group="bf-order"
                        label="Descending"
                        checked={prefs.order === "desc"}
                        action={() => BetterForumsStore.setPrefs(channelId, { order: "desc" })}
                    />
                    <Menu.MenuRadioItem
                        id="bf-order-asc"
                        group="bf-order"
                        label="Ascending"
                        checked={prefs.order === "asc"}
                        action={() => BetterForumsStore.setPrefs(channelId, { order: "asc" })}
                    />
                </Menu.MenuGroup>,
                <Menu.MenuSeparator key="bf-sep" />,
                <Menu.MenuGroup key="bf-hide-group">
                    <Menu.MenuCheckboxItem
                        id="bf-hide-closed"
                        label="Hide Closed"
                        checked={prefs.hideClosed}
                        action={() => BetterForumsStore.setPrefs(channelId, { hideClosed: !prefs.hideClosed })}
                    />
                </Menu.MenuGroup>,
                <Menu.MenuSeparator key="bf-sep2" />
            ];

            // Insert before "Reset to default" so it stays at the bottom
            if (resetIdx !== -1) {
                children.splice(resetIdx, 0, ...items);
            } else {
                children.push(...items);
            }
        }
    },

    // Subscribed to BetterForumsStore; return value is discarded — the hook's
    // side-effect of subscribing the component is what triggers re-renders.
    useForumPrefs() {
        return useStateFromStores([BetterForumsStore], () => {
            const channelId = SelectedChannelStore.getChannelId();
            return channelId ? BetterForumsStore.getPrefs(channelId) : null;
        });
    },

    // Reverses the active thread ID array when ascending order is selected.
    // Pinned posts are kept at the top regardless of sort direction.
    applySort(threadIds: string[], channelId: string): string[] {
        const prefs = BetterForumsStore.getPrefs(channelId);
        if (prefs.order !== "asc") return threadIds;

        const isPinned = (id: string) => ((ChannelStore.getChannel(id)?.flags ?? 0) & PINNED_FLAG) !== 0;

        const pinned = threadIds.filter(isPinned);
        const unpinned = threadIds.filter(id => !isPinned(id));

        return [...pinned, ...unpinned.reverse()];
    },

    // Returns an empty array (hiding all closed threads) when Hide Closed is active.
    applyFilter(archivedThreadIds: string[], channelId: string): string[] {
        const prefs = BetterForumsStore.getPrefs(channelId);
        if (prefs.hideClosed) return [];
        return archivedThreadIds;
    },

    ForumBadge: ErrorBoundary.wrap(({ channel }: { channel: Channel; }) => {
        if (!channel.isForumChannel()) return null;
        if (!settings.store.showOpenThreadCount) return null;

        const openCount = useStateFromStores([ActiveJoinedThreadsStore, BetterForumsStore], () => {
            const joined = ActiveJoinedThreadsStore.getActiveJoinedThreadsForParent(channel.guild_id, channel.id);
            const unjoined = (ActiveJoinedThreadsStore as typeof ActiveJoinedThreadsStore & {
                getActiveUnjoinedThreadsForParent?(guildId: string, parentChannelId: string): unknown;
            }).getActiveUnjoinedThreadsForParent?.(channel.guild_id, channel.id);

            return new Set([...getThreadIds(joined), ...getThreadIds(unjoined)]).size;
        });

        if (!openCount) return null;
        return <NumberBadge color="var(--brand-500)" count={openCount} />;
    }, { noop: true }),
});

