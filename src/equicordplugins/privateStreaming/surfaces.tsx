/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { filters, findAll, mapMangledCssClasses, moduleListeners } from "@webpack";
import { React } from "@webpack/common";

import { PrivacyContext, PrivacyMask, usePrivacyState } from "./privacy";
import { type BlurOptions, blurOptions } from "./targets";

type Hint = keyof BlurOptions | "wholeItem" | "media" | "profile" | "activity" | "names" | "dm" | "ownAccount" | "clear" | "hoverControls" | "channelTitle" | "serverHeader" | "text" | "attachment";

const classGroups: Partial<Record<Hint, readonly string[]>> = {
    blurNames: ["username", "displayName", "nickname", "nameTag", "userTag", "recipient", "recipientName", "participantName"],
    blurAvatars: ["avatar", "avatarWrapper", "avatarStack", "voiceCallAvatar"],
    blurMessages: ["messageContent", "repliedTextContent", "embedTitle", "embedDescription", "embedFieldName", "embedFieldValue", "embedFooterText", "markup", "userBio", "customStatusText", "activityDetails", "activityState", "typing"],
    blurPhotos: ["stickerAsset"],
    blurVideos: ["video", "videoWrapper", "videoContainer"],
    blurFiles: ["file", "fileName", "fileWrapper"],
    attachment: ["attachment"],
    blurReactions: ["reaction"],
    blurServerNames: ["guildName", "folderName"],
    blurServerIcons: ["guildIcon", "folderPreview", "folderIcon", "expandedFolderIconWrapper"],
    blurChannels: ["channelName", "threadName", "topic"],
    blurComposer: ["channelTextArea"],
    blurFriends: ["peopleColumn", "peopleList", "peopleListItem"],
    blurDMs: ["privateChannels"],
    blurMembers: ["membersWrap", "member", "membersGroup"],
    blurProfiles: ["userProfileOuter", "userProfileInner", "userPopoutOuter", "userPanelOuter", "profilePanel", "biteSizeOuter", "fullSizeOuter"],
    blurActivity: ["nowPlayingColumn", "nowPlayingSidebar"],
    blurVoice: ["voiceUser", "voiceUserSummary", "voiceCallAvatar"],
    blurEmbeds: ["embed"],
    blurSearch: ["searchResult", "searchResultsWrap", "autocompleteRow"],
    blurNotifications: ["notification", "notificationContent", "toast"],
    wholeItem: ["message", "member", "peopleListItem", "voiceUser", "voiceUserSummary", "searchResult", "autocompleteRow", "notification", "notificationContent", "toast", "userProfileOuter", "userProfileInner", "userPopoutOuter", "userPanelOuter", "profilePanel", "biteSizeOuter", "fullSizeOuter"],
    media: ["message", "mediaViewer", "imageModal", "modalCarouselWrapper", "carouselModal", "userProfileOuter", "userProfileInner", "userPopoutOuter", "profilePanel", "searchResult"],
    profile: ["userProfileOuter", "userProfileInner", "userPopoutOuter", "userPanelOuter", "profilePanel", "biteSizeOuter", "fullSizeOuter"],
    activity: ["nowPlayingColumn", "nowPlayingSidebar"],
    names: ["peopleListItem", "member", "voiceUser", "userInfo", "userInfoSection"],
    ownAccount: ["accountPopoutButtonWrapper", "accountPopoutButton"],
    channelTitle: ["chat", "chatContent", "subtitleContainer"],
    serverHeader: ["headerContent"],
    text: ["repliedMessage", "embed", "notification", "notificationContent", "toast", "searchResult", "autocompleteRow"],
    clear: ["pictureInPicture", "pictureInPictureWindow"],
    hoverControls: ["buttons", "buttonsInner", "buttonContainer", "messageButtons", "hoverBar", "typingDots"]
};

const classRules = [...new Set(Object.values(classGroups).flat())].map(name => ({
    name,
    filter: filters.byClassNames(name),
    hints: Object.entries(classGroups).filter(([, names]) => names.includes(name)).map(([hint]) => hint as Hint)
}));
const classHints = new Map<string, { tokens: string[]; hints: Hint[]; }[]>();
const accountFilter = filters.byClassNames("iconForeground", "accountPopoutButtonWrapper", "container");
let listening = false;
let initialized = false;

function isCssModule(value: unknown): value is Record<string, string> {
    if (!value || typeof value !== "object") return false;
    const values = Object.values(value);
    return values.length > 0 && values.every(item => typeof item === "string");
}

function bindClasses(value: unknown) {
    if (!isCssModule(value)) return;
    bindSecondaryClasses(value);
    if (accountFilter(value)) {
        const tokens = mapMangledCssClasses(value, ["container"]).container.split(/\s+/);
        classHints.set(tokens[0], [{ tokens, hints: ["ownAccount"] }]);
    }
    for (const { name, filter, hints } of classRules) {
        if (!filter(value)) continue;
        const tokens = mapMangledCssClasses(value, [name])[name].split(/\s+/);
        const bindings = classHints.get(tokens[0]) ?? [];
        if (bindings.some(binding => binding.tokens.join(" ") === tokens.join(" ") && binding.hints[0] === hints[0])) continue;
        bindings.push({ tokens, hints });
        classHints.set(tokens[0], bindings);
    }
}

export function startSurfaces() {
    if (listening) return;
    initialized = true;
    listening = true;
    for (const module of findAll(isCssModule, { topLevelOnly: true })) bindClasses(module);
    moduleListeners.add(bindClasses);
}

export function stopSurfaces() {
    moduleListeners.delete(bindClasses);
    listening = false;
}

interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
    elementType: keyof React.JSX.IntrinsicElements;
    src?: string;
    href?: string;
    poster?: string;
    "data-list-item-id"?: string;
    "data-slate-editor"?: boolean;
    "data-vc-private-streaming"?: boolean;
}

function getHints(props: React.HTMLAttributes<HTMLElement>) {
    const tokens = new Set(props.className?.split(/\s+/));
    const hints = new Set<Hint>();
    for (const token of tokens) {
        for (const binding of classHints.get(token) ?? []) {
            if (binding.tokens.every(part => tokens.has(part))) for (const hint of binding.hints) hints.add(hint);
        }
    }
    if (tokens.has("vc-message-peek-preview")) { hints.add("dm"); hints.add("blurDMs"); }
    if (tokens.has("vc-betterinbox-entry")) { hints.add("wholeItem"); hints.add("media"); hints.add("text"); }
    if (tokens.has("vc-betterinbox-plain")) hints.add("text");
    if (tokens.has("vc-betterinbox-plain-name")) hints.add("blurNames");
    if (tokens.has("vc-betterinbox-plain-avatar")) hints.add("blurAvatars");
    if (tokens.has("vc-betterinbox-plain-text")) hints.add("blurMessages");
    if (tokens.has("vc-pvm-origin")) hints.add("blurChannels");
    return hints;
}

function contentIdentity(value: unknown, depth = 0): string {
    if (depth > 12 || value == null || typeof value === "boolean" || typeof value === "function") return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return String(value);
    if (Array.isArray(value)) return value.map(child => contentIdentity(child, depth + 1)).join("\u001f");
    if (typeof value !== "object") return "";
    if ("props" in value && value.props && typeof value.props === "object") return contentIdentity(value.props, depth + 1);
    const props = value as Record<string, unknown>;
    if (props.role === "toolbar" || getHints(props).has("hoverControls")) return "";
    const style = props.style && typeof props.style === "object" ? props.style as React.CSSProperties : undefined;
    return ["id", "src", "srcSet", "href", "poster", "data-list-item-id", "data-user-id", "data-channel-id", "data-guild-id", "children", "content", "message", "attachments", "embeds", "author", "username", "globalName", "name", "description", "title", "value", "text", "url"].map(key => contentIdentity(props[key], depth + 1)).join("\u001e")
        + mediaStyles.map(key => style?.[key] ?? "").join("\u001e");
}

function hasMedia(value: unknown, depth = 0): boolean {
    if (depth > 12 || !value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(child => hasMedia(child, depth + 1));
    if (!("props" in value) || !value.props || typeof value.props !== "object") return false;
    const props = value.props as Record<string, unknown>;
    const type = props.elementType ?? ("type" in value ? value.type : undefined);
    return type === "img" || type === "video" || hasMedia(props.children, depth + 1);
}

function Surface({ elementType, ...props }: SurfaceProps) {
    const parent = React.useContext(PrivacyContext);
    const options = usePrivacyState(state => state.options);
    const hints = getHints(props);
    const listId = props["data-list-item-id"] ?? "";
    if (listId.startsWith("private-channels-") || props.href?.startsWith("/channels/@me/")) hints.add("blurDMs");
    if (listId.startsWith("members-")) { hints.add("blurMembers"); hints.add("names"); }
    if (listId.startsWith("channels___")) hints.add("channelTitle");
    if (props.id?.startsWith("chat-messages-") || listId.startsWith("chat-messages")) { hints.add("wholeItem"); hints.add("media"); }
    if (props.id?.startsWith("message-content-")) hints.add("blurMessages");
    if (/^guildsnav___\d/.test(listId)) hints.add("blurServerIcons");
    if (props.role === "tooltip") hints.add("blurTooltips");
    if (props["data-slate-editor"]) hints.add("blurComposer");
    const plainText = typeof props.children === "string" || typeof props.children === "number";
    if (plainText && props.href?.startsWith("/channels/") && !props.href.startsWith("/channels/@me")) hints.add("blurChannels");
    if (hints.has("attachment") && !hasMedia(props.children)) hints.add("blurFiles");
    const areas: (keyof BlurOptions)[] = ["blurFriends", "blurDMs", "blurMembers", "blurProfiles", "blurActivity", "blurVoice", "blurEmbeds", "blurSearch", "blurNotifications"];
    const context = {
        ...parent,
        allowed: parent.allowed && !hints.has("clear") && (!hints.has("ownAccount") || options.blurOwnAccount === true)
            && areas.every(area => !hints.has(area) || options[area] !== false),
        media: parent.media || hints.has("media"),
        imageKind: hints.has("blurAvatars") ? "blurAvatars" as const : hints.has("blurServerIcons") ? "blurServerIcons" as const : parent.imageKind,
        profile: parent.profile || hints.has("profile"),
        activity: parent.activity || hints.has("activity"),
        names: parent.names || hints.has("names") || hints.has("blurDMs"),
        dm: parent.dm || hints.has("dm"),
        channelTitle: parent.channelTitle || hints.has("channelTitle"),
        nav: parent.nav || elementType === "nav",
        serverHeader: parent.serverHeader || hints.has("serverHeader") || (parent.nav && elementType === "header"),
        text: parent.text || hints.has("text")
    };
    const tokens = new Set(props.className?.split(/\s+/));
    if ((context.names && classHas(props, ["name", "nameText"])) || ((hints.has("names") || hints.has("blurDMs") || hints.has("blurVoice"))
        && plainText)) hints.add("blurNames");
    if (context.serverHeader && classHas(props, ["name", "headerText"])) hints.add("blurServerNames");
    if (context.channelTitle && classHas(props, ["name", "linkTop", "titleWrapper", "titleText"])) hints.add("blurChannels");
    if ((hints.has("text") && plainText) || (context.text && classHas(props, ["content", "description", "text", "searchAnswer", "searchFilter"]))) hints.add("blurMessages");
    if (context.profile && (elementType === "p" || classHas(props, ["aboutMe", "pronouns", "statusText"]))) hints.add("blurMessages");
    if (context.activity) {
        if (classHas(props, ["headerTitle", "headerText", "headerFull", "headerName", "partyMember"])) hints.add("blurNames");
        if (classHas(props, ["sectionTitle", "voiceSectionDetails", "textContent"])) hints.add("blurMessages");
        if (classHas(props, ["activityName"])) hints.add("blurServerNames");
        if (classHas(props, ["channelInfo"])) hints.add("blurChannels");
    }
    if (context.dm && elementType === "span" && !tokens.has("vc-message-peek-icon")) hints.add("blurDMPreviews");
    if (elementType === "img" || elementType === "image") {
        const src = props.src ?? props.href ?? "";
        if (context.imageKind) hints.add(context.imageKind);
        else if (/\/(?:avatars|embed\/avatars)\//.test(src) || /\/guilds\/[^/]+\/users\//.test(src)) hints.add("blurAvatars");
        else if (/\/(?:icons)\//.test(src)) hints.add("blurServerIcons");
        else if (context.media && !classHas(props, ["emoji"])) hints.add("blurPhotos");
    }
    if (context.media && elementType === "canvas") hints.add("blurPhotos");
    if (context.media && elementType === "video") hints.add("blurVideos");
    const kinds: (keyof BlurOptions)[] = ["blurDMPreviews", "blurServerIcons", "blurAvatars", "blurNames", "blurMessages", "blurPhotos", "blurVideos", "blurFiles", "blurReactions", "blurServerNames", "blurChannels", "blurComposer", "blurTooltips"];
    const kind = hints.has("wholeItem") && Object.keys(blurOptions).filter(key => key !== "hideWindowTitle").every(key => options[key as keyof BlurOptions] !== false)
        ? "wholeItem"
        : kinds.find(key => hints.has(key) && options[key] !== false);
    return <PrivacyContext.Provider value={context}><PrivacyMask {...props} as={elementType} kind={kind} identity={contentIdentity(props)} /></PrivacyContext.Provider>;
}

const ScopedSurface = ErrorBoundary.wrap(Surface, { noop: true });
interface PortalScopeProps {
    children?: React.ReactNode;
}

const PortalScope = ErrorBoundary.wrap(function PortalScope({ children }: PortalScopeProps) {
    return <PrivacyContext.Provider value={{ allowed: true, masked: false }}>{children}</PrivacyContext.Provider>;
}, { noop: true });

export function portalContents(children: React.ReactNode) {
    return React.createElement(PortalScope, null, children);
}

const secondaryClasses = ["name", "nameText", "aboutMe", "pronouns", "statusText", "headerTitle", "headerText", "headerFull", "headerName", "partyMember", "sectionTitle", "voiceSectionDetails", "textContent", "activityName", "channelInfo", "emoji", "truncated", "linkTop", "titleWrapper", "titleText", "content", "description", "text", "searchAnswer", "searchFilter"];

function classHas(props: React.HTMLAttributes<HTMLElement>, names: readonly string[]) {
    const tokens = new Set(props.className?.split(/\s+/));
    return names.some(name => secondaryBindings.get(name)?.some(binding => binding.every(token => tokens.has(token))));
}

const secondaryBindings = new Map<string, string[][]>();
const secondaryRules = secondaryClasses.map(name => ({ name, filter: filters.byClassNames(name) }));
function bindSecondaryClasses(value: unknown) {
    if (!isCssModule(value)) return;
    for (const { name, filter } of secondaryRules) {
        if (!filter(value)) continue;
        const bindings = secondaryBindings.get(name) ?? [];
        const tokens = mapMangledCssClasses(value, [name])[name].split(/\s+/);
        if (!bindings.some(binding => binding.join(" ") === tokens.join(" "))) bindings.push(tokens);
        secondaryBindings.set(name, bindings);
    }
}

type ElementFactory = (...args: unknown[]) => React.ReactElement;
const mediaStyles = ["backgroundImage", "content", "listStyleImage", "borderImageSource", "maskImage", "WebkitMaskImage"] as const;

export function renderHost(type: React.ElementType, props: SurfaceProps, key: string | null, factory: ElementFactory, keyFirst = false) {
    const create = (tag: React.ElementType, value: React.HTMLAttributes<HTMLElement>) => keyFirst ? factory(tag, key, value) : factory(tag, value, key);
    if (typeof type !== "string" || props?.["data-vc-private-streaming"]) return create(type, props);
    if (!initialized) startSurfaces();
    if (!getHints(props).size && !classHas(props, secondaryClasses) && !props.title && !props.id && !props.src && !props.href && !props["data-list-item-id"] && !mediaStyles.some(key => props.style?.[key])
        && props.role !== "tooltip" && !props["data-slate-editor"] && type !== "video" && type !== "canvas" && type !== "p" && type !== "nav" && type !== "header") return create(type, props);
    return create(ScopedSurface, { ...props, elementType: type } as SurfaceProps);
}
