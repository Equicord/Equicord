/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { HeadingPrimary } from "@components/Heading";
import { SettingsTab, wrapTab } from "@components/settings";
import { GuildStore, React, SearchableSelect, SelectedGuildStore, useStateFromStores } from "@webpack/common";

import { cl } from "../index";
import { PresetSection } from "../utils/storage";
import { PresetManager } from "./presetManager";

function ProfileSetsTab() {
    const [section, setSection] = React.useState<PresetSection>("main");
    const lastSelectedGuildId = useStateFromStores(
        [SelectedGuildStore],
        () => SelectedGuildStore.getLastSelectedGuildId() ?? SelectedGuildStore.getGuildId()
    );

    const guildOptions = React.useMemo(
        () => GuildStore.getGuildsArray()
            .map(guild => ({ label: guild.name, value: guild.id }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        []
    );

    const [guildId, setGuildId] = React.useState<string | undefined>(lastSelectedGuildId ?? guildOptions[0]?.value);

    return (
        <SettingsTab>
            <HeadingPrimary className={cl("tab-heading")}>Profile Sets</HeadingPrimary>

            <div className={cl("section-switch")}>
                <Button
                    size="small"
                    variant={section === "main" ? "primary" : "secondary"}
                    onClick={() => setSection("main")}
                >
                    Main Profile
                </Button>
                <Button
                    size="small"
                    variant={section === "server" ? "primary" : "secondary"}
                    onClick={() => setSection("server")}
                >
                    Server Profiles
                </Button>
            </div>

            {section === "server" && (
                <div className={cl("guild-picker")}>
                    <SearchableSelect
                        options={guildOptions}
                        value={guildId}
                        placeholder="Select a server"
                        clearable={false}
                        closeOnSelect={true}
                        onChange={v => setGuildId(v as string)}
                    />
                </div>
            )}

            {section === "server" && !guildId ? (
                <p className={cl("empty-state")}>You are not in any servers yet.</p>
            ) : (
                <PresetManager section={section} guildId={section === "server" ? guildId : undefined} />
            )}
        </SettingsTab>
    );
}

export default wrapTab(ProfileSetsTab, "Profile Sets");
