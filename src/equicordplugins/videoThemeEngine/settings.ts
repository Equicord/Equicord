/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import {
    BackgroundColorsPanel,
    ChannelNamesPanel,
    EffectColorsPanel,
    EffectsPanel,
    GlobalPanel,
    PanelOpacityPanel,
    TextColorsPanel,
    ThemePresetsPanel,
    TypographyPanel,
    UiResetPanel,
    VideoFiltersPanel,
    VideoPickerPanel,
    VideoSizePanel,
    VideoSizeSlidersPanel,
} from "./components/panels";
import {
    DEFAULT_UI_SETTINGS,
    getSliderMarkers,
    SLIDER_MARKERS,
    type SliderSettingKey,
    snapToNearestMarker,
    VALID_SIZE_MODES,
} from "./utils/constants";

export const settings = definePluginSettings({
    localVideoPath: { type: OptionType.STRING, default: "", hidden: true, description: "" },
    videoPicker: { type: OptionType.COMPONENT, component: VideoPickerPanel },
    videoSizePanel: { type: OptionType.COMPONENT, component: VideoSizePanel },
    videoSizeSlidersPanel: { type: OptionType.COMPONENT, component: VideoSizeSlidersPanel },
    videoFiltersPanel: { type: OptionType.COMPONENT, component: VideoFiltersPanel },
    themePresetsPanel: { type: OptionType.COMPONENT, component: ThemePresetsPanel },
    textColorsPanel: { type: OptionType.COMPONENT, component: TextColorsPanel },
    channelNamesPanel: { type: OptionType.COMPONENT, component: ChannelNamesPanel },
    backgroundColorsPanel: { type: OptionType.COMPONENT, component: BackgroundColorsPanel },
    effectColorsPanel: { type: OptionType.COMPONENT, component: EffectColorsPanel },
    typographyPanel: { type: OptionType.COMPONENT, component: TypographyPanel },
    panelOpacityPanel: { type: OptionType.COMPONENT, component: PanelOpacityPanel },
    effectsPanel: { type: OptionType.COMPONENT, component: EffectsPanel },
    globalPanel: { type: OptionType.COMPONENT, component: GlobalPanel },
    uiResetPanel: { type: OptionType.COMPONENT, component: UiResetPanel },

    videoBrightness: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.videoBrightness, hidden: true, description: "", markers: getSliderMarkers("videoBrightness") },
    videoContrast: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.videoContrast, hidden: true, description: "", markers: getSliderMarkers("videoContrast") },
    videoSaturation: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.videoSaturation, hidden: true, description: "", markers: getSliderMarkers("videoSaturation") },
    videoOpacity: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.videoOpacity, hidden: true, description: "", markers: getSliderMarkers("videoOpacity") },
    videoBlur: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.videoBlur, hidden: true, description: "", markers: getSliderMarkers("videoBlur") },
    videoSizeMode: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.videoSizeMode, hidden: true, description: "" },
    videoScale: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.videoScale, hidden: true, description: "", markers: getSliderMarkers("videoScale") },
    videoWidthPercent: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.videoWidthPercent, hidden: true, description: "", markers: getSliderMarkers("videoWidthPercent") },
    videoHeightPercent: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.videoHeightPercent, hidden: true, description: "", markers: getSliderMarkers("videoHeightPercent") },
    videoPositionX: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.videoPositionX, hidden: true, description: "", markers: getSliderMarkers("videoPositionX") },
    videoPositionY: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.videoPositionY, hidden: true, description: "", markers: getSliderMarkers("videoPositionY") },
    messageTextColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.messageTextColor, hidden: true, description: "" },
    messageMutedColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.messageMutedColor, hidden: true, description: "" },
    headerTextColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.headerTextColor, hidden: true, description: "" },
    channelTextColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.channelTextColor, hidden: true, description: "" },
    sidebarChannelNameColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.sidebarChannelNameColor, hidden: true, description: "" },
    inputTextColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.inputTextColor, hidden: true, description: "" },
    messageFontSize: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.messageFontSize, hidden: true, description: "", markers: getSliderMarkers("messageFontSize") },
    headerFontSize: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.headerFontSize, hidden: true, description: "", markers: getSliderMarkers("headerFontSize") },
    channelFontSize: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.channelFontSize, hidden: true, description: "", markers: getSliderMarkers("channelFontSize") },
    mutedFontSize: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.mutedFontSize, hidden: true, description: "", markers: getSliderMarkers("mutedFontSize") },
    messageLineHeight: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.messageLineHeight, hidden: true, description: "", markers: getSliderMarkers("messageLineHeight") },
    messageFontWeight: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.messageFontWeight, hidden: true, description: "" },
    headerFontWeight: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.headerFontWeight, hidden: true, description: "" },
    chatBgColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.chatBgColor, hidden: true, description: "" },
    chatBgOpacity: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.chatBgOpacity, hidden: true, description: "", markers: getSliderMarkers("chatBgOpacity") },
    sidebarBgColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.sidebarBgColor, hidden: true, description: "" },
    sidebarBgOpacity: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.sidebarBgOpacity, hidden: true, description: "", markers: getSliderMarkers("sidebarBgOpacity") },
    serverListBgColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.serverListBgColor, hidden: true, description: "" },
    serverListBgOpacity: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.serverListBgOpacity, hidden: true, description: "", markers: getSliderMarkers("serverListBgOpacity") },
    memberListBgColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.memberListBgColor, hidden: true, description: "" },
    memberListBgOpacity: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.memberListBgOpacity, hidden: true, description: "", markers: getSliderMarkers("memberListBgOpacity") },
    inputBgColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.inputBgColor, hidden: true, description: "" },
    inputBgOpacity: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.inputBgOpacity, hidden: true, description: "", markers: getSliderMarkers("inputBgOpacity") },
    titleBarBgColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.titleBarBgColor, hidden: true, description: "" },
    titleBarBgOpacity: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.titleBarBgOpacity, hidden: true, description: "", markers: getSliderMarkers("titleBarBgOpacity") },
    messageAreaExtraOpacity: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.messageAreaExtraOpacity, hidden: true, description: "", markers: getSliderMarkers("messageAreaExtraOpacity") },
    chatBackdropBlur: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.chatBackdropBlur, hidden: true, description: "", markers: getSliderMarkers("chatBackdropBlur") },
    panelBorderRadius: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.panelBorderRadius, hidden: true, description: "", markers: getSliderMarkers("panelBorderRadius") },
    textShadowEnabled: { type: OptionType.BOOLEAN, default: DEFAULT_UI_SETTINGS.textShadowEnabled, hidden: true, description: "" },
    textShadowColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.textShadowColor, hidden: true, description: "" },
    textShadowBlur: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.textShadowBlur, hidden: true, description: "", markers: getSliderMarkers("textShadowBlur") },
    textShadowOffsetY: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.textShadowOffsetY, hidden: true, description: "", markers: getSliderMarkers("textShadowOffsetY") },
    globalOverlayColor: { type: OptionType.STRING, default: DEFAULT_UI_SETTINGS.globalOverlayColor, hidden: true, description: "" },
    globalOverlayOpacity: { type: OptionType.SLIDER, default: DEFAULT_UI_SETTINGS.globalOverlayOpacity, hidden: true, description: "", markers: getSliderMarkers("globalOverlayOpacity") },
    stripDiscordOverlays: { type: OptionType.BOOLEAN, default: DEFAULT_UI_SETTINGS.stripDiscordOverlays, hidden: true, description: "" },
    hideBodyOverlay: { type: OptionType.BOOLEAN, default: DEFAULT_UI_SETTINGS.hideBodyOverlay, hidden: true, description: "" },
});

function snapSliderSettings(): void {
    const s = settings.store as Record<string, unknown>;
    for (const key of Object.keys(SLIDER_MARKERS) as SliderSettingKey[]) {
        const markers = SLIDER_MARKERS[key];
        const current = Number(s[key]);
        if (!Number.isNaN(current)) {
            s[key] = snapToNearestMarker(current, markers);
        }
    }
}

export function migrateLegacySettings(): void {
    const s = settings.store as Record<string, unknown>;
    const legacyFit = s.videoObjectFit as string | undefined;
    if (legacyFit) {
        if (!s.videoSizeMode) {
            const map: Record<string, string> = { cover: "cover", contain: "contain", fill: "fill" };
            s.videoSizeMode = map[legacyFit] ?? "cover";
        }
        delete s.videoObjectFit;
    }
    if (!VALID_SIZE_MODES.has(String(s.videoSizeMode))) {
        s.videoSizeMode = DEFAULT_UI_SETTINGS.videoSizeMode;
    }
    if (!s.sidebarChannelNameColor) {
        s.sidebarChannelNameColor = s.channelTextColor ?? DEFAULT_UI_SETTINGS.sidebarChannelNameColor;
    }
    delete s.usernameColor;
    snapSliderSettings();
}
