/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button, TextButton } from "@components/Button";
import { classNameFactory } from "@utils/css";
import { getIntlMessage } from "@utils/discord";
import { Channel } from "@vencord/discord-types";
import { ChannelStore, Clickable, Tooltip, useEffect, useMemo, UserAffinitiesStore, UserStore, useStateFromStores } from "@webpack/common";

import { addToNamedCategory } from "../data";
import { settings } from "../settings";
import { openAddModal, resolveDestination, toDestination, useFavouritesFilter } from "./AddModal";
import { ChannelAffinitiesStore, DestinationList, emptyClasses, fetchChannelAffinities, fetchUserAffinities, SearchResult, suggestionClasses, useDestinationSearch } from "./discord";
import { ChatIcon, CloseIcon, HashtagIcon, SpeakerIcon } from "./icons";

const cl = classNameFactory("vc-favourites-");
const SUGGESTION_COUNT = 4;
const DISMISSED_KEYS: "suggestionsDismissed"[] = ["suggestionsDismissed"];

function toResult(channel: Channel): SearchResult | null {
    if (channel.isDM()) {
        const recipientId = channel.getRecipientId();
        const user = recipientId ? UserStore.getUser(recipientId) : null;
        return user ? { type: "USER", record: user } : null;
    }
    if (channel.isGroupDM()) return { type: "GROUP_DM", record: channel };
    return { type: channel.isGuildVocal() ? "VOICE_CHANNEL" : "TEXT_CHANNEL", record: channel };
}

export function useSuggestions(): SearchResult[] {
    const { suggestionsDismissed } = settings.use(DISMISSED_KEYS);
    const channelFilter = useFavouritesFilter();
    const { results } = useDestinationSearch({ channelFilter, includeFrecency: false });
    const channelAffinities = useStateFromStores([ChannelAffinitiesStore], () => ChannelAffinitiesStore.getChannelAffinities());
    const userAffinities = useStateFromStores([UserAffinitiesStore], () => UserAffinitiesStore.getUserAffinitiesMap());

    useEffect(() => {
        if (suggestionsDismissed) return;
        void fetchChannelAffinities();
        void fetchUserAffinities();
    }, [suggestionsDismissed]);

    return useMemo(() => {
        if (suggestionsDismissed) return [];

        const seen = new Set<string>();
        const suggestions: SearchResult[] = [];
        const accept = (result: SearchResult | null) => {
            if (!result || result.type === "HEADER" || seen.has(result.record.id) || !channelFilter(result, false)) return false;
            seen.add(result.record.id);
            suggestions.push(result);
            return true;
        };

        const channelQueue = [...channelAffinities].sort((a, b) => b.score - a.score).map(a => a.channelId);
        const userQueue = [...userAffinities.values()].sort((a, b) => b.dmProbability - a.dmProbability)
            .map(a => ChannelStore.getDMFromUserId(a.otherUserId))
            .filter((id): id is string => id != null);

        const take = (queue: string[]) => {
            for (let id = queue.shift(); id != null; id = queue.shift()) {
                const channel = ChannelStore.getChannel(id);
                if (channel && accept(toResult(channel))) return true;
            }
            return false;
        };

        while (suggestions.length < SUGGESTION_COUNT) {
            const [first, second] = suggestions.length % 2 === 0 ? [channelQueue, userQueue] : [userQueue, channelQueue];
            if (take(first) || take(second)) continue;
            if (!results.some(accept)) break;
        }

        return suggestions;
    }, [suggestionsDismissed, channelFilter, results, channelAffinities, userAffinities]);
}

async function addSuggestion(result: SearchResult) {
    const id = await resolveDestination(toDestination(result));
    if (id) addToNamedCategory(id, getIntlMessage("CHANNELS"));
}

function suggestionName(result: SearchResult) {
    if (result.type === "USER") return result.record.globalName ?? result.record.username;
    return result.type === "HEADER" ? "" : result.record.name;
}

export function Suggestions({ suggestions, withDivider }: { suggestions: SearchResult[]; withDivider: boolean; }) {
    if (!suggestions.length) return null;

    return (
        <>
            <div className={suggestionClasses.container}>
                <div className={suggestionClasses.header}>
                    <BaseText tag="h2" size="sm" weight="medium" className={suggestionClasses.headerText} defaultColor={false}>Suggested Channels</BaseText>
                    <Tooltip text={getIntlMessage("DISMISS")}>
                        {tooltipProps => (
                            <Clickable
                                {...tooltipProps}
                                className={suggestionClasses.dismissButton}
                                onClick={() => settings.store.suggestionsDismissed = true}
                                role="button"
                                aria-label="Dismiss suggested channels"
                            >
                                <CloseIcon width={16} height={16} className={suggestionClasses.dismissButtonIcon} />
                            </Clickable>
                        )}
                    </Tooltip>
                </div>
                <div className={suggestionClasses.list} role="list">
                    {suggestions.map((result, index) => (
                        <DestinationList.DestinationRow
                            key={`${result.type}-${result.record.id}`}
                            result={result}
                            trailing={
                                <Button variant="secondary" size="small" aria-label={`Add ${suggestionName(result)}`} onClick={() => addSuggestion(result)}>
                                    {getIntlMessage("ADD")}
                                </Button>
                            }
                            aria-posinset={index + 1}
                            aria-setsize={suggestions.length}
                        />
                    ))}
                </div>
            </div>
            {withDivider ? <div className={emptyClasses.divider} /> : null}
        </>
    );
}

function PlaceholderRows() {
    return (
        <div className={emptyClasses.placeholderRows} aria-hidden="true">
            {[HashtagIcon, SpeakerIcon, ChatIcon].map((Icon, index) => (
                <div key={index} className={emptyClasses.placeholderRow}>
                    <Icon width={16} height={16} color="var(--icon-muted)" />
                    <div className={index === 1 ? emptyClasses.placeholderBarLong : emptyClasses.placeholderBarShort} />
                </div>
            ))}
        </div>
    );
}

export function EmptyState({ hasSuggestions }: { hasSuggestions: boolean; }) {
    return (
        <div className={cl("empty")}>
            {hasSuggestions ? <div className={emptyClasses.divider} /> : null}
            <div className={cl("empty-copy")}>
                <BaseText tag="h2" size="md" weight="semibold" color="text-strong">Fill up your Favourites</BaseText>
                <BaseText size="sm" weight="medium" color="text-muted">
                    Right-click any channel or DM and{" "}
                    <TextButton variant="link" className={cl("empty-link")} onClick={() => openAddModal()}>add to your Favourites</TextButton>
                    {" "}for quick access.
                </BaseText>
            </div>
            {hasSuggestions ? null : (
                <>
                    <div className={emptyClasses.divider} />
                    <PlaceholderRows />
                </>
            )}
        </div>
    );
}
