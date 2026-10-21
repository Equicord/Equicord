/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RepoGroup, RepoSortMode } from "@equicordplugins/githubRepos/types";
import { classes } from "@utils/misc";
import { React } from "@webpack/common";

import { cl } from "..";
import { SortIcon } from "./SortIcon";

interface RepoSubTabsProps {
    groups: RepoGroup[];
    activeKey: string;
    onSelect: (key: string) => void;
    sortMode: RepoSortMode;
    onToggleSort: () => void;
    canSort: boolean;
}

export function RepoSubTabs({ groups, activeKey, onSelect, sortMode, onToggleSort, canSort }: RepoSubTabsProps) {
    if (groups.length <= 1 && !canSort) return null;

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.deltaY === 0) return;
        e.currentTarget.scrollLeft += e.deltaY;
    };

    return (
        <div className={cl("subtabs")}>
            <div className={cl("subtabs-list")} onWheel={handleWheel}>
                {groups.map(group => (
                    <div
                        key={group.key}
                        className={classes(cl("subtab"), activeKey === group.key && cl("subtab-active"))}
                        onClick={() => onSelect(group.key)}
                    >
                        {group.avatarUrl && (
                            <img className={cl("subtab-avatar")} src={group.avatarUrl} alt="" />
                        )}
                        <span className={cl("subtab-label")}>{group.label}</span>
                        <span className={cl("subtab-count")}>{group.repos.length}</span>
                    </div>
                ))}
            </div>
            {canSort && (
                <div
                    className={cl("sort-toggle")}
                    onClick={onToggleSort}
                    title={sortMode === "count" ? "Sorted by repo count. Click to sort A-Z" : "Sorted A-Z. Click to sort by repo count"}
                >
                    <SortIcon className={cl("sort-icon")} width={14} height={14} />
                    <span>{sortMode === "count" ? "Most repos" : "A-Z"}</span>
                </div>
            )}
        </div>
    );
}
