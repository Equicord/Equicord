/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Channel, FluxStore, Guild, User } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { extractAndLoadChunksLazy, filters, findByCodeLazy, findComponentByCodeLazy, findCssClassesLazy, findStoreLazy, mapMangledModuleLazy } from "@webpack";
import type { RelationshipStore, UserStore } from "@webpack/common";
import type { ComponentType, MouseEvent, ReactNode } from "react";

import type { FAVOURITES_TRANSITION } from "../navigation";

export type SearchResult =
    | { type: "USER"; record: User; }
    | { type: "GROUP_DM" | "TEXT_CHANNEL" | "VOICE_CHANNEL"; record: Channel; }
    | { type: "HEADER"; record: { id: string; }; };

export interface Destination {
    type: "user" | "channel";
    id: string;
}

interface ListProps {
    sections: number[];
    sectionHeight: number;
    rowHeight: number;
    renderRow(row: { section: number; row: number; }): ReactNode;
}

interface DestinationSearchOptions {
    channelFilter(result: SearchResult, includeMissingDMs: boolean): boolean;
    includeMissingDMs?: boolean;
    includeFrecency?: boolean;
    selectedDestinations?: Destination[];
}

interface DestinationRowsOptions {
    rowData: SearchResult[];
    selectedDestinations: Destination[];
    handleToggleDestination(destination: Destination, name?: string): void;
    disableSelection: boolean;
}

interface ChannelItemProps {
    channel: Channel;
    guild: Guild | null;
    name?: string;
    subtitle?: string;
    selected: boolean;
    muted: boolean;
    unread: boolean;
    mentionCount: number;
    resolvedUnreadSetting: number;
    transitionExtras: typeof FAVOURITES_TRANSITION;
    channelTypeOverride?: ChannelType;
    onClick(channel: Channel): void;
    onContextMenu(event: MouseEvent, channel: Channel): void;
    children?: ReactNode;
}

interface SearchInputProps {
    query: string;
    onChange(query: string): void;
    onClear(): void;
    placeholder: string;
    "aria-label": string;
    autoFocus?: boolean;
}

interface AffinityStore {
    getChannelAffinities(): { channelId: string; score: number; }[];
}

export type ChannelMenuKind = "text" | "voice" | "thread" | "dm" | "groupDm";

const CHANNEL_LIST_CODE = ['"TextChannel"', "isModeratorReportChannel()"];
const MENU_LOADER = String.raw`\(0,\i\.\i\)\(\i,async\(\)=>\{let\{default:\i\}=await Promise\.all\(\[((?:\i\.e\("\d+"\),?)+)\]\)\.then\(\i\.bind\(\i,(\d+)\)\);return \i=>\(0,\i\.jsx\)\(\i,\{\.\.\.\i,`;
const channelMenuLoader = (before: string, props: string) =>
    extractAndLoadChunksLazy(CHANNEL_LIST_CODE, new RegExp(before + MENU_LOADER + props));

export const channelMenus: Record<ChannelMenuKind, { find: string; load(): Promise<boolean>; }> = {
    text: {
        find: "CHANNEL_LIST_TEXT_CHANNEL_MENU])",
        load: channelMenuLoader(String.raw`isModeratorReportChannel\(\)\).{0,400}?let \i=\i\.\i\.getGuild\(\i\.getGuildId\(\)\);null!=\i&&`, String.raw`channel:\i,guild:\i\}`)
    },
    voice: {
        find: "CHANNEL_LIST_VOICE_CHANNEL_MENU])",
        load: channelMenuLoader(String.raw`\};handleContextMenu=\i=>\{let\{channel:\i\}=this\.props,\i=\i\.\i\.getGuild\(\i\.getGuildId\(\)\);null!=\i&&`, String.raw`channel:\i,guild:\i\}`)
    },
    thread: {
        find: "CHANNEL_LIST_THREAD_MENU])",
        load: channelMenuLoader(String.raw`let \i=\i\.\i\.getChannel\(\i\.id\);null!=\i&&`, String.raw`channel:\i\}`)
    },
    dm: {
        find: "DM_USER_MENU])",
        load: channelMenuLoader("", String.raw`user:\i,channel:\i,showModalItems:!1\}`)
    },
    groupDm: {
        find: "GROUP_DM_MENU])",
        load: channelMenuLoader("", String.raw`channel:\i,selected:!0\}`)
    }
};

export const loadChannelListChunks = extractAndLoadChunksLazy(
    ['name:"GuildSidebar"'],
    /Promise\.all\(\[((?:\i\.e\("\d+"\),?)+)\]\)\.then\(\i\.bind\(\i,(\d+)\)\),webpackId:\d+,name:"GuildSidebar"/
);

export const computeChannelName: (channel: Channel, userStore: typeof UserStore, relationshipStore: typeof RelationshipStore) => string =
    findByCodeLazy(".isThread())return`\"");

export const GuildChannelIcon = findComponentByCodeLazy<{ channel: Channel; guild: Guild; size: "SMALL_32"; locked?: boolean; hasActiveThreads?: boolean; className?: string; }>("GUILD_ICON_WITH_CHANNEL_TYPE");

export const ChannelItem = findComponentByCodeLazy<ChannelItemProps>('location:"channel_item"', "resolvedUnreadSetting:");
export const NumberBadge = findComponentByCodeLazy<{ count: number; }>("BADGE_NOTIFICATION_BACKGROUND", "let{count:");
export const SearchInput = findComponentByCodeLazy<SearchInputProps>("leading:", "clearable:null!=");

export const useDestinationSearch: (options: DestinationSearchOptions) => { results: SearchResult[]; updateSearchText(query: string): void; } =
    findByCodeLazy("includeMissingDMs:", "frecencyBoosters:!0");

export const DestinationList: {
    useDestinationRows(options: DestinationRowsOptions): ListProps;
    DestinationRow: ComponentType<{ result: SearchResult; trailing: ReactNode; "aria-posinset": number; "aria-setsize": number; }>;
} = mapMangledModuleLazy("rowHeight:48,renderRow", {
    useDestinationRows: filters.byCode("rowHeight:48"),
    DestinationRow: filters.componentByCode(".HEADER)return null")
});

export const fetchChannelAffinities: () => Promise<void> = findByCodeLazy('"LOAD_CHANNEL_AFFINITIES_V2"');
export const fetchUserAffinities: () => Promise<void> = findByCodeLazy('"LOAD_USER_AFFINITIES_V2"');
export const ChannelAffinitiesStore: FluxStore & AffinityStore = findStoreLazy("ChannelAffinitiesV2Store");

export const sidebarClasses = findCssClassesLazy("container", "hubContainer");
export const headerClasses = findCssClassesLazy(
    "container", "header", "headerContent", "primaryInfo", "guildDropdown", "guildBadgeAndName", "headerChildren",
    "name", "favoritesIcon", "addActionButton", "headerEllipseBackdrop", "headerEllipseForeground"
);
export const categoryClasses = findCssClassesLazy("containerDefault", "iconVisibility", "wrapper", "wrapperCommon", "clickable", "mainContent", "name", "icon", "collapsed", "children");
export const suggestionClasses = findCssClassesLazy("container", "aboveScroller", "list", "header", "headerText", "dismissButton", "dismissButtonIcon");
export const emptyClasses = findCssClassesLazy("divider", "placeholderRows", "placeholderRow", "placeholderBarLong", "placeholderBarShort");
export const listClasses = findCssClassesLazy("scroller", "unreadBar", "voiceUserSummary");
