/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph } from "@components/Paragraph";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, React } from "@webpack/common";

interface ConfirmModalProps extends RenderModalProps {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel: () => void;
}

interface ImportProfilesModalProps extends RenderModalProps {
    title: string;
    message: string;
    onOverride: () => void;
    onMerge: () => void;
    onCancel: () => void;
}

export function ConfirmModal({ title, message, confirmText, cancelText, onConfirm, onCancel, ...props }: ConfirmModalProps) {
    const closeAfter = (action: () => void) => () => {
        action();
        props.onClose();
    };

    return (
        <Modal
            {...props}
            size="sm"
            title={title}
            actions={[
                {
                    text: confirmText,
                    variant: "primary",
                    onClick: closeAfter(onConfirm)
                },
                {
                    text: cancelText,
                    variant: "secondary",
                    onClick: closeAfter(onCancel)
                }
            ]}
        >
            <Paragraph>{message}</Paragraph>
        </Modal>
    );
}

interface DeleteFolderModalProps extends RenderModalProps {
    folderName: string;
    presetCount: number;
    onMoveToRoot: () => void | Promise<void>;
    onDeleteAll: () => void | Promise<void>;
    onCancel: () => void;
}

export function DeleteFolderModal({
    folderName,
    presetCount,
    onMoveToRoot,
    onDeleteAll,
    onCancel,
    ...props
}: DeleteFolderModalProps) {
    const closeAfter = (action: () => void | Promise<void>) => async () => {
        await action();
        props.onClose();
    };

    const profileLabel = presetCount === 1 ? "profile" : "profiles";

    return (
        <Modal
            {...props}
            size="sm"
            title="Delete folder"
            actions={[
                {
                    text: "Move profiles to root",
                    variant: "primary",
                    onClick: closeAfter(onMoveToRoot)
                },
                {
                    text: "Delete folder and profiles",
                    variant: "dangerPrimary",
                    onClick: closeAfter(onDeleteAll)
                },
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: closeAfter(onCancel)
                }
            ]}
        >
            <Paragraph>
                Delete &quot;{folderName}&quot;? It contains {presetCount} {profileLabel}.
            </Paragraph>
        </Modal>
    );
}

export function ImportProfilesModal({ title, message, onOverride, onMerge, onCancel, ...props }: ImportProfilesModalProps) {
    const closeAfter = (action: () => void) => () => {
        action();
        props.onClose();
    };

    return (
        <Modal
            {...props}
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
