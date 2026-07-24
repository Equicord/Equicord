/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { get, set } from "@api/DataStore";
import { HeaderBarButton } from "@api/HeaderBar";
import { BaseText } from "@components/BaseText";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { fetchUserProfile, openUserProfile } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { classes } from "@utils/misc";
import definePlugin from "@utils/types";
import type { VoiceState } from "@vencord/discord-types";
import { findComponentByCodeLazy, findCssClassesLazy } from "@webpack";
import { Avatar, Clickable, IconUtils, Modal, openModal, ScrollerThin, SelectedChannelStore, useEffect, UserStore, useState, useStateFromStores, VoiceStateStore } from "@webpack/common";
import type { ComponentProps } from "react";

const wrapperClasses = findCssClassesLazy("memberSinceWrapper");
const containerClasses = findCssClassesLazy("memberSince");
const cl = classNameFactory("vc-voicestats-");
const Section = findComponentByCodeLazy("headingVariant:", '"section"', "headingIcon:");
const logger = new Logger("VoiceStats");

const storageKey = "VoiceStats_totals";
const saveIntervalMs = 30_000;

const sessionStarts = new Map<string, number>();
const totalsByUser = new Map<string, number>();
let trackedChannelId: string | null = null;
let saveIntervalId: ReturnType<typeof setInterval> | null = null;
let loadPromise: Promise<void> | null = null;

function loadStoredTotals() {
    loadPromise = get<Record<string, number>>(storageKey).then(saved => {
        if (saved) {
            for (const [userId, value] of Object.entries(saved)) {
                const current = totalsByUser.get(userId) ?? 0;
                totalsByUser.set(userId, current + value);
            }
        }
    }).catch(e => logger.error("Failed to load VoiceStats", e));
    return loadPromise;
}

async function persistTotals() {
    if (loadPromise) await loadPromise;
    await set(storageKey, Object.fromEntries(totalsByUser));
}

function flushActiveSessions() {
    const now = Date.now();
    for (const [userId, startedAt] of sessionStarts) {
        const accrued = Math.floor((now - startedAt) / 1000);
        totalsByUser.set(userId, (totalsByUser.get(userId) ?? 0) + accrued);
        sessionStarts.set(userId, now);
    }
}

function startTrackingChannel(channelId: string, myId: string) {
    trackedChannelId = channelId;
    const states = VoiceStateStore.getVoiceStatesForChannel(channelId) ?? {};
    const now = Date.now();
    for (const state of Object.values(states) as VoiceState[]) {
        if (state.userId !== myId) sessionStarts.set(state.userId, now);
    }
    saveIntervalId = setInterval(() => {
        flushActiveSessions();
        persistTotals();
    }, saveIntervalMs);
}

function stopTrackingChannel() {
    if (saveIntervalId) {
        clearInterval(saveIntervalId);
        saveIntervalId = null;
    }
    if (!trackedChannelId) return;
    flushActiveSessions();
    sessionStarts.clear();
    trackedChannelId = null;
    persistTotals();
}

function getLiveSeconds(userId: string): number {
    const stored = totalsByUser.get(userId) ?? 0;
    const startedAt = sessionStarts.get(userId);
    return startedAt ? stored + Math.floor((Date.now() - startedAt) / 1000) : stored;
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function AnalyticsIcon(props: ComponentProps<"svg">) {
    return (
        <svg viewBox="0 0 24 24" {...props}>
            <path fill="currentColor" fillRule="evenodd" d="M2 19V5a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Zm16-9.59V13a1 1 0 1 0 2 0V7a1 1 0 0 0-1-1h-6a1 1 0 1 0 0 2h3.59l-5.09 5.09-1.8-1.8a1 1 0 0 0-1.4 0l-4 4a1 1 0 1 0 1.4 1.42L9 13.4l1.8 1.8a1 1 0 0 0 1.4 0L18 9.4Z" clipRule="evenodd" />
        </svg>
    );
}

type LeaderboardModalProps = ComponentProps<typeof Modal>;

function LeaderboardRow({ userId, total, index }: { userId: string, total: number, index: number; }) {
    const user = useStateFromStores([UserStore], () => UserStore.getUser(userId), [userId]);

    useEffect(() => {
        if (!user) fetchUserProfile(userId).catch(e => logger.error("Failed to fetch user profile.", e));
    }, [user, userId]);

    const avatarUrl = user ? IconUtils.getUserAvatarURL(user, true, 32) : IconUtils.getDefaultAvatarURL(userId);
    const username = user ? (user.globalName ?? user.username) : userId;

    return (
        <Clickable
            className={cl("row")}
            onClick={() => openUserProfile(userId)}
        >
            <div className={cl("rank")}>#{index + 1}</div>
            <Avatar src={avatarUrl} size="SIZE_32" />
            <div className={cl("name")}>{username}</div>
            <div className={cl("time")}>{formatDuration(total)}</div>
        </Clickable>
    );
}

function LeaderboardModal(props: LeaderboardModalProps) {
    const hasLiveSessions = sessionStarts.size > 0;
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!hasLiveSessions) return;
        const intervalId = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(intervalId);
    }, [hasLiveSessions]);

    const allUserIds = new Set([...totalsByUser.keys(), ...sessionStarts.keys()]);

    const sorted = Array.from(allUserIds).map(userId => {
        let currentTotal = totalsByUser.get(userId) ?? 0;
        const startedAt = sessionStarts.get(userId);
        if (startedAt) currentTotal += Math.floor((now - startedAt) / 1000);
        return { userId, total: currentTotal };
    }).filter(x => x.total > 0).sort((a, b) => b.total - a.total).slice(0, 99);

    return (
        <Modal {...props}>
            <ScrollerThin className={cl("leaderboard")}>
                {sorted.length === 0 ? (
                    <div className={cl("empty")}>
                        No data available.
                    </div>
                ) : (
                    sorted.map((item, index) => (
                        <LeaderboardRow
                            key={item.userId}
                            userId={item.userId}
                            total={item.total}
                            index={index}
                        />
                    ))
                )}
            </ScrollerThin>
        </Modal>
    );
}

const VoiceStatsSection = ErrorBoundary.wrap(({ userId, isSideBar }: { userId: string; isSideBar: boolean; }) => {
    const isLive = sessionStarts.has(userId);
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        if (!isLive) return;
        const intervalId = setInterval(() => forceUpdate(n => n + 1), 1000);
        return () => clearInterval(intervalId);
    }, [isLive]);

    const seconds = getLiveSeconds(userId);
    if (seconds <= 0) return null;

    const text = formatDuration(seconds);

    if (isSideBar) {
        return (
            <Section
                heading="Voice Time"
                headingVariant="text-xs/semibold"
                headingColor="text-strong"
            >
                <BaseText size="sm">{text}</BaseText>
            </Section>
        );
    }

    return (
        <Section
            heading="Voice Time"
            headingVariant="text-xs/medium"
            headingColor="text-default"
            className={cl("profile-section")}
        >
            <Clickable
                className={classes(wrapperClasses.memberSinceWrapper, cl("clickable"))}
                onClick={() => openModal(p => <LeaderboardModal {...p} title="VoiceStats Leaderboard" size="md" />)}
            >
                <div className={containerClasses.memberSince}>
                    <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="var(--interactive-icon-default)"
                    >
                        <path d="M12 1a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
                        <path d="M19 11a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21a1 1 0 1 0 2 0v-3.08A7 7 0 0 0 19 11Z" />
                    </svg>
                    <BaseText size="sm">{text}</BaseText>
                </div>
            </Clickable>
        </Section>
    );
}, { noop: true });

const VoiceStatsButton = ErrorBoundary.wrap(function VoiceStatsButton() {
    return (
        <HeaderBarButton
            className="vc-voicestats-btn"
            onClick={() => openModal(p => <LeaderboardModal {...p} title="VoiceStats Leaderboard" size="md" />)}
            tooltip="VoiceStats Leaderboard"
            icon={AnalyticsIcon}
        />
    );
}, { noop: true });

export default definePlugin({
    name: "VoiceStats",
    description: "Shows how long you've spent in voice with each user in their profile",
    tags: ["Voice", "Friends"],
    authors: [EquicordDevs.Moowi, EquicordDevs.lucabeyer],
    dependencies: ["ProfileSectionsAPI", "HeaderBarAPI"],
    headerBarButton: {
        icon: AnalyticsIcon,
        render: () => <VoiceStatsButton />,
        priority: 0,
    },
    renderProfileSection: {
        render: VoiceStatsSection,
        priority: 0,
    },
    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const myId = UserStore.getCurrentUser()?.id;
            if (!myId) return;

            for (const state of voiceStates) {
                const { userId, channelId, oldChannelId } = state;

                if (userId === myId) {
                    if (!oldChannelId && channelId) startTrackingChannel(channelId, myId);
                    else if (oldChannelId && !channelId) stopTrackingChannel();
                    else if (channelId && channelId !== oldChannelId) {
                        stopTrackingChannel();
                        startTrackingChannel(channelId, myId);
                    }
                    continue;
                }

                const joinedMyChannel = trackedChannelId !== null && channelId === trackedChannelId && oldChannelId !== trackedChannelId;
                const leftMyChannel = trackedChannelId !== null && oldChannelId === trackedChannelId && channelId !== trackedChannelId;

                if (joinedMyChannel) {
                    sessionStarts.set(userId, Date.now());
                } else if (leftMyChannel && sessionStarts.has(userId)) {
                    const startedAt = sessionStarts.get(userId)!;
                    const accrued = Math.floor((Date.now() - startedAt) / 1000);
                    totalsByUser.set(userId, (totalsByUser.get(userId) ?? 0) + accrued);
                    sessionStarts.delete(userId);
                    persistTotals();
                }
            }
        }
    },

    async start() {
        await loadStoredTotals();
        const myId = UserStore.getCurrentUser()?.id;
        if (!myId) return;
        const channelId = SelectedChannelStore.getVoiceChannelId?.();
        if (channelId) startTrackingChannel(channelId, myId);
    },

    stop() {
        stopTrackingChannel();
    }
});
