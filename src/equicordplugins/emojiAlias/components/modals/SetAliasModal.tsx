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
    const finalError = duplicateAlias ? "Duplicate alias" : error ?? validationError;
    const canSave = !validationError && !duplicateAlias;

    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Heading style={{ flexGrow: 1 }}>Set alias</Heading>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent style={{ overflowY: "hidden" }}>
                <Paragraph style={{ margin: 0, marginBottom: 8 }}>Set an alias for {emojiDisplayName}</Paragraph>
                <TextInput
                    value={input}
                    onChange={value => {
                        setInput(value);
                        setError(null);
                    }}
                    placeholder='Alias, e.g. "sob"'
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
                    Save
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
