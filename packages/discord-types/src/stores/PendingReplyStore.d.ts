import { Channel, FluxStore, Message } from "..";

/** Full pending reply state object */
interface PendingReply {
    /** The channel in which the pending reply was created */
    channel: Channel;
    /** The message that you're replying to */
    message: Message;
    /** Whether to ping the person you're replying to */
    shouldMention: boolean;
    /** Whether to show the ping \@ON/\@OFF toggle. Disabled by default for self-replies. */
    showMentionToggle: boolean;
}

/** Shallow state object which is persisted between restarts. Based on {@link PendingReply}. */
interface PendingReplyState {
    channelId: string;
    messageId: string;
    shouldMention: boolean;
    showMentionToggle: boolean;
}

export class PendingReplyStore extends FluxStore {
    getState(): Record<string, PendingReplyState>;
    getPendingReply(channelId: string): PendingReply | undefined;
}
