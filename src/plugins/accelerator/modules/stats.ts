/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

const logger = new Logger("Accelerator:Stats");

interface AcceleratorStats {
    channelSwitches: number;
    messagesLoaded: number;
    messagesCached: number;
    messagesServedFromCache: number;
    imagesOptimized: number;
    imagesCached: number;
    cacheHits: number;
    cacheMisses: number;
    averageLoadTime: number;
    startTime: number;
    lastUpdate: number;
}

interface ChannelSwitchTracking {
    channelId: string;
    startTime: number;
}

class StatsTracker {
    private stats: AcceleratorStats;
    private loadTimes: number[] = [];
    private maxLoadTimeHistory = 50;
    private currentChannelSwitch: ChannelSwitchTracking | null = null;
    private imageLoadTimes = new Map<string, number>(); // Track when image requests start
    private processedImages = new Set<string>(); // Track which images we've seen before

    constructor() {
        this.stats = this.getInitialStats();
    }

    private getInitialStats(): AcceleratorStats {
        return {
            channelSwitches: 0,
            messagesLoaded: 0,
            messagesCached: 0,
            messagesServedFromCache: 0,
            imagesOptimized: 0,
            imagesCached: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageLoadTime: 0,
            startTime: Date.now(),
            lastUpdate: Date.now()
        };
    }

    init() {
        this.stats = this.getInitialStats();
        this.setupImageCacheTracking();
        logger.info("Stats tracker initialized - tracking real Discord performance");
    }

    // Track real Discord channel switching performance like messageFetchTimer
    trackChannelSwitchStart(channelId: string): void {
        this.currentChannelSwitch = {
            channelId,
            startTime: performance.now()
        };
        logger.debug(`Channel switch started: ${channelId}`);
    }

    trackChannelSwitchEnd(channelId: string): void {
        if (!this.currentChannelSwitch || this.currentChannelSwitch.channelId !== channelId) {
            logger.debug(`Channel switch end without matching start: ${channelId}`);
            return;
        }

        const loadTime = performance.now() - this.currentChannelSwitch.startTime;
        this.recordLoadTime(loadTime);
        this.incrementChannelSwitch();
        this.currentChannelSwitch = null;

        logger.debug(`Channel switch completed: ${channelId} in ${loadTime.toFixed(1)}ms`);
    }

    // Set up real image cache tracking by hooking into image loading
    private setupImageCacheTracking() {
        const statsTracker = this;

        // Use MutationObserver to track all image elements added to DOM
        const imageObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;

                        // Check if it's an image or contains images
                        const images = element.tagName === 'IMG'
                            ? [element as HTMLImageElement]
                            : Array.from(element.querySelectorAll('img'));

                        images.forEach(img => {
                            this.trackImageElement(img);
                        });
                    }
                });
            });
        });

        // Start observing
        imageObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Track existing images
        document.querySelectorAll('img').forEach(img => {
            this.trackImageElement(img);
        });
    }

    private trackImageElement(img: HTMLImageElement) {
        const src = img.src || img.getAttribute('data-src') || '';

        // Only track Discord CDN images
        if (!src || (!src.includes('cdn.discordapp.com') && !src.includes('media.discordapp.net'))) {
            return;
        }

        const startTime = performance.now();
        this.imageLoadTimes.set(src, startTime);

        // Check if we've seen this image before (cache scenario)
        const wasProcessed = this.processedImages.has(src);

        const onLoad = () => {
            const endTime = performance.now();
            const loadTime = endTime - (this.imageLoadTimes.get(src) || endTime);

            if (wasProcessed) {
                // Image was processed before, likely from cache
                this.incrementImagesCached();
                if (loadTime < 50) { // Very fast load likely means cache hit
                    this.incrementCacheHit();
                }
            } else {
                // First time seeing this image
                this.incrementImagesOptimized();
                this.processedImages.add(src);
                if (loadTime >= 50) { // Slower load likely means cache miss
                    this.incrementCacheMiss();
                }
            }

            this.imageLoadTimes.delete(src);
            logger.debug(`Image loaded: ${src} in ${loadTime.toFixed(1)}ms (cached: ${wasProcessed})`);

            // Clean up listeners
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
        };

        const onError = () => {
            this.imageLoadTimes.delete(src);
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
        };

        // If image is already loaded, track it immediately
        if (img.complete && img.naturalWidth > 0) {
            setTimeout(onLoad, 0);
        } else {
            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);
        }
    }

    incrementChannelSwitch() {
        this.stats.channelSwitches++;
        this.updateTimestamp();
        logger.debug(`Channel switch tracked: ${this.stats.channelSwitches}`);
    }

    incrementMessagesLoaded(count: number) {
        this.stats.messagesLoaded += count;
        this.updateTimestamp();
        logger.debug(`Messages loaded: +${count} (total: ${this.stats.messagesLoaded})`);
    }

    incrementMessagesCached(count: number) {
        this.stats.messagesCached += count;
        this.updateTimestamp();
        logger.debug(`Messages cached: +${count} (total: ${this.stats.messagesCached})`);
    }

    incrementMessagesServedFromCache(count: number) {
        this.stats.messagesServedFromCache += count;
        this.updateTimestamp();
        logger.debug(`Messages served from cache: +${count} (total: ${this.stats.messagesServedFromCache})`);
    }

    incrementImagesOptimized() {
        this.stats.imagesOptimized++;
        this.updateTimestamp();
        logger.debug(`Images optimized: ${this.stats.imagesOptimized}`);
    }

    incrementImagesCached() {
        this.stats.imagesCached++;
        this.updateTimestamp();
        logger.debug(`Images cached: ${this.stats.imagesCached}`);
    }



    incrementCacheHit() {
        this.stats.cacheHits++;
        this.updateTimestamp();
        logger.debug(`Cache hit: ${this.stats.cacheHits}`);
    }

    incrementCacheMiss() {
        this.stats.cacheMisses++;
        this.updateTimestamp();
        logger.debug(`Cache miss: ${this.stats.cacheMisses}`);
    }

    updateCacheStats(cacheStats: any): void {
        if (cacheStats.hits !== undefined) this.stats.cacheHits = cacheStats.hits;
        if (cacheStats.misses !== undefined) this.stats.cacheMisses = cacheStats.misses;
        if (cacheStats.totalMessagesCached !== undefined) this.stats.messagesCached = cacheStats.totalMessagesCached;
        this.updateTimestamp();
        logger.debug(`Cache stats updated:`, cacheStats);
    }

    recordLoadTime(time: number) {
        // Only record realistic load times (filter out obviously wrong values)
        if (time > 0 && time < 30000) { // Between 0 and 30 seconds
            this.loadTimes.push(time);
            if (this.loadTimes.length > this.maxLoadTimeHistory) {
                this.loadTimes.shift();
            }

            this.stats.averageLoadTime = this.loadTimes.reduce((a, b) => a + b, 0) / this.loadTimes.length;
            this.updateTimestamp();
            logger.debug(`Load time recorded: ${time.toFixed(1)}ms (avg: ${this.stats.averageLoadTime.toFixed(1)}ms)`);
        }
    }

    private updateTimestamp() {
        this.stats.lastUpdate = Date.now();
    }

    getStats(): AcceleratorStats {
        return { ...this.stats };
    }

    getFormattedUptime(): string {
        const uptime = Date.now() - this.stats.startTime;
        const minutes = Math.floor(uptime / 60000);
        const seconds = Math.floor((uptime % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    getCacheHitRate(): number {
        const total = this.stats.cacheHits + this.stats.cacheMisses;
        return total > 0 ? (this.stats.cacheHits / total) * 100 : 0;
    }

    cleanup() {
        // Reset tracking state
        this.currentChannelSwitch = null;
        this.imageLoadTimes.clear();
        this.processedImages.clear();
        this.stats = this.getInitialStats();
        this.loadTimes = [];
        logger.debug("Stats tracker cleanup completed");
    }
}

export const statsTracker = new StatsTracker();

// Floating Stats Window using vanilla DOM
export class FloatingStats {
    private static container: HTMLDivElement | null = null;
    private static isVisible = false;
    private static updateInterval: number | null = null;
    private static isDragging = false;
    private static dragOffset = { x: 0, y: 0 };
    private static position = { x: window.innerWidth - 320, y: 20 };
    private static isMinimized = false;

    static show() {
        if (this.isVisible) return;

        this.createContainer();
        this.setupEventListeners();
        this.startUpdating();
        this.isVisible = true;

        logger.info("Floating stats window shown");
    }

    static hide() {
        if (!this.isVisible) return;

        if (this.container) {
            document.body.removeChild(this.container);
            this.container = null;
        }

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        this.isVisible = false;
        logger.info("Floating stats window hidden");
    }

    static toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    private static createContainer() {
        this.container = document.createElement("div");
        this.container.id = "accelerator-stats-container";

        this.updateStyles();
        this.updateContent();

        document.body.appendChild(this.container);
    }

    private static updateStyles() {
        if (!this.container) return;

        Object.assign(this.container.style, {
            position: "fixed",
            top: `${this.position.y}px`,
            left: `${this.position.x}px`,
            width: "300px",
            minHeight: this.isMinimized ? "40px" : "auto",
            maxHeight: this.isMinimized ? "40px" : "500px",
            backgroundColor: "var(--background-secondary)",
            border: "1px solid var(--background-secondary-alt)",
            borderRadius: "8px",
            padding: "12px",
            fontSize: "12px",
            fontFamily: "var(--font-primary)",
            color: "var(--text-normal)",
            zIndex: "9999",
            userSelect: "none",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
            backdropFilter: "blur(10px)",
            overflow: "hidden",
            transition: "all 0.2s ease"
        });
    }

    private static updateContent() {
        if (!this.container) return;

        const stats = statsTracker.getStats();
        const uptime = statsTracker.getFormattedUptime();
        const cacheRate = statsTracker.getCacheHitRate();

        const formatNumber = (num: number): string => {
            if (num >= 1000) return (num / 1000).toFixed(1) + "k";
            return num.toString();
        };

        const formatLoadTime = (time: number): string => {
            return time < 1000 ? `${Math.round(time)}ms` : `${(time / 1000).toFixed(1)}s`;
        };

        const formatCacheRate = (rate: number): string => {
            return rate.toFixed(1) + "%";
        };

        const headerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${this.isMinimized ? '0' : '8px'}; padding-bottom: 4px; border-bottom: 1px solid var(--background-modifier-accent);">
                <span style="font-weight: 600; color: var(--text-brand);">🚀 Accelerator Stats</span>
                <div style="display: flex; gap: 8px;">
                    <button id="accelerator-minimize" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; font-size: 14px;">${this.isMinimized ? '📈' : '📉'}</button>
                    <button id="accelerator-close" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; font-size: 12px;">✕</button>
                </div>
            </div>
        `;

        const contentHTML = this.isMinimized ? '' : `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                <div style="background: var(--background-tertiary); padding: 6px; border-radius: 4px;">
                    <div style="color: var(--text-muted); margin-bottom: 2px;">Channel Switches</div>
                    <div style="font-weight: 600; color: var(--text-brand);">${formatNumber(stats.channelSwitches)}</div>
                </div>
                <div style="background: var(--background-tertiary); padding: 6px; border-radius: 4px;">
                    <div style="color: var(--text-muted); margin-bottom: 2px;">Channel Load Time</div>
                    <div style="font-weight: 600; color: ${stats.averageLoadTime < 1000 ? 'var(--text-positive)' : stats.averageLoadTime < 2000 ? 'var(--text-warning)' : 'var(--text-danger)'};">${formatLoadTime(stats.averageLoadTime)}</div>
                </div>
                <div style="background: var(--background-tertiary); padding: 6px; border-radius: 4px;">
                    <div style="color: var(--text-muted); margin-bottom: 2px;">Messages from Discord</div>
                    <div style="font-weight: 600; color: var(--text-normal);">${formatNumber(stats.messagesLoaded)}</div>
                </div>
                <div style="background: var(--background-tertiary); padding: 6px; border-radius: 4px;">
                    <div style="color: var(--text-muted); margin-bottom: 2px;">Messages from Cache</div>
                    <div style="font-weight: 600; color: var(--text-positive);">${formatNumber(stats.messagesServedFromCache)}</div>
                </div>
                <div style="background: var(--background-tertiary); padding: 6px; border-radius: 4px;">
                    <div style="color: var(--text-muted); margin-bottom: 2px;">Messages Stored</div>
                    <div style="font-weight: 600; color: var(--text-brand);">${formatNumber(stats.messagesCached)}</div>
                </div>
                <div style="background: var(--background-tertiary); padding: 6px; border-radius: 4px;">
                    <div style="color: var(--text-muted); margin-bottom: 2px;">Message Cache Rate</div>
                    <div style="font-weight: 600; color: ${cacheRate > 70 ? 'var(--text-positive)' : cacheRate > 40 ? 'var(--text-warning)' : 'var(--text-danger)'};">${formatCacheRate(cacheRate)}</div>
                </div>
                <div style="background: var(--background-tertiary); padding: 6px; border-radius: 4px;">
                    <div style="color: var(--text-muted); margin-bottom: 2px;">Images Preloaded</div>
                    <div style="font-weight: 600; color: var(--text-positive);">${formatNumber(stats.imagesOptimized)}</div>
                </div>
                <div style="background: var(--background-tertiary); padding: 6px; border-radius: 4px;">
                    <div style="color: var(--text-muted); margin-bottom: 2px;">Images from Cache</div>
                    <div style="font-weight: 600; color: var(--text-positive);">${formatNumber(stats.imagesCached)}</div>
                </div>
                <div style="background: var(--background-tertiary); padding: 6px; border-radius: 4px;">
                    <div style="color: var(--text-muted); margin-bottom: 2px;">Uptime</div>
                    <div style="font-weight: 600; color: var(--text-muted);">${uptime}</div>
                </div>
            </div>
        `;

        this.container.innerHTML = headerHTML + contentHTML;
        this.setupToggleButton();
    }

    private static setupToggleButton() {
        const minimizeBtn = document.getElementById("accelerator-minimize");
        const closeBtn = document.getElementById("accelerator-close");

        if (minimizeBtn) {
            minimizeBtn.onclick = (e) => {
                e.stopPropagation();
                this.isMinimized = !this.isMinimized;
                this.updateStyles();
                this.updateContent();
            };
        }

        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.hide();
            };
        }
    }

    private static setupEventListeners() {
        if (!this.container) return;

        // Dragging functionality
        this.container.onmousedown = (e) => {
            if ((e.target as HTMLElement).tagName === "BUTTON") return;

            this.isDragging = true;
            this.dragOffset.x = e.clientX - this.position.x;
            this.dragOffset.y = e.clientY - this.position.y;

            if (this.container) {
                this.container.style.cursor = "grabbing";
                this.container.style.opacity = "0.8";
            }
        };

        document.onmousemove = (e) => {
            if (!this.isDragging || !this.container) return;

            this.position.x = e.clientX - this.dragOffset.x;
            this.position.y = e.clientY - this.dragOffset.y;

            // Keep within screen bounds
            this.position.x = Math.max(0, Math.min(window.innerWidth - 300, this.position.x));
            this.position.y = Math.max(0, Math.min(window.innerHeight - 100, this.position.y));

            this.container.style.left = `${this.position.x}px`;
            this.container.style.top = `${this.position.y}px`;
        };

        document.onmouseup = () => {
            if (!this.isDragging) return;

            this.isDragging = false;
            if (this.container) {
                this.container.style.cursor = "default";
                this.container.style.opacity = "1";
            }
        };
    }

    private static startUpdating() {
        if (this.updateInterval) clearInterval(this.updateInterval);

        this.updateInterval = setInterval(() => {
            if (this.isVisible && this.container) {
                this.updateContent();
            }
        }, 1000) as any;
    }
} 