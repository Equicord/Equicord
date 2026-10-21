/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RepoGroup, RepoSortMode } from "@equicordplugins/githubRepos/types";
import { PERSONAL_GROUP_KEY, sortGroups } from "@equicordplugins/githubRepos/utils";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, React, useState } from "@webpack/common";

import { cl, settings } from "..";
import { RepoCard } from "./RepoCard";
import { RepoSubTabs } from "./RepoSubTabs";

interface ReposModalProps {
    groups: RepoGroup[];
    initialActiveKey: string;
    username: string;
    rootProps: any;
}

export function ReposModal({ groups, initialActiveKey, username, rootProps }: ReposModalProps & { rootProps: RenderModalProps; }) {
    const [activeKey, setActiveKey] = useState(initialActiveKey);
    const [sortMode, setSortMode] = useState<RepoSortMode>("count");

    const sortedGroups = sortGroups(groups, sortMode);
    const activeGroup = sortedGroups.find(g => g.key === activeKey) ?? sortedGroups[0];

    return (
        <Modal
            {...rootProps}
            className={cl("modal")}
            size="lg"
            title={`${username}'s GitHub Repositories`}
            actions={[
                {
                    text: "View on GitHub",
                    variant: "link",
                    onClick: () => window.open(`https://github.com/${username}?tab=repositories`, "_blank")
                },
                {
                    text: "Close",
                    variant: "secondary",
                    onClick: rootProps.onClose
                }
            ]}
        >
            <div className={cl("modal-content")}>
                <RepoSubTabs
                    groups={sortedGroups}
                    activeKey={activeGroup?.key ?? PERSONAL_GROUP_KEY}
                    onSelect={setActiveKey}
                    sortMode={sortMode}
                    onToggleSort={() => setSortMode(mode => mode === "count" ? "alpha" : "count")}
                    canSort={sortedGroups.length > 2}
                />
                <div className={cl("list", "modal-list")}>
                    {activeGroup?.repos.map(repo => (
                        <RepoCard
                            key={repo.id}
                            repo={repo}
                            showStars={settings.store.showStars}
                            showLanguage={settings.store.showLanguage}
                        />
                    ))}
                </div>
            </div>
        </Modal>
    );
}
