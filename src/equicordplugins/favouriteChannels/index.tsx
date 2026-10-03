/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { ChannelStore, UserStore } from "@webpack/common";

import { useChannelIcon } from "./components/ChannelIcon";
import { channelMenus } from "./components/discord";
import { FavouritesButton } from "./components/FavouritesButton";
import FavouritesSidebar from "./components/FavouritesSidebar";
import { getMoveToCategory, openNicknameModal, renderAddFavouriteItem, renderRemoveFavouriteItem } from "./components/NativeMenus";
import { addToNamedCategory, isFavourite, removeFavourite } from "./data";
import { carryFavouritesState, FAVOURITES_GUILD_ID, getSelectedGuildScope, isFavouritesActive, isStarVisible, loadLastChannels, openFavourites, useFavouritesActive } from "./navigation";
import { settings } from "./settings";

const RECENT_JOIN_MS = 60_000;

const FavouritesButtonElement = ErrorBoundary.wrap(FavouritesButton, { noop: true });

const isRecentJoin = (timestamp: string | null | undefined) => timestamp != null && Date.now() - new Date(timestamp).getTime() < RECENT_JOIN_MS;

function autoAddThread(threadId: string) {
    if (!settings.store.autoAddThreads || isFavourite(threadId) || !ChannelStore.getChannel(threadId)?.isThread()) return;
    addToNamedCategory(threadId, "Auto-Added Threads");
}

export default definePlugin({
    name: "FavouriteChannels",
    description: "Adds a Favourites button to the server list where you can keep channels, threads and DMs in your own categories.",
    tags: ["Organisation", "Servers", "Shortcuts"],
    authors: [EquicordDevs.justjxke],
    dependencies: ["ServerListAPI", "UserSettingsAPI"],
    settings,

    patches: [
        // Swap the channel sidebar for the Favourites sidebar
        {
            find: '{location:"Sidebar"}),',
            replacement: {
                match: /(?<=\{location:"Sidebar"\}\).{0,80}?)return(?= window\.location)/,
                replace: "return $self.useFavouritesActive()?$self.renderSidebar():"
            }
        },
        // Select the Favourites star instead of the real server in the server list
        {
            find: '"app-download-item"',
            replacement: [
                {
                    match: /\(0,\i\.\i\)\((\i)=>\1\.guildId\)/g,
                    replace: "$self.useGuildBarSelectedId($&)"
                },
                {
                    match: /\(0,\i\.\i\)\((\i)=>\{let\{guildId:(\i)\}=\1;return \2\}\)/,
                    replace: "$self.useGuildBarSelectedId($&)"
                }
            ]
        },
        // Don't scroll the server list to the real server while in Favourites
        {
            find: "handleJumpToGuild=",
            group: true,
            replacement: [
                {
                    match: /\i\.\i\.getState\(\)\.guildId(?=;\i\.scrollToGuild\()/,
                    replace: "$self.getSelectedGuildScope($&)"
                },
                {
                    match: /(?<=let\{guildId:(\i)\}=\i;)(?=\1!==)/,
                    replace: "$1=$self.getSelectedGuildScope($1);"
                },
                {
                    match: /\i\.\i\.getGuildId\(\)(?=;(\i)!==\i&&\(\i=\1\?\?null)/,
                    replace: "$self.getSelectedGuildScope($&)"
                }
            ]
        },
        // Disable Discord's own Favourites experiment
        {
            find: '"useFavoritesAccess"',
            replacement: {
                match: /(?<=function \i\(\i\)\{)(?=let\{isExperimentEnabled:)/,
                replace: "return{hasAccess:!1,isExperimentEnabled:!1,isFreemium:!1,favoriteLimit:0,canUpsellFavoriteLimit:!1};"
            }
        },
        // Keep Favourites open for message jumps and threads of favourite channels
        {
            find: "transitionTo - Transitioning to",
            replacement: {
                match: /function \i\((\i),(\i)\)\{let \i;if\(\i\(\1,"assign"\)\)return;/,
                replace: "$&$2=$self.carryFavouritesState($1,$2);"
            }
        },
        // Mod+2 opens Favourites
        {
            find: ".isTabBarVisible()){let",
            group: true,
            replacement: [
                {
                    match: /(?=if\(!isNaN\((\i)\)&&0!==\1)/,
                    replace: "if(2===$1&&$self.isStarVisible())return $self.openFavourites(),!1;"
                },
                {
                    match: /(?<=1===\i\?\i\.\i:)\(0,\i\.\i\)\(\)(?=\?2===)/,
                    replace: "$self.isStarVisible()"
                }
            ]
        },
        // Alt/Mod+Up/Down includes Favourites
        {
            find: '"mod+alt+down","mod+shift+]"',
            group: true,
            replacement: [
                {
                    match: /(?<=let \i=\i\.\i\.getState\(\)\.guildId;)/,
                    replace: "if($self.isFavouritesActive())return -1;"
                },
                {
                    match: /(?<=-1!==\(\i\+=\i\)\|\|)\(0,\i\.\i\)\(\)/,
                    replace: "$self.isStarVisible()"
                },
                {
                    match: /(?=let \i=-1===(\i)\?\i\.\i:)/,
                    replace: "if(-1===$1)return void $self.openFavourites();"
                }
            ]
        },
        // Title bar shows Favourites
        {
            find: "isFrameInFocusedMode:",
            group: true,
            replacement: [
                {
                    match: /(?<=,\i=)\(0,\i\.\i\)\(\)(?=,\i=\(0,\i\.\i\)\(\),\{application:)/,
                    replace: "$self.useFavouritesFlag($&)"
                },
                {
                    match: /null!=(\i)\?(?=\((\i)=\(0,\i\.\i\)\(\1\),(\i)=(\i)\?(\(0,\i\.jsx\)\(\i\.StarIcon,\{size:"sm"\}\)))/,
                    replace: '$4?($2="Favourites",$3=$5):$&'
                }
            ]
        },
        // Chat header shows the server breadcrumb and Jump button
        {
            find: "showHeaderGuildBreadcrumb:",
            replacement: {
                match: /(?<=showHeaderGuildBreadcrumb:)(?=\i\|\|\i,)/,
                replace: "$self.useFavouritesActive()||"
            }
        },
        {
            find: '.Caret,{direction:"left"})',
            replacement: {
                match: /(?<=return\()(?=\(0,\i\.\i\)\(\i\)\|\|\i\)&&null!=\i\?)/,
                replace: "$self.useFavouritesActive()||"
            }
        },
        // Favourite rows link to their own server and show its icon
        {
            find: 'location:"channel_item"',
            replacement: [
                {
                    match: /(?<==)\(0,\i\.\i\)\((\i)\)(?=;null!=\i&&\i\.\i\.getConfig\(\{guildId:)/,
                    replace: "$self.resolveLinkGuildId($1,$&)"
                },
                {
                    match: /(?<=\((\i),(\i),(\i),(\i)\),\i=`\$\{\i\} icon`.{0,120}?children:)\i(?=\}\))/,
                    replace: "$self.useChannelIcon($1,$2,$3,$4,$&)"
                }
            ]
        },
        // Channel, thread, DM and group DM menus use their Favourites variants
        ...Object.values(channelMenus).map(({ find }) => ({
            find,
            replacement: {
                match: /(?<=return)\(0,\i\.\i\)\(\)(?=\?\(0,\i\.jsx\)\(\i,\{\.\.\.\i\}\):)/,
                replace: " $self.favouritesFlag($&)"
            }
        })),
        {
            find: '"go-to-original-guild"',
            replacement: {
                match: /(?<=!__OVERLAY__&&\()(?=\(0,\i\.\i\)\(\i\)\|\|)/,
                replace: "$self.isFavouritesActive()||"
            }
        },
        {
            find: '"set-channel-nickname"',
            replacement: [
                {
                    match: /!(\(0,\i\.\i\)\(\i\))(?=\?null:)/,
                    replace: "!($self.isFavouritesActive()||$1)"
                },
                {
                    match: /(?<=function \i\((\i)\).{0,400}?action:function\(\)\{)/,
                    replace: "if($self.isFavouritesActive())return $self.openNicknameModal($1);"
                }
            ]
        },
        // Native Add/Remove from Favourites items use our favourites
        {
            find: '"useAddToFavoritesItem"',
            replacement: [
                {
                    match: /(?<=function \i\((\i)\)\{)(?=let [^;]{0,150}"useAddToFavoritesItem")/,
                    replace: "return $self.renderAddFavouriteItem($1);"
                },
                {
                    match: /(?<=function \i\((\i)\)\{)(?=let [^;]{0,150}"useRemoveFromFavoritesItem")/,
                    replace: "return $self.renderRemoveFavouriteItem($1);"
                }
            ]
        },
        {
            find: 'id:"move-to-category"',
            replacement: {
                match: /if\(null==(\i)\)return null;(?=let\{label:)/,
                replace: "$1=$self.getMoveToCategory(arguments[0],$1);$&"
            }
        }
    ],

    flux: {
        CHANNEL_DELETE({ channel }: { channel: Channel; }) {
            removeFavourite(channel.id);
        },
        THREAD_DELETE({ channel }: { channel: Channel; }) {
            removeFavourite(channel.id);
        },
        THREAD_CREATE({ channel }: { channel: Channel & { member?: { joinTimestamp?: string; }; }; }) {
            if (isRecentJoin(channel.member?.joinTimestamp)) autoAddThread(channel.id);
        },
        THREAD_MEMBERS_UPDATE({ id, addedMembers }: { id: string; addedMembers?: { userId: string; }[]; }) {
            if (addedMembers?.some(m => m.userId === UserStore.getCurrentUser().id)) autoAddThread(id);
        },
        THREAD_MEMBER_UPDATE({ id, userId, joinTimestamp }: { id: string; userId: string; joinTimestamp: string; }) {
            if (userId === UserStore.getCurrentUser().id && isRecentJoin(joinTimestamp)) autoAddThread(id);
        }
    },

    useFavouritesActive,
    isFavouritesActive,
    isStarVisible,
    openFavourites,
    carryFavouritesState,
    getSelectedGuildScope,
    useChannelIcon,
    renderAddFavouriteItem,
    renderRemoveFavouriteItem,
    getMoveToCategory,
    openNicknameModal,

    resolveLinkGuildId(channel: Channel, guildId: string | null) {
        return isFavouritesActive() ? channel.guild_id ?? null : guildId;
    },

    useFavouritesFlag(nativeFavourites: boolean) {
        return useFavouritesActive() || nativeFavourites;
    },

    favouritesFlag(nativeFavourites: boolean) {
        return isFavouritesActive() || nativeFavourites;
    },

    useGuildBarSelectedId(guildId: string | null) {
        return useFavouritesActive() ? FAVOURITES_GUILD_ID : guildId;
    },

    renderSidebar() {
        return <FavouritesSidebar />;
    },

    start() {
        void loadLastChannels();
        addServerListElement(ServerListRenderPosition.Above, FavouritesButtonElement, -10);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, FavouritesButtonElement);
    }
});
