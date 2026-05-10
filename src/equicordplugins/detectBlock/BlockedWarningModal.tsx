/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { classNameFactory } from "@utils/css";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { humanFriendlyJoin } from "@utils/text";
import type { User } from "@vencord/discord-types";
import { Avatar, UserStore } from "@webpack/common";

type WarningVariant = "voiceJoin" | "voiceLeave" | "group";

type WarningAction = {
    text: string;
    variant: "primary" | "secondary";
    confirms: boolean;
};

type WarningRecipe = {
    title: string;
    subtitle: string;
    actions: [WarningAction, WarningAction];
    hearingText: string;
};

const cl = classNameFactory("vc-detect-block-");
const WARNING_GRAPHIC_SRC = "https://cdn.discordapp.com/assets/content/f64aeb4eb878e4f0749f45b759fc3ee6f3a943329962bc573fcbe0ea7678870d.svg";

const WARNING_RECIPES: Record<WarningVariant, WarningRecipe> = {
    voiceJoin: {
        title: "Join voice?",
        subtitle: "Someone who has blocked you is here. If you join, they will still be blocked.",
        actions: [
            { text: "Join", variant: "secondary", confirms: true },
            { text: "Don't join", variant: "primary", confirms: false },
        ],
        hearingText: "You will be able to hear each other",
    },
    voiceLeave: {
        title: "Leave voice?",
        subtitle: "Someone who has blocked you has joined. If you leave, they will still be blocked.",
        actions: [
            { text: "Stay here", variant: "secondary", confirms: false },
            { text: "Leave", variant: "primary", confirms: true },
        ],
        hearingText: "You can both hear each other",
    },
    group: {
        title: "Join group?",
        subtitle: "People who have blocked you are here. Leave group?",
        actions: [
            { text: "Stay here", variant: "secondary", confirms: false },
            { text: "Leave", variant: "primary", confirms: true },
        ],
        hearingText: "You can both hear each other",
    },
};

function getPrimaryUser(userIds: string[]) {
    return userIds
        .map(id => UserStore.getUser(id))
        .find((user): user is User => Boolean(user));
}

function getAvatar(user: User | undefined, fallbackId: string) {
    const fallbackUser = UserStore.getUser(fallbackId);
    return (
        <Avatar
            src={user?.getAvatarURL(undefined, 24, true) ?? fallbackUser?.getAvatarURL(undefined, 24, true) ?? fallbackUser?.getAvatarURL(undefined, 24, false) ?? undefined}
            size="SIZE_32"
        />
    );
}

function getUserDisplayName(user: User | undefined, fallbackId: string) {
    const fallbackUser = UserStore.getUser(fallbackId);
    return user?.globalName || user?.username || fallbackUser?.globalName || fallbackUser?.username || "Unknown user";
}

function getBlockedSubjectText(names: string[], userIds: string[]) {
    const resolvedNames = names.length ? names : userIds.map(userId => getUserDisplayName(UserStore.getUser(userId), userId)).filter(Boolean);
    const subject = resolvedNames.length === 1 ? resolvedNames[0] : humanFriendlyJoin(resolvedNames);
    return {
        subject,
        suffix: resolvedNames.length === 1 ? " is here" : " are here",
    };
}

function WarningIcon() {
    return (
        <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" fillRule="evenodd" d="M10 3.1a2.37 2.37 0 0 1 4 0l8.71 14.75c.84 1.41-.26 3.15-2 3.15H3.29c-1.74 0-2.84-1.74-2-3.15L9.99 3.1Zm3.25 14.65a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM13.06 14l.37-5.94a1 1 0 0 0-1-1.06h-.87a1 1 0 0 0-1 1.06l.38 5.94a1.06 1.06 0 0 0 2.12 0Z" clipRule="evenodd" />
        </svg>
    );
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode; }) {
    return (
        <div className={cl("info-row")}>
            <div className={cl("info-icon")}>{icon}</div>
            <BaseText size="md" weight="medium" color="text-default" className={cl("info-text")}>
                {children}
            </BaseText>
        </div>
    );
}

export function openBlockedWarningModal({
    blockedNames,
    blockedUserIds,
    onConfirm,
    variant,
}: {
    blockedNames: string[];
    blockedUserIds: string[];
    onConfirm: () => void | Promise<void>;
    variant: WarningVariant;
}) {
    const recipe = WARNING_RECIPES[variant];
    const avatarUser = getPrimaryUser(blockedUserIds);
    const subjectText = getBlockedSubjectText(blockedNames, blockedUserIds);

    return openModal(modalProps => (
        <ModalRoot {...modalProps} size={ModalSize.MEDIUM} className={cl("modal")}>
            <ModalHeader separator={false} className={cl("header")}>
                <ModalCloseButton onClick={modalProps.onClose} className={cl("close")} />
                <img alt="" aria-hidden="true" draggable={false} className={cl("graphic")} src={WARNING_GRAPHIC_SRC} />
                <BaseText tag="h1" size="xl" weight="semibold" color="text-strong" className={cl("title")}>
                    {recipe.title}
                </BaseText>
                <BaseText size="md" weight="normal" color="text-muted" className={cl("subtitle")}>
                    {recipe.subtitle}
                </BaseText>
            </ModalHeader>

            <ModalContent className={cl("content")}>
                <div className={cl("info-group")}>
                    <InfoRow icon={getAvatar(avatarUser, blockedUserIds[0] ?? "")}>
                        <span className={cl("subject")}>
                            <BaseText tag="span" size="md" weight="semibold" color="text-default" className={cl("username")}>
                                {subjectText.subject}
                            </BaseText>
                            {subjectText.suffix}
                        </span>
                    </InfoRow>
                    <div className={cl("divider")} />
                    <InfoRow icon={<WarningIcon />}>
                        {recipe.hearingText}
                    </InfoRow>
                </div>
            </ModalContent>

            <ModalFooter className={cl("footer-shell")}>
                <Flex className={cl("footer")}>
                    {recipe.actions.map(action => (
                        <Button
                            key={action.text}
                            variant={action.variant}
                            className={cl("button")}
                            onClick={() => {
                                if (action.confirms) void onConfirm();
                                modalProps.onClose();
                            }}
                        >
                            {action.text}
                        </Button>
                    ))}
                </Flex>
            </ModalFooter>
        </ModalRoot>
    ));
}
