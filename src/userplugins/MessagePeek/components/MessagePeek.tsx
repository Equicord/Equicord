import { findByPropsLazy } from "@webpack";
import { MessageStore, Parser, TooltipContainer, useStateFromStores } from "@webpack/common";
import { Message } from "discord-types/general";
import { MessagePeekProps } from "../types";
import "./styles.css";

const ChannelWrapperStyles = findByPropsLazy("muted", "subText");
const ChannelStyles = findByPropsLazy("closeButton", "subtext");

export default function MessagePeek(props: MessagePeekProps) {
    const { channel, channel_url } = props;
    if (!channel && !channel_url) return null;

    let channelId = channel ? channel.id : channel_url.split("/").pop() as string;
    
    const lastMessage: Message = useStateFromStores([MessageStore], () => MessageStore.getMessages(channelId)?.last());
    if (!lastMessage) return null;
    const attachmentCount = lastMessage.attachments.length;
    const content =
        lastMessage.content ||
        lastMessage.embeds?.[0]?.rawDescription ||
        lastMessage.stickerItems.length && "Sticker" ||
        attachmentCount && `${attachmentCount} attachment${attachmentCount > 1 ? "s" : ""}`;
    if (!content) return null;

    return (
        <div
            className={ChannelWrapperStyles.subText}
            style={{ marginBottom: "2px" }}
        >
            <TooltipContainer text={content.length > 256 ? Parser.parse(content.slice(0, 256).trim()) : Parser.parse(content)}>
                <div className={ChannelStyles.subtext}>
                    {`${lastMessage.author["globalName"] || lastMessage.author.username}: `}
                    {Parser.parseInlineReply(content)}
                </div>
            </TooltipContainer>
        </div>
    )
}
