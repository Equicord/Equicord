/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { User, UserProfile } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { UserStore } from "@webpack/common";
import virtualMerge from "virtual-merge";

import { getProfileSetsPreviewContext } from "./previewContext";
import { normalizeNameplateLike } from "./profile";

const UserProfileSettingsStore = findStoreLazy("UserProfileSettingsStore");

type PendingChanges = Record<string, unknown> & {
    pendingBio?: string | null;
    pendingPronouns?: string | null;
    pendingThemeColors?: number[] | null;
    pendingAccentColor?: number | null;
    pendingBanner?: unknown;
    pendingAvatar?: unknown;
    pendingAvatarDecoration?: unknown;
    pendingProfileEffect?: unknown;
    pendingNameplate?: unknown;
    pendingGlobalName?: string | null;
    pendingNickname?: string | null;
    pendingDisplayNameStyles?: unknown;
    pendingPrimaryGuildId?: string | null;
};

function getPendingForPreview(): PendingChanges | null {
    const { active, guildId } = getProfileSetsPreviewContext();
    if (!active) return null;

    return (guildId
        ? UserProfileSettingsStore.getPendingChanges(guildId)
        : UserProfileSettingsStore.getPendingChanges()) as PendingChanges | null;
}

function isCurrentUser(userId: string) {
    return UserStore.getCurrentUser()?.id === userId;
}

function defined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

export function mergePendingUserProfile(profile: UserProfile, userId: string, guildId?: string): UserProfile {
    if (!profile || !isCurrentUser(userId)) return profile;

    const ctx = getProfileSetsPreviewContext();
    if (!ctx.active) return profile;
    if (ctx.guildId !== guildId) return profile;

    const pending = getPendingForPreview();
    if (!pending) return profile;

    const patch: Partial<UserProfile> = {};

    // UserProfileStore typings use `undefined` (not null) for absent values.
    // Pending changes may contain `null` to indicate "unset", so normalize to `undefined`.
    if (defined(pending.pendingBio)) patch.bio = pending.pendingBio ?? undefined;
    if (defined(pending.pendingPronouns)) patch.pronouns = pending.pendingPronouns ?? undefined;
    if (defined(pending.pendingThemeColors)) {
        const colors = pending.pendingThemeColors;
        patch.themeColors = Array.isArray(colors) && colors.length >= 2
            ? [colors[0], colors[1]]
            : undefined;
    }
    if (defined(pending.pendingAccentColor)) patch.accentColor = pending.pendingAccentColor;
    if (defined(pending.pendingProfileEffect)) patch.profileEffect = pending.pendingProfileEffect as UserProfile["profileEffect"];

    if (defined(pending.pendingBanner)) {
        const banner = pending.pendingBanner;
        if (typeof banner === "string") patch.banner = banner;
        else if (banner && typeof banner === "object" && "imageUri" in banner) {
            const { imageUri } = banner as { imageUri?: string; };
            if (typeof imageUri === "string" && imageUri.startsWith("data:")) {
                patch.banner = imageUri;
            }
        }
    }

    return Object.keys(patch).length ? virtualMerge(profile, patch) : profile;
}

export function mergePendingUser(user: User, guildId?: string): User {
    if (!user || !isCurrentUser(user.id)) return user;

    const ctx = getProfileSetsPreviewContext();
    if (!ctx.active) return user;
    if (ctx.guildId !== guildId) return user;

    const pending = getPendingForPreview();
    if (!pending) return user;

    const patch: Partial<User> = {};

    if (!ctx.guildId && defined(pending.pendingGlobalName)) {
        patch.globalName = pending.pendingGlobalName ?? undefined;
    }

    if (defined(pending.pendingDisplayNameStyles)) {
        patch.displayNameStyles = pending.pendingDisplayNameStyles as User["displayNameStyles"];
    }

    if (defined(pending.pendingAvatarDecoration)) {
        // `avatarDecoration` is a getter; the underlying mutable field is `avatarDecorationData`.
        patch.avatarDecorationData = pending.pendingAvatarDecoration as User["avatarDecorationData"];
    }

    if (defined(pending.pendingPrimaryGuildId)) {
        patch.primaryGuild = virtualMerge(user.primaryGuild ?? {}, {
            identityGuildId: pending.pendingPrimaryGuildId
        }) as User["primaryGuild"];
    }

    if (defined(pending.pendingNameplate)) {
        patch.collectibles = virtualMerge(user.collectibles ?? {}, {
            nameplate: normalizeNameplateLike(pending.pendingNameplate)
        }) as User["collectibles"];
    }

    return Object.keys(patch).length ? virtualMerge(user, patch) : user;
}
