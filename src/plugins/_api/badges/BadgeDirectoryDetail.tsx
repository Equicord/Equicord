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
const EQUICORD_DONOR_IMAGE = "https://cdn.discordapp.com/emojis/1026533090627174460.png";

interface BadgeDirectoryDetailProps {
    badge?: DirectoryBadge;
    userId?: string;
    isViewingOtherUser?: boolean;
}

interface BadgeDirectoryDetailContentProps extends BadgeDirectoryDetailProps {
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
        const authorDev = VencordDevsById[targetUserId] || EquicordDevsById[targetUserId];
        const pluginsByAuthor = authorDev
            ? allPlugins.filter(p => p.authors.includes(authorDev))
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
            <div className="vc-badge-directory-section vc-badge-directory-translator vc-badge-directory-dark">
                <SpecialCard
                    className="vc-special-card-dark"
                    subtitle={isSelf ? "Thank you for translating!" : "This user is an Equicord translator!"}
                    description={isSelf
                        ? "Awarded for helping expand Equicord's language support."
                        : "Awarded to contributors who expand Equicord's language support by translating content for the community."}
                    cardImage={TRANSLATOR_IMAGE}
                    backgroundImage={DONOR_BACKGROUND_IMAGE}
                    backgroundColor="#232428"
                >
                    <Flex gap="0.5em" style={{ marginTop: "0.75em" }}>
                        <TranslateButton variant="overlayPrimary" />
                    </Flex>
                </SpecialCard>
            </div>
        );
    }

    if (isDonorBadge) {
        const isEquicordDonor = isEquicordBadge;

        return (
            <div className={`vc-badge-directory-section ${isEquicordDonor ? "vc-badge-directory-equicord-donor vc-badge-directory-dark" : ""}`}>
                <SpecialCard
                    className={isEquicordDonor ? "vc-special-card-dark" : ""}
                    title={isEquicordDonor ? undefined : "Donations"}
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
                    cardImage={isEquicordDonor ? EQUICORD_DONOR_IMAGE : VENNIE_DONATOR_IMAGE}
                    backgroundImage={DONOR_BACKGROUND_IMAGE}
                    backgroundColor={isEquicordDonor ? "#232428" : "#ED87A9"}
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
    const badgeId = String(badge?.badge_id ?? "");
    const originalBadgeId = badge?.originalBadgeId ?? "";

    const isContributor = ["vencord_contributor_badge", "equicord_contributor_badge", "user_plugin_contributor_badge"]
        .some(name => badgeId.includes(name) || originalBadgeId === name);

    const badgeName = badge?.name || badge?.description || "";
    const isTranslatorBadge = badgeName.toLowerCase().includes("translator")
        || originalBadgeId.toLowerCase().includes("translator")
        || (typeof badge?.simple_icon_url === "string" && badge.simple_icon_url.includes("translator"));

    const isDonorBadge = !isTranslatorBadge && ["vencord_donor_badge_", "equicord_donor_badge_"]
        .some(name => badgeId.includes(name) || originalBadgeId.startsWith(name));

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
