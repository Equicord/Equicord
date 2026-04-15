/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { Guild, User } from "@vencord/discord-types";
import { Menu, showToast, Toasts } from "@webpack/common";

import { IPBadgeCategory, IPersonalBadge } from "../../types";
import * as bUtil from "../../utils/badge";
import { BadgeHandler } from "../../utils/badge/data";
import { DEFAULT_BADGE_CATEGORY, PluginLogger } from "../../utils/constants";
import { BadgeMenuItemLabel, CategoryElement, CategoryMenuItemLabel, ImportCategoryElement } from ".";


export const addPatchContext_manageBadges = () => {
    addContextMenuPatch("user-context", userContextMenuPatch_manageBadges);
    addContextMenuPatch("guild-context", guildContextMenuPatch_manageBadges);
};

export const removePatchContext_manageBadges = () => {
    removeContextMenuPatch("user-context", userContextMenuPatch_manageBadges);
    removeContextMenuPatch("guild-context", guildContextMenuPatch_manageBadges);
};


export const userContextMenuPatch_manageBadges: NavContextMenuPatchCallback = (children, { user }: { user: User; }) => {
    if (!user?.id) return;

    const props = {
        ctx_id: "mb",
        grp_label: "Manage Badges"
    };

    const elements = baseContextMenuElements_manageBadges(props,

        async (category, badge) => {
            if (await bUtil.excludeBadge(user, category.id, badge.id))
                PluginLogger.info(`User ${user.id} was excluded from "${badge.tooltip}" (${badge.id}) via context menu.`);
        },

        async (category, badge) => {
            if (await bUtil.includeBadge(user, category.id, badge.id))
                PluginLogger.info(`User ${user.id} was included in "${badge.tooltip}" (${badge.id}) via context menu.`);
        }

    );

    children.push(<Menu.MenuSeparator />, elements);
};

export const guildContextMenuPatch_manageBadges: NavContextMenuPatchCallback = (children, { guild }: { guild: Guild; }) => {
    if (!guild?.id) return;

    const props = {
        ctx_id: "mgb",
        grp_label: "Manage Guild Badges"
    };

    const elements = baseContextMenuElements_manageBadges(props,

        async (category, badge) => {
            if (await bUtil.excludeGuildBadge(guild, category.id, badge.id))
                PluginLogger.info(`"${badge.tooltip}" (${badge.id}) was excluded from Guild ${guild.id} via context menu.`);
        },

        async (category, badge) => {
            if (await bUtil.includeGuildBadge(guild, category.id, badge.id))
                PluginLogger.info(`"${badge.tooltip}" (${badge.id}) was included in Guild ${guild.id} via context menu.`);
        }

    );

    children.push(<Menu.MenuSeparator />, elements);
};


const baseContextMenuElements_manageBadges = (props: { ctx_id: string, grp_label: string; }, excludeBadge: (c: IPBadgeCategory, b: IPersonalBadge) => any, includeBadge: (c: IPBadgeCategory, b: IPersonalBadge) => any) => {
    const ctx_id = `pb-${props.ctx_id}`;

    return (
        <Menu.MenuGroup
            label={props.grp_label}
        >

            <Menu.MenuItem
                id={`${ctx_id}-exclude-badge`}
                key={`${ctx_id}-exclude-badge`}
                label="Exclude Badge"
            >

                {CategoryElement(`${ctx_id}-eb-create-category`, undefined)}
                {ImportCategoryElement(`${ctx_id}-eb-import-category`)}

                <Menu.MenuSeparator />

                {Array.from(BadgeHandler.getCache().entries()).map((value, cIndex) => {
                    if (value[1].name === DEFAULT_BADGE_CATEGORY)
                        return (<></>);

                    const id = `${ctx_id}-eb-category-${cIndex}`;
                    const category = value[1];

                    return (
                        <Menu.MenuItem
                            id={id}
                            key={id}
                            label={CategoryMenuItemLabel(category)}
                        >
                            {CategoryElement(`${ctx_id}-eb-edit-category-${cIndex}`, category.id)}

                            <Menu.MenuSeparator />

                            {category.badges?.map((value, bIndex) => {
                                const id = `${ctx_id}-eb-c${cIndex}-badge-${bIndex}`;
                                const badge = value;

                                return (
                                    <Menu.MenuItem
                                        id={id}
                                        key={id}
                                        label={BadgeMenuItemLabel(badge)}
                                        action={async () => {
                                            await excludeBadge(category, badge);
                                            showToast(`Badge "${badge.tooltip}" has been excluded from this user.`, Toasts.Type.SUCCESS);
                                        }}
                                    />
                                );
                            })}
                        </Menu.MenuItem>
                    );
                })}

                <Menu.MenuSeparator />

                {Array.from(BadgeHandler.getCache().entries()).map(value => {
                    if (value[1].name !== DEFAULT_BADGE_CATEGORY)
                        return (<></>);

                    const category = value[1];

                    return (
                        <>
                            {category.badges?.map((value, bIndex) => {
                                const id = `${ctx_id}-eb-badge-${bIndex}`;
                                const badge = value;

                                return (
                                    <Menu.MenuItem
                                        id={id}
                                        key={id}
                                        label={BadgeMenuItemLabel(badge)}
                                        action={async () => {
                                            await excludeBadge(category, badge);
                                            showToast(`Badge "${badge.tooltip}" has been excluded from this user.`, Toasts.Type.SUCCESS);
                                        }}
                                    />
                                );
                            })}
                        </>
                    );
                })}

            </Menu.MenuItem>


            <Menu.MenuItem
                id={`${ctx_id}-include-badge`}
                key={`${ctx_id}-include-badge`}
                label="Include Badge"
            >

                {CategoryElement(`${ctx_id}-ib-create-category`, undefined)}
                {ImportCategoryElement(`${ctx_id}-ib-import-category`)}

                <Menu.MenuSeparator />

                {Array.from(BadgeHandler.getCache().entries()).map((value, cIndex) => {
                    if (value[1].name === DEFAULT_BADGE_CATEGORY)
                        return (<></>);

                    const id = `${ctx_id}-ib-category-${cIndex}`;
                    const category = value[1];

                    return (
                        <Menu.MenuItem
                            id={id}
                            key={id}
                            label={CategoryMenuItemLabel(category)}
                        >
                            {CategoryElement(`${ctx_id}-ib-edit-category-${cIndex}`, category.id)}

                            <Menu.MenuSeparator />

                            {category.badges?.map((value, bIndex) => {
                                const id = `${ctx_id}-ib-c${cIndex}-badge-${bIndex}`;
                                const badge = value;

                                return (
                                    <Menu.MenuItem
                                        id={id}
                                        key={id}
                                        label={BadgeMenuItemLabel(badge)}
                                        action={async () => {
                                            await includeBadge(category, badge);
                                            showToast(`Badge "${badge.tooltip}" has been included for this user.`, Toasts.Type.SUCCESS);
                                        }}
                                    />
                                );
                            })}
                        </Menu.MenuItem>
                    );
                })}

                <Menu.MenuSeparator />

                {Array.from(BadgeHandler.getCache().entries()).map(value => {
                    if (value[1].name !== DEFAULT_BADGE_CATEGORY)
                        return (<></>);

                    const category = value[1];

                    return (
                        <>
                            {category.badges?.map((value, bIndex) => {
                                const id = `${ctx_id}-ib-badge-${bIndex}`;
                                const badge = value;

                                return (
                                    <Menu.MenuItem
                                        id={id}
                                        key={id}
                                        label={BadgeMenuItemLabel(badge)}
                                        action={async () => {
                                            await includeBadge(category, badge);
                                            showToast(`Badge "${badge.tooltip}" has been included for this user.`, Toasts.Type.SUCCESS);
                                        }}
                                    />
                                );
                            })}
                        </>
                    );
                })}

            </Menu.MenuItem>

        </Menu.MenuGroup>
    );
};
