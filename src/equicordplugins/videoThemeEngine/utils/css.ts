/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { parseHexColor, rgba } from "./colors";
import { type UiSettings, VIDEO_ID } from "./constants";

const OVERLAY_SELECTOR = '[class*="overlayBackground_"]';

export function buildVideoSizeCss(s: UiSettings): string {
    const pos = `${s.videoPositionX}% ${s.videoPositionY}%`;
    const scale = s.videoScale / 100;
    const base = `
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        pointer-events: none !important;
        object-position: ${pos} !important;
    `;

    switch (s.videoSizeMode as string) {
        case "contain":
            return base + `
                width: 100% !important; height: 100% !important;
                min-width: unset !important; min-height: unset !important;
                transform: translate(-50%, -50%) !important;
                object-fit: contain !important;
            `;
        case "fill":
            return base + `
                width: 100% !important; height: 100% !important;
                min-width: unset !important; min-height: unset !important;
                transform: translate(-50%, -50%) !important;
                object-fit: fill !important;
            `;
        case "scale-down":
            return base + `
                max-width: 100% !important; max-height: 100% !important;
                width: auto !important; height: auto !important;
                min-width: unset !important; min-height: unset !important;
                transform: translate(-50%, -50%) !important;
                object-fit: scale-down !important;
            `;
        case "width-fit":
            return base + `
                width: 100% !important; height: auto !important;
                min-width: unset !important; min-height: unset !important;
                transform: translate(-50%, -50%) !important;
                object-fit: cover !important;
            `;
        case "height-fit":
            return base + `
                height: 100% !important; width: auto !important;
                min-width: unset !important; min-height: unset !important;
                transform: translate(-50%, -50%) !important;
                object-fit: cover !important;
            `;
        case "custom-percent":
            return base + `
                width: ${s.videoWidthPercent}% !important;
                height: ${s.videoHeightPercent}% !important;
                min-width: unset !important; min-height: unset !important;
                transform: translate(-50%, -50%) !important;
                object-fit: cover !important;
            `;
        case "custom-zoom":
            return base + `
                width: 100% !important; height: 100% !important;
                min-width: 100% !important; min-height: 100% !important;
                transform: translate(-50%, -50%) scale(${scale}) !important;
                object-fit: cover !important;
            `;
        case "native":
            return base + `
                width: auto !important; height: auto !important;
                min-width: unset !important; min-height: unset !important;
                max-width: 100vw !important; max-height: 100vh !important;
                transform: translate(-50%, -50%) !important;
                object-fit: none !important;
            `;
        case "viewport":
            return base + `
                width: 100vw !important; height: 100vh !important;
                min-width: unset !important; min-height: unset !important;
                transform: translate(-50%, -50%) !important;
                object-fit: cover !important;
            `;
        default:
            return base + `
                min-width: 100% !important; min-height: 100% !important;
                width: auto !important; height: auto !important;
                transform: translate(-50%, -50%) !important;
                object-fit: cover !important;
            `;
    }
}

export function buildStructuralTransparencyCss(): string {
    const panelExclude = [
        '[class*="guilds_"]',
        '[class*="sidebar_"]',
        '[class*="membersWrap_"]',
        '[class*="chatContent_"]',
        '[class*="channelTextArea_"]',
        '[class*="titleBar_"]',
        '[class*="toolbar_"]',
    ].join(", ");

    return `
        html, body, #app-mount,
        #app-mount [class*="typeWindows_"],
        #app-mount [class*="app_"],
        #app-mount [class*="layers_"],
        #app-mount [class*="page_"],
        #app-mount [class*="panels_"],
        #app-mount [class*="standardSidebarView_"],
        #app-mount [class*="wrapper_"]:not(${panelExclude}),
        #app-mount [class*="container_"]:not([class*="layerContainer_"]):not(${panelExclude}),
        #app-mount [class*="bg_"],
        #app-mount [class*="content_"]:not(${panelExclude}),
        #app-mount [class*="messagesWrapper_"],
        #app-mount [class*="overlayBackground_"],
        #app-mount [class*="sidebar_"] [class*="scroller_"],
        #app-mount [class*="membersWrap_"] [class*="scroller_"],
        #app-mount [class*="chatContent_"] [class*="scroller_"] {
            background: transparent !important;
            background-color: transparent !important;
            background-image: none !important;
        }
    `;
}

export function buildUiCss(s: UiSettings): string {
    const msgShadow = s.textShadowEnabled
        ? `0 ${s.textShadowOffsetY}px ${s.textShadowBlur}px ${parseHexColor(s.textShadowColor, "#000000")}`
        : "none";

    const videoFilter = [
        `brightness(${s.videoBrightness}%)`,
        `contrast(${s.videoContrast}%)`,
        `saturate(${s.videoSaturation}%)`,
        s.videoBlur > 0 ? `blur(${s.videoBlur}px)` : "",
    ].filter(Boolean).join(" ");

    const chatBg = rgba(s.chatBgColor, s.chatBgOpacity);
    const sidebarBg = rgba(s.sidebarBgColor, s.sidebarBgOpacity);
    const serverBg = rgba(s.serverListBgColor, s.serverListBgOpacity);
    const memberBg = rgba(s.memberListBgColor, s.memberListBgOpacity);
    const inputBg = rgba(s.inputBgColor, s.inputBgOpacity);
    const titleBg = rgba(s.titleBarBgColor, s.titleBarBgOpacity);
    const globalOverlay = rgba(s.globalOverlayColor, s.globalOverlayOpacity);
    const primaryBg = s.stripDiscordOverlays ? "transparent" : globalOverlay;

    return `
        :root, #app-mount, .theme-dark, .theme-light {
            --var-opacity-option: 0 !important;
            --var-opacity-inner-messages: ${s.chatBgOpacity / 100} !important;
            --var-opacity-left-sidebar: ${s.sidebarBgOpacity / 100} !important;
            --var-opacity-right-sidebar: ${s.memberListBgOpacity / 100} !important;
            --var-opacity-titlebar: ${s.titleBarBgOpacity / 100} !important;
            --var-opacity-bottom-input: ${s.inputBgOpacity / 100} !important;
            --bg-overlay-app-frame: ${s.stripDiscordOverlays ? "transparent" : globalOverlay} !important;
            --bg-overlay-1: transparent !important;
            --bg-overlay-2: transparent !important;
            --bg-overlay-3: ${s.stripDiscordOverlays ? "transparent" : globalOverlay} !important;
            --bg-overlay-4: transparent !important;
            --bg-overlay-5: transparent !important;
            --bg-overlay-6: transparent !important;
            --bg-overlay-selected: transparent !important;
            --background-primary: ${primaryBg} !important;
            --background-secondary: transparent !important;
            --background-secondary-alt: transparent !important;
            --background-tertiary: transparent !important;
            --background-accent: transparent !important;
            --background-floating: transparent !important;
            --background-nested-floating: transparent !important;
            --background-base-lowest: transparent !important;
            --background-base-lower: transparent !important;
            --background-base-lower-alt: transparent !important;
            --background-base-low: transparent !important;
            --background-base: transparent !important;
            --background-surface: transparent !important;
            --custom-app-background: transparent !important;
            --custom-app-background-overlay: transparent !important;
            --background-mobile-primary: transparent !important;
            --background-mobile-secondary: transparent !important;
            --home-background: transparent !important;
            --chat-background: transparent !important;
            --channeltextarea-background: ${inputBg} !important;
            --text-normal: ${parseHexColor(s.messageTextColor, "#ffffff")} !important;
            --text-muted: ${parseHexColor(s.messageMutedColor, "#b5bac1")} !important;
            --header-primary: ${parseHexColor(s.headerTextColor, "#ffffff")} !important;
            --header-secondary: ${parseHexColor(s.sidebarChannelNameColor, "#ffffff")} !important;
            --interactive-normal: ${parseHexColor(s.sidebarChannelNameColor, "#ffffff")} !important;
        }

        html, body, #app-mount { background: transparent !important; }

        body::before {
            display: ${s.hideBodyOverlay ? "none" : "block"} !important;
            background: transparent !important;
            opacity: ${s.globalOverlayOpacity / 100} !important;
        }

        ${s.stripDiscordOverlays ? buildStructuralTransparencyCss() : ""}

        #${VIDEO_ID} {
            opacity: ${s.videoOpacity / 100} !important;
            filter: ${videoFilter} !important;
            ${buildVideoSizeCss(s)}
        }

        #app-mount [class*="guilds_"] { background: ${serverBg} !important; background-color: ${serverBg} !important; }
        #app-mount [class*="sidebar_"] { background: ${sidebarBg} !important; background-color: ${sidebarBg} !important; }
        #app-mount [class*="membersWrap_"],
        #app-mount [class*="members_"]:not([class*="member_"]) {
            background: ${memberBg} !important; background-color: ${memberBg} !important;
        }
        #app-mount [class*="titleBar_"], #app-mount [class*="toolbar_"] { background: ${titleBg} !important; background-color: ${titleBg} !important; }
        #app-mount [class*="chatContent_"],
        #app-mount main[class*="chatContent_"] {
            background: ${chatBg} !important; background-color: ${chatBg} !important;
            backdrop-filter: blur(${s.chatBackdropBlur}px) !important;
            -webkit-backdrop-filter: blur(${s.chatBackdropBlur}px) !important;
            border-radius: ${s.panelBorderRadius}px !important;
        }
        #app-mount [class*="chatContent_"] [class*="scroller_"],
        #app-mount [class*="messagesWrapper_"],
        #app-mount [class*="chat_"] [class*="scroller_"] {
            background: ${rgba(s.chatBgColor, Math.min(100, s.chatBgOpacity + s.messageAreaExtraOpacity))} !important;
            background-color: ${rgba(s.chatBgColor, Math.min(100, s.chatBgOpacity + s.messageAreaExtraOpacity))} !important;
        }
        #app-mount [class*="channelTextArea_"], #app-mount [class*="scrollableContainer_"], #app-mount [class*="textArea_"] {
            background: ${inputBg} !important; background-color: ${inputBg} !important;
            border-radius: ${s.panelBorderRadius}px !important;
        }

        div[class*="markup_"], div[class*="messageContent_"] {
            color: ${parseHexColor(s.messageTextColor, "#ffffff")} !important;
            font-size: ${s.messageFontSize}px !important;
            font-weight: ${s.messageFontWeight} !important;
            text-shadow: ${msgShadow} !important;
            line-height: ${s.messageLineHeight} !important;
        }
        [class*="username_"], [class*="headerText_"] {
            font-size: ${s.headerFontSize}px !important;
            font-weight: ${s.headerFontWeight} !important;
            text-shadow: ${msgShadow} !important;
        }
        #app-mount [class*="sidebar_"] [class*="name_"],
        #app-mount [class*="sidebar_"] [class*="channelName_"],
        #app-mount [class*="sidebar_"] [class*="channel_"] [class*="name_"] {
            color: ${parseHexColor(s.sidebarChannelNameColor, "#ffffff")} !important;
            font-size: ${s.channelFontSize}px !important;
            text-shadow: ${msgShadow} !important;
        }
        #app-mount [class*="titleBar_"] [class*="channelName_"],
        #app-mount [class*="chatHeader_"] [class*="title_"],
        #app-mount [class*="subtitle_"] [class*="topic_"] {
            color: ${parseHexColor(s.channelTextColor, "#ffffff")} !important;
            font-size: ${s.channelFontSize}px !important;
            text-shadow: ${msgShadow} !important;
        }
        [class*="timestamp_"], [class*="edited_"] {
            color: ${parseHexColor(s.messageMutedColor, "#b5bac1")} !important;
            font-size: ${s.mutedFontSize}px !important;
        }
        [class*="slateTextArea_"], [class*="placeholder_"] {
            color: ${parseHexColor(s.inputTextColor, "#dbdee1")} !important;
            font-size: ${s.messageFontSize}px !important;
        }

        ${s.stripDiscordOverlays ? `
        ${OVERLAY_SELECTOR},
        #app-mount [class*="app_"],
        #app-mount [class*="bg_"],
        #app-mount [class*="layers_"] {
            background: transparent !important;
            background-color: transparent !important;
            background-image: none !important;
        }` : ""}

        [class*="layerContainer_"] [class*="modal_"],
        [class*="userPopout_"],
        [class*="menu_"],
        [class*="tooltip_"] {
            background: rgba(20, 20, 20, 0.92) !important;
        }
    `;
}

export function buildBaseCss(): string {
    return `
        html, body, #app-mount { background: transparent !important; }
        #app-mount { position: relative !important; z-index: 1 !important; }
    `;
}
