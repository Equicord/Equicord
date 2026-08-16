/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Modal, TextInput, useState } from "@webpack/common";

export function NoteModal({
    channelId,
    initialNote,
    onSave,
    modalProps
}: {
    channelId: string;
    initialNote: string;
    onSave: (channelId: string, note: string) => void | Promise<void>;
    modalProps: any;
}) {
    const [note, setNote] = useState(initialNote);

    return (
        <Modal
            {...modalProps}
            size="small"
            title="Channel Note"
            actions={[
                {
                    text: "Apply",
                    variant: "primary",
                    onClick: async () => {
                        await onSave(channelId, note);
                        modalProps.onClose();
                    }
                }
            ]}
        >
            <div style={{ padding: "8px 0" }}>
                <TextInput
                    value={note}
                    placeholder="Write a note..."
                    maxLength={49}
                    onChange={setNote}
                />

                <div
                    style={{
                        marginTop: 8,
                        textAlign: "right",
                        opacity: 0.7,
                        fontSize: 12
                    }}
                >
                    {note.length}/49
                </div>
            </div>
        </Modal>
    );
}
