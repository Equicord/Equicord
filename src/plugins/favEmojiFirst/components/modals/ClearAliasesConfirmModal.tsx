/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph } from "@components/Paragraph";
import { t } from "@utils/translation";
import { Modal } from "@webpack/common";

import { ClearAliasesConfirmModalProps } from "./types";

export function ClearAliasesConfirmModal({ modalProps, onConfirm }: ClearAliasesConfirmModalProps) {
    return (
        <Modal
            {...modalProps}
            size="sm"
            title={t("vencord.favEmojiFirst.ui.confirmModal.title")}
            actions={[
                {
                    text: t("vencord.favEmojiFirst.ui.confirmModal.confirmButton"),
                    variant: "danger-primary",
                    onClick: async () => {
                        await onConfirm();
                        modalProps.onClose();
                    }
                }
            ]}
        >
            <Paragraph>{t("vencord.favEmojiFirst.ui.confirmModal.description")}</Paragraph>
        </Modal>
    );
}
