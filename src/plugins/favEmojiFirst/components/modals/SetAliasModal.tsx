/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Paragraph } from "@components/Paragraph";
import { t } from "@utils/translation";
import { Modal, TextInput, useState } from "@webpack/common";

import { SetAliasModalProps } from "./types";

export function SetAliasModal({
    modalProps,
    emojiDisplayName,
    initialAlias,
    getValidationError,
    isDuplicateAlias,
    onSave
}: SetAliasModalProps) {
    const [input, setInput] = useState(initialAlias);
    const [error, setError] = useState<string | null>(null);

    const validationError = getValidationError(input);
    const duplicateAlias = isDuplicateAlias(input);
    const finalError = duplicateAlias ? t("vencord.favEmojiFirst.ui.duplicateAlias") : error ?? validationError;
    const canSave = !validationError && !duplicateAlias;

    return (
        <Modal
            {...modalProps}
            size="sm"
            title={t("vencord.favEmojiFirst.ui.modal.setTitle")}
            actions={[
                {
                    text: t("vencord.favEmojiFirst.ui.modal.save"),
                    variant: "primary",
                    disabled: !canSave,
                    onClick: async () => {
                        const result = await onSave(input);
                        if (!result.ok) {
                            setError(result.error);
                            return;
                        }
                        modalProps.onClose();
                    }
                }
            ]}
        >
            <Paragraph style={{ margin: 0, marginBottom: 8 }}>{t("vencord.favEmojiFirst.ui.modal.setDescription", { emoji: emojiDisplayName })}</Paragraph>
            <TextInput
                value={input}
                onChange={value => {
                    setInput(value);
                    setError(null);
                }}
                placeholder={t("vencord.favEmojiFirst.ui.modal.placeholder")}
            />
            {finalError && (
                <BaseText style={{ color: "var(--text-feedback-critical)", marginTop: 8 }}>
                    {finalError}
                </BaseText>
            )}
        </Modal>
    );
}
