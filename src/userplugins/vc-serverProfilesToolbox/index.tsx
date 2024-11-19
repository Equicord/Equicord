/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findComponentByCodeLazy } from "@webpack";
import {
    Button,
    Clipboard,
    FluxDispatcher,
    GuildMemberStore,
    Text,
    Toasts,
    UserProfileStore,
    UserStore
} from "@webpack/common";
import { Guild, GuildMember } from "discord-types/general";

const SummaryItem = findComponentByCodeLazy("borderType", "showBorder", "hideDivider");

interface SavedProfile {
    nick: string | null;
    pronouns: string | null;
    bio: string | null;
    themeColors: number[] | undefined;
    banner: string | undefined;
    avatar: string | undefined;
    profileEffectId: string | undefined;
    avatarDecoration: string | undefined;
}

const savedProfile: SavedProfile = {
    nick: null,
    pronouns: null,
    bio: null,
    themeColors: undefined,
    banner: undefined,
    avatar: undefined,
    profileEffectId: undefined,
    avatarDecoration: undefined,
};

const IdentityActions = {
    setPendingAvatar(avatar: string | undefined) {
        FluxDispatcher.dispatch({
            type: "GUILD_IDENTITY_SETTINGS_SET_PENDING_AVATAR",
            avatar,
        });
    },
    setPendingBanner(banner: string | undefined) {
        FluxDispatcher.dispatch({
            type: "GUILD_IDENTITY_SETTINGS_SET_PENDING_BANNER",
            banner,
        });
    },
    setPendingBio(bio: string | null) {
        FluxDispatcher.dispatch({
            type: "GUILD_IDENTITY_SETTINGS_SET_PENDING_BIO",
            bio,
        });
    },
    setPendingNickname(nickname: string | null) {
        FluxDispatcher.dispatch({
            type: "GUILD_IDENTITY_SETTINGS_SET_PENDING_NICKNAME",
            nickname,
        });
    },
    setPendingPronouns(pronouns: string | null) {
        FluxDispatcher.dispatch({
            type: "GUILD_IDENTITY_SETTINGS_SET_PENDING_PRONOUNS",
            pronouns,
        });
    },
    setPendingThemeColors(themeColors: number[] | undefined) {
        FluxDispatcher.dispatch({
            type: "GUILD_IDENTITY_SETTINGS_SET_PENDING_THEME_COLORS",
            themeColors,
        });
    },
    setPendingProfileEffectId(profileEffectId: string | undefined) {
        FluxDispatcher.dispatch({
            type: "GUILD_IDENTITY_SETTINGS_SET_PENDING_PROFILE_EFFECT_ID",
            profileEffectId,
        });
    },
    setPendingAvatarDecoration(avatarDecoration: string | undefined) {
        FluxDispatcher.dispatch({
            type: "GUILD_IDENTITY_SETTINGS_SET_PENDING_AVATAR_DECORATION",
            avatarDecoration,
        });
    },
};

export default definePlugin({
    name: "ServerProfilesToolbox",
    authors: [Devs.D3SOX],
    description: "Adds a copy/paste/reset button to the server profiles editor",

    patchServerProfiles(guild: Guild) {
        const guildId = guild.id;
        const currentUser = UserStore.getCurrentUser();
        const premiumType = currentUser.premiumType ?? 0;

        const copy = () => {
            const profile = UserProfileStore.getGuildMemberProfile(currentUser.id, guildId);
            const nick = GuildMemberStore.getNick(guildId, currentUser.id);
            const selfMember = GuildMemberStore.getMember(guildId, currentUser.id) as GuildMember & { avatarDecoration: string | undefined };
            savedProfile.nick = nick ?? "";
            savedProfile.pronouns = profile.pronouns;
            savedProfile.bio = profile.bio;
            savedProfile.themeColors = profile.themeColors;
            savedProfile.banner = profile.banner;
            savedProfile.avatar = selfMember.avatar;
            savedProfile.profileEffectId = profile.profileEffectId;
            savedProfile.avatarDecoration = selfMember.avatarDecoration;
        };

        const paste = () => {
            IdentityActions.setPendingNickname(savedProfile.nick);
            IdentityActions.setPendingPronouns(savedProfile.pronouns);
            if (premiumType === 2) {
                IdentityActions.setPendingBio(savedProfile.bio);
                IdentityActions.setPendingThemeColors(savedProfile.themeColors);
                IdentityActions.setPendingBanner(savedProfile.banner);
                IdentityActions.setPendingAvatar(savedProfile.avatar);
                IdentityActions.setPendingProfileEffectId(savedProfile.profileEffectId);
                IdentityActions.setPendingAvatarDecoration(savedProfile.avatarDecoration);
            }
        };

        const reset = () => {
            IdentityActions.setPendingNickname(null);
            IdentityActions.setPendingPronouns("");
            if (premiumType === 2) {
                IdentityActions.setPendingBio(null);
                IdentityActions.setPendingThemeColors([]);
                IdentityActions.setPendingBanner(undefined);
                IdentityActions.setPendingAvatar(undefined);
                IdentityActions.setPendingProfileEffectId(undefined);
                IdentityActions.setPendingAvatarDecoration(undefined);
            }
        };

        const copyToClipboard = () => {
            copy();
            Clipboard.copy(JSON.stringify(savedProfile));
        };

        const pasteFromClipboard = async () => {
            try {
                const clip = await navigator.clipboard.readText();
                if (!clip) {
                    Toasts.show({
                        message: "Clipboard is empty",
                        type: Toasts.Type.FAILURE,
                        id: Toasts.genId(),
                    });
                    return;
                }
                const clipboardProfile: SavedProfile = JSON.parse(clip);

                if (!("nick" in clipboardProfile)) {
                    Toasts.show({
                        message: "Data is not in correct format",
                        type: Toasts.Type.FAILURE,
                        id: Toasts.genId(),
                    });
                    return;
                }

                Object.assign(savedProfile, JSON.parse(clip));
                paste();
            } catch (e) {
                Toasts.show({
                    message: `Failed to read clipboard data: ${e}`,
                    type: Toasts.Type.FAILURE,
                    id: Toasts.genId(),
                });
            }
        };

            return <SummaryItem title="Server Profiles Toolbox" hideDivider={false} forcedDivider className="vc-server-profiles-toolbox">
            <div style={{ display: "flex", alignItems: "center", flexDirection: "column", gap: "5px" }}>
                <Text variant="text-md/normal">
                    Use the following buttons to mange the currently selected server
                </Text>
                <div style={{ display: "flex", gap: "5px" }}>
                    <Button onClick={copy}>
                        Copy profile
                    </Button>
                    <Button onClick={paste}>
                        Paste profile
                    </Button>
                    <Button onClick={reset}>
                        Reset profile
                    </Button>
                </div>
                <div style={{ display: "flex", gap: "5px" }}>
                    <Button onClick={copyToClipboard}>
                        Copy to clipboard
                    </Button>
                    <Button onClick={pasteFromClipboard}>
                        Paste from clipboard
                    </Button>
                </div>
            </div>
        </SummaryItem>;
    },

    patches: [
        {
            find: "PROFILE_CUSTOMIZATION_GUILD_HINT.format",
            replacement: {
                match: /\(0,\i\.jsx\)\(\i\.\i,\{guildId:(\i)\.id,/,
                replace: "$self.patchServerProfiles($1),$&"
            }
        }
    ],

});
