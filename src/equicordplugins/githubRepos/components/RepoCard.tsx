/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { getLanguageColor } from "@equicordplugins/githubRepos/colors";
import { RepoCardProps } from "@equicordplugins/githubRepos/types";
import { getLanguageIconUrl } from "@equicordplugins/githubRepos/utils";
import { React } from "@webpack/common";

import { cl } from "..";
import { Star } from "./Star";

export function RepoCard({ repo, showStars, showLanguage }: RepoCardProps) {
    const handleClick = () => window.open(repo.html_url, "_blank");
    const langColor = getLanguageColor(repo?.language);

    return (
        <div className={cl("card")} onClick={handleClick}>
            <div className={cl("art")} style={{ backgroundColor: `${langColor}2b` }}>
                <img className={cl("art-icon")} src={getLanguageIconUrl(repo.language)} alt="" />
            </div>
            <div className={cl("info")}>
                <BaseText size="sm" weight="semibold" className={cl("name")}>
                    {repo.name}
                </BaseText>
                {repo.description && (
                    <BaseText size="sm" className={cl("description")}>
                        {repo.description}
                    </BaseText>
                )}
                {(showLanguage || showStars) && (
                    <div className={cl("meta")}>
                        {showLanguage && repo.language && (
                            <span className={cl("language")}>
                                <span className={cl("language-color")} style={{ backgroundColor: langColor }} />
                                {repo.language}
                            </span>
                        )}
                        {showStars && (
                            <span className={cl("stars")}>
                                <Star className={cl("star-icon")} width={12} height={12} />
                                {repo.stargazers_count.toLocaleString()}
                            </span>
                        )}
                    </div>
                )}
            </div>
            <svg
                className={cl("link")}
                aria-hidden="true"
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                fill="none"
                viewBox="0 0 24 24"
            >
                <path
                    fill="currentColor"
                    d="M8 5a1 1 0 0 0 0 2h7.59L5.29 17.3a1 1 0 1 0 1.42 1.4L17 8.42V16a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1H8Z"
                />
            </svg>
        </div>
    );
}
