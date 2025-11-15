/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type Tag } from "./tagData";

const TAG_NAME_MAX_LENGTH = 20;

export interface ParsedQuery {
    rawQuery: string; // original query
    searchTerm: string; // text to search (with tag: removed)
    tagFilters: string[]; // tag names to filter by
    isExplicitTagSearch: boolean; // true if using "tag:name" syntax
}

/**
 * parse search query to extract tag filters
 * Examples:
 * - "tag:work discord" → { searchTerm: "discord", tagFilters: ["work"], isExplicit: true }
 * - "tag:work tag:dev" → { searchTerm: "", tagFilters: ["work", "dev"], isExplicit: true }
 * - "work" → { searchTerm: "work", tagFilters: ["work"], isExplicit: false }
 */
export function parseSearchQuery(query: string): ParsedQuery {
    const tagRegex = /tag:(\w+)/gi;
    const explicitTagFilters: string[] = [];
    let match;

    while ((match = tagRegex.exec(query)) !== null) {
        const tagName = match[1].toLowerCase();

        if (tagName.length >= 1 && tagName.length <= TAG_NAME_MAX_LENGTH) {
            explicitTagFilters.push(tagName);
        }
    }

    const searchTerm = query.replace(tagRegex, "").trim().toLowerCase();

    const isExplicitTagSearch = explicitTagFilters.length > 0;

    const tagFilters = [...explicitTagFilters];

    if (!isExplicitTagSearch && searchTerm) {
        const cleanSearchTerm = searchTerm.replace(/^[#@]\s*/, "").trim();

        if (cleanSearchTerm && cleanSearchTerm.length <= TAG_NAME_MAX_LENGTH) {
            tagFilters.push(cleanSearchTerm);
        }
    }

    return {
        rawQuery: query,
        searchTerm,
        tagFilters,
        isExplicitTagSearch
    };
}

export function entityMatchesTagFilters(
    entityTags: Tag[],
    tagFilters: string[]
): boolean {
    if (tagFilters.length === 0) return true;

    const entityTagNames = entityTags.map(t => t.name.toLowerCase());

    return tagFilters.every(filter =>
        entityTagNames.some(tagName => tagName.includes(filter))
    );
}

/**
 * Get relevant tags to display (smart filtering)
 *
 * Only show tags that match the search query
 * Example: Channel has ["Dev", "Work", "Discord"]
 *   Search: "tag:dev discord" -> Show: ["Dev", "Discord"]
 *   Search: "general" → Show: [] (no tag match)
 */
export function getRelevantTags(
    allTags: Tag[],
    searchQuery: ParsedQuery
): Tag[] {
    if (!searchQuery.searchTerm && searchQuery.tagFilters.length === 0) {
        return [];
    }

    const matchTerms = [
        ...searchQuery.tagFilters,
        ...(searchQuery.searchTerm ? [searchQuery.searchTerm] : [])
    ].map(t => t.toLowerCase());

    return allTags.filter(tag =>
        matchTerms.some(term => tag.name.toLowerCase().includes(term))
    );
}
