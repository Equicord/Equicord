/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { GuildStore, IconUtils, React, SearchableSelect, SelectedGuildStore, Tooltip, useStateFromStores } from "@webpack/common";

import { cl } from "../classNames";

type ProfileSetsScopeBarProps = {
    section: "main" | "server";
    guildId: string | undefined;
    onSectionChange: (section: "main" | "server") => void;
    onGuildIdChange: (guildId: string | undefined) => void;
    showNewFolder: boolean;
    onNewFolder: () => void;
    canUseGuild: boolean;
};

function ScopeFolderIcon() {
    return (
        <svg
            className={cl("scope-folder-icon")}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 10v6" />
            <path d="M9 13h6" />
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        </svg>
    );
}

export function ProfileSetsScopeBar({
    section,
    guildId,
    onSectionChange,
    onGuildIdChange,
    showNewFolder,
    onNewFolder,
    canUseGuild,
}: ProfileSetsScopeBarProps) {
    const guildOptions = useStateFromStores([GuildStore], () =>
        Object.values(GuildStore.getGuilds())
            .map(g => ({ value: g.id, label: g.name }))
            .sort((a, b) => a.label.localeCompare(b.label))
    );

    const defaultGuildId = useStateFromStores(
        [SelectedGuildStore],
        () => SelectedGuildStore.getLastSelectedGuildId() ?? SelectedGuildStore.getGuildId()
    );

    const effectiveGuildId = guildId ?? defaultGuildId ?? undefined;

    return (
        <div className={cl("scope-bar")}>
            <div className={cl("scope-toggle")}>
                <Button
                    size="small"
                    variant={section === "main" ? "primary" : "secondary"}
                    onClick={() => onSectionChange("main")}
                >
                    Main profile
                </Button>
                <Button
                    size="small"
                    variant={section === "server" ? "primary" : "secondary"}
                    onClick={() => {
                        onSectionChange("server");
                        if (!guildId && defaultGuildId) {
                            onGuildIdChange(defaultGuildId);
                        }
                    }}
                >
                    Server profile
                </Button>
            </div>
            {showNewFolder && (
                <Tooltip text={canUseGuild ? "New folder" : "Select a server first"}>
                    {({ onMouseEnter, onMouseLeave }) => (
                        <button
                            type="button"
                            className={cl("scope-folder-btn")}
                            aria-label="New folder"
                            disabled={!canUseGuild}
                            onClick={onNewFolder}
                            onMouseEnter={onMouseEnter}
                            onMouseLeave={onMouseLeave}
                        >
                            <ScopeFolderIcon />
                        </button>
                    )}
                </Tooltip>
            )}
            {section === "server" && (
                <div className={cl("scope-guild")}>
                    <SearchableSelect
                        options={guildOptions}
                        value={guildOptions.find(o => o.value === effectiveGuildId)?.value}
                        placeholder="Select a server..."
                        maxVisibleItems={6}
                        closeOnSelect={true}
                        onChange={v => onGuildIdChange(v)}
                        renderOptionPrefix={o => {
                            const guild = GuildStore.getGuild(o?.value);
                            if (!guild?.icon) return null;
                            const iconUrl = IconUtils.getGuildIconURL({ id: guild.id, icon: guild.icon, size: 32 });
                            if (!iconUrl) return null;
                            return (
                                <img
                                    className={cl("scope-guild-icon")}
                                    alt=""
                                    src={iconUrl}
                                />
                            );
                        }}
                    />
                </div>
            )}
        </div>
    );
}
