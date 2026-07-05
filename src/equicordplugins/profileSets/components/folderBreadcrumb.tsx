/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { React } from "@webpack/common";

import { cl } from "../classNames";

type FolderBreadcrumbProps = {
    folderName: string;
    onNavigateRoot: () => void;
};

export function FolderBreadcrumb({ folderName, onNavigateRoot }: FolderBreadcrumbProps) {
    return (
        <nav className={cl("breadcrumb")} aria-label="Profile folder navigation">
            <button
                type="button"
                className={cl("breadcrumb-link")}
                onClick={onNavigateRoot}
            >
                All Profiles
            </button>
            <span className={cl("breadcrumb-sep")} aria-hidden="true">
                /
            </span>
            <span className={cl("breadcrumb-current")}>
                {folderName}
            </span>
        </nav>
    );
}
