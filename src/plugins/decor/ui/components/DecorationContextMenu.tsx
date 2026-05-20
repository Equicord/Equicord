/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CopyIcon, DeleteIcon } from "@components/Icons";
import { Decoration } from "@plugins/decor/lib/api";
import { useCurrentUserDecorationsStore } from "@plugins/decor/lib/stores/CurrentUserDecorationsStore";
import { cl } from "@plugins/decor/ui";
import { copyToClipboard } from "@utils/clipboard";
import { t } from "@utils/translation";
import { ConfirmModal, ContextMenuApi, Menu, openModal, UserStore } from "@webpack/common";

export default function DecorationContextMenu({ decoration }: { decoration: Decoration; }) {
    const { delete: deleteDecoration } = useCurrentUserDecorationsStore();

    return <Menu.Menu
        navId={cl("decoration-context-menu")}
        onClose={ContextMenuApi.closeContextMenu}
        aria-label={t("vencord.decor.options")}
    >
        <Menu.MenuItem
            id={cl("decoration-context-menu-copy-hash")}
            label={t("vencord.decor.copyHash")}
            icon={CopyIcon}
            action={() => copyToClipboard(decoration.hash)}
        />
        {decoration.authorId === UserStore.getCurrentUser().id &&
            <Menu.MenuItem
                id={cl("decoration-context-menu-delete")}
                label={t("vencord.decor.deleteDecoration")}
                color="danger"
                icon={DeleteIcon}
                action={() => openModal(props => (
                    <ConfirmModal
                        {...props}
                        title={t("vencord.decor.deleteDecoration")}
                        subtitle={t("vencord.decor.deleteConfirm", { name: decoration.alt })}
                        confirmText={t("vencord.decor.delete")}
                        cancelText={t("vencord.cancel")}
                        onConfirm={() => {
                            deleteDecoration(decoration);
                        }}
                    />
                ))}
            />
        }
    </Menu.Menu>;
}
