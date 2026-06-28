/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";
import { findByPropsLazy } from "@webpack";
import {
    RelationshipStore,
    UserStore,
    VoiceStateStore
} from "@webpack/common";
import {
    AFFINITY_WEIGHT,
    DM_COOLDOWN_MS,
    DM_POINTS,
    DM_WEIGHT,
    HALF_LIFE_MS,
    KEEP_TOP_ENTRIES,
    MIN_SCORE_THRESHOLD,
    STORE_KEY_PREFIX,
    VC_POINTS,
    VC_WEIGHT
} from "./constants";
import settings from "./settings";
import type { FrequencyData } from "./types";

const logger = new Logger("FrequentFriends");
const UserAffinitiesStore = findByPropsLazy("getUserAffinities");

export let frequencyCache: Record<string, FrequencyData> = Object.create(null);
export let lastBackup: Record<string, FrequencyData> | null = null;
let voiceScoreInterval: ReturnType<typeof setInterval> | null = null;
let voiceScoringActive = false;
export let currentVoiceChannelId: string | null = null;
let saveDebounce: ReturnType<typeof setTimeout> | null = null;
let currentStoreKey: string = STORE_KEY_PREFIX + "default";

export let onScoreUpdate: (() => void) | null = null;
export let onBackupChange: (() => void) | null = null;

const scoreListeners = new Set<() => void>();
export function subscribeToScoreChanges(fn: () => void): () => void {
    scoreListeners.add(fn);
    return () => scoreListeners.delete(fn);
}
function notifyScoreListeners() { onScoreUpdate?.(); for (const fn of scoreListeners) fn(); }

const backupListeners = new Set<() => void>();
export function subscribeToBackupChanges(fn: () => void): () => void {
    backupListeners.add(fn);
    return () => backupListeners.delete(fn);
}
function notifyBackupListeners() { onBackupChange?.(); for (const fn of backupListeners) fn(); }

export function setFrequencyCache(cache: Record<string, FrequencyData>) {
    frequencyCache = cache;
    notifyScoreListeners();
}
export function setLastBackup(backup: Record<string, FrequencyData> | null) {
    lastBackup = backup;
    notifyBackupListeners();
}
export function setCurrentVoiceChannelId(id: string | null) { currentVoiceChannelId = id; }

export function getDecay(elapsedMs: number): number {
    if (elapsedMs <= 0) return 1;
    return Math.pow(0.5, elapsedMs / HALF_LIFE_MS);
}

export async function loadData() {
    const currentUser = UserStore.getCurrentUser();
    currentStoreKey = currentUser
        ? STORE_KEY_PREFIX + currentUser.id
        : STORE_KEY_PREFIX + "default";
    try {
        const source = await DataStore.get(currentStoreKey);
        frequencyCache = (source && typeof source === "object") ? source : Object.create(null);
    } catch (e) {
        logger.warn("Failed to load data", e);
        frequencyCache = Object.create(null);
    }
    notifyScoreListeners();
}

export function queueSave() {
    if (saveDebounce) clearTimeout(saveDebounce);
    saveDebounce = setTimeout(() => {
        saveDebounce = null;
        DataStore.set(currentStoreKey, frequencyCache).catch(e => logger.warn("Failed to save", e));
    }, 400);
}

export function getCurrentStoreKey(): string { return currentStoreKey; }

function trimCache() {
    const entries = Object.entries(frequencyCache);
    if (entries.length <= KEEP_TOP_ENTRIES) return;
    const sorted = entries
        .map(([id, data]) => ({ id, score: getCompositeScore(data) }))
        .sort((a, b) => b.score - a.score);
    for (const { id, score } of sorted.slice(KEEP_TOP_ENTRIES)) {
        if (score < MIN_SCORE_THRESHOLD) delete frequencyCache[id];
    }
}

interface UserAffinity {
    otherUserId?: string;
    user_id?: string;
    dmProbability?: number;
    vcProbability?: number;
}

function getSafeAffinities(): UserAffinity[] {
    if (settings.store.ignoreAffinities) return [];
    try {
        if (!UserAffinitiesStore || typeof UserAffinitiesStore.getUserAffinities !== "function") return [];
        const data = UserAffinitiesStore.getUserAffinities();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

export async function syncWithAffinities() {
    if (settings.store.ignoreAffinities) return;
    const affinities = getSafeAffinities();
    if (affinities.length === 0) return;
    const now = Date.now();
    let changed = false;
    for (const affinity of affinities) {
        const userId = affinity.otherUserId ?? affinity.user_id;
        if (!userId || typeof userId !== "string") continue;
        if (!RelationshipStore.isFriend(userId)) continue;
        const dmP = affinity.dmProbability ?? 0;
        const vcP = affinity.vcProbability ?? 0;
        if (!frequencyCache[userId]) {
            frequencyCache[userId] = {
                ds: dmP * 20,
                vs: vcP * 20,
                dl: dmP > 0 ? now : 0,
                vl: vcP > 0 ? now : 0,
                af: (dmP + vcP) * 50
            };
            changed = true;
        }
    }
    if (changed) {
        queueSave();
        notifyScoreListeners();
    }
}

export function getCompositeScore(data: FrequencyData): number {
    const now = Date.now();
    const dmDecayed = data.dl > 0 ? data.ds * getDecay(now - data.dl) : 0;
    const vcDecayed = data.vl > 0 ? data.vs * getDecay(now - data.vl) : 0;
    const affinityPart = settings.store.ignoreAffinities ? 0 : data.af * AFFINITY_WEIGHT;
    return dmDecayed * DM_WEIGHT + vcDecayed * VC_WEIGHT + affinityPart;
}

export function recordInteraction(userId: string, type: "dm" | "voice", weight = 1) {
    if (!userId || typeof userId !== "string") return;
    if (!RelationshipStore.isFriend(userId)) return;
    const now = Date.now();
    if (!frequencyCache[userId]) frequencyCache[userId] = { ds: 0, vs: 0, dl: 0, vl: 0, af: 0 };
    const entry = frequencyCache[userId];
    if (type === "dm") {
        const elapsed = entry.dl > 0 ? now - entry.dl : 0;
        const cooldown = elapsed >= DM_COOLDOWN_MS ? 1 : elapsed / DM_COOLDOWN_MS;
        entry.ds = entry.ds * getDecay(elapsed) + DM_POINTS * weight * cooldown;
        entry.dl = now;
    } else {
        const elapsed = entry.vl > 0 ? now - entry.vl : 0;
        entry.vs = entry.vs * getDecay(elapsed) + VC_POINTS * weight;
        entry.vl = now;
    }
    trimCache();
    queueSave();
    notifyScoreListeners();
}

export function getRankedFriendIds(): string[] {
    return Object.entries(frequencyCache)
        .filter(([id]) => RelationshipStore.isFriend(id))
        .map(([id, data]) => ({ id, score: getCompositeScore(data) }))
        .sort((a, b) => b.score - a.score)
        .map(e => e.id);
}

export function startVoiceScoring() {
    if (voiceScoringActive) {
        stopVoiceScoring();
    }
    voiceScoringActive = true;
    voiceScoreInterval = setInterval(() => {
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser || !currentVoiceChannelId) { stopVoiceScoring(); return; }
        const allVoiceStates = VoiceStateStore.getVoiceStatesForChannel(currentVoiceChannelId);
        if (!allVoiceStates) return;
        for (const peerId of Object.keys(allVoiceStates)) {
            if (peerId !== currentUser.id && RelationshipStore.isFriend(peerId)) {
                recordInteraction(peerId, "voice");
            }
        }
    }, 60000);
}

export function stopVoiceScoring() {
    voiceScoringActive = false;
    if (voiceScoreInterval) { clearInterval(voiceScoreInterval); voiceScoreInterval = null; }
}
