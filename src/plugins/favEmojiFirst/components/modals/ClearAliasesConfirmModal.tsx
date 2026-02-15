/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, ModalSize } from "@utils/modal";
import { t } from "@utils/translation";

import { ClearAliasesConfirmModalProps } from "./types";

export function ClearAliasesConfirmModal({ modalProps, onConfirm }: ClearAliasesConfirmModalProps) {
    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Heading style={{ flexGrow: 1 }}>{t("favEmojiFirst.ui.confirmModal.title")}</Heading>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Paragraph>{t("favEmojiFirst.ui.confirmModal.description")}</Paragraph>
            </ModalContent>
            <ModalFooter>
                <Button
                    variant="dangerPrimary"
                    style={{ marginLeft: "auto" }}
                    onClick={async () => {
                        await onConfirm();
                        modalProps.onClose();
                    }}
                >
                    {t("favEmojiFirst.ui.confirmModal.confirmButton")}
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
