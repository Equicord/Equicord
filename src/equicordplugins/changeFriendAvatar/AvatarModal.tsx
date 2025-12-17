/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { set } from "@api/DataStore";
import { classNameFactory } from "@api/Styles";
import { Margins } from "@utils/margins";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot } from "@utils/modal";
import { TextInput, useState } from "@webpack/common";
import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";

import { avatars, KEY_DATASTORE, KEY_STYLESHEET, settings } from "./index";

const cl = classNameFactory("vc-customavatars-");
function ReloadWarningModal({ modalProps }: { modalProps: ModalProps; }) {
    return (
        <ModalRoot {...modalProps}>
            <ModalHeader className={cl("modal-header")}>
                <Heading tag="h2">Warning</Heading>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent className={cl("modal-content")}>
                <section className={Margins.bottom16}>
                    <Heading tag="h3">
                        Your avatar change was saved.
                    </Heading>
                    <Paragraph>
                        A reload (<strong>Ctrl+R</strong>) may be required for it to apply everywhere.
                    </Paragraph>
                </section>
            </ModalContent>
            <ModalFooter className={cl("modal-footer")}>
                <Button variant="primary" onClick={modalProps.onClose}>
                    Got it
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}



export function SetAvatarModal({ userId, modalProps }: { userId: string, modalProps: ModalProps; }) {
    const initialAvatarUrl = avatars[userId] || "";
    const [url, setUrl] = useState(initialAvatarUrl);
    const [showReloadModal, setShowReloadModal] = useState(false);

    function handleKey(e: KeyboardEvent) {
        if (e.key === "Enter") saveUserAvatar();
    }

    async function saveUserAvatar() {
        avatars[userId] = url;
        await set(KEY_DATASTORE, avatars);

        const css = Object.entries(avatars)
            .map(([id, url]) => `
    img[src*="cdn.discordapp.com/avatars/${id}"] {
        content: url("${url}") !important;
    }`)
            .join("\n");

        await set(KEY_STYLESHEET, css);

        if (settings.store.enableReloadWarning) {
            setShowReloadModal(true);
        } else {
            modalProps.onClose();
        }
    }

    async function deleteUserAvatar() {
        delete avatars[userId];
        await set(KEY_DATASTORE, avatars);

        const css = Object.entries(avatars)
            .map(([id, url]) => `
    img[src*="cdn.discordapp.com/avatars/${id}"] {
        content: url("${url}") !important;
    }`)
            .join("\n");

        await set(KEY_STYLESHEET, css);

        if (settings.store.enableReloadWarning) {
            setShowReloadModal(true);
        } else {
            modalProps.onClose();
        }
    }

    if (showReloadModal) {
        return <ReloadWarningModal modalProps={modalProps} />;
    }

    return (
        <ModalRoot {...modalProps}>
            <ModalHeader className={cl("modal-header")}>
                <span style={{ fontSize: "1.25rem", fontWeight: 600, color: "white" }}>Custom Avatar</span>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent className={cl("modal-content")} onKeyDown={handleKey}>
                <section className={Margins.bottom16}>
                    <Heading tag="h3">Enter PNG/GIF URL</Heading>
                    <TextInput
                        placeholder="https://example.com/image.png"
                        value={url}
                        onChange={setUrl}
                        autoFocus
                    />
                </section>
            </ModalContent>
            <ModalFooter className={cl("modal-footer")}>
                <div style={{ display: "flex", gap: "8px" }}>
                    {avatars[userId] && (<Button variant="dangerPrimary" onClick={deleteUserAvatar}>Delete</Button>)}
                    <Button onClick={saveUserAvatar}>Save</Button>
                </div>
            </ModalFooter>
        </ModalRoot>
    );
}