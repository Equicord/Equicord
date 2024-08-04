/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MessageObject } from "@api/MessageEvents";
import { Message } from "discord-types/general";

export async function transferMessage(message: MessageObject, model: string, repliedMessage?: Message) {
    // you can use this on anything really
    // NOTE: you need to have ollama running with cors set to *, to do this set OLLAMA_ORIGINS to *, in your envioument variables.
    const req = await fetch("http://127.0.0.1:11434/api/chat", {
        method: "POST",
        body: JSON.stringify({
            model: model,
            messages: [
                {
                    "role": "system",
                    "content": `Transform any user message into brainrot style, except do not change any URLs or text matching the regex <(?:@[!&]?|#)\\d+>. Only repeat the user's message in brainrot voice without acknowledging or responding to anything else. for context this is your message object *START* ${JSON.stringify(message)} *END* and this is the replied message object (if avalaible): *START* ${JSON.stringify(repliedMessage)} *END*, remember to use context in the response`
                },
                {
                    "role": "user",
                    "content": "*something strange*"
                },
                {
                    "role": "assistant",
                    "content": "Only in ohio would you find *something strange*"
                },
                {
                    "role": "user",
                    "content": "What's your favorite food?"
                },
                {
                    "role": "assistant",
                    "content": "What's your fav snack from Ohio, bro?"
                },
                {
                    "role": "user",
                    "content": "I love going to the beach."
                },
                {
                    "role": "assistant",
                    "content": "I love rizzing up at the beach, bro."
                },
                {
                    "role": "user",
                    "content": "Do you play any sports?"
                },
                {
                    "role": "assistant",
                    "content": "Do you rizz up any sports, bro?"
                },
                {
                    "role": "user",
                    "content": "What's your favorite movie?"
                },
                {
                    "role": "assistant",
                    "content": "What's your fav drake video, bro?"
                },
                {
                    "role": "user",
                    "content": "Can you help me with my homework?"
                },
                {
                    "role": "assistant",
                    "content": "Can you rizz up my homework, bro?"
                },
                {
                    "role": "user",
                    "content": "I think I lost my phone."
                },
                {
                    "role": "assistant",
                    "content": "I think I fanum taxed my phone, bro."
                },
                {
                    "role": "user",
                    "content": "Do you like to travel?"
                },
                {
                    "role": "assistant",
                    "content": "Do you mew to travel, bro?"
                },
                {
                    "role": "user",
                    "content": "I have a test tomorrow."
                },
                {
                    "role": "assistant",
                    "content": "I have a sigma test tomorrow, bro."
                },
                {
                    "role": "user",
                    "content": "My favorite color is blue."
                },
                {
                    "role": "assistant",
                    "content": "My fav color is skibidi blue, bro."
                },
                {
                    "role": "user",
                    "content": "I want to learn a new language."
                },
                {
                    "role": "assistant",
                    "content": "I want to mew a new language, bro."
                },
                {
                    "role": "user",
                    "content": "Do you like ice cream?"
                },
                {
                    "role": "assistant",
                    "content": "Do you rizz up ice cream, bro?"
                },
                {
                    "role": "user",
                    "content": "I think it's going to rain."
                },
                {
                    "role": "assistant",
                    "content": "I think it's gonna mew, bro."
                },
                {
                    "role": "user",
                    "content": "Check out this link: https://example.com"
                },
                {
                    "role": "assistant",
                    "content": "Check out this link, bro. its so skibidi ohio sigma: https://example.com"
                },
                {
                    content: message.content,
                    role: "user"
                }
            ],
            stream: false
        }),
        headers: {
            "Content-Type": "application/json"
        }
    });
    const res = await req.json();
    const msg = res.message.content;
    return msg;
}
