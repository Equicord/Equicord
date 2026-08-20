/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GitHubOrg, GitHubRepo, RepoGroup, RepoSortMode } from "./types";

const LANGUAGE_ICON_MAP: Record<string, string> = {
    "c++": "cplusplus",
    "c#": "csharp",
    "f#": "fsharp",
    "q#": "qsharp",
    "objective-c": "objectivec",
    "visual basic": "visualbasic",
    "shell": "bash",
    "batchfile": "bash",
    "vim script": "vim",
    "dockerfile": "docker",
    "gdscript": "godot",
    "html": "html5",
};

export function getLanguageIconUrl(language: string | null): string {
    if (!language) return "https://cdn.jsdelivr.net/gh/devicons/devicon@develop/icons/github/github-original.svg";

    const normalized = LANGUAGE_ICON_MAP[language.toLowerCase()] ?? language.toLowerCase().replace(/\s+/g, "");
    return `https://cdn.jsdelivr.net/gh/devicons/devicon@develop/icons/${normalized}/${normalized}-original.svg`;
}

export const PERSONAL_GROUP_KEY = "__personal__";

export function buildRepoGroups(username: string, personalRepos: GitHubRepo[], orgs: GitHubOrg[], orgRepos: Record<string, GitHubRepo[]>, avatarUrl?: string): RepoGroup[] {
    const groups: RepoGroup[] = [];

    if (personalRepos.length) {
        groups.push({ key: PERSONAL_GROUP_KEY, label: username, avatarUrl, repos: personalRepos });
    }

    for (const org of orgs) {
        const repos = orgRepos[org.login];
        if (repos?.length) {
            groups.push({ key: org.login, label: org.login, avatarUrl: org.avatar_url, repos });
        }
    }

    return groups;
}

export function sortGroups(groups: RepoGroup[], mode: RepoSortMode): RepoGroup[] {
    const personal = groups.find(g => g.key === PERSONAL_GROUP_KEY);
    const rest = groups.filter(g => g.key !== PERSONAL_GROUP_KEY);

    const sorted = [...rest].sort((a, b) => {
        return mode === "alpha"
            ? a.label.localeCompare(b.label)
            : b.repos.length - a.repos.length;
    });

    return personal ? [personal, ...sorted] : sorted;
}
