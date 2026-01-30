/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { cl } from "@equicordplugins/holyNotes";
import { noteHandler } from "@equicordplugins/holyNotes/NoteHandler";
import { CloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { React } from "@webpack/common";

import EmptyNotebook from "./Error";
import { RenderMessage } from "./RenderMessage";

interface Props extends ModalProps {
    notebook: string;
    onChangeTab: React.Dispatch<React.SetStateAction<string>>;
}

export default function NotebookDeleteModal({ onClose, transitionState, notebook, onChangeTab }: Props) {
    const notes = noteHandler.getNotes(notebook);

    const handleDelete = () => {
        onClose();
        onChangeTab("Main");
        noteHandler.deleteNotebook(notebook);
    };

    const noteList = notes ? Object.values(notes) : [];

    return (
        <ModalRoot transitionState={transitionState} size={ModalSize.LARGE}>
            <ModalHeader separator={false} className={cl("header")}>
                <div className={cl("header-content")}>
                    <BaseText tag="h2" size="lg" weight="semibold" className={cl("title")}>
                        Delete "{notebook}"?
                    </BaseText>
                    <BaseText size="sm" className={cl("description")}>
                        {noteList.length} {noteList.length === 1 ? "note" : "notes"} will be deleted
                    </BaseText>
                </div>
                <div className={cl("header-trailing")}>
                    <CloseButton onClick={onClose} />
                </div>
            </ModalHeader>
            <ModalContent className={cl("content")}>
                <ErrorBoundary>
                    {noteList.length ? noteList.map(note => (
                        <RenderMessage
                            key={note.id}
                            note={note}
                            notebook={notebook}
                            fromDeleteModal
                        />
                    )) : <EmptyNotebook />}
                </ErrorBoundary>
            </ModalContent>
            <ModalFooter>
                <Button variant="dangerPrimary" onClick={handleDelete}>
                    Delete Notebook
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
