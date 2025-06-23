/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { statsTracker } from "./stats";

const logger = new Logger("Accelerator:IntersectionOptimizer");

class IntersectionOptimizer {
    private imageObserver: IntersectionObserver | null = null;
    private observedElements = new Set<Element>();
    private imagePreloadQueue = new Set<string>();
    private isEnabled = false;

    init() {
        this.setupImageObserver();
        this.isEnabled = true;
        logger.info("Intersection optimizer initialized (scroll-safe mode)");
    }

    private setupImageObserver() {
        // Only handle image lazy loading - no layout modifications to avoid scroll issues
        this.imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target as HTMLImageElement;
                    this.optimizeImageLoading(img);
                    this.imageObserver?.unobserve(img);
                }
            });
        }, {
            rootMargin: '1000px 0px', // Preload images 1000px before they enter viewport
            threshold: 0.01
        });

        this.observeExistingImages();
        this.setupImageMutationObserver();
    }

    private observeExistingImages() {
        if (!this.imageObserver) return;

        // Only observe Discord CDN images to avoid interfering with other content
        const images = document.querySelectorAll('img[src*="cdn.discordapp.com"], img[src*="media.discordapp.net"]');
        images.forEach(img => {
            if (!this.observedElements.has(img)) {
                this.imageObserver!.observe(img);
                this.observedElements.add(img);
            }
        });
    }

    private setupImageMutationObserver() {
        if (!this.imageObserver) return;

        const mutationObserver = new MutationObserver(mutations => {
            if (!this.isEnabled) return;

            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node instanceof HTMLElement) {
                        // Check for new Discord images only
                        const images = node.matches('img') ? [node] :
                            Array.from(node.querySelectorAll('img[src*="cdn.discordapp.com"], img[src*="media.discordapp.net"]'));

                        images.forEach(img => {
                            if (!this.observedElements.has(img) && this.imageObserver) {
                                this.imageObserver.observe(img);
                                this.observedElements.add(img);
                            }
                        });
                    }
                });
            });
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    private optimizeImageLoading(img: HTMLImageElement) {
        try {
            // Only apply safe image optimizations that don't affect layout
            if (!img.loading) {
                img.loading = 'lazy';
            }
            if (!img.decoding) {
                img.decoding = 'async';
            }

            // Preload higher quality version if available
            const src = img.src;
            if (src && (src.includes('cdn.discordapp.com') || src.includes('media.discordapp.net'))) {
                this.preloadHigherQuality(src);
            }

            logger.debug(`Optimized image loading: ${img.src}`);
            statsTracker.incrementImagesOptimized();
        } catch (error) {
            logger.error("Failed to optimize image loading:", error);
        }
    }

    private preloadHigherQuality(src: string) {
        if (this.imagePreloadQueue.has(src)) return;

        this.imagePreloadQueue.add(src);

        try {
            // Convert to higher quality if it's a Discord CDN image with quality params
            let highQualitySrc = src;

            if (src.includes('?')) {
                const url = new URL(src);

                // Remove width/height constraints for better quality
                url.searchParams.delete('width');
                url.searchParams.delete('height');

                // Set higher quality if quality param exists
                if (url.searchParams.has('quality')) {
                    url.searchParams.set('quality', '100');
                }

                // Remove format constraints to get original format
                if (url.searchParams.has('format')) {
                    url.searchParams.delete('format');
                }

                highQualitySrc = url.toString();
            }

            // Preload the higher quality version
            if (highQualitySrc !== src) {
                const preloadImg = new Image();
                preloadImg.onload = () => {
                    this.imagePreloadQueue.delete(src);
                    logger.debug(`Preloaded high quality image: ${highQualitySrc}`);
                };
                preloadImg.onerror = () => {
                    this.imagePreloadQueue.delete(src);
                };
                preloadImg.src = highQualitySrc;
            } else {
                this.imagePreloadQueue.delete(src);
            }
        } catch (error) {
            this.imagePreloadQueue.delete(src);
            logger.error("Failed to preload higher quality image:", error);
        }
    }

    cleanup() {
        this.isEnabled = false;

        if (this.imageObserver) {
            this.imageObserver.disconnect();
            this.imageObserver = null;
        }

        this.observedElements.clear();
        this.imagePreloadQueue.clear();

        logger.debug("Intersection optimizer cleanup completed");
    }
}

export const intersectionOptimizer = new IntersectionOptimizer(); 