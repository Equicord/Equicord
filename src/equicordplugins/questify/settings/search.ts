/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { React } from "@webpack/common";
import type { ReactElement, ReactNode } from "react";

export enum SettingsSearchPriority {
    Title,
    Description,
    Subheading,
    Label,
    Text,
    Tooltip,
    Option,
    OptionDescription,
}

export interface SettingsSearchTerm {
    text: string;
    priority: SettingsSearchPriority;
}

interface SearchableProps {
    children?: ReactNode;
    label?: ReactNode;
    text?: ReactNode;
    description?: ReactNode;
    tooltip?: { text?: ReactNode; };
    options?: readonly { label?: ReactNode; description?: ReactNode; }[];
}

let searchQuery = "";
const listeners = new Set<() => void>();
const registeredTerms = new Map<string, readonly SettingsSearchTerm[]>();
const emptyComponentPriorities: ReadonlyMap<ReactElement["type"], SettingsSearchPriority> = new Map();

function notifyListeners(): void {
    listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

function getSearchQuery(): string {
    return searchQuery;
}

export function setSettingsSearchQuery(query: string): void {
    if (query === searchQuery) return;

    searchQuery = query;
    notifyListeners();
}

export function useSettingsSearchQuery(): string {
    return React.useSyncExternalStore(subscribe, getSearchQuery);
}

export function collectSettingsSearchTerms(
    node: ReactNode,
    componentPriorities: ReadonlyMap<ReactElement["type"], SettingsSearchPriority> = emptyComponentPriorities,
    priority: SettingsSearchPriority = SettingsSearchPriority.Text,
): SettingsSearchTerm[] {
    if (typeof node === "string" || typeof node === "number") {
        return [{ text: String(node), priority }];
    }

    if (Array.isArray(node)) {
        return node.flatMap(child => collectSettingsSearchTerms(child, componentPriorities, priority));
    }

    if (!React.isValidElement<SearchableProps>(node)) {
        return [];
    }

    const { children, label, text, description, tooltip, options } = node.props;
    const childPriority = componentPriorities.get(node.type) ?? priority;

    return [
        ...collectSettingsSearchTerms(children, componentPriorities, childPriority),
        ...collectSettingsSearchTerms(label, componentPriorities, SettingsSearchPriority.Label),
        ...collectSettingsSearchTerms(text, componentPriorities, SettingsSearchPriority.Label),
        ...collectSettingsSearchTerms(description, componentPriorities, SettingsSearchPriority.Text),
        ...collectSettingsSearchTerms(tooltip?.text, componentPriorities, SettingsSearchPriority.Tooltip),
        ...(options ?? []).flatMap(option => [
            ...collectSettingsSearchTerms(option.label, componentPriorities, SettingsSearchPriority.Option),
            ...collectSettingsSearchTerms(option.description, componentPriorities, SettingsSearchPriority.OptionDescription),
        ]),
    ];
}

function normalizeSearchText(text: string): string {
    return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "");
}

function isOneEditAway(query: string, word: string): boolean {
    if (Math.abs(query.length - word.length) > 1) return false;

    let queryIndex = 0;
    let wordIndex = 0;
    let edits = 0;

    while (queryIndex < query.length && wordIndex < word.length) {
        if (query[queryIndex] === word[wordIndex]) {
            queryIndex++;
            wordIndex++;
            continue;
        }

        if (edits++ > 0) return false;

        if (query.length === word.length) {
            const transposed = query[queryIndex] === word[wordIndex + 1] && query[queryIndex + 1] === word[wordIndex];
            queryIndex += transposed ? 2 : 1;
            wordIndex += transposed ? 2 : 1;
        } else if (query.length < word.length) {
            wordIndex++;
        } else {
            queryIndex++;
        }
    }

    return edits + query.length - queryIndex + word.length - wordIndex <= 1;
}

function getWordMatchQuality(queryWord: string, text: string): number | null {
    if (text.includes(queryWord)) return 0;
    if (queryWord.length < 5) return null;

    return text.split(/\s+/).some(word => isOneEditAway(queryWord, word)) ? 1 : null;
}

export function getSettingsSearchMatchScore(query: string, terms: readonly SettingsSearchTerm[]): number | null {
    const queryWords = normalizeSearchText(query).split(/\s+/).filter(Boolean);

    if (queryWords.length === 0) return 0;

    const normalizedTerms = terms.map(term => ({ ...term, text: normalizeSearchText(term.text) }));
    let bestScore: number | null = null;

    for (const term of normalizedTerms) {
        const qualities = queryWords.map(word => getWordMatchQuality(word, term.text));

        if (qualities.some(quality => quality === null)) continue;

        const penalty = Math.min(3, qualities.reduce<number>((total, quality) => total + (quality ?? 0), 0));
        const score = term.priority * 4 + penalty;

        bestScore = bestScore === null ? score : Math.min(bestScore, score);
    }

    if (bestScore !== null) return bestScore;

    return queryWords.every(word => normalizedTerms.some(term => getWordMatchQuality(word, term.text) !== null))
        ? (SettingsSearchPriority.OptionDescription + 1) * 4
        : null;
}

export function matchesSettingsSearch(query: string, terms: readonly SettingsSearchTerm[]): boolean {
    return getSettingsSearchMatchScore(query, terms) !== null;
}

export function registerSettingsSearchTerms(id: string, terms: readonly SettingsSearchTerm[]): () => void {
    registeredTerms.set(id, terms);
    notifyListeners();

    return () => {
        registeredTerms.delete(id);
        notifyListeners();
    };
}

function getMatchingCardCount(): number {
    return Array.from(registeredTerms.values()).filter(terms => matchesSettingsSearch(searchQuery, terms)).length;
}

export function useSettingsSearchMatchCount(): number {
    return React.useSyncExternalStore(subscribe, getMatchingCardCount);
}
