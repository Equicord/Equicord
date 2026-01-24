/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { User } from "@vencord/discord-types";
import { findByCodeLazy } from "@webpack";
import { React } from "@webpack/common";

import { GitHubReposComponent } from "./components/GitHubReposComponent";

export const cl = classNameFactory("vc-github-repos-");

export const settings = definePluginSettings({
    showStars: {
        type: OptionType.BOOLEAN,
        description: "Show repository stars",
        default: true
    },
    showLanguage: {
        type: OptionType.BOOLEAN,
        description: "Show repository language",
        default: true
    },
    showInMiniProfile: {
        type: OptionType.BOOLEAN,
        description: "Show full ui in the mini profile instead of just a button",
        default: true
    },
    showRepositoryTab: {
        type: OptionType.BOOLEAN,
        description: "Show repositories tab in profile modal (hides button in connections when enabled)",
        default: true
    },
});

const getProfileThemeProps = findByCodeLazy(".getPreviewThemeColors", "primaryColor:");

const ProfilePopoutComponent = ErrorBoundary.wrap(
    (props: { user: User; displayProfile?: any; }) => {
        return (
            <GitHubReposComponent
                {...props}
                id={props.user.id}
                theme={getProfileThemeProps(props).theme}
            />
        );
    },
    {
        noop: true,
        fallback: () => <BaseText size="xs" weight="semibold" className="vc-github-repos-error" style={{ color: "var(--text-feedback-critical)" }}>
            Error, Failed to render GithubRepos
        </BaseText>
    }
);

const ProfileRepositoriesTab = ErrorBoundary.wrap(
    (props: { user: User; displayProfile?: any; }) => {
        return (
            <GitHubReposComponent
                {...props}
                id={props.user.id}
                theme={getProfileThemeProps(props).theme}
                variant="tab"
            />
        );
    },
    { noop: true }
);

export default definePlugin({
    name: "GitHubRepos",
    description: "Displays a user's public GitHub repositories in their profile",
    authors: [EquicordDevs.talhakf, EquicordDevs.Panniku, EquicordDevs.benjii],
    settings,

    patches: [
        // User Popout
        {
            find: ".hasAvatarForGuild(null==",
            replacement: {
                match: /userId:\i\.id,guild:\i.{0,15}\}\).{0,100}(?=\])/,
                replace: "$&,$self.ProfilePopoutComponent(arguments[0])"
            }
        },
        // User Profile Modal v2
        {
            find: ".MODAL_V2,onClose:",
            replacement: {
                match: /displayProfile:(\i).*?connections:\i.{0,25}\i.\i\}\)\}\)/,
                replace: "$&,$self.ProfilePopoutComponent({ user: arguments[0].user, displayProfile: $1 }),",
                predicate: () => !settings.store.showRepositoryTab,
            }
        },
        // User Profile Modal v2 tab bar
        {
            find: "#{intl::USER_PROFILE_ACTIVITY}",
            replacement: {
                match: /\.MUTUAL_GUILDS\}\)\)(?=,(\i))/,
                replace: '$&,$1.push({text:"GitHub",section:"GITHUB"})',
                predicate: () => settings.store.showRepositoryTab,
            }
        },
        // User Profile Modal v2 tab content
        {
            find: ".WIDGETS?",
            replacement: {
                match: /(\i)===\i\.\i\.WISHLIST/,
                replace: '$1==="GITHUB"?$self.ProfileRepositoriesTab(arguments[0]):$&'
            }
        }
    ],
    ProfilePopoutComponent,
    ProfileRepositoriesTab
});
