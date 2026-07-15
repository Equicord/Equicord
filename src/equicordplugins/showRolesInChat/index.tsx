/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EyeIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { getCurrentGuild } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { User } from "@vencord/discord-types";
import { ChannelStore, ContextMenuApi, GuildMemberStore, GuildRoleStore, Menu, useStateFromStores } from "@webpack/common";
import type React from "react";

const cl = classNameFactory("vc-sric-");

const SETTINGS_KEYS: (keyof typeof settings.store)[] = ["showBots", "useRoleColor", "excludedRoles"];

const settings = definePluginSettings({
    showBots: {
        type: OptionType.BOOLEAN,
        description: "Whether to show the highest role on bots.",
        default: false
    },
    useRoleColor: {
        type: OptionType.BOOLEAN,
        description: "Use the role's color for the icon.",
        default: true
    }
}).withPrivateSettings<{ excludedRoles?: string[]; }>();

function getHighestRole(guildId: string, userId: string, excludedRoles?: string[]) {
    const roles = GuildMemberStore.getMember(guildId, userId)?.roles;
    if (!roles?.length) return null;

    return GuildRoleStore.getSortedRoles(guildId).find(r => roles.includes(r.id) && !excludedRoles?.includes(r.id));
}

function toggleRole(roleId: string) {
    const excluded = settings.store.excludedRoles ?? [];
    settings.store.excludedRoles = excluded.includes(roleId) ? excluded.filter(id => id !== roleId) : [...excluded, roleId];
}

function makeToggleRoleItem(roleId: string) {
    const isExcluded = settings.store.excludedRoles?.includes(roleId);
    return (
        <Menu.MenuItem
            id="toggle"
            icon={isExcluded ? EyeIcon : EyeSlashIcon}
            label={isExcluded ? "Show Role in Chat" : "Hide Role in Chat"}
            action={() => toggleRole(roleId)}
        />
    );
}

function EyeSlashIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="currentColor" d="M1.3 21.3a1 1 0 1 0 1.4 1.4l20-20a1 1 0 0 0-1.4-1.4l-20 20ZM3.16 16.05c.18.24.53.26.74.05l.72-.72c.18-.18.2-.45.05-.66a15.7 15.7 0 0 1-1.43-2.52.48.48 0 0 1 0-.4c.4-.9 1.18-2.37 2.37-3.72C7.13 6.38 9.2 5 12 5c.82 0 1.58.12 2.28.33.18.05.38 0 .52-.13l.8-.8c.25-.25.18-.67-.15-.79A9.79 9.79 0 0 0 12 3C4.89 3 1.73 10.11 1.11 11.7a.83.83 0 0 0 0 .6c.25.64.9 2.15 2.05 3.75Z" />
            <path fill="currentColor" d="M8.18 10.81c-.13.43.36.65.67.34l2.3-2.3c.31-.31.09-.8-.34-.67a4 4 0 0 0-2.63 2.63ZM12.85 15.15c-.31.31-.09.8.34.67a4.01 4.01 0 0 0 2.63-2.63c.13-.43-.36-.65-.67-.34l-2.3 2.3Z" />
            <path fill="currentColor" d="M9.72 18.67a.52.52 0 0 0-.52.13l-.8.8c-.25.25-.18.67.15.79 1.03.38 2.18.61 3.45.61 7.11 0 10.27-7.11 10.89-8.7a.83.83 0 0 0 0-.6c-.25-.64-.9-2.15-2.05-3.75a.49.49 0 0 0-.74-.05l-.72.72a.51.51 0 0 0-.05.66 15.7 15.7 0 0 1 1.43 2.52c.06.13.06.27 0 .4-.4.9-1.18 2.37-2.37 3.72C16.87 17.62 14.8 19 12 19c-.82 0-1.58-.12-2.28-.33Z" />
        </svg>
    );
}

function ShieldUserIcon({ color }: { color: string; }) {
    return (
        <svg className={cl("icon")} aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
            <path fill={color} d="M20.3 5.41h-.39c-.84 0-1.52-.65-1.52-1.46v-.3c0-.9-.77-1.65-1.71-1.65H7.31c-.94 0-1.71.74-1.71 1.65v.3c0 .81-.68 1.46-1.52 1.46H3.7c-.94 0-1.7.73-1.7 1.64v3.52l.01.49c.05 3.11.94 4.69 2.92 6.63C6.72 19.46 11.58 22 11.99 22c.41 0 5.27-2.54 7.06-4.31 1.98-1.95 2.92-3.53 2.92-6.63L22 7.05c0-.9-.76-1.64-1.7-1.64Zm-8.32.03a3.15 3.15 0 1 1-.01 6.3 3.15 3.15 0 0 1 .01-6.3Zm4.52 11.67c-.97.68-2.86 1.62-3.87 2.11-.42.2-.91.2-1.33 0a40.17 40.17 0 0 1-3.82-2.1.87.87 0 0 1-.37-.85c.42-2.69 2.46-3.21 4.89-3.21 2.43 0 4.4.68 4.87 3.08a.97.97 0 0 1-.38.98l.01-.01Z" />
        </svg>
    );
}

const HighestRoleIndicator = ErrorBoundary.wrap(({ user, channelId }: { user: User; channelId: string; }) => {
    const { showBots, useRoleColor, excludedRoles } = settings.use(SETTINGS_KEYS);

    const guildId = (!user.bot || showBots) ? ChannelStore.getChannel(channelId)?.guild_id : null;
    const role = useStateFromStores([GuildMemberStore, GuildRoleStore], () => guildId ? getHighestRole(guildId, user.id, excludedRoles) : null, [guildId, user.id, excludedRoles]);

    if (!guildId || !role) return null;

    const handleContextMenu = (e: React.MouseEvent) => {
        ContextMenuApi.openContextMenu(e, () => {
            const userRoles = GuildMemberStore.getMember(guildId, user.id)?.roles ?? [];
            const excluded = excludedRoles ?? [];
            const hiddenRoles = GuildRoleStore.getSortedRoles(guildId).filter(r => excluded.includes(r.id) && userRoles.includes(r.id));

            return (
                <Menu.Menu navId="vc-sric-context" onClose={ContextMenuApi.closeContextMenu} aria-label="Chat Role Actions">
                    <Menu.MenuGroup>
                        {makeToggleRoleItem(role.id)}

                        {hiddenRoles.length > 0 && (
                            <Menu.MenuItem id="unhide-menu" label="Unhide Roles in Chat">
                                {hiddenRoles.map(r => (
                                    <Menu.MenuItem
                                        key={r.id}
                                        id={`unhide-${r.id}`}
                                        label={r.name}
                                        action={() => toggleRole(r.id)}
                                    />
                                ))}
                            </Menu.MenuItem>
                        )}
                    </Menu.MenuGroup>
                </Menu.Menu>
            );
        });
    };

    return (
        <span className={cl("indicator")} onContextMenu={handleContextMenu}>
            <ShieldUserIcon color={(useRoleColor && role.colorString) || "currentColor"} />
            <span className={cl("name")}>
                {role.name}
            </span>
        </span>
    );
}, { noop: true });

export default definePlugin({
    name: "ShowRolesInChat",
    description: "Shows a user's highest role next to their name in chat messages. Hide/show specific roles in their context menu (right-click).",
    tags: ["Appearance", "Chat", "Roles", "Servers"],
    authors: [EquicordDevs.lucabeyer],
    settings,
    contextMenus: {
        "dev-context"(children, { id }: { id: string; }) {
            if (GuildRoleStore.getRole(getCurrentGuild()?.id ?? "", id)) {
                children.push(
                    <Menu.MenuGroup>
                        {makeToggleRoleItem(id)}
                    </Menu.MenuGroup>
                );
            }
        },
        "guild-settings-role-context"(children, props: { role: { id: string; }; }) {
            children.push(
                <Menu.MenuGroup>
                    {makeToggleRoleItem(props.role.id)}
                </Menu.MenuGroup>
            );
        }
    },
    renderMessageDecoration: ({ message }) => (
        <HighestRoleIndicator
            user={message.author}
            channelId={message.channel_id}
        />
    )
});
