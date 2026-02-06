import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import type { Channel } from "@vencord/discord-types";
import { React } from "@webpack/common";

export function WaitPromptModal({ modalProps, channel, onWait, onDecline, }: { modalProps: ModalProps; channel: Channel; onWait: () => void; onDecline: () => void; }) {
    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader className="vc-wfs-header">
                <BaseText size="lg" weight="semibold">Channel Full</BaseText>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Paragraph size="md">
                    Would you like to wait for a slot in <strong>{channel.name}</strong>?
                </Paragraph>
            </ModalContent>
            <ModalFooter justify="start" direction="horizontal" className="vc-wfs-footer">
                <Button
                    onClick={() => {
                        onWait();
                        modalProps.onClose();
                    }}
                    variant="positive"
                    size="small"
                >
                    Yes
                </Button>
                <Button
                    onClick={() => {
                        onDecline();
                        modalProps.onClose();
                    }}
                    variant="dangerPrimary"
                    size="small"
                >
                    No
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
