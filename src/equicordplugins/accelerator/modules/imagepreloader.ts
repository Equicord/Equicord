/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { MessageStore } from "@webpack/common";

const logger = new Logger("Accelerator:ImagePreloader");

class ImagePreloader {
    private preloadedImages = new Set<string>();
    private preloadQueue: string[] = [];
    private isPreloading = false;
    private maxPreload = 10;
    private intersectionObserver: IntersectionObserver | null = null;

    init(maxPreload: number): void {
        this.maxPreload = maxPreload;
        this.setupIntersectionObserver();
        logger.info("Image preloader initialized");
    }

    // Set up intersection observer for intelligent preloading
    private setupIntersectionObserver(): void {
        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        this.preloadNearbyImages(entry.target);
                    }
                }
            },
            {
                rootMargin: "100px 0px 100px 0px", // Preload when 100px away
                threshold: 0.1
            }
        );

        // Observe existing images
        this.observeExistingImages();

        // Use MutationObserver to watch for new images
        const mutationObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "childList") {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.observeImagesInElement(node as Element);
                        }
                    }
                }
            }
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    private observeExistingImages(): void {
        const images = document.querySelectorAll('img, [style*="background-image"]');
        for (const img of images) {
            this.intersectionObserver?.observe(img);
        }
    }

    private observeImagesInElement(element: Element): void {
        // Observe the element itself if it's an image
        if (element.tagName === "IMG" ||
            (element as HTMLElement).style.backgroundImage) {
            this.intersectionObserver?.observe(element);
        }

        // Observe child images
        const images = element.querySelectorAll('img, [style*="background-image"]');
        for (const img of images) {
            this.intersectionObserver?.observe(img);
        }
    }

    private preloadNearbyImages(target: Element): void {
        // Find adjacent images to preload
        const container = target.closest('[class*="message"], [class*="content"]');
        if (!container) return;

        const nearbyImages = this.findNearbyImageUrls(container);
        this.addToPreloadQueue(nearbyImages);
    }

    private findNearbyImageUrls(container: Element): string[] {
        const urls: string[] = [];

        // Find images in current and adjacent messages
        const messageElements = container.parentElement?.querySelectorAll('[class*="message"]') || [];
        const currentIndex = Array.from(messageElements).indexOf(container as Element);

        // Check current message and a few before/after
        const start = Math.max(0, currentIndex - 2);
        const end = Math.min(messageElements.length, currentIndex + 3);

        for (let i = start; i < end; i++) {
            const messageEl = messageElements[i];

            // Find image URLs in this message
            const images = messageEl.querySelectorAll('img');
            for (const img of images) {
                if (img.src && !this.preloadedImages.has(img.src)) {
                    urls.push(img.src);
                }
            }

            // Find background images
            const elementsWithBg = messageEl.querySelectorAll('[style*="background-image"]');
            for (const el of elementsWithBg) {
                const bgImage = (el as HTMLElement).style.backgroundImage;
                const urlMatch = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
                if (urlMatch && urlMatch[1] && !this.preloadedImages.has(urlMatch[1])) {
                    urls.push(urlMatch[1]);
                }
            }
        }

        return urls.slice(0, this.maxPreload);
    }

    preloadChannelImages(channelId: string, maxImages: number): void {
        try {
            // Get messages from Discord's message store
            const messages = MessageStore.getMessages(channelId);
            if (!messages?._array) return;

            const imageUrls: string[] = [];

            // Extract image URLs from recent messages
            for (const message of messages._array.slice(-20)) { // Last 20 messages
                if (imageUrls.length >= maxImages) break;

                // Check attachments
                if (message.attachments) {
                    for (const attachment of message.attachments) {
                        if (attachment.content_type?.startsWith('image/') &&
                            attachment.url &&
                            !this.preloadedImages.has(attachment.url)) {
                            imageUrls.push(attachment.url);
                        }
                    }
                }

                // Check embeds
                if (message.embeds) {
                    for (const embed of message.embeds) {
                        if (embed.image?.url && !this.preloadedImages.has(embed.image.url)) {
                            imageUrls.push(embed.image.url);
                        }
                        if (embed.thumbnail?.url && !this.preloadedImages.has(embed.thumbnail.url)) {
                            imageUrls.push(embed.thumbnail.url);
                        }
                    }
                }
            }

            this.addToPreloadQueue(imageUrls.slice(0, maxImages));
        } catch (error) {
            logger.warn("Failed to preload channel images:", error);
        }
    }

    private addToPreloadQueue(urls: string[]): void {
        for (const url of urls) {
            if (!this.preloadedImages.has(url) && !this.preloadQueue.includes(url)) {
                this.preloadQueue.push(url);
            }
        }

        if (!this.isPreloading) {
            this.processPreloadQueue();
        }
    }

    private async processPreloadQueue(): Promise<void> {
        if (this.isPreloading || this.preloadQueue.length === 0) return;

        this.isPreloading = true;

        while (this.preloadQueue.length > 0 && this.preloadedImages.size < this.maxPreload * 2) {
            const url = this.preloadQueue.shift();
            if (!url || this.preloadedImages.has(url)) continue;

            try {
                await this.preloadImage(url);
                this.preloadedImages.add(url);
            } catch (error) {
                logger.debug(`Failed to preload image: ${url}`, error);
            }

            // Add small delay to avoid blocking the main thread
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        this.isPreloading = false;
    }

    private preloadImage(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const img = new Image();

            const cleanup = () => {
                img.onload = null;
                img.onerror = null;
                img.onabort = null;
            };

            img.onload = () => {
                cleanup();
                resolve();
            };

            img.onerror = () => {
                cleanup();
                reject(new Error(`Failed to load ${url}`));
            };

            img.onabort = () => {
                cleanup();
                reject(new Error(`Aborted loading ${url}`));
            };

            // Set timeout to avoid hanging
            setTimeout(() => {
                cleanup();
                reject(new Error(`Timeout loading ${url}`));
            }, 5000);

            img.src = url;
        });
    }

    cleanup(): void {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }

        this.preloadedImages.clear();
        this.preloadQueue.length = 0;
        this.isPreloading = false;

        logger.debug("Image preloader cleanup completed");
    }
}

export const imagePreloader = new ImagePreloader(); 