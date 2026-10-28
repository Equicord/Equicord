/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Notice } from "@components/Notice";
import { useCspPermission } from "@utils/csp";
import { OptionType } from "@utils/types";

function EndpointNotice() {
    const { endpoint } = settings.use(["endpoint"]);
    const [isAllowed, allow] = useCspPermission(endpoint, ["connect-src"], "TriviaAI");
    if (isAllowed) return null;

    return (
        <Notice variant="warning" action={<Button size="small" variant="secondary" onClick={allow}>Allow Host</Button>}>
            Connections to {URL.parse(endpoint)?.host} are blocked. Allow this host if you trust it, then restart Discord.
        </Notice>
    );
}

export const settings = definePluginSettings({
    apiKey: {
        type: OptionType.STRING,
        description: "API Key.",
        default: "",
        placeholder: "Enter API Key here for your AI endpoint.",
        componentProps: {
            type: "password"
        }
    },
    model: {
        type: OptionType.STRING,
        description: "AI Model to use.",
        default: "google/gemini-3-flash-preview",
        placeholder: "e.g. google/gemini-3-flash-preview, inception/mercury, openai/gpt-5.2-chat, etc."
    },
    systemPrompt: {
        type: OptionType.STRING,
        description: "System Prompt for the AI. Placeholders: {current_user}, {current_time}",
        default: "You are a helpful assistant who answers questions for the user in a concise and short way while using the least amount of words and punctuation.\nCurrent user: {current_user}\nCurrent time: {current_time}",
        placeholder: "Enter system prompt.",
        multiline: true
    },
    maxTokens: {
        type: OptionType.NUMBER,
        description: "Maximum number of tokens in the response.",
        default: 500
    },
    endpoint: {
        type: OptionType.STRING,
        description: "OpenAI Compatible AI Endpoint.",
        default: "https://openrouter.ai/api/v1/chat/completions",
        placeholder: "Enter your OpenAI compatible AI endpoint here."
    },
    endpointPermission: {
        type: OptionType.COMPONENT,
        component: () => <EndpointNotice />
    },
    context: {
        type: OptionType.NUMBER,
        description: "Number of previous messages to include as context.",
        default: 0
    },
    passMessageAuthorName: {
        type: OptionType.BOOLEAN,
        description: "Prepend the author's name to the message content when passing it to the AI. This can help the AI distinguish between different users in a conversation.",
        default: true
    },
    treatSelfAsAssistant: {
        type: OptionType.BOOLEAN,
        description: "When enabled, your own messages will be treated as assistant messages in the context. This causes some models to start generating fanfic.",
        default: false
    },
    mode: {
        type: OptionType.SELECT,
        description: "How should answers be handled?",
        options: [
            { label: "Auto Reply", value: "autoreply" },
            { label: "Replace Chatbar Text", value: "chatbar", default: true },
            { label: "Clyde", value: "bot" }
        ]
    },
    supportImages: {
        type: OptionType.BOOLEAN,
        description: "Pass images to the AI for context (if any). This is not supported by all models.",
        default: true
    },
    sendImagesAsBase64: {
        type: OptionType.BOOLEAN,
        description: "Send images to the AI as base64.",
        default: false
    }
});
