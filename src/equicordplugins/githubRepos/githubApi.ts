/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

import { GitHubOrg, GitHubRepo } from "./types";

const logger = new Logger("GitHubRepos");

export interface GitHubUserInfo {
    username: string;
    totalRepos: number;
    avatarUrl: string;
}

export async function fetchUserInfo(username: string): Promise<GitHubUserInfo | null> {
    try {
        const userInfoUrl = `https://api.github.com/users/${username}`;
        const userInfoResponse = await fetch(userInfoUrl);

        if (!userInfoResponse.ok) return null;

        const userData = await userInfoResponse.json();
        return {
            username: userData.login,
            totalRepos: userData.public_repos,
            avatarUrl: userData.avatar_url
        };
    } catch (error) {
        logger.error("Error fetching user info", error);
        return null;
    }
}

export async function fetchReposByUserId(githubId: string, perPage: number = 30): Promise<GitHubRepo[] | null> {
    try {
        const apiUrl = `https://api.github.com/user/${githubId}/repos?sort=stars&direction=desc&per_page=${perPage}`;
        const response = await fetch(apiUrl);

        if (!response.ok) return null;

        const data = await response.json();
        return sortReposByStars(data);
    } catch (error) {
        logger.error("Error fetching repos by ID", error);
        return null;
    }
}

export async function fetchReposByUsername(username: string, perPage: number = 30): Promise<GitHubRepo[]> {
    const apiUrl = `https://api.github.com/users/${username}/repos?sort=stars&direction=desc&per_page=${perPage}`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
        throw new Error(`Error fetching repos by username: ${response.status}`);
    }

    const data = await response.json();
    return sortReposByStars(data);
}

export async function fetchUserOrgs(username: string): Promise<GitHubOrg[]> {
    try {
        const apiUrl = `https://api.github.com/users/${username}/orgs`;
        const response = await fetch(apiUrl);

        if (!response.ok) return [];

        return await response.json();
    } catch (error) {
        logger.error("Error fetching user orgs", error);
        return [];
    }
}

export async function fetchOrgRepos(org: string, perPage: number = 30): Promise<GitHubRepo[]> {
    try {
        const apiUrl = `https://api.github.com/orgs/${org}/repos?sort=stars&direction=desc&per_page=${perPage}`;
        const response = await fetch(apiUrl);

        if (!response.ok) return [];

        const data = await response.json();
        return sortReposByStars(data);
    } catch (error) {
        logger.error("Error fetching org repos", error);
        return [];
    }
}

function sortReposByStars(repos: GitHubRepo[]): GitHubRepo[] {
    return repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
}
