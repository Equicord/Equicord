/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { cl } from "@equicordplugins/holyNotes";
import { noteHandler } from "@equicordplugins/holyNotes/NoteHandler";
import { downloadNotes, uploadNotes } from "@equicordplugins/holyNotes/utils";
import { CloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";

function HelpSection({ title, children }: { title: string; children: React.ReactNode; }) {
    return (
        <>
            <BaseText size="md" weight="semibold" color="text-strong">{title}</BaseText>
            <BaseText size="sm" color="text-default" style={{ marginTop: 4 }}>{children}</BaseText>
            <hr />
        </>
    );
}

export default function HelpModal({ onClose, transitionState }: ModalProps) {
    return (
        <ModalRoot transitionState={transitionState} size={ModalSize.MEDIUM}>
            <ModalHeader separator={false} className={cl("header")}>
                <div className={cl("header-content")}>
                    <BaseText tag="h2" size="lg" weight="semibold" className={cl("title")}>
                        Help
                    </BaseText>
                    <BaseText size="sm" className={cl("description")}>
                        Learn how to use Holy Notes
                    </BaseText>
                </div>
                <div className={cl("header-trailing")}>
                    <CloseButton onClick={onClose} />
                </div>
            </ModalHeader>
            <ModalContent className={cl("content")}>
                <div className="vc-help-markdown">
                    <HelpSection title="Adding Notes">
                        Right-click a message, hover over "Note Message", and select the notebook.
                    </HelpSection>
                    <HelpSection title="Deleting Notes">
                        Right-click a note and select "Delete Note", or hold DELETE and click a note.
                    </HelpSection>
                    <HelpSection title="Moving Notes">
                        Right-click a note, hover over "Move Note", and select the destination notebook.
                    </HelpSection>
                    <HelpSection title="Jump To Message">
                        Right-click a note and select "Jump to Message" to go to the original message.
                    </HelpSection>
                </div>
            </ModalContent>
            <ModalFooter>
                <Flex style={{ gap: 8, flexWrap: "wrap" }}>
                    <Button size="small" variant="primary" onClick={() => noteHandler.refreshAvatars()}>
                        Refresh Avatars
                    </Button>
                    <Button size="small" variant="secondary" onClick={uploadNotes}>
                        Import Notes
                    </Button>
                    <Button size="small" variant="secondary" onClick={downloadNotes}>
                        Export Notes
                    </Button>
                    <Button size="small" variant="dangerSecondary" onClick={() => noteHandler.deleteEverything()}>
                        Delete All Notes
                    </Button>
                </Flex>
            </ModalFooter>
        </ModalRoot>
    );
}
