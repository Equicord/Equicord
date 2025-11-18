/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import {
    ChannelStore,
    FluxDispatcher,
    GuildMemberStore,
    GuildStore,
    ReadStateStore,
    SelectedGuildStore,
    UserSettingsActionCreators,
    UserStore,
} from "@webpack/common";

import { contextMenus } from "./components/contextMenu";
import { TagPillList } from "./components/TagPill";
import { TagSettingsComponent } from "./components/TagSettingsComponent";
import { getEntityTags, getUserTagData, type TagData } from "./utils/tagData";
import { applyTagFiltering } from "./utils/tagScoring";
import { getRelevantTags, parseSearchQuery } from "./utils/tagSearch";

export const cl = classNameFactory("vc-bqs-");
export const settings = definePluginSettings({
    enableTags: {
        type: OptionType.BOOLEAN,
        description:
            "Enable tagging system for organizing channels, voice channels, members, and guilds",
        default: false,
    },
    tagManagement: {
        type: OptionType.COMPONENT,
        description: "",
        component: () => <TagSettingsComponent />,
    },
    enableDoublePrefix: {
        type: OptionType.BOOLEAN,
        description:
            "Enable double-prefix filtering (##, !!, @@) to restrict results to current guild",
        default: true,
    },
    sortMode: {
        type: OptionType.SELECT,
        description: "How to sort Quick Switcher results",
        options: [
            { label: "Alphabetical (A-Z)", value: "alphabetical" },
            { label: "Recent Activity", value: "recent", default: true },
            { label: "Unread First", value: "unread" },
            { label: "Mentions First", value: "mentions" },
            { label: "Most Relevant (Smart)", value: "frequency" },
        ],
    },
    userBasedTagData: {
        type: OptionType.CUSTOM,
        description: "",
        default: {} as Record<string, TagData>,
    },
});

const channelAccessTimes = new Map<string, number>();
const channelAccessOrder: string[] = [];
let fluxUnsubscribe: (() => void) | null = null;

interface SearchCacheEntry {
    results: any[];
    timestamp: number;
    guildId: string | null;
}
const searchResultsCache = new Map<string, SearchCacheEntry>();
const cacheAccessTimes = new Map<string, number>();
const SEARCH_CACHE_TTL = 1000;
const MAX_CHANNEL_HISTORY = 500;
const MAX_GUILDS_TO_SEARCH = 50;

export function clearSearchCache() {
    searchResultsCache.clear();
    cacheAccessTimes.clear();
}

function getCachedSearchResults(
    query: string,
    guildId: string | null,
): any[] | null {
    const cacheKey = `${query}:${guildId || "global"}`;
    const cached = searchResultsCache.get(cacheKey);

    if (!cached) return null;

    if (Date.now() - cached.timestamp > SEARCH_CACHE_TTL) {
        searchResultsCache.delete(cacheKey);
        cacheAccessTimes.delete(cacheKey);
        return null;
    }

    if (cached.guildId !== guildId) {
        searchResultsCache.delete(cacheKey);
        cacheAccessTimes.delete(cacheKey);
        return null;
    }

    cacheAccessTimes.set(cacheKey, Date.now());
    return cached.results;
}

function setCachedSearchResults(
    query: string,
    guildId: string | null,
    results: any[],
) {
    const cacheKey = `${query}:${guildId || "global"}`;
    searchResultsCache.set(cacheKey, {
        results,
        timestamp: Date.now(),
        guildId,
    });
    cacheAccessTimes.set(cacheKey, Date.now());

    if (searchResultsCache.size > 20) {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, time] of cacheAccessTimes) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            searchResultsCache.delete(oldestKey);
            cacheAccessTimes.delete(oldestKey);
        }
    }
}

function handleChannelSelect(data: { channelId: string; }) {
    if (data.channelId) {
        const now = Date.now();

        if (channelAccessTimes.has(data.channelId)) {
            const index = channelAccessOrder.indexOf(data.channelId);
            if (index > -1) {
                channelAccessOrder.splice(index, 1);
            }
        }

        channelAccessTimes.set(data.channelId, now);
        channelAccessOrder.push(data.channelId);

        if (channelAccessTimes.size > MAX_CHANNEL_HISTORY) {
            const oldestKey = channelAccessOrder.shift();
            if (oldestKey) {
                channelAccessTimes.delete(oldestKey);
            }
        }
    }
}

function addTagPillsToResults(results: any[], searchQuery?: any) {
    if (!settings.store.enableTags) {
        return results;
    }

    return results.map(result => {
        const entityId = result.record.id;
        const entityTags = getEntityTags(entityId);

        if (entityTags.length === 0) {
            return result;
        }

        const relevantTags = searchQuery
            ? getRelevantTags(entityTags, searchQuery)
            : entityTags;

        if (relevantTags.length === 0) {
            return result;
        }

        const tagText = relevantTags.map(tag => `[${tag.name}]`).join(" ");

        return {
            ...result,
            comparator: `${result.record.name} ${tagText}`,
            sortable: `${result.record.name} ${tagText}`,
        };
    });
}

function normalizeSearchResults(results: any[]): any[] {
    return results.map(result => {
        if (!result.channelId) {
            return {
                ...result,
                channelId: result.record?.id,
            };
        }

        return result;
    });
}

function normalizeAndFilterResults(results: any[], query: string) {
    if (!settings.store.enableTags || !results || results.length === 0) {
        return results;
    }

    if (!query || query.trim().length === 0) {
        return results;
    }

    const normalizedResults = normalizeSearchResults(results);
    const cleanQuery = query.replace(/^[#@!]\s*/, "").trim();
    const parsedQuery = parseSearchQuery(cleanQuery);

    if (parsedQuery.tagFilters.length === 0) {
        return normalizedResults;
    }

    const boostedResults = applyTagFiltering(
        normalizedResults,
        parsedQuery,
        true,
    );

    return boostedResults;
}

/**
 * Get TagPill React elements for a channel to display in Quick Switcher
 * Called from the patched renderName() method in Discord's Quick Switcher component
 */
function getTagPillsForChannel(channel: any) {
    try {
        if (!settings.store.enableTags) {
            return null;
        }

        let entityId: string;

        const isUserObject =
            channel.username !== undefined && channel.type === undefined;

        if (isUserObject) {
            const userIdTags = getEntityTags(channel.id);

            if (userIdTags.length > 0) {
                entityId = channel.id;
            } else if (channel._dmChannelId) {
                entityId = channel._dmChannelId;
            } else {
                entityId = channel.id;
            }
        } else {
            entityId = channel.id;
        }

        if (!entityId) {
            return null;
        }

        const tags = getEntityTags(entityId);

        if (tags.length === 0) {
            return null;
        }

        const { React } = Vencord.Webpack.Common;
        return React.createElement(TagPillList, { tags, maxLength: 15 });
    } catch (error) {
        console.error("[BetterQS TagPills] Error rendering tag pills:", error);
        return null;
    }
}

function generateCustomResults(query: string) {

    const doublePrefix = query.match(/^(##|!!|@@)/)?.[1];

    if (doublePrefix) {
        if (!settings.store.enableDoublePrefix) {
            return null;
        }

        const currentGuildId = SelectedGuildStore.getGuildId();
        if (!currentGuildId) {
            return [];
        }

        const searchTerm = query.slice(2).trim().toLowerCase();

        if (searchTerm.startsWith("tag:")) {
            if (!settings.store.enableTags) {
                return [];
            }

            switch (doublePrefix) {
                case "##":
                    return searchTextChannels(currentGuildId, searchTerm);
                case "!!":
                    return searchVoiceChannels(currentGuildId, searchTerm);
                case "@@":
                    return searchGuildMembers(currentGuildId, searchTerm);
                default:
                    return [];
            }
        }

        switch (doublePrefix) {
            case "##":
                return searchTextChannels(currentGuildId, searchTerm);
            case "!!":
                return searchVoiceChannels(currentGuildId, searchTerm);
            case "@@":
                return searchGuildMembers(currentGuildId, searchTerm);
            default:
                return null;
        }
    }

    if (query.toLowerCase().startsWith("tag:")) {
        if (!settings.store.enableTags) {
            return null;
        }
        return searchAllByTags(query.toLowerCase());
    }

    return null;
}

function searchTextChannels(guildId: string, searchTerm: string) {
    const channels = Object.values(
        ChannelStore.getMutableGuildChannelsForGuild(guildId) || {},
    );

    const parsedQuery = settings.store.enableTags
        ? parseSearchQuery(searchTerm)
        : {
            rawQuery: searchTerm,
            searchTerm: searchTerm.toLowerCase(),
            tagFilters: [],
            isExplicitTagSearch: false,
        };

    const results = channels
        .filter(channel => {
            return channel.type === 0 || channel.type === 5;
        })
        .map(channel => ({
            type: channel.type === 5 ? "ANNOUNCEMENT_CHANNEL" : "TEXT_CHANNEL",
            record: channel,
            channelId: channel.id, // for consistent entity ID extraction
            score: 20,
            comparator: channel.name,
            sortable: channel.name,
        }));

    const filteredResults = settings.store.enableTags
        ? applyTagFiltering(results, parsedQuery)
        : results;

    const resultsWithPills = addTagPillsToResults(filteredResults, parsedQuery);

    return applySorting(resultsWithPills);
}

function searchVoiceChannels(guildId: string, searchTerm: string) {
    const channels = Object.values(
        ChannelStore.getMutableGuildChannelsForGuild(guildId) || {},
    );

    const parsedQuery = settings.store.enableTags
        ? parseSearchQuery(searchTerm)
        : {
            rawQuery: searchTerm,
            searchTerm: searchTerm.toLowerCase(),
            tagFilters: [],
            isExplicitTagSearch: false,
        };

    const results = channels
        .filter(channel => {
            return channel.type === 2 || channel.type === 13;
        })
        .map(channel => ({
            type: channel.type === 13 ? "STAGE_CHANNEL" : "VOICE_CHANNEL",
            record: channel,
            channelId: channel.id,
            score: 20,
            comparator: channel.name,
            sortable: channel.name,
        }));

    const filteredResults = settings.store.enableTags
        ? applyTagFiltering(results, parsedQuery)
        : results;

    const resultsWithPills = addTagPillsToResults(filteredResults, parsedQuery);

    return applySorting(resultsWithPills);
}

function searchGuildMembers(guildId: string, searchTerm: string) {
    const memberIds = GuildMemberStore.getMemberIds(guildId);

    if (!memberIds) {
        return [];
    }

    const parsedQuery = settings.store.enableTags
        ? parseSearchQuery(searchTerm)
        : {
            rawQuery: searchTerm,
            searchTerm: searchTerm.toLowerCase(),
            tagFilters: [],
            isExplicitTagSearch: false,
        };

    let filteredMemberIds = memberIds;
    if (settings.store.enableTags && parsedQuery.isExplicitTagSearch) {
        const tagData = getUserTagData();
        const taggedMemberIds = memberIds.filter(userId =>
            tagData.entityTags[userId]?.tagIds.length > 0
        );

        if (taggedMemberIds.length === 0) {
            return [];
        }

        filteredMemberIds = taggedMemberIds;
    }

    const results = filteredMemberIds
        .map(userId => UserStore.getUser(userId))
        .filter(user => !!user)
        .map(user => {
            const searchableName = [user.globalName, user.username]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return {
                type: "USER",
                record: user,
                score: 20,
                comparator: searchableName,
                sortable: user.globalName || user.username,
            };
        });

    const filteredResults = settings.store.enableTags
        ? applyTagFiltering(results, parsedQuery)
        : results;

    const resultsWithPills = addTagPillsToResults(filteredResults, parsedQuery);

    return sortAlphabetical(resultsWithPills);
}

/**
 * Search DMs (1:1 Direct Messages)
 */
function searchDMs(searchTerm: string) {
    const privateChannels = ChannelStore.getSortedPrivateChannels();

    const parsedQuery = settings.store.enableTags
        ? parseSearchQuery(searchTerm)
        : {
            rawQuery: searchTerm,
            searchTerm: searchTerm.toLowerCase(),
            tagFilters: [],
            isExplicitTagSearch: false,
        };

    const results = privateChannels
        .filter(channel => channel.type === 1)
        .map(channel => {
            const recipientId = channel.recipients?.[0];
            const recipient = recipientId
                ? UserStore.getUser(recipientId)
                : null;
            if (!recipient) return null; // skip if user not found

            const displayName =
                recipient.globalName || recipient.username || "Unknown User";

            (recipient as any)._dmChannelId = channel.id;
            (recipient as any).name = displayName;

            return {
                type: "USER", // QuickSwitcher expects "USER" type for DMs, not "DM"
                record: recipient, // User object (QuickSwitcher opens DM with this user)
                channelId: channel.id, // Store channel ID for tag lookups
                score: 20,
                comparator: displayName,
                sortable: displayName,
            };
        })
        .filter(result => result !== null); // filter out null results

    const filteredResults = settings.store.enableTags
        ? applyTagFiltering(results, parsedQuery)
        : results;

    const resultsWithPills = addTagPillsToResults(filteredResults, parsedQuery);

    return applySorting(resultsWithPills);
}

/**
 * Search Group DMs
 */
function searchGroupDMs(searchTerm: string) {
    const privateChannels = ChannelStore.getSortedPrivateChannels();

    const parsedQuery = settings.store.enableTags
        ? parseSearchQuery(searchTerm)
        : {
            rawQuery: searchTerm,
            searchTerm: searchTerm.toLowerCase(),
            tagFilters: [],
            isExplicitTagSearch: false,
        };

    const results = privateChannels
        .filter(channel => channel.type === 3)
        .map(channel => {
            const groupName =
                channel.name ||
                channel.recipients
                    ?.slice(0, 3)
                    .map(userId => {
                        const user = UserStore.getUser(userId);
                        return user?.username || "Unknown";
                    })
                    .join(", ") ||
                "Group DM";

            return {
                type: "GROUP_DM",
                record: channel, // preserve Channel instance with all methods
                channelId: channel.id,
                score: 20,
                comparator: groupName,
                sortable: groupName,
            };
        });

    const filteredResults = settings.store.enableTags
        ? applyTagFiltering(results, parsedQuery)
        : results;

    const resultsWithPills = addTagPillsToResults(filteredResults, parsedQuery);

    return applySorting(resultsWithPills);
}

function searchThreads(guildId: string, searchTerm: string) {
    const allThreads = ChannelStore.getAllThreadsForGuild(guildId);

    const parsedQuery = settings.store.enableTags
        ? parseSearchQuery(searchTerm)
        : {
            rawQuery: searchTerm,
            searchTerm: searchTerm.toLowerCase(),
            tagFilters: [],
            isExplicitTagSearch: false,
        };

    const results = Object.values(allThreads)
        .flat()
        .filter(
            thread =>
                thread.type === 10 || thread.type === 11 || thread.type === 12,
        )
        .map(thread => {
            return {
                type: "TEXT_CHANNEL",
                record: thread,
                channelId: thread.id,
                score: 20,
                comparator: thread.name,
                sortable: thread.name,
            };
        });

    const filteredResults = settings.store.enableTags
        ? applyTagFiltering(results, parsedQuery)
        : results;

    const resultsWithPills = addTagPillsToResults(filteredResults, parsedQuery);

    return applySorting(resultsWithPills);
}

function searchForums(guildId: string, searchTerm: string) {
    const channels = Object.values(
        ChannelStore.getMutableGuildChannelsForGuild(guildId) || {},
    );

    const parsedQuery = settings.store.enableTags
        ? parseSearchQuery(searchTerm)
        : {
            rawQuery: searchTerm,
            searchTerm: searchTerm.toLowerCase(),
            tagFilters: [],
            isExplicitTagSearch: false,
        };

    const results = channels
        .filter(channel => {
            if (channel.type === 15) return true;
            if (channel.type === 11 || channel.type === 12) {
                const parent = channel.parent_id
                    ? ChannelStore.getChannel(channel.parent_id)
                    : null;
                return parent?.type === 15;
            }
            return false;
        })
        .map(channel => ({
            type: "TEXT_CHANNEL",
            record: channel,
            channelId: channel.id,
            score: 20,
            comparator: channel.name,
            sortable: channel.name,
        }));

    const filteredResults = settings.store.enableTags
        ? applyTagFiltering(results, parsedQuery)
        : results;

    const resultsWithPills = addTagPillsToResults(filteredResults, parsedQuery);

    return applySorting(resultsWithPills);
}

function searchAllByTags(searchTerm: string) {
    const currentGuildId = SelectedGuildStore.getGuildId();

    const cached = getCachedSearchResults(searchTerm, null);
    if (cached) {
        return cached;
    }

    const tagData = getUserTagData();
    const entityIds = Object.keys(tagData.entityTags);

    const taggedChannels = entityIds.filter(id => {
        const entity = tagData.entityTags[id];
        return (
            entity.entityType === "channel" ||
            entity.entityType === "voice" ||
            entity.entityType === "thread" ||
            entity.entityType === "forum"
        );
    });

    const allResults: any[] = [];

    const allGuildsRaw = Object.values(GuildStore.getGuilds());

    const taggedGuildIds = new Set<string>();
    for (const channelId of taggedChannels) {
        const channel = ChannelStore.getChannel(channelId);
        if (channel?.guild_id) {
            taggedGuildIds.add(channel.guild_id);
        }
    }

    const priorityGuilds = allGuildsRaw.filter(g => taggedGuildIds.has(g.id));
    const otherGuilds = allGuildsRaw.filter(g => !taggedGuildIds.has(g.id));
    const allGuilds = [...priorityGuilds, ...otherGuilds].slice(
        0,
        MAX_GUILDS_TO_SEARCH,
    );

    const parsedQuery = settings.store.enableTags
        ? parseSearchQuery(searchTerm)
        : {
            rawQuery: searchTerm,
            searchTerm: searchTerm.toLowerCase(),
            tagFilters: [],
            isExplicitTagSearch: false,
        };

    const allChannels: any[] = [];
    const allVoiceChannels: any[] = [];
    const allThreads: any[] = [];
    const allForums: any[] = [];

    for (const guild of allGuilds) {
        try {
            const guildChannels = Object.values(
                ChannelStore.getMutableGuildChannelsForGuild(guild.id) || {}
            );

            for (const channel of guildChannels) {
                if (channel.type === 0 || channel.type === 5) {
                    allChannels.push({
                        type: channel.type === 5 ? "ANNOUNCEMENT_CHANNEL" : "TEXT_CHANNEL",
                        record: channel,
                        channelId: channel.id,
                        score: 20,
                        comparator: channel.name,
                        sortable: channel.name,
                    });
                } else if (channel.type === 2 || channel.type === 13) {
                    allVoiceChannels.push({
                        type: channel.type === 13 ? "STAGE_CHANNEL" : "VOICE_CHANNEL",
                        record: channel,
                        channelId: channel.id,
                        score: 20,
                        comparator: channel.name,
                        sortable: channel.name,
                    });
                } else if (channel.type === 15) {
                    allForums.push({
                        type: "TEXT_CHANNEL",
                        record: channel,
                        channelId: channel.id,
                        score: 20,
                        comparator: channel.name,
                        sortable: channel.name,
                    });
                }
            }

            const guildThreads = ChannelStore.getAllThreadsForGuild(guild.id);
            Object.values(guildThreads)
                .flat()
                .filter(thread => thread.type === 10 || thread.type === 11 || thread.type === 12)
                .forEach(thread => {
                    allThreads.push({
                        type: "TEXT_CHANNEL",
                        record: thread,
                        channelId: thread.id,
                        score: 20,
                        comparator: thread.name,
                        sortable: thread.name,
                    });
                });
        } catch (e) {
            console.error(`[BetterQS] Error processing guild ${guild.id}:`, e);
        }
    }

    if (settings.store.enableTags) {
        allResults.push(
            ...applyTagFiltering(allChannels, parsedQuery),
            ...applyTagFiltering(allVoiceChannels, parsedQuery),
            ...applyTagFiltering(allThreads, parsedQuery),
            ...applyTagFiltering(allForums, parsedQuery)
        );
    } else {
        allResults.push(...allChannels, ...allVoiceChannels, ...allThreads, ...allForums);
    }

    if (currentGuildId) {
        try {
            const memberResults = searchGuildMembers(
                currentGuildId,
                searchTerm,
            );
            allResults.push(...memberResults);
        } catch (e) {
            console.error("[BetterQS] Error searching guild members:", e);
        }
    }

    try {
        const dmResults = searchDMs(searchTerm);
        allResults.push(...dmResults);
    } catch (e) {
        console.error("[BetterQS] Error searching DMs:", e);
    }

    try {
        const groupDmResults = searchGroupDMs(searchTerm);
        allResults.push(...groupDmResults);
    } catch (e) {
        console.error("[BetterQS] Error searching Group DMs:", e);
    }

    const resultsWithPills = addTagPillsToResults(allResults, parsedQuery);

    const sorted = applySorting(resultsWithPills);

    const limited = sorted.slice(0, 50);

    setCachedSearchResults(searchTerm, null, limited);

    return limited;
}

function applySorting(results: any[]) {
    const { sortMode } = settings.store;

    switch (sortMode) {
        case "alphabetical":
            return sortAlphabetical(results);
        case "recent":
            return sortByRecent(results);
        case "unread":
            return sortByUnread(results);
        case "mentions":
            return sortByMentions(results);
        case "frequency":
            return sortByFrequency(results);
        default:
            return results.sort((a, b) => b.score - a.score);
    }
}

function getCleanName(name: string): string {
    return name.split(/[┃|]/)[1]?.trim() || name;
}

function sortAlphabetical(results: any[]) {
    return results.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;

        const aName = getCleanName(a.comparator);
        const bName = getCleanName(b.comparator);
        return aName.localeCompare(bName);
    });
}

function sortByRecent(results: any[]) {
    const frecencyData =
        UserSettingsActionCreators.FrecencyUserSettingsActionCreators.getCurrentValue()
            ?.guildAndChannelFrecency?.guildAndChannels || {};

    const channelsWithTimestamps = results.map(r => {
        const localTimestamp = channelAccessTimes.get(r.record.id);

        const channelData = frecencyData[r.record.id];
        const recentUses = channelData?.recentUses || [];
        const frecencyTimestamp =
            recentUses.length > 0 ? Math.max(...recentUses.map(Number)) : 0;

        const lastAccessed = localTimestamp || frecencyTimestamp || 0;
        return { result: r, lastAccessed };
    });

    const accessedChannels = channelsWithTimestamps.filter(
        c => c.lastAccessed > 0,
    );

    const sorted = accessedChannels.sort((a, b) => {
        if (a.result.score !== b.result.score)
            return b.result.score - a.result.score;

        if (a.lastAccessed !== b.lastAccessed) {
            return b.lastAccessed - a.lastAccessed;
        }
        return getCleanName(a.result.comparator).localeCompare(
            getCleanName(b.result.comparator),
        );
    });

    return sorted.map(c => c.result);
}

function sortByUnread(results: any[]) {
    return results.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;

        const aUnread = ReadStateStore.getUnreadCount(a.record.id);
        const bUnread = ReadStateStore.getUnreadCount(b.record.id);
        const aHasUnread = ReadStateStore.hasUnread(a.record.id);
        const bHasUnread = ReadStateStore.hasUnread(b.record.id);

        const aIsUnread = aUnread > 0 || aHasUnread;
        const bIsUnread = bUnread > 0 || bHasUnread;

        if (aIsUnread && !bIsUnread) return -1;
        if (!aIsUnread && bIsUnread) return 1;

        if (aIsUnread && bIsUnread && aUnread !== bUnread) {
            return bUnread - aUnread;
        }

        return getCleanName(a.comparator).localeCompare(
            getCleanName(b.comparator),
        );
    });
}

function sortByMentions(results: any[]) {
    return results.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;

        const aMentions = ReadStateStore.getMentionCount(a.record.id);
        const bMentions = ReadStateStore.getMentionCount(b.record.id);

        if (aMentions > 0 && bMentions === 0) return -1;
        if (aMentions === 0 && bMentions > 0) return 1;

        if (aMentions !== bMentions) return bMentions - aMentions;

        const aUnread = ReadStateStore.getUnreadCount(a.record.id);
        const bUnread = ReadStateStore.getUnreadCount(b.record.id);
        if (aUnread !== bUnread) return bUnread - aUnread;

        return getCleanName(a.comparator).localeCompare(
            getCleanName(b.comparator),
        );
    });
}

function countRecentAccesses(recentUses: number[]): number {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return recentUses.filter(timestamp => timestamp > sevenDaysAgo).length;
}

function sortByFrequency(results: any[]) {
    const frecencyData =
        UserSettingsActionCreators.FrecencyUserSettingsActionCreators.getCurrentValue()
            ?.guildAndChannelFrecency?.guildAndChannels || {};

    const channelsWithScores = results.map(r => {
        const channelData = frecencyData[r.record.id];
        const totalUses = channelData?.totalUses || 0;
        const recentUses = channelData?.recentUses || [];
        const recentCount = countRecentAccesses(recentUses);

        const score = recentCount * 3 + totalUses * 0.1;

        return { result: r, totalUses, recentCount, score };
    });

    const activeChannels = channelsWithScores.filter(c => c.score > 0);

    const sorted = activeChannels.sort((a, b) => {
        if (a.result.score !== b.result.score)
            return b.result.score - a.result.score;

        if (a.score !== b.score) return b.score - a.score;
        return getCleanName(a.result.comparator).localeCompare(
            getCleanName(b.result.comparator),
        );
    });

    return sorted.map(c => c.result);
}

export default definePlugin({
    name: "BetterQuickSwitcher",
    description:
        "Enhances Quick Switcher with guild-scoped filtering (##, !!, @@) and a powerful tagging system. Tag any channel, voice channel, thread, forum, member, or guild, then search with tag:name to instantly find them across all servers.",
    authors: [EquicordDevs.justjxke],

    settings,
    contextMenus,

    start() {
        FluxDispatcher.subscribe("CHANNEL_SELECT", handleChannelSelect);
        fluxUnsubscribe = () =>
            FluxDispatcher.unsubscribe("CHANNEL_SELECT", handleChannelSelect);
    },

    stop() {
        if (fluxUnsubscribe) {
            fluxUnsubscribe();
            fluxUnsubscribe = null;
        }
        channelAccessTimes.clear();
        channelAccessOrder.length = 0; // clear order array
        clearSearchCache();
    },

    patches: [
        {
            find: "#{intl::QUICKSWITCHER_PLACEHOLDER}",
            replacement: {
                match: /let{selectedIndex:\i,results:\i}/,
                replace:
                    "const customResults = $self.generateCustomResults(this.state.query); if(customResults !== null) { this.props.results = customResults; } else { this.props.results = $self.normalizeAndFilterResults(this.props.results, this.state.query); } $&",
            },
        },
        {
            find: "voiceSummaryContainer,guildId:",
            replacement: {
                match: /(,this\.renderVoiceStates\(\),(\i))\]\}\)/,
                replace:
                    "$1,$self.getTagPillsForChannel(this.props.channel)]})",
            },
        },
        {
            find: "className:I.dmIconContainer",
            replacement: {
                match: /(children:\[.*?,e)\]\}(?=\))/,
                replace: "$1,$self.getTagPillsForChannel(this.props.channel)]}",
            },
        },
        {
            find: "getDisplayNickname(){",
            replacement: {
                match: /(,\(0,\i\.jsx\)\("span",\{className:\i\.username,children:\i\.\i\.getUserTag\(\i\)\}\))\]\}\)/,
                replace: "$1,$self.getTagPillsForChannel(this.props.user)]})",
            },
        },
        {
            find: "getAccessibilityLabel(){let{guild:",
            replacement: {
                match: /(className:\i\.name,children:)\(0,\i\.jsx\)\("span",\{className:\i\.match,children:(\i)\.name\}\)/,
                replace:
                    '$1[(0,i.jsx)("span",{className:I.match,children:$2.name}),$self.getTagPillsForChannel(this.props.guild)]',
            },
        },
    ],

    generateCustomResults,
    getTagPillsForChannel,
    normalizeAndFilterResults,
});
