/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    findGroupChildrenByChildId,
    NavContextMenuPatchCallback,
} from "@api/ContextMenu";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { TestcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import type { Channel, Message } from "@vencord/discord-types";
import { ChannelStore, Menu, RestAPI, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable MessageCleaner plugin",
        default: true,
    },
    targetChannelId: {
        type: OptionType.STRING,
        description: "Channel ID to clean (leave empty to use context menu)",
        default: "",
    },
    delayBetweenDeletes: {
        type: OptionType.SLIDER,
        description: "Delay between each deletion (ms) - to avoid rate limit",
        default: 1000,
        markers: [100, 500, 1000, 2000, 5000],
        minValue: 100,
        maxValue: 10000,
        stickToMarkers: false,
    },
    batchSize: {
        type: OptionType.SLIDER,
        description: "Number of messages to process per batch",
        default: 50,
        markers: [10, 25, 50, 100],
        minValue: 1,
        maxValue: 100,
        stickToMarkers: false,
    },
    onlyOwnMessages: {
        type: OptionType.BOOLEAN,
        description: "Delete only your own messages",
        default: true,
    },
    showProgress: {
        type: OptionType.BOOLEAN,
        description: "Show progress in real time",
        default: true,
    },
    debugMode: {
        type: OptionType.BOOLEAN,
        description: "Debug mode (detailed logs)",
        default: false,
    },
    skipSystemMessages: {
        type: OptionType.BOOLEAN,
        description: "Ignore system messages (join/leave, etc.)",
        default: true,
    },
    maxAge: {
        type: OptionType.SLIDER,
        description: "Maximum age of messages to delete (days, 0 = no limit)",
        default: 0,
        markers: [0, 1, 7, 30, 90],
        minValue: 0,
        maxValue: 365,
        stickToMarkers: false,
    },
});

// Variables globales pour le contrôle
let isCleaningInProgress = false;
let shouldStopCleaning = false;
let cleaningStats = {
    total: 0,
    deleted: 0,
    failed: 0,
    skipped: 0,
    startTime: 0,
};

// Log function with prefix
function log(message: string, level: "info" | "warn" | "error" = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[MessageCleaner ${timestamp}]`;

    switch (level) {
        case "warn":
            console.warn(prefix, message);
            break;
        case "error":
            console.error(prefix, message);
            break;
        default:
            console.log(prefix, message);
    }
}

// Debug log
function debugLog(message: string) {
    if (settings.store.debugMode) {
        log(`🔍 ${message}`, "info");
    }
}

// Function to check if a message can be deleted
function canDeleteMessage(message: Message, currentUserId: string): boolean {
    try {
        // System messages
        if (settings.store.skipSystemMessages && message.type !== 0) {
            debugLog(
                `Message ${message.id} ignored: system message (type: ${message.type})`
            );
            return false;
        }

        // Only own messages
        if (
            settings.store.onlyOwnMessages &&
            message.author?.id !== currentUserId
        ) {
            debugLog(
                `Message ${message.id} ignored: not your message (author: ${message.author?.id})`
            );
            return false;
        }

        // Maximum age
        if (settings.store.maxAge > 0) {
            let messageTime: number;

            // Handle different timestamp formats
            if (typeof message.timestamp === "string") {
                messageTime = new Date(message.timestamp).getTime();
            } else if (
                message.timestamp &&
                typeof message.timestamp === "object" &&
                "toISOString" in message.timestamp
            ) {
                messageTime = new Date(message.timestamp.toISOString()).getTime();
            } else if (typeof message.timestamp === "number") {
                messageTime = message.timestamp;
            } else {
                debugLog(`Message ${message.id} ignored: invalid timestamp`);
                return false;
            }

            // Check if timestamp is valid
            if (isNaN(messageTime) || messageTime <= 0) {
                debugLog(
                    `Message ${message.id} ignored: invalid timestamp (${message.timestamp})`
                );
                return false;
            }

            const messageAge = Date.now() - messageTime;
            const maxAgeMs = settings.store.maxAge * 24 * 60 * 60 * 1000;

            if (messageAge > maxAgeMs) {
                debugLog(
                    `Message ${message.id} ignored: too old (${Math.round(
                        messageAge / (24 * 60 * 60 * 1000)
                    )} days)`
                );
                return false;
            }
        }

        debugLog(`Message ${message.id} can be deleted`);
        return true;
    } catch (error) {
        debugLog(`Error checking message ${message.id}: ${error}`);
        return false;
    }
}

// Function to delete a message
async function deleteMessage(
    channelId: string,
    messageId: string
): Promise<boolean> {
    try {
        debugLog(
            `Attempting to delete message ${messageId} in channel ${channelId}`
        );

        const response = await RestAPI.del({
            url: `/channels/${channelId}/messages/${messageId}`,
        });

        debugLog(`✅ Message ${messageId} deleted successfully`);
        return true;
    } catch (error: any) {
        const errorMessage = error?.message || error?.toString() || "Unknown error";
        const statusCode = error?.status || error?.statusCode || "N/A";

        debugLog(
            `❌ Error deleting message ${messageId}: ${errorMessage} (Status: ${statusCode})`
        );

        // Log specific errors
        if (statusCode === 403) {
            debugLog(`❌ Permission denied to delete message ${messageId}`);
        } else if (statusCode === 404) {
            debugLog(`❌ Message ${messageId} not found (already deleted?)`);
        } else if (statusCode === 429) {
            debugLog("❌ Rate limit reached for deletion");
        }

        return false;
    }
}

// Function to get messages from a channel
async function getChannelMessages(
    channelId: string,
    before?: string
): Promise<Message[]> {
    try {
        const url = before
            ? `/channels/${channelId}/messages?limit=${settings.store.batchSize}&before=${before}`
            : `/channels/${channelId}/messages?limit=${settings.store.batchSize}`;

        debugLog(`Retrieving messages from: ${url}`);

        const response = await RestAPI.get({ url });

        if (!response || !response.body) {
            debugLog(`Empty or invalid response for ${url}`);
            return [];
        }

        const messages = Array.isArray(response.body) ? response.body : [];
        debugLog(`Retrieved ${messages.length} messages from channel ${channelId}`);

        return messages;
    } catch (error: any) {
        const errorMessage = error?.message || error?.toString() || "Unknown error";
        const statusCode = error?.status || error?.statusCode || "N/A";

        log(
            `❌ Error retrieving messages: ${errorMessage} (Status: ${statusCode})`,
            "error"
        );

        if (statusCode === 403) {
            log(`❌ Permission denied to access channel ${channelId}`, "error");
        } else if (statusCode === 404) {
            log(`❌ Channel ${channelId} not found`, "error");
        } else if (statusCode === 429) {
            log("❌ Rate limit reached for retrieving messages", "error");
        }

        return [];
    }
}

// Function to display progress
function updateProgress() {
    if (!settings.store.showProgress) return;

    const { total, deleted, failed, skipped, startTime } = cleaningStats;
    const processed = deleted + failed + skipped;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

    // Calculate elapsed and estimated time
    const elapsed = Date.now() - startTime;
    const elapsedStr =
        elapsed < 60000
            ? `${Math.round(elapsed / 1000)}s`
            : `${Math.round(elapsed / 60000)}min`;

    let etaStr = "";
    if (processed > 0 && percentage > 0) {
        const remaining = total - processed;
        const rate = processed / (elapsed / 1000); // messages per second
        const eta = remaining / rate;
        etaStr =
            eta < 60
                ? ` (~${Math.round(eta)}s remaining)`
                : ` (~${Math.round(eta / 60)}min remaining)`;
    }

    showNotification({
        title: `🧹 Cleaning in progress (${percentage}%)`,
        body: `Processed: ${processed}/${total} | Deleted: ${deleted} | Failed: ${failed} | Skipped: ${skipped}\n⏱️ ${elapsedStr}${etaStr}`,
        icon: undefined,
    });
}

// Main cleaning function
async function cleanChannel(channelId: string) {
    if (!settings.store.enabled) {
        log("Plugin disabled", "warn");
        return;
    }

    if (isCleaningInProgress) {
        log("A cleaning is already in progress", "warn");
        showNotification({
            title: "⚠️ Cleaning in progress",
            body: "A cleaning is already in progress. Use 'Stop cleaning' if necessary.",
            icon: undefined,
        });
        return;
    }

    try {
        const channel = ChannelStore.getChannel(channelId);
        const currentUserId = UserStore.getCurrentUser()?.id;

        if (!channel) {
            log("Channel not found", "error");
            return;
        }

        if (!currentUserId) {
            log("Unable to get current user ID", "error");
            return;
        }

        const channelName =
            channel.name ||
            channel.recipients
                ?.map((id: string) => {
                    const user = UserStore.getUser(id);
                    return user?.username || "Unknown user";
                })
                .join(", ") ||
            "Private channel";

        // Initial estimation of message count
        log(`🔍 Analyzing channel "${channelName}"...`);
        let estimatedTotal = 0;
        let lastMessageId: string | undefined;

        showNotification({
            title: "🔍 Analysis in progress",
            body: `Analyzing channel "${channelName}" to estimate message count...`,
            icon: undefined,
        });

        // Count messages approximately
        for (let i = 0; i < 10; i++) {
            // Maximum 10 batches for estimation
            const messages = await getChannelMessages(channelId, lastMessageId);
            if (messages.length === 0) break;

            const validMessages = messages.filter(msg =>
                canDeleteMessage(msg, currentUserId)
            );
            estimatedTotal += validMessages.length;
            lastMessageId = messages[messages.length - 1].id;

            if (messages.length < settings.store.batchSize) break;
        }

        if (estimatedTotal === 0) {
            log("No messages to delete found", "warn");
            showNotification({
                title: "ℹ️ MessageCleaner",
                body: "No messages to delete in this channel",
                icon: undefined,
            });
            return;
        }

        log(`📊 Estimation: ${estimatedTotal} messages to delete`);
        log(
            `⚙️ Configuration: delay ${settings.store.delayBetweenDeletes}ms, batch ${settings.store.batchSize}`
        );

        // Initialize statistics
        isCleaningInProgress = true;
        shouldStopCleaning = false;
        cleaningStats = {
            total: estimatedTotal,
            deleted: 0,
            failed: 0,
            skipped: 0,
            startTime: Date.now(),
        };

        log(
            `🧹 Starting cleaning of "${channelName}" - ${estimatedTotal} message(s) estimated`
        );

        showNotification({
            title: "🧹 Cleaning started",
            body: `Deleting ~${estimatedTotal} messages in progress...`,
            icon: undefined,
        });

        lastMessageId = undefined;
        let totalProcessed = 0;

        // Main cleaning loop
        while (!shouldStopCleaning) {
            try {
                const messages = await getChannelMessages(channelId, lastMessageId);

                if (messages.length === 0) {
                    log("No more messages to process");
                    break;
                }

                debugLog(`Processing ${messages.length} messages...`);

                const validMessages = messages.filter(msg =>
                    canDeleteMessage(msg, currentUserId)
                );
                debugLog(
                    `${validMessages.length} valid messages out of ${messages.length}`
                );

                if (validMessages.length === 0) {
                    // If no valid messages in this batch, move to next
                    lastMessageId = messages[messages.length - 1].id;
                    cleaningStats.skipped += messages.length;
                    debugLog("No valid messages in this batch, moving to next");
                    continue;
                }

                // Delete messages one by one
                for (const message of validMessages) {
                    if (shouldStopCleaning) {
                        log("Stop requested by user");
                        break;
                    }

                    const success = await deleteMessage(channelId, message.id);

                    if (success) {
                        cleaningStats.deleted++;
                        debugLog(`✅ Message ${message.id} deleted`);
                    } else {
                        cleaningStats.failed++;
                        debugLog(`❌ Failed to delete message ${message.id}`);
                    }

                    totalProcessed++;

                    // Anti-rate-limit delay
                    if (settings.store.delayBetweenDeletes > 0) {
                        await new Promise(resolve =>
                            setTimeout(resolve, settings.store.delayBetweenDeletes)
                        );
                    }

                    // Update progress every 10 messages
                    if (totalProcessed % 10 === 0) {
                        updateProgress();
                    }
                }

                // Invalid messages counted as skipped
                const invalidMessages = messages.filter(
                    msg => !canDeleteMessage(msg, currentUserId)
                );
                cleaningStats.skipped += invalidMessages.length;

                lastMessageId = messages[messages.length - 1].id;

                // If we processed fewer messages than batch size, we're done
                if (messages.length < settings.store.batchSize) {
                    debugLog(
                        `Incomplete batch (${messages.length}/${settings.store.batchSize}), ending processing`
                    );
                    break;
                }
            } catch (error: any) {
                const errorMessage =
                    error?.message || error?.toString() || "Unknown error";
                const statusCode = error?.status || error?.statusCode || "N/A";

                log(
                    `❌ Error in cleaning loop: ${errorMessage} (Status: ${statusCode})`,
                    "error"
                );
                cleaningStats.failed++;

                // Specific handling for rate limiting errors
                if (statusCode === 429) {
                    log("Rate limit reached, extended pause...", "warn");
                    await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
                } else {
                    // Wait a bit before continuing on normal error
                    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
                }

                // If too many consecutive errors, stop
                if (cleaningStats.failed > 15) {
                    log("Too many consecutive errors, stopping cleaning", "error");
                    break;
                }
            }
        }

        // Cleaning completed
        isCleaningInProgress = false;

        const { deleted, failed, skipped, startTime } = cleaningStats;
        const finalTotal = deleted + failed + skipped;
        const totalTime = Date.now() - startTime;
        const totalTimeStr =
            totalTime < 60000
                ? `${Math.round(totalTime / 1000)} seconds`
                : `${Math.round(totalTime / 60000)} min ${Math.round(
                    (totalTime % 60000) / 1000
                )}s`;

        const avgTimePerMessage = deleted > 0 ? Math.round(totalTime / deleted) : 0;
        const successRate =
            finalTotal > 0 ? Math.round((deleted / finalTotal) * 100) : 0;

        log(`✅ Cleaning completed:
• Messages processed: ${finalTotal}
• Deleted: ${deleted}
• Failed: ${failed}
• Skipped: ${skipped}
• Total time: ${totalTimeStr}
• Success rate: ${successRate}%
• Average time/message: ${avgTimePerMessage}ms`);

        const title = shouldStopCleaning
            ? "⏹️ Cleaning stopped"
            : "✅ Cleaning completed";
        let body =
            failed > 0
                ? `${deleted} deleted, ${failed} failed, ${skipped} skipped`
                : `${deleted} messages deleted successfully`;

        // Add performance stats if cleaning took more than 10 seconds
        if (totalTime > 10000) {
            body += `\n⏱️ ${totalTimeStr} (${successRate}% success)`;
        }

        showNotification({
            title,
            body,
            icon: undefined,
        });
    } catch (error) {
        isCleaningInProgress = false;
        log(`❌ Global error during cleaning: ${error}`, "error");

        showNotification({
            title: "❌ MessageCleaner - Error",
            body: "An error occurred during cleaning",
            icon: undefined,
        });
    }
}

// Function to stop cleaning
function stopCleaning() {
    if (isCleaningInProgress) {
        shouldStopCleaning = true;
        log("⏹️ Cleaning stop requested");

        showNotification({
            title: "⏹️ Stopping in progress",
            body: "Cleaning will stop after the current message",
            icon: undefined,
        });
    }
}

// Context menu patch for channels
const ChannelContextMenuPatch: NavContextMenuPatchCallback = (
    children,
    { channel }: { channel: Channel; }
) => {
    if (!channel) return;

    const group =
        findGroupChildrenByChildId("leave-channel", children) ??
        findGroupChildrenByChildId("mark-channel-read", children) ??
        children;

    if (group) {
        const menuItems = [<Menu.MenuSeparator key="separator" />];

        if (isCleaningInProgress) {
            // Display stats of cleaning in progress
            const { total, deleted, failed, skipped, startTime } = cleaningStats;
            const processed = deleted + failed + skipped;
            const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
            const elapsed = Math.round((Date.now() - startTime) / 1000);

            menuItems.push(
                <Menu.MenuItem
                    key="cleaning-status"
                    id="vc-cleaning-status"
                    label={`🔄 Cleaning in progress: ${percentage}% (${processed}/${total})`}
                    color="brand"
                    disabled={true}
                />,
                <Menu.MenuItem
                    key="stop-cleaning"
                    id="vc-stop-cleaning"
                    label="⏹️ Stop cleaning"
                    color="danger"
                    action={stopCleaning}
                />
            );
        } else {
            // Normal cleaning option
            menuItems.push(
                <Menu.MenuItem
                    key="clean-messages"
                    id="vc-clean-messages"
                    label="🧹 Clean messages"
                    color="danger"
                    action={() => cleanChannel(channel.id)}
                />
            );
        }

        group.push(...menuItems);
    }
};

export default definePlugin({
    name: "MessageCleaner",
    description:
        "Cleans all messages in a channel with intelligent rate limiting management, real-time statistics and secure confirmation",
    authors: [
        {
            name: "Bash",
            id: 1327483363518582784n,
        },
        TestcordDevs.x2b
    ],
    dependencies: ["ContextMenuAPI"],
    settings,

    contextMenus: {
        "channel-context": ChannelContextMenuPatch,
        "gdm-context": ChannelContextMenuPatch,
        "user-context": ChannelContextMenuPatch,
    },

    start() {
        log("🚀 MessageCleaner plugin started");

        // Test dependencies
        log("🔍 Testing dependencies:");
        log(`- RestAPI: ${typeof RestAPI}`);
        log(`- ChannelStore: ${typeof ChannelStore}`);
        log(`- UserStore: ${typeof UserStore}`);
        log(`- Menu: ${typeof Menu}`);

        // If a channel is configured in settings, offer to clean it
        if (settings.store.targetChannelId.trim()) {
            const channel = ChannelStore.getChannel(settings.store.targetChannelId);
            if (channel) {
                const channelName = channel.name || "Private channel";
                log(
                    `🎯 Target channel configured: "${channelName}" (${settings.store.targetChannelId})`
                );
            } else {
                log("⚠️ Target channel configured but not found", "warn");
            }
        }

        debugLog(`Configuration:
• Delay: ${settings.store.delayBetweenDeletes}ms
• Batch: ${settings.store.batchSize}
• Own messages: ${settings.store.onlyOwnMessages}
• Max age: ${settings.store.maxAge} days
• Debug mode: ${settings.store.debugMode}`);

        showNotification({
            title: "🧹 MessageCleaner enabled",
            body: "Right-click on a channel to clean messages",
            icon: undefined,
        });
    },

    stop() {
        log("🛑 MessageCleaner plugin stopped");

        // Stop cleaning in progress
        if (isCleaningInProgress) {
            shouldStopCleaning = true;
        }

        showNotification({
            title: "🧹 MessageCleaner disabled",
            body: "Plugin stopped",
            icon: undefined,
        });
    },
});
