/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get } from "@api/DataStore";
import { PencilIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import { openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { User } from "@vencord/discord-types";
import { extractAndLoadChunksLazy } from "@webpack";
import { Menu } from "@webpack/common";

import { SetAvatarModal } from "./AvatarModal";

export const requireSettingsMenu = extractAndLoadChunksLazy(['name:"UserSettings"'], /createPromise:.{0,20}(\i\.\i\("?.+?"?\).*?).then\(\i\.bind\(\i,"?(.+?)"?\)\).{0,50}"UserSettings"/);
export const KEY_DATASTORE = "vencord-custom-avatars";
export let avatars: Record<string, string> = {};

export default definePlugin({
    name: "ChangeFriendAvatar",
    description: "Set custom avatar URLs for any user",
    authors: [EquicordDevs.soapphia],

    patches: [
        {
            find: "getUserAvatarURL:",
            replacement: [
                {
                    match: /(getUserAvatarURL:)(\i),/,
                    replace: "$1$self.getAvatarHook($2),"
                }
            ]
        }
    ],

    getAvatarHook: (original: any) => (user: User, animated: boolean, size: number) => {
        if (!avatars[user.id]) return original(user, animated, size);

        const customUrl = avatars[user.id];
        try {
            const res = new URL(customUrl);
            res.searchParams.set("size", size.toString());
            return res.toString();
        } catch {
            return customUrl;
        }
    },

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
                        await requireSettingsMenu();
                        openModal(modalProps => <SetAvatarModal userId={user.id} modalProps={modalProps} />);
                    }}
                />
            );
        }
    },

    async start() {
        avatars = await get<Record<string, string>>(KEY_DATASTORE) || {};
    },

    stop() { }
});
