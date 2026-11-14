/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./badgeDirectory.css";

import { DirectoryBadge } from "@api/Badges";
import { useSettings } from "@api/Settings";
import { Flex } from "@components/Flex";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { DonateButton, InviteButton, TranslateButton } from "@components/settings/DonateButton";
import { SpecialCard } from "@components/settings/SpecialCard";
import { PluginCard } from "@components/settings/tabs/plugins/PluginCard";
import { EquicordDevsById, VencordDevsById } from "@utils/constants";
import { fetchUserProfile } from "@utils/discord";
import { pluralize } from "@utils/misc";
import { React, showToast, useEffect, useMemo, UserProfileStore, UserStore, useStateFromStores } from "@webpack/common";

import Plugins, { PluginMeta } from "~plugins";

const DONOR_BACKGROUND_IMAGE = "https://media.discordapp.net/stickers/1311070116305436712.png?size=2048";
const VENNIE_DONATOR_IMAGE = "https://cdn.discordapp.com/emojis/1238120638020063377.png";
const TRANSLATOR_IMAGE = "https://badge.equicord.org/translator.png";

interface BadgeDirectoryDetailProps {
    badge?: DirectoryBadge;
    userId?: string;
    isViewingOtherUser?: boolean;
}

interface BadgeDirectoryDetailContentProps {
    badge?: DirectoryBadge;
    userId?: string;
    isViewingOtherUser?: boolean;
    isContributor: boolean;
    isDonorBadge: boolean;
    isTranslatorBadge: boolean;
    isEquicordBadge: boolean;
}

function BadgeDirectoryDetailContent({
    badge,
    userId,
    isViewingOtherUser,
    isContributor,
    isDonorBadge,
    isTranslatorBadge,
    isEquicordBadge
}: BadgeDirectoryDetailContentProps) {
    useSettings();

    const currentUser = useStateFromStores([UserStore], () => UserStore.getCurrentUser());
    const targetUserId = userId ?? badge?.userId ?? (isViewingOtherUser ? undefined : currentUser?.id);
    const isSelf = currentUser?.id === targetUserId || !isViewingOtherUser;

    const user = useStateFromStores([UserStore], () => targetUserId ? UserStore.getUser(targetUserId) : null);
    const profile = useStateFromStores([UserProfileStore], () => targetUserId ? UserProfileStore.getUserProfile(targetUserId) : null);

    useEffect(() => {
        if (!profile && targetUserId && !user?.bot) {
            fetchUserProfile(targetUserId);
        }
    }, [targetUserId, user?.bot, profile]);

    const plugins = useMemo(() => {
        if (!isContributor || !targetUserId) return [];
        const allPlugins = Object.values(Plugins);
        const pluginsByAuthor = (VencordDevsById[targetUserId] || EquicordDevsById[targetUserId])
            ? allPlugins.filter(p => p.authors.includes(VencordDevsById[targetUserId] || EquicordDevsById[targetUserId]))
            : allPlugins.filter(p =>
                PluginMeta[p.name]?.userPlugin && p.authors.some(a => a.id.toString() === targetUserId)
                || p.authors.some(a => a.name === user?.username)
            );

        return pluginsByAuthor
            .filter(p => !p.name.endsWith("API"))
            .sort((a, b) => Number(a.required ?? false) - Number(b.required ?? false));
    }, [isContributor, targetUserId, user?.username]);

    if (isContributor) {
        const ContributedHyperLink = <Link href="https://github.com/Equicord/Equicord">contributed</Link>;

        return (
            <div className="vc-badge-directory-section">
                <Paragraph>
                    {plugins.length
                        ? (isSelf
                            ? <>You have {ContributedHyperLink} to {pluralize(plugins.length, "plugin")}!</>
                            : <>This person has {ContributedHyperLink} to {pluralize(plugins.length, "plugin")}!</>)
                        : (isSelf
                            ? <>You have not made any plugins yet. You likely {ContributedHyperLink} in other ways!</>
                            : <>This person has not made any plugins. They likely {ContributedHyperLink} in other ways!</>)}
                </Paragraph>
                {!!plugins.length && (
                    <div className="vc-badge-directory-plugins">
                        {plugins.map(p => (
                            <PluginCard
                                key={p.name}
                                plugin={p}
                                disabled={p.required ?? false}
                                onRestartNeeded={() => showToast({ text: "Restart to apply changes!" })}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (isTranslatorBadge) {
        return (
            <div className="vc-badge-directory-section">
                <SpecialCard
                    title="Translations"
                    subtitle={isSelf ? "Thank you for translating!" : "This user is an Equicord translator!"}
                    description={isSelf
                        ? "Awarded for helping expand Equicord's language support."
                        : "Awarded to contributors who expand Equicord's language support by translating content."}
                    cardImage={TRANSLATOR_IMAGE}
                    backgroundImage={DONOR_BACKGROUND_IMAGE}
                    backgroundColor="#5b7c99"
                >
                    <Flex gap="0.5em" style={{ marginTop: "0.75em" }}>
                        <TranslateButton variant="overlayPrimary" />
                        <InviteButton variant="secondary" />
                    </Flex>
                </SpecialCard>
            </div>
        );
    }

    if (isDonorBadge) {
        const isEquicordDonor = isEquicordBadge;

        return (
            <div className="vc-badge-directory-section">
                <SpecialCard
                    title="Donations"
                    subtitle={isSelf
                        ? "Thank you for donating!"
                        : isEquicordDonor ? "This user is an Equicord donor!" : "This user is a Vencord donor!"}
                    description={isSelf
                        ? (isEquicordDonor
                            ? "Manage your perks by making a ticket in Equicord's server."
                            : "Manage your perks by messaging @vending.machine.")
                        : (isEquicordDonor
                            ? "Support Equicord to get your own badge and perks!"
                            : "Support Vencord to get your own badge and perks!")}
                    cardImage={VENNIE_DONATOR_IMAGE}
                    backgroundImage={DONOR_BACKGROUND_IMAGE}
                    backgroundColor="#ED87A9"
                >
                    <Flex gap="0.5em" style={{ marginTop: "0.75em" }}>
                        <DonateButton
                            equicord={isEquicordDonor}
                            variant="overlayPrimary"
                        />
                        <InviteButton variant="secondary" />
                    </Flex>
                </SpecialCard>
            </div>
        );
    }

    return null;
}

export function BadgeDirectoryDetail({
    badge,
    userId,
    isViewingOtherUser
}: BadgeDirectoryDetailProps) {
    const badgeId = typeof badge?.badge_id === "string"
        ? badge.badge_id
        : typeof badge?.badge_id === "number"
            ? String(badge.badge_id)
            : "";
    const originalBadgeId = typeof badge?.originalBadgeId === "string"
        ? badge.originalBadgeId
        : "";

    const isContributor = badgeId.includes("vencord_contributor_badge")
        || badgeId.includes("equicord_contributor_badge")
        || badgeId.includes("user_plugin_contributor_badge")
        || originalBadgeId === "vencord_contributor_badge"
        || originalBadgeId === "equicord_contributor_badge"
        || originalBadgeId === "user_plugin_contributor_badge";

    const badgeName = badge?.name || badge?.description || "";
    const isTranslatorBadge = badgeName.includes("Translator")
        || originalBadgeId.includes("translator");

    const isDonorBadge = !isTranslatorBadge && (
        badgeId.includes("vencord_donor_badge_")
        || badgeId.includes("equicord_donor_badge_")
        || originalBadgeId.startsWith("vencord_donor_badge_")
        || originalBadgeId.startsWith("equicord_donor_badge_")
    );

    const isEquicordBadge = badgeId.includes("equicord_donor_badge_")
        || originalBadgeId.startsWith("equicord_donor_badge_");

    if (!isContributor && !isDonorBadge && !isTranslatorBadge) return null;

    return (
        <BadgeDirectoryDetailContent
            key={badgeId}
            badge={badge}
            userId={userId}
            isViewingOtherUser={isViewingOtherUser}
            isContributor={isContributor}
            isDonorBadge={isDonorBadge}
            isTranslatorBadge={isTranslatorBadge}
            isEquicordBadge={isEquicordBadge}
        />
    );
}

