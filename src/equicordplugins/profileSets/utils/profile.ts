/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUserSettingLazy } from "@api/UserSettings";
import { CustomStatus, DisplayNameStyles, Nameplate, ProfileEffect, ProfilePreset } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { FluxDispatcher, GuildMemberStore,IconUtils, UserProfileStore, UserStore } from "@webpack/common";

const UserProfileSettingsStore = findStoreLazy("UserProfileSettingsStore");
const CustomStatusSettings = getUserSettingLazy("status", "customStatus")!;

type PendingChanges = Record<string, unknown> & {
    pendingAvatar?: ImageInput;
    avatar?: ImageInput;
    pendingBanner?: ImageInput;
    banner?: ImageInput;
    pendingAvatarDecoration?: { asset: string; skuId: string; } | null;
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

type UserExtras = {
    collectibles?: {
        nameplate?: Nameplate;
    };
    displayNameStyles?: DisplayNameStyles;
    avatarDecorationData?: {
        asset: string;
        skuId: string;
    } | null;
    primaryGuild?: {
        identityGuildId?: string | null;
    } | null;
};

type ProfileCollectible = {
    skuId: string;
    title?: string;
    description?: string;
    accessibilityLabel?: string;
    reducedMotionSrc?: string;
    thumbnailPreviewSrc?: string;
    effects?: ProfileEffect["effects"];
    animationType?: number;
    staticFrameSrc?: string;
    type?: number;
};

type ImageInput = string | { imageUri: string; } | null | undefined;

function dispatch(type: string, payload: Record<string, unknown>) {
    FluxDispatcher.dispatch({ type, ...payload });
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

function hasImageInput(value: ImageInput): boolean {
    if (!value) return false;
    if (typeof value === "string") return value.length > 0;
    return typeof value === "object" && "imageUri" in value && isNonEmptyString(value.imageUri);
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

    if (typeof imageData === "object" && "imageUri" in imageData && isNonEmptyString(imageData.imageUri)) {
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

type CurrentProfileOptions = {
    isGuildProfile?: boolean;
};

type LoadPresetOptions = {
    skipGlobalName?: boolean;
    skipBio?: boolean;
    skipPronouns?: boolean;
    isGuildProfile?: boolean;
};

export async function getCurrentProfile(guildId?: string, options: CurrentProfileOptions = {}): Promise<Omit<ProfilePreset, "name" | "timestamp">> {
    const currentUser = UserStore.getCurrentUser();
    const baseProfile = UserProfileStore.getUserProfile(currentUser.id);
    const isGuildProfile = options.isGuildProfile ?? Boolean(guildId);
    const effectiveGuildId = isGuildProfile ? guildId : undefined;
    const guildProfile = effectiveGuildId ? UserProfileStore.getGuildMemberProfile(currentUser.id, effectiveGuildId) : null;
    const userProfile = guildProfile ?? baseProfile;
    const userAny = currentUser as UserExtras;
    const guildMember = effectiveGuildId ? GuildMemberStore.getMember(effectiveGuildId, currentUser.id) : null;

    const pendingChangesDefault = (UserProfileSettingsStore.getPendingChanges() ?? {}) as PendingChanges;
    const pendingChangesForGuild = (effectiveGuildId
        ? (UserProfileSettingsStore.getPendingChanges(effectiveGuildId) ?? {})
        : {}) as PendingChanges;
    const pendingChanges: PendingChanges = isGuildProfile && Object.keys(pendingChangesForGuild).length > 0
        ? pendingChangesForGuild
        : pendingChangesDefault;

    const customStatusSetting = CustomStatusSettings.getSetting();
    const customStatus: CustomStatus | null = isGuildProfile
        ? null
        : {
            text: customStatusSetting?.text ?? "",
            emojiId: customStatusSetting?.emojiId ?? "0",
            emojiName: customStatusSetting?.emojiName ?? "",
            expiresAtMs: customStatusSetting?.expiresAtMs ?? "0"
        };

    const avatarDecorationSource = pendingChanges.pendingAvatarDecoration ?? userAny.avatarDecorationData;
    const avatarDecoration = avatarDecorationSource ? {
        asset: avatarDecorationSource.asset,
        skuId: avatarDecorationSource.skuId
    } : null;

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
            const collectibles = (userProfile as { collectibles?: ProfileCollectible[]; } | null)?.collectibles;
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

    const nameplateToUse = pendingChanges.pendingNameplate ?? userAny.collectibles?.nameplate;
    const nameplate = nameplateToUse ? {
        skuId: nameplateToUse.skuId,
        asset: nameplateToUse.asset,
        label: nameplateToUse.label,
        palette: typeof nameplateToUse.palette === "string" ? nameplateToUse.palette : undefined,
        type: nameplateToUse.type || 2
    } : null;

    const displayNameStylesToUse = pendingChanges.pendingDisplayNameStyles ?? userAny.displayNameStyles;
    const displayNameStyles = displayNameStylesToUse ? {
        font_id: displayNameStylesToUse.font_id ?? 0,
        effect_id: displayNameStylesToUse.effect_id ?? 0,
        colors: Array.isArray(displayNameStylesToUse.colors) ? displayNameStylesToUse.colors : []
    } : null;

    const pendingAvatar = pendingChanges.pendingAvatar ?? pendingChanges.avatar;
    const avatarToUse: ImageInput = hasImageInput(pendingAvatar)
        ? pendingAvatar
        : (isGuildProfile ? (guildMember?.avatar ?? currentUser.avatar ?? null) : (currentUser.avatar ?? null));

    const useGuildAvatar = !!(effectiveGuildId && isGuildProfile && guildMember?.avatar && avatarToUse === guildMember.avatar);

    const avatarInput: ImageInput = hasImageInput(avatarToUse)
        ? avatarToUse
        : IconUtils.getUserAvatarURL(currentUser, true, 512);
    const avatarDataUrl = await processImage(avatarInput, currentUser.id, "avatar", effectiveGuildId, useGuildAvatar);
    const resolvedAvatarDataUrl = avatarDataUrl ?? IconUtils.getDefaultAvatarURL(currentUser.id);

    const pendingBanner = pendingChanges.pendingBanner ?? pendingChanges.banner;
    const bannerToUse: ImageInput = hasImageInput(pendingBanner)
        ? pendingBanner
        : (isGuildProfile ? (guildProfile?.banner ?? baseProfile?.banner) : baseProfile?.banner);
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
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return a.text === b.text
        && String(a.emojiId ?? "") === String(b.emojiId ?? "")
        && a.emojiName === b.emojiName
        && String(a.expiresAtMs ?? "0") === String(b.expiresAtMs ?? "0");
}

export async function loadPresetAsPending(preset: ProfilePreset, guildId?: string, options: LoadPresetOptions = {}) {
    try {
        const isGuild = options.isGuildProfile ?? Boolean(guildId);
        if (isGuild && !guildId) return;
        const current = await getCurrentProfile(guildId, {
            isGuildProfile: isGuild
        });
        const profilePrefix = "USER_SETTINGS_ACCOUNT";
        const dispatchProfile = (type: string, payload: Record<string, unknown>) => {
            dispatch(type, isGuild ? { ...payload, guildId } : payload);
        };
        const setPending = (type: string, payload: Record<string, unknown>) => dispatchProfile(type, payload);

        if ("avatarDataUrl" in preset) {
            const avatarValue = preset.avatarDataUrl;
            if (isGuild || avatarValue !== current.avatarDataUrl) {
                setPending(`${profilePrefix}_SET_PENDING_AVATAR`, { avatar: avatarValue });
            }
        }

        if ("bannerDataUrl" in preset && preset.bannerDataUrl !== current.bannerDataUrl) {
            setPending(`${profilePrefix}_SET_PENDING_BANNER`, { banner: preset.bannerDataUrl });
        }

        if (!options.skipBio && "bio" in preset && preset.bio !== current.bio) {
            const bioValue = preset.bio === null ? "" : preset.bio;
            setPending(`${profilePrefix}_SET_PENDING_BIO`, { bio: bioValue });
        }

        if (!options.skipPronouns && "pronouns" in preset && preset.pronouns !== current.pronouns) {
            const pronounsValue = preset.pronouns === null ? "" : preset.pronouns;
            setPending(`${profilePrefix}_SET_PENDING_PRONOUNS`, { pronouns: pronounsValue });
        }

        if (!options.skipGlobalName && preset.globalName !== undefined && preset.globalName !== current.globalName) {
            if (isGuild) {
                setPending("USER_SETTINGS_ACCOUNT_SET_PENDING_NICKNAME", { nickname: preset.globalName });
            } else {
                setPending("USER_SETTINGS_ACCOUNT_SET_PENDING_GLOBAL_NAME", { globalName: preset.globalName });
            }
        }

        if (preset.avatarDecoration !== undefined && !jsonEq(preset.avatarDecoration, current.avatarDecoration)) {
            dispatchProfile(`${profilePrefix}_SET_PENDING_COLLECTIBLES_ITEM`, {
                item: { type: 0, value: preset.avatarDecoration }
            });
        }

        if (preset.profileEffect !== undefined && !jsonEq(preset.profileEffect, current.profileEffect)) {
            dispatchProfile(`${profilePrefix}_SET_PENDING_COLLECTIBLES_ITEM`, {
                item: { type: 1, value: preset.profileEffect }
            });
        }

        if (preset.nameplate !== undefined && !jsonEq(preset.nameplate, current.nameplate)) {
            dispatchProfile(`${profilePrefix}_SET_PENDING_COLLECTIBLES_ITEM`, {
                item: { type: 2, value: preset.nameplate }
            });
        }

        if (preset.displayNameStyles !== undefined && !jsonEq(preset.displayNameStyles, current.displayNameStyles)) {
            setPending(`${profilePrefix}_SET_PENDING_DISPLAY_NAME_STYLES`, { displayNameStyles: preset.displayNameStyles });
        }

        if (preset.themeColors !== undefined && !jsonEq(preset.themeColors, current.themeColors)) {
            setPending(`${profilePrefix}_SET_PENDING_THEME_COLORS`, { themeColors: preset.themeColors });
        }

        if (preset.primaryGuildId !== undefined && !isGuild && preset.primaryGuildId !== current.primaryGuildId) {
            dispatch("USER_SETTINGS_SET_PENDING_PRIMARY_GUILD_ID", { primaryGuildId: preset.primaryGuildId });
        }

        if (preset.customStatus !== undefined && !isGuild && !customStatusEq(preset.customStatus, current.customStatus)) {
            const customStatusValue = preset.customStatus ?? {
                text: "",
                expiresAtMs: "0",
                emojiId: "0",
                emojiName: ""
            };
            CustomStatusSettings.updateSetting({
                text: customStatusValue.text || "",
                expiresAtMs: customStatusValue.expiresAtMs || "0",
                emojiId: customStatusValue.emojiId || "0",
                emojiName: customStatusValue.emojiName || ""
            });
        }
    } catch (err) {
        throw err;
    }
}
