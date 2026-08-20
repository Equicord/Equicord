/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { fetchOrgRepos, fetchReposByUserId, fetchReposByUsername, fetchUserInfo, fetchUserOrgs } from "@equicordplugins/githubRepos/githubApi";
import { GitHubRepo, RepoGroup, RepoSortMode } from "@equicordplugins/githubRepos/types";
import { buildRepoGroups, PERSONAL_GROUP_KEY, sortGroups } from "@equicordplugins/githubRepos/utils";
import { React, useEffect, UserProfileStore, useState } from "@webpack/common";

import { cl, settings } from "..";
import { RepoCard } from "./RepoCard";
import { RepoSubTabs } from "./RepoSubTabs";

export function ProfileTabComponent({ id }: { id: string, theme: string; }) {
    const [groups, setGroups] = useState<RepoGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeKey, setActiveKey] = useState<string>(PERSONAL_GROUP_KEY);
    const [sortMode, setSortMode] = useState<RepoSortMode>("count");

    const sortedGroups = sortGroups(groups, sortMode);
    const activeGroup = sortedGroups.find(g => g.key === activeKey) ?? sortedGroups[0];

    useEffect(() => {
        const fetchData = async () => {
            try {
                const profile = UserProfileStore.getUserProfile(id);
                if (!profile) {
                    setLoading(false);
                    return;
                }

                const connections = profile.connectedAccounts;
                if (!connections?.length) {
                    setLoading(false);
                    return;
                }

                const githubConnection = connections.find(conn => conn.type === "github");
                if (!githubConnection) {
                    setLoading(false);
                    return;
                }

                const username = githubConnection.name;
                const userInfoData = await fetchUserInfo(username);
                const githubId = githubConnection.id;

                // Try to fetch by ID first, fall back to username
                let personalRepos: GitHubRepo[] | null = await fetchReposByUserId(githubId);
                if (!personalRepos) personalRepos = await fetchReposByUsername(username);

                const orgs = await fetchUserOrgs(username);
                const orgReposEntries = await Promise.all(orgs.map(async org => [org.login, await fetchOrgRepos(org.login)]));
                const orgRepos = Object.fromEntries(orgReposEntries);

                const builtGroups = buildRepoGroups(userInfoData?.username ?? username, personalRepos ?? [], orgs, orgRepos, userInfoData?.avatarUrl);
                setGroups(builtGroups);
                setActiveKey(builtGroups[0]?.key ?? PERSONAL_GROUP_KEY);
                setLoading(false);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Failed to fetch repositories";
                setError(errorMessage);
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    if (loading) return;
    <BaseText size="xs" weight="semibold" className={cl("loading")} >
        Loading repositories...
    </BaseText>;

    if (error) return;
    <BaseText size="xs" weight="semibold" className={cl("error")}>
        Error: {error}
    </BaseText>;

    if (!groups.length) return null;

    return (
        <div className={cl("container", "tab")}>
            <RepoSubTabs
                groups={sortedGroups}
                activeKey={activeGroup?.key ?? PERSONAL_GROUP_KEY}
                onSelect={setActiveKey}
                sortMode={sortMode}
                onToggleSort={() => setSortMode(mode => mode === "count" ? "alpha" : "count")}
                canSort={sortedGroups.length > 2}
            />
            <div className={cl("list")}>
                {activeGroup?.repos.map(repo => (
                    <RepoCard
                        key={repo.id}
                        repo={repo}
                        showStars={settings.store.showStars}
                        showLanguage={settings.store.showLanguage}
                    />))
                }
            </div>
        </div>
    );
}
