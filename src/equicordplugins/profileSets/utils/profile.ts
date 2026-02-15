/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUserSettingLazy } from "@api/UserSettings";
import { Logger } from "@utils/Logger";
import { CustomStatus, ProfileEffect, ProfilePreset } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { FluxDispatcher, IconUtils, UserProfileStore, UserStore } from "@webpack/common";

const logger = new Logger("ProfilePresets");
const UserProfileSettingsStore = findStoreLazy("UserProfileSettingsStore");
const CustomStatusSettings = getUserSettingLazy("status", "customStatus")!;

function dispatch(type: string, payload: any) {
    FluxDispatcher.dispatch({ type, ...payload });
}

export async function imageUrlToBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        logger.error("Failed to convert image to base64", err);
        return null;
    }
}

async function processImage(imageData: any, userId: string, type: "avatar" | "banner"): Promise<string | null> {
    if (!imageData) return null;

    if (typeof imageData === "object" && imageData.imageUri) {
        return imageData.imageUri;
    }

    if (typeof imageData === "string") {
        if (imageData.startsWith("data:")) return imageData;

        const isAnimated = imageData.startsWith("a_");
        const size = type === "banner" ? 1024 : 512;
        const urlPath = type === "banner" ? "banners" : "avatars";
        const url = `https://cdn.discordapp.com/${urlPath}/${userId}/${imageData}.${isAnimated ? "gif" : "png"}?size=${size}`;
        return await imageUrlToBase64(url);
    }

    return null;
}

export async function getCurrentProfile(guildId?: string): Promise<Omit<ProfilePreset, "name" | "timestamp">> {
    const currentUser = UserStore.getCurrentUser();
    const userProfile = UserProfileStore.getUserProfile(currentUser.id);
    const userAny = currentUser as any;

    const pendingChanges = UserProfileSettingsStore.getPendingChanges(guildId);

    const customStatusSetting = CustomStatusSettings.getSetting();
    const customStatus: CustomStatus | null = customStatusSetting ? {
        text: customStatusSetting.text,
        emojiId: customStatusSetting.emojiId,
        emojiName: customStatusSetting.emojiName,
        expiresAtMs: customStatusSetting.expiresAtMs
    } : null;

    const avatarDecoration = (pendingChanges.pendingAvatarDecoration !== undefined
        ? pendingChanges.pendingAvatarDecoration
        : userAny.avatarDecorationData) ? {
        asset: (pendingChanges.pendingAvatarDecoration || userAny.avatarDecorationData).asset,
        skuId: (pendingChanges.pendingAvatarDecoration || userAny.avatarDecorationData).skuId
    } : null;

    let profileEffect: ProfileEffect | null = null;
    const effectToUse = pendingChanges.pendingProfileEffect !== undefined
        ? pendingChanges.pendingProfileEffect
        : userProfile?.profileEffect;

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
            const collectible = userProfile?.collectibles?.find((c: any) => c.skuId === effectToUse.skuId);
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

    const nameplateToUse = pendingChanges.pendingNameplate !== undefined
        ? pendingChanges.pendingNameplate
        : userAny.collectibles?.nameplate;

    const nameplate = nameplateToUse ? {
        skuId: nameplateToUse.skuId,
        asset: nameplateToUse.asset,
        label: nameplateToUse.label,
        palette: nameplateToUse.palette,
        type: nameplateToUse.type || 2
    } : null;

    const displayNameStylesToUse = pendingChanges.pendingDisplayNameStyles !== undefined
        ? pendingChanges.pendingDisplayNameStyles
        : userAny.displayNameStyles;

    const displayNameStyles = displayNameStylesToUse ? {
        font_id: displayNameStylesToUse.font_id,
        effect_id: displayNameStylesToUse.effect_id,
        colors: Array.isArray(displayNameStylesToUse.colors) ? displayNameStylesToUse.colors : []
    } : null;

    const avatarToUse = pendingChanges.pendingAvatar !== undefined
        ? pendingChanges.pendingAvatar
        : currentUser.avatar;

    const avatarDataUrl = await processImage(avatarToUse, currentUser.id, "avatar")
        || IconUtils.getDefaultAvatarURL(currentUser.id);

    const bannerToUse = pendingChanges.pendingBanner !== undefined
        ? pendingChanges.pendingBanner
        : userProfile?.banner;

    const bannerDataUrl = await processImage(bannerToUse, currentUser.id, "banner");

    return {
        avatarDataUrl,
        bannerDataUrl,
        bio: pendingChanges.pendingBio !== undefined ? pendingChanges.pendingBio : userProfile?.bio || null,
        accentColor: pendingChanges.pendingAccentColor !== undefined ? pendingChanges.pendingAccentColor : userProfile?.accentColor || null,
        themeColors: pendingChanges.pendingThemeColors !== undefined
            ? pendingChanges.pendingThemeColors
            : userProfile?.themeColors || null,
        globalName: pendingChanges.pendingGlobalName !== undefined ? pendingChanges.pendingGlobalName : currentUser.globalName || null,
        pronouns: pendingChanges.pendingPronouns !== undefined ? pendingChanges.pendingPronouns : userProfile?.pronouns || null,
        avatarDecoration,
        profileEffect,
        nameplate,
        primaryGuildId: pendingChanges.pendingPrimaryGuildId !== undefined ? pendingChanges.pendingPrimaryGuildId : userAny.primaryGuild?.identityGuildId || null,
        customStatus,
        displayNameStyles
    };
}

function jsonEq(a: any, b: any): boolean {
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

export async function loadPresetAsPending(preset: ProfilePreset, guildId?: string) {
    try {
        const current = await getCurrentProfile(guildId);

        if (preset.avatarDataUrl && preset.avatarDataUrl !== current.avatarDataUrl) {
            dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_AVATAR", { guildId, avatar: preset.avatarDataUrl });
        }

        if (preset?.bannerDataUrl && preset.bannerDataUrl !== current.bannerDataUrl) {
            dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_BANNER", { guildId, banner: preset.bannerDataUrl });
        }

        if (preset?.bio && preset.bio !== current.bio) {
            dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_BIO", { guildId, bio: preset.bio });
        }

        if (preset?.pronouns && preset.pronouns !== current.pronouns) {
            dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_PRONOUNS", { guildId, pronouns: preset.pronouns });
        }

        if (preset?.globalName && preset.globalName !== current.globalName) {
            dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_GLOBAL_NAME", { globalName: preset.globalName });
        }

        if (preset?.avatarDecoration && !jsonEq(preset.avatarDecoration, current.avatarDecoration)) {
            dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_COLLECTIBLES_ITEM", {
                guildId,
                item: { type: 0, value: preset.avatarDecoration }
            });
        }

        if (preset?.profileEffect && !jsonEq(preset.profileEffect, current.profileEffect)) {
            dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_COLLECTIBLES_ITEM", {
                guildId,
                item: { type: 1, value: preset.profileEffect }
            });
        }

        if (preset?.nameplate && !jsonEq(preset.nameplate, current.nameplate)) {
            dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_COLLECTIBLES_ITEM", {
                guildId,
                item: { type: 2, value: preset.nameplate }
            });
        }

        if (preset?.displayNameStyles && !jsonEq(preset.displayNameStyles, current.displayNameStyles)) {
            dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_DISPLAY_NAME_STYLES", {
                guildId,
                displayNameStyles: preset.displayNameStyles
            });
        }

        if (preset?.primaryGuildId && !guildId && preset.primaryGuildId !== current.primaryGuildId) {
            dispatch("USER_SETTINGS_SET_PENDING_PRIMARY_GUILD_ID", { primaryGuildId: preset.primaryGuildId });
        }

        if (preset.customStatus && !guildId && !customStatusEq(preset.customStatus, current.customStatus)) {
            CustomStatusSettings.updateSetting({
                text: preset.customStatus.text || "",
                expiresAtMs: preset.customStatus.expiresAtMs || "0",
                emojiId: preset.customStatus.emojiId || "0",
                emojiName: preset.customStatus.emojiName || ""
            });
        }
    } catch (err) {
        logger.error("Failed to load profile", err);
        throw err;
    }
}

export async function copyUserProfile(userId: string) {
    const user = UserStore.getUser(userId);
    const userProfile = UserProfileStore.getUserProfile(userId);

    if (!user) {
        throw new Error("User not found");
    }

    if (userProfile?.banner) {
        const bannerUrl = `https://cdn.discordapp.com/banners/${userId}/${userProfile.banner}.${userProfile.banner.startsWith("a_") ? "gif" : "png"}?size=1024`;
        const bannerDataUrl = await imageUrlToBase64(bannerUrl);
        if (bannerDataUrl) {
            dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_BANNER", { guildId: undefined, banner: bannerDataUrl });
        }
    }

    if (userProfile?.bio) {
        dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_BIO", { guildId: undefined, bio: userProfile.bio });
    }

    if (userProfile?.pronouns) {
        dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_PRONOUNS", { guildId: undefined, pronouns: userProfile.pronouns });
    }

    if (userProfile?.themeColors) {
        dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_THEME_COLORS", { guildId: undefined, themeColors: userProfile.themeColors });
    }

    const userAny = user as any;
    if (userAny.avatarDecorationData) {
        dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_COLLECTIBLES_ITEM", {
            guildId: undefined,
            item: {
                type: 0,
                value: {
                    asset: userAny.avatarDecorationData.asset,
                    skuId: userAny.avatarDecorationData.skuId
                }
            }
        });
    }

    if (userAny.collectibles?.nameplate) {
        const np = userAny.collectibles.nameplate;
        dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_COLLECTIBLES_ITEM", {
            guildId: undefined,
            item: {
                type: 2,
                value: {
                    skuId: np.skuId,
                    asset: np.asset,
                    label: np.label,
                    palette: np.palette,
                    type: 2
                }
            }
        });
    }

    if (userProfile?.profileEffect?.skuId) {
        const collectible = userProfile.collectibles?.find((c: any) => c.skuId === userProfile.profileEffect.skuId);
        if (collectible) {
            dispatch("USER_SETTINGS_ACCOUNT_SET_PENDING_COLLECTIBLES_ITEM", {
                guildId: undefined,
                item: {
                    type: 1,
                    value: {
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
                    }
                }
            });
        }
    }

    return user.username;
}
