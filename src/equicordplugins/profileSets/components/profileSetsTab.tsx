/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { extractAndLoadChunksLazy } from "@webpack";
import { React, SelectedGuildStore, useStateFromStores } from "@webpack/common";

import { cl } from "../classNames";
import { loadPresets, PresetSection } from "../utils/storage";
import { PinnedThemesControl } from "./pinnedThemesControl";
import { PresetManager } from "./presetManager";
import { ProfileSetsPreview } from "./profileSetsPreview";
import { ProfileSetsScopeBar } from "./profileSetsScopeBar";

const requireProfileSettingsChunk = extractAndLoadChunksLazy(["#{intl::MAIN_PROFILE}"]);

export function ProfileSetsTab() {
    const defaultGuildId = useStateFromStores(
        [SelectedGuildStore],
        () => SelectedGuildStore.getLastSelectedGuildId() ?? SelectedGuildStore.getGuildId()
    );

    const [section, setSection] = React.useState<PresetSection>("main");
    const [guildId, setGuildId] = React.useState<string | undefined>(undefined);
    const resolvedGuildId = section === "server" ? (guildId ?? defaultGuildId ?? undefined) : undefined;

    React.useEffect(() => {
        requireProfileSettingsChunk();
    }, []);

    React.useEffect(() => {
        let isActive = true;
        (async () => {
            await loadPresets(section);
            if (!isActive) return;
        })();
        return () => {
            isActive = false;
        };
    }, [section]);

    return (
        <div className={classes(cl("tab-panel"), Margins.top16)}>
            <div className={cl("tab-toolbar")}>
                <ProfileSetsScopeBar
                    section={section}
                    guildId={resolvedGuildId}
                    onSectionChange={setSection}
                    onGuildIdChange={setGuildId}
                />
                <PinnedThemesControl />
            </div>
            <Flex className={cl("layout")} alignItems="flex-start" gap="24px">
                <div className={cl("column-main")}>
                    <PresetManager
                        section={section}
                        guildId={resolvedGuildId}
                        hideHeading
                    />
                </div>
                <div className={cl("column-preview")}>
                    <ProfileSetsPreview section={section} guildId={resolvedGuildId} />
                </div>
            </Flex>
        </div>
    );
}
