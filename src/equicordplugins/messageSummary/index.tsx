/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Menu } from "@webpack/common";
import { Message } from "discord-types/general";


const sumInstructions = `You are helping me by analyzing messages sent on Discord.

Instructions:
- Only give the final answer. No extra greetings, no notes, just the output.
- If the message contains code, explain exactly how the code works in clear, simple terms, including any important small details someone might miss.
- If the message contains strange, uncommon, or slang words, explain the meaning behind those words and where they are typically used.
- If there is anything you are not fully confident about, look it up externally and include an accurate, simple explanation.
- Be extremely clear and easy to understand. Assume the reader is new to the topic but intelligent and curious.
- Keep your answer short but very clear, making sure to cover the important meaning without skipping anything.
- If I provide an image URL, I want you to anaylze all of the image and give me details on everything while giving me a brief summary of everything within it. If I provide text, too I want you to send that data along with the image details.`;

const ReactIcon = () => {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            width="20"
            height="20"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M19.5 15.46a13.2 13.2 0 0 0-.72-1.62 25.3 25.3 0 0 1-2.3 2.64 21.05 21.05 0 0 1-7.24 4.9c-2.24.83-4.63.98-6.12-.5-1.48-1.49-1.33-3.88-.5-6.12.33-.89.78-1.82 1.35-2.76a16.28 16.28 0 0 1-1.35-2.76c-.83-2.24-.98-4.63.5-6.12C4.61 1.64 7 1.8 9.24 2.62c.89.33 1.82.78 2.76 1.35a13.7 13.7 0 0 1 4.62-1.86c1.58-.27 3.17-.07 4.26 1.01 1.48 1.49 1.33 3.88.5 6.12-.33.89-.78 1.82-1.35 2.76.57.94 1.02 1.87 1.35 2.76.83 2.24.98 4.63-.5 6.12-1.1 1.09-2.68 1.29-4.3 1a1.5 1.5 0 0 1-2.08-1.38 1.5 1.5 0 0 1 2.9-.52c1.01.1 1.68-.14 2.06-.52.6-.6.81-1.92.04-4ZM8.54 4.5c2 .73 4.35 2.26 6.52 4.44 1 1 1.87 2.04 2.58 3.06A22.82 22.82 0 0 1 12 17.64 22.82 22.82 0 0 1 6.36 12a22.6 22.6 0 0 1 2.27-2.76 1.5 1.5 0 1 0-1.6-1.2 25 25 0 0 0-1.8 2.12c-.3-.56-.54-1.1-.73-1.62-.77-2.08-.56-3.4.04-4 .6-.6 1.92-.81 4-.04ZM4.5 15.46c.19-.52.43-1.06.72-1.62a25.3 25.3 0 0 0 4.94 4.94c-.56.29-1.1.53-1.62.72-2.08.77-3.4.56-4-.04-.6-.6-.81-1.92-.04-4ZM16.96 4.08c-.91.16-1.98.54-3.12 1.14a25.31 25.31 0 0 1 4.94 4.94c.3-.56.53-1.1.72-1.62.77-2.08.56-3.4-.04-4-.43-.43-1.23-.68-2.5-.46Z"
            />
        </svg>
    );
};

async function summaryMessage(props) {
    const message = props;
    let image_url = null;
    let image_type = null;

    if (message.content === "" && message.attachments.length === 0 && message.embeds.length > 0) {
        const embed = message.embeds[0];
        if ((embed.rawDescription && embed.rawDescription ! === "") || embed.image?.url) {
            message.content = `${embed.rawTitle} ${embed.rawDescription}`;
            image_url = embed.image?.url || '';
        }
    }    
    if (message.attachments && message.attachments.length > 0) {
        image_url = message.attachments[0].url;
        image_type = message.attachments[0].content_type;
    }

    const origMessage = message.content;

    if (settings.store.apiKey === "") {
        message.content = "**Failed to Summarize API key not provided.**\n" + message.content;
        return;
    }

    const parts = [
        {
            text: `${sumInstructions}\n${origMessage}`
        }
    ];

    if (image_url && image_type) {
        parts.push({
            text: `${sumInstructions}\nImage URL: ${image_url}`
        });
    }
    
    message.content = message.content !== "" ? `**Summarizing...**\n\`\`\`${message.content}\`\`\`` : `**Summarizing...**`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.store.apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{ parts }]
        })
    });

    if (!response.ok) {
        console.error('Request failed:', await response.text());
        return;
    }

    const data = await response.json();
    console.log('Full Gemini Response:', data);

    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (summary) {
        message.content = `${origMessage}\n**\`\`\`${summary}\`\`\`**`;
    } else {
        console.error('No summary found in the response.');
    }
}

export const settings = definePluginSettings({
    apiKey: {
        description: "Enter your API key for Gemini",
        type: OptionType.STRING,
        default: "",
    },
    apiPrompt: { 
        description: "Enter your Description for Summarizing",
        type: OptionType.STRING,
        default:sumInstructions,
    },
});

const MenuPatch: NavContextMenuPatchCallback = (children, { message }) => {
    if (message.content === "") {return}
    children.push(
        <Menu.MenuItem
            id="summary-message"
            label="Summarize Message"
            icon={ReactIcon}
            action={() => {
                summaryMessage(message);
            }}
        />
    );
};

interface MessageCreate {
    channelId: string;
    message: Message;
}

export default definePlugin({
    name: "messageSummary",
    description: "Adds an option to context-menu to summarize message(s) using Gemini's API.",
    authors: [EquicordDevs.omaw],
    settings,
    contextMenus:
    {
        "message": MenuPatch
    }
});
