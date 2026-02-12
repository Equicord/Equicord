/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, ModalSize } from "@utils/modal";

import { ClearAliasesConfirmModalProps } from "./types";

export function ClearAliasesConfirmModal({ modalProps, onConfirm }: ClearAliasesConfirmModalProps) {
    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Heading style={{ flexGrow: 1 }}>Delete all aliases</Heading>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Paragraph>This will remove every emoji alias you saved.</Paragraph>
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
                    Delete all aliases
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
