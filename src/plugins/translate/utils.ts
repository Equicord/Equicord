/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { classNameFactory } from "@utils/css";
import { onlyOnce } from "@utils/onlyOnce";
import { PluginNative } from "@utils/types";
import { showToast } from "@webpack/common";

import { completion } from "./ai";
import { InvalidApiKeyError, notifyInvalidApiKey, resetCredentialWarning } from "./credentials";
import { DeeplLanguages, deeplLanguageToGoogleLanguage, GoogleLanguages, KagiLanguages } from "./languages";
import { mixedTranslate } from "./mixed";
import { getAIModels, resetLanguageDefaults, settings } from "./settings";

export const cl = classNameFactory("vc-trans-");

const Native = VencordNative.pluginHelpers.Translate as PluginNative<typeof import("./native")>;

async function abortableNativeRequest<T>(signal: AbortSignal | undefined, request: (requestId?: string) => Promise<T>): Promise<T> {
    if (!signal) return request();
    signal.throwIfAborted();
    const requestId = crypto.randomUUID();
    const cancel = () => { Native.cancelTranslateRequest(requestId); };
    signal.addEventListener("abort", cancel, { once: true });
    try {
        return await request(requestId);
    } finally {
        signal.removeEventListener("abort", cancel);
    }
}

interface GoogleData {
    translation: string;
    sourceLanguage: string;
}

interface DeeplData {
    translations: {
        detected_source_language: string;
        text: string;
    }[];
}

interface KagiData {
    translation: string;
    detected_language: {
        label: string;
    };
}

export interface TranslationValue {
    sourceLanguage: string;
    text: string;
}

export type TranslationProgress = (status: string) => void;

export const getLanguages = () => {
    if (IS_WEB) {
        return GoogleLanguages;
    }
    switch (settings.store.service) {
        case "google":
        case "ai":
        case "mixed":
            return GoogleLanguages;
        case "kagi":
            return KagiLanguages;
        default:
            return DeeplLanguages;
    }
};

export async function translate(kind: "received" | "sent", text: string, onProgress?: TranslationProgress): Promise<TranslationValue> {
    const translate = IS_WEB ? googleTranslate : (() => {
        switch (settings.store.service) {
            case "google":
                return googleTranslate;
            case "kagi":
                return kagiTranslate;
            case "ai":
                return aiTranslate;
            case "mixed":
                return mixedTranslate;
            default:
                return deeplTranslate;
        }
    })();

    try {
        onProgress?.("Translating…");
        return await translate(
            text,
            settings.store[`${kind}Input`],
            settings.store[`${kind}Output`],
            onProgress
        );
    } catch (e) {
        const userMessage = e instanceof Error ? e.message : typeof e === "string"
            ? e
            : "Something went wrong. If this issue persists, please check the console or ask for help in the support server.";

        if (!(e instanceof InvalidApiKeyError)) showToast({ text: userMessage, variant: "critical" });

        throw e instanceof Error
            ? e
            : new Error(userMessage);
    }
}

export async function aiTranslate(text: string, sourceLang: string, targetLang: string, onProgress?: TranslationProgress, provider = getAIModels().find(entry => entry.id === settings.store.aiSelected) ?? getAIModels()[0]): Promise<TranslationValue> {
    if (!provider?.apiKey.trim())
        throw new Error("Enter an AI API key in Translate settings.");
    if (!provider.model.trim())
        throw new Error("Enter an AI model in Translate settings.");
    onProgress?.(`Translating with ${provider.name} / ${provider.model}…`);

    return {
        sourceLanguage: sourceLang === "auto" ? "Auto" : GoogleLanguages[sourceLang] ?? sourceLang,
        text: await completion({
            provider,
            model: provider.model,
            maxTokens: provider.maxTokens,
            text,
            sourceLanguage: sourceLang === "auto" ? "auto" : GoogleLanguages[sourceLang] ?? sourceLang,
            targetLanguage: GoogleLanguages[targetLang] ?? targetLang
        })
    };
}

export async function googleTranslate(text: string, sourceLang: string, targetLang: string, onProgress?: TranslationProgress): Promise<TranslationValue> {
    const url = "https://translate-pa.googleapis.com/v1/translate?" + new URLSearchParams({
        "params.client": "gtx",
        "dataTypes": "TRANSLATION",
        "key": "AIzaSyDLEeFI5OtFBwYBIoK_jj5m32rZK5CkCXA", // some google API key
        "query.sourceLanguage": sourceLang,
        "query.targetLanguage": targetLang,
        "query.text": text,
    });

    onProgress?.("Connecting to Google Translate…");
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok)
        throw new Error(
            `Failed to translate "${text}" (${sourceLang} -> ${targetLang})`
            + `\n${res.status} ${res.statusText}`
        );

    onProgress?.("Receiving translation from Google Translate…");
    const { sourceLanguage, translation }: GoogleData = await res.json();

    return {
        sourceLanguage: GoogleLanguages[sourceLanguage] ?? sourceLanguage,
        text: translation
    };
}

function fallbackToGoogle(text: string, sourceLang: string, targetLang: string, onProgress?: TranslationProgress): Promise<TranslationValue> {
    return googleTranslate(
        text,
        deeplLanguageToGoogleLanguage(sourceLang),
        deeplLanguageToGoogleLanguage(targetLang),
        onProgress
    );
}

const showDeeplApiQuotaToast = onlyOnce(
    () => showToast({ text: "Deepl API quota exceeded. Falling back to Google Translate", variant: "critical" })
);

export async function deeplTranslate(text: string, sourceLang: string, targetLang: string, onProgress?: TranslationProgress, pro = settings.store.service === "deepl-pro", fallback = true, notifyAuthFailure = true, signal?: AbortSignal): Promise<TranslationValue> {
    if (!settings.store.deeplApiKey) {
        if (!fallback) throw new Error("Enter a DeepL API key in Translate settings.");
        showToast({ text: "DeepL API key is not set. Resetting to Google", variant: "critical" });

        settings.store.service = "google";
        resetLanguageDefaults();

        return fallbackToGoogle(text, sourceLang, targetLang, onProgress);
    }

    onProgress?.("Translating with DeepL…");
    // CORS jumpscare
    const apiKey = settings.store.deeplApiKey;
    const { status, data } = await abortableNativeRequest(signal, requestId => Native.makeDeeplTranslateRequest(
        pro,
        apiKey,
        JSON.stringify({
            text: [text],
            target_lang: targetLang,
            source_lang: sourceLang.split("-")[0]
        }),
        requestId
    ));

    switch (status) {
        case 200:
            resetCredentialWarning("deeplApiKey");
            break;
        case -1:
            throw "Failed to connect to DeepL API: " + data;
        case 401:
        case 403:
            if (notifyAuthFailure) notifyInvalidApiKey("deeplApiKey", apiKey);
            throw new InvalidApiKeyError("The DeepL API key is invalid, expired, or for a different plan.");
        case 456:
            if (!fallback) throw new Error("DeepL API quota exceeded.");
            showDeeplApiQuotaToast();
            return fallbackToGoogle(text, sourceLang, targetLang, onProgress);
        default:
            throw new Error(`Failed to translate "${text}" (${sourceLang} -> ${targetLang})\n${status} ${data}`);
    }

    const { translations }: DeeplData = JSON.parse(data);
    const src = translations[0].detected_source_language;

    return {
        sourceLanguage: DeeplLanguages[src] ?? src,
        text: translations[0].text
    };
}

export async function kagiTranslate(text: string, sourceLang: string, targetLang: string, onProgress?: TranslationProgress, notifyAuthFailure = true, signal?: AbortSignal): Promise<TranslationValue> {
    onProgress?.("Translating with Kagi…");
    const token = settings.store.kagiSession;
    const { status, data } = await abortableNativeRequest(signal, requestId => Native.makeKagiTranslateRequest(
        token, text, sourceLang, targetLang, requestId
    ));

    switch (status) {
        case 200:
            resetCredentialWarning("kagiSession");
            break;
        case 401:
            if (notifyAuthFailure) notifyInvalidApiKey("kagiSession", token);
            throw new InvalidApiKeyError("The Kagi session is invalid or expired. Update it and try again.");
        default:
            throw new Error(`Failed to translate "${text}" (${sourceLang} -> ${targetLang})\n${status} ${data}`);
    }

    const { detected_language, translation }: KagiData = data;

    return {
        sourceLanguage: detected_language.label,
        text: translation
    };
}
