/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Clipboard, Menu, Toasts, UserProfileStore } from "@webpack/common";

function getProfileColors(userId) {
    try {
        const profile = UserProfileStore.getUserProfile(userId);

        if (profile && profile.themeColors && profile.themeColors.length >= 2) {
            const primaryColor = profile.themeColors[0].toString(16).padStart(6, "0");
            const secondaryColor = profile.themeColors[1].toString(16).padStart(6, "0");
            return { primaryColor, secondaryColor, source: "profile" };
        }

        // fallback to banner color
        const BannerCollector = document.querySelector(".banner__68edb[style*=\"background-color\"]");
        if (BannerCollector) {
            const style = BannerCollector.getAttribute("style");
            if (!style) return null;
            const bgColorMatch = style.match(/background-color:\s*(rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\))/i);

            if (bgColorMatch) {
                const [_, rgbColor, r, g, b] = bgColorMatch;

                const hexColor = (
                    (parseInt(r) << 16) +
                    (parseInt(g) << 8) +
                    parseInt(b)
                ).toString(16).padStart(6, "0");

                return {
                    primaryColor: hexColor,
                    secondaryColor: hexColor, // idk if i should even keep this since banner is just one color but whatever
                    source: "banner"
                };
            }
        }

        return null;
    } catch (e) {
        console.error("Failed to get profile colors:", e);
        return null;
    }
}

function hexToRGB(hex) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgb(${r},${g},${b})`;
}

function copyProfileColors(userId) {
    const colors = getProfileColors(userId);

    if (!colors) {
        Toasts.show({
            type: Toasts.Type.FAILURE,
            message: "No profile colors found!",
            id: Toasts.genId()
        });
        return;
    }

    const { primaryColor, secondaryColor, source } = colors;
    let formattedColors;

    // Formatting
    switch (settings.store.ColorSelector) {
        case "RGB":
            if (source === "banner") {
                formattedColors = `Banner-color ${hexToRGB(primaryColor)}`;
            } else {
                formattedColors = `Primary-color ${hexToRGB(primaryColor)}, Secondary-Color ${hexToRGB(secondaryColor)}`;
            }
            break;
        case "HEX":
        default:
            if (source === "banner") {
                formattedColors = `Banner-color #${primaryColor}`;
            } else {
                formattedColors = `Primary-color #${primaryColor}, Secondary-Color #${secondaryColor}`;
            }
            break;
    }

    try {
        Clipboard.copy(formattedColors);
        Toasts.show({
            type: Toasts.Type.BOOKMARK, // SUCCESS but changed to BOOKMARK because i felt like its better
            message: source === "banner"
                ? "Banner color copied to clipboard!"
                : "Profile colors copied to clipboard!",
            id: Toasts.genId()
        });
    } catch (e) {
        console.error("Failed to copy to clipboard:", e);
        Toasts.show({
            type: Toasts.Type.FAILURE,
            message: "Error copying colors!",
            id: Toasts.genId()
        });
    }
}

export function ColorIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="#94b3e4"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path d="M17,4H15.82A3,3,0,0,0,13,2H11A3,3,0,0,0,8.18,4H7A3,3,0,0,0,4,7V19a3,3,0,0,0,3,3H17a3,3,0,0,0,3-3V7A3,3,0,0,0,17,4ZM10,5a1,1,0,0,1,1-1h2a1,1,0,0,1,1,1V6H10Zm8,14a1,1,0,0,1-1,1H7a1,1,0,0,1-1-1V7A1,1,0,0,1,7,6H8V7A1,1,0,0,0,9,8h6a1,1,0,0,0,1-1V6h1a1,1,0,0,1,1,1Z" />
        </svg>
    );
}

// spawn in the context menu
const userContextMenuPatch: NavContextMenuPatchCallback = (children, { user }) => {
    if (!user) return;
    children.push(
        <Menu.MenuItem
            id="CopyProfileColors"
            icon={ColorIcon}
            label={<span style={{ color: "rgb(148, 179, 228)" }}>Copy Profile Colors</span>}
            action={() => copyProfileColors(user.id)}
        />
    );
};

const settings = definePluginSettings({
    ColorSelector: {
        description: "Allows you to pick between RGB and HEX color formats. (idk if this is even useful or will be used)",
        type: OptionType.SELECT,
        options: [
            {
                label: "RGB",
                value: "RGB",
                default: false
            },
            {
                label: "HEX",
                value: "HEX",
                default: true
            }
        ],
    }
});

export default definePlugin({
    name: "copyProfileColors",
    description: "A plugin to copy people's profile gradient colors to clipboard. Falls back to banner color if profile colors aren't available.",
    authors: [EquicordDevs.Crxa, EquicordDevs.Cortex], // Cortex is here because he showed me how to add icons <3
    settings,
    start() {
        addContextMenuPatch("user-context", userContextMenuPatch);
        addContextMenuPatch("user-profile-actions", userContextMenuPatch);
    },

    stop() {
        // bye bye menu options
        removeContextMenuPatch("user-context", userContextMenuPatch);
        removeContextMenuPatch("user-profile-actions", userContextMenuPatch);
    }
});
