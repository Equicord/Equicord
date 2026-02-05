/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import customRPC from "@plugins/customRPC";
import { Devs, EquicordDevs, GUILD_ID, SUPPORT_CHANNEL_ID, SUPPORT_CHANNEL_IDS, VC_SUPPORT_CHANNEL_IDS } from "@utils/constants";
import { isAnyPluginDev } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { Alerts, ApplicationCommandIndexStore, NavigationRouter, UserStore } from "@webpack/common";

import { PluginButtons } from "./pluginButtons";
import { PluginCards } from "./pluginCards";

let clicked = false;

const settings = definePluginSettings({
    noMirroredCamera: {
        type: OptionType.BOOLEAN,
        description: "Prevents the camera from being mirrored on your screen",
        restartNeeded: true,
        default: false,
    },
    removeActivitySection: {
        type: OptionType.BOOLEAN,
        description: "Removes the activity section above member list",
        restartNeeded: true,
        default: false,
    },
    showYourOwnActivityButtons: {
        type: OptionType.BOOLEAN,
        description: "Discord hides your own activity buttons for some reason",
        restartNeeded: true,
        default: false,
    },
    noDefaultHangStatus: {
        type: OptionType.BOOLEAN,
        description: "Disable the default hang status when joining voice channels",
        restartNeeded: true,
        default: false,
    },
    refreshSlashCommands: {
        type: OptionType.BOOLEAN,
        description: "Refreshes Slash Commands to show newly added commands without restarting your client.",
        default: false,
    },
    forceRoleIcon: {
        type: OptionType.BOOLEAN,
        description: "Forces role icons to display next to messages in compact mode",
        restartNeeded: true,
        default: false
    }
});

export default definePlugin({
    name: "EquicordHelper",
    description: "Used to provide support, fix discord caused crashes, and other misc features.",
    authors: [Devs.thororen, EquicordDevs.nyx, EquicordDevs.Naibuu, EquicordDevs.keyages, EquicordDevs.SerStars, EquicordDevs.mart],
    required: true,
    settings,
    patches: [
        // Fixes Unknown Resolution/FPS Crashing
        {
            find: "Unknown resolution:",
            replacement: [
                {
                    match: /throw Error\(`Unknown resolution: \$\{(\i)\}`\)/,
                    replace: "return $1;"
                },
                {
                    match: /throw Error\(`Unknown frame rate: \$\{(\i)\}`\)/,
                    replace: "return $1;"
                }
            ]
        },
        // When focused on voice channel or group chat voice call
        {
            find: ".STATUS_WARNING_BACKGROUND})})",
            predicate: () => settings.store.noMirroredCamera,
            replacement: {
                match: /mirror:\i/,
                replace: "mirror:!1"
            },
        },
        // Popout camera when not focused on voice channel
        {
            find: "this.handleReady})",
            all: true,
            predicate: () => settings.store.noMirroredCamera,
            replacement: {
                match: /(\[\i\.\i\]:)\i/,
                replace: "$1!1"
            },
        },
        // Overriding css on Preview Camera/Change Video Background popup
        {
            find: ".PREVIEW_CAMERA_MODAL,",
            replacement: {
                match: /className:\i.\i,(?=children:\()/,
                replace: "$&style:{transform: \"scalex(1)\"},"
            },
            predicate: () => settings.store.noMirroredCamera
        },
        // Remove Activity Section above Member List
        {
            find: ".MEMBERLIST_CONTENT_FEED_TOGGLED,",
            predicate: () => settings.store.removeActivitySection,
            replacement: {
                match: /null==\i\|\|/,
                replace: "true||$&"
            },
        },
        {
            find: ".USER_PROFILE_ACTIVITY_BUTTONS),",
            predicate: () => settings.store.showYourOwnActivityButtons && !isPluginEnabled(customRPC.name),
            replacement: {
                match: /.getId\(\)===\i.id/,
                replace: "$& && false"
            }
        },
        // No Default Hang Status
        {
            find: ".CHILLING)",
            predicate: () => settings.store.noDefaultHangStatus,
            replacement: {
                match: /{enableHangStatus:(\i),/,
                replace: "{_enableHangStatus:$1=false,"
            }
        },
        // Always show open legacy settings
        {
            find: ".DEVELOPER_SECTION,",
            replacement: [
                {
                    match: /\i\.\i\.isDeveloper/,
                    replace: "true"
                },
            ]
        },
        // Force Role Icon
        {
            find: "Message Username",
            predicate: () => settings.store.forceRoleIcon,
            replacement: {
                match: /(?<=\}\):null\].{0,150}\?2:)0(?=\})/,
                replace: "1"
            }
        },
    ],
    renderMessageAccessory(props) {
        return (
            <>
                <PluginButtons message={props.message} />
                <PluginCards message={props.message} />
            </>
        );
    },
    flux: {
        async CHANNEL_SELECT({ channelId }) {
            const isSupportChannel = SUPPORT_CHANNEL_IDS.includes(channelId);
            if (!isSupportChannel) return;

            const selfId = UserStore.getCurrentUser()?.id;
            if (!selfId || isAnyPluginDev(selfId)) return;
            if (VC_SUPPORT_CHANNEL_IDS.includes(channelId) && !clicked) {
                return Alerts.show({
                    title: "Vencord Support Channel Warning",
                    body: "Before asking for help. Check updates and if this issue is actually caused by Equicord!",
                    confirmText: "Equicord Support",
                    onConfirm() {
                        NavigationRouter.transitionTo(`/channels/${GUILD_ID}/${SUPPORT_CHANNEL_ID}`);
                    },
                    cancelText: "Okay continue",
                    onCancel() {
                        clicked = true;
                    },
                });
            }
        },
    },
    commands: [
        {
            name: "refresh-commands",
            description: "Refresh Slash Commands",
            inputType: ApplicationCommandInputType.BUILT_IN,
            predicate: () => settings.store.refreshSlashCommands,
            execute: async (opts, ctx) => {
                try {
                    ApplicationCommandIndexStore.indices = {};
                    sendBotMessage(ctx.channel.id, { content: "Slash Commands refreshed successfully." });
                }
                catch (e) {
                    console.error("[refreshSlashCommands] Failed to refresh commands:", e);
                    sendBotMessage(ctx.channel.id, { content: "Failed to refresh commands. Check console for details." });
                }
            }
        }
    ]
});
