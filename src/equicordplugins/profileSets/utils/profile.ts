/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUserSettingLazy } from "@api/UserSettings";
import { AvatarDecorationData, CustomStatus, DisplayNameStyles, Nameplate, ProfileEffect, ProfilePreset } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { FluxDispatcher, GuildMemberStore, IconUtils, UserProfileStore, UserStore } from "@webpack/common";

const UserProfileSettingsStore = findStoreLazy("UserProfileSettingsStore");
const CustomStatusSettings = getUserSettingLazy("status", "customStatus");

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

export type LoadPresetOptions = {
    skipGlobalName?: boolean;
    skipBio?: boolean;
    skipPronouns?: boolean;
    generation?: { current: number };
};

function dispatch(type: string, payload: Record<string, unknown>) {
    FluxDispatcher.dispatch({ type, ...payload });
}

function setPendingChanges(payload: Record<string, unknown>) {
    dispatch("USER_PROFILE_SETTINGS_SET_PENDING_CHANGES", payload);
}

function openProfileImagePreview(
    uploadType: "AVATAR" | "BANNER",
    image: Extract<ImageInput, { imageUri: string; }>,
) {
    dispatch("PROFILE_CUSTOMIZATION_OPEN_PREVIEW_MODAL", {
        image,
        file: {},
        uploadType,
        analyticsSource: "user settings user profile",
        isTryItOut: false
    });
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

function hasImageInput(value: ImageInput): boolean {
    if (!value) return false;
    if (typeof value === "string") return value.length > 0;
    return typeof value === "object" && isNonEmptyString(value.imageUri);
}

function hasAvatarDecoration(value: unknown): value is AvatarDecorationLike {
    return typeof value === "object"
        && value != null
        && "asset" in value
        && "skuId" in value
        && isNonEmptyString((value as { asset?: unknown; }).asset)
        && isNonEmptyString((value as { skuId?: unknown; }).skuId);
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
    } catch (err) {
        new Logger("ProfilePresets").warn("Failed to convert image URL to base64", err);
        return null;
    }
}

async function processImage(imageData: ImageInput, userId: string, type: "avatar" | "banner"): Promise<string | null> {
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
        const size = type === "banner" ? 1024 : 512;
        const urlPath = type === "banner" ? "banners" : "avatars";
        const url = `https://cdn.discordapp.com/${urlPath}/${userId}/${imageData}.${isAnimated ? "gif" : "png"}?size=${size}`;
        return await imageUrlToBase64(url);
    }

    return null;
}

export async function getCurrentProfile(): Promise<Omit<ProfilePreset, "name" | "timestamp">> {
    const currentUser = UserStore.getCurrentUser();
    if (!currentUser) throw new Error("No authenticated user");

    const baseProfile = UserProfileStore.getUserProfile(currentUser.id);

    const pendingChanges: PendingChanges = UserProfileSettingsStore.getPendingChanges?.() ?? {};
    const customStatusSetting = CustomStatusSettings?.getSetting?.();
    const customStatus = {
        text: customStatusSetting?.text ?? "",
        emojiId: customStatusSetting?.emojiId ?? "0",
        emojiName: customStatusSetting?.emojiName ?? "",
        expiresAtMs: customStatusSetting?.expiresAtMs ?? "0"
    };

    const avatarDecorationSource = pendingChanges.pendingAvatarDecoration ?? currentUser.avatarDecorationData;
    const avatarDecoration = hasAvatarDecoration(avatarDecorationSource)
        ? {
            ...avatarDecorationSource,
            asset: avatarDecorationSource.asset,
            skuId: avatarDecorationSource.skuId
        }
        : null;

    let profileEffect: ProfileEffect | null = null;
    const effectToUse = pendingChanges.pendingProfileEffect ?? baseProfile?.profileEffect;

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
            const collectibles = baseProfile?.collectibles;
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

    const nameplateToUse = pendingChanges.pendingNameplate ?? currentUser.collectibles?.nameplate;
    const nameplate = nameplateToUse ? {
        skuId: nameplateToUse.skuId,
        asset: nameplateToUse.asset,
        label: nameplateToUse.label,
        palette: typeof nameplateToUse.palette === "string" ? nameplateToUse.palette : undefined,
        type: nameplateToUse.type || 2
    } : null;

    const savedDisplayNameStyles = currentUser.displayNameStyles;
    const displayNameStylesToUse = pendingChanges.pendingDisplayNameStyles ?? savedDisplayNameStyles;
    const displayNameStyles = normalizeDisplayNameStyles(displayNameStylesToUse);

    const { pendingAvatar } = pendingChanges;
    const avatarToUse: ImageInput = hasImageInput(pendingAvatar)
        ? pendingAvatar
        : (currentUser.avatar ?? null);

    const avatarInput: ImageInput = hasImageInput(avatarToUse)
        ? avatarToUse
        : IconUtils.getUserAvatarURL(currentUser, true, 512);
    const avatarDataUrl = await processImage(avatarInput, currentUser.id, "avatar");
    const resolvedAvatarDataUrl = avatarDataUrl ?? IconUtils.getDefaultAvatarURL(currentUser.id);

    const { pendingBanner } = pendingChanges;
    const bannerToUse: ImageInput = hasImageInput(pendingBanner)
        ? pendingBanner
        : baseProfile?.banner;

    const bannerDataUrl = await processImage(bannerToUse, currentUser.id, "banner");

    return {
        avatarDataUrl: resolvedAvatarDataUrl,
        bannerDataUrl,
        bio: pendingChanges.pendingBio ?? baseProfile?.bio ?? null,
        accentColor: pendingChanges.pendingAccentColor ?? baseProfile?.accentColor ?? null,
        themeColors: pendingChanges.pendingThemeColors ?? baseProfile?.themeColors ?? null,
        globalName: pendingChanges.pendingGlobalName ?? currentUser.globalName ?? null,
        pronouns: pendingChanges.pendingPronouns ?? baseProfile?.pronouns ?? null,
        avatarDecoration,
        profileEffect,
        nameplate,
        primaryGuildId: pendingChanges.pendingPrimaryGuildId ?? currentUser.primaryGuild?.identityGuildId ?? null,
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

function normalizeImageValue(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "imageUri" in value) {
        const { imageUri } = value as { imageUri: unknown; };
        return typeof imageUri === "string" ? imageUri : null;
    }
    return null;
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

export async function loadPresetAsPending(preset: ProfilePreset, options: LoadPresetOptions = {}) {
        const genSnapshot = options.generation?.current ?? 0;
        const isStale = () => options.generation && options.generation.current !== genSnapshot;

        const current = await getCurrentProfile();
        if (isStale()) return;
        const pendingChanges = UserProfileSettingsStore.getPendingChanges();
        const setPending = (payload: Record<string, unknown>) => {
            if (isStale()) return;
            const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
            if (!Object.keys(cleanPayload).length) return;
            setPendingChanges(cleanPayload);
        };

        if ("avatarDataUrl" in preset) {
            const avatarValue = preset.avatarDataUrl;
            const presetAvatar = normalizeImageValue(avatarValue);
            const currentAvatar = normalizeImageValue(current.avatarDataUrl);
            const pendingAvatar = normalizeImageValue(resolvePendingAvatar(pendingChanges));
            if (presetAvatar !== currentAvatar && presetAvatar !== pendingAvatar) {
                const avatarPayload =
                    avatarValue?.startsWith?.("data:")
                        ? {
                            assetOrigin: "NEW_ASSET",
                            imageUri: avatarValue,
                            description: `profilesets-${preset.name ?? "preset"}`
                        }
                        : avatarValue;
                const avatarImageUri = avatarPayload != null && "imageUri" in Object(avatarPayload)
                    ? (avatarPayload as { imageUri?: unknown; }).imageUri
                    : null;
                if (isNonEmptyString(avatarImageUri)) {
                    if (!isStale()) openProfileImagePreview("AVATAR", { ...Object(avatarPayload), imageUri: avatarImageUri });
                } else {
                    setPending({ pendingAvatar: avatarPayload });
                }
            }
        }

        if ("bannerDataUrl" in preset && preset.bannerDataUrl !== current.bannerDataUrl) {
            const bannerPayload = preset.bannerDataUrl?.startsWith?.("data:")
                ? {
                    assetOrigin: "NEW_ASSET",
                    imageUri: preset.bannerDataUrl,
                    description: `profilesets-${preset.name ?? "preset"}`
                }
                : preset.bannerDataUrl;

            const bannerImageUri = bannerPayload != null && "imageUri" in Object(bannerPayload)
                ? (bannerPayload as { imageUri?: unknown; }).imageUri
                : null;
            if (isNonEmptyString(bannerImageUri)) {
                if (!isStale()) openProfileImagePreview("BANNER", { ...Object(bannerPayload), imageUri: bannerImageUri });
            } else {
                setPending({ pendingBanner: bannerPayload });
            }
        }

        if (!options.skipBio && preset?.bio !== current?.bio) {
            setPending({ pendingBio: preset.bio ?? "" });
        }

        if (!options.skipPronouns && preset?.pronouns !== current?.pronouns) {
            setPending({ pendingPronouns: preset.pronouns ?? "" });
        }

        if (!options.skipGlobalName && preset?.globalName !== current?.globalName) {
            setPending({ pendingGlobalName: preset.globalName });
        }

        if (preset.avatarDecoration !== undefined && !avatarDecorationEq(preset.avatarDecoration, current.avatarDecoration)) {
            setPending({
                pendingAvatarDecoration: preset.avatarDecoration
            });
        }

        if (preset.profileEffect !== undefined && !collectibleEqBySku(preset.profileEffect, current.profileEffect)) {
            setPending({
                pendingProfileEffect: preset.profileEffect
            });
        }

        if (preset.nameplate !== undefined && !nameplateEq(preset.nameplate, current.nameplate)) {
            setPending({
                pendingNameplate: preset.nameplate
            });
        }

        if (preset.displayNameStyles) {
            const presetDisplayNameStyles = normalizeDisplayNameStyles(preset.displayNameStyles);
            if (!jsonEq(presetDisplayNameStyles, current.displayNameStyles)) {
                setPending({ pendingDisplayNameStyles: presetDisplayNameStyles });
            }
        }

        if (preset.themeColors && !jsonEq(preset.themeColors, current.themeColors)) {
            setPending({ pendingThemeColors: preset.themeColors });
        }

        if (preset.primaryGuildId && preset.primaryGuildId !== current.primaryGuildId) {
            setPending({ pendingPrimaryGuildId: preset.primaryGuildId });
        }

        if (preset.customStatus && !customStatusEq(preset.customStatus, current.customStatus)) {
            if (!isStale()) CustomStatusSettings?.updateSetting?.({
                text: preset.customStatus?.text ?? "",
                expiresAtMs: preset.customStatus?.expiresAtMs ?? "0",
                emojiId: preset.customStatus?.emojiId ?? "0",
                emojiName: preset.customStatus?.emojiName ?? ""
            });
        }
}
