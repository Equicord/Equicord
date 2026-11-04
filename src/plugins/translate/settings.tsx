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

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { OptionType } from "@utils/types";

import { AIProviderPresets, ConfiguredAIModel, ConfiguredAIProvider } from "./ai";
import { AISettings } from "./AISettings";
import { openTranslateModal } from "./TranslateModal";

export const settings = definePluginSettings({
    receivedInput: {
        type: OptionType.STRING,
        description: "Language incoming messages are translated from",
        default: "auto",
        hidden: true
    },
    receivedOutput: {
        type: OptionType.STRING,
        description: "Language incoming messages are translated to",
        default: "en",
        hidden: true
    },
    sentInput: {
        type: OptionType.STRING,
        description: "Language your messages are translated from",
        default: "auto",
        hidden: true
    },
    sentOutput: {
        type: OptionType.STRING,
        description: "Language your messages are translated to",
        default: "en",
        hidden: true
    },
    service: {
        type: OptionType.SELECT,
        description: IS_WEB ? "Translation provider (not available on web)" : "Translation provider",
        hidden: IS_WEB,
        options: [
            { label: "Google Translate", value: "google", default: true },
            { label: "DeepL Free - API key required", value: "deepl" },
            { label: "DeepL Pro - API key required", value: "deepl-pro" },
            { label: "Kagi Translate - API key required", value: "kagi" },
            { label: "AI - API key required", value: "ai" },
            { label: "Mixed - AI API key required", value: "mixed" }
        ] as const,
        onChange: resetLanguageDefaults
    },
    deeplApiKey: {
        type: OptionType.STRING,
        displayName: "DeepL API key",
        description: "Used by Free and Pro.",
        default: "",
        componentProps: { type: "password" }
    },
    kagiSession: {
        type: OptionType.STRING,
        displayName: "Kagi session",
        description: "Your Kagi session token.",
        default: "",
        componentProps: { type: "password" }
    },
    aiProviderName: {
        type: OptionType.STRING,
        hidden: true,
        displayName: "Name",
        description: "A name for this provider.",
        default: "OpenAI",
        isValid: (value: string) => !!value.trim() || "Enter a provider name."
    },
    aiProvider: {
        type: OptionType.SELECT,
        hidden: true,
        displayName: "Provider",
        description: "Switching clears the API key.",
        options: [
            { label: "OpenAI", value: "openai", default: true },
            { label: "OpenRouter", value: "openrouter" },
            { label: "Anthropic", value: "anthropic" },
            { label: "Custom", value: "custom" }
        ] as const,
        onChange(value) {
            settings.store.aiApiKey = "";
            if (value === "custom") return;
            const preset = AIProviderPresets[value];
            settings.store.aiBaseUrl = preset.baseUrl;
            settings.store.aiAuthorizationHeader = preset.authorizationHeader;
            settings.store.aiFormat = preset.format;
            settings.store.aiModel = preset.model;
        }
    },
    aiBaseUrl: {
        type: OptionType.STRING,
        hidden: true,
        displayName: "Base URL",
        description: "Include the API version path.",
        default: AIProviderPresets.openai.baseUrl,
        isValid(value: string) {
            try {
                const url = new URL(value);
                return (url.protocol === "https:" && !url.username && !url.password && !url.hash) || "Enter an HTTPS base URL without credentials or a fragment.";
            } catch {
                return "Enter a valid HTTPS base URL.";
            }
        }
    },
    aiApiKey: {
        type: OptionType.STRING,
        hidden: true,
        displayName: "API key",
        description: "Receives message text.",
        default: "",
        componentProps: { type: "password" }
    },
    aiAuthorizationHeader: {
        type: OptionType.STRING,
        hidden: true,
        displayName: "Auth header",
        description: "Authorization adds the Bearer prefix.",
        default: AIProviderPresets.openai.authorizationHeader,
        isValid: (value: string) => /^[\w-]+$/.test(value) || "Enter a valid authorization header name."
    },
    aiFormat: {
        type: OptionType.SELECT,
        hidden: true,
        displayName: "API format",
        description: "Match your endpoint’s API.",
        options: [
            { label: "OpenAI", value: "openai", default: true },
            { label: "Anthropic", value: "anthropic" }
        ] as const
    },
    aiModel: {
        type: OptionType.STRING,
        hidden: true,
        displayName: "Model",
        description: "The provider’s model ID.",
        default: AIProviderPresets.openai.model,
        isValid: (value: string) => !!value.trim() || "Enter a model identifier."
    },
    aiMaxTokens: {
        type: OptionType.NUMBER,
        hidden: true,
        displayName: "Max tokens",
        description: "Response length limit.",
        default: 128_000,
        isValid: (value: number) => (Number.isSafeInteger(Number(value)) && Number(value) > 0) || "Enter a positive whole number."
    },
    aiSettings: {
        type: OptionType.COMPONENT,
        component: ErrorBoundary.wrap(AISettings, { noop: true })
    },
    mixedFallback: {
        type: OptionType.SELECT,
        displayName: "Judge fallback",
        description: "",
        options: [
            { label: "Google Translate", value: "google", default: true },
            { label: "DeepL Free", value: "deepl" },
            { label: "DeepL Pro", value: "deepl-pro" },
            { label: "Kagi", value: "kagi" }
        ] as const
    },
    autoTranslate: {
        type: OptionType.BOOLEAN,
        description: "Automatically translate your messages before sending. You can also Shift+click or right-click the translate button to toggle this",
        default: false
    },
    showAutoTranslateTooltip: {
        type: OptionType.BOOLEAN,
        description: "Show a tooltip on the chat bar button when a message is auto-translated",
        default: true
    },
    manageTranslateSettings: {
        type: OptionType.COMPONENT,
        component: () => (
            <Button onClick={openTranslateModal}>
                Customize translation languages & Auto-Translate
            </Button>
        )
    }
}, {
    deeplApiKey: {
        hidden() { return this.store.service !== "deepl" && this.store.service !== "deepl-pro"; }
    },
    kagiSession: {
        hidden() { return this.store.service !== "kagi"; }
    },
    aiSettings: { hidden() { return this.store.service !== "ai" && this.store.service !== "mixed"; } },
    mixedFallback: { hidden() { return this.store.service !== "mixed"; } }
}).withPrivateSettings<{
    dismissedAutoTranslateAlert?: boolean;
    aiProviders?: ConfiguredAIProvider[];
    aiSelected?: string;
    mixedSources?: string[];
    mixedJudge?: string;
}>();

export function getAIProviders(): ConfiguredAIProvider[] {
    const { aiProviders, aiProvider, aiBaseUrl, aiApiKey, aiAuthorizationHeader, aiFormat, aiModel, aiMaxTokens } = settings.store;
    return aiProviders?.map(provider => ({ ...provider, models: provider.models?.map(model => ({ ...model })) })) ?? [{
        id: "legacy",
        name: { openai: "OpenAI", openrouter: "OpenRouter", anthropic: "Anthropic", custom: "Custom" }[aiProvider ?? "openai"],
        baseUrl: aiBaseUrl,
        apiKey: aiApiKey,
        authorizationHeader: aiAuthorizationHeader,
        format: aiFormat ?? "openai",
        model: aiModel,
        maxTokens: aiMaxTokens
    }];
}

export function getAIModels(): ConfiguredAIModel[] {
    return getAIProviders().flatMap(provider => [
        { ...provider, providerId: provider.id },
        ...(provider.models ?? []).filter(model => model.model.trim()).map(model => ({ ...provider, ...model, providerId: provider.id }))
    ]);
}

export function getMixedSources(): string[] {
    return settings.store.mixedSources ?? ["google", ...getAIProviders().slice(0, 1).map(provider => provider.id)];
}

export function resetLanguageDefaults() {
    if (IS_WEB || settings.store.service === "google" || settings.store.service === "kagi" || settings.store.service === "ai" || settings.store.service === "mixed") {
        settings.store.receivedInput = "auto";
        settings.store.receivedOutput = "en";
        settings.store.sentInput = "auto";
        settings.store.sentOutput = "en";
    } else {
        settings.store.receivedInput = "";
        settings.store.receivedOutput = "en-us";
        settings.store.sentInput = "";
        settings.store.sentOutput = "en-us";
    }
}
