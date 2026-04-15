/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const Icon = ({ enabled = true }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="currentColor"
            viewBox="0 0 16 16"
        >
            <path
                d="M 8 16 a 2 2 0 0 0 2 -2 l -4 0 a 2 2 0 0 0 2 2 m 0 -14.1 l -0.8 0.2 a 4 4 0 0 0 -3.2 3.9 c 0 0.6 -0.1 2.2 -0.5 3.7 c -0.2 0.8 -0.4 1.6 -0.7 2.3 l 10.2 0 c -0.3 -0.7 -0.5 -1.5 -0.7 -2.3 c -0.3 -1.5 -0.5 -3.1 -0.5 -3.7 a 4 4 0 0 0 -3.2 -3.9 l -0.8 -0.2 z m 6.2 10.1 c 0.2 0.5 0.5 0.8 0.8 1 l -14 0 c 0.3 -0.2 0.6 -0.6 0.8 -1 c 0.9 -1.8 1.2 -5.1 1.2 -6 c 0 -2.4 1.7 -4.4 4 -4.9 a 1 1 0 1 1 2 0 a 5 5 0 0 1 4 4.9 c 0 0.9 0.3 4.2 1.2 6"
                fill={!enabled ? "var(--status-danger)" : "var(--icon-secondary)"}
            />
            <g transform="translate(4.7,3.3) scale(1,1) translate(-4.7,-3.3) translate(4.7,11.4) matrix(0.5,0,0,0.5,-0.8,-8)">
                <path
                    d="M 13 8 c 0 0.6 -0.1 1.1 -0.3 1.6 l -0.8 -0.8 a 4 4 0 0 0 0.1 -0.8 l 0 -1 a 0.5 0.5 0 0 1 1 0 l 0 1 z m -5 4 c 0.8 0 1.6 -0.2 2.2 -0.7 l 0.7 0.7 a 5 5 0 0 1 -2.4 0.9 l 0 2 l 3 0 a 0.5 0.5 0 0 1 0 1 l -7 0 a 0.5 0.5 0 0 1 0 -1 l 3 0 l 0 -2 a 5 5 0 0 1 -4.5 -5 l 0 -1 a 0.5 0.5 0 0 1 1 0 l 0 1 a 4 4 0 0 0 4 4 m 3 -9 l 0 4.9 l -5.8 -5.8 a 3 3 0 0 1 5.8 1"
                    fill="var(--icon-secondary)"
                />
                <path
                    d="M 9.5 10.6 l -4.5 -4.5 l 0 1.9 a 3 3 0 0 0 4.5 2.6 m -7.8 -9.3 l 12 12 l 0.7 -0.7 l -12 -12 l -0.7 0.7 z"
                    fill="var(--icon-secondary)"
                />
            </g>
        </svg>);
};
