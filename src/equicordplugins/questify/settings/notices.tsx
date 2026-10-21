/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ModalOptions, ModalProps, RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, useEffect, useState } from "@webpack/common";
import type { ComponentType, JSX } from "react";

import { getQuestifySettings } from "./access";
import { resetDangerousSettings } from "./dangerous";
import { promptToRestartIfDirty } from "./restartTracking";

type NoticeActionVariant = "primary" | "secondary" | "critical-primary" | "critical-secondary" | "active" | "overlay-primary" | "overlay-secondary" | "expressive";

type QuestifyModalOptions = ModalOptions & { dismissable?: boolean; };
type QuestifyModalProps = ModalProps & { dismissable?: boolean; };

const QuestifyModal = Modal as ComponentType<QuestifyModalProps>;

interface NoticeActionStep {
    text: string;
    variant?: NoticeActionVariant;
    disabledFor?: number; // Seconds
    confirmation?: NoticeActionStep;
}

interface NoticeAction extends NoticeActionStep {
    run?: () => void;
    promptForRestart?: boolean;
}

interface OneTimeNotice {
    id: string;
    title: string;
    dismissable?: boolean;
    renderBody: () => JSX.Element;
    condition: () => boolean;
    autoAcknowledgeCondition?: () => boolean;
    actions: readonly NoticeAction[];
}

const oneTimeNotices = [
    {
        id: "quest-ban-warning-2026-08-07",
        title: "Questify Notice - August 7th, 2026",
        renderBody: () => <div className="questify-startup-notice-body">
            <p>
                Discord has implemented a Quest Ban system which will temporarily or permanently limit your access to completing Quests and claiming their rewards if you are found to be completing them through unofficial means. Modifying the completion of Quests is against their <a href="https://discord.com/safety/platform-manipulation-policy-explainer" target="_blank" rel="noreferrer">Terms of Service</a>.
            </p>
            <br />
            <p>
                The punishment appears limited to loss of access to Quests and their rewards, but Discord may escalate at any time.
            </p>
            <br />
            <p>
                Due to the various methods Discord uses to track users, there's no way to realistically evade detection. If you proceed, understand that Discord likely will detect it at some point.
            </p>
        </div>,
        condition: () => {
            const settings = getQuestifySettings();

            return settings.enabled && settings.allowChangingDangerousSettings;
        },
        autoAcknowledgeCondition: () => !getQuestifySettings().allowChangingDangerousSettings,
        actions: [
            {
                text: "Keep Using Dangerous Questify Settings",
                variant: "critical-primary",
            },
            {
                text: "Disable Dangerous Questify Settings",
                variant: "primary",
                run: resetDangerousSettings,
                promptForRestart: true,
            },
        ],
    },
    {
        id: "quest-ban-warning-2026-08-26",
        title: "Questify Notice - August 26th, 2026",
        dismissable: false,
        renderBody: () => <div className="questify-startup-notice-body">
            <p>
                Discord has begun punishing users of scripts and plugins that modify the completion of Quests. Modifying the completion of Quests is against their <a href="https://discord.com/safety/platform-manipulation-policy-explainer" target="_blank" rel="noreferrer">Terms of Service</a>.
            </p>
            <br />
            <p>
                The punishment consists of a temporary or permanent loss of access to Quests and their rewards. <strong>The punishment also consists of an account standing violation which lasts 2 years per violation.</strong>
            </p>
            <br />
            <p>
                Due to the various methods Discord uses to track users, there's no way to realistically evade detection. If you proceed, understand that Discord likely will detect your use at some point.
            </p>
        </div>,
        condition: () => {
            const settings = getQuestifySettings();

            return settings.enabled && settings.allowChangingDangerousSettings;
        },
        autoAcknowledgeCondition: () => !getQuestifySettings().allowChangingDangerousSettings,
        actions: [
            {
                text: "Keep Using Dangerous Questify Settings",
                variant: "critical-primary",
                disabledFor: 10,
                confirmation: {
                    text: "Are You Sure?",
                    variant: "critical-secondary",
                    disabledFor: 5,
                },
            },
            {
                text: "Disable Dangerous Questify Settings",
                variant: "primary",
                run: resetDangerousSettings,
                promptForRestart: true,
            },
        ],
    },
] as const satisfies readonly OneTimeNotice[];

function acknowledgeNotice(id: string): void {
    const settings = getQuestifySettings();

    settings.acknowledgedNotices = {
        ...settings.acknowledgedNotices,
        [id]: true,
    };
}

function runNoticeAction(notice: OneTimeNotice, action: NoticeAction, onClose: () => void): void {
    acknowledgeNotice(notice.id);
    action.run?.();
    onClose();

    setTimeout(() => {
        if (!action.promptForRestart || !promptToRestartIfDirty({ onDecline: showPendingQuestifyNotice })) {
            showPendingQuestifyNotice();
        }
    }, 0);
}

interface NoticeActionState {
    step: NoticeActionStep;
    startedAt: number;
}

function getRemainingSeconds({ startedAt, step }: NoticeActionState, now: number): number {
    const disabledFor = Math.max(0, step.disabledFor ?? 0);

    return Math.max(0, Math.ceil((startedAt + disabledFor * 1000 - now) / 1000));
}

function isNoticeDismissable(notice: OneTimeNotice): boolean {
    return notice.dismissable ?? true;
}

function OneTimeNoticeModal({ notice, ...modalProps }: RenderModalProps & { notice: OneTimeNotice; }): JSX.Element {
    const [actionStates, setActionStates] = useState<NoticeActionState[]>(() => {
        const startedAt = Date.now();

        return notice.actions.map(step => ({ step, startedAt }));
    });

    const [now, setNow] = useState(Date.now);
    const remainingSeconds = actionStates.map(actionState => getRemainingSeconds(actionState, now));
    const isCountingDown = remainingSeconds.some(seconds => seconds > 0);

    useEffect(() => {
        if (!isCountingDown) return;

        const timeout = setTimeout(() => setNow(Date.now()), 250);

        return () => clearTimeout(timeout);
    }, [actionStates, isCountingDown, now]);

    function handleActionClick(actionIndex: number): void {
        const { confirmation } = actionStates[actionIndex].step;

        if (confirmation) {
            const startedAt = Date.now();

            setActionStates(currentStates => currentStates.map((actionState, index) => (
                index === actionIndex
                    ? { step: confirmation, startedAt }
                    : actionState
            )));
            setNow(startedAt);
            return;
        }

        runNoticeAction(notice, notice.actions[actionIndex], modalProps.onClose);
    }

    return (
        <QuestifyModal
            {...modalProps}
            dismissable={isNoticeDismissable(notice)}
            role="alertdialog"
            size="lg"
            title={notice.title}
            actions={actionStates.map(({ step }, actionIndex) => ({
                text: remainingSeconds[actionIndex] > 0
                    ? `${step.text} (${remainingSeconds[actionIndex]})`
                    : step.text,
                variant: step.variant ?? "primary",
                disabled: remainingSeconds[actionIndex] > 0,
                onClick: () => handleActionClick(actionIndex),
            }))}
        >
            {notice.renderBody()}
        </QuestifyModal>
    );
}

export function showPendingQuestifyNotice(): void {
    for (const notice of oneTimeNotices) {
        if (getQuestifySettings().acknowledgedNotices[notice.id]) {
            continue;
        }

        if (!notice.condition()) {
            if (notice.autoAcknowledgeCondition?.()) {
                acknowledgeNotice(notice.id);
            }

            continue;
        }

        const modalOptions: QuestifyModalOptions = {
            dismissable: isNoticeDismissable(notice),
        };

        openModal(modalProps => <OneTimeNoticeModal {...modalProps} notice={notice} />, modalOptions);
        return;
    }
}
