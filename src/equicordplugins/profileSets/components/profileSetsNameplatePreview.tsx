/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { getUserAvatarUrl } from "@utils/misc";
import { Nameplate, User } from "@vencord/discord-types";
import { findByCodeLazy, findComponentByCodeLazy } from "@webpack";
import { React, UsernameUtils } from "@webpack/common";

import { cl } from "../classNames";
import { resolvePendingAvatarUrl } from "../utils/previewImage";

type PendingNameplateProps = {
    pendingGlobalName?: string | null;
    pendingNickname?: string | null;
    pendingDisplayNameStyles?: User["displayNameStyles"] | null;
    pendingAvatar?: unknown;
};

type ProfileSetsNameplatePreviewProps = {
    user: User;
    nameplate: Nameplate;
    guildId?: string;
    pending?: PendingNameplateProps | null;
    pendingAvatarSrc?: string | null;
};

const getNameplateSrc = findByCodeLazy(
    "nameplates",
    "cdn.discordapp.com"
) as ((nameplate: Nameplate, size?: number) => string) | undefined;

const NameplateArt = findComponentByCodeLazy<{ nameplate: Nameplate; placement: "preview"; }>(
    ".MINI_PREVIEW,[",
    "nameplate:",
    "placement"
);

const DiscordTag = findComponentByCodeLazy<{
    user: User;
    displayNameStyles?: User["displayNameStyles"];
    forceUsername?: boolean;
    guildId?: string;
}>('location:"DiscordTag"});');

function resolveNameplateBackgroundUrl(nameplate: Nameplate, size = 600): string | null {
    const asset = nameplate.asset;
    if (!asset) return null;
    if (asset.startsWith("data:") || asset.startsWith("http://") || asset.startsWith("https://")) {
        return asset;
    }

    const fn = getNameplateSrc;
    if (typeof fn === "function") {
        const url = fn(nameplate, size);
        if (typeof url === "string" && url.length) return url;
    }

    const skuId = nameplate.skuId;
    if (skuId == null) return null;
    return `https://cdn.discordapp.com/nameplates/${String(skuId)}/${asset}.png?size=${size}`;
}

function resolveAvatarSrc(
    user: User,
    guildId: string | undefined,
    pending: PendingNameplateProps | null | undefined,
    pendingAvatarSrc: string | null | undefined
): string {
    const fromPending = pendingAvatarSrc
        ?? (pending?.pendingAvatar != null
            ? resolvePendingAvatarUrl(pending.pendingAvatar, user.id, guildId, 128)
            : null);

    if (fromPending) return fromPending;
    return getUserAvatarUrl(user, guildId, true, 128);
}

function ProfileSetsNameplatePreviewInner({
    user,
    nameplate,
    guildId,
    pending,
    pendingAvatarSrc
}: ProfileSetsNameplatePreviewProps) {
    const displayNameStyles = pending?.pendingDisplayNameStyles !== undefined
        ? pending.pendingDisplayNameStyles
        : user.displayNameStyles;

    const avatarSrc = resolveAvatarSrc(user, guildId, pending, pendingAvatarSrc);
    const displayLabel = UsernameUtils.getGlobalName(user) ?? user.globalName ?? user.username;
    const backgroundUrl = resolveNameplateBackgroundUrl(nameplate);

    return (
        <div
            className={cl("nameplate-card")}
            style={backgroundUrl ? {
                backgroundImage: `url(${backgroundUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center"
            } : undefined}
        >
            {!backgroundUrl ? (
                <div className={cl("nameplate-card-art")}>
                    <NameplateArt nameplate={nameplate} placement="preview" />
                </div>
            ) : null}
            <div className={cl("nameplate-card-content")}>
                <img
                    className={cl("nameplate-card-avatar")}
                    src={avatarSrc}
                    alt=""
                />
                <div className={cl("nameplate-card-name-wrap")}>
                    <span className={cl("nameplate-card-name")}>{displayLabel}</span>
                    {displayNameStyles ? (
                        <div className={cl("nameplate-card-styled")}>
                            <DiscordTag
                                user={user}
                                forceUsername={false}
                                displayNameStyles={displayNameStyles}
                                {...(guildId ? { guildId } : {})}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export const ProfileSetsNameplatePreview = ErrorBoundary.wrap(ProfileSetsNameplatePreviewInner, {
    noop: true
});
