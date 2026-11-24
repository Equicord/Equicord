/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Quest } from "@vencord/discord-types";
import { QuestRewardType, QuestTaskType } from "@vencord/discord-types/enums";

export type QuestIncludedTypes = Record<QuestTaskType | QuestRewardType, boolean>;

export function getNewQuests(currentQuests: Quest[], nextQuests: Quest[]): Quest[] {
    const currentQuestIds = new Set(currentQuests.map(quest => quest.id));

    return nextQuests.filter(quest => !currentQuestIds.has(quest.id));
}

// These appear on nearly every Quest, so blocking them would hide everything.
const RESERVED_BLOCKED_WORDS = ["orb", "orbs"];

function isAllowedInputChar(char: string): boolean {
    const lower = char.toLowerCase();
    return (lower >= "a" && lower <= "z") || char === " " || char === "\t" || char === "*";
}

// Letters and digits in any language, so "Pokémon" stays one word.
function isWordChar(char: string): boolean {
    return /[\p{L}\p{M}\p{N}]/u.test(char);
}

/** Lowercases text and splits it into words. Spaces and punctuation separate words. */
function splitWords(text: string, isPartOfWord = isWordChar): string[] {
    const words: string[] = [];
    let current = "";

    for (const char of text.toLowerCase()) {
        if (isPartOfWord(char)) {
            current += char;
        } else if (current) {
            words.push(current);
            current = "";
        }
    }

    if (current) {
        words.push(current);
    }

    return words;
}

/** Whether a word matches a pattern, where * stands for any number of characters. */
function wordMatches(pattern: string, word: string): boolean {
    const pieces = pattern.split("*");

    if (pieces.length === 1) {
        return pattern === word;
    }

    const first = pieces[0];
    const last = pieces[pieces.length - 1];

    if (word.length < first.length + last.length || !word.startsWith(first) || !word.endsWith(last)) {
        return false;
    }

    let position = first.length;
    const end = word.length - last.length;

    for (const piece of pieces.slice(1, -1)) {
        const found = word.indexOf(piece, position);

        if (found === -1 || found + piece.length > end) {
            return false;
        }

        position = found + piece.length;
    }

    return true;
}

/** Whether the phrase's words appear one after another somewhere in the words. */
function phraseMatches(phrase: string[], words: string[]): boolean {
    for (let start = 0; start + phrase.length <= words.length; start++) {
        if (phrase.every((pattern, i) => wordMatches(pattern, words[start + i]))) {
            return true;
        }
    }

    return false;
}

function getDisallowedChars(line: string): string[] {
    return [...new Set([...line].filter(char => !isAllowedInputChar(char)))];
}

/** Splits one setting line into pattern words, or returns null if the line is empty or invalid. */
function parseBlockedLine(line: string): string[] | null {
    if (getDisallowedChars(line).length > 0) {
        return null;
    }

    const phrase = splitWords(line, char => char !== " " && char !== "\t");
    const hasLetters = phrase.some(word => word.replaceAll("*", "") !== "");

    return hasLetters ? phrase : null;
}

function isReserved(phrase: string[]): boolean {
    return phrase.length === 1 && RESERVED_BLOCKED_WORDS.some(word => wordMatches(phrase[0], word));
}

let cachedBlockedWords: string | null = null;
let cachedBlockedPhrases: string[][] = [];

function getBlockedPhrases(blockedWords: string): string[][] {
    if (blockedWords !== cachedBlockedWords) {
        cachedBlockedWords = blockedWords;
        cachedBlockedPhrases = blockedWords
            .split(/\r?\n/)
            .map(parseBlockedLine)
            .filter((phrase): phrase is string[] => phrase !== null && !isReserved(phrase));
    }

    return cachedBlockedPhrases;
}

export function validateBlockedQuestWords(blockedWords: string): true | string {
    const lines = blockedWords.split(/\r?\n/);
    const disallowed = [...new Set(lines.flatMap(getDisallowedChars))];

    if (disallowed.length > 0) {
        const shown = disallowed.slice(0, 10).map(char => JSON.stringify(char)).join(" ");
        const more = disallowed.length > 10 ? ` and ${disallowed.length - 10} more` : "";
        return `Only A-Z letters, spaces and * are allowed. Remove: ${shown}${more}`;
    }

    const reserved = lines
        .filter(line => {
            const phrase = parseBlockedLine(line);
            return phrase !== null && isReserved(phrase);
        })
        .map(line => `"${line.trim()}"`);

    return reserved.length === 0
        ? true
        : `Not allowed: ${reserved.join(", ")}. Blocking ${RESERVED_BLOCKED_WORDS.join(", ")} would hide nearly every Quest.`;
}

export function excludeBlockedQuests(quests: Quest[], blockedWords: string): Quest[] {
    const phrases = getBlockedPhrases(blockedWords);

    if (phrases.length === 0) {
        return quests;
    }

    return quests.filter(quest => {
        // Each field is checked on its own so a phrase can't span two fields.
        const fields = getQuestDisplayFields(quest).map(text => splitWords(text));

        return !phrases.some(phrase => fields.some(words => phraseMatches(phrase, words)));
    });
}

/** The text shown on the Quest tile. */
function getQuestDisplayFields(quest: Quest): string[] {
    const { messages, rewardsConfig } = quest.config;
    const fields = [
        messages?.questName,
        messages?.gameTitle,
        messages?.gamePublisher,
        ...(rewardsConfig?.rewards ?? []).map(reward => reward.messages?.name),
    ];

    return fields.filter((text): text is string => !!text);
}

export function questMatchesIncludedTypes(quest: Quest, includedTypes: QuestIncludedTypes): boolean {
    const rewardTypeAllowed = quest.config.rewardsConfig.rewards.some(reward => Boolean(includedTypes[reward.type]));
    const taskTypeAllowed = Object.values(quest.config.taskConfigV2.tasks).some(task => Boolean(includedTypes[task.type]));

    return rewardTypeAllowed && taskTypeAllowed;
}

export function normalizeQuestName(quest: Quest): string {
    const normalized = quest.config.messages.questName.trim().toUpperCase();
    return normalized.endsWith("QUEST") ? normalized.slice(0, -5).trim() : normalized;
}
