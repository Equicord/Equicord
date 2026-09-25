/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUserSettingLazy } from "@api/UserSettings";
import { TrashIcon } from "@components/Icons";
import { copyWithToast, getIntlMessage } from "@utils/discord";
import { ContextMenuApi, FluxDispatcher, Menu, ReadStateStore } from "@webpack/common";

import { getCategoryChannels, getFavourites, renameCategory, resetFavourites } from "../data";
import { leaveFavourites } from "../navigation";
import { FavouriteCategory, settings } from "../settings";
import { openAddModal } from "./AddModal";
import { EyeSlashIcon, FolderPlusIcon, PlusIcon, ThreadsIcon } from "./icons";
import { openCreateCategoryModal, openDeleteCategoryModal, openNameModal } from "./Modals";

interface MenuProps {
    navId: string;
    onClose(): void;
    variant?: "fixed";
}

const AUTO_ADD_KEYS: "autoAddThreads"[] = ["autoAddThreads"];
const DeveloperMode = getUserSettingLazy<boolean>("appearance", "developerMode");

function markRead(channelIds: string[]) {
    FluxDispatcher.dispatch({
        type: "BULK_ACK",
        context: "APP",
        channels: channelIds
            .filter(id => ReadStateStore.hasUnread(id))
            .map(channelId => ({ channelId, messageId: ReadStateStore.lastMessageId(channelId), readStateType: 0 }))
    });
}

export function CategoryMenu({ category }: { category: FavouriteCategory; }) {
    const developerMode = DeveloperMode?.useSetting();
    const channelIds = getCategoryChannels(getFavourites(), category.id).map(c => c.id);

    return (
        <Menu.Menu navId="vc-favourites-category-context" onClose={ContextMenuApi.closeContextMenu} aria-label={getIntlMessage("CHANNEL_ACTIONS_MENU_LABEL")}>
            <Menu.MenuGroup>
                <Menu.MenuItem
                    id="mark-channel-read"
                    label={getIntlMessage("MARK_AS_READ")}
                    disabled={!channelIds.some(id => ReadStateStore.hasUnread(id))}
                    action={() => markRead(channelIds)}
                />
            </Menu.MenuGroup>
            <Menu.MenuGroup>
                <Menu.MenuItem
                    id="add-channel-to-category"
                    label="Add to Category"
                    trailingIndicator={{ type: "icon", icon: PlusIcon }}
                    action={() => openAddModal(category.id)}
                />
                <Menu.MenuItem
                    id="set-channel-nickname"
                    label={getIntlMessage("FAVORITES_RENAME_CATEGORY")}
                    action={() => openNameModal({
                        title: getIntlMessage("FAVORITES_RENAME_CATEGORY"),
                        confirmText: getIntlMessage("FAVORITES_RENAME_CATEGORY"),
                        label: getIntlMessage("CATEGORY_NAME"),
                        placeholder: category.name,
                        description: getIntlMessage("FAVORITES_SET_NICKNAME_DESCRIPTION"),
                        initialValue: category.name,
                        onSubmit: name => renameCategory(category.id, name)
                    })}
                />
            </Menu.MenuGroup>
            <Menu.MenuGroup>
                <Menu.MenuItem
                    id="delete-channel"
                    label={getIntlMessage("REMOVE_CATEGORY")}
                    subtext={getIntlMessage("DELETE_CATEGORY_SUBTEXT")}
                    color="danger"
                    action={() => openDeleteCategoryModal(category)}
                />
            </Menu.MenuGroup>
            {developerMode ? (
                <Menu.MenuGroup>
                    <Menu.MenuItem
                        id={`devmode-copy-id-${category.id}`}
                        label={getIntlMessage("COPY_ID_CATEGORY")}
                        action={() => copyWithToast(category.id)}
                    />
                </Menu.MenuGroup>
            ) : null}
        </Menu.Menu>
    );
}

export function FavouritesSettingsMenu({ navId, onClose, variant }: MenuProps) {
    const { autoAddThreads } = settings.use(AUTO_ADD_KEYS);
    const developerMode = DeveloperMode?.useSetting();

    return (
        <Menu.Menu navId={navId} variant={variant} onClose={onClose} aria-label={getIntlMessage("GUILD_ACTIONS_MENU_LABEL")}>
            <Menu.MenuGroup>
                <Menu.MenuCheckboxItem
                    id="favorites-auto-added-threads"
                    label="Auto-Add Threads"
                    subtext="Threads you join go to an ‘Auto-Added Threads’ category."
                    checked={autoAddThreads}
                    leadingAccessory={{ type: "icon", icon: ThreadsIcon }}
                    action={() => settings.store.autoAddThreads = !autoAddThreads}
                />
            </Menu.MenuGroup>
            <Menu.MenuGroup>
                <Menu.MenuItem
                    id="hide-favorites"
                    label="Hide Favourites"
                    subtext="Turn this back on at any time in Settings."
                    color="danger"
                    icon={EyeSlashIcon}
                    leadingAccessory={{ type: "icon", icon: EyeSlashIcon }}
                    action={() => {
                        settings.store.showButton = false;
                        leaveFavourites();
                    }}
                />
            </Menu.MenuGroup>
            {developerMode ? (
                <Menu.MenuGroup>
                    <Menu.MenuItem
                        id="reset-favorites"
                        label="Reset Favourites"
                        subtext="Empties Favourites and restores its first-run state."
                        color="danger"
                        icon={TrashIcon}
                        leadingAccessory={{ type: "icon", icon: TrashIcon }}
                        action={() => {
                            leaveFavourites();
                            resetFavourites();
                        }}
                    />
                </Menu.MenuGroup>
            ) : null}
        </Menu.Menu>
    );
}

export function AddMenu({ navId, onClose }: MenuProps) {
    return (
        <Menu.Menu navId={navId} variant="fixed" onClose={onClose} aria-label={getIntlMessage("USER_ACTIONS_MENU_LABEL")}>
            <Menu.MenuGroup>
                <Menu.MenuItem
                    id="add-to-favorites"
                    label="Add to Favourites"
                    icon={PlusIcon}
                    trailingIndicator={{ type: "icon", icon: PlusIcon }}
                    action={() => openAddModal()}
                />
            </Menu.MenuGroup>
            <Menu.MenuGroup>
                <Menu.MenuItem
                    id="create-favorites-category"
                    label={getIntlMessage("CREATE_CATEGORY")}
                    icon={FolderPlusIcon}
                    trailingIndicator={{ type: "icon", icon: FolderPlusIcon }}
                    action={() => openCreateCategoryModal()}
                />
            </Menu.MenuGroup>
        </Menu.Menu>
    );
}
