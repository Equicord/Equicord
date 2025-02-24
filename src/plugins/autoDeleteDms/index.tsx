/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated, Samu and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher } from "@webpack/common";

const MessageStore = findByPropsLazy("getMessage", "getMessages");
const ChannelStore = findByPropsLazy("getDMFromUserId");
const DeleteMessageStore = findByPropsLazy("deleteMessage");
const UserStore = findByPropsLazy("getCurrentUser");

const settings = definePluginSettings({
    deleteAfterValue: {
        type: OptionType.NUMBER,
        description: "Delete messages after (value)",
        default: 24
    },
    timeUnit: {
        type: OptionType.SELECT,
        description: "Time unit for deletion",
        options: [
            { label: "Seconds", value: "seconds" },
            { label: "Minutes", value: "minutes" },
            { label: "Hours", value: "hours" }
        ],
        default: "hours"
    },
    userSpecificTimes: {
        type: OptionType.STRING,
        description: "User-specific deletion times Example:\n123456789:30:seconds\n987654321:5:minutes\n456789123:2:hours",
        default: ""
    },
    targetUsers: {
        type: OptionType.STRING,
        description: "Only delete messages from these User IDs (comma-separated, leave empty for all)",
        default: ""
    },
    excludedUsers: {
        type: OptionType.STRING,
        description: "Excluded User IDs (comma-separated)",
        default: ""
    }
});

interface DiscordAPIError {
    status: number;
    body?: {
        retry_after?: number;
    };
    message?: string;
}

export default definePlugin({
    name: "AutoDeleteDMs",
    description: "Automatically deletes DMs after a specified time period",
    authors: [EquicordDevs.ExoDev],
    settings,

    messageTimestamps: new Map<string, { timestamp: number, userId: string, channelId: string; }>(),
    cleanupInterval: null as NodeJS.Timeout | null,
    deletionQueue: [] as Array<{ messageId: string; channelId: string; }>,
    isProcessingQueue: false,
    retryDelay: 1000,
    maxRetryDelay: 300000,
    rateLimitHits: 0,

    start() {
        console.log("[AutoDeleteDMs] Plugin starting with settings:", {
            deleteAfterValue: settings.store.deleteAfterValue,
            timeUnit: settings.store.timeUnit,
            targetUsers: settings.store.targetUsers,
            userSpecificTimes: settings.store.userSpecificTimes
        });

        this.handleNewMessage = this.handleNewMessage.bind(this);
        FluxDispatcher.subscribe("MESSAGE_CREATE", this.handleNewMessage);
        this.startCleanupInterval();

        console.log("[AutoDeleteDMs] Plugin started successfully");
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", this.handleNewMessage);
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.deletionQueue = [];
        this.isProcessingQueue = false;
        this.retryDelay = 1000;
        this.rateLimitHits = 0;
    },

    getDeleteTime(userId: string): number {
        const userSpecific = settings.store.userSpecificTimes
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean)
            .find(line => line.startsWith(userId + ":"));

        if (userSpecific) {
            const [, value, unit] = userSpecific.split(":");
            return this.convertToMilliseconds(parseFloat(value), unit);
        }

        return this.convertToMilliseconds(
            settings.store.deleteAfterValue,
            settings.store.timeUnit
        );
    },

    convertToMilliseconds(value: number, unit: string | undefined): number {
        switch (unit ?? "hours") {
            case "seconds": return value * 1000;
            case "minutes": return value * 60 * 1000;
            case "hours": return value * 60 * 60 * 1000;
            default: return value * 60 * 60 * 1000;
        }
    },

    handleNewMessage(event: { message: any; }) {
        console.log("[AutoDeleteDMs] Raw message event:", event);

        try {
            const { message } = event;
            if (!message?.channel_id || !message?.author?.id) {
                console.log("[AutoDeleteDMs] Skipping - Invalid message format");
                return;
            }

            const currentUser = UserStore.getCurrentUser();
            console.log("[AutoDeleteDMs] Current user:", currentUser?.id);

            if (!currentUser) return;

            console.log("[AutoDeleteDMs] Message comparison:", {
                authorId: message.author.id,
                currentUserId: currentUser.id,
                isAuthor: message.author.id === currentUser.id,
                content: message.content
            });

            if (message.author.id !== currentUser.id) {
                console.log("[AutoDeleteDMs] Skipping - Not author's message");
                return;
            }

            const channel = ChannelStore.getChannel(message.channel_id);
            console.log("[AutoDeleteDMs] Channel info:", {
                channelId: message.channel_id,
                isDM: channel?.isPrivate?.(),
                recipients: channel?.recipients
            });

            if (!channel?.isPrivate()) return;

            const recipientId = channel.recipients?.[0];
            if (!recipientId) return;

            const targetUsers = settings.store.targetUsers
                .split(",")
                .map(id => id.trim())
                .filter(Boolean);

            console.log("[AutoDeleteDMs] Target users check:", {
                targetUsers,
                recipientId,
                isTarget: targetUsers.length === 0 || targetUsers.includes(recipientId)
            });

            if (targetUsers.length > 0 && !targetUsers.includes(recipientId)) {
                console.log("[AutoDeleteDMs] Skipping - Recipient not in target users");
                return;
            }

            const deleteAfterMs = this.getDeleteTime(recipientId);
            console.log("[AutoDeleteDMs] Deletion schedule:", {
                messageId: message.id,
                deleteAfter: deleteAfterMs / 1000 + " seconds",
                scheduledTime: new Date(Date.now() + deleteAfterMs).toLocaleString()
            });

            this.messageTimestamps.set(message.id, {
                timestamp: Date.now(),
                userId: recipientId,
                channelId: message.channel_id
            });

            console.log("[AutoDeleteDMs] Added to queue. Current queue:",
                Array.from(this.messageTimestamps.entries())
            );

        } catch (err) {
            console.error("[AutoDeleteDMs] Error in handleNewMessage:", err);
        }
    },

    async processQueue() {
        if (this.isProcessingQueue || this.deletionQueue.length === 0) return;

        this.isProcessingQueue = true;
        const item = this.deletionQueue.shift();

        if (item) {
            try {
                const channel = ChannelStore.getChannel(item.channelId);
                if (!channel) {
                    console.debug("[AutoDeleteDMs] Channel not found, skipping:", item.channelId);
                    this.isProcessingQueue = false;
                    if (this.deletionQueue.length > 0) this.processQueue();
                    return;
                }
                const message = await this.safeGetMessage(item.messageId, item.channelId);
                if (!message) {
                    console.debug("[AutoDeleteDMs] Message not found or inaccessible:", item.messageId);
                    this.isProcessingQueue = false;
                    if (this.deletionQueue.length > 0) this.processQueue();
                    return;
                }

                await this.safeDeleteMessage(item.channelId, item.messageId);
                this.rateLimitHits = 0;
                this.retryDelay = 1000;
            } catch (error: any) {
                this.handleDeletionError(error, item);
            } finally {
                await new Promise(resolve => setTimeout(resolve, 2500));
                this.isProcessingQueue = false;
                if (this.deletionQueue.length > 0) this.processQueue();
            }
        }
    },

    async safeGetMessage(messageId: string, channelId: string) {
        try {
            const cachedMessage = MessageStore.getMessage(messageId);
            if (cachedMessage?.author?.id === UserStore.getCurrentUser().id) {
                return cachedMessage;
            }
            try {
                const channel = ChannelStore.getChannel(channelId);
                if (!channel?.isPrivate()) return null;

                const messages = await MessageStore.getMessages(channelId)
                    .fetch({ limit: 1, around: messageId })
                    .catch(() => null);

                const fetchedMessage = messages?.get(messageId);
                return fetchedMessage?.author?.id === UserStore.getCurrentUser().id ? fetchedMessage : null;
            } catch {
                return null;
            }
        } catch (err) {
            console.debug("[AutoDeleteDMs] Error getting message:", err);
            return null;
        }
    },

    async safeDeleteMessage(channelId: string, messageId: string, retryCount = 0) {
        try {
            await DeleteMessageStore.deleteMessage(channelId, messageId);
        } catch (error) {
            const discordError = error as DiscordAPIError;
            if (discordError?.status === 429 && retryCount < 3) {
                const retryAfter = discordError.body?.retry_after || 5;
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                return this.safeDeleteMessage(channelId, messageId, retryCount + 1);
            }
            throw error;
        }
    },

    handleDeletionError(error: unknown, item: { messageId: string; channelId: string; }) {
        const discordError = error as DiscordAPIError;
        if (discordError?.status === 404) {
            console.debug("[AutoDeleteDMs] Resource not found:", item.messageId);
        } else if (discordError?.status === 429) {
            this.rateLimitHits++;
            const retryAfter = discordError.body?.retry_after || this.retryDelay;
            this.retryDelay = Math.min(
                Math.max(retryAfter * 1000, this.retryDelay * Math.pow(2, this.rateLimitHits)),
                this.maxRetryDelay
            );
            this.deletionQueue.unshift(item);
            console.debug(`[AutoDeleteDMs] Rate limited. Retrying in ${this.retryDelay}ms`);
        } else {
            console.error("[AutoDeleteDMs] Unexpected error:", error);
        }
    },

    async checkMessages() {
        console.log("[AutoDeleteDMs] Checking messages, queue size:", this.messageTimestamps.size);
        try {
            if (this.isProcessingQueue) {
                console.log("[AutoDeleteDMs] Queue is being processed, skipping check");
                return;
            }

            const now = Date.now();
            const messagesToProcess = Array.from(this.messageTimestamps.entries());

            console.log("[AutoDeleteDMs] Processing messages:", messagesToProcess.length);

            for (const [messageId, data] of messagesToProcess) {
                try {
                    const deleteAfterMs = this.getDeleteTime(data.userId);
                    const timeSinceMessage = now - data.timestamp;

                    console.log("[AutoDeleteDMs] Checking message:", {
                        messageId,
                        timeSinceMessage: Math.floor(timeSinceMessage / 1000) + "s",
                        deleteAfter: Math.floor(deleteAfterMs / 1000) + "s",
                        shouldDelete: timeSinceMessage >= deleteAfterMs
                    });

                    if (timeSinceMessage >= deleteAfterMs) {
                        console.log("[AutoDeleteDMs] Attempting to delete message:", messageId);
                        try {
                            await DeleteMessageStore.deleteMessage(data.channelId, messageId);
                            console.log("[AutoDeleteDMs] Successfully deleted message:", messageId);
                        } catch (error) {
                            console.error("[AutoDeleteDMs] Failed to delete message:", error);
                            const discordError = error as DiscordAPIError;
                            if (discordError?.status !== 429) {
                                this.messageTimestamps.delete(messageId);
                            }
                        }
                    }
                } catch (err) {
                    console.error("[AutoDeleteDMs] Error processing message:", messageId, err);
                    this.messageTimestamps.delete(messageId);
                }
            }
        } catch (err) {
            console.error("[AutoDeleteDMs] Error in checkMessages:", err);
        } finally {
            this.isProcessingQueue = false;
        }
    },

    startCleanupInterval() {
        console.log("[AutoDeleteDMs] Starting cleanup interval");
        this.checkMessages();
        this.cleanupInterval = setInterval(() => {
            console.log("[AutoDeleteDMs] Running periodic check");
            this.checkMessages();
        }, 2000);
    }
});
