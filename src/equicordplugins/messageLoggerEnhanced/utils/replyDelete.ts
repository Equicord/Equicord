
import { findByProps } from "@webpack";
import { ChannelStore, MessageStore } from "@webpack/common";
import { settings } from "../settings";

export function formatTimestamp(date: Date, format: string): string {
    // Simple formatter or use moment if available
    try {
        const moment = findByProps("moment")?.moment || (window as any).moment;
        if (moment) return moment(date).format(format);
    } catch { }

    // Fallback simple formatter or just toISOString
    return date.toLocaleString();
}

export function processTemplate(template: string, message: any, replyContent: string): string {
    return template.replace(/{(\w+)(?::([^}]+))?}/g, (match, key, arg) => {
        switch (key) {
            case "sent":
                return formatTimestamp(new Date(message.timestamp), arg || "dd/MM/yyyy HH:mm");
            case "sent_unix":
                return Math.floor(new Date(message.timestamp).getTime() / 1000).toString();
            case "author_id":
                return message.author.id;
            case "author_username":
                return message.author.username;
            case "message_id":
                return message.id;
            case "channel_id":
                return message.channel_id;
            case "guild_id":
                return ChannelStore.getChannel(message.channel_id)?.guild_id || "";
            case "message":
                return message.content;
            case "reply":
                return replyContent;
            default:
                return match;
        }
    });
}

export function checkAndPatch(MessageActionCreators: any, funcName: string) {
    // We use a monkey patch because we might want to intercept the Promise result too
    const original = MessageActionCreators[funcName];

    MessageActionCreators[funcName] = async function(...args: any[]) {
        if (!settings.store.enableReplyToDeleted) {
            return original.apply(this, args);
        }

        // Locate options argument by finding one with messageReference
        const optionsIndex = args.findIndex(a => a && typeof a === "object" && "messageReference" in a);

        if (optionsIndex !== -1) {
            const options = args[optionsIndex];
            const refId = options.messageReference.message_id;
            const channelId = args[0]; // Channel ID is consistently the first argument
            const message = MessageStore.getMessage(channelId, refId);

            // Scenario C: Message NOT found (potentially deleted but not cached/logged)
            if (!message) {
                const { showToast, Toasts } = findByProps("showToast");
                showToast("Cannot reply: Original message not found (potentially deleted).", Toasts.Type.FAILURE);
                return Promise.reject(new Error("MessageLoggerReply blocked: Message not found"));
            }

            // Scenario A: Message found and marked deleted by MessageLogger
            if (message.deleted) {
                const contentIndex = 1;
                const contentArg = args[contentIndex];
                // const rawContent = typeof contentArg === "string" ? contentArg : contentArg?.content || "";

                const newContentStr = processTemplate(settings.store.replyTemplate, message, typeof contentArg === "string" ? contentArg : contentArg?.content || "");

                // Update content argument
                if (typeof contentArg === "string") {
                    args[contentIndex] = newContentStr;
                } else if (typeof contentArg === "object") {
                    args[contentIndex] = { ...contentArg, content: newContentStr };
                }

                // Remove message reference from options
                const newOptions = { ...options };
                delete newOptions.messageReference;
                args[optionsIndex] = newOptions; // Replace options in args

                return original.apply(this, args);
            }
        }

        // Scenario B: Normal send, catch specific failures
        try {
            return await original.apply(this, args);
        } catch (err: any) {
             // Check if error is "Unknown Message" (10008) or similar
            if (optionsIndex !== -1 && (err?.body?.code === 10008 || err?.status === 404)) {
                // Retry logic if we have the message in store (but server rejected reply)
                const options = args[optionsIndex];
                const refId = options.messageReference.message_id;
                const channelId = args[0];
                const message = MessageStore.getMessage(channelId, refId);

                if (message) {
                    const contentIndex = 1;
                    const contentArg = args[contentIndex];
                    // const rawContent = typeof contentArg === "string" ? contentArg : contentArg?.content || "";

                    const newContentStr = processTemplate(settings.store.replyTemplate, message, typeof contentArg === "string" ? contentArg : contentArg?.content || "");

                     // Update args for retry
                    if (typeof contentArg === "string") {
                        args[contentIndex] = newContentStr;
                    } else {
                        args[contentIndex] = { ...contentArg, content: newContentStr };
                    }

                    const newOptions = { ...options };
                    delete newOptions.messageReference;
                    args[optionsIndex] = newOptions;

                    return original.apply(this, args);
                }
            }
            throw err;
        }
    };

    return () => {
        MessageActionCreators[funcName] = original;
    };
}
