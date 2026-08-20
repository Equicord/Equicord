/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 rini
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { DataStore } from "@api/index";
import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings, migratePluginSetting } from "@api/Settings";
import { TextButton } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Heading } from "@components/Heading";
import ircColors from "@plugins/ircColors";
import mentionAvatars from "@plugins/mentionAvatars";
import { Devs, EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/index";
import definePlugin, { OptionType } from "@utils/types";
import { GuildMember, Message, RenderModalProps, User } from "@vencord/discord-types";
import { findByCodeLazy, findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { AccessibilityStore, ChannelStore, GuildMemberStore, GuildStore, Menu, MessageStore, Modal, openModal, RelationshipStore, StreamerModeStore, TextInput, useEffect, UserStore, useState } from "@webpack/common";
import { JSX } from "react";

const SMYNC = classNameFactory();
const wrapEmojis = findByCodeLazy("lastIndex;return");

interface DisplayNameStyles {
    colors: number[];
    effectId: number;
    fontId: number;
}

interface UserNameWithEffectsProps {
    userName: string;
    displayNameStyles: DisplayNameStyles;
    effectDisplayType: number;
    textClassName?: string;
    loop?: boolean;
    shouldWrap?: boolean;
}

const UserNameWithEffects = findComponentByCodeLazy<UserNameWithEffectsProps>(
    "UserNameWithEffects",
    "--custom-display-name-styles-prism-cycle"
);

const DisplayNameEffectDisplayTypes: Record<"PLAIN" | "STATIC" | "ANIMATED", number> = findByPropsLazy("PLAIN", "STATIC", "ANIMATED");
const DisplayNameEffects: Record<"GRADIENT" | "GLOW" | "POP" | "GUMMY", number> = findByPropsLazy("SOLID", "GRADIENT", "NEON", "TOON", "POP", "GLOW", "PRISM", "GUMMY");
const DisplayNameFonts: Record<"DEFAULT", number> = findByPropsLazy("DEFAULT", "CHERRY_BOMB", "CHICLE", "MUSEO_MODERNO");

const roleColorPattern = /^role((?:\+|-)\d{0,4})?$/iu;
const symbolPattern = /^[\p{S}\p{P}]{1,3}$/iu;
const templatePattern = /(?:\{(?:custom|friend|nick|display|user)(?:,\s*(?:custom|friend|nick|display|user))*\})/iu;

type CustomNicknameData = Record<string, string>;
let customNicknames: CustomNicknameData = {};

let toCSSCache: Map<string, string | null> | null = null;
let toCSSProbe: HTMLDivElement | null = null;

function toCSS(color: string | number | null | undefined): string | null {
    if (color == null) return null;
    if (typeof color === "number") return `#${color.toString(16).padStart(6, "0")}`;
    if (!color) return null;

    const cached = toCSSCache?.get(color);
    if (cached !== undefined) return cached ?? null;

    if (!toCSSProbe) return null;

    toCSSProbe.style.color = "";
    toCSSProbe.style.color = color;
    const result = toCSSProbe.style.color !== "" ? color : null;
    toCSSCache?.set(color, result);
    return result;
}

let convertToRGBCanvas: HTMLCanvasElement | null = null;
let convertToRGBCtx: CanvasRenderingContext2D | null = null;
let convertToRGBCache: Map<string, [number, number, number] | null> | null = null;

function convertToRGB(color: string): [number, number, number] | null {
    const cached = convertToRGBCache?.get(color);
    if (cached !== undefined) return cached ?? null;

    if (!convertToRGBCanvas || !convertToRGBCtx) return null;

    convertToRGBCtx.fillStyle = "#000000";
    convertToRGBCtx.clearRect(0, 0, 1, 1);
    convertToRGBCtx.fillStyle = color;
    convertToRGBCtx.fillRect(0, 0, 1, 1);
    const [r, g, b] = convertToRGBCtx.getImageData(0, 0, 1, 1).data;
    const result: [number, number, number] = [r, g, b];
    convertToRGBCache?.set(color, result);
    return result;
}

function adjustBrightness(color: string, percent: number): string {
    const rgb = convertToRGB(color);
    if (!rgb) return color;

    let [r, g, b] = rgb;
    r = Math.max(0, Math.min(255, r + Math.round(r * (percent / 100))));
    g = Math.max(0, Math.min(255, g + Math.round(g * (percent / 100))));
    b = Math.max(0, Math.min(255, b + Math.round(b * (percent / 100))));

    const hex = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
    if (hex === "#ffffff" || hex === "#000000") return color;

    return hex;
}

function validColor(color: string) {
    const trimmedColor = color.trim();

    if (!color) return true;
    if (trimmedColor.length !== color.length) return false;
    if (trimmedColor.toLowerCase() === "role") return true;

    if (color.toLowerCase().includes("role")) {
        const percentage = parseInt(roleColorPattern.exec(color)?.[1] || "");
        return !isNaN(percentage) && percentage <= 100 && percentage >= -100;
    }

    return !!toCSS(color);
}

function resolveColor(
    colorStrings: colorStringsType,
    displayNameStyles: DisplayNameStyles | null | undefined,
    savedColor: string,
    canUseGradient: boolean,
    inGuild: boolean,
    ircColorsEnabled: boolean,
    shouldShowEffects: boolean,
): Record<string, any> | null {
    const defaultColor = getComputedStyle(document.documentElement).getPropertyValue("--text-strong").trim() || null;

    if (!defaultColor) { return null; }

    savedColor = savedColor.trim() || defaultColor;
    const isRoleColor = savedColor.toLowerCase().includes("role");
    const forceDefault = !inGuild
        && !ircColorsEnabled
        && !displayNameStyles
        && isRoleColor
        && !shouldShowEffects;

    let gradient: any = null;
    let primaryColor: any = null;
    let secondaryColor: any = null;
    let tertiaryColor: any = null;
    let primaryAdjusted: any = null;
    let secondaryAdjusted: any = null;
    let tertiaryAdjusted: any = null;

    if (isRoleColor) {
        const percentage = roleColorPattern.exec(savedColor)?.[1] || "";
        if (percentage && isNaN(parseInt(percentage))) return null;

        primaryColor = forceDefault ? defaultColor : (toCSS(colorStrings?.primaryColor) || (!inGuild && toCSS(displayNameStyles?.colors?.[0])) || defaultColor);
        secondaryColor = forceDefault ? null : (toCSS(colorStrings?.secondaryColor) || (!inGuild && toCSS(displayNameStyles?.colors?.[1])) || null);
        tertiaryColor = forceDefault ? null : (toCSS(colorStrings?.tertiaryColor) || (!inGuild && toCSS(displayNameStyles?.colors?.[2])) || null);

        primaryAdjusted = percentage ? adjustBrightness(primaryColor, parseInt(percentage)) : primaryColor;
        secondaryAdjusted = secondaryColor && percentage ? adjustBrightness(secondaryColor, parseInt(percentage)) : secondaryColor;
        tertiaryAdjusted = tertiaryColor && percentage ? adjustBrightness(tertiaryColor, parseInt(percentage)) : tertiaryColor;
    } else {
        primaryColor = forceDefault ? defaultColor : toCSS(savedColor);
        primaryAdjusted = primaryColor;
    }

    gradient = !canUseGradient || !secondaryColor || forceDefault
        ? null
        : tertiaryColor
            ? "linear-gradient(to right,var(--custom-gradient-color-1),var(--custom-gradient-color-2),var(--custom-gradient-color-3),var(--custom-gradient-color-1))"
            : "linear-gradient(to right,var(--custom-gradient-color-1),var(--custom-gradient-color-2),var(--custom-gradient-color-1))";

    const baseNormalStyle = {
        "isolation": "isolate"
    };

    const baseGradientStyle = {
        "background-clip": "text",
        "background-size": "100px auto",
        "-webkit-text-fill-color": "transparent",
        "-webkit-background-clip": "text",
        "isolation": "isolate"
    };

    return {
        normal: {
            original: { ...baseNormalStyle, "color": primaryColor, "text-decoration-color": primaryColor, "-webkit-text-fill-color": primaryColor },
            adjusted: { ...baseNormalStyle, "color": primaryAdjusted, "text-decoration-color": primaryAdjusted, "-webkit-text-fill-color": primaryAdjusted },
        },
        gradient: gradient ? {
            animated: {
                ...baseGradientStyle,
                "color": primaryColor,
                "text-decoration-color": primaryColor,
                "--custom-gradient-color-1": primaryColor,
                "--custom-gradient-color-2": secondaryColor || primaryColor,
                "--custom-gradient-color-3": tertiaryColor || primaryColor,
                "background-image": gradient,
                "animation": "smyn-animation var(--smyn-gradient-duration) linear infinite"
            },
            static: {
                original: {
                    ...baseGradientStyle,
                    "color": primaryColor,
                    "text-decoration-color": primaryColor,
                    "--custom-gradient-color-1": primaryColor,
                    "--custom-gradient-color-2": secondaryColor || primaryColor,
                    "--custom-gradient-color-3": tertiaryColor || primaryColor,
                    "background-image": gradient,
                },
                adjusted: {
                    ...baseGradientStyle,
                    "color": primaryAdjusted,
                    "text-decoration-color": primaryAdjusted,
                    "--custom-gradient-color-1": primaryAdjusted,
                    "--custom-gradient-color-2": secondaryAdjusted || primaryAdjusted,
                    "--custom-gradient-color-3": tertiaryAdjusted || primaryAdjusted,
                    "background-image": gradient,
                },
            }
        } : null,
    };
}

function splitTemplate(template: string) {
    const items = template.trim().split(/(?<!,\s*)\s+/);
    return items;
}

function parseTemplateItem(entry: string) {
    const [prefix, suffix] = entry.split(templatePattern);
    const names = entry.replace(prefix, "").replace(suffix, "").trim().replaceAll(/{|}/g, "").split(/,\s*/);

    return {
        prefix: prefix ? prefix.trim() : "",
        suffix: suffix ? suffix.trim() : "",
        targetProcessedNames: names.map(name => name.trim()).filter(name => name.length > 0)
    };
}

function validTemplate(value: string) {
    const items = splitTemplate(value);

    if (items.length > 4 || !items.length) {
        return false;
    }

    const invalidOptions = items.some(item => {
        const { prefix, suffix, targetProcessedNames } = parseTemplateItem(item);

        return (
            prefix.length > 3 ||
            suffix.length > 3 ||
            (!!prefix && !symbolPattern.test(prefix)) ||
            (!!suffix && !symbolPattern.test(suffix)) ||
            targetProcessedNames.length > 5 ||
            targetProcessedNames.some(name => !["custom", "friend", "nick", "display", "user"].includes(name.trim()))
        );
    });

    if (invalidOptions) {
        return false;
    }

    return true;
}

function getProcessedNames(
    author: any,
    truncateAllNamesWithStreamerMode: boolean,
    discriminators: boolean,
    inGuild: boolean,
    friendNameOnlyInDirectMessages: boolean,
    customNameOnlyInDirectMessages: boolean
): {
    username: string | null;
    display: string | null;
    nick: string | null;
    friend: string | null;
    custom: string | null;
} {
    let discriminator: string | null = null;

    if (discriminators) {
        const userAuthor = author as User | null;

        if (userAuthor?.bot && !isNaN(userAuthor?.discriminator as any) && Number(userAuthor?.discriminator) !== 0) {
            discriminator = userAuthor.discriminator;

            if (!!userAuthor) {
                userAuthor.globalName = userAuthor.username;
            }
        }
    }

    const username: string | null = !author?.username ? null
        : StreamerModeStore.enabled
            ? author.username[0] + "..."
            : author.username as string + (discriminator ? `#${discriminator}` : "");

    const display: string | null = !author?.globalName ? null
        : StreamerModeStore.enabled && (truncateAllNamesWithStreamerMode || author.globalName.toLowerCase() === author.username.toLowerCase())
            ? author.globalName[0] + "..."
            : author.globalName as string;

    const nick: string | null = !author?.nick ? null
        : StreamerModeStore.enabled && (truncateAllNamesWithStreamerMode || author.nick.toLowerCase() === author.username.toLowerCase())
            ? author.nick[0] + "..."
            : author.nick as string;

    const friendName: string | null = (author && !(inGuild && friendNameOnlyInDirectMessages)) ? RelationshipStore.getNickname(author.id) || null : null;
    const friend: string | null = !friendName ? null
        : StreamerModeStore.enabled && (truncateAllNamesWithStreamerMode || friendName.toLowerCase() === author.username.toLowerCase())
            ? friendName[0] + "..."
            : friendName as string;

    const customName: string | null = (author && !(inGuild && customNameOnlyInDirectMessages)) ? customNicknames[author.id] || null : null;
    const custom: string | null = !customName ? null
        : StreamerModeStore.enabled && (truncateAllNamesWithStreamerMode || customName.toLowerCase() === author.username.toLowerCase())
            ? customName[0] + "..."
            : customName;

    return { username, display, nick, friend, custom };
}

interface mentionProps {
    userId: string;
    channelId?: string;
    props?: {
        messageId?: string;
        groupId?: string;
    },
}

interface messageProps {
    message: Message | null | undefined;
    colorString?: string;
    colorStrings: colorStringsType;
    userOverride?: User;
    isRepliedMessage?: boolean;
    withMentionPrefix?: boolean;
}

interface memberListProfileReactionProps {
    user: User | null | undefined;
    type: "typingIndicator" | "membersList" | "profilesPopout" | "profilesTooltip" | "reactionsTooltip" | "reactionsPopout" | "voiceChannel";
    guildId?: string;
    tags?: any;
    isHovered?: boolean;
}

interface activeNowNameProps {
    user: User | null | undefined;
    guildId?: string;
    isHovered: boolean;
}

type colorStringsType = { primaryColor: string | null, secondaryColor: string | null, tertiaryColor: string | null; } | null | undefined;

function getTypingMemberListProfilesReactionsVoiceName(
    props: memberListProfileReactionProps,
): [string | null, JSX.Element | null, string | null] {
    const { user, type } = props;
    // props.guildId for member list & preview profile, props.tags.props.displayProfile.guildId
    // for full guild profile and main profile, which is indicated by whether it is null or not.
    const guildId = props.guildId || props.tags?.props?.displayProfile?.guildId || null;
    const member = guildId && user ? GuildMemberStore.getMember(guildId, user.id) : null;
    const author = user && member ? { ...user, ...member } : user || member || null;
    const shouldHookless = ["typingIndicator", "reactionsTooltip", "profilesTooltip"].includes(type);
    return renderUsername(author, null, null, type, "", shouldHookless, !!guildId, undefined, undefined, props.isHovered);
}

function getTypingMemberListProfilesReactionsVoiceNameText(props: memberListProfileReactionProps): string | null {
    return getTypingMemberListProfilesReactionsVoiceName(props)[2];
}

function getTypingMemberListProfilesReactionsVoiceNameElement(props: memberListProfileReactionProps): JSX.Element | null {
    return getTypingMemberListProfilesReactionsVoiceName(props)[1];
}

function getActiveNowNameElement({ user, guildId, isHovered }: activeNowNameProps): JSX.Element | string | null {
    const name = getTypingMemberListProfilesReactionsVoiceNameText({ user, guildId, type: "membersList" });

    if (!name) return null;

    const displayNameStyles: DisplayNameStyles | null = (
        AccessibilityStore.displayNameStylesEnabled
        && (user as any)?.displayNameStyles
    ) || null;

    return displayNameStyles
        ? <DisplayNameEffectName
            name={name}
            styles={displayNameStyles}
            animate={shouldAnimateNameEffects(isHovered, settings.store.styleActiveNow)}
            showStaticEffect={settings.store.styleActiveNow}
        />
        : name;
}

function getMessageName(props: messageProps): [string | null, JSX.Element | null, string | null] {
    const { hideDefaultAtSign, replies } = settings.use(["hideDefaultAtSign", "replies"]);
    const { message, userOverride, isRepliedMessage, withMentionPrefix } = props;
    const isWebhook = !!message?.webhookId && !message?.interaction;
    const channel = message ? ChannelStore.getChannel(message.channel_id) || null : null;
    const target = userOverride || message?.author;
    const user = isWebhook ? target : target ? UserStore.getUser(target.id) : null;
    const member = isWebhook ? null : target && channel ? GuildMemberStore.getMember(channel.guild_id, target.id) : null;
    const author = user && member ? { ...user, ...member } : user || member || null;
    const mentionSymbol = hideDefaultAtSign && (!isRepliedMessage || replies) ? "" : withMentionPrefix ? "@" : "";
    return renderUsername(author, channel?.id || null, message?.id || null, isRepliedMessage ? "replies" : "messages", mentionSymbol, false, !!channel?.guild_id, props.colorString, props.colorStrings);
}

function getMessageNameElement(props: messageProps): JSX.Element | null {
    return getMessageName(props)[1];
}

function getMessageNameText(props: messageProps): string | null {
    return getMessageName(props)[0];
}

function getMentionNameElement(props: mentionProps): JSX.Element | null {
    const { hideDefaultAtSign, mentions } = settings.use(["hideDefaultAtSign", "mentions"]);
    const { channelId, userId, props: nestedProps } = props;
    const channel = channelId ? ChannelStore.getChannel(channelId) || null : null;
    const user = UserStore.getUser(userId);
    const member = channel ? GuildMemberStore.getMember(channel.guild_id, userId) : null;
    const author = user && member ? { ...user, ...member } : user || member || null;
    const mentionSymbol = hideDefaultAtSign && mentions ? "" : "@";

    let colorString: string | undefined = undefined;
    let colorStrings: colorStringsType = undefined;

    if (isPluginEnabled(ircColors.name)) {
        const color = ircColors.calculateNameColorForMessageContext({ message: { author: author }, author: author, channel: channel });

        if (color) {
            colorString = color;
            colorStrings = { primaryColor: color, secondaryColor: null, tertiaryColor: null };
        }
    }

    return renderUsername(author, channelId || null, nestedProps?.messageId || null, "mentions", mentionSymbol, false, !!channel?.guild_id, colorString, colorStrings)[1];
}

function getDisplayNameStyles(styles: DisplayNameStyles, ignoreFont: boolean): DisplayNameStyles {
    return ignoreFont
        ? { ...styles, fontId: DisplayNameFonts.DEFAULT }
        : styles;
}

function getDisplayNameEffectDisplayType(isHovered: boolean, showStaticEffect = true): number {
    if (shouldAnimateNameEffects(isHovered, showStaticEffect)) return DisplayNameEffectDisplayTypes.ANIMATED;

    return showStaticEffect
        ? DisplayNameEffectDisplayTypes.STATIC
        : DisplayNameEffectDisplayTypes.PLAIN;
}

function shouldAnimateNameEffects(isHovered: boolean, isEffectVisible = true): boolean {
    return isHovered || (isEffectVisible && settings.store.alwaysAnimateEffects);
}

function getDisplayNameEffectClassName(
    styles: DisplayNameStyles | null | undefined,
    effectDisplayType: number,
): string {
    const useGradientAnimationOverride = needsGradientAnimationOverride(styles)
        && effectDisplayType === DisplayNameEffectDisplayTypes.ANIMATED
        && !AccessibilityStore.useReducedMotion;

    return [
        "smyn-native-effect",
        useGradientAnimationOverride && "smyn-native-gradient-animated",
        styles?.effectId === DisplayNameEffects.GRADIENT && settings.store.gradientGlow && "smyn-native-gradient-glow",
        useGradientAnimationOverride && styles?.effectId === DisplayNameEffects.GRADIENT && settings.store.gradientGlow && "smyn-native-gradient-glow-active",
        styles?.effectId === DisplayNameEffects.POP && "smyn-native-pop",
        styles?.effectId === DisplayNameEffects.GUMMY && "smyn-native-gummy",
        styles?.effectId === DisplayNameEffects.GUMMY
            && effectDisplayType === DisplayNameEffectDisplayTypes.ANIMATED
            && !AccessibilityStore.useReducedMotion
            && "smyn-native-gummy-animated",
    ].filter(Boolean).join(" ");
}

function DisplayNameEffectName({ name, styles, animate, ignoreFont = false, showStaticEffect = true, useMessageLayout = false }: {
    name: string;
    styles: DisplayNameStyles;
    animate: boolean;
    ignoreFont?: boolean;
    showStaticEffect?: boolean;
    useMessageLayout?: boolean;
}) {
    const effectDisplayType = animate
        ? DisplayNameEffectDisplayTypes.ANIMATED
        : showStaticEffect
            ? DisplayNameEffectDisplayTypes.STATIC
            : DisplayNameEffectDisplayTypes.PLAIN;

    return (
        <UserNameWithEffects
            userName={name}
            displayNameStyles={getDisplayNameStyles(styles, ignoreFont)}
            effectDisplayType={effectDisplayType}
            textClassName={SMYNC(getDisplayNameEffectClassName(styles, effectDisplayType), {
                "smyn-native-message-effect": useMessageLayout,
            })}
            loop
        />
    );
}

function needsGradientAnimationOverride(styles: DisplayNameStyles | null | undefined): boolean {
    return styles?.effectId === DisplayNameEffects.GRADIENT
        || styles?.effectId === DisplayNameEffects.GLOW;
}

function getSecondaryNameStyle(
    style: Record<string, any> | null,
    useNativeEffect: boolean,
    ignoreEffects: boolean,
    animateGradient: boolean,
    showGradientGlow: boolean,
): Record<string, any> {
    if (!style) return {};

    if (useNativeEffect) {
        if (!showGradientGlow || !style.gradient) return {};
        return animateGradient ? style.gradient.animated : style.gradient.static.original;
    }

    if (ignoreEffects) return style.normal.adjusted;
    if (animateGradient && style.gradient) return style.gradient.animated;

    return style.gradient?.static.original ?? style.normal.adjusted;
}

function renderUsername(
    author: User | GuildMember | null,
    channelId: string | null,
    messageId: string | null,
    type: "messages" | "replies" | "typingIndicator" | "mentions" | "membersList" | "profilesPopout" | "profilesTooltip" | "reactionsTooltip" | "reactionsPopout" | "voiceChannel",
    mentionSymbol: string,
    hookless: boolean,
    inGuild: boolean,
    colorString?: string,
    colorStrings?: { primaryColor: string | null, secondaryColor: string | null, tertiaryColor: string | null; } | null,
    isHoveredOverride?: boolean,
): [string | null, JSX.Element | null, string | null] {
    const isMessage = type === "messages";
    const isReply = type === "replies";
    const isMention = type === "mentions";
    const isTyping = type === "typingIndicator";
    const isMember = type === "membersList";
    const isProfile = type === "profilesPopout";
    const isReactionsPopout = type === "reactionsPopout";
    const isReactionsTooltip = type === "reactionsTooltip";
    const isReaction = isReactionsTooltip || isReactionsPopout;
    const isVoice = type === "voiceChannel";

    const config = hookless ? settings.store : settings.use(["messages", "replies", "mentions", "typingIndicator", "memberList", "styleDirectMessagesList", "styleDirectMessagesMessages", "styleFriendsList", "styleActiveNow", "profilePopout", "reactions", "friendNameOnlyInDirectMessages", "customNameOnlyInDirectMessages", "discriminators", "hideDefaultAtSign", "truncateAllNamesWithStreamerMode", "removeDuplicates", "ignoreEffects", "ignoreFonts", "animateEffects", "alwaysAnimateEffects", "gradientGlow", "includedNames", "customNameColor", "friendNameColor", "nicknameColor", "displayNameColor", "usernameColor", "nameSeparator", "triggerNameRerender"]);
    const { messages, replies, mentions, typingIndicator, memberList, styleDirectMessagesMessages, profilePopout, reactions, friendNameOnlyInDirectMessages, customNameOnlyInDirectMessages, discriminators, truncateAllNamesWithStreamerMode, removeDuplicates, ignoreEffects, ignoreFonts, animateEffects, includedNames, customNameColor, friendNameColor, nicknameColor, displayNameColor, usernameColor, nameSeparator, triggerNameRerender } = config;

    const channel = channelId ? ChannelStore.getChannel(channelId) || null : null;
    const message = channelId && messageId ? MessageStore.getMessage(channelId, messageId) : null;
    const groupId = (message as any)?.showMeYourNameGroupId || null;
    const showStaticDisplayNameEffect = !isMessage
        || !(channel?.isDM() || channel?.isGroupDM())
        || styleDirectMessagesMessages;

    const isHovered = isHoveredOverride ?? ((isMessage || isMention)
        ? Boolean((messageId && hoveringMessageMap.has(messageId)) || (groupId && hoveringMessageMap.has(groupId)))
        : isReply
            ? Boolean((messageId && hoveringRepliesMap.has(messageId)) || (groupId && hoveringRepliesMap.has(groupId)))
            : false);
    const shouldShowHoverEffects = shouldAnimateNameEffects(isHovered, showStaticDisplayNameEffect);
    const shouldShowDisplayNameStyle = showStaticDisplayNameEffect || shouldShowHoverEffects;

    if (colorString && !colorStrings) {
        colorStrings = {
            primaryColor: colorString,
            secondaryColor: null,
            tertiaryColor: null
        };
    }

    const ircColorsEnabled = isPluginEnabled(ircColors.name);

    const authorColorStrings = colorStrings || (author as any)?.colorStrings || null;
    const authorDisplayNameStyles: DisplayNameStyles | null = (
        !inGuild
        && !ircColorsEnabled
        && AccessibilityStore.displayNameStylesEnabled
        && (author as any)?.displayNameStyles
    ) || null;
    const shouldShowDisplayNameEffect = !!authorDisplayNameStyles;
    const usesGradientAnimationOverride = needsGradientAnimationOverride(authorDisplayNameStyles);

    const canUseGradient = ((author as GuildMember)?.guildId ? (GuildStore.getGuild((author as GuildMember).guildId) ?? {}).premiumFeatures?.features.includes("ENHANCED_ROLE_COLORS") : !inGuild);
    const useTopRoleStyle = isMention || isReactionsPopout || channel?.isDM() || channel?.isGroupDM();
    const topRoleStyle = author ? resolveColor(authorColorStrings, authorDisplayNameStyles, "Role", canUseGradient, inGuild, ircColorsEnabled, shouldShowHoverEffects) : null;
    const hasGradient = !!topRoleStyle?.gradient && Object.keys(topRoleStyle.gradient).length > 0;

    const textMutedValue = getComputedStyle(document.documentElement)?.getPropertyValue("--text-muted")?.trim() || "#72767d";
    const options = splitTemplate(includedNames);
    const resolvedUsernameColor = author ? resolveColor(authorColorStrings, authorDisplayNameStyles, usernameColor.trim(), canUseGradient, inGuild, ircColorsEnabled, shouldShowHoverEffects) : null;
    const resolvedDisplayNameColor = author ? resolveColor(authorColorStrings, authorDisplayNameStyles, displayNameColor.trim(), canUseGradient, inGuild, ircColorsEnabled, shouldShowHoverEffects) : null;
    const resolvedNicknameColor = author ? resolveColor(authorColorStrings, authorDisplayNameStyles, nicknameColor.trim(), canUseGradient, inGuild, ircColorsEnabled, shouldShowHoverEffects) : null;
    const resolvedFriendNameColor = author ? resolveColor(authorColorStrings, authorDisplayNameStyles, friendNameColor.trim(), canUseGradient, inGuild, ircColorsEnabled, shouldShowHoverEffects) : null;
    const resolvedCustomNameColor = author ? resolveColor(authorColorStrings, authorDisplayNameStyles, customNameColor.trim(), canUseGradient, inGuild, ircColorsEnabled, shouldShowHoverEffects) : null;
    const affixColor = { color: textMutedValue, "-webkit-text-fill-color": textMutedValue, isolation: "isolate", "white-space": "pre", "font-family": "var(--font-primary)", "letter-spacing": "normal" };
    const { username, display, nick, friend, custom } = getProcessedNames(author, truncateAllNamesWithStreamerMode, discriminators, inGuild, friendNameOnlyInDirectMessages, customNameOnlyInDirectMessages);

    const names: Record<string, [string | null, object | null]> = {
        user: [username, resolvedUsernameColor],
        display: [display, resolvedDisplayNameColor],
        nick: [nick, resolvedNicknameColor],
        friend: [friend, resolvedFriendNameColor],
        custom: [custom, resolvedCustomNameColor]
    };

    const outputs: any[] = [];

    for (const option of options) {
        const { prefix, suffix, targetProcessedNames } = parseTemplateItem(option);
        let chosenName: string | null = null;
        let chosenStyle: object | null = null;
        let chosenType = "";

        for (const name of targetProcessedNames) {
            if (!names[name]) {
                continue;
            }

            chosenName = names[name][0];
            chosenStyle = names[name][1];
            chosenType = name;

            if (chosenName) {
                break;
            }
        }

        if (!chosenName) {
            continue;
        }

        outputs.push({
            prefix: prefix || "",
            name: chosenName,
            wrapped: chosenName,
            type: chosenType,
            suffix: suffix || "",
            style: chosenStyle
        });
    }

    if (!outputs.length) {
        outputs.push({
            prefix: "",
            name: username || "Unknown",
            wrapped: username || "Unknown",
            suffix: "",
            style: resolvedUsernameColor
        });
    }

    let first = outputs.shift();
    let second = outputs.shift();
    let third = outputs.shift();
    let fourth = outputs.shift();
    let fifth = outputs.shift();

    const firstValueWrapped = hookless ?
        (first.name || "")
        : wrapEmojis(first.name || "");

    const secondValueWrapped = hookless ?
        ((second ?? {}).name || "")
        : wrapEmojis((second ?? {}).name || "");

    const thirdValueWrapped = hookless ?
        ((third ?? {}).name || "")
        : wrapEmojis((third ?? {}).name || "");

    const fourthValueWrapped = hookless ?
        ((fourth ?? {}).name || "")
        : wrapEmojis((fourth ?? {}).name || "");

    const fifthValueWrapped = hookless ?
        ((fifth ?? {}).name || "")
        : wrapEmojis((fifth ?? {}).name || "");

    first.wrapped = firstValueWrapped;
    second && (second.wrapped = secondValueWrapped);
    third && (third.wrapped = thirdValueWrapped);
    fourth && (fourth.wrapped = fourthValueWrapped);
    fifth && (fifth.wrapped = fifthValueWrapped);

    if (isMessage && !messages) {
        return [null, null, null];
    } else if (isReply && !replies) {
        return [null, null, null];
    } else if (isMention && !mentions) {
        return [null, null, null];
    } else if (isTyping && !typingIndicator) {
        return [null, null, null];
    } else if (isMember && !memberList) {
        return [null, null, null];
    } else if (isProfile && !profilePopout) {
        return [null, null, null];
    } else if (isReaction && !reactions) {
        return [null, null, null];
    } else if (isVoice && !reactions) {
        return [null, null, null];
    } else if (!author || !username) {
        return [null, null, null];
    }

    const prioritizeUsername = (new Set([first, second, third, fourth, fifth].filter(Boolean).map(pos => pos.name.toLowerCase())).size > 1);

    if (removeDuplicates) {
        // Remove duplicates from back to front. Prioritize the earlier name, unless it's the username and there's more than one unique option, then prioritize it.
        fifth && fourth && fifth.name.toLowerCase() === fourth.name.toLowerCase() ? fifth.type === "user" && prioritizeUsername ? fourth = null : fifth = null : null;
        fifth && third && fifth.name.toLowerCase() === third.name.toLowerCase() ? fifth.type === "user" && prioritizeUsername ? third = null : fifth = null : null;
        fifth && second && fifth.name.toLowerCase() === second.name.toLowerCase() ? fifth.type === "user" && prioritizeUsername ? second = null : fifth = null : null;
        fifth && first && fifth.name.toLowerCase() === first.name.toLowerCase() ? fifth.type === "user" && prioritizeUsername ? first = null : fifth = null : null;
        fourth && third && fourth.name.toLowerCase() === third.name.toLowerCase() ? fourth.type === "user" && prioritizeUsername ? third = null : fourth = null : null;
        fourth && second && fourth.name.toLowerCase() === second.name.toLowerCase() ? fourth.type === "user" && prioritizeUsername ? second = null : fourth = null : null;
        fourth && first && fourth.name.toLowerCase() === first.name.toLowerCase() ? fourth.type === "user" && prioritizeUsername ? first = null : fourth = null : null;
        third && second && third.name.toLowerCase() === second.name.toLowerCase() ? third.type === "user" && prioritizeUsername ? second = null : third = null : null;
        third && first && third.name.toLowerCase() === first.name.toLowerCase() ? third.type === "user" && prioritizeUsername ? first = null : third = null : null;
        second && first && second.name.toLowerCase() === first.name.toLowerCase() ? second.type === "user" && prioritizeUsername ? first = null : second = null : null;
    }

    const remainingNames = [first, second, third, fourth, fifth].filter(Boolean);

    first = remainingNames.shift();
    second = remainingNames.shift();
    third = remainingNames.shift();
    fourth = remainingNames.shift();
    fifth = remainingNames.shift();

    const shouldShowGradientGlow = shouldShowHoverEffects
        && hasGradient
        && (!authorDisplayNameStyles || (usesGradientAnimationOverride && authorDisplayNameStyles.effectId !== DisplayNameEffects.GRADIENT));
    const shouldAnimatePrimaryGradient = shouldShowGradientGlow && !AccessibilityStore.useReducedMotion;
    const shouldAnimateSecondaryEffects = shouldShowHoverEffects && animateEffects && !ignoreEffects;
    const shouldShowSecondaryDisplayNameEffect = shouldShowDisplayNameEffect && !ignoreEffects;

    const firstDataText = mentionSymbol + first.name;
    const secondDataText = second && shouldAnimateSecondaryEffects ? second.name : "";
    const thirdDataText = third && shouldAnimateSecondaryEffects ? third.name : "";
    const fourthDataText = fourth && shouldAnimateSecondaryEffects ? fourth.name : "";
    const fifthDataText = fifth && shouldAnimateSecondaryEffects ? fifth.name : "";
    const allDataText = [firstDataText, secondDataText, thirdDataText, fourthDataText, fifthDataText].filter(Boolean).join(nameSeparator).trim();

    // Only mentions and reactions popouts should patch in the gradient glow or else a double glow will appear on messages.
    const hoveringClass = (shouldShowHoverEffects ? " smyn-gradient-hovered" : "");
    const gradientClasses = useTopRoleStyle
        ? "smyn-gradient smyn-gradient-inherit-bg" + hoveringClass
        : "smyn-gradient smyn-gradient-unset-bg" + hoveringClass;

    const firstGroupClasses = "smyn-name-group smyn-first-name-group";
    const secondGroupClasses = "smyn-name-group smyn-second-name-group";
    const thirdGroupClasses = "smyn-name-group smyn-third-name-group";
    const fourthGroupClasses = "smyn-name-group smyn-fourth-name-group";
    const fifthGroupClasses = "smyn-name-group smyn-fifth-name-group";
    const firstNameClasses = "smyn-name smyn-first-name";
    const secondNameClasses = "smyn-name smyn-second-name";
    const thirdNameClasses = "smyn-name smyn-third-name";
    const fourthNameClasses = "smyn-name smyn-fourth-name";
    const fifthNameClasses = "smyn-name smyn-fifth-name";
    const prefixClasses = "smyn-affix smyn-prefix";
    const suffixClasses = "smyn-affix smyn-suffix";

    const animationDuration = Math.max(1, 1.5 * (first.name.length / 12));

    const topLevelStyle = {
        // Allows names to wrap in reaction popouts.
        ...(isReactionsPopout
            ? { display: "flex", flexWrap: "wrap", lineHeight: "1.1em", fontSize: "0.9em" }
            : {}),
        "--smyn-gradient-duration": `${animationDuration}s`,
        "--smyn-underline-color": topRoleStyle?.normal.original?.["text-decoration-color"],
    } as React.CSSProperties;

    const nameElement = (
        <span
            style={{
                ...topLevelStyle,
                ...(shouldShowDisplayNameEffect ? {} : topRoleStyle?.normal.original || {})
            }}
            className="smyn-container"
        >
            {mentionSymbol && <span>{mentionSymbol}</span>}
            {(
                <span
                    className={SMYNC(firstGroupClasses, { [gradientClasses]: shouldShowGradientGlow })}
                    data-text={shouldShowGradientGlow ? firstDataText : undefined}
                    style={(shouldShowGradientGlow && useTopRoleStyle && topRoleStyle?.gradient
                        ? shouldAnimatePrimaryGradient
                            ? topRoleStyle.gradient.animated
                            : topRoleStyle.gradient.static.original
                        : undefined) as React.CSSProperties}
                >
                    <span
                        className={SMYNC(firstNameClasses)}
                        style={shouldShowDisplayNameEffect
                            ? undefined
                            : topRoleStyle ?
                                shouldAnimatePrimaryGradient && topRoleStyle.gradient
                                    ? topRoleStyle.gradient.animated
                                    : topRoleStyle.gradient
                                        ? topRoleStyle.gradient.static.original
                                        : topRoleStyle.normal.original
                                : undefined
                        }>
                        {shouldShowDisplayNameEffect && authorDisplayNameStyles
                            ? <DisplayNameEffectName
                                name={first.name}
                                styles={authorDisplayNameStyles}
                                animate={shouldShowHoverEffects}
                                showStaticEffect={showStaticDisplayNameEffect}
                                useMessageLayout={isMessage}
                            />
                            : first.wrapped}
                    </span>
                </span>
            )}
            {[
                { name: second, dataText: secondDataText, groupClass: secondGroupClasses, nameClass: secondNameClasses, position: "second" },
                { name: third, dataText: thirdDataText, groupClass: thirdGroupClasses, nameClass: thirdNameClasses, position: "third" },
                { name: fourth, dataText: fourthDataText, groupClass: fourthGroupClasses, nameClass: fourthNameClasses, position: "fourth" },
                { name: fifth, dataText: fifthDataText, groupClass: fifthGroupClasses, nameClass: fifthNameClasses, position: "fifth" }
            ].map(({ name, dataText, groupClass, nameClass, position }) => name && (
                <span
                    key={position}
                    className={SMYNC(groupClass)}
                >
                    <span style={affixColor as React.CSSProperties} className={prefixClasses}>
                        <span>{nameSeparator}</span>
                        {name.prefix}</span>
                    <span
                        // On non-primary names, allow disabling the effects completely, or just their animation & glow.
                        className={SMYNC(nameClass, {
                            [gradientClasses]: shouldShowGradientGlow && shouldAnimateSecondaryEffects,
                        })}
                        data-text={shouldShowGradientGlow && dataText ? dataText : undefined}
                        style={{
                            ...(ignoreFonts ? { fontFamily: "var(--font-primary)", letterSpacing: "normal" } : {}),
                            ...getSecondaryNameStyle(
                                shouldShowDisplayNameStyle ? name.style : null,
                                shouldShowSecondaryDisplayNameEffect,
                                ignoreEffects,
                                shouldAnimatePrimaryGradient && shouldAnimateSecondaryEffects,
                                shouldShowGradientGlow && shouldAnimateSecondaryEffects,
                            )
                        }}>
                        {shouldShowSecondaryDisplayNameEffect && authorDisplayNameStyles
                            ? <DisplayNameEffectName
                                name={name.name}
                                styles={authorDisplayNameStyles}
                                animate={shouldAnimateSecondaryEffects}
                                ignoreFont={ignoreFonts}
                                showStaticEffect={showStaticDisplayNameEffect}
                                useMessageLayout={isMessage}
                            />
                            : name.wrapped}
                    </span>
                    <span style={affixColor as React.CSSProperties} className={suffixClasses}>
                        {name.suffix}</span>
                </span>
            ))}
        </span>
    );

    return [allDataText, nameElement, first.name];
}

const hoveringMessageMap = new Map<string, number>();
const hoveringRepliesMap = new Map<string, number>();

function handleHoveringMessage(message: any, isHovered: boolean) {
    const messageId = message?.id;
    const repliedId = message?.messageReference?.message_id;
    const groupId = message?.showMeYourNameGroupId ?? "";

    useEffect(() => {
        if (!message || !isHovered) return;

        addHoveringMessage(messageId);
        addHoveringMessage(groupId);
        addHoveringReply(repliedId);

        return () => {
            removeHoveringMessage(messageId);
            removeHoveringMessage(groupId);
            removeHoveringReply(repliedId);
        };
    }, [messageId, repliedId, groupId, isHovered]);
}

function addHoveringMessage(id: string) {
    if (!id) return;

    const currentCount = hoveringMessageMap.get(id) || 0;
    hoveringMessageMap.set(id, currentCount + 1);

    if (currentCount === 0) {
        triggerNameRerender();
    }
}

function removeHoveringMessage(id: string) {
    if (!id) return;

    const currentCount = hoveringMessageMap.get(id) || 0;

    if (currentCount <= 1) {
        hoveringMessageMap.delete(id);
        triggerNameRerender();
    } else {
        hoveringMessageMap.set(id, currentCount - 1);
    }
}

function addHoveringReply(id: string) {
    if (!id) return;

    const currentCount = hoveringRepliesMap.get(id) || 0;
    hoveringRepliesMap.set(id, currentCount + 1);

    if (currentCount === 0) {
        triggerNameRerender();
    }
}

function removeHoveringReply(id: string) {
    if (!id) return;

    const currentCount = hoveringRepliesMap.get(id) || 0;

    if (currentCount <= 1) {
        hoveringRepliesMap.delete(id);
        triggerNameRerender();
    } else {
        hoveringRepliesMap.set(id, currentCount - 1);
    }
}

function useNameHoverState() {
    return useState(false);
}

function triggerNameRerender() {
    settings.store.triggerNameRerender = !settings.store.triggerNameRerender;
}

function CustomNicknameModal({ modalProps, user }: { modalProps: RenderModalProps; user: User; }) {
    const [value, setValue] = useState(customNicknames[user.id] ?? "");

    return (
        <Modal
            {...modalProps}
            size="sm"
            title={customNicknames[user.id] ? "Change SMYN Nickname" : "Add SMYN Nickname"}
            actions={[
                {
                    text: "Save",
                    variant: "primary",
                    onClick: async () => {
                        const trimmed = value.trim().slice(0, 32).trim();

                        if (trimmed) {
                            customNicknames[user.id] = trimmed;
                        } else {
                            delete customNicknames[user.id];
                        }

                        await DataStore.set("SMYNCustomNicknames", customNicknames);
                        triggerNameRerender();
                        modalProps.onClose();
                    }
                },
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: modalProps.onClose
                }
            ]}
        >
            <Heading tag="h3" style={{ marginBottom: 8, fontSize: "16px", fontWeight: "400", lineHeight: "1.25", color: "var(--text-subtle)" }}>
                {"Set a custom SMYN nickname for this user. Make use of it by specifying {custom} in the SMYN template settings."}
            </Heading>
            <div style={{ paddingTop: "10px", flexGrow: 0 }}></div>
            <Heading tag="h3" style={{ marginBottom: 8, fontSize: "14px", fontWeight: 600 }}>
                SMYN Nickname
            </Heading>
            <TextInput
                value={value}
                maxLength={32}
                onChange={setValue}
                placeholder={user.globalName ?? user.username}
                style={{ width: "100%" }}
            />
            <TextButton
                className="smyn-reset-button"
                onClick={async () => {
                    setValue("");
                    delete customNicknames[user.id];
                    await DataStore.set("SMYNCustomNicknames", customNicknames);
                    triggerNameRerender();
                }}
            >
                Reset SMYN Nickname
            </TextButton>
            <div style={{ paddingTop: "10px", flexGrow: 0 }}></div>
        </Modal>
    );
}

const userContextPatch: NavContextMenuPatchCallback = (children, { user }) => {
    if (!user) return;

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser || user.id === currentUser.id) return;

    const group = findGroupChildrenByChildId("user-profile", children);

    !group && children.push(<Menu.MenuSeparator />);
    (group || children).push(
        <Menu.MenuItem
            id="smyn-custom-nickname"
            label={customNicknames[user.id] ? "Change SMYN Nickname" : "Add SMYN Nickname"}
            action={() => openModal(props => (
                <ErrorBoundary>
                    <CustomNicknameModal modalProps={props} user={user} />
                </ErrorBoundary>
            ))}
        />
    );
};

migratePluginSetting("ShowMeYourName", "ignoreEffects", "ignoreGradients");
migratePluginSetting("ShowMeYourName", "animateEffects", "animateGradients");
migratePluginSetting("ShowMeYourName", "alwaysAnimateEffects", "alwaysShowEffects");

const settings = definePluginSettings({
    messages: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Display custom name format in messages.",
    },
    replies: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Display custom name format in replies.",
    },
    mentions: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Display custom name format in mentions.",
    },
    typingIndicator: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Display the first available name listed in your custom name format in the typing indicator.",
    },
    memberList: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Display the first available name listed in your custom name format in the members list, DMs list, friends list, and Active Now.",
    },
    styleDirectMessagesList: {
        type: OptionType.BOOLEAN,
        default: true,
        displayName: "Style Direct Messages List",
        description: "Show display name effects on unselected entries without requiring hover. Selected and hovered entries are still styled when disabled.",
    },
    styleDirectMessagesMessages: {
        type: OptionType.BOOLEAN,
        default: true,
        displayName: "Style Direct Messages Messages",
        description: "Show display name effects on message authors without requiring hover. Hovered names are still styled when disabled.",
    },
    styleFriendsList: {
        type: OptionType.BOOLEAN,
        default: true,
        displayName: "Style Friends List",
        description: "Show display name effects without requiring hover. Hovered entries are still styled when disabled.",
    },
    styleActiveNow: {
        type: OptionType.BOOLEAN,
        default: true,
        displayName: "Style Active Now",
        description: "Show display name effects without requiring hover. Hovered entries are still styled when disabled.",
    },
    profilePopout: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Display the first available name listed in your custom name format in profile popouts.",
    },
    voiceChannels: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Display the first available name listed in your custom name format in voice channels.",
    },
    reactions: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Display the first available name listed in your custom name format in reaction tooltips, and the full name in reaction popouts.",
    },
    discriminators: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Append discriminators to usernames for bots. Discriminators were deprecated for users, but are still used for bots. By default, a bot's username is equivalent to a user's global name, therefore multiple bots can have the same username. Appending discriminators makes them unique again.",
    },
    hideDefaultAtSign: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Hide the default \"@\" symbol before the name in mentions and replies. Only applied if either feature is enabled.",
    },
    truncateAllNamesWithStreamerMode: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Truncate all names, not just usernames, while in Streamer Mode.",
    },
    removeDuplicates: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "If any of the names are equivalent, remove them, leaving only the unique names.",
    },
    ignoreFonts: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "For the non-primary names, use Discord's default fonts regardless of the user's custom nitro font.",
    },
    ignoreEffects: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "For non-primary names, use only the primary role color and omit display name effects.",
    },
    animateEffects: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Animate role gradients and display name effects on non-primary names. This is disabled by \"Ignore Effects\" and reduced motion.",
    },
    alwaysAnimateEffects: {
        type: OptionType.BOOLEAN,
        default: false,
        displayName: "Always Animate Effects",
        description: "Force display name effects to animate when they would already be visible, even without hover.",
    },
    gradientGlow: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Add a glow to animated user gradients the same way server role gradients glow.",
    },
    nameSeparator: {
        type: OptionType.STRING,
        description: "The separator to use between names. The default is a single space.",
        default: " ",
    },
    friendNameOnlyInDirectMessages: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Only display friend names when in DMs, and not in servers.",
    },
    customNameOnlyInDirectMessages: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Only display custom names when in DMs, and not in servers.",
    },
    includedNames: {
        type: OptionType.STRING,
        description: "The order to display usernames, display names, nicknames, friend names, and custom names. Use the following placeholders: {user}, {display}, {nick}, {friend}, {custom}. You can provide multiple name options to use as fallbacks if one is unavailable by separating them with commas as such: {custom, friend, nick}. You can have up to three prefixes and three suffixes per name.",
        default: "{custom, friend, nick} [{display}] (@{user})",
        isValid: validTemplate,
    },
    customNameColor: {
        type: OptionType.STRING,
        description: "The color to use for the custom name you assigned a user if it's not the first displayed. Accepts any valid CSS input. Use \"Role\" to follow the user's top role colors, nitro effect colors, or IRCColors color if enabled. Use \"Role+-#\" to adjust the brightness by that percentage (ex: \"Role+15\")",
        default: "Role-25",
        isValid: validColor,
    },
    friendNameColor: {
        type: OptionType.STRING,
        description: "The color to use for a friend's nickname if it's not the first displayed. Accepts any valid CSS input. Use \"Role\" to follow the user's top role colors, nitro effect colors, or IRCColors color if enabled. Use \"Role+-#\" to adjust the brightness by that percentage (ex: \"Role+15\")",
        default: "Role-25",
        isValid: validColor,
    },
    nicknameColor: {
        type: OptionType.STRING,
        description: "The color to use for the nickname if it's not the first displayed. Accepts any valid CSS input. Use \"Role\" to follow the user's top role colors, nitro effect colors, or IRCColors color if enabled. Use \"Role+-#\" to adjust the brightness by that percentage (ex: \"Role+15\")",
        default: "Role-25",
        isValid: validColor,
    },
    displayNameColor: {
        type: OptionType.STRING,
        description: "The color to use for the display name if it's not the first displayed. Accepts any valid CSS input. Use \"Role\" to follow the user's top role colors, nitro effect colors, or IRCColors color if enabled. Use \"Role+-#\" to adjust the brightness by that percentage (ex: \"Role+15\")",
        default: "Role-25",
        isValid: validColor,
    },
    usernameColor: {
        type: OptionType.STRING,
        description: "The color to use for the username if it's not the first displayed. Accepts any valid CSS input. Use \"Role\" to follow the user's top role colors, nitro effect colors, or IRCColors color if enabled. Use \"Role+-#\" to adjust the brightness by that percentage (ex: \"Role+15\")",
        default: "Role-25",
        isValid: validColor,
    },
    triggerNameRerender: {
        type: OptionType.BOOLEAN,
        description: "Trigger a name rerender by toggling this setting.",
        default: false,
        hidden: true
    },
});

export default definePlugin({
    name: "ShowMeYourName",
    description: "Display any permutation of custom nicknames, friend nicknames, server nicknames, display names, and usernames in chat.",
    authors: [EquicordDevs.Etorix, Devs.Rini, Devs.TheKodeToad, Devs.sadan, Devs.prism],
    tags: ["Appearance", "Customisation"],
    searchTerms: ["SMYN", "Nicknames", "Custom Nicknames"],
    isModified: true,
    settings,

    patches: [
        {
            // Replace message and reply names and expose their hover context.
            find: '="SYSTEM_TAG"',
            group: true,
            replacement: [
                {
                    // Replace names in messages and replies.
                    match: /(?<=colorString:(\i),colorStrings:(\i).{0,900}?)style:.{0,120}?,(onClick:\i,onContextMenu:\i,children:)(.{0,250}?),"data-text":(\i\+\i)/,
                    replace: "$3$self.getMessageNameElement({...arguments[0],colorString:$1,colorStrings:$2})??($4),\"data-text\":$self.getMessageNameText(arguments[0])??($5)"
                },
                {
                    // Expose the message object to SMYN's message-hover patch.
                    match: /(\(\{)(shouldSubscribe)/,
                    replace: "$1message:arguments[0].message,$2"
                }
            ]
        },
        {
            // Replace names in the typing indicator.
            find: "activityInviteEducationActivity:",
            replacement: {
                match: /(?=\i.\i.getName\((\i.guild_id),\i.id,(\i)\))/,
                replace: "$self.getTypingMemberListProfilesReactionsVoiceNameText({user:$2,type:\"typingIndicator\",guildId:$1})??"
            },
        },
        {
            // Replace names and preserve display name styles in the DMs list.
            find: "ImpressionNames.DM_LIST_RIGHT_CLICK_MENU_SHOWN",
            group: true,
            replacement: [
                {
                    // Replace the displayed DM name.
                    match: /(?<=getMentionCount\(\i.id\)>0\),\i=)/,
                    replace: "$self.getTypingMemberListProfilesReactionsVoiceNameText({...arguments[0],type:\"membersList\"})??"
                },
                {
                    // Keep fonts at rest and gate persistent effects behind the location setting.
                    match: /(?<=userName:\i,)displayNameStyles:(\i)\?\.displayNameStyles,effectDisplayType:(\i\|\|\i\|\|\i)\?\i\.\i\.ANIMATED:\i\.\i\.PLAIN,loop:\i(?=,boldFontOpacity:)/,
                    replace: "displayNameStyles:$1?.displayNameStyles,effectDisplayType:$self.getDisplayNameEffectDisplayType($2,$self.settings.store.styleDirectMessagesList),textClassName:$self.getDisplayNameEffectClassName($1?.displayNameStyles,$self.getDisplayNameEffectDisplayType($2,$self.settings.store.styleDirectMessagesList)),loop:$self.shouldAnimateNameEffects($2,$self.settings.store.styleDirectMessagesList)"
                }
            ],
        },
        {
            // Replace names in the friends list.
            find: "hasUniqueUsername()}),usernameClass",
            group: true,
            replacement: [
                {
                    // Pass the row hover state to Discord's native display-name component.
                    match: /(?<=\(0,\i\.jsx\)\(\i\.\i,\{user:\i,nick:\i,)(?=botClass:)/,
                    replace: "displayNameStylesType:$self.getDisplayNameEffectDisplayType(arguments[0].hovered,$self.settings.store.styleFriendsList),"
                },
                {
                    // Replace the displayed friend name.
                    match: /(?<=nick:)(\i)/,
                    replace: "$self.getTypingMemberListProfilesReactionsVoiceNameText({user:arguments[0].user,type:\"membersList\"})??$1"
                }
            ],
        },
        {
            // Set Discord's existing friends-row hover state on pointer entry.
            find: "handleMouseEnter=()=>{let{isFocused:",
            replacement: {
                match: /(?<=handleMouseEnter=\(\)=>\{let\{isFocused:\i,isActive:\i,onOtherHover:\i}=this.props,\{isContextMenuActive:\i}=this.state;this.setState\(\{hovered:)\i(?=}\),)/,
                replace: "!0"
            },
        },
        {
            // Preserve display name styles when SMYN replaces the friends-list name.
            find: 'location:"DiscordTag"})',
            group: true,
            replacement: [
                {
                    // Keep the user's display name styles when SMYN supplies the name.
                    match: /(?<=showStreamerModeTooltip:\i&&\i\.\i\.isNameConcealed\(e\),displayNameStyles:)\i!==\i\?(\i\.displayNameStyles):null/,
                    replace: "!arguments[0].forceUsername?$1:null"
                },
                {
                    // Render native display name effects statically before hover.
                    match: /(?<=displayNameStylesType:\i=\i\.\i\.)PLAIN(?=,\.\.\.\i}=e)/,
                    replace: "STATIC"
                },
                {
                    // Attach SMYN's effect-specific classes.
                    match: /(?<=userName:\i,displayNameStyles:(\i),effectDisplayType:(\i))(?=}\):\i)/,
                    replace: ",textClassName:$self.getDisplayNameEffectClassName($1,$2)"
                }
            ],
        },
        {
            find: '("NowPlayingHeader")',
            group: true,
            replacement: [
                {
                    // Replace the card title and apply its propagated hover state.
                    match: /(?<=\.Header,\{priorityUser:(\i),guildId:(\i)\?\.id,title:)(\i)(?=,subtitle:.{0,200}?displayNameFont:1===\i\.length)/,
                    replace: "$self.getActiveNowNameElement({user:$1.user,guildId:$2?.id,isHovered:arguments[0].smynHovered})??$3"
                },
                {
                    // Add local hover state to each Active Now card.
                    match: /(hasStaffQuestActivityPanelOverride:\i}=\i,\i=(\i)\.useRef\(null\),\[\i,\i\]=\2\.useState\(null\))/,
                    replace: "$1,[smynHovered,setSmynHovered]=$2.useState(!1)"
                },
                {
                    // Pass the card hover state to its title renderer.
                    match: /(?<=\(0,\i\.jsx\)\(\i,\{party:\i,onUserContextMenu:\i,quest:\i)(?=}\))/,
                    replace: ",smynHovered"
                },
                {
                    // Update local hover state while preserving Discord's handlers.
                    match: /(?<=\{\.\.\.(\i),ref:\i,)onMouseEnter:(\i)(?=,"aria-haspopup":"menu",className:)/,
                    replace: "onMouseEnter:smynEvent=>{$2(smynEvent);setSmynHovered(!0)},onMouseLeave:smynEvent=>{$1.onMouseLeave?.(smynEvent);setSmynHovered(!1)}"
                }
            ],
        },
        {
            // Replace name in solo DM title bar and tooltip.
            find: "channel.isSystemDM(),",
            replacement: {
                match: /(?<=(\i\.\i\.getUser).{650,750}length>0,\i=\i&&null!=\i&&!\i,)(\i=)(.{0,125}?"aria-label":)(\i.\i.getName\(\i\).{0,1700}?text:)(?=\i,position)/,
                replace: "smynName=arguments[0].channel.recipients.length===1?$self.getTypingMemberListProfilesReactionsVoiceNameText({user:$1(arguments[0].channel.recipients[0]),type:\"profilesPopout\"})??null:null,$2smynName??$3smynName??$4smynName??"
            },
        },
        {
            // Track message hover to animate display name effects.
            // Attach the group ID so every name in a grouped message animates together.
            find: "CUSTOM_GIFT?\"\":",
            replacement: [
                {
                    match: /(hasHovered:\i,isHovered:(\i).{0,2000})(let \i=\i.id===\i,\i=)/,
                    replace: "$1arguments[0].message.showMeYourNameGroupId=!!arguments[0].groupId?`g-${arguments[0].groupId}`:null;$self.handleHoveringMessage(arguments[0].message,$2);$3",
                },
            ],
        },
        {
            // Replace names in mentions.
            find: ".USER_MENTION)",
            group: true,
            replacement: [
                {
                    match: /(?=function \i\(\i\){return\(0)/,
                    replace: "const showMeYourNameMention=$self.getMentionNameElement(arguments[0]);"
                },
                {
                    match: /(?<=onContextMenu:\i,\.\.\.\i,children:)/,
                    replace: "showMeYourNameMention??",
                    predicate: () => !isPluginEnabled(mentionAvatars.name),
                }
            ]
        },
        {
            // Pass on the props to the mention renderer so that hovering second-level
            // message mentions can accurately be tracked based on props.messageId
            find: "noStyleAndInteraction},",
            replacement: {
                match: /(className:"mention",)/,
                replace: "$1props:arguments[2],"
            }
        },
        {
            // Replace names in the member list.
            find: "let{colorRoleName:",
            replacement: {
                match: /(let{colorRoleName:\i,colorString:\i,colorStrings:\i,)name:(\i)/,
                replace: "$1showMeYourNameName:$2=$self.getTypingMemberListProfilesReactionsVoiceNameText({...arguments[0],type:\"membersList\"})??(arguments[0].name)"
            }
        },
        {
            // Replace names in profile popouts.
            find: "shouldWrap:!0,loop:!0,inProfile:!0",
            replacement: {
                match: /displayName:(\i),(?=trailing:\i,|size:\i=|displayNameSize:\i)/g,
                replace: "showMeYourNameNickname:$1=$self.getTypingMemberListProfilesReactionsVoiceNameText({...arguments[0],type:\"profilesPopout\"})??(arguments[0].nickname),"
            },
        },
        {
            // Replace names in the profile tooltip for switching between guild and global profiles.
            // You must open a profile modal before the code this is patching will be searchable.
            find: 'id:"view-server-profile",',
            group: true,
            replacement: [
                {
                    match: /(displayName:)(\i.\i.getName\(void 0,void 0,\i\))/,
                    replace: "$1$self.getTypingMemberListProfilesReactionsVoiceNameText({user:arguments[0].user,guildId:null,type:\"profilesTooltip\"})??($2)"
                },
                {
                    match: /(displayName:)(\i.\i.getName\(\i,\i,\i\))/,
                    replace: "$1$self.getTypingMemberListProfilesReactionsVoiceNameText({user:arguments[0].user,guildId:arguments[0].guildId,type:\"profilesTooltip\"})??($2)"
                }
            ]
        },
        {
            // Replace names in reaction tooltips.
            find: "reactionTooltip1,",
            replacement: {
                match: /(\i.\i.getName\((\i),\i\?\.id,(\i)\))/,
                replace: "$self.getTypingMemberListProfilesReactionsVoiceNameText({user:$3,guildId:$2,type:\"reactionsTooltip\"})??($1)"
            }
        },
        {
            // Replace reaction-popout names and track hover per reactor row.
            find: ".MESSAGE,userId:",
            group: true,
            replacement: [
                {
                    // Add local hover state to each reactor row.
                    match: /(function \i\(\i\)\{let\{emoji:\i,user:\i,message:\i,channel:\i,guildId:\i,reactionType:\i,onRemoveReactor:\i\}=\i,)/,
                    replace: "$1[smynHovered,setSmynHovered]=$self.useNameHoverState(),"
                },
                {
                    // Update hover state from the full reactor row.
                    match: /(?<=\(0,\i.\i\)\(\i.\i,{className:\i.\i,)(?=(?:align:\i\.\i\.\i\.CENTER|onContextMenu:\i=>))/g,
                    replace: "onMouseEnter:()=>setSmynHovered(!0),onMouseLeave:()=>setSmynHovered(!1),"
                },
                {
                    // Replace names in reaction popouts.
                    match: /(?<=Child,{className:\i.\i,children:)/g,
                    replace: "($self.getTypingMemberListProfilesReactionsVoiceNameElement({user:arguments[0].user,guildId:arguments[0].guildId,type:\"reactionsPopout\",isHovered:smynHovered}))??"
                }
            ]
        },
        {
            // Replace names in voice channels.
            find: ",connectUserDragSource:",
            replacement: {
                match: /(serverDeaf:\i,)nick:(\i)/,
                replace: "$1showMeYourNameVoice:$2=$self.getTypingMemberListProfilesReactionsVoiceNameText({user:arguments[0].user,guildId:arguments[0].channel.guild_id,type:\"voiceChannel\"})??(arguments[0].nick)"
            }
        }
    ],

    async start() {
        toCSSCache = new Map();
        toCSSProbe = document.createElement("div");
        convertToRGBCanvas = document.createElement("canvas");
        convertToRGBCanvas.width = convertToRGBCanvas.height = 1;
        convertToRGBCtx = convertToRGBCanvas.getContext("2d", { willReadFrequently: true });
        convertToRGBCache = new Map();

        const data = await DataStore.get<CustomNicknameData>("SMYNCustomNicknames");
        customNicknames = data ?? {};
    },

    stop() {
        toCSSCache?.clear();
        toCSSCache = null;
        toCSSProbe = null;
        convertToRGBCache?.clear();
        convertToRGBCache = null;
        convertToRGBCanvas = null;
        convertToRGBCtx = null;
    },

    contextMenus: {
        "user-context": userContextPatch
    },

    flux: {
        RELATIONSHIP_UPDATE: triggerNameRerender,
        RUNNING_STREAMER_TOOLS_CHANGE: triggerNameRerender,
        ACCESSIBILITY_SET_DISPLAY_NAME_STYLES_ENABLED: triggerNameRerender,
        ACCESSIBILITY_SYSTEM_PREFERS_REDUCED_MOTION_CHANGED: triggerNameRerender,
        ACCESSIBILITY_SET_PREFERS_REDUCED_MOTION: triggerNameRerender,
    },

    addHoveringMessage,
    removeHoveringMessage,
    handleHoveringMessage,
    useNameHoverState,
    getMessageName,
    getMessageNameText,
    getMessageNameElement,
    getMentionNameElement,
    getActiveNowNameElement,
    getDisplayNameEffectClassName,
    getDisplayNameEffectDisplayType,
    shouldAnimateNameEffects,
    getTypingMemberListProfilesReactionsVoiceNameText,
    getTypingMemberListProfilesReactionsVoiceNameElement
});
