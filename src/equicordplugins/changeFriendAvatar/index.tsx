/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get } from "@api/DataStore";
import { definePluginSettings, Settings } from "@api/Settings";
import { PencilIcon } from "@components/Icons";
import { openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { extractAndLoadChunksLazy, findByProps } from "@webpack";
import { Menu, UserStore } from "@webpack/common";
import { User } from "@vencord/discord-types";

import { SetAvatarModal } from "./AvatarModal";

export const KEY_DATASTORE = "vencord-customavatars";
export let avatars: Record<string, string> = {};
let Icons: any;
let getGuildAvatarURL: any;
let getDefaultAvatarURL: any;

const settings = definePluginSettings({
    overrideServerAvatars: {
        type: OptionType.BOOLEAN,
        description: "Override server avatars with custom avatars or the default user avatar if no custom avatar is set.",
        default: true
    }
});

export function getCustomAvatar(userId: string, withHash?: boolean): string | undefined {
    if (!avatars[userId] || !Settings.plugins.ChangeFriendAvatar?.enabled)
        return;
    return avatars[userId];
}

export default definePlugin({
    name: "ChangeFriendAvatar",
    description: "Set custom avatar URLs for any user",
    authors: [
        {
            name: "soap phia",
            id: 1012095822957133976n
        }
    ],
    settings,
    getCustomAvatar,

    patches: [],

    contextMenus: {
        "user-context": (children, { user }) => {
            if (!user?.id) return;

            children.push(
                <Menu.MenuSeparator />,
                <Menu.MenuItem
                    label="Set Avatar"
                    id="set-avatar"
                    icon={PencilIcon}
                    action={async () => {
                        await extractAndLoadChunksLazy(['name:"UserSettings"'], /createPromise:.{0,20}(\i\.\i\("?.+?"?\).*?).then\(\i\.bind\(\i,"?(.+?)"?\)\).{0,50}"UserSettings"/);
                        openModal(modalProps => <SetAvatarModal userId={user.id} modalProps={modalProps} />);
                    }}
                />
            );
        }
    },

    async start() {
        avatars = await get<Record<string, string>>(KEY_DATASTORE) || {};
        Icons = findByProps("getUserAvatarURL", "getGuildMemberAvatarURLSimple");
        if (Icons) {
            getDefaultAvatarURL = Icons.getUserAvatarURL;
            Icons.getUserAvatarURL = (user: User, animated?: boolean, size?: number) => {
                if (avatars[user.id]) {
                    const customUrl = avatars[user.id];
                    try {
                        const res = new URL(customUrl);
                        if (size) res.searchParams.set("size", size.toString());
                        return res.toString();
                    } catch {
                        return customUrl;
                    }
                }
                return getDefaultAvatarURL(user, animated, size);
            };

            getGuildAvatarURL = Icons.getGuildMemberAvatarURLSimple;
            Icons.getGuildMemberAvatarURLSimple = (config: any) => {
                const { userId, avatar, size, canAnimate } = config;

                if (!settings.store.overrideServerAvatars) {
                    return getGuildAvatarURL(config);
                }

                if (avatars[userId]) {
                    const customUrl = avatars[userId];
                    try {
                        const res = new URL(customUrl);
                        if (size) res.searchParams.set("size", size.toString());
                        return res.toString();
                    } catch {
                        return customUrl;
                    }
                }

                if (avatar) {
                    const user = UserStore.getUser(userId);
                    if (user?.avatar) {
                        return Icons.getUserAvatarURL(user, canAnimate, size);
                    }
                }

                return getGuildAvatarURL(config);
            };
        }
    },

    stop() {
        if (Icons && getDefaultAvatarURL) {
            Icons.getUserAvatarURL = getDefaultAvatarURL;
        }
        if (Icons && getGuildAvatarURL) {
            Icons.getGuildMemberAvatarURLSimple = getGuildAvatarURL;
        }
    }
});
