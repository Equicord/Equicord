/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { sendMessage } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { Message } from "@vencord/discord-types";
import { ComponentDispatch } from "@webpack/common/utils";

import { settings } from "./settings";

const logger = new Logger("TriviaAI");

type TextPart = {
    type: "text";
    text: string;
};

type ImagePart = {
    type: "image_url";
    image_url: {
        url: string;
        detail?: "auto" | "high" | "low";
    };
};

export type ContentPayload = string | (TextPart | ImagePart)[];

// stolen from plugins/messageClickActions
export function insertTextIntoChatInputBox(text: string) {
    ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", {
        rawText: text,
        plainText: text
    });
}

export function parseMessageContent(message: Message): ContentPayload | null {
    const textParts: string[] = [];

    if (message.content && message.content.trim().length > 0) {
        textParts.push(message.content);
    }

    message.embeds.forEach(embed => {
        const embedBuffer: string[] = [];

        if (embed.provider?.name) {
            embedBuffer.push(`> ${embed.provider.name}`);
        }

        if (embed.author?.name) {
            embedBuffer.push(`**${embed.author.name}**`);
        }

        if (embed.rawTitle) {
            embedBuffer.push(`## ${embed.rawTitle}`);
        }

        if (embed.rawDescription) {
            embedBuffer.push(embed.rawDescription);
        }

        if (embed.fields && Array.isArray(embed.fields)) {
            embed.fields.forEach(field => {
                if (field.rawName && field.rawValue) {
                    embedBuffer.push(`**${field.rawName}**: ${field.rawValue}`);
                }
            });
        }

        if (embed.footer?.text) {
            embedBuffer.push(`_${embed.footer.text}_`);
        }

        if (embedBuffer.length > 0) {
            textParts.push(embedBuffer.join("\n"));
        }
    });

    const combinedText = textParts.join("\n\n");

    if (!settings.store.supportImages) {
        return combinedText || null;
    }

    const imageUrls = new Set<string>();

    message.attachments
        .filter(att => att.content_type?.startsWith("image/"))
        .forEach(att => imageUrls.add(att.url));

    message.embeds.forEach(embed => {
        if (embed.image?.url) {
            imageUrls.add(embed.image.url);
        }

        if (embed.thumbnail?.url) {
            imageUrls.add(embed.thumbnail.url);
        }

        if (embed.images && Array.isArray(embed.images)) {
            embed.images.forEach(img => {
                if (img.url) imageUrls.add(img.url);
            });
        }
    });

    if (imageUrls.size === 0) {
        return combinedText || null;
    }

    const payload: (TextPart | ImagePart)[] = [];

    if (combinedText.length > 0) {
        payload.push({
            type: "text",
            text: combinedText
        });
    }

    imageUrls.forEach(url => {
        payload.push({
            type: "image_url",
            image_url: { url }
        });
    });

    return payload;
}

export async function handleResponse(message: Message, response: string): Promise<string> {
    if (settings.store.autoRespond) {
        sendMessage(
            message.channel_id,
            { content: response },
            true,
            { messageReference: { channel_id: message.channel_id, message_id: message.id } }
        );
        return response;
    } else {
        insertTextIntoChatInputBox(response);
        return response;
    }
}

export async function getResponse(payload: ContentPayload): Promise<string> {
    if (settings.store.decancer) {
        // @ts-ignore
        const initDecancer = (await import("https://cdn.jsdelivr.net/gh/null8626/decancer@v3.3.3/bindings/wasm/bin/decancer.min.js")).default;
        const decancer = await initDecancer();
        if (typeof payload === "string") {
            payload = decancer(payload).toString();
        } else {
            payload = payload.map(part =>
                part.type === "text"
                    ? { ...part, text: decancer(part.text).toString() }
                    : part
            );
        }
    }

    const req = await fetch(settings.store.endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings.store.apiKey}`
        },
        body: JSON.stringify({
            model: settings.store.model,
            messages: [
                {
                    role: "system",
                    content: settings.store.systemPrompt
                },
                {
                    role: "user",
                    content: payload
                }
            ],
            max_tokens: settings.store.maxTokens,
        })
    });

    const data = await req.json();

    if (data.error) {
        logger.error(`API Error: ${data.error.message || "An unknown error occurred"}`);
    }

    const response = data.choices[0].message.content;

    if (!response || response.trim().length === 0) {
        logger.warn("no response from AI model");
    }

    return response;
}

export function cl(className: string) {
    return `vc-trivia-ai-${className}`;
}
