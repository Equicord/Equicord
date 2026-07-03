/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { findGroupChildrenByChildId } from "@api/ContextMenu";
import * as DataStore from "@api/DataStore";
import { TextButton } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Heading } from "@components/Heading";
import definePlugin from "@utils/types";
import { RenderModalProps, User } from "@vencord/discord-types";
import { Menu, Modal, openModal, RelationshipStore, TextInput, UserStore, useState } from "@webpack/common";

const CUSTOM_USER_NICKNAMES_KEY = "CustomUserNicknames";

let customNicknames: Record<string, string> = {};
let originalGetNickname: any = null;

function CustomNicknameModal({ modalProps, user }: { modalProps: RenderModalProps; user: User; }) {
    const [value, setValue] = useState(customNicknames[user.id] ?? "");

    return (
        <Modal
            {...modalProps}
            size="sm"
            title={customNicknames[user.id] ? "Change Custom Nickname" : "Add Custom Nickname"}
            actions={[
                {
                    text: "Save",
                    variant: "primary",
                    onClick: async () => {
                        const trimmed = value.trim().slice(0, 32).trim();

                        if (trimmed) {
                            customNicknames[user.id] = trimmed;
                        } else {
                            delete customNicknames[user.id];
                        }

                        await DataStore.set(CUSTOM_USER_NICKNAMES_KEY, customNicknames);
                        RelationshipStore.emitChange();
                        modalProps.onClose();
                    }
                },
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: modalProps.onClose
                }
            ]}
        >
            <Heading tag="h3" style={{ marginBottom: 8, fontSize: "16px", fontWeight: "400", lineHeight: "1.25", color: "var(--text-subtle)" }}>
                {"Add a custom nickname for this user. It will only be visible to you in your direct messages."}
            </Heading>
            <div style={{ paddingTop: "10px", flexGrow: 0 }}></div>
            <Heading tag="h3" style={{ marginBottom: 8, fontSize: "14px", fontWeight: 600 }}>
                Custom Nickname
            </Heading>
            <TextInput
                value={value}
                maxLength={32}
                onChange={setValue}
                placeholder={user.globalName ?? user.username}
                style={{ width: "100%" }}
            />
            <TextButton
                className="custom-nicknames-reset-button"
                onClick={async () => {
                    setValue("");
                    delete customNicknames[user.id];
                    await DataStore.set(CUSTOM_USER_NICKNAMES_KEY, customNicknames);
                    RelationshipStore.emitChange();
                    modalProps.onClose();
                }}
                style={{ marginTop: 8 }}
            >
                Reset Custom Nickname
            </TextButton>
            <div style={{ paddingTop: "10px", flexGrow: 0 }}></div>
        </Modal>
    );
}

function userContextPatch(children: any[], { user }: { user: User; }) {
    if (!user) return;

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser || user.id === currentUser.id) return;

    const group = findGroupChildrenByChildId("user-profile", children);

    !group && children.push(<Menu.MenuSeparator />);
    (group || children).push(
        <Menu.MenuItem
            id="custom-user-nickname"
            label={customNicknames[user.id] ? "Change Custom Nickname" : "Add Custom Nickname"}
            action={() => openModal(props => (
                <ErrorBoundary>
                    <CustomNicknameModal modalProps={props} user={user} />
                </ErrorBoundary>
            ))}
        />
    );
}

export default definePlugin({
    name: "CustomUserNicknames",
    description: "Allows setting custom nicknames for users, whether you are friends or not.",
    tags: ["Utility", "Friends"],
    authors: [{ name: "Choko", id: 826467976484094023n }],
    contextMenus: {
        "user-context": userContextPatch
    },

    async start() {
        const data = await DataStore.get<Record<string, string>>(CUSTOM_USER_NICKNAMES_KEY);
        customNicknames = data ?? {};

        const store = RelationshipStore;

        if (store) {
            originalGetNickname = store.getNickname;
            store.getNickname = function (this: any, userId: string) {
                return customNicknames[userId] ?? originalGetNickname.call(this, userId);
            };

            store.emitChange();
        }
    },

    stop() {
        const store = RelationshipStore;

        if (store && originalGetNickname) {
            store.getNickname = originalGetNickname;
            originalGetNickname = null;
            store.emitChange();
        }
    }
});
