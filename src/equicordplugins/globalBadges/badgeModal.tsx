/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { HeadingTertiary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { openInviteModal } from "@utils/discord";
import { RenderModalProps, User } from "@vencord/discord-types";
import { Modal, openModal, React, Tooltip } from "@webpack/common";

import { cl, GlobalBadges, INVITE_LINK } from "./utils";

export const BadgeModalComponent = ({ key, tooltip, badge }: { key: string, tooltip: string, badge: string; }) => {
    return (
        <>
            <Tooltip text={tooltip} >
                {(tooltipProps: any) => (
                    <img
                        className={cl("modal-badge")}
                        key={key}
                        {...tooltipProps}
                        src={badge}
                    />
                )}
            </Tooltip>
        </>
    );
};

export function openBadgeModal(user: User) {
    const badgeDataElements = GlobalBadges[user.id].map(badge => (
        <BadgeModalComponent key={badge.key} tooltip={badge.tooltip} badge={badge.badge} />
    ));

    openModal((modalprops: RenderModalProps) => (
        <Modal
            {...modalprops}
            size="sm"
            title={
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img
                        className={cl("modal-avatar")}
                        src={user.getAvatarURL(undefined, 512, true)}
                        alt=""
                    />
                    <HeadingTertiary className={cl("modal-name")} style={{ color: "white" }}>
                        {user.username}
                    </HeadingTertiary>
                </div>
            }
            actions={[
                {
                    text: "Join GlobalBadges Server",
                    variant: "link",
                    onClick: () => openInviteModal(INVITE_LINK)
                }
            ]}
        >
            <ErrorBoundary>
                <div className={cl("modal-description")}>
                    {badgeDataElements.length ? (
                        <>
                            <Paragraph className={cl("modal-text")}>
                                {badgeDataElements.length} global badge
                                {badgeDataElements.length > 1 ? "s" : ""}.
                            </Paragraph>
                            <div className={cl("modal-badges")}>
                                {badgeDataElements}
                            </div>
                        </>
                    ) : (
                        <Paragraph>
                            No global badges.
                        </Paragraph>
                    )}
                </div>
            </ErrorBoundary>
        </Modal>
    ));
}
