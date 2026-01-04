/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { HeadingPrimary, HeadingSecondary } from "@components/Heading";
import { Devs, EquicordDevs } from "@utils/constants";
import { Margins } from "@utils/margins";
import {
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalProps,
    ModalRoot,
    ModalSize,
    openModal,
} from "@utils/modal";
import { wordsToTitle } from "@utils/text";
import definePlugin, { OptionType } from "@utils/types";
import type { User } from "@vencord/discord-types";
import { findByPropsLazy } from "@webpack";
import {
    Button,
    ChannelStore,
    Forms,
    GuildMemberStore,
    IconUtils,
    Menu,
    React,
    SearchableSelect,
    SelectedChannelStore,
    SelectedGuildStore,
    useMemo,
    UserStore,
} from "@webpack/common";

/*
 * TTS API maintained by example-git
 * The original TikTok TTS API went offline, so I set up a new working cloudflare worker.
 * I made sure it's intentionally rate-limited to keep it feasible. Please don't abuse it
 * so it can stay available for plugins like this one. Thanks! - example-git
 */
const API_BASE = "https://tiktok-tts-aio.exampleuser.workers.dev";

const VOICE_OPTIONS = [
    { label: "Asian: Indonesian Female (id_001)", value: "id_001" },
    { label: "Asian: Japanese Female 1 (jp_001)", value: "jp_001" },
    { label: "Asian: Japanese Female 2 (jp_003)", value: "jp_003" },
    { label: "Asian: Japanese Female 3 (jp_005)", value: "jp_005" },
    { label: "Asian: Japanese Male (jp_006)", value: "jp_006" },
    { label: "Asian: Korean Female (kr_003)", value: "kr_003" },
    { label: "Asian: Korean Male 1 (kr_002)", value: "kr_002" },
    { label: "Asian: Korean Male 2 (kr_004)", value: "kr_004" },
    { label: "English: AU Female (en_au_001)", value: "en_au_001" },
    { label: "English: AU Male (en_au_002)", value: "en_au_002" },
    { label: "English: Funny (en_male_funny)", value: "en_male_funny" },
    { label: "English: Narrator (en_male_narration)", value: "en_male_narration" },
    { label: "English: Peaceful (en_female_emotional)", value: "en_female_emotional" },
    { label: "English: Serious (en_male_cody)", value: "en_male_cody" },
    { label: "English: UK Male 1 (en_uk_001)", value: "en_uk_001" },
    { label: "English: UK Male 2 (en_uk_003)", value: "en_uk_003" },
    { label: "English: US Female 1 (en_us_001)", value: "en_us_001" },
    { label: "English: US Female 2 (en_us_002)", value: "en_us_002" },
    { label: "English: US Male 1 (en_us_006)", value: "en_us_006" },
    { label: "English: US Male 2 (en_us_007)", value: "en_us_007" },
    { label: "English: US Male 3 (en_us_009)", value: "en_us_009" },
    { label: "English: US Male 4 (en_us_010)", value: "en_us_010" },
    { label: "European: French Male 1 (fr_001)", value: "fr_001" },
    { label: "European: French Male 2 (fr_002)", value: "fr_002" },
    { label: "European: German Female (de_001)", value: "de_001" },
    { label: "European: German Male (de_002)", value: "de_002" },
    { label: "European: Italian Male (it_male_m18)", value: "it_male_m18" },
    { label: "European: Spanish Male (es_002)", value: "es_002" },
    { label: "Fun: C3PO (en_us_c3po)", value: "en_us_c3po" },
    { label: "Fun: Chewbacca (en_us_chewbacca)", value: "en_us_chewbacca" },
    { label: "Fun: Ghost Face (en_us_ghostface)", value: "en_us_ghostface" },
    { label: "Fun: Ghost Host (en_male_ghosthost)", value: "en_male_ghosthost" },
    { label: "Fun: Madame Leota (en_female_madam_leota)", value: "en_female_madam_leota" },
    { label: "Fun: Pirate (en_male_pirate)", value: "en_male_pirate" },
    { label: "Fun: Rocket (en_us_rocket)", value: "en_us_rocket" },
    { label: "Fun: Stitch (en_us_stitch)", value: "en_us_stitch" },
    { label: "Fun: Stormtrooper (en_us_stormtrooper)", value: "en_us_stormtrooper" },
    { label: "Latin American: Portuguese BR Female 1 (br_001)", value: "br_001" },
    { label: "Latin American: Portuguese BR Female 2 (br_003)", value: "br_003" },
    { label: "Latin American: Portuguese BR Female 3 (br_004)", value: "br_004" },
    { label: "Latin American: Portuguese BR Male (br_005)", value: "br_005" },
    { label: "Latin American: Spanish MX Male (es_mx_002)", value: "es_mx_002" },
] as const;

// User voice map formats supported:
// - Preferred: "userId:voiceId,userId2:voiceId2" (comma-separated)
// - Legacy: "userId,voiceId\nuserId2,voiceId2" (newline-separated)
function parseUserVoiceMap(input: string): Map<string, string> {
    const map = new Map<string, string>();
    if (!input?.trim()) return map;

    const trimmed = input.trim();

    // Preferred format (comma-separated pairs)
    if (trimmed.includes(":") || trimmed.includes("=")) {
        for (const entry of trimmed.split(",").map(s => s.trim()).filter(Boolean)) {
            const [userId, voiceId] = entry.split(/[:=]/).map(s => s.trim());
            if (userId && voiceId) map.set(userId, voiceId);
        }
        return map;
    }

    // Legacy format (newline-separated "userId,voiceId")
    for (const line of trimmed.split(/\n+/)) {
        const [userId, voiceId] = line.split(",").map(s => s.trim());
        if (userId && voiceId) map.set(userId, voiceId);
    }

    return map;
}

// Get voice for a specific user, falling back to default
function getVoiceForUser(userId?: string): string {
    if (!userId) return settings.store.customVoice;
    const map = parseUserVoiceMap(settings.store.userVoiceMap);
    return map.get(userId) ?? settings.store.customVoice;
}

// Add or update a user's voice in the map
function setUserVoice(userId: string, voiceId: string) {
    const map = parseUserVoiceMap(settings.store.userVoiceMap);
    map.set(userId, voiceId);
    settings.store.userVoiceMap = Array.from(map.entries())
        .map(([uid, vid]) => `${uid}:${vid}`)
        .join(",");
}

// Remove a user from the voice map
function removeUserVoice(userId: string) {
    const map = parseUserVoiceMap(settings.store.userVoiceMap);
    map.delete(userId);
    settings.store.userVoiceMap = Array.from(map.entries())
        .map(([uid, vid]) => `${uid}:${vid}`)
        .join(",");
}

function parseStateChangeFilterList(input: string): Set<string> {
    const set = new Set<string>();
    if (!input?.trim()) return set;

    for (const entry of input.split(",").map(s => s.trim()).filter(Boolean)) {
        set.add(entry);
    }

    return set;
}

function serializeStateChangeFilterList(list: Set<string>) {
    settings.store.stateChangeFilterList = Array.from(list).join(",");
}

function addUserToStateChangeFilter(userId: string) {
    const set = parseStateChangeFilterList(settings.store.stateChangeFilterList);
    set.add(userId);
    serializeStateChangeFilterList(set);
}

function removeUserFromStateChangeFilter(userId: string) {
    const set = parseStateChangeFilterList(settings.store.stateChangeFilterList);
    set.delete(userId);
    serializeStateChangeFilterList(set);
}

// Create an in-memory cache (temporary, lost on restart)
const ttsCache = new Map<string, string>();

// Helper function to open (or create) an IndexedDB database.
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("VcNarratorDB", 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            // Create an object store called "voices" if it doesn't already exist.
            if (!db.objectStoreNames.contains("voices")) {
                db.createObjectStore("voices");
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Function to get a cached voice line from IndexedDB.
async function getCachedVoiceFromDB(cacheKey: string): Promise<Blob | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("voices", "readonly");
        const store = tx.objectStore("voices");
        const request = store.get(cacheKey);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

// Function to store a voice line in IndexedDB.
async function setCachedVoiceInDB(cacheKey: string, blob: Blob): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction("voices", "readwrite");
        const store = tx.objectStore("voices");
        const request = store.put(blob, cacheKey);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

interface VoiceState {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    selfStream?: boolean;
    stream?: boolean;
}

const VoiceStateStore = findByPropsLazy(
    "getVoiceStatesForChannel",
    "getCurrentClientVoiceChannelId"
);

// Mute/Deaf for other people than you is commented out, because otherwise someone can spam it and it will be annoying
// Filtering out events is not as simple as just dropping duplicates, as otherwise mute, unmute, mute would
// not say the second mute, which would lead you to believe they're unmuted

// Queue system to prevent API spam and audio overlap
interface QueueItem {
    text: string;
    userId?: string;
    interruptKey?: string;
    useDefaultVoice?: boolean; // Force default voice (for universal action words)
}
const mainQueue: QueueItem[] = [];
const stateQueue: QueueItem[] = [];
let isSpeaking = false;
let onQueueChange: (() => void) | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentInterruptKey: string | undefined;
let currentStop: (() => void) | null = null;

// Pre-cache common action words in DEFAULT voice - these are universal across all users
// Phonetic spellings used for muted/deafened to ensure clear pronunciation across voices
const COMMON_ACTIONS = ["myooted", "un-myooted", "deafind", "un-deafind", "started streaming", "stopped streaming"];
const DEFAULT_VOICE = "en_male_rocket";
let preCacheInitialized = false;

async function preCacheCommonActions() {
    if (preCacheInitialized) return;
    preCacheInitialized = true;

    // Initial delay before starting pre-cache to not impact startup
    await new Promise(r => setTimeout(r, 3000));

    // Pre-fetch common action words in DEFAULT voice (universal for all users)
    for (const action of COMMON_ACTIONS) {
        const cacheKey = `${DEFAULT_VOICE}_${action}`;

        // 1. Check in-memory cache first
        if (ttsCache.has(cacheKey)) continue;

        // 2. Check persistent IndexedDB cache - load into memory if found
        try {
            const cachedBlob = await getCachedVoiceFromDB(cacheKey);
            if (cachedBlob) {
                ttsCache.set(cacheKey, URL.createObjectURL(cachedBlob));
                continue;
            }
        } catch { /* ignore */ }

        // 3. Fetch from API and store in both memory and persistent DB
        try {
            const response = await fetch(`${API_BASE}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: action, voice: DEFAULT_VOICE, base64: true }),
            });
            if (response.ok) {
                const audioData = atob((await response.text()).trim());
                const binaryData = new Uint8Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    binaryData[i] = audioData.charCodeAt(i);
                }
                const blob = new Blob([binaryData], { type: "audio/mpeg" });

                // Store in memory cache
                ttsCache.set(cacheKey, URL.createObjectURL(blob));

                // Persist to IndexedDB for future sessions
                await setCachedVoiceInDB(cacheKey, blob);
            }
        } catch { /* ignore pre-cache failures */ }

        // Space out API requests to avoid rate limiting (2 seconds between each)
        await new Promise(r => setTimeout(r, 2000));
    }
}

function isQueueBusy() {
    return isSpeaking || mainQueue.length > 0 || stateQueue.length > 0;
}

function interruptPlayback(key: string) {
    if (currentInterruptKey !== key || !currentStop) return;
    currentAudio?.pause();
    currentStop();
}

async function processQueue() {
    if (isSpeaking) return;

    // Optimization: if main queue has intro and state queue has action with no other items,
    // and they're for the same user, combine them into single API call
    if (mainQueue.length === 1 && stateQueue.length === 1 &&
        mainQueue[0].userId === stateQueue[0].userId &&
        !mainQueue[0].interruptKey) {
        const intro = mainQueue.shift()!;
        const action = stateQueue.shift()!;
        const combined: QueueItem = {
            text: `${intro.text} ${action.text}`,
            userId: intro.userId,
            interruptKey: action.interruptKey, // Keep action's interrupt key so rapid switches can interrupt
            useDefaultVoice: false, // Combined uses user voice for the intro part
        };
        mainQueue.push(combined);
    }

    const item = mainQueue.shift() ?? stateQueue.shift();
    if (!item) return;
    isSpeaking = true;
    onQueueChange?.();

    try {
        await speak(item.text, item.userId, item.interruptKey, item.useDefaultVoice);
    } catch (e) {
        console.error("TTS Error:", e);
    }

    // Delay between messages - longer for state changes to allow interruption
    const delay = item.interruptKey ? 800 : 500;
    setTimeout(() => {
        isSpeaking = false;
        onQueueChange?.();
        processQueue();
    }, delay);
}

function queueSpeak(text: string, userId?: string, interruptKey?: string, queue: "main" | "state" = "main", useDefaultVoice?: boolean) {
    if (text.trim().length === 0) return;

    // Anti-spam: cap queue size
    const targetQueue = queue === "state" ? stateQueue : mainQueue;
    if (targetQueue.length >= 5) {
        // If queue is full, drop new to stop the spam wave
        return;
    }

    if (interruptKey) {
        for (let i = targetQueue.length - 1; i >= 0; i--) {
            if (targetQueue[i].interruptKey === interruptKey) {
                targetQueue.splice(i, 1);
            }
        }
        interruptPlayback(interruptKey);
    }

    targetQueue.push({ text, userId, interruptKey, useDefaultVoice });
    onQueueChange?.();
    processQueue();
}

async function speak(text: string, userId?: string, interruptKey?: string, useDefaultVoice?: boolean): Promise<void> {
    return new Promise(resolve => {
        const onEnd = () => {
            if (currentStop === onEnd) {
                currentAudio = null;
                currentInterruptKey = undefined;
                currentStop = null;
            }
            resolve();
        };

        // Helper to play audio and resolve promise when done
        const playAudio = (url: string) => {
            const audio = new Audio(url);
            audio.volume = settings.store.volume;
            audio.playbackRate = settings.store.rate;
            audio.onended = onEnd;
            audio.onerror = onEnd; // Resolve even on error to unblock queue
            currentAudio = audio;
            currentInterruptKey = interruptKey;
            currentStop = onEnd;
            audio.play().catch(onEnd);
        };

        void (async () => {
            // Use default voice for universal actions, otherwise user-specific voice
            const voice = useDefaultVoice ? DEFAULT_VOICE : getVoiceForUser(userId);

            // Create a unique cache key using the voice and text.
            const cacheKey = `${voice}_${text}`;

            // 1. Check the in-memory cache (fast check)
            if (ttsCache.has(cacheKey)) {
                playAudio(ttsCache.get(cacheKey)!);
                return;
            }

            // 2. Check the persistent IndexedDB cache.
            try {
                const cachedBlob = await getCachedVoiceFromDB(cacheKey);
                if (cachedBlob) {
                    const url = URL.createObjectURL(cachedBlob);
                    ttsCache.set(cacheKey, url);
                    playAudio(url);
                    return;
                }
            } catch (err) {
                console.error("Error accessing IndexedDB:", err);
            }

            // 3. Fetch from API
            try {
                const response = await fetch(`${API_BASE}/api/generate`, {
                    method: "POST",
                    mode: "cors",
                    cache: "no-cache",
                    headers: { "Content-Type": "application/json" },
                    referrerPolicy: "no-referrer",
                    body: JSON.stringify({
                        text: text,
                        voice: voice,
                        base64: true,
                    }),
                });

                if (!response.ok) {
                    console.error(`TTS failed: ${response.status}`);
                    resolve(); // Skip this message
                    return;
                }

                const audioData = atob((await response.text()).trim());
                const binaryData = new Uint8Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    binaryData[i] = audioData.charCodeAt(i);
                }

                const blob = new Blob([binaryData], { type: "audio/mpeg" });
                const url = URL.createObjectURL(blob);

                ttsCache.set(cacheKey, url);
                setCachedVoiceInDB(cacheKey, blob).catch(console.error);

                playAudio(url);
            } catch (e) {
                console.error("TTS Network Error:", e);
                resolve();
            }
        })().catch(onEnd);
    });
}

function clean(str: string) {
    const replacer = settings.store.latinOnly
        ? /[^\p{Script=Latin}\p{Number}\p{Punctuation}\s]/gu
        : /[^\p{Letter}\p{Number}\p{Punctuation}\s]/gu;

    return str
        .normalize("NFKC")
        .replace(replacer, "")
        .replace(/_{2,}/g, "_")
        .trim()
        .slice(0, 128);
}

function formatText(
    str: string,
    user: string,
    channel: string,
    displayName: string,
    nickname: string
) {
    return str
        .replaceAll("{{USER}}", clean(user) || (user ? "Someone" : ""))
        .replaceAll("{{CHANNEL}}", clean(channel) || "channel")
        .replaceAll(
            "{{DISPLAY_NAME}}",
            clean(displayName) || (displayName ? "Someone" : "")
        )
        .replaceAll(
            "{{NICKNAME}}",
            clean(nickname) || (nickname ? "Someone" : "")
        );
}

// For every user, channelId and oldChannelId will differ when moving channel.
// Only for the local user, channelId and oldChannelId will be the same when moving channel,
// for some ungodly reason
let myLastChannelId: string | undefined;

type NormalizedVoiceState = {
    muted: boolean;
    deaf: boolean;
    streaming: boolean;
};

let trackedChannelId: string | null = null;
let baselineReady = false;
let baselineUpdateInProgress = false;
const voiceStateSnapshot = new Map<string, NormalizedVoiceState>();
const lastAnnounced = new Map<string, number>();
const lastIntroSpokenAt = new Map<string, number>();
const INTRO_REUSE_MS = 2000;

function normalizeState(state: VoiceState): NormalizedVoiceState {
    return {
        muted: !!(state.mute || state.selfMute),
        deaf: !!(state.deaf || state.selfDeaf),
        streaming: !!((state as any).selfStream || (state as any).stream),
    };
}

function shouldAnnounce(key: string): boolean {
    const cd = settings.store.stateChangeCooldownMs ?? 0;
    if (cd <= 0) return true;
    const now = Date.now();
    const last = lastAnnounced.get(key) ?? 0;
    if (now - last < cd) return false;
    lastAnnounced.set(key, now);
    return true;
}

type StateActionType = "stream" | "mute" | "deaf";

/**
 * State change narration format:
 * 
 * For mute/deaf: "{USER}" (non-interruptable) + "{ACTION}" (interruptable)
 * - "Username" + "myooted" / "un-myooted" / "deafind" / "un-deafind"
 * 
 * For streaming: "{USER}" (non-interruptable) + "{VERB} streaming" (interruptable)
 * - "Username" + "started streaming" / "stopped streaming"
 * 
 * The intro part (user name) plays through main queue and won't be interrupted.
 * The action part plays through state queue and can be interrupted by subsequent state changes.
 * Phonetic spellings used for muted/deafened to ensure clear pronunciation.
 */
function buildStateSegments(
    type: StateActionType,
    isOn: boolean,
    preferredName: string,
    isSelf: boolean
): { intro: string; action: string; } {
    const name = clean(preferredName) || (isSelf ? "You" : "Someone");

    if (type === "stream") {
        return {
            intro: name,
            action: isOn ? "started streaming" : "stopped streaming",
        };
    }

    // Mute and deaf - no verb, just name + phonetic action
    const action = type === "mute"
        ? (isOn ? "myooted" : "un-myooted")
        : (isOn ? "deafind" : "un-deafind");

    return {
        intro: name,
        action,
    };
}

/**
 * Queue a state change announcement with split intro/action.
 * 
 * - Intro ("{USER}") goes to main queue, non-interruptable
 * - Action goes to state queue, interruptable by same user
 * 
 * All actions for the same user share an interrupt key so rapid state changes
 * (e.g., mute->unmute->mute) only play the final state.
 */
function queueStateSplitAnnouncement(
    userId: string,
    intro: string,
    actionText: string
) {
    const safeIntro = intro.trim();
    const shouldQueueIntro = safeIntro && (Date.now() - (lastIntroSpokenAt.get(userId) ?? 0) > INTRO_REUSE_MS);

    if (shouldQueueIntro) {
        lastIntroSpokenAt.set(userId, Date.now());
    }

    // Handle interrupt key for action - remove any pending actions for this user
    const interruptKey = `${userId}:state:action`;
    for (let i = stateQueue.length - 1; i >= 0; i--) {
        if (stateQueue[i].interruptKey === interruptKey) {
            stateQueue.splice(i, 1);
        }
    }
    interruptPlayback(interruptKey);

    // Add both items to queues BEFORE processing
    if (shouldQueueIntro) {
        mainQueue.push({ text: safeIntro, userId, interruptKey: undefined, useDefaultVoice: false });
    }
    stateQueue.push({ text: actionText, userId, interruptKey, useDefaultVoice: true });

    onQueueChange?.();
    processQueue();
}

async function refreshBaseline(channelId: string) {
    if (baselineUpdateInProgress) return;

    baselineUpdateInProgress = true;
    trackedChannelId = channelId;
    baselineReady = false;

    for (let i = 0; i < 15; i++) {
        const states = VoiceStateStore.getVoiceStatesForChannel?.(channelId);
        if (states) {
            voiceStateSnapshot.clear();
            for (const s of Object.values(states) as any[]) {
                if (!s?.userId) continue;
                voiceStateSnapshot.set(s.userId, normalizeState(s as VoiceState));
            }
            baselineReady = true;
            break;
        }
        await new Promise(r => setTimeout(r, 200));
    }

    baselineUpdateInProgress = false;
}

function getTypeAndChannelId(
    { channelId, oldChannelId }: VoiceState,
    isMe: boolean
) {
    if (isMe && channelId !== myLastChannelId) {
        oldChannelId = myLastChannelId;
        myLastChannelId = channelId;
    }

    if (channelId !== oldChannelId) {
        if (channelId) return [oldChannelId ? "move" : "join", channelId];
        if (oldChannelId) return ["leave", oldChannelId];
    }
    return ["", ""];
}

function playSample(tempSettings: any, type: string) {
    const settingsobj = Object.assign(
        {},
        settings.store,
        tempSettings
    );
    const currentUser = UserStore.getCurrentUser();
    const myGuildId = SelectedGuildStore.getGuildId();

    queueSpeak(
        formatText(
            settingsobj[type + "Message"],
            currentUser.username,
            "general",
            (currentUser as any).globalName ?? currentUser.username,
            (myGuildId ? GuildMemberStore.getNick(myGuildId, currentUser.id) : null) ?? currentUser.username
        )
    );
}

const settings = definePluginSettings({
    customVoice: {
        type: OptionType.SELECT,
        description: "Narrator voice",
        options: VOICE_OPTIONS,
        default: "en_us_001",
    },
    volume: {
        type: OptionType.SLIDER,
        description: "Narrator Volume",
        default: 1,
        markers: [0, 0.25, 0.5, 0.75, 1],
        stickToMarkers: false,
    },
    rate: {
        type: OptionType.SLIDER,
        description: "Narrator Speed",
        default: 1,
        markers: [0.1, 0.5, 1, 2, 5, 10],
        stickToMarkers: false,
    },
    sayOwnName: {
        description: "Say own name",
        type: OptionType.BOOLEAN,
        default: false,
    },
    ignoreSelf: {
        description: "Ignore yourself for all events.",
        type: OptionType.BOOLEAN,
        default: false,
    },
    latinOnly: {
        description:
            "Strip non latin characters from names before saying them",
        type: OptionType.BOOLEAN,
        default: false,
    },
    joinMessage: {
        type: OptionType.STRING,
        description: "Join Message",
        default: "{{DISPLAY_NAME}} joined",
    },
    leaveMessage: {
        type: OptionType.STRING,
        description: "Leave Message",
        default: "{{DISPLAY_NAME}} left",
    },
    moveMessage: {
        type: OptionType.STRING,
        description: "Move Message",
        default: "{{DISPLAY_NAME}} moved to {{CHANNEL}}",
    },
    announceOthersMute: {
        description: "Announce other users muting/unmuting (your current VC only) (set to a static voice)",
        type: OptionType.BOOLEAN,
        default: false,
    },
    announceOthersDeafen: {
        description: "Announce other users deafening/undeafening (your current VC only) (set to a static voice",
        type: OptionType.BOOLEAN,
        default: false,
    },
    announceOthersStream: {
        description: "Announce other users starting/stopping stream (your current VC only) (set to a static voice",
        type: OptionType.BOOLEAN,
        default: false,
    },
    announceSelfStream: {
        description: "Announce when you start/stop streaming",
        type: OptionType.BOOLEAN,
        default: false,
    },
    stateChangeCooldownMs: {
        description: "State-change announce cooldown (ms)",
        type: OptionType.SLIDER,
        default: 1500,
        markers: [0, 250, 500, 1000, 1500, 2500, 5000, 10000],
        stickToMarkers: true,
    },
    userVoiceMap: {
        type: OptionType.STRING,
        description: "Per-user voice overrides (format: userId:voiceId,userId2:voiceId2). Right-click users to set.",
        default: "",
    },
    stateChangeFilterMode: {
        type: OptionType.SELECT,
        description: "Filter which users trigger state-change announcements",
        options: [
            { label: "Off", value: "off" },
            { label: "Whitelist (only announce listed users)", value: "whitelist" },
            { label: "Blacklist (announce everyone except listed)", value: "blacklist" },
        ],
        default: "off",
    },
    stateChangeFilterList: {
        type: OptionType.STRING,
        description: "Comma-separated user IDs for whitelist/blacklist. Right-click users to add/remove.",
        default: "",
    },
});

interface UserContextProps {
    user: User;
}

// Voice selection modal component
function VoiceSelectModal({ modalProps, user }: { modalProps: ModalProps; user: User; }) {
    const DEFAULT_VALUE = "__default__";

    const options = useMemo(() => {
        return [
            { label: `Default (${settings.store.customVoice})`, value: DEFAULT_VALUE },
            ...VOICE_OPTIONS.map(v => ({ label: v.label, value: v.value })),
        ];
    }, [settings.store.customVoice]);

    const [currentValue, setCurrentValue] = React.useState<string>(DEFAULT_VALUE);

    React.useEffect(() => {
        const map = parseUserVoiceMap(settings.store.userVoiceMap);
        setCurrentValue(map.get(user.id) ?? DEFAULT_VALUE);
    }, [user.id, settings.store.userVoiceMap]);

    return (
        <ModalRoot {...modalProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <HeadingPrimary style={{ flexGrow: 1 }}>VC Narrator Voice</HeadingPrimary>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>

            <ModalContent>
                <section className={Margins.bottom16}>
                    <HeadingSecondary>Select voice for {user.username}</HeadingSecondary>
                    <SearchableSelect
                        options={options}
                        value={options.find(o => o.value === currentValue)}
                        placeholder="Select a voice"
                        maxVisibleItems={6}
                        closeOnSelect={true}
                        onChange={v => setCurrentValue(v as any)}
                    />
                </section>
            </ModalContent>

            <ModalFooter>
                <div style={{ display: "flex", justifyContent: "center", gap: "8px", width: "100%" }}>
                    <Button
                        color={Button.Colors.PRIMARY}
                        onClick={modalProps.onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        color={Button.Colors.BRAND}
                        onClick={() => {
                            if (currentValue === DEFAULT_VALUE) {
                                removeUserVoice(user.id);
                            } else {
                                setUserVoice(user.id, currentValue);
                            }
                            modalProps.onClose();
                        }}
                    >
                        Save
                    </Button>
                </div>
            </ModalFooter>
        </ModalRoot>
    );
}

function openVoiceSelectModal(user: User) {
    openModal(modalProps => (
        <ErrorBoundary>
            <VoiceSelectModal modalProps={modalProps} user={user} />
        </ErrorBoundary>
    ));
}

// Context menu to assign voice to user
const UserContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    if (!user) return;

    const map = parseUserVoiceMap(settings.store.userVoiceMap);
    const currentVoice = map.get(user.id);
    const voiceLabel = currentVoice
        ? VOICE_OPTIONS.find(v => v.value === currentVoice)?.label ?? currentVoice
        : "Default";

    const filterMode = settings.store.stateChangeFilterMode ?? "off";
    const filterSet = parseStateChangeFilterList(settings.store.stateChangeFilterList);
    const inFilter = filterSet.has(user.id);
    const filterEnabled = filterMode === "whitelist" || filterMode === "blacklist";
    const filterLabel =
        filterMode === "whitelist"
            ? inFilter ? "Remove from whitelist" : "Add to whitelist"
            : filterMode === "blacklist"
                ? inFilter ? "Remove from blacklist" : "Add to blacklist"
                : "State-change filter (enable in settings)";
    const filterAction = !filterEnabled
        ? undefined
        : () => {
            if (inFilter) {
                removeUserFromStateChangeFilter(user.id);
            } else {
                addUserToStateChangeFilter(user.id);
            }
        };

    children.push(
        <Menu.MenuItem
            id="vc-narrator-submenu"
            label="VC Narrator"
            children={[
                <Menu.MenuItem
                    key="voice"
                    id="vc-narrator-voice"
                    label={`Voice: ${voiceLabel}`}
                    action={() => openVoiceSelectModal(user)}
                />,
                <Menu.MenuItem
                    key="filter"
                    id="vc-narrator-state-filter"
                    label={filterLabel}
                    disabled={!filterEnabled}
                    action={filterAction}
                />,
            ]}
        />
    );
};

export default definePlugin({
    name: "VcNarratorCustom",
    description: "Announces when users join, leave, or move voice channels via narrator using TikTok TTS. Revamped and back from the dead.",
    authors: [Devs.Ven, Devs.Nyako, EquicordDevs.Loukios, EquicordDevs.examplegit],
    settings,
    contextMenus: {
        "user-context": UserContextMenuPatch,
        "user-profile-actions": UserContextMenuPatch
    },

    start() {
        // Pre-cache common action words in background for faster state change announcements
        preCacheCommonActions();
    },

    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const myGuildId = SelectedGuildStore.getGuildId();
            const myChanId = SelectedChannelStore.getVoiceChannelId();
            const myId = UserStore.getCurrentUser().id;
            const filterMode = settings.store.stateChangeFilterMode ?? "off";
            const filterList = parseStateChangeFilterList(settings.store.stateChangeFilterList);
            const allowStateChange = (targetId: string, isSelf: boolean) => {
                if (isSelf) return true;
                if (filterMode === "off") return true;
                const inList = filterList.has(targetId);
                return filterMode === "whitelist" ? inList : !inList;
            };

            if (myChanId && ChannelStore.getChannel(myChanId)?.type === 13 /* Stage Channel */) return;

            if (!myChanId) {
                trackedChannelId = null;
                baselineReady = false;
                voiceStateSnapshot.clear();
            } else if (trackedChannelId !== myChanId) {
                await refreshBaseline(myChanId);
            }

            const isBatchUpdate = voiceStates.length > 1 && voiceStates.some(s => !("oldChannelId" in (s as any)));
            if (isBatchUpdate && myChanId) {
                // Guild-open / bulk refresh: update baseline silently to avoid spam.
                await refreshBaseline(myChanId);
                return;
            }

            for (const state of voiceStates) {
                const { userId, channelId } = state;
                let { oldChannelId } = state;

                const isMe = userId === myId;
                if (isMe && channelId !== myLastChannelId) {
                    oldChannelId = myLastChannelId;
                    myLastChannelId = channelId ?? undefined;
                }

                const affectsMyChannel = channelId === myChanId || oldChannelId === myChanId;
                if (!isMe && !affectsMyChannel) continue;

                // Keep snapshots in sync for join/leave/move without announcing state changes.
                if (oldChannelId !== myChanId && channelId === myChanId) {
                    voiceStateSnapshot.set(userId, normalizeState(state));
                } else if (oldChannelId === myChanId && channelId !== myChanId) {
                    voiceStateSnapshot.delete(userId);
                }

                // Join/leave/move announcements (existing behavior)
                const [type, id] = getTypeAndChannelId({ ...state, oldChannelId }, isMe);
                if (type) {
                    const template = settings.store[type + "Message"];
                    const u = isMe && !settings.store.sayOwnName ? "" : UserStore.getUser(userId).username;
                    const displayName = u && ((UserStore.getUser(userId) as any).globalName ?? u);
                    const nickname = u && ((myGuildId ? GuildMemberStore.getNick(myGuildId, userId) : null) ?? displayName);
                    const channel = ChannelStore.getChannel(id)?.name ?? "channel";

                    queueSpeak(formatText(template, u, channel, displayName, nickname), userId);

                    if (isMe && (type === "join" || type === "move") && id) {
                        await refreshBaseline(id);
                    }

                    continue;
                }

                // State-change announcements (mute/deafen/stream), only when user is in our current VC.
                if (channelId !== myChanId) continue;
                if (!baselineReady) continue;

                const prev = voiceStateSnapshot.get(userId);
                const next = normalizeState(state);
                voiceStateSnapshot.set(userId, next);
                if (!prev) continue;

                if (!allowStateChange(userId, isMe)) continue;

                const userObj = isMe && !settings.store.sayOwnName ? "" : UserStore.getUser(userId).username;
                const displayName = userObj && ((UserStore.getUser(userId) as any).globalName ?? userObj);
                const nickname = userObj && ((myGuildId ? GuildMemberStore.getNick(myGuildId, userId) : null) ?? displayName);
                const preferredName = nickname || displayName || userObj || (isMe ? "You" : "Someone");

                if (prev.streaming !== next.streaming && (isMe ? settings.store.announceSelfStream : settings.store.announceOthersStream)) {
                    const key = `${userId}:stream`;
                    if (shouldAnnounce(key)) {
                        const seg = buildStateSegments("stream", next.streaming, preferredName, isMe);
                        queueStateSplitAnnouncement(userId, seg.intro, seg.action);
                    }
                }

                // Deafen takes priority over mute (you're always muted when deafened)
                // Only announce mute if deaf state didn't change
                if (!isMe && settings.store.announceOthersDeafen && prev.deaf !== next.deaf) {
                    const key = `${userId}:deaf`;
                    if (shouldAnnounce(key)) {
                        const seg = buildStateSegments("deaf", next.deaf, preferredName, isMe);
                        queueStateSplitAnnouncement(userId, seg.intro, seg.action);
                    }
                } else if (!isMe && settings.store.announceOthersMute && prev.muted !== next.muted) {
                    const key = `${userId}:mute`;
                    if (shouldAnnounce(key)) {
                        const seg = buildStateSegments("mute", next.muted, preferredName, isMe);
                        queueStateSplitAnnouncement(userId, seg.intro, seg.action);
                    }
                }
            }
        },

        AUDIO_TOGGLE_SELF_MUTE() {
            const chanId = SelectedChannelStore.getVoiceChannelId()!;
            const s = VoiceStateStore.getVoiceStateForChannel(
                chanId
            ) as VoiceState;
            if (!s) return;
        },

        AUDIO_TOGGLE_SELF_DEAF() {
            const chanId = SelectedChannelStore.getVoiceChannelId()!;
            const s = VoiceStateStore.getVoiceStateForChannel(
                chanId
            ) as VoiceState;
            if (!s) return;
        },
    },

    settingsAboutComponent({ tempSettings: s }) {
        const types = useMemo(
            () =>
                Object.keys(settings.store!)
                    .filter(k => k.endsWith("Message"))
                    .map(k => k.slice(0, -7)),
            []
        );

        const [busy, setBusy] = React.useState(isQueueBusy());

        React.useEffect(() => {
            onQueueChange = () => setBusy(isQueueBusy());
            return () => { onQueueChange = null; };
        }, []);

        const authorUser = UserStore.getUser(EquicordDevs.examplegit.id);
        const authorAvatar = authorUser ? IconUtils.getUserAvatarURL(authorUser, false, 64) : null;

        const errorComponent: React.ReactElement | null = null;

        return (
            <Forms.FormSection>
                <Forms.FormText>
                    You can customise the spoken messages below. You can disable
                    specific messages by setting them to nothing
                </Forms.FormText>
                <Forms.FormText style={{ fontSize: "12px", opacity: 0.85 }}>
                    Placeholders: <code>{"{{USER}}"}</code>, <code>{"{{DISPLAY_NAME}}"}</code>, <code>{"{{NICKNAME}}"}</code>, <code>{"{{CHANNEL}}"}</code>
                </Forms.FormText>
                <div
                    style={{
                        marginTop: "10px",
                        padding: "10px 12px",
                        background: "var(--background-secondary-alt)",
                        borderRadius: "10px",
                        border: "1px solid var(--background-tertiary)",
                        borderLeft: "3px solid var(--brand-experiment)",
                        display: "flex",
                        gap: "10px",
                        alignItems: "flex-start",
                    }}
                >
                    {authorAvatar && (
                        <img
                            src={authorAvatar}
                            style={{ width: "24px", height: "24px", borderRadius: "999px", marginTop: "2px" }}
                        />
                    )}
                    <div style={{ minWidth: 0 }}>
                        <Forms.FormText style={{ marginBottom: "2px", fontWeight: 600, fontSize: "12px" }}>
                            Note from example-git
                        </Forms.FormText>
                        <Forms.FormText style={{ fontSize: "12px", opacity: 0.85 }}>
                            Old TikTok-TTS API died, so I set up a new cloudflare worker. It's rate-limited and stricter than the old one by design — please don't abuse it so it can stay available for plugins like this.
                        </Forms.FormText>
                    </div>
                </div>
                <Forms.FormTitle className={Margins.top20} tag="h3">
                    Play Example Sounds {busy && "(playing...)"}
                </Forms.FormTitle>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "1rem",
                    }}
                    className={"vc-narrator-buttons"}
                >
                    {types.map(t => (
                        <Button key={t} disabled={busy} onClick={() => playSample(s, t)}>
                            {wordsToTitle([t])}
                        </Button>
                    ))}
                </div>
                {errorComponent}
            </Forms.FormSection>
        );
    },
});
