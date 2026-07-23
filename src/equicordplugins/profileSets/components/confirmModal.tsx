/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph } from "@components/Paragraph";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, React } from "@webpack/common";

interface ImportProfilesModalProps extends RenderModalProps {
    title: string;
    message: string;
    onOverride: () => void;
    onMerge: () => void;
    onCancel: () => void;
}

export function ImportProfilesModal({ title, message, onOverride, onMerge, onCancel, onClose, ...props }: ImportProfilesModalProps) {
    const closeAfter = (action: () => void) => () => {
        action();
        onClose();
    };

    return (
        <Modal
            {...props}
            onClose={() => {
                onCancel();
                onClose();
            }}
            size="sm"
            title={title}
            actions={[
                {
                    text: "Override",
                    variant: "primary",
                    onClick: closeAfter(onOverride)
                },
                {
                    text: "Merge",
                    variant: "primary",
                    onClick: closeAfter(onMerge)
                },
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: closeAfter(onCancel)
                }
            ]}
        >
            <Paragraph>{message}</Paragraph>
        </Modal>
    );
}
