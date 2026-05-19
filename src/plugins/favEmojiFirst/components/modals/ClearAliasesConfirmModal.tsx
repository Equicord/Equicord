/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph } from "@components/Paragraph";
import { Modal } from "@webpack/common";

import { ClearAliasesConfirmModalProps } from "./types";

export function ClearAliasesConfirmModal({ modalProps, onConfirm }: ClearAliasesConfirmModalProps) {
    return (
        <Modal
            {...modalProps}
            size="sm"
            title="Delete all aliases"
            actions={[
                {
                    text: "Delete all aliases",
                    variant: "danger-primary",
                    onClick: async () => {
                        await onConfirm();
                        modalProps.onClose();
                    }
                }
            ]}
        >
            <Paragraph>This will remove every emoji alias you saved.</Paragraph>
        </Modal>
    );
}
