/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { AudioPlayerInterface, createAudioPlayer } from "@api/AudioPlayer";
import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { HeaderBarButton } from "@api/HeaderBar";
import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { isPluginEnabled, plugins } from "@api/PluginManager";
import { definePluginSettings, migratePluginToSettings } from "@api/Settings";
import customRPC from "@plugins/customRPC";
import { Devs, EquicordDevs, GUILD_ID, SUPPORT_CHANNEL_ID, SUPPORT_CHANNEL_IDS, VC_SUPPORT_CHANNEL_IDS } from "@utils/constants";
import { isAnyPluginDev } from "@utils/misc";
import { ModalProps, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { StandingState } from "@vencord/discord-types/enums";
import { findByCodeLazy, findExportedComponentLazy, findStoreLazy } from "@webpack";
import { Alerts, ApplicationCommandIndexStore, NavigationRouter, React, SettingsRouter, UserStore, useStateFromStores } from "@webpack/common";
import { ComponentType } from "react";

import { PluginButtons } from "./pluginButtons";
import { PluginCards } from "./pluginCards";

migratePluginToSettings(true, "EquicordHelper", "NoBulletPoints", "noBulletPoints");
migratePluginToSettings(true, "EquicordHelper", "NoModalAnimation", "noModalAnimation");

let clicked = false;
let boopSound: AudioPlayerInterface;
let song: AudioPlayerInterface;

const SafetyHubStore = findStoreLazy("SafetyHubStore");
const fetchSafetyHub: () => Promise<void> = findByCodeLazy("SAFETY_HUB_FETCH_START");
const WarningIcon = findExportedComponentLazy("WarningIcon");
const ShieldIcon = findExportedComponentLazy("ShieldIcon");

const StandingConfig: Record<number, { label: string; hoverColor: string; Icon: ComponentType<any>; }> = {
    [StandingState.ALL_GOOD]: { label: "All good!", hoverColor: "var(--status-positive)", Icon: ShieldIcon },
    [StandingState.LIMITED]: { label: "Limited", hoverColor: "var(--status-warning)", Icon: WarningIcon },
    [StandingState.VERY_LIMITED]: { label: "Very limited", hoverColor: "var(--orange-345)", Icon: WarningIcon },
    [StandingState.AT_RISK]: { label: "At risk", hoverColor: "var(--status-danger)", Icon: WarningIcon },
    [StandingState.SUSPENDED]: { label: "Suspended", hoverColor: "var(--interactive-muted)", Icon: WarningIcon },
};

function assignSong(url: string, volume: number) {
    song?.delete();
    song = createAudioPlayer(url, { volume, preload: true, persistent: true });
    song.load();
}

function assignBoop(url: string, volume: number) {
    boopSound?.delete();
    boopSound = createAudioPlayer(url, { volume, preload: true, persistent: true });
    boopSound.load();
}

function syncSoggyPlayers() {
    if (!settings.store.enableSoggy) {
        boopSound?.delete();
        song?.delete();
        return;
    }

    assignBoop(settings.store.boopLink, settings.store.boopVolume * 100);
    assignSong(settings.store.songLink, settings.store.songVolume * 100);
}

const soggySettingNames = ["songVolume", "boopVolume", "tooltipText", "imageLink", "songLink", "boopLink"] as const;

function updateSoggySettingsVisibility(enabled: boolean) {
    const { options } = plugins[settings.pluginName] ?? {};
    if (!options) return;

    for (const settingName of soggySettingNames) {
        const { [settingName]: option } = options;
        if (!option || option.type === OptionType.CUSTOM) continue;
        option.hidden = !enabled;
    }
}

function StandingButton() {
    const standing = useStateFromStores([SafetyHubStore], () => SafetyHubStore.getAccountStanding());
    const isInitialized = useStateFromStores([SafetyHubStore], () => SafetyHubStore.isInitialized());
    const [hovered, setHovered] = React.useState(false);

    React.useEffect(() => {
        if (!isInitialized) fetchSafetyHub().catch(() => { });
    }, [isInitialized]);

    const config = StandingConfig[standing?.state] ?? StandingConfig[StandingState.ALL_GOOD];

    return (
        <div style={{ display: "contents" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <HeaderBarButton
                tooltip={config.label}
                position="bottom"
                icon={props => <config.Icon {...props} color={hovered ? config.hoverColor : "currentColor"} />}
                onClick={() => SettingsRouter.openUserSettings("my_account_panel")}
            />
        </div>
    );
}

function SoggyModal(props: ModalProps) {
    React.useEffect(() => {
        if (settings.store.songVolume === 0) return;
        song?.loop();
        return () => song?.stop();
    }, []);

    const boop = (e: React.MouseEvent<HTMLImageElement>) => {
        const { offsetX, offsetY } = e.nativeEvent;
        const region = { x: 155, y: 220, width: 70, height: 70 };

        if (
            settings.store.boopVolume !== 0
            && offsetX >= region.x
            && offsetX <= region.x + region.width
            && offsetY >= region.y
            && offsetY <= region.y + region.height
        ) {
            boopSound?.play();
        }
    };

    return (
        <ModalRoot {...props}>
            <img
                src={settings.store.imageLink}
                onClick={boop}
                style={{ display: "block" }}
            />
        </ModalRoot>
    );
}

function openSoggyModal() {
    openModal(props => <SoggyModal {...props} />);
}

function SoggyButton() {
    return (
        <HeaderBarButton
            tooltip={settings.store.tooltipText}
            icon={() => (
                <img
                    alt=""
                    src={settings.store.imageLink}
                    width={24}
                    height={24}
                    draggable={false}
                    style={{ pointerEvents: "none" }}
                />
            )}
            onClick={openSoggyModal}
            selected={false}
        />
    );
}

function HelperHeaderButtons() {
    const { accountStandingButton, enableSoggy } = settings.use(["accountStandingButton", "enableSoggy"]);

    return (
        <>
            {accountStandingButton ? <StandingButton /> : null}
            {enableSoggy ? <SoggyButton /> : null}
        </>
    );
}

const listener = async (channelId, msg) => {
    if (!settings.store.noBulletPoints) return;
    msg.content = textProcessing(msg.content);
};

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
    },
    accountStandingButton: {
        type: OptionType.BOOLEAN,
        description: "Show an account standing button in the header bar",
        restartNeeded: true,
        default: false,
    },
    restoreFileDownloadButton: {
        type: OptionType.BOOLEAN,
        description: "Adds back the Download button at the top right corner of files",
        restartNeeded: true,
        default: false
    },
    noBulletPoints: {
        type: OptionType.BOOLEAN,
        description: "Stops you from typing markdown bullet points (stinky)",
        restartNeeded: true,
        default: false
    },
    noModalAnimation: {
        type: OptionType.BOOLEAN,
        description: "Remove the 300ms long animation when opening or closing modals",
        restartNeeded: true,
        default: false
    },
    enableSoggy: {
        type: OptionType.BOOLEAN,
        description: "Enable Soggy in the header bar.",
        default: false,
        onChange() {
            updateSoggySettingsVisibility(settings.store.enableSoggy);
            syncSoggyPlayers();
        }
    },
    songVolume: {
        type: OptionType.SLIDER,
        description: "Volume of the song. Set to 0 to disable.",
        default: 0.25,
        markers: [0, 0.25, 0.5, 0.75, 1],
        stickToMarkers: false,
        hidden: true,
        onChange(newValue) {
            assignSong(settings.store.songLink, newValue * 100);
        }
    },
    boopVolume: {
        type: OptionType.SLIDER,
        description: "Volume of the boop sound.",
        default: 0.2,
        markers: [0, 0.25, 0.5, 0.75, 1],
        stickToMarkers: false,
        hidden: true,
        onChange(newValue) {
            assignBoop(settings.store.boopLink, newValue * 100);
        }
    },
    tooltipText: {
        type: OptionType.STRING,
        description: "Text shown when hovering over the Soggy button.",
        default: "the soggy",
        hidden: true
    },
    imageLink: {
        type: OptionType.STRING,
        description: "URL for the Soggy image used in the button and modal.",
        default: "https://equicord.org/assets/plugins/soggy/cat.png",
        hidden: true
    },
    songLink: {
        type: OptionType.STRING,
        description: "URL for the song played in the Soggy modal.",
        default: "https://github.com/Equicord/Equibored/raw/main/sounds/soggy/song.mp3?raw=true",
        hidden: true,
        onChange(newValue) {
            assignSong(newValue, settings.store.songVolume * 100);
        }
    },
    boopLink: {
        type: OptionType.STRING,
        description: "URL for the boop sound effect.",
        default: "https://github.com/Equicord/Equibored/raw/main/sounds/soggy/honk.wav?raw=true",
        hidden: true,
        onChange(newValue) {
            assignBoop(newValue, settings.store.boopVolume * 100);
        }
    },
});

export default definePlugin({
    name: "EquicordHelper",
    description: "Used to provide support, fix discord caused crashes, and other misc features.",
    authors: [
        Devs.thororen,
        EquicordDevs.nyx,
        EquicordDevs.Naibuu,
        EquicordDevs.keircn,
        EquicordDevs.SerStars,
        EquicordDevs.mart,
        EquicordDevs.omaw,
        Devs.Samwich,
        Devs.AutumnVN
    ],
    required: true,
    dependencies: ["AudioPlayerAPI"],
    settings,
    headerBarButton: {
        icon: ShieldIcon,
        render: HelperHeaderButtons,
    },
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
        // Show your own activity buttons because discord removes them for who knows why
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
        // Force Role Icon
        {
            find: "Message Username",
            predicate: () => settings.store.forceRoleIcon,
            replacement: {
                match: /(?<=\}\):null\].{0,150}\?2:)0(?=\})/,
                replace: "1"
            }
        },
        // Restore File Download Button
        {
            find: '"VISUAL_PLACEHOLDER":',
            predicate: () => settings.store.restoreFileDownloadButton,
            replacement: {
                match: /(\.downloadUrl,showDownload:)\i/,
                replace: "$1!0"
            }
        },
        // Removes Modal Animation
        {
            find: "DURATION_IN:",
            predicate: () => settings.store.noModalAnimation,
            replacement: {
                match: /300,/,
                replace: "0,",
            }
        },
        // Removes Modal Animation
        {
            find: 'backdropFilter:"blur(0px)"',
            predicate: () => settings.store.noModalAnimation,
            replacement: {
                match: /\?0:200/,
                replace: "?0:0",
            }
        },
        // Removes Modal Animation
        {
            find: '="ABOVE"',
            predicate: () => settings.store.noModalAnimation,
            replacement: {
                match: /\?\?300/,
                replace: "??0",
            }
        },
        // Removes Modal Animation
        {
            find: "renderLurkerModeUpsellPopout,position:",
            predicate: () => settings.store.noModalAnimation,
            replacement: {
                match: /200:300/g,
                replace: "0:0",
            },
        }
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
    ],
    start() {
        updateSoggySettingsVisibility(settings.store.enableSoggy);
        syncSoggyPlayers();

        if (settings.store.noBulletPoints) {
            addMessagePreSendListener(listener);
        }
    },
    stop() {
        boopSound?.delete();
        song?.delete();

        if (settings.store.noBulletPoints) {
            removeMessagePreSendListener(listener);
        }
    }
});

function textProcessing(text: string): string {
    return text.replace(/(^|\n)(\s*)([*+-])\s+/g, "$1$2\\$3 ");
}
