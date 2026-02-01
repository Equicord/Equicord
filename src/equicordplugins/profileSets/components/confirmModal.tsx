/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ModalProps, ModalRoot, ModalHeader, ModalContent, ModalFooter } from "@utils/modal";
import { Button, Forms } from "@webpack/common";

interface ConfirmModalProps extends ModalProps {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({ title, message, confirmText, cancelText, onConfirm, onCancel, onClose }: ConfirmModalProps) {
    return (
        <ModalRoot>
            <ModalHeader>
                <Forms.FormTitle tag="h2">{title}</Forms.FormTitle>
            </ModalHeader>
            <ModalContent>
                <Forms.FormText>{message}</Forms.FormText>
            </ModalContent>
            <ModalFooter>
                <Button
                    color={Button.Colors.BRAND}
                    onClick={() => {
                        onConfirm();
                        onClose();
                    }}
                >
                    {confirmText}
                </Button>
                <Button
                    color={Button.Colors.PRIMARY}
                    onClick={() => {
                        onCancel();
                        onClose();
                    }}
                >
                    {cancelText}
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}