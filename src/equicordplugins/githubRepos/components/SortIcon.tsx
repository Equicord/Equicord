/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IconProps } from "@equicordplugins/githubRepos/types";
import { React } from "@webpack/common";

export function SortIcon({ className, width = 16, height = 16 }: IconProps) {
    return (
        <svg
            className={className}
            width={width}
            height={height}
            viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
        >
            <path
                fill="currentColor"
                d="M4.5 2a.75.75 0 0 1 .75.75v8.69l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V2.75A.75.75 0 0 1 4.5 2ZM11.5 14a.75.75 0 0 1-.75-.75v-8.69l-1.72 1.72a.75.75 0 1 1-1.06-1.06l3-3a.75.75 0 0 1 1.06 0l3 3a.75.75 0 1 1-1.06 1.06l-1.72-1.72v8.69a.75.75 0 0 1-.75.75Z"
            />
        </svg>
    );
}
