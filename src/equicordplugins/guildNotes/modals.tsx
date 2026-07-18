/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, React, TextArea, useState } from "@webpack/common";

function EditServerNoteModal({
                                 modalProps,
                                 initialNote,
                                 onSave
                             }: {
    modalProps: RenderModalProps;
    initialNote: string;
    onSave: (note: string) => Promise<void> | void;
}) {
    const [note, setNote] = useState(initialNote);

    const saveAndClose = () => {
        void onSave(note.trim());
        modalProps.onClose();
    };

    return (
        <Modal
            {...modalProps}
            onClose={saveAndClose}
            size="lg"
            title="Server Note"
            actions={[
                { text: "Close", variant: "secondary", onClick: saveAndClose }
            ]}
        >
            <TextArea
                value={note}
                onChange={setNote}
                placeholder="Write a server note..."
                maxLength={2000}
                rows={10}
                autoFocus
            />
        </Modal>
    );
}

export function openEditServerNoteModal(
    initialNote: string,
    onSave: (note: string) => Promise<void> | void
) {
    openModal(props => (
        <EditServerNoteModal
            modalProps={props}
            initialNote={initialNote}
            onSave={onSave}
        />
    ));
}
