import { get, set } from "@api/DataStore";
import { Settings } from "@api/Settings";
import { PencilIcon } from "@components/Icons";
import { openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { extractAndLoadChunksLazy } from "@webpack";
import { Menu } from "@webpack/common";

import { SetAvatarModal } from "./AvatarModal";

export const KEY_DATASTORE = "vencord-customavatars";
export let avatars: Record<string, string> = {};

export function getCustomAvatarString(userId: string): string | undefined {
    if (!Settings.plugins.ChangeFriendAvatar?.enabled) return;
    return avatars[userId];
}

export async function saveAvatars() {
    await set(KEY_DATASTORE, avatars);
}

export default definePlugin({
    name: "ChangeFriendAvatar",
    description: "Set custom avatar URLs for any user",
    authors: [{ name: "soap phia", id: 1012095822957133976n }],

    getCustomAvatarString,

    patches: [
        {
            find: "getUserAvatarURL:",
            replacement: {
                match: /getUserAvatarURL\((\i)\)\{/,
                replace: "$&const customAvatar=$self.getCustomAvatarString($1.id);if(customAvatar)return customAvatar;"
            }
        },
        {
            find: ".getAvatarURL=function",
            replacement: {
                match: /\.getAvatarURL=function\((\i)(?:,\i)?\)\{/,
                replace: "$&const customAvatar=$self.getCustomAvatarString(this.id);if(customAvatar)return customAvatar;"
            }
        }
    ],

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
                        await extractAndLoadChunksLazy(
                            ['name:"UserSettings"'],
                            /createPromise:.{0,20}(\i\.\i\("?.+?"?\).*?).then\(\i\.bind\(\i,"?(.+?)"?\)\).{0,50}"UserSettings"/
                        );
                        openModal(modalProps => <SetAvatarModal userId={user.id} modalProps={modalProps} />);
                    }}
                />
            );
        }
    },

    async start() {
        avatars = await get<Record<string, string>>(KEY_DATASTORE) ?? {};
    },

    stop() { }
});
