/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import * as DataStore from "@api/DataStore";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import {
  FluxDispatcher,
  MessageStore,
  RestAPI,
  UserStore,
  Constants,
} from "@webpack/common";
import { findByPropsLazy } from "@webpack";

const MessageActions = findByPropsLazy("deleteMessage", "startEditMessage");

interface TrackedMessage {
  id: string;
  channelId: string;
  guildId?: string;
  timestamp: number;
  scheduledTime: number; // Absolute timestamp of scheduled deletion
  timeoutId?: NodeJS.Timeout; // Optional as it's not saved
  content?: string; // Original content for debug
  length?: number; // Message length
  hasEmbed?: boolean;
  hasAttachment?: boolean;
  hasReactions?: boolean;
  deletionMode?: string; // Specific deletion mode
  priority?: number; // Deletion priority (1-10)
}

interface DeletionStats {
  messagesDeleted: number;
  messagesSaved: number;
  errors: number;
  restoredFromStorage: number;
  hourlyDeletions: number;
  lastHourReset: number;
  totalBytesSaved: number;
  averageMessageLength: number;
  deletionModes: Record<string, number>;
  channelStats: Record<string, number>;
}

const settings = definePluginSettings({
  enabled: {
    type: OptionType.BOOLEAN,
    description: "Enable automatic message deletion",
    default: false,
  },
  defaultDelay: {
    type: OptionType.NUMBER,
    description: "Delay before deletion (in unit specified below)",
    default: 300, // 5 minutes
    min: 5,
    max: 86400, // 24 hours
  },
  delayUnit: {
    type: OptionType.SELECT,
    description: "Time unit",
    options: [
      { label: "Seconds", value: "seconds", default: true },
      { label: "Minutes", value: "minutes" },
      { label: "Hours", value: "hours" },
    ],
  },
  deletionMode: {
    type: OptionType.SELECT,
    description: "Deletion mode",
    options: [
      { label: "Normal deletion", value: "normal", default: true },
      { label: "AntiLog (masks MessageLogger)", value: "antilog" },
      { label: "Silent deletion", value: "silent" },
      { label: "Edit then delete", value: "edit_delete" },
    ],
  },
  channelMode: {
    type: OptionType.SELECT,
    description: "Channel filtering mode",
    options: [
      { label: "All channels", value: "all", default: true },
      { label: "Specific channels only", value: "whitelist" },
      { label: "Exclude certain channels", value: "blacklist" },
      { label: "Specific servers", value: "guilds" },
    ],
  },
  channelList: {
    type: OptionType.STRING,
    description: "Channel IDs (comma-separated)",
    default: "",
  },
  guildList: {
    type: OptionType.STRING,
    description: "Server IDs (comma-separated)",
    default: "",
  },
  preserveKeywords: {
    type: OptionType.STRING,
    description: "Keywords to preserve (comma-separated)",
    default: "",
  },
  deleteKeywords: {
    type: OptionType.STRING,
    description:
      "Keywords for immediate deletion (comma-separated)",
    default: "",
  },
  maxMessageLength: {
    type: OptionType.NUMBER,
    description: "Maximum message length to delete (0 = unlimited)",
    default: 0,
    min: 0,
    max: 2000,
  },
  minMessageLength: {
    type: OptionType.NUMBER,
    description: "Minimum message length to delete",
    default: 0,
    min: 0,
    max: 2000,
  },
  preserveEmbeds: {
    type: OptionType.BOOLEAN,
    description: "Preserve messages with embeds",
    default: true,
  },
  preserveAttachments: {
    type: OptionType.BOOLEAN,
    description: "Preserve messages with attachments",
    default: true,
  },
  preserveReactions: {
    type: OptionType.BOOLEAN,
    description: "Preserve messages with reactions",
    default: false,
  },
  smartDelay: {
    type: OptionType.BOOLEAN,
    description: "Smart delay based on message length",
    default: false,
  },
  notifications: {
    type: OptionType.BOOLEAN,
    description: "Show deletion notifications",
    default: false,
  },
  notificationType: {
    type: OptionType.SELECT,
    description: "Notification type",
    options: [
      { label: "Console only", value: "console", default: true },
      { label: "Toast notifications", value: "toast" },
      { label: "Both", value: "both" },
    ],
  },
  debug: {
    type: OptionType.BOOLEAN,
    description: "Debug mode (detailed logs)",
    default: false,
  },
  useAntiLogDeletion: {
    type: OptionType.BOOLEAN,
    description:
      "Use AntiLog deletion (masks messages from MessageLogger plugins)",
    default: true,
  },
  blockMessage: {
    type: OptionType.STRING,
    description:
      "Text to display instead of deleted message (for AntiLog)",
    default: "x",
  },
  deleteInterval: {
    type: OptionType.NUMBER,
    description:
      "Delay between deletion of old and new message (ms) - for AntiLog",
    default: 200,
  },
  rateLimitHandling: {
    type: OptionType.BOOLEAN,
    description: "Automatic Discord rate limit handling",
    default: true,
  },
  maxRetries: {
    type: OptionType.NUMBER,
    description: "Maximum number of deletion attempts",
    default: 3,
    min: 1,
    max: 10,
  },
  retryDelay: {
    type: OptionType.NUMBER,
    description: "Base delay between attempts (ms)",
    default: 1000,
    min: 100,
    max: 10000,
  },
  adaptiveDelay: {
    type: OptionType.BOOLEAN,
    description: "Automatic delay adjustment based on rate limits",
    default: true,
  },
  aggressiveThrottling: {
    type: OptionType.BOOLEAN,
    description: "Aggressive throttling to avoid rate limits",
    default: true,
  },
  maxDeletionsPerMinute: {
    type: OptionType.NUMBER,
    description: "Maximum number of deletions per minute",
    default: 8,
    min: 1,
    max: 30,
  },
  minDelayBetweenDeletions: {
    type: OptionType.NUMBER,
    description: "Minimum delay between deletions (ms)",
    default: 2000,
    min: 500,
    max: 10000,
  },
  circuitBreakerThreshold: {
    type: OptionType.NUMBER,
    description:
      "Threshold to open circuit breaker (consecutive rate limits)",
    default: 5,
    min: 3,
    max: 20,
  },
  circuitBreakerDuration: {
    type: OptionType.NUMBER,
    description: "Circuit breaker duration (minutes)",
    default: 5,
    min: 1,
    max: 30,
  },
  editMessage: {
    type: OptionType.STRING,
    description: "Replacement text before deletion (edit mode)",
    default: "Message automatically deleted",
  },
  editDelay: {
    type: OptionType.NUMBER,
    description: "Delay before deletion after edit (ms)",
    default: 1000,
  },
  batchDelete: {
    type: OptionType.BOOLEAN,
    description: "Batch deletion to optimize performance",
    default: false,
  },
  batchSize: {
    type: OptionType.NUMBER,
    description: "Batch deletion size",
    default: 5,
    min: 1,
    max: 20,
  },
  batchDelay: {
    type: OptionType.NUMBER,
    description: "Delay between batches (ms)",
    default: 200,
  },
  emergencyStop: {
    type: OptionType.BOOLEAN,
    description: "Emergency stop - cancels all scheduled deletions",
    default: false,
  },
  maxMessagesPerHour: {
    type: OptionType.NUMBER,
    description:
      "Maximum number of messages to delete per hour (0 = unlimited)",
    default: 0,
    min: 0,
    max: 1000,
  },
});

const STORAGE_KEY = "AutoDeleter_TrackedMessages";

// Functions for AntiLog deletion
function messageSendWrapper(content: string, nonce: string, channelId: string) {
  const wrapperResponse = RestAPI.post({
    url: Constants.Endpoints.MESSAGES(channelId),
    body: {
      content: content,
      flags: 0,
      mobile_network_type: "unknown",
      nonce: nonce,
      tts: false,
    },
  });
  return wrapperResponse;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageDeleteWrapper(channelId: string, messageId: string) {
  MessageActions.deleteMessage(channelId, messageId);
}

export default definePlugin({
  name: "AutoDeleter",
  description:
    "Automatically deletes your messages after a configurable delay (persists after restart)",
    authors:  [Devs.rz30,],
  settings,

  // Map to track messages pending deletion
  trackedMessages: new Map<string, TrackedMessage>(),

  // Bound function for MESSAGE_CREATE event
  boundOnMessageCreate: null as any,

  // Advanced statistics
  stats: {
    messagesDeleted: 0,
    messagesSaved: 0,
    errors: 0,
    restoredFromStorage: 0,
    hourlyDeletions: 0,
    lastHourReset: Date.now(),
    totalBytesSaved: 0,
    averageMessageLength: 0,
    deletionModes: {} as Record<string, number>,
    channelStats: {} as Record<string, number>,
  } as DeletionStats,

  // Cache to optimize performance
  messageCache: new Map<string, any>(),
  channelCache: new Map<string, any>(),

  // Batch deletion queue
  deletionQueue: [] as Array<{
    messageId: string;
    channelId: string;
    mode: string;
  }>,
  batchProcessor: null as NodeJS.Timeout | null,

  // Advanced rate limit management
  rateLimitInfo: {
    isRateLimited: false,
    retryAfter: 0,
    lastRateLimit: 0,
    consecutiveRateLimits: 0,
    backoffMultiplier: 1,
    globalCooldown: false,
    globalCooldownUntil: 0,
    circuitBreakerOpen: false,
    circuitBreakerUntil: 0,
    totalRateLimits: 0,
    lastSuccessfulDeletion: 0,
  },

  // Deletion attempt cache
  retryQueue: [] as Array<{
    messageId: string;
    channelId: string;
    mode: string;
    attempts: number;
    nextRetry: number;
  }>,
  retryProcessor: null as NodeJS.Timeout | null,

  // Smart throttling
  throttlingInfo: {
    lastDeletionTime: 0,
    deletionCount: 0,
    windowStart: 0,
    maxDeletionsPerMinute: 10,
    minDelayBetweenDeletions: 2000, // 2 seconds minimum
  },

  async start() {
    this.log("AutoDeleter plugin started");

    // Bind context for onMessageCreate
    this.boundOnMessageCreate = this.onMessageCreate.bind(this);

    // Listen for new messages
    FluxDispatcher.subscribe("MESSAGE_CREATE", this.boundOnMessageCreate);

    // Restore messages from storage
    await this.restoreTrackedMessages();

    this.log(
      `Restoration completed: ${this.stats.restoredFromStorage} messages restored`
    );
  },

  stop() {
    this.log("AutoDeleter plugin stopped");

    // Stop listening to messages
    if (this.boundOnMessageCreate) {
      FluxDispatcher.unsubscribe("MESSAGE_CREATE", this.boundOnMessageCreate);
    }

    // Cancel all pending timeouts
    this.trackedMessages.forEach((message) => {
      if (message.timeoutId) {
        clearTimeout(message.timeoutId);
      }
    });

    // Save remaining messages
    this.saveTrackedMessages();
  },

  // Save scheduled messages
  async saveTrackedMessages() {
    try {
      const messagesToSave = Array.from(this.trackedMessages.values()).map(
        (msg) => ({
          id: msg.id,
          channelId: msg.channelId,
          timestamp: msg.timestamp,
          scheduledTime: msg.scheduledTime,
        })
      );

      await DataStore.set(STORAGE_KEY, messagesToSave);
      this.debug(`Saved: ${messagesToSave.length} messages saved`);
    } catch (error) {
      this.error("Error saving messages:", error);
    }
  },

  // Restore messages from storage
  async restoreTrackedMessages() {
    try {
      const savedMessages = await DataStore.get<TrackedMessage[]>(STORAGE_KEY);

      if (!savedMessages || savedMessages.length === 0) {
        this.debug("No messages to restore");
        return;
      }

      const now = Date.now();
      let restoredCount = 0;

      for (const savedMsg of savedMessages) {
        const timeUntilDeletion = savedMsg.scheduledTime - now;

        // If message should have been deleted, delete it now
        if (timeUntilDeletion <= 0) {
          this.debug(
            `Message ${savedMsg.id} should have been deleted, deleting now`
          );
          await this.deleteMessage(savedMsg.id, savedMsg.channelId);
          continue;
        }

        // Check if message still exists
        try {
          const message = MessageStore.getMessage(
            savedMsg.channelId,
            savedMsg.id
          );
          if (!message) {
            this.debug(`Message ${savedMsg.id} no longer exists, ignored`);
            continue;
          }

          // Reschedule deletion
          this.scheduleMessageDeletionFromRestore(savedMsg, timeUntilDeletion);
          restoredCount++;
        } catch (error) {
          this.debug(`Message ${savedMsg.id} not found, ignored`);
        }
      }

      this.stats.restoredFromStorage = restoredCount;
      this.debug(`Restoration: ${restoredCount} messages rescheduled`);
    } catch (error) {
      this.error("Error restoring messages:", error);
    }
  },

  onMessageCreate(event: any) {
    try {
      if (!settings.store.enabled || settings.store.emergencyStop) return;

      const message = event?.message;
      if (!message) return;

      // Check if it's our message
      const currentUser = UserStore.getCurrentUser();
      if (
        !message.author ||
        !currentUser ||
        message.author.id !== currentUser.id
      ) {
        return;
      }

      // Check circuit breaker
      if (this.rateLimitInfo.circuitBreakerOpen) {
        const now = Date.now();
        if (now < this.rateLimitInfo.circuitBreakerUntil) {
          this.debug("Circuit breaker open - deletion ignored");
          return;
        } else {
          // Reset circuit breaker
          this.rateLimitInfo.circuitBreakerOpen = false;
          this.rateLimitInfo.circuitBreakerUntil = 0;
          this.log("Circuit breaker closed - resuming deletions");
        }
      }

      // Check global cooldown
      if (this.rateLimitInfo.globalCooldown) {
        const now = Date.now();
        if (now < this.rateLimitInfo.globalCooldownUntil) {
          this.debug("Global cooldown active - deletion ignored");
          return;
        } else {
          this.rateLimitInfo.globalCooldown = false;
          this.rateLimitInfo.globalCooldownUntil = 0;
        }
      }

      // Check hourly limit
      if (!this.checkHourlyLimit()) {
        this.debug("Hourly deletion limit reached");
        return;
      }

      // Check smart throttling
      if (!this.checkThrottlingLimits()) {
        this.debug("Throttling limits reached");
        return;
      }

      // Check channel filters
      if (!this.shouldProcessChannel(message.channel_id)) {
        this.debug(`Channel ${message.channel_id} ignored by filters`);
        return;
      }

      // Check server filters
      if (!this.shouldProcessGuild(message.guild_id)) {
        this.debug(`Server ${message.guild_id} ignored by filters`);
        return;
      }

      // Check preserve keywords
      if (this.shouldPreserveMessage(message)) {
        this.debug(`Message preserved due to filters: ${message.content}`);
        this.stats.messagesSaved++;
        return;
      }

      // Check immediate deletion keywords
      if (this.shouldDeleteImmediately(message.content)) {
        this.debug(`Immediate deletion requested: ${message.content}`);
        this.scheduleMessageDeletion(message, 2000); // 2 seconds minimum
        return;
      }

      // Schedule deletion with smart delay
      const delay = this.calculateSmartDelay(message);
      this.scheduleMessageDeletion(message, delay);
    } catch (error) {
      this.error("Error in onMessageCreate:", error);
    }
  },

  shouldProcessChannel(channelId: string): boolean {
    const mode = settings.store.channelMode;
    const channelList = settings.store.channelList
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    switch (mode) {
      case "all":
        return true;
      case "whitelist":
        return channelList.includes(channelId);
      case "blacklist":
        return !channelList.includes(channelId);
      case "guilds":
        // For guilds mode, check in shouldProcessGuild
        return true;
      default:
        return true;
    }
  },

  shouldProcessGuild(guildId: string): boolean {
    const mode = settings.store.channelMode;

    if (mode !== "guilds") return true;

    const guildList = settings.store.guildList
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    return guildList.includes(guildId);
  },

  shouldPreserveMessage(message: any): boolean {
    const content = message.content || "";

    // Check preserve keywords
    const keywords = settings.store.preserveKeywords
      .split(",")
      .map((keyword) => keyword.trim().toLowerCase())
      .filter((keyword) => keyword.length > 0);

    if (keywords.length > 0) {
      const lowerContent = content.toLowerCase();
      if (keywords.some((keyword) => lowerContent.includes(keyword))) {
        return true;
      }
    }

    // Check message length
    if (
      settings.store.maxMessageLength > 0 &&
      content.length > settings.store.maxMessageLength
    ) {
      return true;
    }

    if (
      settings.store.minMessageLength > 0 &&
      content.length < settings.store.minMessageLength
    ) {
      return true;
    }

    // Check embeds
    if (
      settings.store.preserveEmbeds &&
      message.embeds &&
      message.embeds.length > 0
    ) {
      return true;
    }

    // Check attachments
    if (
      settings.store.preserveAttachments &&
      message.attachments &&
      message.attachments.length > 0
    ) {
      return true;
    }

    // Check reactions
    if (
      settings.store.preserveReactions &&
      message.reactions &&
      message.reactions.length > 0
    ) {
      return true;
    }

    return false;
  },

  shouldDeleteImmediately(content: string): boolean {
    if (!content) return false;

    const keywords = settings.store.deleteKeywords
      .split(",")
      .map((keyword) => keyword.trim().toLowerCase())
      .filter((keyword) => keyword.length > 0);

    if (keywords.length === 0) return false;

    const lowerContent = content.toLowerCase();
    return keywords.some((keyword) => lowerContent.includes(keyword));
  },

  calculateSmartDelay(message: any): number {
    if (!settings.store.smartDelay) {
      return this.getDelayInMs();
    }

    const baseDelay = this.getDelayInMs();
    const contentLength = (message.content || "").length;

    // Delay based on length: longer messages wait longer
    const lengthMultiplier = Math.min(1 + contentLength / 1000, 3); // Max 3x base delay

    // Delay based on embeds/attachments
    const mediaMultiplier =
      (message.embeds?.length || 0) > 0 ||
        (message.attachments?.length || 0) > 0
        ? 1.5
        : 1;

    return Math.floor(baseDelay * lengthMultiplier * mediaMultiplier);
  },

  checkHourlyLimit(): boolean {
    const now = Date.now();
    const hourInMs = 60 * 60 * 1000;

    // Reset hourly counter if necessary
    if (now - this.stats.lastHourReset > hourInMs) {
      this.stats.hourlyDeletions = 0;
      this.stats.lastHourReset = now;
    }

    const maxPerHour = settings.store.maxMessagesPerHour;
    if (maxPerHour > 0 && this.stats.hourlyDeletions >= maxPerHour) {
      return false;
    }

    return true;
  },

  checkThrottlingLimits(): boolean {
    if (!settings.store.aggressiveThrottling) return true;

    const now = Date.now();
    const minuteInMs = 60 * 1000;

    // Reset time window if necessary
    if (now - this.throttlingInfo.windowStart > minuteInMs) {
      this.throttlingInfo.deletionCount = 0;
      this.throttlingInfo.windowStart = now;
    }

    // Check number of deletions per minute
    const maxPerMinute = settings.store.maxDeletionsPerMinute;
    if (this.throttlingInfo.deletionCount >= maxPerMinute) {
      this.debug(`Limit of ${maxPerMinute} deletions per minute reached`);
      return false;
    }

    // Check minimum delay between deletions
    const minDelay = settings.store.minDelayBetweenDeletions;
    const timeSinceLastDeletion = now - this.throttlingInfo.lastDeletionTime;
    if (timeSinceLastDeletion < minDelay) {
      this.debug(`Minimum delay of ${minDelay}ms not met`);
      return false;
    }

    return true;
  },

  updateThrottlingInfo() {
    const now = Date.now();
    this.throttlingInfo.lastDeletionTime = now;
    this.throttlingInfo.deletionCount++;
    this.rateLimitInfo.lastSuccessfulDeletion = now;
  },

  scheduleMessageDeletion(message: any, customDelay?: number) {
    const delay = customDelay || this.getDelayInMs();
    const scheduledTime = Date.now() + delay;
    const deletionMode = settings.store.deletionMode;

    this.debug(
      `Scheduling deletion of message ${message.id
      } in ${delay}ms (${new Date(
        scheduledTime
      ).toLocaleString()}) - Mode: ${deletionMode}`
    );

    const timeoutId = setTimeout(() => {
      if (settings.store.batchDelete) {
        this.addToDeletionQueue(message.id, message.channel_id, deletionMode);
      } else {
        this.deleteMessage(message.id, message.channel_id, deletionMode);
      }
    }, delay);

    // Track message with additional information
    const trackedMessage: TrackedMessage = {
      id: message.id,
      channelId: message.channel_id,
      guildId: message.guild_id,
      timestamp: Date.now(),
      scheduledTime: scheduledTime,
      timeoutId: timeoutId,
      content: message.content,
      length: (message.content || "").length,
      hasEmbed: !!(message.embeds && message.embeds.length > 0),
      hasAttachment: !!(message.attachments && message.attachments.length > 0),
      hasReactions: !!(message.reactions && message.reactions.length > 0),
      deletionMode: deletionMode,
      priority: this.calculatePriority(message),
    };

    this.trackedMessages.set(message.id, trackedMessage);
    this.messageCache.set(message.id, message);

    // Save immediately
    this.saveTrackedMessages();
  },

  calculatePriority(message: any): number {
    let priority = 5; // Default priority

    // Longer messages = higher priority
    const contentLength = (message.content || "").length;
    if (contentLength > 500) priority += 2;
    if (contentLength > 1000) priority += 1;

    // Messages with media = higher priority
    if (message.embeds?.length > 0 || message.attachments?.length > 0) {
      priority += 1;
    }

    return Math.min(priority, 10);
  },

  addToDeletionQueue(messageId: string, channelId: string, mode: string) {
    this.deletionQueue.push({ messageId, channelId, mode });

    if (!this.batchProcessor) {
      this.startBatchProcessor();
    }
  },

  startBatchProcessor() {
    this.batchProcessor = setInterval(() => {
      this.processBatchDeletion();
    }, settings.store.batchDelay);
  },

  async processBatchDeletion() {
    if (this.deletionQueue.length === 0) {
      if (this.batchProcessor) {
        clearInterval(this.batchProcessor);
        this.batchProcessor = null;
      }
      return;
    }

    const batch = this.deletionQueue.splice(0, settings.store.batchSize);

    for (const item of batch) {
      try {
        await this.deleteMessage(item.messageId, item.channelId, item.mode);
      } catch (error) {
        this.error(`Error in batch deletion:`, error);
      }
    }
  },

  scheduleMessageDeletionFromRestore(savedMsg: TrackedMessage, delay: number) {
    this.debug(
      `Rescheduling deletion of message ${savedMsg.id} in ${delay}ms`
    );

    const timeoutId = setTimeout(() => {
      this.deleteMessage(savedMsg.id, savedMsg.channelId);
    }, delay);

    // Update message with new timeout
    const trackedMessage: TrackedMessage = {
      ...savedMsg,
      timeoutId: timeoutId,
    };

    this.trackedMessages.set(savedMsg.id, trackedMessage);
  },

  async deleteMessage(
    messageId: string,
    channelId: string,
    mode?: string,
    attempt: number = 1
  ) {
    try {
      const deletionMode = mode || settings.store.deletionMode;
      this.debug(
        `Attempting to delete message ${messageId} - Mode: ${deletionMode} (attempt ${attempt})`
      );

      // Check if we're rate limited
      if (
        this.rateLimitInfo.isRateLimited &&
        settings.store.rateLimitHandling
      ) {
        const timeSinceLastRateLimit =
          Date.now() - this.rateLimitInfo.lastRateLimit;
        if (timeSinceLastRateLimit < this.rateLimitInfo.retryAfter * 1000) {
          this.debug(
            `Rate limit active, adding to retry queue: ${messageId}`
          );
          this.addToRetryQueue(messageId, channelId, deletionMode, attempt);
          return;
        } else {
          // Reset rate limit
          this.rateLimitInfo.isRateLimited = false;
          this.rateLimitInfo.consecutiveRateLimits = 0;
          this.rateLimitInfo.backoffMultiplier = 1;
        }
      }

      // Check throttling before deletion
      if (!this.checkThrottlingLimits()) {
        this.debug(`Throttling active, adding to retry queue: ${messageId}`);
        this.addToRetryQueue(messageId, channelId, deletionMode, attempt, 5000);
        return;
      }

      // Update statistics
      this.stats.hourlyDeletions++;
      this.stats.deletionModes[deletionMode] =
        (this.stats.deletionModes[deletionMode] || 0) + 1;
      this.stats.channelStats[channelId] =
        (this.stats.channelStats[channelId] || 0) + 1;

      // Get message information for statistics
      const trackedMessage = this.trackedMessages.get(messageId);
      if (trackedMessage) {
        this.stats.totalBytesSaved += trackedMessage.length || 0;
        this.updateAverageMessageLength(trackedMessage.length || 0);
      }

      switch (deletionMode) {
        case "antilog":
          await this.performAntiLogDeletion(messageId, channelId);
          break;
        case "silent":
          await this.performSilentDeletion(messageId, channelId);
          break;
        case "edit_delete":
          await this.performEditThenDelete(messageId, channelId);
          break;
        default:
          await this.performNormalDeletion(messageId, channelId);
          break;
      }

      this.log(`Message ${messageId} deleted successfully (${deletionMode})`);
      this.stats.messagesDeleted++;

      // Update throttling information
      this.updateThrottlingInfo();

      // Reset rate limit counter on success
      if (this.rateLimitInfo.consecutiveRateLimits > 0) {
        this.rateLimitInfo.consecutiveRateLimits = Math.max(
          0,
          this.rateLimitInfo.consecutiveRateLimits - 1
        );
      }

      if (settings.store.notifications) {
        this.showNotification(`Message deleted (${deletionMode})`, "success");
      }
    } catch (error: any) {
      this.handleDeletionError(
        error,
        messageId,
        channelId,
        mode || settings.store.deletionMode,
        attempt
      );
    } finally {
      // Remove message from tracking and cache only if not in retry
      if (!this.retryQueue.some((item) => item.messageId === messageId)) {
        this.trackedMessages.delete(messageId);
        this.messageCache.delete(messageId);
        // Save after deletion
        this.saveTrackedMessages();
      }
    }
  },

  handleDeletionError(
    error: any,
    messageId: string,
    channelId: string,
    mode: string,
    attempt: number
  ) {
    this.error(`Error deleting message ${messageId}:`, error);
    this.stats.errors++;

    // Specific rate limit handling
    if (error.status === 429 && settings.store.rateLimitHandling) {
      this.handleRateLimit(error, messageId, channelId, mode, attempt);
    } else if (error.status === 404) {
      // Message already deleted or not found
      this.debug(`Message ${messageId} already deleted or not found`);
      this.trackedMessages.delete(messageId);
      this.messageCache.delete(messageId);
    } else if (attempt < settings.store.maxRetries) {
      // Other errors - retry
      this.debug(`Attempt ${attempt + 1} for message ${messageId}`);
      this.addToRetryQueue(messageId, channelId, mode, attempt + 1);
    } else {
      // Too many attempts
      this.error(
        `Abandoning deletion of message ${messageId} after ${attempt} attempts`
      );
      this.trackedMessages.delete(messageId);
      this.messageCache.delete(messageId);
    }

    if (settings.store.notifications) {
      this.showNotification("Error during deletion", "error");
    }
  },

  handleRateLimit(
    error: any,
    messageId: string,
    channelId: string,
    mode: string,
    attempt: number
  ) {
    const retryAfter = error.body?.retry_after || 1;

    this.rateLimitInfo.isRateLimited = true;
    this.rateLimitInfo.retryAfter = retryAfter;
    this.rateLimitInfo.lastRateLimit = Date.now();
    this.rateLimitInfo.consecutiveRateLimits++;
    this.rateLimitInfo.totalRateLimits++;

    // Increase backoff multiplier
    if (settings.store.adaptiveDelay) {
      this.rateLimitInfo.backoffMultiplier = Math.min(
        10,
        1 + this.rateLimitInfo.consecutiveRateLimits * 0.5
      );
    }

    // Activate global cooldown if too many rate limits
    if (this.rateLimitInfo.consecutiveRateLimits >= 3) {
      const cooldownDuration = Math.min(30000, retryAfter * 1000 * 2); // Max 30 seconds
      this.rateLimitInfo.globalCooldown = true;
      this.rateLimitInfo.globalCooldownUntil = Date.now() + cooldownDuration;
      this.log(`Global cooldown activated for ${cooldownDuration}ms`);
    }

    // Open circuit breaker if too many consecutive rate limits
    const threshold = settings.store.circuitBreakerThreshold;
    if (this.rateLimitInfo.consecutiveRateLimits >= threshold) {
      const duration = settings.store.circuitBreakerDuration * 60 * 1000; // Convert to ms
      this.rateLimitInfo.circuitBreakerOpen = true;
      this.rateLimitInfo.circuitBreakerUntil = Date.now() + duration;
      this.log(
        `Circuit breaker opened for ${settings.store.circuitBreakerDuration} minutes`
      );
    }

    this.log(
      `Rate limit detected - Retry after ${retryAfter}s (attempt ${attempt}) - Total: ${this.rateLimitInfo.totalRateLimits}`
    );

    if (attempt < settings.store.maxRetries) {
      // Longer delay for retries
      const retryDelay = Math.max(retryAfter * 1000, 5000); // Minimum 5 seconds
      this.addToRetryQueue(messageId, channelId, mode, attempt, retryDelay);
    } else {
      this.error(`Abandoning after rate limit - Message ${messageId}`);
      this.trackedMessages.delete(messageId);
      this.messageCache.delete(messageId);
    }
  },

  addToRetryQueue(
    messageId: string,
    channelId: string,
    mode: string,
    attempts: number,
    delay: number = 0
  ) {
    const baseDelay =
      delay || settings.store.retryDelay * this.rateLimitInfo.backoffMultiplier;
    const nextRetry = Date.now() + baseDelay;

    this.retryQueue.push({
      messageId,
      channelId,
      mode,
      attempts,
      nextRetry,
    });

    this.debug(
      `Added to retry queue: ${messageId} (retry in ${baseDelay}ms)`
    );

    if (!this.retryProcessor) {
      this.startRetryProcessor();
    }
  },

  startRetryProcessor() {
    this.retryProcessor = setInterval(() => {
      this.processRetryQueue();
    }, 1000); // Check every second
  },

  processRetryQueue() {
    const now = Date.now();
    const readyToRetry = this.retryQueue.filter(
      (item) => item.nextRetry <= now
    );

    if (readyToRetry.length === 0) {
      if (this.retryQueue.length === 0 && this.retryProcessor) {
        clearInterval(this.retryProcessor);
        this.retryProcessor = null;
      }
      return;
    }

    // Process ready retries
    for (const item of readyToRetry) {
      const index = this.retryQueue.indexOf(item);
      if (index > -1) {
        this.retryQueue.splice(index, 1);
      }

      this.debug(
        `Retrying message ${item.messageId} (attempt ${item.attempts})`
      );
      this.deleteMessage(
        item.messageId,
        item.channelId,
        item.mode,
        item.attempts
      );
    }
  },

  async performNormalDeletion(messageId: string, channelId: string) {
    await RestAPI.del({
      url: `/channels/${channelId}/messages/${messageId}`,
    });
  },

  async performSilentDeletion(messageId: string, channelId: string) {
    // Silent deletion - no Discord logs
    try {
      await RestAPI.del({
        url: `/channels/${channelId}/messages/${messageId}`,
      });
    } catch (error) {
      // On error, try AntiLog deletion
      await this.performAntiLogDeletion(messageId, channelId);
    }
  },

  async performEditThenDelete(messageId: string, channelId: string) {
    try {
      // Edit message first
      await RestAPI.patch({
        url: `/channels/${channelId}/messages/${messageId}`,
        body: {
          content: settings.store.editMessage,
        },
      });

      // Wait for configured delay
      await sleep(settings.store.editDelay);

      // Then delete
      await RestAPI.del({
        url: `/channels/${channelId}/messages/${messageId}`,
      });
    } catch (error) {
      // On error, try normal deletion
      await this.performNormalDeletion(messageId, channelId);
    }
  },

  // New function for AntiLog deletion with rate limit handling
  async performAntiLogDeletion(messageId: string, channelId: string) {
    try {
      this.debug(`AntiLog deletion of message ${messageId}`);

      // Longer random delay to avoid rate limits
      const randomDelay = Math.random() * 500 + 1000; // 1000-1500ms
      await sleep(randomDelay);

      // Send replacement message
      const buggedMsgResponse = await messageSendWrapper(
        settings.store.blockMessage,
        messageId,
        channelId
      );
      const buggedMsgId = buggedMsgResponse.body.id;

      // Much longer delay between deletions
      const deleteDelay = Math.max(settings.store.deleteInterval, 3000); // Minimum 3 seconds
      await sleep(deleteDelay);

      // Delete original message
      await messageDeleteWrapper(channelId, messageId);

      // Wait for configured delay
      await sleep(deleteDelay);

      // Delete replacement message
      await messageDeleteWrapper(channelId, buggedMsgId);

      this.debug(`AntiLog deletion completed for message ${messageId}`);
    } catch (error) {
      this.error(
        `Error during AntiLog deletion of message ${messageId}:`,
        error
      );
      throw error; // Re-throw so parent function can handle the error
    }
  },

  getDelayInMs(): number {
    const delay = settings.store.defaultDelay;
    const unit = settings.store.delayUnit;

    switch (unit) {
      case "seconds":
        return delay * 1000;
      case "minutes":
        return delay * 60 * 1000;
      case "hours":
        return delay * 60 * 60 * 1000;
      default:
        return delay * 1000;
    }
  },

  showNotification(
    message: string,
    type: "success" | "error" | "info" = "info"
  ) {
    const notificationType = settings.store.notificationType;
    const prefix = type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️";
    const logMessage = `[AutoDeleter] ${prefix} ${message}`;

    if (notificationType === "console" || notificationType === "both") {
      console.log(logMessage);
    }

    if (notificationType === "toast" || notificationType === "both") {
      // TODO: Implement toast notifications if API is available
      this.showToastNotification(message, type);
    }
  },

  showToastNotification(message: string, type: "success" | "error" | "info") {
    // Placeholder for toast notifications
    // Can be implemented with Vencord notification API if available
    console.log(`[AutoDeleter Toast] ${message}`);
  },

  updateAverageMessageLength(newLength: number) {
    const totalMessages = this.stats.messagesDeleted;
    if (totalMessages === 1) {
      this.stats.averageMessageLength = newLength;
    } else {
      this.stats.averageMessageLength =
        (this.stats.averageMessageLength * (totalMessages - 1) + newLength) /
        totalMessages;
    }
  },

  // Logging methods
  log(message: string, ...args: any[]) {
    console.log(`[AutoDeleter] ${message}`, ...args);
  },

  debug(message: string, ...args: any[]) {
    if (settings.store.debug) {
      console.debug(`[AutoDeleter DEBUG] ${message}`, ...args);
    }
  },

  error(message: string, ...args: any[]) {
    console.error(`[AutoDeleter ERROR] ${message}`, ...args);
  },

  // Utility methods for statistics
  getStats() {
    return {
      ...this.stats,
      trackedMessages: this.trackedMessages.size,
      queueSize: this.deletionQueue.length,
      retryQueueSize: this.retryQueue.length,
      cacheSize: this.messageCache.size,
      uptime: Date.now() - (this.startTime || Date.now()),
      efficiency: this.calculateEfficiency(),
      rateLimitInfo: this.getRateLimitInfo(),
    };
  },

  calculateEfficiency(): number {
    const total = this.stats.messagesDeleted + this.stats.messagesSaved;
    if (total === 0) return 0;
    return Math.round((this.stats.messagesDeleted / total) * 100);
  },

  resetStats() {
    this.stats = {
      messagesDeleted: 0,
      messagesSaved: 0,
      errors: 0,
      restoredFromStorage: 0,
      hourlyDeletions: 0,
      lastHourReset: Date.now(),
      totalBytesSaved: 0,
      averageMessageLength: 0,
      deletionModes: {},
      channelStats: {},
    };
    this.log("Statistics reset");
  },

  // Emergency management methods
  emergencyStopAll() {
    this.log("EMERGENCY STOP ACTIVATED - Canceling all scheduled deletions");

    // Cancel all timeouts
    this.trackedMessages.forEach((message) => {
      if (message.timeoutId) {
        clearTimeout(message.timeoutId);
      }
    });

    // Clear queues
    this.deletionQueue = [];
    this.retryQueue = [];

    // Stop processors
    if (this.batchProcessor) {
      clearInterval(this.batchProcessor);
      this.batchProcessor = null;
    }

    if (this.retryProcessor) {
      clearInterval(this.retryProcessor);
      this.retryProcessor = null;
    }

    // Reset rate limits
    this.rateLimitInfo = {
      isRateLimited: false,
      retryAfter: 0,
      lastRateLimit: 0,
      consecutiveRateLimits: 0,
      backoffMultiplier: 1,
      globalCooldown: false,
      globalCooldownUntil: 0,
      circuitBreakerOpen: false,
      circuitBreakerUntil: 0,
      totalRateLimits: 0,
      lastSuccessfulDeletion: 0,
    };

    // Reset throttling
    this.throttlingInfo = {
      lastDeletionTime: 0,
      deletionCount: 0,
      windowStart: 0,
      maxDeletionsPerMinute: settings.store.maxDeletionsPerMinute,
      minDelayBetweenDeletions: settings.store.minDelayBetweenDeletions,
    };

    // Clear caches
    this.messageCache.clear();
    this.channelCache.clear();

    this.log("Emergency stop completed");
  },

  // Method to get rate limit information
  getRateLimitInfo() {
    return {
      ...this.rateLimitInfo,
      retryQueueSize: this.retryQueue.length,
      isProcessing: !!this.retryProcessor,
      throttlingInfo: this.throttlingInfo,
    };
  },

  // Method to force reset rate limits
  resetRateLimits() {
    this.rateLimitInfo = {
      isRateLimited: false,
      retryAfter: 0,
      lastRateLimit: 0,
      consecutiveRateLimits: 0,
      backoffMultiplier: 1,
      globalCooldown: false,
      globalCooldownUntil: 0,
      circuitBreakerOpen: false,
      circuitBreakerUntil: 0,
      totalRateLimits: 0,
      lastSuccessfulDeletion: 0,
    };

    this.throttlingInfo = {
      lastDeletionTime: 0,
      deletionCount: 0,
      windowStart: 0,
      maxDeletionsPerMinute: settings.store.maxDeletionsPerMinute,
      minDelayBetweenDeletions: settings.store.minDelayBetweenDeletions,
    };

    this.log("Rate limits and throttling reset");
  },

  // Method to force close circuit breaker
  closeCircuitBreaker() {
    this.rateLimitInfo.circuitBreakerOpen = false;
    this.rateLimitInfo.circuitBreakerUntil = 0;
    this.log("Circuit breaker closed manually");
  },

  // Method to force stop global cooldown
  stopGlobalCooldown() {
    this.rateLimitInfo.globalCooldown = false;
    this.rateLimitInfo.globalCooldownUntil = 0;
    this.log("Global cooldown stopped manually");
  },

  // Method to get pending messages
  getPendingMessages() {
    return Array.from(this.trackedMessages.values()).map(
      (msg: TrackedMessage) => ({
        id: msg.id,
        channelId: msg.channelId,
        scheduledTime: new Date(msg.scheduledTime).toLocaleString(),
        timeRemaining: Math.max(0, msg.scheduledTime - Date.now()),
        content:
          (msg.content || "").substring(0, 50) +
          ((msg.content?.length || 0) > 50 ? "..." : ""),
        priority: msg.priority || 5,
      })
    );
  },

  // Method to cancel deletion of a specific message
  cancelMessageDeletion(messageId: string) {
    const trackedMessage = this.trackedMessages.get(messageId);
    if (trackedMessage && trackedMessage.timeoutId) {
      clearTimeout(trackedMessage.timeoutId);
      this.trackedMessages.delete(messageId);
      this.messageCache.delete(messageId);
      this.saveTrackedMessages();
      this.log(`Deletion cancelled for message ${messageId}`);
      return true;
    }
    return false;
  },

  // Method to clear storage (useful for debugging)
  async clearStorage() {
    try {
      await DataStore.del(STORAGE_KEY);
      this.log("Storage cleared");
    } catch (error) {
      this.error("Error clearing storage:", error);
    }
  },

  // Method to export statistics
  exportStats() {
    const stats = this.getStats();
    const dataStr = JSON.stringify(stats, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `autodeleter-stats-${new Date().toISOString().split("T")[0]
      }.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.log("Statistics exported");
  },

  // Method to import settings
  async importSettings(settingsData: string) {
    try {
      const importedSettings = JSON.parse(settingsData);
      // Validate and apply imported settings
      Object.keys(importedSettings).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(settings.store, key)) {
          settings.store[key] = importedSettings[key];
        }
      });
      this.log("Settings imported successfully");
    } catch (error) {
      this.error("Error importing settings:", error);
    }
  },

  // Method to optimize performance
  optimizePerformance() {
    // Clean old caches
    const now = Date.now();
    const maxCacheAge = 30 * 60 * 1000; // 30 minutes

    this.messageCache.forEach((message, id) => {
      if (now - message.timestamp > maxCacheAge) {
        this.messageCache.delete(id);
      }
    });

    this.channelCache.forEach((channel, id) => {
      if (now - channel.timestamp > maxCacheAge) {
        this.channelCache.delete(id);
      }
    });

    this.debug(
      `Optimization completed - Cache: ${this.messageCache.size} messages, ${this.channelCache.size} channels`
    );
  },
});
