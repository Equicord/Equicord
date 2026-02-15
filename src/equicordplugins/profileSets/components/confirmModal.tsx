/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Heading } from "@components/Heading";
import { Button } from "@components/index";
import { Paragraph } from "@components/Paragraph";
import { ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot } from "@utils/modal";
interface ConfirmModalProps extends ModalProps {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({ title, message, confirmText, cancelText, onConfirm, onCancel, onClose, transitionState }: ConfirmModalProps) {
    return (
        <ModalRoot transitionState={transitionState}>
            <ModalHeader>
                <Heading tag="h2">{title}</Heading>
            </ModalHeader>
            <ModalContent>
                <Paragraph>{message}</Paragraph>
            </ModalContent>
            <ModalFooter>
                <Button
                    onClick={() => {
                        onConfirm();
                        onClose();
                    }}
                >
                    {confirmText}
                </Button>
                <Button
                    variant="secondary"
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
