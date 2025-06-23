/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { FluxDispatcher, ChannelStore, GuildChannelStore, ChannelActionCreators, MessageActions } from "@webpack/common";
import { Logger } from "@utils/Logger";

const logger = new Logger("Accelerator:Preloader");

interface PreloadedChannel {
    channelId: string;
    timestamp: number;
    messages: boolean;
}

class ChannelPreloader {
    private preloadedChannels = new Map<string, PreloadedChannel>();
    private preloadQueue = new Set<string>();
    private maxPreloadAge = 5 * 60 * 1000; // 5 minutes
    private preloadDistance = 3;
    private isScrolling = false;
    private scrollTimeout: number | null = null;
    private lastScrollTime = 0;

    init(distance: number) {
        this.preloadDistance = distance;
        this.setupScrollDetection();
        logger.info("Channel preloader initialized (scroll-aware)");
    }

    private setupScrollDetection() {
        // Detect when user is actively scrolling to avoid interference
        const handleScroll = () => {
            this.isScrolling = true;
            this.lastScrollTime = Date.now();

            if (this.scrollTimeout) {
                clearTimeout(this.scrollTimeout);
            }

            // Consider scrolling finished after 150ms of no scroll events
            this.scrollTimeout = setTimeout(() => {
                this.isScrolling = false;
            }, 150);
        };

        // Listen to scroll events on potential scroll containers
        document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
        document.addEventListener('wheel', handleScroll, { passive: true, capture: true });
    }

    async preloadAdjacent(guildId: string | null, currentChannelId: string, distance: number) {
        // Don't start new preloads while user is actively scrolling
        if (this.isScrolling || (Date.now() - this.lastScrollTime) < 500) {
            logger.debug("Skipping preload during scroll activity");
            return;
        }

        try {
            const adjacentChannels = this.getAdjacentChannels(guildId, currentChannelId, distance);

            // More conservative preloading to avoid interfering with scroll
            const batchSize = 1; // Reduced from 2 to 1
            for (let i = 0; i < adjacentChannels.length; i += batchSize) {
                // Check if user started scrolling during preload
                if (this.isScrolling) {
                    logger.debug("Stopping preload due to scroll activity");
                    break;
                }

                const batch = adjacentChannels.slice(i, i + batchSize);
                await Promise.all(batch.map(channelId => this.preloadChannel(channelId)));

                // Longer delay between batches to be less aggressive
                if (i + batchSize < adjacentChannels.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            // Cleanup old preloaded channels
            this.cleanup();
        } catch (error) {
            logger.error("Failed to preload adjacent channels:", error);
        }
    }

    private getAdjacentChannels(guildId: string | null, currentChannelId: string, distance: number): string[] {
        const channels: string[] = [];

        try {
            if (guildId) {
                // Guild channels
                const guildChannels = GuildChannelStore.getChannels(guildId);
                const selectableChannels = guildChannels.SELECTABLE || [];

                const currentIndex = selectableChannels.findIndex(ch => ch.channel.id === currentChannelId);
                if (currentIndex !== -1) {
                    // Get channels before and after current
                    for (let i = 1; i <= distance; i++) {
                        const beforeIndex = currentIndex - i;
                        const afterIndex = currentIndex + i;

                        if (beforeIndex >= 0) {
                            channels.push(selectableChannels[beforeIndex].channel.id);
                        }
                        if (afterIndex < selectableChannels.length) {
                            channels.push(selectableChannels[afterIndex].channel.id);
                        }
                    }
                }
            } else {
                // DM channels - preload recent conversations
                const recentChannels = this.getRecentDMChannels(currentChannelId, distance);
                channels.push(...recentChannels);
            }
        } catch (error) {
            logger.error("Failed to get adjacent channels:", error);
        }

        return channels.filter(id => id !== currentChannelId);
    }

    private getRecentDMChannels(excludeChannelId: string, count: number): string[] {
        // Get recent DM channels from Discord's internal stores
        try {
            const privateChannels = ChannelStore.getSortedPrivateChannels();
            return privateChannels
                .filter(channel => channel.id !== excludeChannelId)
                .slice(0, count)
                .map(channel => channel.id);
        } catch (error) {
            logger.error("Failed to get recent DM channels:", error);
            return [];
        }
    }

    private async preloadChannel(channelId: string) {
        if (this.preloadQueue.has(channelId)) return;
        if (this.isScrolling) return; // Don't start new preloads during scroll

        const existingPreload = this.preloadedChannels.get(channelId);
        const now = Date.now();

        // Skip if recently preloaded
        if (existingPreload && (now - existingPreload.timestamp) < this.maxPreloadAge) {
            return;
        }

        this.preloadQueue.add(channelId);

        try {
            const channel = ChannelStore.getChannel(channelId);
            if (!channel) return;

            // Check again if user started scrolling
            if (this.isScrolling) {
                this.preloadQueue.delete(channelId);
                return;
            }

            // Use Discord's internal preload system - but be more conservative
            if (channel.guild_id) {
                await ChannelActionCreators.preload(channel.guild_id, channelId);
            }

            // Only preload messages for non-DM channels, and with smaller batch size
            if (channel.type !== 1 && channel.type !== 3 && !this.isScrolling) {
                await MessageActions.fetchMessages({
                    channelId,
                    limit: 25 // Reduced from 50 to 25
                });
            }

            this.preloadedChannels.set(channelId, {
                channelId,
                timestamp: now,
                messages: true
            });

            logger.debug(`Preloaded channel: ${channelId}`);
        } catch (error) {
            logger.error(`Failed to preload channel ${channelId}:`, error);
        } finally {
            this.preloadQueue.delete(channelId);
        }
    }

    cleanup() {
        const now = Date.now();
        const toRemove: string[] = [];

        for (const [channelId, preload] of this.preloadedChannels) {
            if ((now - preload.timestamp) > this.maxPreloadAge) {
                toRemove.push(channelId);
            }
        }

        toRemove.forEach(channelId => this.preloadedChannels.delete(channelId));

        if (toRemove.length > 0) {
            logger.debug(`Cleaned up ${toRemove.length} old preloaded channels`);
        }

        // Cleanup scroll detection
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = null;
        }
    }
}

export const channelPreloader = new ChannelPreloader(); 