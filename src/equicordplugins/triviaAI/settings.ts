/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/translation";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    apiKey: {
        type: OptionType.STRING,
        description: t("triviaAI.settings.apiKey"),
        default: "",
        placeholder: "Enter API Key here for your AI endpoint.",
        componentProps: {
            type: "password"
        }
    },
    model: {
        type: OptionType.STRING,
        description: t("triviaAI.settings.model"),
        default: "google/gemini-3-flash-preview",
        placeholder: "e.g. google/gemini-3-flash-preview, inception/mercury, openai/gpt-5.2-chat, etc."
    },
    systemPrompt: {
        type: OptionType.STRING,
        description: t("triviaAI.settings.systemPrompt"),
        default: "You are a helpful assistant who answers questions for the user in a concise and short way while using the least amount of words and punctuation.",
        placeholder: "Enter system prompt."
    },
    maxTokens: {
        type: OptionType.NUMBER,
        description: t("triviaAI.settings.maxTokens"),
        default: 500
    },
    endpoint: {
        type: OptionType.STRING,
        description: t("triviaAI.settings.endpoint"),
        default: "https://openrouter.ai/api/v1/chat/completions",
        placeholder: "Enter your OpenAI compatible AI endpoint here."
    },
    autoRespond: {
        type: OptionType.BOOLEAN,
        description: t("triviaAI.settings.autoRespond"),
        default: false
    },
    supportImages: {
        type: OptionType.BOOLEAN,
        description: t("triviaAI.settings.supportImages"),
        default: true
    }
});
