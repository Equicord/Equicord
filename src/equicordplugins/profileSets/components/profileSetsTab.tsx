/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { extractAndLoadChunksLazy } from "@webpack";
import { React, SelectedGuildStore, useStateFromStores } from "@webpack/common";

import { cl } from "../classNames";
import type { PresetSection } from "../utils/storage";
import { openCreateFolderModal } from "./createFolderModal";
import { PinnedThemesControl } from "./pinnedThemesControl";
import { PresetManager } from "./presetManager";
import { ProfileSetsScopeBar } from "./profileSetsScopeBar";

const requireProfileSettingsChunk = extractAndLoadChunksLazy(["#{intl::MAIN_PROFILE}"]);

export function ProfileSetsTab() {
    const defaultGuildId = useStateFromStores(
        [SelectedGuildStore],
        () => SelectedGuildStore.getLastSelectedGuildId() ?? SelectedGuildStore.getGuildId()
    );

    const [section, setSection] = React.useState<PresetSection>("main");
    const [guildId, setGuildId] = React.useState<string | undefined>(undefined);
    const [activeFolderId, setActiveFolderId] = React.useState<string | null>(null);
    const [searchMode, setSearchMode] = React.useState(false);
    const [, forceFolderUpdate] = React.useReducer(x => x + 1, 0);
    const resolvedGuildId = section === "server" ? (guildId ?? defaultGuildId ?? undefined) : undefined;
    const canUseGuild = section !== "server" || Boolean(resolvedGuildId);
    const showNewFolder = activeFolderId == null && !searchMode;

    React.useEffect(() => {
        requireProfileSettingsChunk();
    }, []);

    React.useEffect(() => {
        setActiveFolderId(null);
        setSearchMode(false);
    }, [section]);

    return (
        <div className={classes(cl("tab-panel"), Margins.top16)}>
            <div className={cl("tab-toolbar")}>
                <ProfileSetsScopeBar
                    section={section}
                    guildId={resolvedGuildId}
                    onSectionChange={setSection}
                    onGuildIdChange={setGuildId}
                    showNewFolder={showNewFolder}
                    canUseGuild={canUseGuild}
                    onNewFolder={() => openCreateFolderModal(section, forceFolderUpdate)}
                />
                <PinnedThemesControl />
            </div>
            <PresetManager
                section={section}
                guildId={resolvedGuildId}
                hideHeading
                activeFolderId={activeFolderId}
                setActiveFolderId={setActiveFolderId}
                searchMode={searchMode}
                setSearchMode={setSearchMode}
                onStoreChange={forceFolderUpdate}
            />
        </div>
    );
}
