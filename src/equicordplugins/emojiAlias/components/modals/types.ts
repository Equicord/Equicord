/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ModalProps } from "@utils/modal";

export type SetAliasSaveResult = { ok: true; } | { ok: false; error: string; };

export interface SetAliasModalProps {
    modalProps: ModalProps;
    emojiDisplayName: string;
    initialAlias: string;
    getValidationError: (input: string) => string | null;
    isDuplicateAlias: (input: string) => boolean;
    onSave: (input: string) => Promise<SetAliasSaveResult>;
}

export interface ClearAliasesConfirmModalProps {
    modalProps: ModalProps;
    onConfirm: () => Promise<void>;
}
