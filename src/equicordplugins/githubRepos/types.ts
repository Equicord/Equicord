/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface GitHubRepo {
    id: number;
    name: string;
    html_url: string;
    description: string;
    stargazers_count: number;
    language: string;
    fork: boolean;
    owner: {
        login: string;
        type: string;
    };
}

export interface GitHubOrg {
    login: string;
    avatar_url: string;
}

export interface RepoGroup {
    key: string;
    label: string;
    avatarUrl?: string;
    repos: GitHubRepo[];
}

export type RepoSortMode = "count" | "alpha";

export interface IconProps {
    className?: string;
    width?: number;
    height?: number;
}

export interface RepoCardProps {
    repo: GitHubRepo;
    showStars: boolean;
    showLanguage: boolean;
}
