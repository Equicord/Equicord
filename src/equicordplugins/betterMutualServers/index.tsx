/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { Text } from "@components/Text";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { humanFriendlyJoin } from "@utils/text";
import definePlugin from "@utils/types";
import { Guild, User } from "@vencord/discord-types";
import { FluxDispatcher, GuildMemberStore, GuildRoleStore, moment, Tooltip, useEffect, UserProfileStore, useStateFromStores } from "@webpack/common";

const cl = classNameFactory("vc-bms-");

const MAX_ROLES = 2;

const requestedMembers = new Set<string>();

function requestMissingMembers(guildId: string, userId: string) {
    const mutualGuildIds = UserProfileStore.getMutualGuilds(userId)?.map(({ guild }) => guild.id) ?? [];

    const guildIds = [guildId, ...mutualGuildIds].filter(id => {
        const key = `${id}:${userId}`;
        if (requestedMembers.has(key) || GuildMemberStore.isMember(id, userId)) return false;
        requestedMembers.add(key);
        return true;
    });

    if (guildIds.length) FluxDispatcher.dispatch({ type: "GUILD_MEMBERS_REQUEST", guildIds, userIds: [userId] });
}

interface MemberDetailsProps {
    user: User;
    guild: Guild;
}

function MemberDetails({ user, guild }: MemberDetailsProps) {
    const member = useStateFromStores([GuildMemberStore], () => GuildMemberStore.getMember(guild.id, user.id), [guild.id, user.id]);
    const guildRoles = useStateFromStores([GuildRoleStore], () => GuildRoleStore.getSortedRoles(guild.id), [guild.id]);

    useEffect(() => {
        if (!member) requestMissingMembers(guild.id, user.id);
    }, [member, guild.id, user.id]);

    if (!member) return null;

    const roles = guildRoles.filter(role => member.roles.includes(role.id));
    const hiddenRoles = roles.slice(MAX_ROLES);

    return (
        <Text size="xs" weight="medium" className={cl("line")}>
            {member.joinedAt && <span className={cl("meta")}>Joined {moment(member.joinedAt).format("ll")}</span>}
            {roles.slice(0, MAX_ROLES).map(role => (
                <span key={role.id} className={cl("role")} title={role.name}>
                    <span className={cl("dot")} style={{ backgroundColor: role.colorString }} />
                    <span className={cl("name")}>{role.name}</span>
                </span>
            ))}
            {hiddenRoles.length > 0 && (
                <Tooltip text={humanFriendlyJoin(hiddenRoles, role => role.name)}>
                    {tooltipProps => <span {...tooltipProps} className={cl("meta")}>+{hiddenRoles.length}</span>}
                </Tooltip>
            )}
        </Text>
    );
}

export default definePlugin({
    name: "BetterMutualServers",
    description: "Shows roles and join dates in the Mutual Servers list.",
    tags: ["Roles", "Servers"],
    authors: [EquicordDevs.Z1xus],
    patches: [
        {
            find: "#{intl::USER_PROFILE_MUTUAL_GUILD_GO_TO_SERVER_A11Y_LABEL}",
            replacement: {
                match: /(?<=\{delay:(?:\i\.\i|300),children:\i\}\)\}\))(?=\]\}\))/,
                replace: ",$self.MemberDetails(arguments[0])"
            }
        }
    ],

    flux: {
        CONNECTION_OPEN() {
            requestedMembers.clear();
        }
    },

    MemberDetails: ErrorBoundary.wrap(MemberDetails, { noop: true })
});
