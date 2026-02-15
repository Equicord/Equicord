/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 nin0dev
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { getUserSettingLazy } from "@api/UserSettings";
import { InfoIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { Devs } from "@utils/constants";
import { getCurrentChannel, getCurrentGuild } from "@utils/discord";
import { t } from "@utils/translation";
import definePlugin from "@utils/types";
import { GuildMember } from "@vencord/discord-types";
import { GuildMemberStore, GuildRoleStore, Menu, Parser } from "@webpack/common";

import { showInRoleModal } from "./RoleMembersModal";

const DeveloperMode = getUserSettingLazy("appearance", "developerMode")!;

function getMembersInRole(roleId: string, guildId: string) {
    const members = GuildMemberStore.getMembers(guildId);
    const membersInRole: GuildMember[] = [];
    members.forEach(member => {
        if (member.roles.includes(roleId)) {
            membersInRole.push(member);
        }
    });
    return membersInRole;
}

export default definePlugin({
    name: "InRole",
    description: t("inRole.description"),
    authors: [Devs.nin0dev],
    dependencies: ["UserSettingsAPI"],
    start() {
        DeveloperMode.updateSetting(true);
    },
    settingsAboutComponent: () => {
        return (
            <>
                <Paragraph style={{ fontSize: "1.2rem", marginTop: "15px", fontWeight: "bold" }}>{Parser.parse(t("inRole.limitations.title"))}</Paragraph>
                <Paragraph style={{ marginTop: "10px", fontWeight: "500" }} >{t("inRole.limitations.description")}</Paragraph>
                <Paragraph>• {t("inRole.limitations.offlineNotListed")}</Paragraph>
                <Paragraph>• {t("inRole.limitations.upTo100")}</Paragraph>
                <Paragraph>• {t("inRole.limitations.friendsAlwaysShown")}</Paragraph>
            </>
        );
    },

    commands: [
        {
            name: "inrole",
            description: t("inRole.commands.inrole"),
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "role",
                    description: t("inRole.commands.role"),
                    type: ApplicationCommandOptionType.ROLE,
                    required: true
                },
            ],
            execute: (args, ctx) => {
                if (!ctx.guild) {
                    return sendBotMessage(ctx.channel.id, { content: t("inRole.errors.makeSureServer") });
                }
                const role = args[0].value;
                showInRoleModal(getMembersInRole(role, ctx.guild.id), role, ctx.channel.id);
            }
        }
    ],
    contextMenus: {
        "dev-context"(children, { id }: { id: string; }) {
            const guild = getCurrentGuild();
            if (!guild) return;

            const channel = getCurrentChannel();
            if (!channel) return;

            const role = GuildRoleStore.getRole(guild.id, id);
            if (!role) return;

            children.push(
                <Menu.MenuItem
                    id="vc-view-inrole"
                    label={t("inRole.ui.viewMembers")}
                    action={() => {
                        showInRoleModal(getMembersInRole(role.id, guild.id), role.id, channel.id);
                    }}
                    icon={InfoIcon}
                />
            );
        },
        "message"(children, { message }: { message: any; }) {
            const guild = getCurrentGuild();
            if (!guild) return;

            const roleMentions = message.content.match(/<@&(\d+)>/g);
            if (!roleMentions?.length) return;

            const channel = getCurrentChannel();
            if (!channel) return;

            const roleIds = roleMentions.map(mention => mention.match(/<@&(\d+)>/)![1]);

            const role = GuildRoleStore.getRole(guild.id, roleIds);
            if (!role) return;

            children.push(
                <Menu.MenuItem
                    id="vc-view-inrole"
                    label={t("inRole.ui.viewMembers")}
                    action={() => {
                        showInRoleModal(getMembersInRole(role.id, guild.id), role.id, channel.id);
                    }}
                    icon={InfoIcon}
                />
            );
        }
    }
});
