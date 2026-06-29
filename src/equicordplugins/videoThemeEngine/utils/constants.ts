/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const CONTAINER_ID = "vc-videothemeengine-container";
export const VIDEO_ID = "vc-videothemeengine-video";
export const VIDEO_STORE_KEY = "VideoThemeEngine_file";
export const SETTINGS_PREFIX = "plugins.VideoThemeEngine";
export const BASE_STYLE_ID = "vc-videothemeengine-base";
export const UI_STYLE_ID = "vc-videothemeengine-ui";

export const COLOR_SWATCHES = [
    "#ffffff", "#dbdee1", "#b5bac1", "#000000", "#1e1f22",
    "#2b2d31", "#5865f2", "#57f287", "#fee75c", "#ed4245",
    "#eb459e", "#00d4ff", "#ff6b35", "#8b5cf6", "#134e4a",
];

export type SizeModeId =
    | "cover"
    | "contain"
    | "fill"
    | "scale-down"
    | "width-fit"
    | "height-fit"
    | "viewport"
    | "custom-zoom"
    | "custom-percent"
    | "native";

export interface UiSettings {
    messageTextColor: string;
    messageMutedColor: string;
    headerTextColor: string;
    channelTextColor: string;
    sidebarChannelNameColor: string;
    inputTextColor: string;
    messageFontSize: number;
    headerFontSize: number;
    channelFontSize: number;
    mutedFontSize: number;
    messageFontWeight: string;
    headerFontWeight: string;
    messageLineHeight: number;
    chatBgColor: string;
    chatBgOpacity: number;
    sidebarBgColor: string;
    sidebarBgOpacity: number;
    serverListBgColor: string;
    serverListBgOpacity: number;
    memberListBgColor: string;
    memberListBgOpacity: number;
    inputBgColor: string;
    inputBgOpacity: number;
    titleBarBgColor: string;
    titleBarBgOpacity: number;
    messageAreaExtraOpacity: number;
    chatBackdropBlur: number;
    panelBorderRadius: number;
    textShadowEnabled: boolean;
    textShadowColor: string;
    textShadowBlur: number;
    textShadowOffsetY: number;
    videoBrightness: number;
    videoContrast: number;
    videoSaturation: number;
    videoOpacity: number;
    videoBlur: number;
    videoSizeMode: SizeModeId;
    videoScale: number;
    videoWidthPercent: number;
    videoHeightPercent: number;
    videoPositionX: number;
    videoPositionY: number;
    globalOverlayColor: string;
    globalOverlayOpacity: number;
    stripDiscordOverlays: boolean;
    hideBodyOverlay: boolean;
}

export const DEFAULT_UI_SETTINGS: UiSettings = {
    messageTextColor: "#ffffff",
    messageMutedColor: "#b5bac1",
    headerTextColor: "#ffffff",
    channelTextColor: "#ffffff",
    sidebarChannelNameColor: "#ffffff",
    inputTextColor: "#dbdee1",
    messageFontSize: 16,
    headerFontSize: 16,
    channelFontSize: 14,
    mutedFontSize: 12,
    messageFontWeight: "500",
    headerFontWeight: "600",
    messageLineHeight: 1.4,
    chatBgColor: "#000000",
    chatBgOpacity: 12,
    sidebarBgColor: "#000000",
    sidebarBgOpacity: 8,
    serverListBgColor: "#000000",
    serverListBgOpacity: 8,
    memberListBgColor: "#000000",
    memberListBgOpacity: 8,
    inputBgColor: "#000000",
    inputBgOpacity: 20,
    titleBarBgColor: "#000000",
    titleBarBgOpacity: 8,
    messageAreaExtraOpacity: 0,
    chatBackdropBlur: 2,
    panelBorderRadius: 0,
    textShadowEnabled: true,
    textShadowColor: "#000000",
    textShadowBlur: 4,
    textShadowOffsetY: 1,
    videoBrightness: 100,
    videoContrast: 100,
    videoSaturation: 100,
    videoOpacity: 100,
    videoBlur: 0,
    videoSizeMode: "cover" as const,
    videoScale: 100,
    videoWidthPercent: 100,
    videoHeightPercent: 100,
    videoPositionX: 50,
    videoPositionY: 50,
    globalOverlayColor: "#000000",
    globalOverlayOpacity: 0,
    stripDiscordOverlays: true,
    hideBodyOverlay: true,
};

export const VALID_SIZE_MODES = new Set<string>([
    "cover", "contain", "fill", "scale-down", "width-fit", "height-fit",
    "viewport", "custom-zoom", "custom-percent", "native",
]);

export const PRESET_IDS = [
    "default", "frosted-light", "midnight", "neon", "sunset", "high-contrast", "crystal",
] as const;

export type PresetId = (typeof PRESET_IDS)[number];

export const PRESET_VALUES: Record<string, Partial<UiSettings>> = {
    default: {},
    "frosted-light": {
        messageTextColor: "#000000", messageMutedColor: "#333333",
        headerTextColor: "#000000", channelTextColor: "#111111",
        sidebarChannelNameColor: "#111111",
        inputTextColor: "#1a1a1a",
        chatBgColor: "#ffffff", chatBgOpacity: 55,
        sidebarBgColor: "#ffffff", sidebarBgOpacity: 40,
        serverListBgColor: "#f2f3f5", serverListBgOpacity: 35,
        memberListBgColor: "#ffffff", memberListBgOpacity: 45,
        inputBgColor: "#ffffff", inputBgOpacity: 50,
        titleBarBgColor: "#ffffff", titleBarBgOpacity: 30,
        textShadowEnabled: false, chatBackdropBlur: 8, panelBorderRadius: 8,
    },
    midnight: {
        messageTextColor: "#e8eeff", messageMutedColor: "#8b9dc3",
        headerTextColor: "#ffffff", channelTextColor: "#c7d6ff",
        sidebarChannelNameColor: "#c7d6ff",
        inputTextColor: "#dce6ff",
        chatBgColor: "#0a1628", chatBgOpacity: 45,
        sidebarBgColor: "#0d1b2a", sidebarBgOpacity: 55,
        serverListBgColor: "#06101f", serverListBgOpacity: 60,
        memberListBgColor: "#0a1628", memberListBgOpacity: 50,
        inputBgColor: "#0f2038", inputBgOpacity: 55,
        titleBarBgColor: "#06101f", titleBarBgOpacity: 50,
        textShadowColor: "#000814", chatBackdropBlur: 6,
    },
    neon: {
        messageTextColor: "#00f5ff", messageMutedColor: "#7dd3fc",
        headerTextColor: "#e879f9", channelTextColor: "#c084fc",
        sidebarChannelNameColor: "#c084fc",
        inputTextColor: "#a5f3fc",
        chatBgColor: "#1a0533", chatBgOpacity: 35,
        sidebarBgColor: "#120428", sidebarBgOpacity: 45,
        memberListBgColor: "#1a0533", memberListBgOpacity: 40,
        inputBgColor: "#1e0a40", inputBgOpacity: 50,
        textShadowEnabled: true, textShadowColor: "#7c3aed", textShadowBlur: 8,
        videoSaturation: 130, videoContrast: 110, chatBackdropBlur: 4, panelBorderRadius: 6,
    },
    sunset: {
        messageTextColor: "#fff5eb", messageMutedColor: "#d4a574",
        headerTextColor: "#ffe4c4", channelTextColor: "#ffd6a5",
        sidebarChannelNameColor: "#ffd6a5",
        inputTextColor: "#ffe8d6",
        chatBgColor: "#2d1810", chatBgOpacity: 40,
        sidebarBgColor: "#1f1008", sidebarBgOpacity: 50,
        memberListBgColor: "#2d1810", memberListBgOpacity: 45,
        inputBgColor: "#3d2218", inputBgOpacity: 55,
        titleBarBgColor: "#1a0e08", titleBarBgOpacity: 45,
        textShadowColor: "#1a0a00", videoBrightness: 105, videoSaturation: 115, chatBackdropBlur: 3,
    },
    "high-contrast": {
        messageTextColor: "#ffffff", messageMutedColor: "#cccccc",
        headerTextColor: "#ffffff", channelTextColor: "#ffffff",
        sidebarChannelNameColor: "#ffffff",
        inputTextColor: "#ffffff",
        chatBgColor: "#000000", chatBgOpacity: 85,
        sidebarBgColor: "#000000", sidebarBgOpacity: 90,
        serverListBgColor: "#000000", serverListBgOpacity: 95,
        memberListBgColor: "#000000", memberListBgOpacity: 85,
        inputBgColor: "#111111", inputBgOpacity: 90,
        titleBarBgColor: "#000000", titleBarBgOpacity: 90,
        textShadowEnabled: true, textShadowColor: "#000000", textShadowBlur: 2,
        chatBackdropBlur: 0, stripDiscordOverlays: false, globalOverlayOpacity: 15,
    },
    crystal: {
        messageTextColor: "#ffffff", messageMutedColor: "#e0e0e0",
        headerTextColor: "#ffffff", channelTextColor: "#ffffff",
        sidebarChannelNameColor: "#ffffff",
        inputTextColor: "#f0f0f0",
        chatBgColor: "#000000", chatBgOpacity: 5,
        sidebarBgColor: "#000000", sidebarBgOpacity: 4,
        serverListBgColor: "#000000", serverListBgOpacity: 4,
        memberListBgColor: "#000000", memberListBgOpacity: 4,
        inputBgColor: "#000000", inputBgOpacity: 10,
        titleBarBgColor: "#000000", titleBarBgOpacity: 4,
        textShadowEnabled: true, textShadowColor: "#000000", textShadowBlur: 6,
        chatBackdropBlur: 1, stripDiscordOverlays: true, hideBodyOverlay: true, globalOverlayOpacity: 0,
    },
};

export const PRESET_LABELS: Record<PresetId, { name: string; desc: string; }> = {
    default: { name: "Default", desc: "Balanced dark theme with subtle panels." },
    "frosted-light": { name: "Frosted Light", desc: "Bright frosted glass panels with dark text." },
    midnight: { name: "Midnight", desc: "Deep blue tones with soft glow." },
    neon: { name: "Neon", desc: "Vivid cyberpunk colors and boosted video." },
    sunset: { name: "Sunset", desc: "Warm amber tones over the video." },
    "high-contrast": { name: "High Contrast", desc: "Opaque panels for maximum readability." },
    crystal: { name: "Crystal", desc: "Ultra-transparent panels over the video." },
};

export const SIZE_MODE_IDS = [
    "cover", "contain", "fill", "scale-down", "width-fit", "height-fit",
    "viewport", "custom-zoom", "custom-percent", "native",
] as const;

export const SIZE_MODE_LABELS: Record<SizeModeId, { name: string; desc: string; }> = {
    cover: { name: "Cover", desc: "Fill the screen, crop edges." },
    contain: { name: "Contain", desc: "Fit entire video, may letterbox." },
    fill: { name: "Stretch", desc: "Stretch to fill the screen." },
    "scale-down": { name: "Scale Down", desc: "Shrink large videos to fit." },
    "width-fit": { name: "Width Fit", desc: "Match screen width." },
    "height-fit": { name: "Height Fit", desc: "Match screen height." },
    viewport: { name: "Viewport", desc: "Exact viewport dimensions." },
    "custom-zoom": { name: "Custom Zoom", desc: "Scale with the zoom slider." },
    "custom-percent": { name: "Custom Size", desc: "Set width and height percent." },
    native: { name: "Native", desc: "Original video resolution." },
};

export const SLIDER_MARKERS = {
    videoBrightness: [0, 25, 50, 75, 100, 125, 150, 175, 200],
    videoContrast: [0, 25, 50, 75, 100, 125, 150, 175, 200],
    videoSaturation: [0, 25, 50, 75, 100, 125, 150, 175, 200],
    videoOpacity: [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100],
    videoBlur: [0, 1, 2, 3, 4, 5, 8, 10, 15, 20],
    videoScale: [50, 60, 70, 75, 80, 90, 100, 110, 120, 125, 150, 175, 200, 225, 250, 275, 300],
    videoWidthPercent: [25, 50, 75, 100, 125, 150, 175, 200],
    videoHeightPercent: [25, 50, 75, 100, 125, 150, 175, 200],
    videoPositionX: [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100],
    videoPositionY: [0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100],
    messageFontSize: [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32],
    headerFontSize: [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32],
    channelFontSize: [10, 11, 12, 13, 14, 15, 16, 18, 20],
    mutedFontSize: [10, 11, 12, 13, 14, 15, 16],
    messageLineHeight: [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2],
    chatBgOpacity: [0, 2, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100],
    sidebarBgOpacity: [0, 2, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100],
    serverListBgOpacity: [0, 2, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100],
    memberListBgOpacity: [0, 2, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100],
    inputBgOpacity: [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100],
    titleBarBgOpacity: [0, 2, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100],
    messageAreaExtraOpacity: [0, 5, 10, 15, 20, 25, 30],
    chatBackdropBlur: [0, 1, 2, 3, 4, 5, 8, 10, 15, 20],
    panelBorderRadius: [0, 2, 4, 6, 8, 10, 12, 16],
    textShadowBlur: [0, 1, 2, 3, 4, 5, 6, 8, 10],
    textShadowOffsetY: [0, 1, 2, 3, 4, 5],
    globalOverlayOpacity: [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100],
} as const satisfies Partial<Record<keyof UiSettings, readonly number[]>>;

export type SliderSettingKey = keyof typeof SLIDER_MARKERS;

export function getSliderMarkers(settingKey: SliderSettingKey): number[] {
    return [...SLIDER_MARKERS[settingKey]];
}

export function snapToNearestMarker(value: number, markers: readonly number[]): number {
    let best = markers[0];
    let bestDist = Math.abs(value - best);
    for (let i = 1; i < markers.length; i++) {
        const dist = Math.abs(value - markers[i]);
        if (dist < bestDist) {
            best = markers[i];
            bestDist = dist;
        }
    }
    return best;
}

export function snapSliderValue(settingKey: SliderSettingKey, value: number): number {
    return snapToNearestMarker(value, SLIDER_MARKERS[settingKey]);
}

export function formatSliderValue(settingKey: SliderSettingKey, value: number): string {
    const snapped = snapSliderValue(settingKey, value);
    if (settingKey === "messageLineHeight") {
        return Number.isInteger(snapped) ? String(snapped) : snapped.toFixed(1);
    }
    return String(snapped);
}
