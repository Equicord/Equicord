/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { addMessageAccessory, removeMessageAccessory } from "@api/MessageAccessories";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";

import { channelPreloader } from "./modules/preloader";
import { fastCache } from "./modules/fastcache";
import { intersectionOptimizer } from "./modules/intersection";
import { imagePreloader } from "./modules/imagepreloader";
import { CacheIndicatorAccessory } from "./modules/messageAccessory";
import { statsTracker, FloatingStats } from "./modules/stats";

const logger = new Logger("Accelerator");

const settings = definePluginSettings({
    enablePreloading: {
        type: OptionType.BOOLEAN,
        description: "Preload adjacent channels and recent DMs for instant switching",
        default: true,
        restartNeeded: true
    },

    enableFastCache: {
        type: OptionType.BOOLEAN,
        description: "Thread-safe high-performance message and user caching",
        default: true,
        restartNeeded: true
    },

    enableImagePreloading: {
        type: OptionType.BOOLEAN,
        description: "Intelligent image preloading for smoother scrolling",
        default: true,
        restartNeeded: true
    },

    enableViewportOptimization: {
        type: OptionType.BOOLEAN,
        description: "Use intersection observers for efficient rendering",
        default: true,
        restartNeeded: true
    },

    showStatsWindow: {
        type: OptionType.BOOLEAN,
        description: "Show floating performance statistics window",
        default: true,
        restartNeeded: true
    },

    showCacheIndicators: {
        type: OptionType.BOOLEAN,
        description: "Show green dots on messages served instantly from cache",
        default: true,
        restartNeeded: true
    },

    preloadDistance: {
        type: OptionType.SLIDER,
        description: "How many adjacent channels to preload",
        default: 3,
        markers: [1, 2, 3, 4, 5],
        stickToMarkers: true,
        restartNeeded: true
    },

    cacheSize: {
        type: OptionType.SLIDER,
        description: "Cache size in MB (uses thread-safe buckets)",
        default: 256,
        markers: [128, 256, 384, 512, 640, 768, 896, 1024],
        stickToMarkers: true,
        restartNeeded: true
    },

    maxImagePreload: {
        type: OptionType.SLIDER,
        description: "Maximum images to preload ahead",
        default: 10,
        markers: [5, 10, 20, 50],
        stickToMarkers: true,
        restartNeeded: true
    }
});

export default definePlugin({
    name: "Accelerator",
    description: "High-performance Discord optimization using thread-safe caching, intelligent preloading, and zero CSS interference",
    authors: [Devs.galpt],
    tags: ["performance", "optimization", "preload", "cache", "thread-safe"],
    dependencies: ["MessageAccessoriesAPI"],

    settings,

    // Minimal patches - only for tracking performance, no CSS modifications
    patches: [
        {
            find: "CONNECTION_OPEN:",
            replacement: {
                match: /(CONNECTION_OPEN:function\(\w+\)\{)/,
                replace: "$1/* Accelerator: Performance tracking */"
            }
        }
    ],

    flux: {
        // Channel switching with immediate preloading
        CHANNEL_SELECT({ channelId, guildId }) {
            if (channelId) {
                statsTracker.trackChannelSwitchStart(channelId);

                if (settings.store.enablePreloading) {
                    channelPreloader.preloadAdjacent(guildId, channelId, settings.store.preloadDistance);
                }

                if (settings.store.enableImagePreloading) {
                    imagePreloader.preloadChannelImages(channelId, settings.store.maxImagePreload);
                }
            }
        },

        // Track message loading and fast cache integration
        LOAD_MESSAGES_SUCCESS({ channelId, messages }) {
            statsTracker.trackChannelSwitchEnd(channelId);

            // Always track messages loaded for statistics
            if (messages?.length) {
                statsTracker.incrementMessagesLoaded(messages.length);
            }

            // Add to fast cache if enabled
            if (settings.store.enableFastCache && messages?.length) {
                fastCache.addMessageBatch(channelId, messages);
            }
        },

        // Cache new messages atomically and track them
        MESSAGE_CREATE({ message }) {
            if (message) {
                // Add to fast cache if enabled and track cached count
                if (settings.store.enableFastCache) {
                    fastCache.addMessage(message.channel_id, message);
                    statsTracker.incrementMessagesCached(1);
                }
            }
        },

        // Track cache performance
        LOAD_MESSAGES_START({ channelId }) {
            if (settings.store.enableFastCache) {
                const cached = fastCache.getMessages(channelId);
                if (cached.length > 0) {
                    statsTracker.incrementCacheHit();
                    logger.debug(`Found ${cached.length} cached messages for channel ${channelId}`);
                } else {
                    statsTracker.incrementCacheMiss();
                }
            }
        },

        // User data caching for profile optimization
        USER_UPDATE({ user }) {
            if (settings.store.enableFastCache && user) {
                fastCache.addUser(user.id, user);
            }
        }
    },

    async start() {
        // Initialize performance tracking
        statsTracker.init();

        // Initialize thread-safe cache system first
        if (settings.store.enableFastCache) {
            await fastCache.init(settings.store.cacheSize * 1024 * 1024); // Convert MB to bytes
        }

        // Initialize pure JavaScript optimizations
        if (settings.store.enableViewportOptimization) {
            intersectionOptimizer.init();
        }

        if (settings.store.enablePreloading) {
            channelPreloader.init(settings.store.preloadDistance);
        }

        if (settings.store.enableImagePreloading) {
            imagePreloader.init(settings.store.maxImagePreload);
        }

        // Initialize message accessories for cache indicators
        if (settings.store.enableFastCache && settings.store.showCacheIndicators) {
            addMessageAccessory("accelerator-cache-indicator", props =>
                CacheIndicatorAccessory({ message: props.message })
            );
        }

        // Show stats window (this is the ONLY UI/CSS component)
        if (settings.store.showStatsWindow) {
            FloatingStats.show();
        }

        // Set up periodic cache stats sync
        if (settings.store.enableFastCache) {
            setInterval(() => {
                const totalCached = fastCache.getTotalMessagesCached();
                if (totalCached !== statsTracker.getStats().messagesCached) {
                    statsTracker.updateCacheStats({
                        totalMessagesCached: totalCached
                    });
                }
            }, 5000); // Sync every 5 seconds
        }
    },

    stop() {
        // Clean shutdown of all systems
        channelPreloader.cleanup();
        fastCache.cleanup();
        intersectionOptimizer.cleanup();
        imagePreloader.cleanup();
        statsTracker.cleanup();
        FloatingStats.hide();

        // Remove message accessories
        if (settings.store.enableFastCache && settings.store.showCacheIndicators) {
            removeMessageAccessory("accelerator-cache-indicator");
        }
    }
}); 