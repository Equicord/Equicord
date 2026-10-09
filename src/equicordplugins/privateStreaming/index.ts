/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings, migratePluginSetting } from "@api/Settings";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, type PluginNative, type PluginSettingBooleanDef, type PluginSettingComponentProps } from "@utils/types";
import { ApplicationStreamingStore, MediaEngineStore, React, showToast, StreamerModeStore, UserStore } from "@webpack/common";

import { matchesKeybind, validateKeybind } from "./keybind";
import { configurePrivacy, PrivacyMask, PrivateRegion, setPrivacyActive, startPrivacy, stopPrivacy, usePrivacyState, usePrivateTitleProps } from "./privacy";
import { portalContents, renderHost, startSurfaces, stopSurfaces } from "./surfaces";
import { blurOptions } from "./targets";

let started = false;
let startingShare = false;
let paused = false;
let available = false;
let captureProtected = false;
let activityState = "";
let protectionGeneration = 0;
let protectionTimer: ReturnType<typeof setTimeout> | undefined;
let lastError = "";
const logger = new Logger("PrivateStreaming");

migratePluginSetting("PrivateStreaming", "protectWindow", "viewerOnly");

const settings = definePluginSettings({
    globalSection: {
        type: OptionType.COMPONENT,
        component: SettingsSection,
        componentProps: { title: "Global", description: "Choose when both window hiding and blur can run." }
    },
    activation: {
        type: OptionType.SELECT,
        displayName: "When to activate",
        description: "Window hiding and blur follow this choice. Outside it, Discord appears normally in screenshots and captures.",
        options: [
            { label: "While I screen share in Discord", value: "stream", default: true },
            { label: "Screen share or Discord Streamer Mode", value: "streamer" },
            { label: "Always (including screenshots and OBS)", value: "always" }
        ],
        onChange: configure
    },
    windowSection: {
        type: OptionType.COMPONENT,
        component: SettingsSection,
        target: "DESKTOP",
        componentProps: { title: "Window hiding", description: "Keep your view clear and hide Discord's windows from supported captures while active." }
    },
    protectWindow: {
        type: OptionType.BOOLEAN,
        displayName: "Hide Discord windows",
        description: "Hide the client and its popout windows from supported Windows captures, only when the activation choice above applies.",
        default: true,
        target: "DESKTOP",
        onChange: configure
    },
    captureKeybind: {
        type: OptionType.STRING,
        displayName: "Show or hide Discord in captures",
        description: "Toggle window hiding while Discord is focused. During an active share, showing Discord also pauses blur. Outside activation, this changes the preference for next time. Leave blank to disable.",
        default: "Ctrl+Alt+P",
        target: "DESKTOP",
        isValid: (value): true | string => validateKeybind(value, settings.store.toggleKeybind),
        onChange: configure
    },
    protectionStatus: {
        type: OptionType.COMPONENT,
        target: "DESKTOP",
        component: ProtectionStatus
    },
    blurSection: {
        type: OptionType.COMPONENT,
        component: SettingsSection,
        componentProps: { title: "Blur", description: "Blur selected content when window hiding is off or unavailable. This blur is visible to you and your viewers. Area switches can keep an entire list or panel clear." }
    },
    blurEnabled: {
        type: OptionType.BOOLEAN,
        displayName: "Enable blur",
        description: "Allow content masking while active, including when Windows cannot hide the window.",
        default: true,
        onChange: configure
    },
    revealKey: {
        type: OptionType.SELECT,
        description: "Hold this key and hover an item to reveal it in blur mode. Revealed content is also visible to viewers.",
        options: [
            { label: "Shift (either side)", value: "Shift", default: true },
            { label: "Right Ctrl", value: "ControlRight" },
            { label: "Left Ctrl", value: "ControlLeft" },
            { label: "Left Alt", value: "AltLeft" }
        ],
        onChange: configure
    },
    blur: {
        type: OptionType.SLIDER,
        description: "Blur strength. Larger values obscure more detail.",
        default: 16,
        markers: [12, 16, 20, 24, 32],
        stickToMarkers: true,
        onChange: configure
    },
    opaque: {
        type: OptionType.BOOLEAN,
        description: "Hide completely instead of blurring, so image colors and silhouettes are hidden too.",
        default: false,
        onChange: configure
    },
    revealDelay: {
        type: OptionType.SLIDER,
        description: "Hover delay in milliseconds to avoid revealing items as the mouse passes over them.",
        default: 150,
        markers: [0, 150, 300, 500, 1000],
        stickToMarkers: true,
        onChange: configure
    },
    toggleKeybind: {
        type: OptionType.STRING,
        description: "Toggle blur while Discord is focused, for example Ctrl+Alt+B or F8. Turning blur off exposes content to viewers. Does not disable whole-window capture protection. Leave blank to disable.",
        default: "Ctrl+Alt+B",
        isValid: (value): true | string => validateKeybind(value, settings.store.captureKeybind),
        onChange: configure
    },
    ...Object.fromEntries<PluginSettingBooleanDef>(Object.entries(blurOptions).map(([key, option]) => [key, {
        type: OptionType.BOOLEAN,
        displayName: option.label,
        description: option.description,
        default: true,
        onChange: configure
    }])) as { [Key in keyof typeof blurOptions]: PluginSettingBooleanDef },
    blurOwnAccount: {
        type: OptionType.BOOLEAN,
        displayName: "Include my account panel",
        description: "Apply the selected name and avatar blur types to your own account panel.",
        default: false,
        onChange: configure
    }
});

function SettingsSection({ option }: PluginSettingComponentProps) {
    return React.createElement("section", null,
        React.createElement(HeadingSecondary, null, option.componentProps?.title),
        React.createElement(Paragraph, null, option.componentProps?.description));
}

function setProtectionMessage(message: string) {
    usePrivacyState.setState({ protectionMessage: message });
}

function ProtectionStatus() {
    const message = usePrivacyState(state => state.protectionMessage);
    return React.createElement("div", null,
        React.createElement(Paragraph, null, message));
}

function failProtection(message: string) {
    captureProtected = false;
    applyMasking();
    setProtectionMessage(`${message} ${settings.store.blurEnabled
        ? "Your selected blur settings follow the activation choice. Hold the reveal key and hover to peek."
        : "Content blur is disabled."}`);
    if (lastError === message) return;
    lastError = message;
    logger.error(message);
    showToast("Private Streaming: capture protection is unavailable. See plugin settings for details.", "failure");
}

function checkProtection(sharing: boolean, streamerMode: boolean) {
    const generation = ++protectionGeneration;
    clearTimeout(protectionTimer);
    if (!started) return;
    const requested = settings.store.protectWindow && available;
    if (!requested) {
        captureProtected = false;
        lastError = "";
        applyMasking();
        setProtectionMessage(!available
            ? "Inactive. Discord appears normally in screenshots and captures until your activation choice applies."
            : paused
                ? "Capture protection is off and blur is paused for this share. Discord can appear normally in captures."
                : "Window hiding is off. Your blur settings apply.");
    }
    const native = typeof VencordNative === "undefined" ? undefined
        : VencordNative.pluginHelpers.PrivateStreaming as PluginNative<typeof import("./native")> | undefined;
    if (IS_WEB) return;
    if (!native?.getProtectionStatus) {
        if (requested) failProtection("Fully restart Discord to load the new capture protection helper.");
        return;
    }
    if (requested && !captureProtected) setProtectionMessage("Checking Windows capture protection. Your blur settings apply until protection is confirmed.");
    protectionTimer = setTimeout(() => {
        if (generation !== protectionGeneration) return;
        protectionGeneration++;
        failProtection("The capture protection helper did not respond. Fully restart Discord.");
    }, 5000);
    native.getProtectionStatus(sharing, streamerMode).then(result => {
        if (generation !== protectionGeneration) return;
        clearTimeout(protectionTimer);
        if (result.version !== 6) {
            failProtection("Fully restart Discord to load the new capture protection helper.");
        } else if (!requested) {
            if (result.error) failProtection(result.error);
        } else if (result.error || !result.enabled || !result.protected) {
            failProtection(result.error || "Windows has not confirmed capture protection for this window. Try switching protection off and on.");
        } else {
            captureProtected = true;
            lastError = "";
            applyMasking();
            setProtectionMessage("Windows capture protection is on. Discord stays clear locally. Supported captures exclude its windows. Blur shortcuts do not turn this protection off.");
        }
    }).catch(() => {
        if (generation !== protectionGeneration) return;
        clearTimeout(protectionTimer);
        failProtection("The capture protection helper could not be reached. Fully restart Discord.");
    });
}

function syncState() {
    if (!started) return;
    const sharing = Boolean(ApplicationStreamingStore.getCurrentUserActiveStream())
        || MediaEngineStore.isScreenSharing() || MediaEngineStore.isScreenSharing("stream");
    if (sharing) startingShare = false;
    const { activation } = settings.store;
    const streamerMode = StreamerModeStore.enabled;
    available = startingShare || sharing || activation === "always"
        || (activation === "streamer" && streamerMode);
    if (!available) {
        paused = false;
        captureProtected = false;
    }
    const nextState = [startingShare || sharing, streamerMode, activation, settings.store.protectWindow].join(":");
    if (activityState !== nextState) {
        activityState = nextState;
        checkProtection(startingShare || sharing, streamerMode);
    }
    applyMasking();
}

function applyMasking() {
    setPrivacyActive(available && settings.store.blurEnabled && !paused && !captureProtected);
}

function refreshProtection() {
    activityState = "";
    syncState();
}

function toggleMasking(event: KeyboardEvent) {
    if (matchesKeybind(event, settings.store.captureKeybind)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (matchesKeybind(event, settings.store.toggleKeybind)) {
            showToast("Choose different shortcuts for capture protection and blur in PrivateStreaming settings.", "failure");
            return;
        }
        const protect = !settings.store.protectWindow;
        paused = available && !protect;
        settings.store.protectWindow = protect;
        showToast(!available
            ? (protect ? "Window hiding will activate with your chosen trigger." : "Window hiding is disabled.")
            : protect ? "Hiding Discord from captures." : "Discord can appear in captures.");
        return;
    }
    if (captureProtected || !available || !settings.store.blurEnabled || !matchesKeybind(event, settings.store.toggleKeybind)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    paused = !paused;
    syncState();
}

function configure() {
    configurePrivacy(privacyOptions());
    if (!settings.store.protectWindow) captureProtected = false;
    syncState();
}

function privacyOptions() {
    return { ...settings.store };
}

export default definePlugin({
    name: "PrivateStreaming",
    description: "Protects Discord windows from Windows screen capture, or blurs private content while sharing with Shift to peek.",
    authors: [EquicordDevs.ELJoOker],
    settings,
    Mask: PrivacyMask,
    Region: PrivateRegion,
    usePrivateTitleProps,
    renderHost,
    portalContents,
    patches: [
        {
            find: '.Fragment=Symbol.for("react.fragment"),',
            replacement: {
                match: /(\i)\.jsx=(\i),\1\.jsxs=\2/,
                replace: "$1.jsx=$1.jsxs=(type,props,key)=>$self.renderHost(type,props,key,$2)"
            }
        },
        {
            find: ".createRef=function(){return{current:null}}",
            replacement: {
                match: /(?<=\.createElement=function\(\i,\i,\i\)\{.{0,500})return (\i)\((\i),(\i),(\i)\)(?=\},\i\.createRef=)/,
                replace: "return $self.renderHost($2,$4,$3,$1,true)"
            }
        },
        {
            find: ".createPortal=function(",
            replacement: {
                match: /(\.createPortal=function\((\i),\i\)\{)/,
                replace: "$1$2=$self.portalContents($2);"
            }
        },
        {
            find: '"data-window-chrome":"true"',
            replacement: {
                match: /(function \i\((\i)\)\{)(?=let\{(?=[^}]{0,150}\bleading:)(?=[^}]{0,150}\btitle:)(?=[^}]{0,150}\btrailing:))/,
                replace: "$1$2=$self.windowTitleProps($2);"
            }
        },
        {
            find: ".flashQueue",
            replacement: {
                match: /(?<=\}\(\);)(?=\i\.useEffect\(\(\)=>\{let \i=(\i)===\i\.base;(\i)&&\i\|\|\(document\.title=\1\))/,
                replace: "[$1,$2]=$self.usePrivateTitleProps($1,$2);"
            }
        }
    ],

    windowTitleProps(props: { title: React.ReactNode; }) {
        if (props.title == null) return props;
        return {
            ...props,
            title: React.createElement(PrivateRegion, { area: "hideWindowTitle" }, React.createElement(PrivacyMask, { kind: "hideWindowTitle" }, props.title))
        };
    },

    start() {
        this.stop();
        started = true;
        window.addEventListener("keydown", toggleMasking, true);
        window.addEventListener("focus", refreshProtection);
        configurePrivacy(privacyOptions());
        startSurfaces();
        startPrivacy();
        ApplicationStreamingStore.addChangeListener(syncState);
        MediaEngineStore.addChangeListener(syncState);
        StreamerModeStore.addChangeListener(syncState);
        syncState();
        queueMicrotask(refreshProtection);
    },

    stop() {
        window.removeEventListener("keydown", toggleMasking, true);
        window.removeEventListener("focus", refreshProtection);
        protectionGeneration++;
        clearTimeout(protectionTimer);
        captureProtected = false;
        lastError = "";
        activityState = "";
        if (started && typeof VencordNative !== "undefined") {
            const native = VencordNative.pluginHelpers.PrivateStreaming as PluginNative<typeof import("./native")> | undefined;
            native?.getProtectionStatus?.(false, false).catch(() => logger.error("Could not clear streaming activity."));
        }
        ApplicationStreamingStore.removeChangeListener(syncState);
        MediaEngineStore.removeChangeListener(syncState);
        StreamerModeStore.removeChangeListener(syncState);
        stopPrivacy();
        stopSurfaces();
        started = false;
        startingShare = false;
        paused = available = false;
    },

    flux: {
        STREAM_START() {
            paused = false;
            startingShare = true;
            syncState();
        },
        STREAM_STOP() {
            startingShare = false;
            syncState();
        },
        STREAM_DELETE({ streamKey }: { streamKey: string; }) {
            if (streamKey?.split(":").at(-1) !== UserStore.getCurrentUser()?.id) return;
            startingShare = false;
            syncState();
        },
        LOGOUT() {
            startingShare = false;
            syncState();
        }
    }
});
