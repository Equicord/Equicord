/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ApplicationCommandInputType, ApplicationCommandOptionType, commands, findOption, registerCommand, sendBotMessage, unregisterCommand } from "@api/Commands";
import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { Divider } from "@components/Divider";
import { ErrorCard } from "@components/ErrorCard";
import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { openPluginModal } from "@components/settings";
import { Devs } from "@utils/constants";
import { isTruthy } from "@utils/guards";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { Activity } from "@vencord/discord-types";
import { ActivityType } from "@vencord/discord-types/enums";
import { findByCodeLazy, findComponentByCodeLazy } from "@webpack";
import { ApplicationAssetUtils, Button, FluxDispatcher, React, UserStore } from "@webpack/common";

import { RPCSettings } from "./RpcSettings";

const logger = new Logger("CustomRPC");

const useProfileThemeStyle = findByCodeLazy("profileThemeStyle:", "--profile-gradient-primary-color");
const ActivityView = findComponentByCodeLazy(".party?(0", "USER_PROFILE_ACTIVITY");

const ShowCurrentGame = getUserSettingLazy<boolean>("status", "showCurrentGame");

export const TimestampMode = {
    // Values are stored in presets, so don't renumber these
    NONE: 0,
    NOW: 1,
    TIME: 2,
    CUSTOM: 3,
} as const;
export type TimestampMode = typeof TimestampMode[keyof typeof TimestampMode];

export interface RpcConfig {
    appID?: string;
    appName?: string;
    details?: string;
    detailsURL?: string;
    state?: string;
    stateURL?: string;
    type?: ActivityType;
    streamLink?: string;
    timestampMode?: TimestampMode;
    startTime?: number;
    endTime?: number;
    imageBig?: string;
    imageBigURL?: string;
    imageBigTooltip?: string;
    imageSmall?: string;
    imageSmallURL?: string;
    imageSmallTooltip?: string;
    buttonOneText?: string;
    buttonOneURL?: string;
    buttonTwoText?: string;
    buttonTwoURL?: string;
    partySize?: number;
    partyMaxSize?: number;
}

export interface RpcPreset {
    name: string;
    config: RpcConfig;
}

export const PRESETS_KEY = "CustomRPC_presets";
// Separate from the plugin toggle: off survives reboots, toggling the plugin resets it
const OFF_KEY = "CustomRPC_off";

export const settings = definePluginSettings({
    config: {
        type: OptionType.COMPONENT,
        component: RPCSettings
    },
}).withPrivateSettings<RpcConfig>();

export function getCurrentConfig(): RpcConfig {
    const { config, ...rpcConfig } = settings.store as typeof settings.store & { enabled?: unknown };
    const snapshot = { ...rpcConfig };
    // The on/off toggle lives in the same object as the config, keep it out of presets
    delete snapshot.enabled;
    return snapshot;
}

async function getApplicationAsset(key: string): Promise<string | undefined> {
    const { appID } = settings.store;
    if (!appID) return undefined;
    return (await ApplicationAssetUtils.fetchAssetIds(appID, [key]))[0];
}

async function createActivity(): Promise<Activity | undefined> {
    const {
        appID,
        appName,
        details,
        detailsURL,
        state,
        stateURL,
        type,
        streamLink,
        startTime,
        endTime,
        imageBig,
        imageBigURL,
        imageBigTooltip,
        imageSmall,
        imageSmallURL,
        imageSmallTooltip,
        buttonOneText,
        buttonOneURL,
        buttonTwoText,
        buttonTwoURL,
        partyMaxSize,
        partySize,
        timestampMode
    } = settings.store;

    if (!appName) return;

    const activity: Activity = {
        application_id: appID || "0",
        name: appName,
        state,
        details,
        type: type ?? ActivityType.PLAYING,
        flags: 1 << 0,
    };

    if (type === ActivityType.STREAMING) activity.url = streamLink;

    switch (timestampMode) {
        case TimestampMode.NOW:
            activity.timestamps = {
                start: Date.now()
            };
            break;
        case TimestampMode.TIME:
            activity.timestamps = {
                start: Date.now() - (new Date().getHours() * 3600 + new Date().getMinutes() * 60 + new Date().getSeconds()) * 1000
            };
            break;
        case TimestampMode.CUSTOM:
            if (startTime || endTime) {
                activity.timestamps = {};
                if (startTime && endTime && endTime > startTime) {
                    const anchor = getLoopAnchor();
                    activity.timestamps.start = anchor;
                    activity.timestamps.end = anchor + (endTime - startTime);
                } else {
                    if (startTime) activity.timestamps.start = startTime;
                    if (endTime) activity.timestamps.end = endTime;
                }
            }
            break;
        case TimestampMode.NONE:
        default:
            break;
    }

    if (detailsURL) {
        activity.details_url = detailsURL;
    }

    if (stateURL) {
        activity.state_url = stateURL;
    }

    if (buttonOneText) {
        activity.buttons = [
            buttonOneText,
            buttonTwoText
        ].filter(isTruthy);

        activity.metadata = {
            button_urls: [
                buttonOneURL,
                buttonTwoURL
            ].filter(isTruthy)
        };
    }

    if (imageBig) {
        try {
            const largeImage = await getApplicationAsset(imageBig);
            if (largeImage) {
                activity.assets = {
                    large_image: largeImage,
                    large_text: imageBigTooltip || undefined,
                    large_url: imageBigURL || undefined
                };
            }
        } catch (e) {
            // One bad image key shouldn't take down the whole presence
            logger.warn("Failed to resolve large image, continuing without it", e);
        }
    }

    if (imageSmall) {
        try {
            const smallImage = await getApplicationAsset(imageSmall);
            if (smallImage) {
                activity.assets = {
                    ...activity.assets,
                    small_image: smallImage,
                    small_text: imageSmallTooltip || undefined,
                    small_url: imageSmallURL || undefined
                };
            }
        } catch (e) {
            // Same deal, skip it and keep the rest of the presence
            logger.warn("Failed to resolve small image, continuing without it", e);
        }
    }

    if (partyMaxSize && partySize) {
        activity.party = {
            size: [partySize, partyMaxSize]
        };
    }

    for (const k in activity) {
        if (k === "type") continue;
        const v = activity[k];
        if (!v || v.length === 0)
            delete activity[k];
    }

    return activity;
}

export async function setRpc(disable?: boolean) {
    const activity: Activity | undefined = await createActivity();

    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE",
        // Discord expects an explicit null to clear, undefined just confuses it
        activity: !disable ? activity ?? null : null,
        socketId: "CustomRPC",
    });
}

let loopInterval: ReturnType<typeof setInterval> | undefined;
let loopAnchor = 0;

function getLoopAnchor() {
    return loopAnchor;
}

function startTimestampLoop() {
    const { timestampMode, startTime, endTime } = settings.store;
    if (timestampMode !== TimestampMode.CUSTOM || !startTime || !endTime) return;
    const duration = endTime - startTime;
    if (duration <= 0) return;

    stopTimestampLoop();
    loopAnchor = Date.now();

    loopInterval = setInterval(() => {

        if (Date.now() >= loopAnchor + duration) {
            loopAnchor = Date.now();
            setRpc();
        }
    }, 1000);
}

function stopTimestampLoop() {
    if (loopInterval !== undefined) {
        clearInterval(loopInterval);
        loopInterval = undefined;
    }
    loopAnchor = 0;
}

export function restartTimestampLoop() {
    stopTimestampLoop();
    startTimestampLoop();
}

async function isRpcOff() {
    try {
        return await DataStore.get<boolean>(OFF_KEY) ?? false;
    } catch (e) {
        logger.error("Failed to read off state", e);
        return false;
    }
}

async function applyStoredRpcState() {
    if (await isRpcOff()) return;
    restartTimestampLoop();
    setRpc();
}

export async function loadPresetByName(name: string) {
    const presets = await DataStore.get<RpcPreset[]>(PRESETS_KEY) ?? [];
    const preset = presets.find(preset => preset.name === name.trim());

    if (!preset) {
        return { ok: false as const, message: `Preset ${name} not found.` };
    }

    // The toggle lives next to the config in the store, pin it while we swap configs in
    const store = settings.store as typeof settings.store & { enabled?: boolean };
    const wasEnabled = store.enabled;
    const current = getCurrentConfig();
    for (const key of Object.keys(current) as (keyof RpcConfig)[])
        if (!(key in preset.config)) delete settings.store[key];
    Object.assign(settings.store, preset.config);
    store.enabled = wasEnabled;

    await DataStore.set(OFF_KEY, false);
    restartTimestampLoop();
    await setRpc();
    return { ok: true as const, message: `Loaded preset ${preset.name}.` };
}

export async function refreshPresetCommand() {
    let presets: RpcPreset[];
    try {
        presets = await DataStore.get<RpcPreset[]>(PRESETS_KEY) ?? [];
    } catch (e) {
        // Storage can hiccup at boot, still register so the command itself never goes missing
        logger.error("Failed to load presets, registering command without suggestions", e);
        presets = [];
    }

    if (commands.customrpc)
        unregisterCommand("customrpc");
    // Choices are frozen at registration, so rebuild the command whenever presets change
    registerCommand({
        name: "customrpc",
        description: "Manage the CustomRPC activity.",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [
            {
                name: "load",
                description: "Load a saved preset.",
                type: ApplicationCommandOptionType.SUB_COMMAND,
                options: [
                    {
                        name: "preset",
                        description: "The preset to load.",
                        type: ApplicationCommandOptionType.STRING,
                        required: true,
                        ...presets.length ? { choices: presets.map(preset => ({ name: preset.name, label: preset.name, value: preset.name })) } : {}
                    }
                ]
            },
            {
                name: "edit",
                description: "Open CustomRPC settings for editing.",
                type: ApplicationCommandOptionType.SUB_COMMAND,
                options: []
            },
            {
                name: "off",
                description: "Turn off the custom activity.",
                type: ApplicationCommandOptionType.SUB_COMMAND,
                options: []
            }
        ],

        execute: async (args, ctx) => {
            switch (args[0].name) {
                case "load": {
                    const name = findOption<string>(args[0].options, "preset", "");
                    const res = await loadPresetByName(name);
                    sendBotMessage(ctx.channel.id, { content: res.message });
                    break;
                }
                case "edit": {
                    openPluginModal(plugin);
                    sendBotMessage(ctx.channel.id, { content: "Opened CustomRPC settings." });
                    break;
                }
                case "off": {
                    await DataStore.set(OFF_KEY, true);
                    stopTimestampLoop();
                    await setRpc(true);
                    sendBotMessage(ctx.channel.id, { content: "Custom activity turned off." });
                    break;
                }
            }
        }
    }, "CustomRPC");
}

function ActivitySharingNotice() {
    if (!ShowCurrentGame) return null;
    const enabled = ShowCurrentGame.useSetting();
    if (enabled) return null;

    return (
        <ErrorCard
            className={classes(Margins.top16, Margins.bottom16)}
            style={{ padding: "1em" }}
        >
            <Heading>Notice</Heading>
            <Paragraph>Activity Sharing isn't enabled, people won't be able to see your custom rich presence!</Paragraph>

            <Button
                color={Button.Colors.TRANSPARENT}
                className={Margins.top8}
                onClick={() => ShowCurrentGame.updateSetting(true)}
            >
                Enable
            </Button>
        </ErrorCard>
    );
}

function SettingsAbout() {
    const [activity] = useAwaiter(createActivity, { fallbackValue: undefined, deps: Object.values(settings.store) });
    const { profileThemeStyle } = useProfileThemeStyle({});

    return (
        <>
            <ActivitySharingNotice />

            <Flex flexDirection="column" gap=".5em" className={Margins.top16}>
                <Paragraph>
                    Go to the <Link href="https://discord.com/developers/applications">Discord Developer Portal</Link> to create an application and
                    get the application ID.
                </Paragraph>
                <Paragraph>
                    Upload images in the Rich Presence tab to get the image keys.
                </Paragraph>
                <Paragraph>
                    If you want to use an image link, download your image and reupload the image to <Link href="https://imgur.com">Imgur</Link> and get the image link by right-clicking the image and selecting "Copy image address".
                </Paragraph>
                <Paragraph>
                    You can't see your own buttons on your profile, but everyone else can see it fine.
                </Paragraph>
                <Paragraph>
                    Some weird unicode text ("fonts" 𝖑𝖎𝖐𝖊 𝖙𝖍𝖎𝖘) may cause the rich presence to not show up, try using normal letters instead.
                </Paragraph>
            </Flex>

            <Divider className={Margins.top8} />

            <div style={{ width: "284px", ...profileThemeStyle, marginTop: 8, borderRadius: 8, background: "var(--background-mod-muted)" }}>
                {activity && <ActivityView
                    activity={activity}
                    user={UserStore.getCurrentUser()}
                    currentUser={UserStore.getCurrentUser()}
                />}
            </div>
        </>
    );
}

// Kept in a variable so the command can open our own settings modal
const plugin = definePlugin({
    name: "CustomRPC",
    description: "Add a fully customisable Rich Presence (Game status) to your Discord profile",
    tags: ["Activity", "Customisation"],
    authors: [Devs.captain, Devs.AutumnVN, Devs.nin0dev],
    dependencies: ["UserSettingsAPI", "CommandsAPI"],
    // This plugin's patch is not important for functionality, so don't require a restart
    requiresRestart: false,
    settings,

    start() {
        refreshPresetCommand();
        applyStoredRpcState();
    },
    stop() {
        if (commands.customrpc)
            unregisterCommand("customrpc");
        DataStore.set(OFF_KEY, false);
        setRpc(true);
        stopTimestampLoop();
    },

    // Discord hides buttons on your own Rich Presence for some reason. This patch disables that behaviour
    patches: [
        {
            find: ".USER_PROFILE_ACTIVITY_BUTTONS),",
            replacement: {
                match: /.getId\(\)===\i.id/,
                replace: "$& && false"
            },
        }
    ],

    settingsAboutComponent: SettingsAbout
});

export default plugin;
