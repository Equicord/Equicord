import { classNameFactory } from "@api/Styles";
import { Margins } from "@utils/margins";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot } from "@utils/modal";
import { Button, FluxDispatcher, TextInput, useState } from "@webpack/common";

import { avatars, saveAvatars } from "./index";

const cl = classNameFactory("vc-customavatars-");

export function SetAvatarModal({ userId, modalProps }: { userId: string; modalProps: ModalProps; }) {
    const [url, setUrl] = useState(avatars[userId] ?? "");

    const forceUpdate = () => {
        FluxDispatcher.dispatch({ type: "USER_SETTINGS_ACCOUNT_SUBMIT_SUCCESS" });
    };

    const handleSave = async () => {
        if (url.trim()) {
            avatars[userId] = url.trim();
        } else {
            delete avatars[userId];
        }
        await saveAvatars();
        forceUpdate();
        modalProps.onClose();
    };

    const deleteUserAvatar = async () => {
        delete avatars[userId];
        await saveAvatars();
        forceUpdate();
        modalProps.onClose();
    };

    return (
        <ModalRoot {...modalProps}>
            <ModalHeader className={cl("modal-header")}>
                <span style={{ fontSize: "1.25rem", fontWeight: 600, color: "white" }}>Custom Avatar</span>
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
                <div style={{ display: "flex", gap: "8px" }}>
                    {avatars[userId] && (
                        <Button color={Button.Colors.RED} onClick={deleteUserAvatar}>
                            Delete
                        </Button>
                    )}
                    <Button onClick={handleSave}>Save</Button>
                </div>
            </ModalFooter>
        </ModalRoot>
    );
}