/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { set } from "@api/DataStore";
import { classNameFactory } from "@api/Styles";
import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { Margins } from "@utils/margins";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot } from "@utils/modal";
import { TextInput, useState } from "@webpack/common";

import { avatars, KEY_DATASTORE } from ".";
const cl = classNameFactory("vc-custom-avatars-");

export function SetAvatarModal({ userId, modalProps }: { userId: string, modalProps: ModalProps; }) {
    const initialAvatarUrl = avatars[userId] || "";
    const [url, setUrl] = useState(initialAvatarUrl);

    function handleKey(e: KeyboardEvent) {
        if (e.key === "Enter") saveUserAvatar();
    }

    async function saveUserAvatar() {
        if (!url.trim()) {
            await deleteUserAvatar();
            return;
        }

        avatars[userId] = url.trim();
        await set(KEY_DATASTORE, avatars);
        modalProps.onClose();
    }

    async function deleteUserAvatar() {
        delete avatars[userId];
        await set(KEY_DATASTORE, avatars);
        modalProps.onClose();
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
