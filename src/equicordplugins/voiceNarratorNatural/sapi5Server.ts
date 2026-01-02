/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

const logger = new Logger("VcNarrator-SAPI5");

const TTS_PORT = 5550;
const TTS_URL = `http://127.0.0.1:${TTS_PORT}`;

export interface SAPI5Voice {
    id: string;
    name: string;
}

let cachedVoices: SAPI5Voice[] = [];
let serverReady = false;

export async function isServerRunning(): Promise<boolean> {
    try {
        const response = await fetch(`${TTS_URL}/ping`, { 
            method: "GET",
            signal: AbortSignal.timeout(1000)
        });
        if (response.ok) {
            serverReady = true;
            return true;
        }
    } catch {
        serverReady = false;
    }
    return false;
}

export async function getSAPI5Voices(): Promise<SAPI5Voice[]> {
    if (!serverReady) {
        const running = await isServerRunning();
        if (!running) return [];
    }

    try {
        const response = await fetch(`${TTS_URL}/voices`);
        if (response.ok) {
            const data = await response.json();
            cachedVoices = data.voices || [];
            return cachedVoices;
        }
    } catch (e) {
        logger.error("Failed to get SAPI5 voices:", e);
    }
    return cachedVoices;
}

export async function speakWithSAPI5(text: string, voiceId?: string, rate = 0, volume = 100): Promise<boolean> {
    if (!text.trim()) return true;

    if (!serverReady) {
        const running = await isServerRunning();
        if (!running) {
            logger.warn("SAPI5 server not running");
            return false;
        }
    }

    try {
        const params = new URLSearchParams({
            text: text,
            rate: String(rate),
            volume: String(volume)
        });
        
        if (voiceId) {
            params.set("voice", voiceId);
        }

        const response = await fetch(`${TTS_URL}/speak?${params}`);
        return response.ok;
    } catch (e) {
        logger.error("Failed to speak with SAPI5:", e);
        return false;
    }
}

export async function stopSAPI5(): Promise<void> {
    if (!serverReady) return;

    try {
        await fetch(`${TTS_URL}/stop`);
    } catch {
        // Ignora erros ao parar
    }
}

export async function shutdownServer(): Promise<void> {
    try {
        await fetch(`${TTS_URL}/shutdown`);
        serverReady = false;
    } catch {
        // Servidor pode já ter fechado
    }
}

export function getCachedVoices(): SAPI5Voice[] {
    return cachedVoices;
}

export function isReady(): boolean {
    return serverReady;
}
