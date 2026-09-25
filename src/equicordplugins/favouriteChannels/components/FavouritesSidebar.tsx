/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import ErrorBoundary from "@components/ErrorBoundary";
import { ChevronSmallDownIcon } from "@components/Icons";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import { ChannelType } from "@vencord/discord-types/enums";
import { ChannelStore, ContextMenuApi, GuildStore, React, ReadStateStore, ScrollerThin, SelectedChannelStore, useEffect, UserGuildSettingsStore, useState, useStateFromStores } from "@webpack/common";
import type { DragEvent, MouseEvent, ReactNode } from "react";

import { DropPosition, getCategoryChannels, moveCategory, moveFavourite, setCategoryCollapsed, useFavourites } from "../data";
import { FAVOURITES_TRANSITION, rememberChannel } from "../navigation";
import { FavouriteCategory, FavouriteChannel, settings } from "../settings";
import { getFavouriteRowContext } from "./ChannelIcon";
import { categoryClasses, ChannelItem, listClasses, loadChannelListChunks, NumberBadge, sidebarClasses, suggestionClasses } from "./discord";
import { FavouritesHeader } from "./Header";
import { CategoryMenu, FavouritesSettingsMenu } from "./Menus";
import { openChannelContextMenu } from "./NativeMenus";
import { EmptyState, Suggestions, useSuggestions } from "./Suggestions";

interface DragItem {
    kind: "channel" | "category";
    id: string;
}

interface DropTarget {
    id: string;
    position: DropPosition;
}

interface DragState {
    dragging: DragItem | null;
    target: DropTarget | null;
    setDragging(item: DragItem | null): void;
    setTarget(target: DropTarget | null): void;
}

const cl = classNameFactory("vc-favourites-");
const SUBTITLE_KEYS: ("showServerName" | "showThreadParent")[] = ["showServerName", "showThreadParent"];

function dropPosition(event: DragEvent<HTMLElement>): DropPosition {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

function dropClass(drag: DragState, id: string) {
    return drag.target?.id === id ? cl(`drop-${drag.target.position}`) : undefined;
}

function openMenu(event: MouseEvent, render: () => ReactNode) {
    event.stopPropagation();
    ContextMenuApi.openContextMenu(event, render);
}

function dragHandlers(drag: DragState, item: DragItem, onDrop: (dragging: DragItem, position: DropPosition) => void) {
    return {
        draggable: true,
        onDragStart(event: DragEvent<HTMLElement>) {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "move";
            drag.setDragging(item);
        },
        onDragOver(event: DragEvent<HTMLElement>) {
            if (!drag.dragging || drag.dragging.id === item.id) return;
            if (drag.dragging.kind === "category" && item.kind === "channel") return;

            event.preventDefault();
            event.stopPropagation();
            const position = dropPosition(event);
            if (drag.target?.id !== item.id || drag.target.position !== position) drag.setTarget({ id: item.id, position });
        },
        onDrop(event: DragEvent<HTMLElement>) {
            event.preventDefault();
            event.stopPropagation();
            if (drag.dragging) onDrop(drag.dragging, dropPosition(event));
            drag.setDragging(null);
            drag.setTarget(null);
        },
        onDragEnd() {
            drag.setDragging(null);
            drag.setTarget(null);
        }
    };
}

function FavouriteRow({ favourite, selected, drag }: { favourite: FavouriteChannel; selected: boolean; drag: DragState; }) {
    const { showServerName, showThreadParent } = settings.use(SUBTITLE_KEYS);
    const channel = useStateFromStores([ChannelStore], () => ChannelStore.getChannel(favourite.id));
    const parentName = useStateFromStores([ChannelStore], () => channel?.isThread() ? ChannelStore.getChannel(channel.parent_id)?.name : undefined, [channel]);
    const guild = useStateFromStores([GuildStore], () => channel?.guild_id ? GuildStore.getGuild(channel.guild_id) : null, [channel]);
    const readState = useStateFromStores(
        [ReadStateStore, UserGuildSettingsStore],
        () => ({
            unread: ReadStateStore.hasUnread(favourite.id),
            mentionCount: ReadStateStore.getMentionCount(favourite.id),
            muted: channel != null && UserGuildSettingsStore.isGuildOrCategoryOrChannelMuted(channel.guild_id, favourite.id),
            resolvedUnreadSetting: channel != null ? UserGuildSettingsStore.resolveUnreadSetting(channel) : 0
        }),
        [favourite.id, channel],
        (a, b) => a.unread === b.unread && a.mentionCount === b.mentionCount && a.muted === b.muted && a.resolvedUnreadSetting === b.resolvedUnreadSetting
    );
    const handlers = dragHandlers(drag, { kind: "channel", id: favourite.id }, (dragging, position) => {
        if (dragging.kind === "channel") moveFavourite(dragging.id, favourite.categoryId, favourite.id, position);
    });

    if (!channel) return null;

    const FavouriteRowContext = getFavouriteRowContext();

    return (
        <li className={classes(cl("row"), guild != null && cl("guild-row"), dropClass(drag, favourite.id))} {...handlers}>
            <FavouriteRowContext.Provider value={true}>
                <ChannelItem
                    channel={channel}
                    guild={guild}
                    name={favourite.nickname ?? undefined}
                    subtitle={[showThreadParent && parentName, showServerName && guild?.name].filter(Boolean).join(" • ") || undefined}
                    selected={selected}
                    {...readState}
                    transitionExtras={FAVOURITES_TRANSITION}
                    channelTypeOverride={channel.isThread() ? ChannelType.GUILD_TEXT : undefined}
                    onClick={c => rememberChannel(c.id)}
                    onContextMenu={(e, c) => {
                        e.stopPropagation();
                        openChannelContextMenu(e, c);
                    }}
                >
                    {readState.mentionCount > 0 ? <NumberBadge count={readState.mentionCount} /> : null}
                </ChannelItem>
            </FavouriteRowContext.Provider>
        </li>
    );
}

function CategoryHeader({ category, drag }: { category: FavouriteCategory; drag: DragState; }) {
    const handlers = dragHandlers(drag, { kind: "category", id: category.id }, (dragging, position) => {
        if (dragging.kind === "category") moveCategory(dragging.id, category.id, position);
        else moveFavourite(dragging.id, category.id);
    });
    const toggle = () => setCategoryCollapsed(category.id, !category.collapsed);

    return (
        <li className={classes(categoryClasses.containerDefault, cl("category"), dropClass(drag, category.id))} {...handlers}>
            <div
                className={classes(categoryClasses.iconVisibility, categoryClasses.wrapper, categoryClasses.wrapperCommon, categoryClasses.clickable, category.collapsed && categoryClasses.collapsed)}
                onClick={toggle}
                onContextMenu={e => openMenu(e, () => <CategoryMenu category={category} />)}
            >
                <div
                    className={categoryClasses.mainContent}
                    role="button"
                    tabIndex={0}
                    aria-label={`${category.name} (category)`}
                    aria-expanded={!category.collapsed}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
                >
                    <BaseText tag="h3" size="sm" weight="medium" className={classes(categoryClasses.name, cl("category-name"))} defaultColor={false}>
                        {category.name}
                    </BaseText>
                    <ChevronSmallDownIcon className={categoryClasses.icon} />
                </div>
                <div className={categoryClasses.children} />
            </div>
        </li>
    );
}

function FavouritesList() {
    const data = useFavourites();
    const suggestions = useSuggestions();
    const selectedChannelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getChannelId());
    const [dragging, setDragging] = useState<DragItem | null>(null);
    const [target, setTarget] = useState<DropTarget | null>(null);
    const drag: DragState = { dragging, target, setDragging, setTarget };

    if (!data.channels.length && !data.categories.length) {
        return (
            <div className={classes(listClasses.scroller, cl("empty-scroller"))}>
                <Suggestions suggestions={suggestions} withDivider={false} />
                <EmptyState hasSuggestions={suggestions.length > 0} />
            </div>
        );
    }

    const renderRows = (categoryId: string | null, collapsed = false) => getCategoryChannels(data, categoryId)
        .filter(f => !collapsed || f.id === selectedChannelId)
        .map(f => <FavouriteRow key={f.id} favourite={f} selected={f.id === selectedChannelId} drag={drag} />);

    return (
        <>
            <div className={suggestionClasses.aboveScroller}>
                <Suggestions suggestions={suggestions} withDivider={data.channels.length > 0} />
            </div>
            <ScrollerThin className={cl("scroller")} fade>
                <ul className={cl("list")} aria-label="Favourite channels">
                    {renderRows(null)}
                    {data.categories.map(category => (
                        <React.Fragment key={category.id}>
                            <CategoryHeader category={category} drag={drag} />
                            {renderRows(category.id, category.collapsed)}
                        </React.Fragment>
                    ))}
                </ul>
            </ScrollerThin>
        </>
    );
}

function FavouritesSidebar() {
    const [ready, setReady] = useState(false);
    useEffect(() => { void loadChannelListChunks().then(() => setReady(true)); }, []);

    return (
        <nav
            className={classes(sidebarClasses.container, cl("sidebar"))}
            aria-label="Favourites (server)"
            onContextMenu={e => openMenu(e, () => <FavouritesSettingsMenu navId="vc-favourites-sidebar-context" onClose={ContextMenuApi.closeContextMenu} />)}
        >
            {ready ? (
                <>
                    <FavouritesHeader />
                    <FavouritesList />
                </>
            ) : null}
        </nav>
    );
}

export default ErrorBoundary.wrap(FavouritesSidebar, { noop: true });
