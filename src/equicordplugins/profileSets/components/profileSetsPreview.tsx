/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { HeadingSecondary } from "@components/Heading";
import { classes } from "@utils/misc";
import { Nameplate, User } from "@vencord/discord-types";
import { findComponentByCodeLazy, findStoreLazy } from "@webpack";
import { GuildMemberStore, React, UserProfileStore, UserStore, useStateFromStores } from "@webpack/common";
import virtualMerge from "virtual-merge";

import { cl } from "../classNames";
import { clearProfileSetsPreviewContext, setProfileSetsPreviewContext } from "../utils/previewContext";
import { resolvePendingAvatarUrl } from "../utils/previewImage";
import { mergePendingUser } from "../utils/previewMerge";
import { getPreviewApplyGeneration, subscribePreviewApply } from "../utils/previewSync";
import { normalizeNameplateLike, resolveNameplatePreviewUserValue } from "../utils/profile";
import { ProfileSetsNameplatePreview } from "./profileSetsNameplatePreview";

type PendingChanges = {
    pendingThemeColors?: number[] | null;
    pendingAccentColor?: number | null;
    pendingBio?: string | null;
    pendingPronouns?: string | null;
    pendingGlobalName?: string | null;
    pendingNickname?: string | null;
    pendingBanner?: unknown;
    pendingAvatar?: unknown;
    pendingNameplate?: unknown;
    pendingAvatarDecoration?: unknown;
    pendingProfileEffect?: unknown;
    pendingDisplayNameStyles?: User["displayNameStyles"] | null;
    pendingPrimaryGuildId?: string | null;
};

function previewRevisionFingerprint(value: unknown): string {
    if (value == null) return "null";
    if (typeof value === "string") {
        return `s:${value.length}:${value.slice(0, 48)}`;
    }
    if (typeof value === "object") {
        const { imageUri } = (value as { imageUri?: unknown; });
        if (typeof imageUri === "string") {
            return `img:${imageUri.length}:${imageUri.slice(0, 48)}`;
        }
        const skuId = (value as { skuId?: unknown; sku_id?: unknown; }).skuId
            ?? (value as { sku_id?: unknown; }).sku_id;
        if (skuId != null) {
            const { asset } = (value as { asset?: unknown; });
            const { type } = (value as { type?: unknown; });

            const assetPart = typeof asset === "string"
                ? `a:${asset.length}:${asset.slice(0, 48)}`
                : "";
            const typePart = type != null ? `t:${String(type)}` : "";

            return `sku:${String(skuId)}${assetPart ? `|${assetPart}` : ""}${typePart ? `|${typePart}` : ""}`;
        }
    }
    return JSON.stringify(value);
}

function resolvePreviewThemeColors(
    pending: PendingChanges | null | undefined,
    profile: { themeColors?: number[] | null; accentColor?: number | null; } | null | undefined,
    fallbackProfile?: { themeColors?: number[] | null; accentColor?: number | null; } | null
): [number, number] | null {
    const fromSources = (
        p: PendingChanges | null | undefined,
        prof: { themeColors?: number[] | null; accentColor?: number | null; } | null | undefined
    ): [number, number] | null => {
        let colors: number[] | null = null;

        if (p?.pendingThemeColors && Array.isArray(p.pendingThemeColors) && p.pendingThemeColors.length) {
            colors = [...p.pendingThemeColors];
        } else if (prof?.themeColors && Array.isArray(prof.themeColors) && prof.themeColors.length) {
            colors = [...prof.themeColors];
        }

        const accent = p?.pendingAccentColor ?? prof?.accentColor ?? null;

        if (colors?.length) {
            if (colors.length >= 2) return [colors[0], colors[1]];
            if (colors.length === 1 && accent != null) return [colors[0], accent];
            if (colors.length === 1) return [colors[0], colors[0]];
        }

        if (accent != null) return [accent, accent];
        return null;
    };

    return fromSources(pending, profile) ?? (fallbackProfile ? fromSources(null, fallbackProfile) : null);
}

function previewRevisionKey(pending: PendingChanges | null | undefined): string {
    const pendingKeys = [
        "pendingBio",
        "pendingPronouns",
        "pendingGlobalName",
        "pendingNickname",
        "pendingBanner",
        "pendingAvatar",
        "pendingThemeColors",
        "pendingAccentColor",
        "pendingNameplate",
        "pendingAvatarDecoration",
        "pendingProfileEffect",
        "pendingDisplayNameStyles",
        "pendingPrimaryGuildId"
    ] as const;

    return pendingKeys.map(k => previewRevisionFingerprint(pending?.[k] ?? null)).join("|");
}

function resolvePreviewNameplate(
    user: User,
    pending: PendingChanges | null | undefined,
    guildId?: string,
    profile?: { collectibles?: { nameplate?: unknown; } | null; } | null,
    mainProfile?: { collectibles?: { nameplate?: unknown; } | null; } | null
): Nameplate | null {
    const primaryGuildId = pending?.pendingPrimaryGuildId ?? user.primaryGuild?.identityGuildId ?? null;
    const memberGuildId = guildId ?? primaryGuildId;
    const memberNameplate = memberGuildId
        ? GuildMemberStore.getMember(memberGuildId, user.id)?.collectibles?.nameplate
        : null;

    return normalizeNameplateLike(
        pending?.pendingNameplate
        ?? memberNameplate
        ?? profile?.collectibles?.nameplate
        ?? mainProfile?.collectibles?.nameplate
        ?? user.collectibles?.nameplate
        ?? user.nameplate
    );
}

function withPreviewNameplate(user: User, nameplate: Nameplate | null): User {
    if (!nameplate) return user;

    return virtualMerge(user, {
        nameplate,
        collectibles: virtualMerge(user.collectibles ?? {}, { nameplate }) as User["collectibles"]
    }) as User;
}

interface ProfileModalProps {
    user: User;
    pendingThemeColors?: [number, number] | null;
    pendingAvatarSrc?: string | null;
    pendingBio?: string | null;
    pendingPronouns?: string | null;
    pendingGlobalName?: string | null;
    pendingNickname?: string | null;
    pendingBanner?: unknown;
    pendingAvatar?: unknown;
    pendingAvatarDecoration?: unknown;
    pendingDisplayNameStyles?: User["displayNameStyles"] | null;
    pendingProfileEffect?: unknown;
    pendingNameplate?: unknown;
    pendingPrimaryGuildId?: string | null;
    onAvatarChange: () => void;
    onBannerChange: () => void;
    canUsePremiumCustomization: boolean;
    hideExampleButton: boolean;
    hideFakeActivity: boolean;
    isTryItOut: boolean;
    guildId?: string;
}

const UserProfileSettingsStore = findStoreLazy("UserProfileSettingsStore");

const ProfileModal = findComponentByCodeLazy<ProfileModalProps>(
    "isTryItOut:",
    "pendingThemeColors:",
    "pendingAvatarDecoration:",
    "EDIT_PROFILE_BANNER"
);

type ProfileSetsPreviewProps = {
    section: PresetSection;
    guildId?: string;
};

type PresetSection = "main" | "server";

function getPendingChanges(guildId?: string) {
    return (guildId
        ? UserProfileSettingsStore.getPendingChanges(guildId)
        : UserProfileSettingsStore.getPendingChanges()) as PendingChanges | null | undefined;
}

function ProfileSetsPreviewInner({ section, guildId }: ProfileSetsPreviewProps) {
    const effectiveGuildId = section === "server" ? guildId : undefined;
    const [applyGeneration, setApplyGeneration] = React.useState(getPreviewApplyGeneration);

    React.useEffect(() => {
        setProfileSetsPreviewContext(effectiveGuildId);
        return () => clearProfileSetsPreviewContext();
    }, [effectiveGuildId]);

    React.useEffect(() => subscribePreviewApply(() => {
        setApplyGeneration(getPreviewApplyGeneration());
    }), []);

    const previewState = useStateFromStores(
        [UserProfileSettingsStore, UserProfileStore, UserStore, GuildMemberStore],
        () => {
            const user = UserStore.getCurrentUser();
            const pending = getPendingChanges(effectiveGuildId);
            const profile = user
                ? (effectiveGuildId
                    ? UserProfileStore.getGuildMemberProfile(user.id, effectiveGuildId)
                    : UserProfileStore.getUserProfile(user.id))
                : null;

            const mainProfile = user && effectiveGuildId
                ? UserProfileStore.getUserProfile(user.id)
                : null;

            const previewUser = user ? mergePendingUser(user, effectiveGuildId) : null;

            const pendingAvatarSrc = previewUser
                ? resolvePendingAvatarUrl(pending?.pendingAvatar, previewUser.id, effectiveGuildId)
                : null;

            return {
                user: previewUser,
                pending,
                profile,
                mainProfile,
                pendingThemeColors: resolvePreviewThemeColors(pending, profile, mainProfile),
                pendingAvatarSrc,
                pendingRevision: previewRevisionKey(pending)
            };
        }
    );

    const {
        user,
        pending,
        profile,
        mainProfile,
        pendingThemeColors,
        pendingAvatarSrc,
        pendingRevision
    } = previewState;

    if (!user) return null;

    const pendingAvatarForModal = pending?.pendingAvatar != null
        ? (resolvePendingAvatarUrl(pending.pendingAvatar, user.id, effectiveGuildId) ?? pending.pendingAvatar)
        : undefined;

    const nameplate = resolvePreviewNameplate(user, pending, effectiveGuildId, profile, mainProfile);
    const modalUser = withPreviewNameplate(
        resolveNameplatePreviewUserValue(user, effectiveGuildId, pending),
        nameplate
    );

    return (
        <div className={cl("preview-wrap")}>
            <HeadingSecondary className={cl("preview-heading")}>Profile preview</HeadingSecondary>
            <div className={cl("preview")}>
                <ProfileModal
                    key={`${section}:${effectiveGuildId ?? "main"}:${applyGeneration}:${pendingRevision}`}
                    user={modalUser}
                    {...(pendingThemeColors ? { pendingThemeColors } : {})}
                    pendingAvatarSrc={pendingAvatarSrc}
                    pendingBio={pending?.pendingBio}
                    pendingPronouns={pending?.pendingPronouns}
                    pendingGlobalName={pending?.pendingGlobalName}
                    pendingNickname={pending?.pendingNickname}
                    pendingBanner={pending?.pendingBanner}
                    pendingAvatar={pendingAvatarForModal}
                    pendingAvatarDecoration={pending?.pendingAvatarDecoration}
                    pendingDisplayNameStyles={pending?.pendingDisplayNameStyles}
                    pendingProfileEffect={pending?.pendingProfileEffect}
                    pendingNameplate={nameplate}
                    pendingPrimaryGuildId={pending?.pendingPrimaryGuildId}
                    onAvatarChange={() => { }}
                    onBannerChange={() => { }}
                    canUsePremiumCustomization={true}
                    hideExampleButton={true}
                    hideFakeActivity={true}
                    isTryItOut={false}
                    {...(effectiveGuildId ? { guildId: effectiveGuildId } : {})}
                />
            </div>

            {nameplate ? (
                <>
                    <HeadingSecondary className={classes(cl("preview-heading"), cl("nameplate-heading"))}>
                        Nameplate
                    </HeadingSecondary>
                    <div className={cl("nameplate")}>
                        <ProfileSetsNameplatePreview
                            user={modalUser}
                            nameplate={nameplate}
                            pending={pending}
                            {...(effectiveGuildId ? { guildId: effectiveGuildId } : {})}
                        />
                    </div>
                </>
            ) : null}
        </div>
    );
}

export const ProfileSetsPreview = ErrorBoundary.wrap(ProfileSetsPreviewInner, {
    fallback: () => (
        <div className={classes(cl("preview-wrap"), cl("preview-error"))}>
            Profile preview unavailable.
        </div>
    )
});
