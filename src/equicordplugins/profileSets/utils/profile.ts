/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUserSettingLazy } from "@api/UserSettings";
import { AvatarDecorationData, CustomStatus, DisplayNameStyles, Nameplate, ProfileEffect, ProfilePreset, User } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { FluxDispatcher, GuildMemberStore, IconUtils, UserProfileStore, UserStore, UsernameUtils } from "@webpack/common";
import virtualMerge from "virtual-merge";

import { normalizeImageValue, resolvePendingAvatarUrl } from "./previewImage";
import { notifyPreviewApply } from "./previewSync";
import { applyThemeForLoadedPreset } from "./themes";

export { normalizeImageValue, resolvePendingAvatarUrl } from "./previewImage";

const UserProfileSettingsStore = findStoreLazy("UserProfileSettingsStore");
const CustomStatusSettings = getUserSettingLazy("status", "customStatus")!;

type PendingChanges = Record<string, unknown> & {
    pendingAvatar?: ImageInput;
    pendingBanner?: ImageInput;
    pendingAvatarDecoration?: AvatarDecorationLike | null;
    pendingProfileEffect?: ProfileEffect | null;
    pendingNameplate?: Nameplate | null;
    pendingDisplayNameStyles?: DisplayNameStyles | null;
    pendingAccentColor?: number | null;
    pendingThemeColors?: number[] | null;
    pendingBio?: string | null;
    pendingPronouns?: string | null;
    pendingNickname?: string | null;
    pendingGlobalName?: string | null;
    pendingPrimaryGuildId?: string | null;
};

type ImageInput = string | { imageUri: string; [key: string]: unknown; } | null | undefined;
type AvatarDecorationLike = AvatarDecorationData & {
    label?: string;
    type?: number;
};
type DisplayNameStylesLike = DisplayNameStyles & {
    fontId?: number;
    effectId?: number;
};

type CurrentProfileOptions = {
    isGuildProfile?: boolean;
};

type LoadPresetOptions = {
    skipGlobalName?: boolean;
    skipBio?: boolean;
    skipPronouns?: boolean;
    isGuildProfile?: boolean;
};

function dispatch(type: string, payload: Record<string, unknown> = {}) {
    FluxDispatcher.dispatch({ type, ...payload });
}

function setPendingChanges(payload: Record<string, unknown>, guildId?: string) {
    dispatch("USER_PROFILE_SETTINGS_SET_PENDING_CHANGES", guildId ? { guildId, ...payload } : payload);
}

function openProfileImagePreview(
    uploadType: "AVATAR" | "BANNER",
    image: Extract<ImageInput, { imageUri: string; }>,
    guildId?: string
) {
    dispatch("PROFILE_CUSTOMIZATION_OPEN_PREVIEW_MODAL", {
        image,
        file: {},
        uploadType,
        guildId,
        analyticsSource: guildId ? "user settings guild profile" : "user settings user profile",
        isTryItOut: false
    });
}

export function initProfileSettingsContext(guildId?: string) {
    dispatch("USER_PROFILE_SETTINGS_INIT", { guildId: guildId ?? null });
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

function hasImageInput(value: ImageInput): boolean {
    if (!value) return false;
    if (typeof value === "string") return value.length > 0;
    return typeof value === "object" && isNonEmptyString(value?.imageUri);
}

function hasAvatarDecoration(value: unknown): value is AvatarDecorationLike {
    return typeof value === "object"
        && value != null
        && "asset" in value
        && "skuId" in value
        && isNonEmptyString((value as { asset?: unknown; }).asset)
        && isNonEmptyString((value as { skuId?: unknown; }).skuId);
}

export function resolveNameplatePreviewUserValue(
    userValue: User,
    guildId?: string,
    pending?: Pick<PendingChanges, "pendingGlobalName" | "pendingNickname" | "pendingDisplayNameStyles"> | null
): User {
    const current = UserStore.getCurrentUser();
    const base = current?.id === userValue.id ? current : userValue;

    const pendingName = guildId
        ? pending?.pendingNickname ?? GuildMemberStore.getMember(guildId, base.id)?.nick
        : pending?.pendingGlobalName;

    const resolvedName = (typeof pendingName === "string" && pendingName.length ? pendingName : null)
        ?? UsernameUtils.getGlobalName(base)
        ?? base.globalName
        ?? base.username;

    const patch: Partial<User> = { globalName: resolvedName };
    if (userValue.collectibles) patch.collectibles = userValue.collectibles;

    let displayNameStyles: User["displayNameStyles"] | undefined = pending?.pendingDisplayNameStyles !== undefined
        ? pending.pendingDisplayNameStyles as User["displayNameStyles"]
        : userValue.displayNameStyles ?? base.displayNameStyles;

    if (displayNameStyles === undefined && guildId) {
        displayNameStyles = GuildMemberStore.getMember(guildId, base.id)?.displayNameStyles;
    }

    if (displayNameStyles !== undefined) {
        patch.displayNameStyles = displayNameStyles;
    }

    return virtualMerge(base, patch) as User;
}

export function normalizeNameplateLike(value: unknown): Nameplate | null {
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    const skuIdRaw = v.skuId ?? v.sku_id;
    const assetRaw = v.asset;
    if (typeof skuIdRaw !== "string" && typeof skuIdRaw !== "number") return null;
    if (typeof assetRaw !== "string" || !assetRaw.length) return null;
    const label = typeof v.label === "string" ? v.label : undefined;
    const palette = typeof v.palette === "string" ? v.palette : undefined;
    const type = typeof v.type === "number" ? v.type : 2;
    return {
        skuId: skuIdRaw,
        asset: assetRaw,
        ...(label ? { label } : {}),
        ...(palette ? { palette } : {}),
        type
    } as Nameplate;
}

function normalizeDisplayNameStyles(value: DisplayNameStylesLike | null | undefined): DisplayNameStylesLike | null {
    if (!value) return null;
    const fontId = value.fontId ?? value.font_id;
    const effectId = value.effectId ?? value.effect_id;
    if (typeof fontId !== "number" || typeof effectId !== "number") return null;
    const colors = Array.isArray(value.colors) ? [...value.colors] : [];

    return {
        fontId,
        effectId,
        font_id: fontId,
        effect_id: effectId,
        colors
    };
}

export async function imageUrlToBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

async function processImage(imageData: ImageInput, userId: string, type: "avatar" | "banner", guildId?: string, useGuildPath?: boolean): Promise<string | null> {
    if (!imageData) return null;

    if (typeof imageData === "object" && isNonEmptyString(imageData?.imageUri)) {
        return imageData.imageUri;
    }

    if (typeof imageData === "string") {
        if (imageData.startsWith("data:")) return imageData;
        if (/^https?:\/\//.test(imageData)) {
            return await imageUrlToBase64(imageData);
        }

        const isAnimated = imageData.startsWith("a_");

        if (type === "banner") {
            const bannerUrl = useGuildPath && guildId
                ? IconUtils.getGuildMemberBannerURL?.({
                    id: userId,
                    guildId,
                    banner: imageData,
                    canAnimate: isAnimated,
                    size: 1024
                })
                : IconUtils.getUserBannerURL?.({
                    id: userId,
                    banner: imageData,
                    canAnimate: isAnimated,
                    size: 1024
                });
            if (bannerUrl) {
                const fromUtils = await imageUrlToBase64(bannerUrl);
                if (fromUtils) return fromUtils;
            }
        }

        const size = type === "banner" ? 1024 : 512;
        const urlPath = type === "banner" ? "banners" : "avatars";
        const guildPath = guildId ? `guilds/${guildId}/users/${userId}/${type === "banner" ? "banners" : "avatars"}` : urlPath;
        const guildUrl = `https://cdn.discordapp.com/${guildPath}/${imageData}.${isAnimated ? "gif" : "png"}?size=${size}`;
        const globalUrl = `https://cdn.discordapp.com/${urlPath}/${userId}/${imageData}.${isAnimated ? "gif" : "png"}?size=${size}`;
        if (useGuildPath && guildId) {
            const guildResult = await imageUrlToBase64(guildUrl);
            if (guildResult) return guildResult;
        }
        return await imageUrlToBase64(globalUrl);
    }

    return null;
}

export async function getCurrentProfile(guildId?: string, options: CurrentProfileOptions = {}): Promise<Omit<ProfilePreset, "name" | "timestamp">> {
    const currentUser = UserStore.getCurrentUser();
    const baseProfile = UserProfileStore.getUserProfile(currentUser.id);
    const isGuildProfile = options.isGuildProfile ?? Boolean(guildId);
    const effectiveGuildId = isGuildProfile ? guildId : undefined;
    const guildProfile = effectiveGuildId ? UserProfileStore.getGuildMemberProfile(currentUser.id, effectiveGuildId) : null;
    const userProfile = guildProfile ?? baseProfile;
    const userAny = currentUser;
    const guildMember = effectiveGuildId ? GuildMemberStore.getMember(effectiveGuildId, currentUser.id) : null;

    const pendingChangesDefault: PendingChanges = UserProfileSettingsStore.getPendingChanges() ?? {};
    const pendingChangesForGuild: PendingChanges = UserProfileSettingsStore.getPendingChanges(effectiveGuildId) ?? {};
    const pendingChanges: PendingChanges = isGuildProfile && Object.keys(pendingChangesForGuild).length > 0
        ? pendingChangesForGuild
        : pendingChangesDefault;
    const customStatusSetting = CustomStatusSettings.getSetting();
    const customStatus = isGuildProfile
        ? null
        : {
            text: customStatusSetting?.text ?? "",
            emojiId: customStatusSetting?.emojiId ?? "0",
            emojiName: customStatusSetting?.emojiName ?? "",
            expiresAtMs: customStatusSetting?.expiresAtMs ?? "0"
        };

    const avatarDecorationSource = pendingChanges.pendingAvatarDecoration
        ?? (isGuildProfile ? guildMember?.avatarDecoration : userAny.avatarDecorationData);
    const avatarDecoration = hasAvatarDecoration(avatarDecorationSource)
        ? {
            ...avatarDecorationSource,
            asset: avatarDecorationSource.asset,
            skuId: avatarDecorationSource.skuId
        }
        : null;

    let profileEffect: ProfileEffect | null = null;
    const effectToUse = pendingChanges.pendingProfileEffect ?? userProfile?.profileEffect;

    if (effectToUse) {
        if (effectToUse.skuId && effectToUse.effects) {
            profileEffect = {
                skuId: effectToUse.skuId,
                title: effectToUse.title,
                description: effectToUse.description,
                accessibilityLabel: effectToUse.accessibilityLabel,
                reducedMotionSrc: effectToUse.reducedMotionSrc,
                thumbnailPreviewSrc: effectToUse.thumbnailPreviewSrc,
                effects: effectToUse.effects,
                animationType: effectToUse.animationType,
                staticFrameSrc: effectToUse.staticFrameSrc,
                type: effectToUse.type || 1
            };
        } else if (effectToUse.skuId) {
            const collectibles = userProfile?.collectibles;
            const collectible = collectibles?.find(c => c?.skuId === effectToUse.skuId);
            if (collectible) {
                profileEffect = {
                    skuId: collectible.skuId,
                    title: collectible.title,
                    description: collectible.description,
                    accessibilityLabel: collectible.accessibilityLabel,
                    reducedMotionSrc: collectible.reducedMotionSrc,
                    thumbnailPreviewSrc: collectible.thumbnailPreviewSrc,
                    effects: collectible.effects,
                    animationType: collectible.animationType,
                    staticFrameSrc: collectible.staticFrameSrc,
                    type: collectible.type || 1
                };
            }
        }
    }

    const nameplateToUse = pendingChanges.pendingNameplate
        ?? guildMember?.collectibles?.nameplate
        ?? userAny.collectibles?.nameplate;
    const nameplate = normalizeNameplateLike(nameplateToUse);

    const savedDisplayNameStyles = isGuildProfile
        ? (guildMember?.displayNameStyles ?? userAny.displayNameStyles)
        : userAny.displayNameStyles;
    const displayNameStylesToUse = pendingChanges.pendingDisplayNameStyles ?? savedDisplayNameStyles;
    const displayNameStyles = normalizeDisplayNameStyles(displayNameStylesToUse);

    const { pendingAvatar } = pendingChanges;
    const avatarToUse: ImageInput = hasImageInput(pendingAvatar)
        ? pendingAvatar
        : (isGuildProfile ? (guildMember?.avatar ?? currentUser.avatar ?? null) : (currentUser.avatar ?? null));

    const useGuildAvatar = !!(effectiveGuildId && isGuildProfile && guildMember?.avatar && avatarToUse === guildMember.avatar);

    const avatarInput: ImageInput = hasImageInput(avatarToUse)
        ? avatarToUse
        : IconUtils.getUserAvatarURL(currentUser, true, 512);
    const avatarDataUrl = await processImage(avatarInput, currentUser.id, "avatar", effectiveGuildId, useGuildAvatar);
    const resolvedAvatarDataUrl = avatarDataUrl ?? IconUtils.getDefaultAvatarURL(currentUser.id);

    const pendingBanner = pendingChanges.pendingBanner ?? (pendingChanges as { banner?: ImageInput; }).banner;
    const bannerToUse: ImageInput = hasImageInput(pendingBanner)
        ? pendingBanner
        : (isGuildProfile
            ? (guildProfile?.banner ?? baseProfile?.banner)
            : (baseProfile?.banner ?? currentUser.banner ?? null));
    const useGuildBanner = !!(effectiveGuildId && isGuildProfile && guildProfile?.banner && bannerToUse === guildProfile?.banner);

    const bannerDataUrl = await processImage(bannerToUse, currentUser.id, "banner", effectiveGuildId, useGuildBanner);

    return {
        avatarDataUrl: resolvedAvatarDataUrl,
        bannerDataUrl,
        bio: pendingChanges.pendingBio ?? userProfile?.bio ?? null,
        accentColor: pendingChanges.pendingAccentColor ?? userProfile?.accentColor ?? null,
        themeColors: pendingChanges.pendingThemeColors ?? userProfile?.themeColors ?? null,
        globalName: isGuildProfile
            ? (pendingChanges.pendingNickname ?? guildMember?.nick ?? null)
            : (pendingChanges.pendingGlobalName ?? currentUser.globalName ?? null),
        pronouns: pendingChanges.pendingPronouns ?? userProfile?.pronouns ?? null,
        avatarDecoration,
        profileEffect,
        nameplate,
        primaryGuildId: isGuildProfile
            ? null
            : (pendingChanges.pendingPrimaryGuildId ?? userAny.primaryGuild?.identityGuildId ?? null),
        customStatus,
        displayNameStyles
    };
}

function jsonEq(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    return JSON.stringify(a) === JSON.stringify(b);
}

function customStatusEq(a: CustomStatus | null | undefined, b: CustomStatus | null | undefined): boolean {
    if (a == null || b == null) return a == null && b == null;
    return a.text === b.text
        && String(a.emojiId ?? "") === String(b.emojiId ?? "")
        && a.emojiName === b.emojiName
        && String(a.expiresAtMs ?? "0") === String(b.expiresAtMs ?? "0");
}

function resolvePendingAvatar(pendingChanges: PendingChanges | null): ImageInput {
    if (!pendingChanges) return null;

    return hasImageInput(pendingChanges.pendingAvatar) ? pendingChanges.pendingAvatar : null;
}

function collectibleEqBySku(a: { skuId?: string | number | null; } | null | undefined, b: { skuId?: string | number | null; } | null | undefined): boolean {
    if (a == null || b == null) return a == null && b == null;
    return String(a.skuId ?? "") === String(b.skuId ?? "");
}

function avatarDecorationEq(a: { skuId?: string | number | null; asset?: string | null; } | null | undefined, b: { skuId?: string | number | null; asset?: string | null; } | null | undefined): boolean {
    if (a == null || b == null) return a == null && b == null;
    return String(a.skuId ?? "") === String(b.skuId ?? "") && String(a.asset ?? "") === String(b.asset ?? "");
}

function nameplateEq(a: { skuId?: string | number | null; asset?: string | null; } | null | undefined, b: { skuId?: string | number | null; asset?: string | null; } | null | undefined): boolean {
    if (a == null || b == null) return a == null && b == null;
    return String(a.skuId ?? "") === String(b.skuId ?? "") && String(a.asset ?? "") === String(b.asset ?? "");
}

function toNewAssetPayload(dataUrl: string, presetName?: string) {
    return {
        assetOrigin: "NEW_ASSET",
        imageUri: dataUrl,
        description: `profilesets-${presetName ?? "preset"}`
    };
}

function toBannerPending(value: unknown, presetName?: string): ImageInput {
    if (value == null) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object" && value != null && "imageUri" in value && isNonEmptyString((value as any).imageUri)) {
        const { imageUri } = value as any;
        return imageUri.startsWith("data:") ? imageUri : toNewAssetPayload(imageUri, presetName);
    }
    return value as any;
}

function buildPendingThemeColors(preset: ProfilePreset): number[] | null {
    if (!("themeColors" in preset) && !("accentColor" in preset)) return null;

    const colors = preset.themeColors ? [...preset.themeColors] : [];
    const accent = "accentColor" in preset ? preset.accentColor ?? null : null;

    if (colors.length >= 2) return colors.slice(0, 2);
    if (colors.length === 1 && accent != null) return [colors[0], accent];
    if (colors.length === 1) return [colors[0], colors[0]];
    if (accent != null) return [accent, accent];
    return null;
}

function applyPresetToPending(preset: ProfilePreset, isGuild: boolean, options: LoadPresetOptions) {
    const pending: Record<string, unknown> = {};

    if ("avatarDataUrl" in preset) {
        const avatar = preset.avatarDataUrl;
        pending.pendingAvatar = avatar?.startsWith?.("data:")
            ? toNewAssetPayload(avatar, preset.name)
            : avatar ?? null;
    }

    if ("bannerDataUrl" in preset) {
        pending.pendingBanner = toBannerPending(preset.bannerDataUrl, preset.name);
    }

    if (!options.skipBio && "bio" in preset) {
        pending.pendingBio = preset.bio ?? null;
    }

    if (!options.skipPronouns && "pronouns" in preset) {
        pending.pendingPronouns = preset.pronouns ?? "";
    }

    if (!options.skipGlobalName && "globalName" in preset) {
        if (isGuild) pending.pendingNickname = preset.globalName ?? "";
        else pending.pendingGlobalName = preset.globalName ?? "";
    }

    if (preset.avatarDecoration !== undefined) {
        pending.pendingAvatarDecoration = preset.avatarDecoration;
    }

    if (preset.profileEffect !== undefined) {
        pending.pendingProfileEffect = preset.profileEffect;
    }

    if (preset.nameplate !== undefined) {
        // Ensure the shape matches what Discord's profile modal expects.
        // In particular, `type` is optional in presets but required to actually render.
        const np = preset.nameplate;
        pending.pendingNameplate = np == null ? np : {
            skuId: String(np.skuId),
            asset: String(np.asset),
            label: np.label,
            palette: typeof np.palette === "string" ? np.palette : undefined,
            type: np.type ?? 2
        };
    }

    if ("accentColor" in preset) {
        pending.pendingAccentColor = preset.accentColor ?? null;
    }

    if ("themeColors" in preset || "accentColor" in preset) {
        pending.pendingThemeColors = buildPendingThemeColors(preset);
    }

    if (preset.displayNameStyles !== undefined) {
        pending.pendingDisplayNameStyles = normalizeDisplayNameStyles(preset.displayNameStyles);
    }

    if (preset.primaryGuildId && !isGuild) {
        pending.pendingPrimaryGuildId = preset.primaryGuildId;
    }

    return pending;
}

export async function loadPresetAsPending(preset: ProfilePreset, guildId?: string, options: LoadPresetOptions = {}) {
    try {
        const isGuild = options.isGuildProfile ?? Boolean(guildId);
        if (isGuild && !guildId) return;

        const contextGuildId = isGuild ? guildId : undefined;
        initProfileSettingsContext(contextGuildId);

        const pending = applyPresetToPending(preset, isGuild, options);
        if (Object.keys(pending).length) {
            setPendingChanges(pending, contextGuildId);
        }

    if ("bannerDataUrl" in preset) {
            const bannerUri = normalizeImageValue(preset.bannerDataUrl);
            if (bannerUri?.startsWith("data:")) {
            const image = typeof preset.bannerDataUrl === "object"
                && preset.bannerDataUrl != null
                && "imageUri" in (preset.bannerDataUrl as any)
                ? { ...(preset.bannerDataUrl as any), imageUri: bannerUri }
                    : toNewAssetPayload(bannerUri, preset.name);
                openProfileImagePreview("BANNER", image, contextGuildId);
            }
        }

        if (preset.customStatus && !isGuild) {
            CustomStatusSettings.updateSetting({
                text: preset.customStatus?.text ?? "",
                expiresAtMs: preset.customStatus?.expiresAtMs ?? "0",
                emojiId: preset.customStatus?.emojiId ?? "0",
                emojiName: preset.customStatus?.emojiName ?? ""
            });
        }

        notifyPreviewApply();
        await applyThemeForLoadedPreset(preset, guildId, options);
    } catch (err) {
        throw err;
    }
}
