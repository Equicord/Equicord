/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { React } from "@webpack/common";
import { type ReactNode } from "react";

import Abbreviations from "./abbreviation";
import abbreviationsDefault from "./abbreviations";
import tagsDefault from "./tags";
import Tonetags from "./tonetag";

const settings = definePluginSettings({
customTonetags: {
        type: OptionType.STRING,
        description: "Custom tonetags (format: jk=Joking; srs=Serious)",
        default: "",
    },
customAbbreviations: {
    type: OptionType.STRING,
    description: "Custom abbreviations (format: jk=Joking; srs=Serious)",
    default: "",
}
});

function getCustomTonetags(): Record<string, string> {
    const raw = settings.store.customTonetags || "";
    const toneResult: Record<string, string> = {};

    raw.split("; ").forEach(entry => {
        const [key, ...rest] = entry.split("=");
        if (key && rest.length > 0) {
            toneResult[key.trim().toLowerCase()] = rest.join("=").trim();
        }
    });

    return toneResult;
}

function getCustomAbbreviations(): Record<string, string> {
    const raw = settings.store.customAbbreviations || "";
    const abbreviationResult: Record<string, string> = {};

    raw.split("; ").forEach(entry => {
        const [key, ...rest] = entry.split("=");
        if (key && rest.length > 0) {
            abbreviationResult[key.trim().toLowerCase()] = rest.join("=").trim();
        }
    });

    return abbreviationResult;
}

function getTonetags(text: string): string | null {
    text = text.toLowerCase();
    const customTonetags = getCustomTonetags();

    return (
        customTonetags[text] ||
        customTonetags[`_${text}`] ||
        tagsDefault.get(text) ||
        tagsDefault.get(`_${text}`) ||
        null
    );
}

function getAbbreviations(text: string): string | null {
    text = text.toLowerCase();
    const customAbbreviations = getCustomAbbreviations();

    return (
        customAbbreviations[text] ||
        customAbbreviations[`_${text}`] ||
        abbreviationsDefault.get(text) ||
        abbreviationsDefault.get(`_${text}`) ||
        null
    );
}

function buildTagRegex(): RegExp {
    const customTonetags = getCustomTonetags();
    const allTonetags = new Set<string>();

    tagsDefault.forEach((_, key) => {
        allTonetags.add(key.replace(/^_/, "")); // remove underscore prefix for aliases
    });
    Object.keys(customTonetags).forEach(key => {
        allTonetags.add(key.replace(/^_/, "")); // remove underscore prefix for aliases
    });

    // escape special regex characters and sort by length (longest first)
    const escaped = Array.from(allTonetags)
        .map(ind => ind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .sort((a, b) => b.length - a.length); // longest first to avoid partial matches (should fix some edge cases)

    // exclude forward slash from punctuation to prevent sed syntax conflicts (s/find/replace)
    const pattern = `(?:^|\\s)/(${escaped.join("|")})(?=\\s|$|[^\\s\\w/])`;
    return new RegExp(pattern, "giu"); // 'i' = case-insensitive, 'u' = unicode
}

function buildAbbreviationRegex(): RegExp {
    const customAbbreviations = getCustomAbbreviations();
    const allAbbreviations = new Set<string>();

    abbreviationsDefault.forEach((_, key) => {
        allAbbreviations.add(key.replace(/^_/, "")); // remove underscore prefix for aliases
    });
    Object.keys(customAbbreviations).forEach(key => {
        allAbbreviations.add(key.replace(/^_/, "")); // remove underscore prefix for aliases
    });

    // escape special regex characters and sort by length (longest first)
    const escaped = Array.from(allAbbreviations)
        .map(ind => ind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .sort((a, b) => b.length - a.length); // longest first to avoid partial matches (should fix some edge cases)

    // exclude forward slash from punctuation to prevent sed syntax conflicts (s/find/replace)
    const pattern = `(?:^|\\s)(${escaped.join("|")})(?=\\s|$|[^\\s\\w/])`;
    return new RegExp(pattern, "giu"); // 'i' = case-insensitive, 'u' = unicode
}

function splitTextWithTags(text: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    const regex = buildTagRegex();
    const prefix = "/";
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text))) {
        const tonetag = match[1];
        const desc = getTonetags(tonetag);

        const fullMatch = match[0];
        const leadingWhitespace = fullMatch.match(/^(\s*)/)?.[1] ?? "";

        const matchStart = match.index;
        const matchEnd = regex.lastIndex;

        if (matchStart > lastIndex) {
            nodes.push(text.slice(lastIndex, matchStart));
        }

        if (desc) {
            if (leadingWhitespace) nodes.push(leadingWhitespace);
            nodes.push(
                <Tonetags
                    key={`ti-${matchStart}`}
                    prefix={prefix}
                    tonetag={tonetag}
                    desc={desc}
                />,
            );
        }

        lastIndex = matchEnd;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

    return nodes;
}

function splitTextWithAbbreviations(text: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    const regex = buildAbbreviationRegex();
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text))) {
        const abbreviation = match[1];
        const desc = getAbbreviations(abbreviation);

        const fullMatch = match[0];
        const leadingWhitespace = fullMatch.match(/^(\s*)/)?.[1] ?? "";

        const matchStart = match.index;
        const matchEnd = regex.lastIndex;

        if (matchStart > lastIndex) {
            nodes.push(text.slice(lastIndex, matchStart));
        }

        if (desc) {
            if (leadingWhitespace) nodes.push(leadingWhitespace);
            nodes.push(
                <Abbreviations
                    key={`ti-${matchStart}`}
                    abbreviation={abbreviation}
                    desc={desc}
                />,
            );
        }

        lastIndex = matchEnd;
    }

    if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

    return nodes;
}

function patchChildrenTree(children: any): any {
    const transform = (node: any): any => {
        if (node == null) return node;

        if (typeof node === "string") {
            const prefix = "/";
            let escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            const isMarkdown = /[*_~`|]/.test(prefix);
            if (isMarkdown) {
                escapedPrefix = `(?:\\\\${escapedPrefix}|${escapedPrefix})`;
            }

            const hasTag = new RegExp(`${escapedPrefix}[\\p{L}_]+`, "iu").test(node);
            const hasAbbreviation = buildAbbreviationRegex().test(node);

            if (!hasTag && !hasAbbreviation) return node;

            if (hasTag) {
                const tagparts = splitTextWithTags(node);
                const result = tagparts.length === 1 ? tagparts[0] : tagparts;
                if (hasAbbreviation) {
                    const flat = (Array.isArray(result) ? result : [result]);
                    return flat.flatMap(part =>
                        typeof part === "string"
                            ? splitTextWithAbbreviations(part)
                            : part
                    );
                }
                return result;
            }

            const abbrparts = splitTextWithAbbreviations(node);
            return abbrparts.length === 1 ? abbrparts[0] : abbrparts;
        }

        if (node?.props?.children != null) {
            const c = node.props.children;
            if (Array.isArray(c)) {
                node.props.children = c.map(transform).flat();
            } else {
                node.props.children = transform(c);
            }
            return node;
        }

        return node;
    };

    if (Array.isArray(children)) return children.map(transform).flat();
    return transform(children);
}

migratePluginSettings("mouseoverExplanations", "toneIndicators");

export default definePlugin({
    name: "mouseoverExplanations",
    description: "Shows the meanings of abbreviations and tonetags upon hover",
    authors: [EquicordDevs.justjxke, EquicordDevs.creations],
    settings,

    patches: [
        {
            find: '["strong","em","u","text","inlineCode","s","spoiler"]',
            replacement: [
                {
                    match: /(?=return\{hasSpoilerEmbeds:\i,.{0,15}content:(\i))/,
                    replace: "$1=$self.patchExplanations($1);",
                },
            ],
        },
    ],

    patchExplanations(content: any): any {
        try {
            return patchChildrenTree(content);
        } catch(e) {
            console.error("[MouseoverExplanations] i think there is an error", e);
            return content;
        }
    },
});
