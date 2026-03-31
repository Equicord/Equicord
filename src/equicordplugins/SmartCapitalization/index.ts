/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

import extensions from "./extensions.json";

const settings = definePluginSettings({
    delimiters: {
        type: OptionType.STRING,
        default: "?!.",
        description: "Delimiters after which the next letter is capitalized.",
        restartNeeded: false
    },
    eachLine: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Capitalize the first letter of each new line.",
        restartNeeded: false
    },
    firstLetter: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Capitalize the first letter of the message.",
        restartNeeded: false
    },
    dotAtEnd: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Add a period at the end of the message.",
        restartNeeded: false
    },
    dotAtEachLine: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Add a period at the end of each line.",
        restartNeeded: false
    },
    excludeEndSymbols: {
        type: OptionType.STRING,
        default: "!?.,:()",
        description: "Symbols after which a period should not be added at the end.",
        restartNeeded: false
    },
    excludeCommandPrefixes: {
        type: OptionType.STRING,
        default: "!?.",
        description: "Prefixes that prevent capitalization if used at the start of a message.",
        restartNeeded: false
    }
});

function capitalizeFirstLetterOfString(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function addDotIfMissing(str: string): string {
    const endChar = str.trimEnd().slice(-1);
    const excludedSymbols = settings.store.excludeEndSymbols.split("");
    return !excludedSymbols.includes(endChar) ? str.trimEnd() + "." : str;
}

function isExtension(word: string) {
    console.log(extensions);
    return extensions.includes(word);
}

function extractExceptions(content: string): { content: string, exceptions: { [key: string]: string; }; } {
    const patterns: { regex: RegExp, placeholder: string; }[] = [
        { regex: /`([^`]+)`/g, placeholder: "INLINE_CODE" },
        { regex: /```([^`]+)```/g, placeholder: "BLOCK_CODE" },
        { regex: /(https?:\/\/[^\s]+)/g, placeholder: "URL" }
    ];

    const exceptions: { [key: string]: string; } = {};

    patterns.forEach(({ regex, placeholder }) => {
        content = content.replace(regex, match => {
            const index = Object.keys(exceptions).length;
            exceptions[`${placeholder}${index}`] = match;
            return `__${placeholder}${index}__`;
        });
    });

    content = content.replace(/(?:[\w~@#$%^&\-+=_(){}[\]"`.|\\s]+)\.(\w+)/g, (match: string, extension: string) => {
        if (!isExtension(extension)) return match;

        const index = Object.keys(exceptions).length;
        exceptions[`FILE${index}`] = match;
        return `__FILE${index}__`;
    });

    return { content, exceptions };
}

function restoreExceptions(content: string, exceptions: { [key: string]: string; }): string {
    Object.entries(exceptions).forEach(([key, value]) => {
        content = content.replace(`__${key}__`, value);
    });
    return content;
}

function capitalizeLines(content: string): string {
    return content
        .split("\n")
        .map((line, i) => i === 0 ? line : capitalizeFirstLetterOfString(line))
        .join("\n");
}

function addDotsToLines(content: string): string {
    return content
        .split("\n")
        .map((line, i, arr) => i === arr.length - 1 ? line : addDotIfMissing(line))
        .join("\n");
}

function applyDelimiters(content: string): string {
    const regexp = new RegExp(`(?<!^[${settings.store.excludeCommandPrefixes}])(?!^[${settings.store.excludeCommandPrefixes}])[${settings.store.delimiters}]\\s*`, "g");
    content.replaceAll(regexp, (substring: string, index: number) => {
        const letterToCapitalizeIndex = index + substring.length;
        content = content.slice(0, letterToCapitalizeIndex) + content.charAt(letterToCapitalizeIndex).toUpperCase() + content.slice(letterToCapitalizeIndex + 1);
        return substring;
    });
    return content;
}

function processContent(content: string): string {
    if (settings.store.firstLetter) content = capitalizeFirstLetterOfString(content);
    if (settings.store.dotAtEnd) content = addDotIfMissing(content);
    if (settings.store.eachLine) content = capitalizeLines(content);
    if (settings.store.dotAtEachLine) content = addDotsToLines(content);
    return applyDelimiters(content);
}

function applyRules(content: string): string {
    if (content.length === 0) return content;

    const { content: processedContent, exceptions } = extractExceptions(content);
    content = processContent(processedContent);
    return restoreExceptions(content, exceptions);
}

export default definePlugin({
    name: "SmartCapitalization",
    description: "SmartCapitalization is a customizable Vencord plugin that writes with a capital letter at the beginning of each sentence, automatically adds periods at the end of messages and lines, with user-defined exclusions.",
    authors: [Devs.rz30],
    dependencies: ["MessageEventsAPI"],

    settings,

    async start() {
        this.preSend = addMessagePreSendListener((_, msg) => {
            msg.content = applyRules(msg.content);
        });
    },

    stop() {
        removeMessagePreSendListener(this.preSend);
    }
});
