/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "../../styles.css";

import { Flex } from "@components/Flex";
import { openModal } from "@utils/modal";
import { Menu, showToast, Toasts } from "@webpack/common";
import { CategoryHandler } from "equicordplugins/personalBadges/utils/badge/data";

import { cl } from "../..";
import { IPBadgeCategory, IPersonalBadge } from "../../types";
import * as bUtil from "../../utils/badge";
import { DEFAULT_BADGE_CATEGORY_URL } from "../../utils/constants";
import { openJSONFile, somethingWentWrong } from "../../utils/misc";
import { CategoryModal } from "../modals/CategoryModal";


export const BadgeMenuItemLabel = (badge: IPersonalBadge) => (
    <Flex className={cl("flex-menu-item")}>
        <img
            style={bUtil.defineStyleProps(badge.squircle)}
            src={bUtil.defineImage(badge.image)}
            height={32}
            width={32}
        />
        {badge.tooltip ?? "No Tooltip"}
    </Flex>
);


export const CategoryMenuItemLabel = (category: IPBadgeCategory) => (
    <Flex className={cl("flex-menu-item")}>
        <img
            style={bUtil.defineStyleProps(true)}
            src={!category.icon || category.icon.trim() === "" ? DEFAULT_BADGE_CATEGORY_URL : category.icon}
            height={27}
            width={27}
        />
        {category.name}
    </Flex>
);


export const CategoryElement = (id: string, c_id: string | undefined) => (
    <Menu.MenuItem
        id={id}
        key={id}
        label={`${c_id ? "Edit" : "Create"} Category`}
        color="brand"
        action={() => openModal(props => <CategoryModal c_id={c_id} props={props} />)}
    />
);

export async function importCategory() {
    await openJSONFile(async (data: IPBadgeCategory) => {
        if (Array.isArray(data))
            data = data[0]; // well just in case

        if (!data.name) return;
        if (data.name.length > 20) data.name = data.name.substring(0, 20);

        const object = {
            id: "",
            icon: data.icon,
            name: data.name,
            badges: data.badges
        };

        if (await CategoryHandler.register(object)) {
            showToast(`Category "${data.name}" data has been imported, and registered. (This includes badges.)`, Toasts.Type.SUCCESS);
        } else somethingWentWrong();
    });
}

export const ImportCategoryElement = (id: string) => (
    <Menu.MenuItem
        id={id}
        key={id}
        label="Import Category"
        color="brand"
        action={async () => await importCategory()}
    />
);


export * from "./ManageBadges";
