/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { classNameFactory } from "@utils/css";
import { getIntlMessage } from "@utils/discord";
import { RenderModalProps } from "@vencord/discord-types";
import { ChannelActionCreators, ChannelStore, Modal, openModalLazy, PermissionsBits, PermissionStore, showToast, Toasts, useCallback, useMemo, useState } from "@webpack/common";

import { addFavourites, getOrderedChannelIds, useFavourites } from "../data";
import { Destination, DestinationList, loadChannelListChunks, SearchInput, SearchResult, useDestinationSearch } from "./discord";

const cl = classNameFactory("vc-favourites-");
const SELECTION_LIMIT = 20;

const destinationKey = (destination: Destination) => `${destination.type}-${destination.id}`;

export const toDestination = (result: SearchResult): Destination =>
    ({ type: result.type === "USER" ? "user" : "channel", id: result.record.id });

export async function resolveDestination(destination: Destination): Promise<string | null> {
    if (destination.type === "channel") return destination.id;
    return ChannelStore.getDMFromUserId(destination.id) ?? await ChannelActionCreators.getOrEnsurePrivateChannel(destination.id) ?? null;
}

export function useFavouritesFilter() {
    const data = useFavourites();

    return useMemo(() => {
        const favourites = new Set(getOrderedChannelIds(data));

        return (result: SearchResult, includeMissingDMs: boolean) => {
            switch (result.type) {
                case "USER": {
                    const dmId = ChannelStore.getDMFromUserId(result.record.id);
                    if (!includeMissingDMs && dmId == null) return false;
                    return dmId == null || !favourites.has(dmId);
                }
                case "GROUP_DM":
                    return !favourites.has(result.record.id);
                case "TEXT_CHANNEL":
                case "VOICE_CHANNEL":
                    return PermissionStore.can(PermissionsBits.VIEW_CHANNEL, result.record) && !result.record.isCategory() && !favourites.has(result.record.id);
                default:
                    return false;
            }
        };
    }, [data]);
}

function EmptyResults() {
    return (
        <div className={cl("picker-empty")}>
            <BaseText size="md" color="text-muted">
                We searched far and wide. Unfortunately, no results were found. Join a server or start a DM to add your first Favourite.
            </BaseText>
        </div>
    );
}

const EMPTY_LIST_PROPS = { sections: [1], sectionHeight: 0, rowHeight: 72, renderRow: () => <EmptyResults /> };

function AddToFavouritesModal({ modalProps, categoryId }: { modalProps: RenderModalProps; categoryId: string | null; }) {
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Destination[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const channelFilter = useFavouritesFilter();
    const { results, updateSearchText } = useDestinationSearch({ includeMissingDMs: true, channelFilter, selectedDestinations: selected });
    const atLimit = selected.length >= SELECTION_LIMIT;

    const onQueryChange = (value: string) => {
        setQuery(value);
        updateSearchText(value);
    };

    const toggle = useCallback((destination: Destination) => {
        const key = destinationKey(destination);
        const isSelected = selected.some(d => destinationKey(d) === key);
        if (!isSelected && atLimit) return;
        setSelected(isSelected ? selected.filter(d => destinationKey(d) !== key) : [...selected, destination]);
    }, [selected, atLimit]);

    const rows = useMemo(() => results.filter(r => r.type !== "HEADER"), [results]);
    const listProps = DestinationList.useDestinationRows({ rowData: rows, selectedDestinations: selected, handleToggleDestination: toggle, disableSelection: atLimit });

    const submit = async () => {
        setSubmitting(true);
        const results = await Promise.allSettled(selected.map(resolveDestination));
        const ids = results.flatMap(r => r.status === "fulfilled" && r.value != null ? [r.value] : []);

        if (!ids.length) {
            showToast(getIntlMessage("ERROR_GENERIC_TITLE"), Toasts.Type.FAILURE);
            setSubmitting(false);
            return;
        }

        addFavourites(ids, categoryId);
        modalProps.onClose();
    };

    return (
        <Modal
            {...modalProps}
            title="Add to Favourites"
            actions={[]}
            input={
                <SearchInput
                    query={query}
                    onChange={onQueryChange}
                    onClear={() => onQueryChange("")}
                    placeholder={getIntlMessage("SEARCH")}
                    aria-label={getIntlMessage("SEARCH")}
                    autoFocus
                />
            }
            actionBarInput={
                <div className={cl("picker-action")}>
                    <Button variant="primary" className={cl("picker-submit")} disabled={!selected.length || submitting} onClick={submit}>
                        {selected.length >= 2 ? `Add to Favourites (${selected.length})` : "Add to Favourites"}
                    </Button>
                </div>
            }
            listProps={rows.length ? listProps : EMPTY_LIST_PROPS}
        />
    );
}

export const openAddModal = (categoryId: string | null = null) =>
    openModalLazy(async () => {
        await loadChannelListChunks();
        return modalProps => <AddToFavouritesModal modalProps={modalProps} categoryId={categoryId} />;
    });
