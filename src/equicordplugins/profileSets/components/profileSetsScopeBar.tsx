/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { GuildStore, IconUtils, React, SearchableSelect, SelectedGuildStore, useStateFromStores } from "@webpack/common";

import { cl } from "../classNames";
import { PresetSection } from "../utils/storage";

type ProfileSetsScopeBarProps = {
    section: PresetSection;
    guildId: string | undefined;
    onSectionChange: (section: PresetSection) => void;
    onGuildIdChange: (guildId: string | undefined) => void;
};

export function ProfileSetsScopeBar({
    section,
    guildId,
    onSectionChange,
    onGuildIdChange
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
