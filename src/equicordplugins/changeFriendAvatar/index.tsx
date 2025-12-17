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
import { extractAndLoadChunksLazy, findStoreLazy } from "@webpack";
import { Menu } from "@webpack/common";

import { SetAvatarModal } from "./AvatarModal";
export const KEY_DATASTORE = "vencord-customavatars";
export const KEY_STYLESHEET = "vencord-customavatars-style";
export let avatars: Record<string, string> = {};

let styleEl: HTMLStyleElement | null = null;

(async () => {
    avatars = await get<Record<string, string>>(KEY_DATASTORE) || {};
})();

const UserStore = findStoreLazy("UserStore") as typeof import("@webpack/common").UserStore;

const settings = definePluginSettings({
    enableReloadWarning: {
        type: OptionType.BOOLEAN,
        description: "Enable or disable the reload warning modal after changing the avatar",
        default: true
    }
});
export { settings };
export function getCustomAvatarString(userId: string, withHash?: boolean): string | undefined {
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
    getCustomAvatarString,

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
        const css = await get(KEY_STYLESHEET);
        if (css) {
            styleEl = document.createElement("style");
            styleEl.id = "vc-custom-avatar-style";
            styleEl.textContent = css;
            document.head.appendChild(styleEl);
        }
    },

    stop() {
        if (styleEl) {
            styleEl.remove();
            styleEl = null;
        }
    }
});
