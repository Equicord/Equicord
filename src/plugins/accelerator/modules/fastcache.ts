/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { statsTracker } from "./stats";

const logger = new Logger("Accelerator:FastCache");

// Inspired by VictoriaMetrics/fastcache - thread-safe cache with buckets
// Each bucket has its own lock (simulated with async operations) to reduce contention

interface CacheEntry {
    key: string;
    value: any;
    timestamp: number;
    size: number;
}

interface Bucket {
    entries: Map<string, CacheEntry>;
    totalSize: number;
    lastCleanup: number;
}

class FastCache {
    private buckets: Bucket[] = [];
    private bucketCount = 256; // Power of 2 for fast modulo
    private maxCacheSize = 256 * 1024 * 1024; // 256 MB default
    private maxEntryAge = 30 * 60 * 1000; // 30 minutes
    private cleanupInterval: any | null = null;
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalEntries: 0
    };

    async init(maxSizeBytes: number): Promise<void> {
        this.maxCacheSize = maxSizeBytes;
        this.buckets = [];

        // Initialize buckets (like chunks in fastcache)
        for (let i = 0; i < this.bucketCount; i++) {
            this.buckets.push({
                entries: new Map(),
                totalSize: 0,
                lastCleanup: Date.now()
            });
        }

        // Start background cleanup (like GC in fastcache)
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 60 * 1000); // Every minute

        logger.info(`FastCache initialized with ${this.bucketCount} buckets, max size: ${Math.round(maxSizeBytes / 1024 / 1024)}MB`);
    }

    // Hash function to distribute keys across buckets
    private hash(key: string): number {
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            const char = key.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash) % this.bucketCount;
    }

    // Estimate size of an object (simplified)
    private estimateSize(obj: any): number {
        if (obj === null || obj === undefined) return 8;
        if (typeof obj === "string") return obj.length * 2; // UTF-16
        if (typeof obj === "number") return 8;
        if (typeof obj === "boolean") return 4;
        if (Array.isArray(obj)) {
            return 24 + obj.reduce((acc, item) => acc + this.estimateSize(item), 0);
        }
        if (typeof obj === "object") {
            return 24 + Object.keys(obj).reduce((acc, key) => {
                return acc + this.estimateSize(key) + this.estimateSize(obj[key]);
            }, 0);
        }
        return 24; // Default object overhead
    }

    // Thread-safe set operation
    set(key: string, value: any): void {
        const bucketIndex = this.hash(key);
        const bucket = this.buckets[bucketIndex];
        const size = this.estimateSize(value);
        const now = Date.now();

        // Remove old entry if exists
        const existing = bucket.entries.get(key);
        if (existing) {
            bucket.totalSize -= existing.size;
            this.stats.totalEntries--;
        }

        // Add new entry
        const entry: CacheEntry = {
            key,
            value,
            timestamp: now,
            size
        };

        bucket.entries.set(key, entry);
        bucket.totalSize += size;
        this.stats.totalEntries++;

        // Evict if bucket is too large
        this.evictFromBucketIfNeeded(bucket);
    }

    // Thread-safe get operation
    get(key: string): any | null {
        const bucketIndex = this.hash(key);
        const bucket = this.buckets[bucketIndex];
        const entry = bucket.entries.get(key);

        if (!entry) {
            this.stats.misses++;
            return null;
        }

        // Check if entry is still fresh
        const now = Date.now();
        if (now - entry.timestamp > this.maxEntryAge) {
            bucket.entries.delete(key);
            bucket.totalSize -= entry.size;
            this.stats.totalEntries--;
            this.stats.evictions++;
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        return entry.value;
    }

    // Message-specific operations
    addMessage(channelId: string, message: any): void {
        if (!message?.id) return;
        const key = `msg:${channelId}:${message.id}`;
        this.set(key, message);
    }

    addMessageBatch(channelId: string, messages: any[]): void {
        for (const message of messages) {
            this.addMessage(channelId, message);
        }
    }

    getMessage(channelId: string, messageId: string): any | null {
        const key = `msg:${channelId}:${messageId}`;
        return this.get(key);
    }

    getMessages(channelId: string): any[] {
        const messages: any[] = [];
        const prefix = `msg:${channelId}:`;

        // Search across all buckets for this channel's messages
        for (const bucket of this.buckets) {
            for (const [key, entry] of bucket.entries) {
                if (key.startsWith(prefix)) {
                    const now = Date.now();
                    if (now - entry.timestamp <= this.maxEntryAge) {
                        messages.push(entry.value);
                    }
                }
            }
        }

        return messages.sort((a, b) =>
            new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
        );
    }

    getMessageCount(channelId: string): number {
        const prefix = `msg:${channelId}:`;
        let count = 0;

        for (const bucket of this.buckets) {
            for (const [key, entry] of bucket.entries) {
                if (key.startsWith(prefix)) {
                    const now = Date.now();
                    if (now - entry.timestamp <= this.maxEntryAge) {
                        count++;
                    }
                }
            }
        }

        return count;
    }

    getTotalMessagesCached(): number {
        let count = 0;
        for (const bucket of this.buckets) {
            for (const [key, entry] of bucket.entries) {
                if (key.startsWith('msg:')) {
                    const now = Date.now();
                    if (now - entry.timestamp <= this.maxEntryAge) {
                        count++;
                    }
                }
            }
        }
        return count;
    }

    // User-specific operations
    addUser(userId: string, user: any): void {
        const key = `user:${userId}`;
        this.set(key, user);
    }

    getUser(userId: string): any | null {
        const key = `user:${userId}`;
        return this.get(key);
    }

    // Channel data operations
    addChannelData(channelId: string, data: any): void {
        const key = `channel:${channelId}`;
        this.set(key, data);
    }

    getChannelData(channelId: string): any | null {
        const key = `channel:${channelId}`;
        return this.get(key);
    }

    // Eviction policy (LRU-like but simplified for performance)
    private evictFromBucketIfNeeded(bucket: Bucket): void {
        const maxBucketSize = this.maxCacheSize / this.bucketCount;

        while (bucket.totalSize > maxBucketSize && bucket.entries.size > 0) {
            // Find oldest entry
            let oldestKey = "";
            let oldestTime = Date.now();

            for (const [key, entry] of bucket.entries) {
                if (entry.timestamp < oldestTime) {
                    oldestTime = entry.timestamp;
                    oldestKey = key;
                }
            }

            if (oldestKey) {
                const entry = bucket.entries.get(oldestKey);
                if (entry) {
                    bucket.entries.delete(oldestKey);
                    bucket.totalSize -= entry.size;
                    this.stats.totalEntries--;
                    this.stats.evictions++;
                }
            } else {
                break; // Safety break
            }
        }
    }

    // Background cleanup (like fastcache's background GC)
    private performCleanup(): void {
        const now = Date.now();
        let totalCleaned = 0;

        for (const bucket of this.buckets) {
            // Only clean buckets that haven't been cleaned recently
            if (now - bucket.lastCleanup < 30 * 1000) continue; // 30 seconds

            const keysToDelete: string[] = [];

            for (const [key, entry] of bucket.entries) {
                if (now - entry.timestamp > this.maxEntryAge) {
                    keysToDelete.push(key);
                }
            }

            for (const key of keysToDelete) {
                const entry = bucket.entries.get(key);
                if (entry) {
                    bucket.entries.delete(key);
                    bucket.totalSize -= entry.size;
                    this.stats.totalEntries--;
                    totalCleaned++;
                }
            }

            bucket.lastCleanup = now;
        }

        if (totalCleaned > 0) {
            logger.debug(`Cleanup removed ${totalCleaned} expired entries`);
        }

        // Update stats tracker
        statsTracker.updateCacheStats({
            hits: this.stats.hits,
            misses: this.stats.misses,
            evictions: this.stats.evictions,
            totalEntries: this.stats.totalEntries,
            totalSize: this.getTotalSize()
        });
    }

    // Get cache statistics
    getStats() {
        return {
            ...this.stats,
            totalSize: this.getTotalSize(),
            bucketCount: this.bucketCount,
            avgBucketSize: this.getTotalSize() / this.bucketCount
        };
    }

    private getTotalSize(): number {
        return this.buckets.reduce((total, bucket) => total + bucket.totalSize, 0);
    }

    cleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Clear all buckets
        for (const bucket of this.buckets) {
            bucket.entries.clear();
            bucket.totalSize = 0;
        }

        this.stats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            totalEntries: 0
        };

        logger.debug("FastCache cleanup completed");
    }
}

export const fastCache = new FastCache(); 