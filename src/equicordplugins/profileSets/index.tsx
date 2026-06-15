/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { TabBar } from "@webpack/common";
import { ProfileSetsSettingsAbout } from "./components/settingsAbout";
import { ProfileSetsTab } from "./components/profileSetsTab";
import { cl } from "./classNames";
import { mergePendingUserProfile } from "./utils/previewMerge";
import { loadPresets } from "./utils/storage";
import { PROFILE_SETS_SECTION } from "./utils/subsectionStore";
import { loadThemeBindings } from "./utils/themeBindings";
import { restoreActivePresetTheme } from "./utils/themes";
import { settings } from "./settings";

export { cl, PROFILE_SETS_SECTION, settings };

const ProfileSetsTabWrapped = ErrorBoundary.wrap(ProfileSetsTab, { noop: true });

export default definePlugin({
    name: "ProfileSets",
    description: "Save and switch profile presets (avatar, banner, bio, effects). Optionally bind each preset to an Equicord theme.",
    tags: ["Appearance", "Customisation", "Utility"],
    authors: [EquicordDevs.omaw, EquicordDevs.justjxke, EquicordDevs.Jahbas],
    settings,
    settingsAboutComponent: ProfileSetsSettingsAbout,
    patches: [
        {
            find: "UserProfileStore",
            replacement: [
                {
                    match: /(?<=getUserProfile\(\i\){return )(.+?)(?=})/,
                    replace: "$self.mergePendingUserProfile($1, arguments[0])"
                },
                {
                    match: /(?<=getGuildMemberProfile\(\i,\i\){return )(.+?)(?=})/,
                    replace: "$self.mergePendingUserProfile($1, arguments[0], arguments[1])"
                }
            ]
        },
        {
            find: "#{intl::MAIN_PROFILE}",
            replacement: [
                {
                    match: /#{intl::EDIT_PROFILE_CATEGORY_GUILD_IDENTITY}\)\},(\i)\.(\i)\.GUILD\)/,
                    replace: "$&,$self.profileSetsTabBar()"
                },
                {
                    match: /(\i)===\i\.(\i)\.GUILD\?/,
                    replace: "$1===\"profile_sets\"?$self.profileSetsTabPanel():$1===$2.GUILD?"
                },
            ]
        },
    ],
    start() {
        void loadThemeBindings().then(() => restoreActivePresetTheme());
        loadPresets("main");
    },
    mergePendingUserProfile,
    profileSetsTabBar() {
        return (
            <TabBar.Item id={PROFILE_SETS_SECTION}>
                Profile Sets
            </TabBar.Item>
        );
    },
    profileSetsTabPanel() {
        return <ProfileSetsTabWrapped />;
    }
});
