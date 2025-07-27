/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { Devs } from "@utils/constants";
import { findByProps } from "@webpack";

export default definePlugin({
    name: "RemoveAgeCheck",
    description: "Bypasses age verification by setting ageVerificationStatus to 3.",
    authors: [Devs.HPsaucii],
    start() {
        // Find the UserStore with getCurrentUser
        const UserStore = findByProps("getCurrentUser");
        if (!UserStore) return;

        // Patch getCurrentUser to always set ageVerificationStatus = 3
        this.unpatch = UserStore.getCurrentUser
            ? UserStore.getCurrentUser = new Proxy(UserStore.getCurrentUser, {
                apply(target, thisArg, args) {
                    const user = Reflect.apply(target, thisArg, args);
                    if (user) user.ageVerificationStatus = 3;
                    return user;
                }
            })
            : null;

        // Set it immediately for the current user
        const user = UserStore.getCurrentUser?.();
        if (user) user.ageVerificationStatus = 3;
    },
    stop() {
        // Restore original getCurrentUser if patched
        if (this.unpatch && findByProps("getCurrentUser")) {
            findByProps("getCurrentUser").getCurrentUser = this.unpatch;
        }
    }
});
