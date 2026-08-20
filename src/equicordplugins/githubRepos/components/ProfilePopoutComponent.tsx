/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph } from "@components/Paragraph";
import { Span } from "@components/Span";
import { fetchOrgRepos, fetchReposByUserId, fetchReposByUsername, fetchUserInfo, fetchUserOrgs, GitHubUserInfo } from "@equicordplugins/githubRepos/githubApi";
import { GitHubRepo, RepoGroup } from "@equicordplugins/githubRepos/types";
import { buildRepoGroups, getLanguageIconUrl, PERSONAL_GROUP_KEY } from "@equicordplugins/githubRepos/utils";
import { classes } from "@utils/misc";
import { findCssClassesLazy } from "@webpack";
import { Clickable, openModal, React, useEffect, UserProfileStore, useState } from "@webpack/common";

import { ReposModal } from "./ReposModal";

const DMSideBarClasses = findCssClassesLazy("widgetPreviews");
const ProfileCardClasses = findCssClassesLazy("cardsList", "firstCardContainer", "card", "container");
const ProfileCardContainerClasses = findCssClassesLazy("innerContainer", "icons", "icon", "displayCount", "displayCountText", "displayCountTextColor", "breadcrumb");
const ProfileCardOverlayClasses = findCssClassesLazy("overlay", "isPrivate", "outer");

export function ProfilePopoutComponent({ id, isSideBar = false }: { id: string, isSideBar?: boolean; }) {
    const [repos, setRepos] = useState<GitHubRepo[]>([]);
    const [groups, setGroups] = useState<RepoGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userInfo, setUserInfo] = useState<GitHubUserInfo | null>(null);

    const openReposModal = () => {
        if (!userInfo) return;

        openModal(props => (
            <ReposModal
                groups={groups.length ? groups : [{ key: PERSONAL_GROUP_KEY, label: userInfo?.username ?? "Personal", avatarUrl: userInfo?.avatarUrl, repos }]}
                initialActiveKey={PERSONAL_GROUP_KEY}
                username={userInfo.username}
                rootProps={props}
            />
        ));
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const profile = UserProfileStore.getUserProfile(id);
                if (!profile) { setLoading(false); return; }

                const connections = profile.connectedAccounts;
                if (!connections?.length) { setLoading(false); return; }

                const githubConnection = connections.find(conn => conn.type === "github");
                if (!githubConnection) { setLoading(false); return; }

                const username = githubConnection.name;
                const userInfoData = await fetchUserInfo(username);
                if (userInfoData) setUserInfo(userInfoData);

                const githubId = githubConnection.id;

                let personalRepos = await fetchReposByUserId(githubId);
                if (!personalRepos) personalRepos = await fetchReposByUsername(username);

                setRepos(personalRepos);
                setLoading(false);

                const orgs = await fetchUserOrgs(username);
                const orgReposEntries = await Promise.all(orgs.map(async org => [org.login, await fetchOrgRepos(org.login)]));
                const orgRepos = Object.fromEntries(orgReposEntries);

                setGroups(buildRepoGroups(userInfoData?.username ?? username, personalRepos, orgs, orgRepos, userInfoData?.avatarUrl));
            } catch (error) {
                setError(error instanceof Error ? error.message : "Failed to fetch repositories");
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    if (loading || error || !repos.length) return null;

    const topRepos = repos.slice(0, 4);

    const reposSection = (
        <section className={ProfileCardClasses.container}>
            <ul className={ProfileCardClasses.cardsList} tabIndex={-1}>
                <li className={ProfileCardClasses.firstCardContainer}>
                    <Clickable className={ProfileCardContainerClasses.breadcrumb} onClick={openReposModal}>
                        <div className={classes(ProfileCardOverlayClasses.overlay, ProfileCardContainerClasses.innerContainer, ProfileCardClasses.card)}>
                            <Paragraph size={isSideBar ? "sm" : "xs"} weight="medium">
                                GitHub Repositories
                            </Paragraph>
                            {!!repos.length && (
                                <div className={ProfileCardContainerClasses.icons}>
                                    {topRepos.slice(0, 4).map((repo, idx) => {
                                        const showCount = idx === 3 && repos.length > 4;

                                        return (
                                            <div className={ProfileCardContainerClasses.icon} key={repo.id}>
                                                <img
                                                    src={getLanguageIconUrl(repo.language)}
                                                    alt={repo.language ?? "Unknown"}
                                                    className={showCount ? ProfileCardContainerClasses.displayCount : undefined}
                                                />
                                                {showCount && (
                                                    <div className={ProfileCardContainerClasses.displayCountText}>
                                                        <Span className={ProfileCardContainerClasses.displayCountTextColor} size={isSideBar ? "sm" : "xs"} weight="medium">
                                                            +{repos.length - 4}
                                                        </Span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </Clickable>
                </li>
            </ul>
        </section>
    );

    return isSideBar
        ? <div className={DMSideBarClasses.widgetPreviews}>{reposSection}</div>
        : reposSection;
}
