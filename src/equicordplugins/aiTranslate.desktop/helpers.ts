/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface ChatCompletionMessage {
    role: "system" | "user";
    content: string;
}

export interface ChatCompletionRequest {
    model: string;
    messages: ChatCompletionMessage[];
    temperature?: number;
    reasoning_effort?: "none";
}

export interface TranslationResponseResult {
    translatedText: string;
}

export interface ContentCacheKeySettings {
    model: string;
    targetLanguage: string;
    systemPrompt?: string;
}

export type TranslationStatus = "translating" | "sent" | "failed" | "rateLimited";

export const DEFAULT_OPENCODE_ZEN_MODEL = "big-pickle";
export const OPENCODE_ZEN_CHAT_COMPLETIONS_ENDPOINT = "https://opencode.ai/zen/v1/chat/completions";
export const OPENCODE_ZEN_MODELS_ENDPOINT = "https://opencode.ai/zen/v1/models";
export const DEFAULT_SYSTEM_PROMPT = "You rewrite outgoing Discord messages in {{target_language}} so they sound like something a real person would send. Keep the meaning, tone, energy, slang, emojis, mentions, URLs, code, and line breaks. If the message is casual, keep it casual. If it is blunt, keep it blunt. Use natural phrasing for that language, not textbook wording. Output only the rewritten message.";
const GENERATION_CONTROLS = {
    temperature: 1,
    reasoning_effort: "none",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function applyTargetLanguage(systemPrompt: string, targetLanguage: string): string {
    return systemPrompt.replace(/{{target_language}}/g, targetLanguage);
}

function normalizeCacheContent(content: string): string {
    return content.trim().replace(/\s+/g, " ");
}

function normalizeScriptLanguage(language: string): string {
    const normalized = language.toLowerCase();
    if (normalized.includes("chinese")) return "Chinese";
    if (normalized.includes("japanese")) return "Japanese";
    if (normalized.includes("korean")) return "Korean";
    if (normalized.includes("cyrillic") || normalized.includes("russian") || normalized.includes("ukrainian") || normalized.includes("bulgarian") || normalized.includes("serbian")) return "Cyrillic";
    if (normalized.includes("arabic") || normalized.includes("persian") || normalized.includes("urdu")) return "Arabic";
    if (normalized.includes("hebrew")) return "Hebrew";
    if (normalized.includes("thai")) return "Thai";
    if (normalized.includes("devanagari") || normalized.includes("hindi")) return "Devanagari";
    if (normalized.includes("bengali")) return "Bengali";
    if (normalized.includes("greek")) return "Greek";

    return "Unknown";
}

function detectLanguageScript(content: string): string {
    if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(content)) return "Japanese";
    if (/\p{Script=Hangul}/u.test(content)) return "Korean";
    if (/\p{Script=Han}/u.test(content)) return "Chinese";
    if (/\p{Script=Cyrillic}/u.test(content)) return "Cyrillic";
    if (/\p{Script=Arabic}/u.test(content)) return "Arabic";
    if (/\p{Script=Hebrew}/u.test(content)) return "Hebrew";
    if (/\p{Script=Thai}/u.test(content)) return "Thai";
    if (/\p{Script=Devanagari}/u.test(content)) return "Devanagari";
    if (/\p{Script=Bengali}/u.test(content)) return "Bengali";
    if (/\p{Script=Greek}/u.test(content)) return "Greek";

    return "Unknown";
}

function getResponseDetail(responseBody: string): string {
    let parsed: unknown;
    try {
        parsed = JSON.parse(responseBody);
    } catch {
        return responseBody;
    }

    if (!isRecord(parsed)) return responseBody;
    if (!isRecord(parsed.error)) return JSON.stringify(parsed);

    const detail: string[] = [];
    for (const value of Object.values(parsed.error)) {
        if (typeof value === "string") detail.push(value);
    }

    return detail.join(" ");
}

export function isOpenCodeFreeModel(model: string): boolean {
    const normalized = model.trim().toLowerCase();
    return normalized === DEFAULT_OPENCODE_ZEN_MODEL || normalized.includes("free");
}

export function parseOpenCodeFreeModelsResponse(responseBody: string): string[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(responseBody);
    } catch {
        return [DEFAULT_OPENCODE_ZEN_MODEL];
    }

    const rawModels = isRecord(parsed) && Array.isArray(parsed.data) ? parsed.data : [];
    const models = new Set<string>([DEFAULT_OPENCODE_ZEN_MODEL]);

    for (const model of rawModels) {
        const id = isRecord(model) && typeof model.id === "string" ? model.id.trim() : "";
        if (id && isOpenCodeFreeModel(id)) models.add(id);
    }

    return [...models].sort((a: string, b: string) => {
        if (a === DEFAULT_OPENCODE_ZEN_MODEL) return -1;
        if (b === DEFAULT_OPENCODE_ZEN_MODEL) return 1;
        return a.localeCompare(b);
    });
}

export function hasTranslatableContent(content: string): boolean {
    const text = content
        .replace(/<a?:[A-Za-z0-9_]+:\d+>/g, " ")
        .replace(/<(?:@!?|@&|#)\d+>/g, " ")
        .replace(/<t:\d+(?::[tTdDfFR])?>/g, " ")
        .replace(/<\/[^:>]+:\d+>/g, " ")
        .replace(/\b(?:https?:\/\/|discord:\/\/|(?:cdn|media)\.discordapp\.(?:com|net)\/)\S+/gi, " ")
        .replace(/\p{Extended_Pictographic}/gu, " ")
        .replace(/\p{Regional_Indicator}/gu, " ")
        .replace(/\p{Emoji_Modifier}/gu, " ")
        .replace(/\u200D/g, " ")
        .replace(/\u20E3/g, " ")
        .replace(/[\uFE0E\uFE0F]/g, " ")
        .replace(/[`*_~|>#[\](){}.,!?;:'"\\/@$%^&+=…—–-]/g, " ")
        .trim();

    return /\p{L}/u.test(text);
}

export function shouldTranslateOutgoingContent(content: string, targetLanguage: string, enabled = true): boolean {
    if (!enabled || !hasTranslatableContent(content)) return false;

    const targetScript = normalizeScriptLanguage(targetLanguage);
    if (targetScript === "Unknown") return true;

    return detectLanguageScript(content) !== targetScript;
}

export function buildJsonHeaders(): Record<string, string> {
    return { "Content-Type": "application/json" };
}

export function getAutoTranslateToggleLabel(enabled: boolean): string {
    return enabled ? "AI outgoing translate is on." : "AI outgoing translate is off.";
}

export function getTranslationStatusMessage(status: TranslationStatus, retryMs = 0): string {
    if (status === "translating") return "Translating your message.";
    if (status === "sent") return "Translated message sent.";
    if (status === "failed") return "Translation failed, so the message was not sent.";

    return `AI Translate is cooling down. Try again in ${Math.ceil(retryMs / 1000)} seconds.`;
}

export function getContentCacheKey(content: string, settings: ContentCacheKeySettings): string {
    return JSON.stringify([
        "ai-translate-outgoing-v1",
        normalizeCacheContent(content),
        settings.model.trim(),
        settings.targetLanguage.trim(),
        settings.systemPrompt ?? "",
    ]);
}

export function buildTranslationRequest(
    text: string,
    targetLanguage: string,
    model: string,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    useGenerationControls = true
): ChatCompletionRequest {
    const prompt = applyTargetLanguage(systemPrompt, targetLanguage);
    const userPrompt = `Message to rewrite in ${targetLanguage}:\n${text}`;
    const request: ChatCompletionRequest = {
        model,
        messages: [
            { role: "system", content: prompt },
            { role: "user", content: userPrompt },
        ],
    };

    return {
        ...request,
        ...(useGenerationControls ? GENERATION_CONTROLS : {}),
    };
}

export function getGenerationControlsRetryPayload(responseBody: string, payload: string): string | null {
    const detail = getResponseDetail(responseBody).toLowerCase();
    const mentionsControl = detail.includes("temperature")
        || detail.includes("reasoning_effort")
        || detail.includes("extra_body")
        || detail.includes("thinking_config")
        || detail.includes("thinking_budget")
        || detail.includes("include_thoughts");
    const rejectsControl = detail.includes("unsupported")
        || detail.includes("not supported")
        || detail.includes("unknown")
        || detail.includes("unrecognized")
        || detail.includes("invalid parameter")
        || detail.includes("extra fields");

    if (!mentionsControl || !rejectsControl) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(payload);
    } catch {
        return null;
    }

    if (!isRecord(parsed)) return null;
    if (!("temperature" in parsed) && !("reasoning_effort" in parsed) && !("extra_body" in parsed)) return null;

    const retryPayload: Record<string, unknown> = { ...parsed };
    delete retryPayload.temperature;
    delete retryPayload.reasoning_effort;
    delete retryPayload.extra_body;

    return JSON.stringify(retryPayload);
}

export function stripReasoningText(text: string): string {
    return text
        .replace(/^\s*<(thought|thinking|think|analysis)>[\s\S]*?<\/\1>\s*/i, "")
        .replace(/^\s*<(thought|thinking|think|analysis)>[\s\S]*?$/i, "")
        .trim();
}

export function parseTranslationResponse(responseBody: string): TranslationResponseResult | null {
    if (!responseBody) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(responseBody);
    } catch {
        return null;
    }

    if (!isRecord(parsed) || isRecord(parsed.error)) return null;

    const { choices } = parsed;
    if (!Array.isArray(choices) || choices.length === 0) return null;

    const firstChoice = choices[0];
    if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null;

    const { content } = firstChoice.message;
    if (typeof content !== "string") return null;

    const translatedText = stripReasoningText(content);
    if (!translatedText) return null;

    return { translatedText };
}
