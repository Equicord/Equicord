/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { Nameplate, User } from "@vencord/discord-types";
import { findComponentByCodeLazy } from "@webpack";
import { React } from "@webpack/common";

import { cl } from "../classNames";

type PendingNameplateProps = {
    pendingGlobalName?: string | null;
    pendingNickname?: string | null;
    pendingDisplayNameStyles?: User["displayNameStyles"] | null;
    pendingAvatarDecoration?: unknown;
    pendingPrimaryGuildId?: string | null;
};

type ProfileSetsNameplatePreviewProps = {
    user: User;
    nameplate: Nameplate;
    guildId?: string;
    pending?: PendingNameplateProps | null;
};

const NameplatePreview = findComponentByCodeLazy<{
    user: User;
    guildId?: string;
    nameplate: Nameplate;
    pendingGlobalName?: string | null;
    pendingNickname?: string | null;
    pendingAvatarDecoration?: unknown;
    pendingDisplayNameStyles?: User["displayNameStyles"] | null;
    pendingPrimaryGuildId?: string | null;
    hideDecorators?: boolean;
    nameplatePreviewSize?: "default" | "small" | "large" | "xlarge" | "xsmall";
    showStatus?: boolean;
    showPlaceholderUser?: boolean;
    isHighlighted?: boolean;
}>(
    "nameplatePreviewSize:",
    "skipEffectDisplayName:",
    "hideDecorators:"
);

function ProfileSetsNameplatePreviewInner({
    user,
    nameplate,
    guildId,
    pending
}: ProfileSetsNameplatePreviewProps) {
    return (
        <div className={cl("nameplate-card")}>
            <NameplatePreview
                user={user}
                nameplate={nameplate}
                pendingGlobalName={pending?.pendingGlobalName}
                pendingNickname={pending?.pendingNickname}
                pendingAvatarDecoration={pending?.pendingAvatarDecoration}
                pendingDisplayNameStyles={pending?.pendingDisplayNameStyles}
                pendingPrimaryGuildId={pending?.pendingPrimaryGuildId}
                hideDecorators
                showStatus
                nameplatePreviewSize="default"
                {...(guildId ? { guildId } : {})}
            />
        </div>
    );
}

export const ProfileSetsNameplatePreview = ErrorBoundary.wrap(ProfileSetsNameplatePreviewInner, {
    fallback: () => (
        <div className={cl("nameplate-card")}>
            Nameplate preview unavailable.
        </div>
    )
});
