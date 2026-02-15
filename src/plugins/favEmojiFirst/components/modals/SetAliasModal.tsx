/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, ModalSize } from "@utils/modal";
import { t } from "@utils/translation";
import { TextInput, useState } from "@webpack/common";

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
    const finalError = duplicateAlias ? t("favEmojiFirst.ui.duplicateAlias") : error ?? validationError;
    const canSave = !validationError && !duplicateAlias;

    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Heading style={{ flexGrow: 1 }}>{t("favEmojiFirst.ui.modal.setTitle")}</Heading>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent style={{ overflowY: "hidden" }}>
                <Paragraph style={{ margin: 0, marginBottom: 8 }}>{t("favEmojiFirst.ui.modal.setDescription", { emoji: emojiDisplayName })}</Paragraph>
                <TextInput
                    value={input}
                    onChange={value => {
                        setInput(value);
                        setError(null);
                    }}
                    placeholder={t("favEmojiFirst.ui.modal.placeholder")}
                />
                {finalError && (
                    <BaseText style={{ color: "var(--text-feedback-critical)", marginTop: 8 }}>
                        {finalError}
                    </BaseText>
                )}
            </ModalContent>

            <ModalFooter>
                <Button
                    variant="primary"
                    disabled={!canSave}
                    onClick={async () => {
                        const result = await onSave(input);
                        if (!result.ok) {
                            setError(result.error);
                            return;
                        }
                        modalProps.onClose();
                    }}
                >
                    {t("favEmojiFirst.ui.modal.save")}
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
