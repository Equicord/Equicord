/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getEntityTags } from "./tagData";
import { entityMatchesTagFilters, getRelevantTags, type ParsedQuery } from "./tagSearch";

const TAG_BOOST_BASE = 5000; // base boost for tag match (increased to overcome Discord's user scoring ~10000-13000)
const TAG_BOOST_EXACT = 2000; // bonus for exact tag name match
const TAG_BOOST_MULTI = 500; // bonus per additional matching tag
const TAG_BOOST_ALL_FILTERS = 3000; // bonus for matching all tag filters

/**
 * Calculate graduated boost score for entity based on tag matches
 *
 * Graduated scoring system:
 * - Base tag match: +5000 points
 * - All tag filters match: +3000 bonus
 * - Multiple tags: +500 per additional tag beyond first
 * - Exact tag name match: +2000 per exact match
 *
 * Total boost can reach 10000+ points to overcome Discord's base scoring
 * (Discord gives users ~10000-13000 base score, channels get lower scores)
 * I honestly need to find a better way to do this, but this is what I could think of lol.
 * @param entityId - The entity ID to check
 * @param searchQuery - Parsed search query with tag filters
 * @returns Graduated boost score (0 to 10000+)
 */
export function calculateTagBoost(entityId: string, searchQuery: ParsedQuery): number {
    if (!searchQuery.searchTerm && searchQuery.tagFilters.length === 0) {
        return 0;
    }

    const entityTags = getEntityTags(entityId);

    if (!entityTags.length) {
        return 0;
    }

    const relevantTags = getRelevantTags(entityTags, searchQuery);

    if (relevantTags.length === 0) {
        return 0;
    }

    let boost = TAG_BOOST_BASE;

    if (searchQuery.tagFilters.length > 0) {
        const matchedFilters = searchQuery.tagFilters.filter(filter =>
            entityTags.some(tag => tag.name.toLowerCase().includes(filter.toLowerCase()))
        );

        if (matchedFilters.length === searchQuery.tagFilters.length) {
            boost += TAG_BOOST_ALL_FILTERS;
        }
    }

    if (relevantTags.length > 1) {
        boost += (relevantTags.length - 1) * TAG_BOOST_MULTI;
    }

    const searchTermLower = searchQuery.searchTerm?.toLowerCase() || "";
    if (searchTermLower) {
        const exactMatches = entityTags.filter(tag =>
            tag.name.toLowerCase() === searchTermLower
        );
        boost += exactMatches.length * TAG_BOOST_EXACT;
    }

    return boost;
}

/**
 * Apply tag-based filtering and boosting to results
 *
 * NEW BEHAVIOR:
 * - Explicit tag search (tag:name): ONLY show entities matching ALL tag filters
 * - Hybrid search (natural text): Show entities matching by name OR by tags, boost tagged ones
 * - Boost-only mode (boostOnly=true): Don't filter, only boost tagged results
 *
 * @param results - Array of search results
 * @param searchQuery - Parsed search query
 * @param boostOnly - If true, only boost scores without filtering results
 * @returns Filtered and boosted results, sorted by score
 */
export function applyTagFiltering(results: any[], searchQuery: ParsedQuery, boostOnly: boolean = false): any[] {
    if (!searchQuery.searchTerm && searchQuery.tagFilters.length === 0) {
        return results;
    }

    const resultsWithTags = results.map(result => {
        const entityId = result.channelId || result.record.id;
        const entityName = (result.comparator || result.record.name || result.record.username || "").toLowerCase();
        const entityTags = getEntityTags(entityId);
        const matchesTagFilters = entityMatchesTagFilters(entityTags, searchQuery.tagFilters);

        const matchesByName = searchQuery.searchTerm ? entityName.includes(searchQuery.searchTerm) : true;

        const matchesByTags = matchesTagFilters;

        const tagBoost = calculateTagBoost(entityId, searchQuery);

        return {
            result,
            entityTags,
            matchesByName,
            matchesByTags,
            tagBoost,
            finalScore: result.score + tagBoost
        };
    });

    if (boostOnly) {
        resultsWithTags.sort((a, b) => {
            if (a.finalScore !== b.finalScore) {
                return b.finalScore - a.finalScore;
            }
            return (a.result.comparator || a.result.record.name || a.result.record.username || "")
                .localeCompare(b.result.comparator || b.result.record.name || b.result.record.username || "");
        });

        return resultsWithTags.map(r => ({
            ...r.result,
            score: r.finalScore
        }));
    }

    if (searchQuery.isExplicitTagSearch) {
        const filtered = resultsWithTags.filter(r => r.matchesByTags);

        filtered.sort((a, b) => {
            if (a.finalScore !== b.finalScore) {
                return b.finalScore - a.finalScore;
            }
            return (a.result.comparator || a.result.record.name || a.result.record.username || "")
                .localeCompare(b.result.comparator || b.result.record.name || b.result.record.username || "");
        });

        return filtered.map(r => ({
            ...r.result,
            score: r.finalScore
        }));
    }

    const filtered = resultsWithTags.filter(r => r.matchesByName || r.matchesByTags);

    filtered.sort((a, b) => {
        if (a.finalScore !== b.finalScore) {
            return b.finalScore - a.finalScore;
        }
        return (a.result.comparator || a.result.record.name || a.result.record.username || "")
            .localeCompare(b.result.comparator || b.result.record.name || b.result.record.username || "");
    });

    return filtered.map(r => ({
        ...r.result,
        score: r.finalScore
    }));
}
