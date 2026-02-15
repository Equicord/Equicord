/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { PinOrder, settings } from "@plugins/pinDms";
import { addChannelToCategory, canMoveChannelInDirection, currentUserCategories, isPinned, moveChannel, removeChannelFromCategory } from "@plugins/pinDms/data";
import { t } from "@utils/translation";
import { Menu } from "@webpack/common";

import { openCategoryModal } from "./CreateCategoryModal";

function createPinMenuItem(channelId: string) {
    const pinned = isPinned(channelId);

    return (
        <Menu.MenuItem
            id="pin-dm"
            label={t("pinDms.pinDms")}
        >

            {!pinned && (
                <>
                    <Menu.MenuItem
                        id="vc-add-category"
                        label={t("pinDms.addCategory")}
                        color="brand"
                        action={() => openCategoryModal(null, channelId)}
                    />
                    <Menu.MenuSeparator />

                    {
                        currentUserCategories.map(category => (
                            <Menu.MenuItem
                                key={category.id}
                                id={`pin-category-${category.id}`}
                                label={category.name}
                                action={() => addChannelToCategory(channelId, category.id)}
                            />
                        ))
                    }
                </>
            )}

            {pinned && (
                <>
                    <Menu.MenuItem
                        id="unpin-dm"
                        label={t("pinDms.unpinDm")}
                        color="danger"
                        action={() => removeChannelFromCategory(channelId)}
                    />

                    {
                        settings.store.pinOrder === PinOrder.Custom && canMoveChannelInDirection(channelId, -1) && (
                            <Menu.MenuItem
                                id="move-up"
                                label={t("pinDms.moveUp")}
                                action={() => moveChannel(channelId, -1)}
                            />
                        )
                    }

                    {
                        settings.store.pinOrder === PinOrder.Custom && canMoveChannelInDirection(channelId, 1) && (
                            <Menu.MenuItem
                                id="move-down"
                                label={t("pinDms.moveDown")}
                                action={() => moveChannel(channelId, 1)}
                            />
                        )
                    }
                </>
            )}

        </Menu.MenuItem>
    );
}

const GroupDMContext: NavContextMenuPatchCallback = (children, props) => {
    const container = findGroupChildrenByChildId("leave-channel", children);
    container?.unshift(createPinMenuItem(props.channel.id));
};

const UserContext: NavContextMenuPatchCallback = (children, props) => {
    const container = findGroupChildrenByChildId("close-dm", children);
    if (container) {
        const idx = container.findIndex(c => c?.props?.id === "close-dm");
        container.splice(idx, 0, createPinMenuItem(props.channel.id));
    }
};

export const contextMenus = {
    "gdm-context": GroupDMContext,
    "user-context": UserContext
};
