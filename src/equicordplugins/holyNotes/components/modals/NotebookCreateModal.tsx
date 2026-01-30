/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { cl } from "@equicordplugins/holyNotes";
import { noteHandler } from "@equicordplugins/holyNotes/NoteHandler";
import { CloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { TextInput, useState } from "@webpack/common";

export default function NotebookCreateModal({ onClose, transitionState }: ModalProps) {
    const [name, setName] = useState("");

    const handleCreate = () => {
        if (!name.trim()) return;
        noteHandler.newNoteBook(name.trim());
        onClose();
    };

    return (
        <ModalRoot transitionState={transitionState} size={ModalSize.SMALL} className={cl("create-modal")}>
            <ModalHeader separator={false} className={cl("header")}>
                <div className={cl("header-content")}>
                    <BaseText tag="h2" size="lg" weight="semibold" className={cl("title")}>
                        Create Notebook
                    </BaseText>
                    <BaseText size="sm" className={cl("description")}>
                        Enter a name for your new notebook
                    </BaseText>
                </div>
                <div className={cl("header-trailing")}>
                    <CloseButton onClick={onClose} />
                </div>
            </ModalHeader>
            <ModalContent className={cl("content")}>
                <TextInput
                    value={name}
                    placeholder="Notebook Name"
                    onChange={setName}
                />
            </ModalContent>
            <ModalFooter>
                <Button variant="primary" onClick={handleCreate}>
                    Create
                </Button>
                <Button variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
