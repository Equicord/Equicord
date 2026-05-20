/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Auth, getToken } from "@plugins/reviewDB/auth";
import { Review, ReviewType } from "@plugins/reviewDB/entities";
import { blockUser, deleteReview, reportReview, unblockUser } from "@plugins/reviewDB/reviewDbApi";
import { settings } from "@plugins/reviewDB/settings";
import { canBlockReviewAuthor, canDeleteReview, canReportReview, cl, showToast } from "@plugins/reviewDB/utils";
import { openUserProfile } from "@utils/discord";
import { classes } from "@utils/misc";
import { t } from "@utils/translation";
import { findCssClassesLazy } from "@webpack";
import { ConfirmModal,IconUtils, openModal as openVencordModal, Parser, Timestamp, useState } from "@webpack/common";

import { openBlockModal } from "./BlockedUserModal";
import { BlockButton, DeleteButton, ReportButton } from "./MessageButton";
import ReviewBadge from "./ReviewBadge";

const MessageClasses = findCssClassesLazy("cozyMessage", "message", "groupStart", "buttons", "buttonsInner");
const ContainerClasses = findCssClassesLazy("container", "isHeader");
const AvatarClasses = findCssClassesLazy("avatar", "wrapper", "cozy", "clickable", "username");
const ButtonClasses = findCssClassesLazy("button", "wrapper", "selected");
const BotTagClasses = findCssClassesLazy("botTagVerified", "botTagRegular", "botText", "px", "rem");

const dateFormat = new Intl.DateTimeFormat();

export default function ReviewComponent({ review, refetch, profileId }: { review: Review; refetch(): void; profileId: string; }) {
    const [showAll, setShowAll] = useState(false);

    function openModal() {
        openUserProfile(review.sender.discordID);
    }

    function delReview() {
        openVencordModal(props => (
            <ConfirmModal
                {...props}
                title={t("vencord.reviewDB.areYouSure")}
                subtitle={t("vencord.reviewDB.confirmDelete")}
                confirmText={t("vencord.reviewDB.delete")}
                cancelText={t("vencord.reviewDB.nevermind")}
                onConfirm={async () => {
                    if (!(await getToken())) {
                        return showToast(t("vencord.reviewDB.mustBeLoggedInDelete"));
                    } else {
                        deleteReview(review.id).then(res => {
                            if (res) {
                                refetch();
                            }
                        });
                    }
                }}
            />
        ));
    }

    function reportRev() {
        openVencordModal(props => (
            <ConfirmModal
                {...props}
                title={t("vencord.reviewDB.areYouSure")}
                subtitle={t("vencord.reviewDB.confirmReport")}
                confirmText={t("vencord.reviewDB.report")}
                cancelText={t("vencord.reviewDB.nevermind")}
                onConfirm={async () => {
                    if (!(await getToken())) {
                        return showToast(t("vencord.reviewDB.mustBeLoggedInReport"));
                    } else {
                        reportReview(review.id);
                    }
                }}
            />
        ));
    }

    const isAuthorBlocked = Auth?.user?.blockedUsers?.includes(review.sender.discordID) ?? false;

    function blockReviewSender() {
        if (isAuthorBlocked)
            return unblockUser(review.sender.discordID);

        openVencordModal(props => (
            <ConfirmModal
                {...props}
                title={t("vencord.reviewDB.areYouSure")}
                subtitle={t("vencord.reviewDB.confirmBlock")}
                confirmText={t("vencord.reviewDB.block")}
                cancelText={t("vencord.reviewDB.nevermind")}
                onConfirm={async () => {
                    if (!(await getToken())) {
                        return showToast(t("vencord.reviewDB.mustBeLoggedInBlock"));
                    } else {
                        blockUser(review.sender.discordID);
                    }
                }}
            />
        ));
    }

    return (
        <div className={classes(cl("review"), MessageClasses.cozyMessage, AvatarClasses.wrapper, MessageClasses.message, MessageClasses.groupStart, AvatarClasses.cozy)} style={
            {
                marginLeft: "0px",
                paddingLeft: "52px", // wth is this
                // nobody knows anymore
            }
        }>

            <img
                className={classes(AvatarClasses.avatar, AvatarClasses.clickable)}
                onClick={openModal}
                src={review.sender.profilePhoto || IconUtils.getDefaultAvatarURL(review.sender.discordID)}
                style={{ left: "0px", zIndex: 0 }}
                onError={e => e.currentTarget.src = IconUtils.getDefaultAvatarURL(review.sender.discordID)}
            />
            <div style={{ display: "inline-flex", justifyContent: "center", alignItems: "center" }}>
                <span
                    className={classes(AvatarClasses.clickable, AvatarClasses.username)}
                    style={{ color: "var(--channels-default)", fontSize: "14px" }}
                    onClick={() => openModal()}
                >
                    {review.sender.username}
                </span>

                {review.type === ReviewType.System && (
                    <span
                        className={classes(BotTagClasses.botTagVerified, BotTagClasses.botTagRegular, BotTagClasses.px, BotTagClasses.rem)}
                        style={{ marginLeft: "4px" }}>
                        <span className={BotTagClasses.botText}>
                            {t("vencord.reviewDB.system")}
                        </span>
                    </span>
                )}
            </div>
            {isAuthorBlocked && (
                <ReviewBadge
                    name={t("vencord.reviewDB.blockedUser")}
                    description={t("vencord.reviewDB.blockedUser")}
                    icon="/assets/aaee57e0090991557b66.svg"
                    type={0}
                    onClick={() => openBlockModal()}
                />
            )}
            {review.sender.badges.map((badge, idx) => <ReviewBadge key={idx} {...badge} />)}

            {
                !settings.store.hideTimestamps && review.type !== ReviewType.System && (
                    <Timestamp timestamp={new Date(review.timestamp * 1000)} >
                        {dateFormat.format(review.timestamp * 1000)}
                    </Timestamp>)
            }

            <div className={cl("review-comment")}>
                {(review.comment.length > 200 && !showAll)
                    ? (
                        <>
                            {Parser.parseGuildEventDescription(review.comment.substring(0, 200))}...
                            <br />
                            <a onClick={() => setShowAll(true)}>{t("vencord.reviewDB.readMore")}</a>]
                        </>
                    )
                    : Parser.parseGuildEventDescription(review.comment)}
            </div>

            {review.id !== 0 && (
                <div className={classes(ContainerClasses.container, ContainerClasses.isHeader, MessageClasses.buttons)} style={{
                    padding: "0px",
                }}>
                    <div className={classes(ButtonClasses.wrapper, MessageClasses.buttonsInner)} >
                        {canReportReview(review) && <ReportButton onClick={reportRev} />}
                        {canBlockReviewAuthor(profileId, review) && <BlockButton isBlocked={isAuthorBlocked} onClick={blockReviewSender} />}
                        {canDeleteReview(profileId, review) && <DeleteButton onClick={delReview} />}
                    </div>
                </div>
            )}
        </div>
    );
}
