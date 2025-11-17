/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";

import { colorToRgb, type Tag, truncateTagName } from "../utils/tagData";

const cl = classNameFactory("vc-better-quick-switcher-");

interface TagPillProps {
    tag: Tag;
    maxLength?: number;
}

function TagPillComponent({ tag, maxLength = 15 }: TagPillProps) {
    const displayName = truncateTagName(tag.name, maxLength);
    const backgroundColor = colorToRgb(tag.color);

    const r = (tag.color >> 16) & 0xFF;
    const g = (tag.color >> 8) & 0xFF;
    const b = tag.color & 0xFF;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 155 ? "#000000" : "#ffffff";

    return (
        <span
            className={cl("tag-pill")}
            style={{
                backgroundColor,
                color: textColor
            }}
            title={tag.name} // show full name on hover if truncated
        >
            {displayName}
        </span>
    );
}

export default function TagPill(props: TagPillProps) {
    return (
        <ErrorBoundary noop>
            <TagPillComponent {...props} />
        </ErrorBoundary>
    );
}

interface TagPillListProps {
    tags: Tag[];
    maxLength?: number;
}

/**
 * renders multiple tag pills in a row
 * used for displaying relevant tags in Quick Switcher results
 */
export function TagPillList({ tags, maxLength = 15 }: TagPillListProps) {
    if (tags.length === 0) return null;

    return (
        <ErrorBoundary noop>
            <span className={cl("tag-pill-list")}>
                {tags.map(tag => (
                    <TagPillComponent key={tag.id} tag={tag} maxLength={maxLength} />
                ))}
            </span>
        </ErrorBoundary>
    );
}
