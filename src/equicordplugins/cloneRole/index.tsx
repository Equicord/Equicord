/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUserSettingLazy } from "@api/UserSettings";
import { EquicordDevs } from "@utils/constants";
import { getCurrentGuild } from "@utils/discord";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import type { Guild, Role } from "@vencord/discord-types";
import { GuildRoleStore, GuildStore, Menu, PermissionStore, RestAPI, Toasts } from "@webpack/common";

const logger = new Logger("CloneRole");
const DeveloperMode = getUserSettingLazy("appearance", "developerMode")!;

interface CloneRoleBody {
    name: string;
    permissions: string;
    color: number;
    hoist: boolean;
    mentionable: boolean;
    icon?: string;
    unicode_emoji?: string;
}

export default definePlugin({
    name: "CloneRole",
    description: "Adds role context menu options to clone roles into servers where you can manage roles.",
    tags: ["Roles", "Servers"],
    authors: [EquicordDevs.bitweave],
    dependencies: ["UserSettingsAPI"],

    start() {
        DeveloperMode.updateSetting(true);
    },

    contextMenus: {
        "guild-settings-role-context"(children, { role }: { role?: Role; }) {
            if (!role) return;

            children.push(buildCloneRoleMenu(role));
        },
        "dev-context"(children, { id }: { id: string; }) {
            const guild = getCurrentGuild();
            if (!guild) return;

            const role = GuildRoleStore.getRole(guild.id, id);
            if (!role) return;

            children.push(buildCloneRoleMenu(role));
        },
    },
});

async function cloneRole(role: Role, targetGuild: Guild) {
    try {
        const body: CloneRoleBody = {
            name: role.name,
            permissions: role.permissions.toString(),
            color: role.color,
            hoist: role.hoist,
            mentionable: role.mentionable,
        };

        if ((targetGuild.premiumFeatures?.features.includes("ROLE_ICONS")) ?? false) {
            if (role.unicodeEmoji) body.unicode_emoji = role.unicodeEmoji;
            if (role.icon) {
                const url = `${location.protocol}//${window.GLOBAL_ENV.CDN_HOST}/role-icons/${role.id}/${role.icon}.png?size=128`;
                const response = await fetch(url);
                if (response.ok) {
                    const blob = await response.blob();
                    body.icon = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Failed to read role icon."));
                        reader.onerror = () => reject(new Error("Failed to read role icon."));
                        reader.readAsDataURL(blob);
                    });
                }
            }
        }

        await RestAPI.post({
            url: `/guilds/${targetGuild.id}/roles`,
            body,
        });

        Toasts.show({
            message: `Cloned ${role.name} to ${targetGuild.name}.`,
            type: Toasts.Type.SUCCESS,
            id: Toasts.genId(),
        });
    } catch (e: any) {
        let message = "Something went wrong (check console!)";
        try {
            message = JSON.parse(e.text).message;
        } catch { }

        logger.error("Failed to clone", role.name, "to", targetGuild.name, e);
        Toasts.show({
            message: "Failed to clone: " + message,
            type: Toasts.Type.FAILURE,
            id: Toasts.genId(),
        });
    }
}

function buildCloneRoleMenu(role: Role) {
    const guilds = Object.values(GuildStore.getGuilds())
        .filter(g => PermissionStore.getGuildPermissionProps(g).canManageRoles)
        .sort((a, b) => a.name.localeCompare(b.name));

    return (
        <Menu.MenuItem
            id="vc-clone-role"
            label="Clone Role"
            disabled={!guilds.length}
        >
            {guilds.length ? guilds.map(guild => (
                <Menu.MenuItem
                    key={guild.id}
                    id={`vc-clone-role-${guild.id}`}
                    label={guild.name}
                    action={() => cloneRole(role, guild)}
                />
            )) : (
                <Menu.MenuItem
                    id="vc-clone-role-no-guilds"
                    label="No servers available"
                    disabled
                />
            )}
        </Menu.MenuItem>
    );
}
