import { classNameFactory } from "@api/Styles";
import { Margins } from "@utils/margins";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot } from "@utils/modal";
import { Button, TextInput, useState } from "@webpack/common";

import { avatars, saveAvatars } from "./index";

const cl = classNameFactory("vc-customavatars-");

export function SetAvatarModal({ userId, modalProps }: { userId: string; modalProps: ModalProps; }) {
    const [url, setUrl] = useState(avatars[userId] ?? "");

    const handleSave = async () => {
        if (url.trim()) {
            avatars[userId] = url.trim();
        } else {
            delete avatars[userId];
        }
        await saveAvatars();
        modalProps.onClose();
    };

    const deleteUserAvatar = async () => {
        delete avatars[userId];
        await saveAvatars();
        modalProps.onClose();
    };

    return (
        <ModalRoot {...modalProps}>
            <ModalHeader className={cl("modal-header")}>
                <span style={{ fontSize: "1.25rem", fontWeight: 600 }}>Custom Avatar</span>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent className={cl("modal-content")}>
                <section className={Margins.bottom16}>
                    <TextInput
                        placeholder="https://example.com/image.png"
                        value={url}
                        onChange={setUrl}
                        onKeyDown={e => e.key === "Enter" && handleSave()}
                        autoFocus
                    />
                </section>
            </ModalContent>
            <ModalFooter className={cl("modal-footer")}>
                {avatars[userId] && (
                    <Button color={Button.Colors.RED} onClick={deleteUserAvatar}>
                        Delete
                    </Button>
                )}
                <Button onClick={handleSave}>Save</Button>
            </ModalFooter>
        </ModalRoot>
    );
}