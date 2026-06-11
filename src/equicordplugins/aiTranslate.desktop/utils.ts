/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import type { PluginNative } from "@utils/types";

import {
    buildTranslationRequest,
    DEFAULT_OPENCODE_ZEN_MODEL,
    getContentCacheKey,
    getGenerationControlsRetryPayload,
    isOpenCodeFreeModel,
    parseTranslationResponse,
} from "./helpers";
import type { OpenCodeZenResult } from "./native";
import { settings } from "./settings";

interface AITranslation {
    translated: string;
}

interface TranslationRequestConfig {
    model: string;
    targetLanguage: string;
    systemPrompt?: string;
}

interface QueuedRequest {
    reject(error: Error): void;
    run(): void;
}

type TranslateRequestResult = OpenCodeZenResult;

const Native = VencordNative.pluginHelpers.AITranslate as PluginNative<typeof import("./native")>;
const logger = new Logger("AITranslate");
const contentTranslationCache = new Map<string, AITranslation>();
const contentInProgress = new Map<string, Promise<AITranslation | null>>();
const generationControlsUnsupported = new Set<string>();
const rateLimitedUntil = new Map<string, number>();
const lastFailureLog = new Map<string, number>();
const queuedRequests: QueuedRequest[] = [];
const MAX_CONCURRENT_TRANSLATION_REQUESTS = 1;
const RATE_LIMIT_COOLDOWN_MS = 60_000;
const FAILURE_LOG_COOLDOWN_MS = 30_000;
let activeRequestCount = 0;
let contentCacheGeneration = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getApiErrorMessage(body: string, status: number): string {
    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        parsed = null;
    }

    if (isRecord(parsed) && isRecord(parsed.error)) {
        const { message, param, status: errorStatus } = parsed.error;
        if (typeof message === "string" && typeof param === "string") return `${message}. ${param}`;
        if (typeof message === "string" && typeof errorStatus === "string") return `${message}. ${errorStatus}`;
        if (typeof message === "string") return message;
    }

    return status > 0 ? `Request failed with status ${status}.` : "Request failed.";
}

function getRequestConfigKey(config: TranslationRequestConfig): string {
    return JSON.stringify([config.model]);
}

function drainQueuedRequests() {
    while (activeRequestCount < MAX_CONCURRENT_TRANSLATION_REQUESTS) {
        const queued = queuedRequests.shift();
        if (!queued) return;

        activeRequestCount++;
        queued.run();
    }
}

function enqueueTranslationRequest<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        queuedRequests.push({
            reject,
            run() {
                task().then(resolve, reject).finally(() => {
                    activeRequestCount--;
                    drainQueuedRequests();
                });
            },
        });
        drainQueuedRequests();
    });
}

function getRateLimitedResponse(config: TranslationRequestConfig): TranslateRequestResult | null {
    const retryAt = rateLimitedUntil.get(getRequestConfigKey(config));
    if (retryAt === undefined || Date.now() >= retryAt) return null;

    return { ok: false, status: 429, body: "", error: "Rate limited. Waiting before retrying." };
}

export function getTranslationRateLimitMs(targetLanguage = settings.store.targetLanguage): number {
    const config = getTranslationConfig(targetLanguage, false);
    if (!config) return 0;

    const retryAt = rateLimitedUntil.get(getRequestConfigKey(config));
    return retryAt === undefined ? 0 : Math.max(0, retryAt - Date.now());
}

function rememberRateLimit(config: TranslationRequestConfig, response: TranslateRequestResult) {
    if (response.status !== 429) return;
    rateLimitedUntil.set(getRequestConfigKey(config), Date.now() + RATE_LIMIT_COOLDOWN_MS);
}

async function makeTranslateRequest(payload: string): Promise<TranslateRequestResult> {
    return await Native.makeTranslateRequest(payload);
}

export function abortActiveTranslations() {
    for (const queued of queuedRequests.splice(0)) queued.reject(new Error("Request cancelled."));
}

export function clearContentTranslationCache() {
    contentCacheGeneration++;
    contentTranslationCache.clear();
    contentInProgress.clear();
    rateLimitedUntil.clear();
    lastFailureLog.clear();
}

function getConfiguredModel(): string {
    const { model } = settings.store;
    if (typeof model === "string" && isOpenCodeFreeModel(model)) return model.trim();

    return DEFAULT_OPENCODE_ZEN_MODEL;
}

function getTranslationConfig(targetLanguage: string, logFailure = true): TranslationRequestConfig | null {
    const model = getConfiguredModel();
    const normalizedTargetLanguage = targetLanguage.trim();

    if (!model || !normalizedTargetLanguage) {
        if (logFailure) logger.warn("Model and target language are required.");
        return null;
    }

    return {
        model,
        targetLanguage: normalizedTargetLanguage,
        systemPrompt: settings.store.systemPrompt,
    };
}

function showTranslationRequestFailure(response: TranslateRequestResult): null {
    const message = response.error ?? getApiErrorMessage(response.body, response.status);
    const now = Date.now();
    const last = lastFailureLog.get(message) ?? 0;
    if (now - last > FAILURE_LOG_COOLDOWN_MS) {
        lastFailureLog.set(message, now);
        logger.warn(`Translation request failed. ${message}`);
    }
    return null;
}

function showMissingTranslationFailure(): null {
    logger.warn("Translation response did not include translated text.");
    return null;
}

async function makeTranslateRequestWithRetry(
    config: TranslationRequestConfig,
    buildPayload: (requestConfig: TranslationRequestConfig, useGenerationControls: boolean) => string
): Promise<{ response: TranslateRequestResult; config: TranslationRequestConfig; }> {
    try {
        return await enqueueTranslationRequest(async () => {
            const configKey = getRequestConfigKey(config);
            const controlsUnsupported = generationControlsUnsupported.has(configKey);
            const useGenerationControls = !controlsUnsupported;
            const payload = buildPayload(config, useGenerationControls);
            let response = getRateLimitedResponse(config) ?? await makeTranslateRequest(payload);
            rememberRateLimit(config, response);
            if (response.ok) return { response, config };

            const retryPayload = getGenerationControlsRetryPayload(response.body, payload);
            if (!retryPayload) return { response, config };

            generationControlsUnsupported.add(configKey);
            logger.warn("Retrying translation request without generation controls.");
            response = getRateLimitedResponse(config) ?? await makeTranslateRequest(retryPayload);
            rememberRateLimit(config, response);

            return { response, config };
        });
    } catch {
        return { response: { ok: false, status: 0, body: "", error: "Request cancelled." }, config };
    }
}

async function requestTranslation(text: string, config: TranslationRequestConfig): Promise<AITranslation | null> {
    const { response } = await makeTranslateRequestWithRetry(config, (requestConfig: TranslationRequestConfig, useGenerationControls: boolean) => JSON.stringify(buildTranslationRequest(
        text,
        requestConfig.targetLanguage,
        requestConfig.model,
        requestConfig.systemPrompt,
        useGenerationControls
    )));
    if (!response.ok) return showTranslationRequestFailure(response);

    const parsed = parseTranslationResponse(response.body);
    if (!parsed) return showMissingTranslationFailure();

    return { translated: parsed.translatedText };
}

export async function translateText(text: string, targetLanguage = settings.store.targetLanguage): Promise<AITranslation | null> {
    const config = getTranslationConfig(targetLanguage);
    if (!config) return null;

    const cacheKey = getContentCacheKey(text, config);
    const cached = contentTranslationCache.get(cacheKey);
    if (cached) return cached;

    const active = contentInProgress.get(cacheKey);
    if (active) return await active;

    const generation = contentCacheGeneration;
    const promise = requestTranslation(text, config);
    contentInProgress.set(cacheKey, promise);

    try {
        const translation = await promise;
        if (translation && generation === contentCacheGeneration) contentTranslationCache.set(cacheKey, translation);
        return translation;
    } finally {
        if (contentInProgress.get(cacheKey) === promise) contentInProgress.delete(cacheKey);
    }
}
