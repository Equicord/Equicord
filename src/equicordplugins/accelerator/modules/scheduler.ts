/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { MessageActions } from "@webpack/common";

const logger = new Logger("Accelerator:Scheduler");

/**
 * Defines the priority levels for network requests.
 */
export enum RequestPriority {
    HIGH,   // Critical operations: sending messages, loading current channel
    MEDIUM, // Important but not critical: user interactions, loading profiles
    LOW,    // Background tasks: preloading, fetching non-essential data
}

/**
 * Represents a request that is waiting in the queue.
 */
interface QueuedRequest {
    url: string;
    options: RequestInit;
    priority: RequestPriority;
    resolve: (value: Response | PromiseLike<Response>) => void;
    reject: (reason?: any) => void;
}

/**
 * A smart request scheduler inspired by CAKE's principles to manage and pace
 * application-level network requests for a smoother user experience.
 */
class SmartScheduler {
    private queues: Map<RequestPriority, QueuedRequest[]> = new Map();
    private isProcessing = false;
    private concurrentRequests = 0;
    private maxConcurrentRequests = 4; // Pacing: limit concurrent background requests

    private originalFetch: typeof window.fetch | null = null;

    constructor() {
        this.queues.set(RequestPriority.HIGH, []);
        this.queues.set(RequestPriority.MEDIUM, []);
        this.queues.set(RequestPriority.LOW, []);
    }

    /**
     * Patches the global fetch to intercept requests.
     */
    public start(): void {
        this.originalFetch = window.fetch;

        window.fetch = (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
            const reqUrl = typeof url === 'string' ? url : url.toString();

            // TODO: Implement logic to determine priority based on URL/context
            const priority = this.getRequestPriority(reqUrl, options);

            return this.enqueue(reqUrl, options ?? {}, priority);
        };

        logger.info("Smart Scheduler started, intercepting fetch requests.");
    }

    /**
     * Restores the original fetch function.
     */
    public stop(): void {
        if (this.originalFetch) {
            window.fetch = this.originalFetch;
            this.originalFetch = null;
        }
        this.isProcessing = false;
        logger.info("Smart Scheduler stopped.");
    }

    /**
     * Adds a request to the appropriate priority queue.
     */
    public enqueue(url: string, options: RequestInit, priority: RequestPriority): Promise<Response> {
        return new Promise((resolve, reject) => {
            const queue = this.queues.get(priority);
            if (queue) {
                queue.push({ url, options, priority, resolve, reject });
                this.scheduleProcessing();
            } else {
                // Failsafe if priority is somehow invalid
                reject(new Error("Invalid request priority"));
            }
        });
    }

    /**
     * Determines the priority of a request based on its URL and options.
     * This is where the "flow identification" happens.
     */
    private getRequestPriority(url: string, options?: RequestInit): RequestPriority {
        // 1. Check for our custom header first for explicit priority
        if (options?.headers) {
            const priorityHeader = (options.headers as Record<string, string>)["X-Request-Priority"];
            if (priorityHeader) {
                const priority = RequestPriority[priorityHeader as keyof typeof RequestPriority];
                if (priority !== undefined) {
                    return priority;
                }
            }
        }

        // 2. Prioritize based on request method
        const method = options?.method?.toUpperCase() ?? "GET";
        if (method !== "GET" && method !== "HEAD") {
            // Any data-mutating request is high priority (sending messages, reacting, etc.)
            return RequestPriority.HIGH;
        }

        // 3. Prioritize based on URL patterns for GET requests
        if (url.includes("/messages?")) {
            // Assume message loading for the current channel is important.
            // Preloads will be demoted by the header.
            return RequestPriority.HIGH;
        }
        if (url.includes("/typing")) {
            // Typing indicators are important for UX
            return RequestPriority.HIGH;
        }
        if (url.includes("media.discordapp.net") || url.includes("cdn.discordapp.com")) {
            // Media can be background-loaded
            return RequestPriority.LOW;
        }

        // Default to medium for other GET requests (profiles, guilds, etc.)
        return RequestPriority.MEDIUM;
    }

    /**
     * Schedules the queue processing if it's not already running.
     */
    private scheduleProcessing(): void {
        if (!this.isProcessing) {
            this.isProcessing = true;
            setTimeout(() => this.processQueues(), 0);
        }
    }

    /**
     * Processes requests from the queues based on priority and pacing.
     */
    private async processQueues(): Promise<void> {
        while (true) {
            const request = this.dequeue();
            if (!request) {
                this.isProcessing = false;
                return;
            }

            // Pacing logic
            if (this.concurrentRequests >= this.maxConcurrentRequests) {
                // Re-queue and wait
                this.queues.get(request.priority)!.unshift(request);
                await new Promise(resolve => setTimeout(resolve, 50)); // Wait a bit
                continue;
            }

            this.concurrentRequests++;

            if (this.originalFetch) {
                this.originalFetch(request.url, request.options)
                    .then(request.resolve)
                    .catch(request.reject)
                    .finally(() => {
                        this.concurrentRequests--;
                        // Immediately try to process the next item
                        this.scheduleProcessing();
                    });
            } else {
                // Should not happen if start() was called
                request.reject(new Error("Scheduler was not started correctly."));
                this.concurrentRequests--;
            }
        }
    }

    /**
     * Dequeues the highest-priority request available.
     */
    private dequeue(): QueuedRequest | undefined {
        return this.queues.get(RequestPriority.HIGH)!.shift()
            ?? this.queues.get(RequestPriority.MEDIUM)!.shift()
            ?? this.queues.get(RequestPriority.LOW)!.shift();
    }
}

export const requestScheduler = new SmartScheduler();

/**
 * Schedules a fetchMessages call with a specific priority.
 * This is the primary way other modules should interact with message fetching.
 */
export async function scheduleMessageFetch(options: { channelId: string; limit: number; }, priority: RequestPriority): Promise<void> {
    const originalFetchMessages = MessageActions.fetchMessages;

    // Wrap the call to inject our priority header via a temporary patch on window.fetch
    const tempFetch = window.fetch;

    // This is a bit of a hack, but it's the most reliable way to tag
    // the specific request generated by fetchMessages.
    window.fetch = (url: RequestInfo | URL, fetchOptions?: RequestInit): Promise<Response> => {
        const newOptions = { ...fetchOptions };
        newOptions.headers = {
            ...newOptions.headers,
            "X-Request-Priority": RequestPriority[priority]
        };
        return tempFetch(url, newOptions);
    };

    try {
        await originalFetchMessages(options);
    } finally {
        // IMPORTANT: Always restore the original fetch function
        window.fetch = tempFetch;
    }
} 