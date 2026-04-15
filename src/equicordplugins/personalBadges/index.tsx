/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { openModal } from "@utils/modal";
import definePlugin from "@utils/types";

import { addPatchContext_manageBadges, importCategory, removePatchContext_manageBadges } from "./components/context";
import { BadgeModal } from "./components/modals/BadgeModal";
import { BadgeHandler, CategoryHandler } from "./utils/badge/data";
import { DEFAULT_BADGE_CATEGORY, DEFAULT_BADGE_CATEGORY_URL } from "./utils/constants";
import { pluginSettings } from "./utils/settings";


export const cl = classNameFactory("pb-");


export default definePlugin({
    name: "PersonalBadges",
    description: "Create profile badges that are exclusively visible to you through locally stored data.",
    authors: [{
        name: "YLohkuhl",
        id: 1204700402235478078n
    }],
    dependencies: ["BadgeAPI"],
    settings: pluginSettings,

    toolboxActions: {
        "Reinitialize Cache": async () => await BadgeHandler.re_init(),
        "Import Category": async () => await importCategory(),
        "Open Badge Modal": () => openModal(props => <BadgeModal {...props} />)
    },

    async start() {
        await BadgeHandler.init();
        await CategoryHandler.register({ id: "", name: DEFAULT_BADGE_CATEGORY, icon: DEFAULT_BADGE_CATEGORY_URL, badges: [] });

        addPatchContext_manageBadges();
    },
    stop() {
        removePatchContext_manageBadges();

        BadgeHandler.de_init();
    }
});
