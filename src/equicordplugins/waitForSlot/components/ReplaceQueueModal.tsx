import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import type { Channel } from "@vencord/discord-types";
import { React } from "@webpack/common";

export function ReplaceQueueModal({ modalProps, channel, onReplace, }: { modalProps: ModalProps; channel: Channel; onReplace: () => void; }) {
    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader className="vc-wfs-header">
                <BaseText size="lg" weight="semibold">Replace Wait Queue</BaseText>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div className="vc-wfs-prompt">
                    <Paragraph size="md" className="vc-wfs-prompt-text">
                        You are already waiting for a slot. Replace it with <strong>{channel.name}</strong>?
                    </Paragraph>
                </div>
            </ModalContent>
            <ModalFooter justify="start" direction="horizontal" className="vc-wfs-footer">
                <Button
                    onClick={() => {
                        onReplace();
                        modalProps.onClose();
                    }}
                    variant="positive"
                    size="small"
                >
                    Replace
                </Button>
                <Button
                    onClick={modalProps.onClose}
                    variant="dangerPrimary"
                    size="small"
                >
                    Cancel
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}
