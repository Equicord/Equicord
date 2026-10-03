/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { StarFilled } from "@components/Icons";
import { findComponentByCodeLazy, findCssClassesLazy } from "@webpack";
import { ActiveJoinedThreadsStore, ChannelStore, ContextMenuApi, ReadStateStore, Tooltip, useMemo, UserGuildSettingsStore, useState, useStateFromStores } from "@webpack/common";
import type { MouseEvent, ReactNode } from "react";

import { getOrderedChannelIds, useFavourites } from "../data";
import { openFavourites, useFavouritesActive } from "../navigation";
import { settings } from "../settings";
import { NumberBadge } from "./discord";
import { FavouritesSettingsMenu } from "./Menus";

interface PillProps {
    selected: boolean;
    hovered: boolean;
    unread: boolean;
    overlay?: boolean;
}

interface BlobMaskProps {
    selected: boolean;
    lowerBadge: ReactNode;
    lowerBadgeSize: { width: number; height: number; };
    children: ReactNode;
}

interface NavItemProps {
    ariaLabel: string;
    selected: boolean;
    onClick(): void;
    onContextMenu(event: MouseEvent): void;
    onMouseEnter(): void;
    onMouseLeave(): void;
    children: ReactNode;
}

interface Unreads {
    mentions: number;
    unread: boolean;
}

const SETTINGS_KEYS: ("showButton" | "muted")[] = ["showButton", "muted"];

const Pill = findComponentByCodeLazy<PillProps>("=!1,hovered:", "=!1,unread:", "=!1,disabled:");
const BlobMask = findComponentByCodeLazy<BlobMaskProps>('"BlobMask"');
const NavItem = findComponentByCodeLazy<NavItemProps>("backgroundStyle:", "fontSize:");
const listItemClasses = findCssClassesLazy("listItem", "iconBadge");

const badgeWidth = (count: number) => count < 10 ? 16 : count < 100 ? 22 : 30;

function useUnreads(channelIds: string[]) {
    return useStateFromStores(
        [ReadStateStore, ChannelStore, UserGuildSettingsStore, ActiveJoinedThreadsStore],
        (): Unreads => {
            const result = { mentions: 0, unread: false };
            const seen = new Set<string>();
            const count = (id: string) => {
                const channel = ChannelStore.getChannel(id);
                if (!channel || seen.has(id)) return;
                seen.add(id);

                result.mentions += ReadStateStore.getMentionCount(id);
                result.unread ||= ReadStateStore.hasUnread(id) && !UserGuildSettingsStore.isGuildOrCategoryOrChannelMuted(channel.guild_id, id);

                if (channel.guild_id) {
                    for (const threadId in ActiveJoinedThreadsStore.getActiveJoinedRelevantThreadsForParent(channel.guild_id, id))
                        count(threadId);
                }
            };

            channelIds.forEach(count);
            return result;
        },
        [channelIds],
        (a, b) => a.mentions === b.mentions && a.unread === b.unread
    );
}

export function FavouritesButton() {
    const { showButton, muted } = settings.use(SETTINGS_KEYS);
    const data = useFavourites();
    const channelIds = useMemo(() => getOrderedChannelIds(data), [data]);
    const active = useFavouritesActive();
    const { mentions, unread } = useUnreads(channelIds);
    const [hovered, setHovered] = useState(false);

    if (!showButton) return null;

    return (
        <div className={listItemClasses.listItem}>
            <Pill overlay selected={active} hovered={hovered} unread={unread && !muted} />
            <Tooltip text="Favourites" position="right">
                {({ onMouseEnter, onMouseLeave }) => (
                    <BlobMask
                        selected
                        lowerBadge={mentions > 0 ? <NumberBadge count={mentions} /> : null}
                        lowerBadgeSize={{ width: badgeWidth(mentions), height: 16 }}
                    >
                        <NavItem
                            ariaLabel={mentions > 0 ? `Favourites, ${mentions} ${mentions === 1 ? "mention" : "mentions"}` : "Favourites"}
                            selected={active || hovered}
                            onClick={openFavourites}
                            onContextMenu={e => ContextMenuApi.openContextMenu(e, () => <FavouritesSettingsMenu navId="vc-favourites-button-context" onClose={ContextMenuApi.closeContextMenu} />)}
                            onMouseEnter={() => { setHovered(true); onMouseEnter(); }}
                            onMouseLeave={() => { setHovered(false); onMouseLeave(); }}
                        >
                            <StarFilled width={20} height={20} />
                        </NavItem>
                    </BlobMask>
                )}
            </Tooltip>
        </div>
    );
}
