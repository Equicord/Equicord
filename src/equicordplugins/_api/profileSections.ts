/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "ProfileSectionsAPI",
    description: "API to add sections near the 'Member Since' area of user profile panels.",
    authors: [Devs.thororen],
    patches: [
        // DM User Sidebar
        {
            find: "#{intl::PREMIUM_GIFTING_BUTTON}),action:",
            replacement: {
                match: /(#{intl::USER_PROFILE_MEMBER_SINCE}\),.{0,100}userId:(\i\.id)}\)}\))/,
                replace: "$1,Vencord.Api.ProfileSections.renderProfileSections({userId:$2,isSideBar:true})",
            }
        },
        // User Profile Modal
        {
            find: ",applicationRoleConnection:",
            replacement: {
                match: /(#{intl::USER_PROFILE_MEMBER_SINCE}\),.{0,100}userId:(\i\.id),.{0,100}}\)}\)),/,
                replace: "$1,Vencord.Api.ProfileSections.renderProfileSections({userId:$2,isSideBar:false}),",
            }
        },
        // User Profile Modal v2
        {
            find: ".MODAL_V2,onClose:",
            replacement: {
                match: /(#{intl::USER_PROFILE_MEMBER_SINCE}\),.{0,100}userId:(\i\.id),.{0,100}}\)}\)),/,
                replace: "$1,Vencord.Api.ProfileSections.renderProfileSections({userId:$2,isSideBar:false}),",
            }
        }
    ]
});
