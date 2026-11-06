/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";

export interface SavedPosition {
    messageId: string;
    /** The message's vertical offset within the viewport, in pixels. */
    offset: number;
}

export interface ChannelHistory {
    /** The saved viewport position, or null when proximity to the latest message cleared the anchor. */
    view?: SavedPosition | null;
    readThroughMessageId?: string;
    updatedAt: number;
}

interface StoredHistory {
    version: 1;
    channels: Record<string, ChannelHistory>;
}

interface AccountHistory {
    userId: string;
    channels: Record<string, ChannelHistory>;
    revision: number;
    persistedRevision: number;
}

const logger = new Logger("BetterBackreading");
const KEY_PREFIX = "BetterBackreading:positions:v1:";
const MAX_AGE = 90 * 24 * 60 * 60 * 1000;
const MAX_CHANNELS = 1000;
const DEBOUNCE_DELAY = 1000;
const MAX_SAVE_DELAY = 5000;

/** Check whether a value is a decimal Discord snowflake within the unsigned 64-bit range. */
export function isValidSnowflake(value: unknown): value is string {
    return typeof value === "string" && /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function copyHistory(history: ChannelHistory): ChannelHistory {
    const copy: ChannelHistory = { updatedAt: history.updatedAt };

    if (history.view !== undefined) {
        copy.view = history.view === null ? null : { ...history.view };
    }

    if (history.readThroughMessageId !== undefined) {
        copy.readThroughMessageId = history.readThroughMessageId;
    }

    return copy;
}

function validateHistory(value: unknown, now: number): ChannelHistory | undefined {
    if (!isObject(value) || typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt) || value.updatedAt < now - MAX_AGE) {
        return;
    }

    const history: ChannelHistory = { updatedAt: Math.min(now, value.updatedAt) };

    if (value.view === null) {
        history.view = null;
    } else if (value.view !== undefined) {
        if (!isObject(value.view) || !isValidSnowflake(value.view.messageId) || typeof value.view.offset !== "number" || !Number.isFinite(value.view.offset)) {
            return;
        }

        history.view = { messageId: value.view.messageId, offset: value.view.offset };
    }

    if (value.readThroughMessageId !== undefined) {
        if (!isValidSnowflake(value.readThroughMessageId)) {
            return;
        }

        history.readThroughMessageId = value.readThroughMessageId;
    }

    return history.view !== undefined || history.readThroughMessageId !== undefined ? history : undefined;
}

function pruneChannels(channels: Record<string, ChannelHistory>, now: number) {
    const entries = Object.entries(channels)
        .filter(([, history]) => history.updatedAt >= now - MAX_AGE)
        .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
        .slice(0, MAX_CHANNELS);

    return Object.fromEntries(entries);
}

/** Manage per-account channel history and queue local persistence. */
export class HistoryStorage {
    private accounts = new Map<string, AccountHistory>();
    private current?: AccountHistory;
    private requestedUserId: string | null = null;
    private ready = false;
    private generation = 0;
    private loading?: Promise<void>;
    private writeQueue: Promise<void> = Promise.resolve();
    private saveTimer?: ReturnType<typeof setTimeout>;
    private firstMutationAt?: number;

    /** Load channel history for an account, or unload it when the account is absent or invalid. */
    load(userId: string | null): Promise<void> {
        if (userId !== null && !isValidSnowflake(userId)) {
            userId = null;
        }

        if (userId === this.requestedUserId && (this.ready || this.loading)) {
            return this.loading ?? Promise.resolve();
        }

        const generation = ++this.generation;
        this.requestedUserId = userId;
        this.ready = false;
        this.cancelSave();
        this.loading = this.loadAccount(userId, generation);

        return this.loading;
    }

    /** Check whether the requested account's channel history is ready to use. */
    isReady(userId: string): boolean {
        return this.ready && this.requestedUserId === userId && this.current?.userId === userId;
    }

    /** Copy a channel's history from the loaded account. */
    get(channelId: string): ChannelHistory | undefined {
        if (!isValidSnowflake(channelId)) {
            return;
        }

        const history = this.ready ? this.current?.channels[channelId] : undefined;

        return history && copyHistory(history);
    }

    /** Save valid channel history in the loaded account and schedule persistence. */
    set(channelId: string, record: ChannelHistory): void {
        if (!this.ready || !this.current || !isValidSnowflake(channelId)) {
            return;
        }

        const history = validateHistory(record, Date.now());

        if (!history) {
            return;
        }

        this.current.channels[channelId] = history;
        this.current.revision++;
        this.scheduleSave();
    }

    /** Remove a channel's history from the loaded account and schedule persistence. */
    delete(channelId: string): void {
        if (!this.ready || !this.current || !Object.hasOwn(this.current.channels, channelId)) {
            return;
        }

        delete this.current.channels[channelId];
        this.current.revision++;
        this.scheduleSave();
    }

    /** Clear channel history for the loaded account and persist pending changes. */
    async clear(): Promise<void> {
        if (!this.ready || !this.current) {
            return;
        }

        this.current.channels = {};
        this.current.revision++;
        await this.flush();
    }

    /** Prune tracked channel histories and queue snapshots of accounts with unsaved changes. */
    flush(): Promise<void> {
        this.cancelSave();
        const snapshots: { account: AccountHistory; revision: number; value: StoredHistory; }[] = [];

        for (const account of this.accounts.values()) {
            const channels = pruneChannels(account.channels, Date.now());

            if (Object.keys(channels).length !== Object.keys(account.channels).length) {
                account.channels = channels;
                account.revision++;
            }

            if (account.revision === account.persistedRevision) {
                continue;
            }

            const snapshotChannels = Object.fromEntries(Object.entries(account.channels).map(([id, history]) => [id, copyHistory(history)]));
            snapshots.push({ account, revision: account.revision, value: { version: 1, channels: snapshotChannels } });
        }

        const save = this.writeQueue.then(async () => {
            let failed = false;
            let failure: unknown;

            for (const { account, revision, value } of snapshots) {
                try {
                    const key = KEY_PREFIX + account.userId;

                    if (Object.keys(value.channels).length) {
                        await DataStore.set(key, value);
                    } else {
                        await DataStore.del(key);
                    }

                    account.persistedRevision = revision;

                    if (account !== this.current && account.revision === revision) {
                        this.accounts.delete(account.userId);
                    }
                } catch (error) {
                    logger.error("Failed to save local channel history.", error);
                    failed = true;
                    failure = error;
                }
            }

            if (failed) {
                throw failure;
            }
        });

        this.writeQueue = save.catch(() => void 0);

        return save;
    }

    private async loadAccount(userId: string | null, generation: number): Promise<void> {
        try {
            await this.flush().catch(() => void 0);

            if (generation !== this.generation) {
                return;
            }

            const previous = this.current;
            this.current = undefined;

            if (previous && previous.revision === previous.persistedRevision) {
                this.accounts.delete(previous.userId);
            }

            if (userId === null) {
                return;
            }

            const pending = this.accounts.get(userId);

            if (pending) {
                this.current = pending;
                this.ready = true;

                return;
            }

            const value = await DataStore.get<unknown>(KEY_PREFIX + userId);

            if (generation !== this.generation) {
                return;
            }

            if (value !== undefined && (!isObject(value) || value.version !== 1 || !isObject(value.channels))) {
                logger.warn("Local channel history has an unsupported format.");

                return;
            }

            const now = Date.now();
            const channels: Record<string, ChannelHistory> = {};
            let changed = false;

            if (isObject(value) && isObject(value.channels)) {
                for (const [channelId, record] of Object.entries(value.channels)) {
                    if (!isValidSnowflake(channelId)) {
                        continue;
                    }

                    const history = validateHistory(record, now);

                    if (history) {
                        channels[channelId] = history;

                        if (isObject(record) && history.updatedAt !== record.updatedAt) {
                            changed = true;
                        }
                    }
                }
            }

            const pruned = pruneChannels(channels, now);

            if (isObject(value) && isObject(value.channels)) {
                const count = Object.keys(pruned).length;
                changed ||= count === 0 || count !== Object.keys(value.channels).length;
            }

            this.current = { userId, channels: pruned, revision: changed ? 1 : 0, persistedRevision: 0 };
            this.accounts.set(userId, this.current);
            this.ready = true;

            if (changed) {
                this.scheduleSave();
            }
        } catch (error) {
            logger.error("Failed to load local channel history.", error);
        } finally {
            if (generation === this.generation) {
                this.loading = undefined;
            }
        }
    }

    private cancelSave(): void {
        clearTimeout(this.saveTimer);
        this.saveTimer = undefined;
        this.firstMutationAt = undefined;
    }

    private scheduleSave(): void {
        const now = Date.now();
        this.firstMutationAt ??= now;
        clearTimeout(this.saveTimer);

        const delay = Math.min(DEBOUNCE_DELAY, Math.max(0, this.firstMutationAt + MAX_SAVE_DELAY - now));
        this.saveTimer = setTimeout(() => void this.flush().catch(() => void 0), delay);
    }
}

export const historyStorage = new HistoryStorage();
