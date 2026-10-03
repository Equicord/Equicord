/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { StarFilled } from "@components/Icons";
import { getIntlMessage } from "@utils/discord";
import { Channel } from "@vencord/discord-types";
import { mapMangledModule } from "@webpack";
import { ContextMenuApi, GuildStore, Menu, RelationshipStore, UserStore } from "@webpack/common";
import type { ComponentType, MouseEvent } from "react";

import { addFavourite, getFavourite, getFavourites, isFavourite, moveFavourite, removeFavourite, setNickname } from "../data";
import { isFavouritesActive } from "../navigation";
import { ChannelMenuKind, channelMenus, computeChannelName } from "./discord";
import { openNameModal } from "./Modals";

interface MoveToCategory {
    label: string;
    destinations: { id: string | null; label: string; }[];
    perform(categoryId: string | null): void;
}

function getChannelMenuKind(channel: Channel): ChannelMenuKind {
    if (channel.isDM()) return "dm";
    if (channel.isGroupDM()) return "groupDm";
    if (channel.isThread()) return "thread";
    return channel.isGuildVocal() ? "voice" : "text";
}

function getChannelMenuProps(kind: ChannelMenuKind, channel: Channel) {
    switch (kind) {
        case "dm": {
            const recipientId = channel.getRecipientId();
            const user = recipientId ? UserStore.getUser(recipientId) : null;
            return user ? { user, channel, showModalItems: false } : null;
        }
        case "groupDm":
            return { channel, selected: true };
        case "thread":
            return { channel };
        default: {
            const guild = GuildStore.getGuild(channel.guild_id);
            return guild ? { channel, guild } : null;
        }
    }
}

export function openChannelContextMenu(event: MouseEvent, channel: Channel) {
    const kind = getChannelMenuKind(channel);
    const props = getChannelMenuProps(kind, channel);
    if (!props) return;

    ContextMenuApi.openContextMenuLazy(event, async () => {
        await channelMenus[kind].load();
        const { ChannelMenu }: { ChannelMenu: ComponentType<object>; } = mapMangledModule(channelMenus[kind].find, { ChannelMenu: m => typeof m === "function" });
        return menuProps => <ChannelMenu {...menuProps} {...props} />;
    });
}

export function renderAddFavouriteItem(channel: Channel) {
    if (channel.isCategory() || isFavourite(channel.id)) return null;
    if (channel.guild_id && GuildStore.getGuild(channel.guild_id)?.joinedAt == null) return null;

    const { categories } = getFavourites();
    return (
        <Menu.MenuItem
            id="favorite-channel"
            label="Add to Favourites"
            iconLeft={StarFilled}
            leadingAccessory={{ type: "icon", icon: StarFilled }}
            action={() => addFavourite(channel.id)}
        >
            {categories.length ? [
                <Menu.MenuGroup key="uncategorised">
                    <Menu.MenuItem id="favorite-null" label="Favourites" action={() => addFavourite(channel.id)} />
                </Menu.MenuGroup>,
                <Menu.MenuGroup key="categories">
                    {categories.map(c => <Menu.MenuItem key={c.id} id={`favorite-${c.id}`} label={c.name} action={() => addFavourite(channel.id, c.id)} />)}
                </Menu.MenuGroup>
            ] : null}
        </Menu.MenuItem>
    );
}

export function renderRemoveFavouriteItem(channel: Channel) {
    if (!isFavourite(channel.id)) return null;
    return <Menu.MenuItem id="favorite-channel" label="Remove from Favourites" color="danger" action={() => removeFavourite(channel.id)} />;
}

export function getMoveToCategory(channel: Channel, native: MoveToCategory | null): MoveToCategory | null {
    if (!isFavouritesActive()) return native;

    const favourite = getFavourite(channel.id);
    if (!favourite) return null;

    const destinations = getFavourites().categories
        .filter(c => c.id !== favourite.categoryId)
        .map(c => ({ id: c.id, label: c.name }));
    if (favourite.categoryId == null && !destinations.length) return null;

    return {
        label: getIntlMessage("MOVE_TO"),
        destinations: favourite.categoryId != null ? [{ id: null, label: getIntlMessage("UNCATEGORIZED") }, ...destinations] : destinations,
        perform: categoryId => moveFavourite(channel.id, categoryId)
    };
}

export function openNicknameModal(channel: Channel) {
    openNameModal({
        title: getIntlMessage("CHANGE_NICKNAME"),
        confirmText: getIntlMessage("CHANGE_NICKNAME"),
        label: getIntlMessage("NICKNAME"),
        placeholder: computeChannelName(channel, UserStore, RelationshipStore),
        description: getIntlMessage("FAVORITES_SET_NICKNAME_DESCRIPTION"),
        initialValue: getFavourite(channel.id)?.nickname ?? "",
        allowEmpty: true,
        onSubmit: nickname => setNickname(channel.id, nickname)
    });
}
