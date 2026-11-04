/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showToast } from "@webpack/common";

import { completion } from "./ai";
import { DeeplLanguages, deeplLanguageToGoogleLanguage, GoogleLanguages } from "./languages";
import { getAIModels, getMixedSources, settings } from "./settings";
import { aiTranslate, deeplTranslate, googleTranslate, kagiTranslate, TranslationProgress, TranslationValue } from "./utils";

export async function mixedTranslate(text: string, sourceLang: string, targetLang: string, onProgress?: TranslationProgress): Promise<TranslationValue> {
    const providers = getAIModels();
    const judge = providers.find(provider => provider.id === settings.store.mixedJudge)
        ?? providers.find(provider => provider.id === settings.store.aiSelected)
        ?? providers[0];
    const sources = [...new Set(getMixedSources())];
    if (sources.length < 2)
        throw new Error("Choose at least two translation sources for Mixed mode.");

    let finished = 0;
    onProgress?.(`Translating with ${sources.length} sources…`);
    const results = await Promise.allSettled(sources.map(async source => {
        try {
            let result: TranslationValue;
            switch (source) {
                case "google":
                case "deepl":
                case "deepl-pro":
                case "kagi":
                    result = await translateBuiltin(source, text, sourceLang, targetLang);
                    break;
                default: {
                    const provider = providers.find(entry => entry.id === source);
                    if (!provider) throw new Error("A selected AI provider was removed.");
                    result = await aiTranslate(text, sourceLang, targetLang, undefined, provider);
                }
            }
            if (!result.text.trim()) throw new Error("A provider returned an empty translation.");
            return result;
        } finally {
            onProgress?.(`Finished ${++finished} of ${sources.length} sources…`);
        }
    }));
    const candidates = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
    if (!candidates.length)
        throw new Error("All translation sources failed. Check their credentials and try again.");

    if (candidates.length < sources.length)
        showToast({ text: `${sources.length - candidates.length} translation sources failed. Using the remaining results.`, variant: "critical" });
    if (candidates.every(candidate => candidate.text === candidates[0].text)) return candidates[0];

    try {
        if (!judge?.apiKey.trim() || !judge.model.trim())
            throw new Error("Configure a judge model and API key in Translate settings.");
        onProgress?.(`Comparing translations with ${judge.name} / ${judge.model}…`);
        const chosen = await completion({
            provider: judge,
            model: judge.model,
            maxTokens: judge.maxTokens,
            text,
            sourceLanguage: sourceLang === "auto" ? "auto" : GoogleLanguages[sourceLang] ?? sourceLang,
            targetLanguage: GoogleLanguages[targetLang] ?? targetLang,
            candidates: candidates.map(candidate => candidate.text)
        });
        const result = candidates.find(candidate => candidate.text === chosen);
        if (!result) throw new Error("The judge did not select a translation. Try again.");
        return result;
    } catch {
        onProgress?.("The judge failed. Translating with the fallback provider…");
        const result = await translateBuiltin(settings.store.mixedFallback ?? "google", text, sourceLang, targetLang);
        if (!result.text.trim()) throw new Error("The fallback provider returned an empty translation.");
        return result;
    }
}

function translateBuiltin(source: "google" | "deepl" | "deepl-pro" | "kagi", text: string, sourceLang: string, targetLang: string): Promise<TranslationValue> {
    switch (source) {
        case "google":
            return googleTranslate(text, sourceLang, targetLang);
        case "deepl":
        case "deepl-pro": {
            const input = sourceLang === "auto" ? "" : Object.keys(DeeplLanguages).find(language => deeplLanguageToGoogleLanguage(language) === sourceLang);
            const output = Object.keys(DeeplLanguages).find(language => deeplLanguageToGoogleLanguage(language) === targetLang);
            if (input === undefined || output === undefined)
                throw new Error("DeepL does not support the selected language.");
            return deeplTranslate(text, input, output, undefined, source === "deepl-pro", false);
        }
        case "kagi": {
            if (!settings.store.kagiSession.trim())
                throw new Error("Enter a Kagi session token in Translate settings.");
            const convert = (language: string) => ({ en: "en_us", pt: "pt_pt" }[language] ?? language.toLowerCase().replace("-", "_"));
            return kagiTranslate(text, convert(sourceLang), convert(targetLang));
        }
    }
}
