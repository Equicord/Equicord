import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import type { Channel } from "@vencord/discord-types";
import { React } from "@webpack/common";

export function SlotAvailableModal({ modalProps, channel, onJoin, }: { modalProps: ModalProps; channel: Channel; onJoin: () => void; }) {
    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader className="vc-wfs-header">
                <BaseText size="lg" weight="semibold">Slot Available</BaseText>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Paragraph size="md" className="vc-wfs-available-text">
                    Would you like to join <strong>{channel.name}</strong>?
                </Paragraph>
            </ModalContent>
            <ModalFooter justify="start" direction="horizontal" className="vc-wfs-footer">
                <Button
                    onClick={() => {
                        onJoin();
                        modalProps.onClose();
                    }}
                    variant="positive"
                    size="small"
                >
                    Yes
                </Button>
                <Button
                    onClick={modalProps.onClose}
                    variant="dangerPrimary"
                    size="small"
                >
                    No
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
