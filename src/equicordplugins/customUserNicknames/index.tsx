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
import { definePluginSettings } from "@api/Settings";
import { TextButton } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Heading } from "@components/Heading";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { GuildMember, RenderModalProps, User } from "@vencord/discord-types";
import { findByProps } from "@webpack";
import { FluxDispatcher, GuildMemberStore, Menu, Modal, openModal, RelationshipStore, SelectedGuildStore, TextInput, UserStore, useState } from "@webpack/common";

const CUSTOM_USER_NICKNAMES_KEY = "CustomUserNicknames";

const settings = definePluginSettings({
    showInGuilds: {
        description: "Show custom nicknames in Servers (Guilds)",
        type: OptionType.BOOLEAN,
        default: true,
        onChange() {
            if (GuildMemberStore) {
                GuildMemberStore.emitChange();
            }
        }
    }
});

let customNicknames: Record<string, string> = {};
let originalGetNickname: typeof RelationshipStore.getNickname | null = null;
let guildGetNickname: typeof GuildMemberStore.getNick | null = null;
let guildGetMember: typeof GuildMemberStore.getMember | null = null;
let guildGetMembers: typeof GuildMemberStore.getMembers | null = null;
let originalGetName: any = null;
let originalGetNicknameOfModule: any = null;
let originalUseName: any = null;

async function triggerNickUpdate(user: User, newNick: string | null) {
    if (newNick) {
        customNicknames[user.id] = newNick;
    } else {
        delete customNicknames[user.id];
    }

    await DataStore.set(CUSTOM_USER_NICKNAMES_KEY, customNicknames);
    RelationshipStore.emitChange();

    if (GuildMemberStore) {
        GuildMemberStore.emitChange();

        const guildId = SelectedGuildStore?.getGuildId();
        if (guildId) {
            const member = GuildMemberStore.getMember(guildId, user.id);
            const roles = member?.roles ?? [];
            const nick = newNick ?? member?.nick ?? null;
            const avatar = member?.avatar ?? null;

            FluxDispatcher.dispatch({ type: "GUILD_MEMBER_UPDATE", guildId, user, roles, nick, avatar });
        }
    }
}

function getUserObj(...args: any[]) {
    return args.find((arg): arg is User => arg && typeof arg === "object" && typeof arg.id === "string");
}

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
                        await triggerNickUpdate(user, trimmed || null);
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
                {"Add a custom nickname for this user. It will be visible according to your plugin settings."}
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
                    await triggerNickUpdate(user, null);
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
    authors: [EquicordDevs.choko],
    settings,
    contextMenus: {
        "user-context": userContextPatch
    },

    async start() {
        const data = await DataStore.get<Record<string, string>>(CUSTOM_USER_NICKNAMES_KEY);
        customNicknames = data ?? {};

        const store = RelationshipStore;

        if (store) {
            originalGetNickname = store.getNickname;
            store.getNickname = function (this: typeof store, userId: string) {
                return customNicknames[userId] ?? originalGetNickname!.call(this, userId);
            };

            store.emitChange();
        }

        const guildStore = GuildMemberStore;

        if (guildStore) {
            guildGetNickname = guildStore.getNick;
            guildStore.getNick = function (this: typeof guildStore, guildId: string, userId: string) {
                if (!settings.store.showInGuilds) return guildGetNickname!.call(this, guildId, userId);
                return customNicknames[userId] ?? guildGetNickname!.call(this, guildId, userId);
            };

            guildGetMember = guildStore.getMember;
            guildStore.getMember = function (this: typeof guildStore, guildId: string, userId: string) {
                const member = guildGetMember!.call(this, guildId, userId);
                if (member && customNicknames[userId] && settings.store.showInGuilds) {
                    return {
                        ...member,
                        nick: customNicknames[userId]
                    };
                }
                return member;
            };

            guildGetMembers = guildStore.getMembers;
            guildStore.getMembers = function (this: typeof guildStore, guildId: string) {
                const members = guildGetMembers!.call(this, guildId);
                if (members && members.length) {
                    return members.map((member: GuildMember) => {
                        if (member && customNicknames[member.userId] && settings.store.showInGuilds) {
                            return {
                                ...member,
                                nick: customNicknames[member.userId]
                            };
                        }
                        return member;
                    });
                }
                return members;
            };
        }

        const NicknameUtils = findByProps("getName", "useName", "getNickname");

        if (NicknameUtils) {
            originalGetName = NicknameUtils.getName;
            NicknameUtils.getName = function (this: unknown, ...args: any[]) {
                const userObj = getUserObj(args);
                if (userObj && customNicknames[userObj.id] && settings.store.showInGuilds) {
                    return customNicknames[userObj.id];
                }

                return originalGetName.apply(this, args);
            };

            originalGetNicknameOfModule = NicknameUtils.getNickname;
            NicknameUtils.getNickname = function (this: unknown, ...args: any[]) {
                const userObj = getUserObj(args);
                if (userObj && customNicknames[userObj.id] && settings.store.showInGuilds) {
                    return customNicknames[userObj.id];
                }

                return originalGetNicknameOfModule.apply(this, args);
            };

            originalUseName = NicknameUtils.useName;
            NicknameUtils.useName = function (this: unknown, ...args: any[]) {
                const userObj = getUserObj(args);
                if (userObj && customNicknames[userObj.id] && settings.store.showInGuilds) {
                    return customNicknames[userObj.id];
                }

                return originalUseName.apply(this, args);
            };
        }
    },

    stop() {
        const store = RelationshipStore;

        if (store && originalGetNickname) {
            store.getNickname = originalGetNickname;
            originalGetNickname = null;
            store.emitChange();
        }

        const guildStore = GuildMemberStore;

        if (guildStore) {
            if (guildGetNickname) {
                guildStore.getNick = guildGetNickname;
                guildGetNickname = null;
            }
            if (guildGetMember) {
                guildStore.getMember = guildGetMember;
                guildGetMember = null;
            }
            if (guildGetMembers) {
                guildStore.getMembers = guildGetMembers;
                guildGetMembers = null;
            }
            guildStore.emitChange();
        }

        const NicknameUtils = findByProps("getName", "useName", "getNickname");

        if (NicknameUtils) {
            if (originalGetName) {
                NicknameUtils.getName = originalGetName;
                originalGetName = null;
            }
            if (originalGetNicknameOfModule) {
                NicknameUtils.getNickname = originalGetNicknameOfModule;
                originalGetNicknameOfModule = null;
            }
            if (originalUseName) {
                NicknameUtils.useName = originalUseName;
                originalUseName = null;
            }
        }
    }
});
