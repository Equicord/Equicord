import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import type { Channel } from "@vencord/discord-types";
import { GuildStore, IconUtils, React } from "@webpack/common";

export function SlotAvailableModal({ modalProps, channel, onJoin, }: { modalProps: ModalProps; channel: Channel; onJoin: () => void; }) {
    const guild = GuildStore.getGuild(channel.guild_id);
    const guildIcon = guild?.icon == null ? undefined : IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 32 });

    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader className="vc-wfs-header">
                <BaseText size="lg" weight="semibold">Slot Available</BaseText>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div className="vc-wfs-vc-row">
                    {guildIcon && <img className="vc-wfs-guild-icon" src={guildIcon} alt="" />}
                    <BaseText size="md" weight="semibold">{channel.name}</BaseText>
                </div>
                <Paragraph size="md" className="vc-wfs-available-text">
                    A slot is available for this voice channel. Would you like to join?
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
