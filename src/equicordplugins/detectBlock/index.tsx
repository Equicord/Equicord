/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { Channel, User } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, UserProfileStore, UserStore, VoiceStateStore } from "@webpack/common";

import { openBlockedWarningModal } from "./BlockedWarningModal";
import { DetectBlockBadge } from "./DetectBlockBadge";
import { clearDetectionState, detectBlockedUsers, primeClear } from "./detection";

interface VoiceState {
    userId: string;
    channelId?: string;
}

const VoiceChannelActions = findByPropsLazy("selectVoiceChannel") as {
    selectVoiceChannel(channelId: string | null): unknown;
};

const warnedVoiceKeys = new Map<string, string>();
const warnedGroupChannels = new Map<string, string>();
type PendingVoiceWarning = {
    promise: Promise<void>;
    needsRecheck: boolean;
};

const pendingVoiceJoins = new Map<string, Promise<void>>();
const pendingGroupWarnings = new Map<string, Promise<void>>();
const pendingVoiceWarnings = new Map<string, PendingVoiceWarning>();
const seenVoiceChannelMembers = new Map<string, Set<string>>();
let activeGeneration = 0;
let latestVoiceJoinAttempt = 0;

function getDisplayName(user: User | undefined) {
    if (!user) return "Unknown user";
    return user.globalName || user.username;
}

function getBlockedVoiceUserIds(channelId: string) {
    const states = VoiceStateStore.getVoiceStatesForChannel(channelId) as Record<string, VoiceState> | null;
    if (!states) return [];

    const currentUserId = UserStore.getCurrentUser().id;
    return Object.values(states)
        .map(state => state.userId)
        .filter(userId => userId && userId !== currentUserId);
}

function sameUserIds(left: string[], right: string[]) {
    if (left.length !== right.length) return false;
    return left.every((userId, index) => userId === right[index]);
}

async function getBlockedUsers(userIds: string[]) {
    const blockedIds = await detectBlockedUsers(userIds);
    if (!blockedIds.length) return [];

    return blockedIds.map(userId => ({
        userId,
        name: getDisplayName(UserStore.getUser(userId))
    }));
}

function shouldWarnForVoiceChannel(channel: Channel | undefined) {
    return channel != null && (
        channel.type === ChannelType.GUILD_VOICE ||
        channel.type === ChannelType.GUILD_STAGE_VOICE ||
        channel.type === ChannelType.DM ||
        channel.type === ChannelType.GROUP_DM
    );
}

async function maybeWarnBeforeVoiceJoin(channelId: string, proceed: () => void | Promise<void>) {
    const pendingJoin = pendingVoiceJoins.get(channelId);
    if (pendingJoin) return pendingJoin;

    const generation = activeGeneration;
    const attemptId = latestVoiceJoinAttempt;

    const pendingPromise = (async () => {
        const channel = ChannelStore.getChannel(channelId);
        if (!shouldWarnForVoiceChannel(channel)) {
            return Promise.resolve(proceed());
        }

        const blockedUserIds = getBlockedVoiceUserIds(channelId).sort();
        const blockedUsers = await getBlockedUsers(blockedUserIds);
        if (generation !== activeGeneration || attemptId !== latestVoiceJoinAttempt) return;
        const latestBlockedUserIds = getBlockedVoiceUserIds(channelId).sort();
        if (!latestBlockedUserIds.length || !sameUserIds(blockedUserIds, latestBlockedUserIds)) {
            return Promise.resolve(proceed());
        }

        openBlockedWarningModal({
            blockedNames: blockedUsers.map(user => user.name),
            blockedUserIds: latestBlockedUserIds,
            variant: "voiceJoin",
            onConfirm: () => {
                if (generation !== activeGeneration || attemptId !== latestVoiceJoinAttempt) return;
                void proceed();
            }
        });
    })().finally(() => {
        if (pendingVoiceJoins.get(channelId) === pendingPromise) {
            pendingVoiceJoins.delete(channelId);
        }
    });

    pendingVoiceJoins.set(channelId, pendingPromise);
    return pendingPromise;
}

async function maybeWarnForCurrentVoiceChannel(channelId: string) {
    const pendingWarning = pendingVoiceWarnings.get(channelId);
    if (pendingWarning) {
        pendingWarning.needsRecheck = true;
        return pendingWarning.promise;
    }

    const generation = activeGeneration;
    const pendingState: PendingVoiceWarning = {
        promise: Promise.resolve(),
        needsRecheck: false
    };

    pendingState.promise = (async () => {
        const blockedUserIds = getBlockedVoiceUserIds(channelId).sort();
        const previousBlockedUserIds = seenVoiceChannelMembers.get(channelId);

        if (!blockedUserIds.length) {
            seenVoiceChannelMembers.delete(channelId);
            warnedVoiceKeys.delete(channelId);
            return;
        }

        const hasNewBlockedUser = previousBlockedUserIds == null || blockedUserIds.some(userId => !previousBlockedUserIds.has(userId));
        if (!hasNewBlockedUser) return;

        const blockedUsers = await getBlockedUsers(blockedUserIds);
        if (generation !== activeGeneration) return;

        const latestBlockedUserIds = getBlockedVoiceUserIds(channelId).sort();
        if (!latestBlockedUserIds.length) {
            seenVoiceChannelMembers.delete(channelId);
            warnedVoiceKeys.delete(channelId);
            return;
        }

        if (!sameUserIds(blockedUserIds, latestBlockedUserIds)) return;

        seenVoiceChannelMembers.set(channelId, new Set(latestBlockedUserIds));

        const warningKey = latestBlockedUserIds.join(",");
        if (warnedVoiceKeys.get(channelId) === warningKey) return;

        warnedVoiceKeys.set(channelId, warningKey);

        openBlockedWarningModal({
            blockedNames: blockedUsers.map(user => user.name),
            blockedUserIds: latestBlockedUserIds,
            variant: "voiceLeave",
            onConfirm: () => {
                if (generation !== activeGeneration) return;
                void VoiceChannelActions.selectVoiceChannel(null);
            }
        });
    })().finally(() => {
        if (pendingVoiceWarnings.get(channelId) === pendingState) {
            pendingVoiceWarnings.delete(channelId);
        }

        if (pendingState.needsRecheck && generation === activeGeneration) {
            void maybeWarnForCurrentVoiceChannel(channelId);
        }
    });

    pendingVoiceWarnings.set(channelId, pendingState);
    return pendingState.promise;
}

async function maybeWarnForGroupChannel(channelId: string) {
    const channel = ChannelStore.getChannel(channelId);
    if (channel?.type !== ChannelType.GROUP_DM) return;
    const pendingWarning = pendingGroupWarnings.get(channelId);
    if (pendingWarning) return pendingWarning;

    const currentRecipientKey = [...channel.recipients].sort().join(",");
    if (warnedGroupChannels.get(channelId) === currentRecipientKey) return;

    const pendingPromise = (async () => {
        const blockedUsers = await getBlockedUsers(channel.recipients);
        const latestChannel = ChannelStore.getChannel(channelId);
        if (latestChannel?.type !== ChannelType.GROUP_DM) return;

        const latestRecipientKey = [...latestChannel.recipients].sort().join(",");
        if (latestRecipientKey !== currentRecipientKey) return;
        if (!blockedUsers.length) {
            warnedGroupChannels.delete(channelId);
            return;
        }

        warnedGroupChannels.set(channelId, latestRecipientKey);

        openBlockedWarningModal({
            blockedNames: blockedUsers.map(user => user.name),
            blockedUserIds: blockedUsers.map(user => user.userId),
            variant: "group",
            onConfirm: () => void 0
        });
    })().finally(() => {
        if (pendingGroupWarnings.get(channelId) === pendingPromise) {
            pendingGroupWarnings.delete(channelId);
        }
    });

    pendingGroupWarnings.set(channelId, pendingPromise);
    return pendingPromise;
}

let originalSelectVoiceChannel: typeof VoiceChannelActions.selectVoiceChannel | null = null;

export default definePlugin({
    name: "DetectBlock",
    description: "Detects users who have blocked you and warns when they appear in voice channels or group DMs.",
    authors: [EquicordDevs.justjxke],
    flux: {
        USER_PROFILE_FETCH_SUCCESS({ userProfile }: { userProfile: { user: User; user_profile: unknown | null; }; }) {
            const userId = userProfile.user.id;
            if (userProfile.user_profile != null && UserProfileStore.getUserProfile(userId) != null) {
                primeClear(userId);
            }
        },
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const currentUserId = UserStore.getCurrentUser().id;
            const myState = VoiceStateStore.getVoiceStateForUser(currentUserId);
            if (!myState?.channelId) return;

            const joinedCurrentChannel = voiceStates.some(state =>
                state.userId !== currentUserId &&
                state.channelId === myState.channelId
            );

            if (!joinedCurrentChannel) return;

            void maybeWarnForCurrentVoiceChannel(myState.channelId);
        },
        CHANNEL_SELECT({ channelId }: { channelId?: string; }) {
            if (!channelId) return;
            const channel = ChannelStore.getChannel(channelId);
            if (channel?.type !== ChannelType.GROUP_DM) return;

            void maybeWarnForGroupChannel(channelId);
        }
    },
    start() {
        activeGeneration++;
        originalSelectVoiceChannel ??= VoiceChannelActions.selectVoiceChannel.bind(VoiceChannelActions);
        VoiceChannelActions.selectVoiceChannel = ((channelId: string | null) => {
            if (!originalSelectVoiceChannel || channelId == null) {
                return originalSelectVoiceChannel?.(channelId);
            }

            latestVoiceJoinAttempt++;
            return maybeWarnBeforeVoiceJoin(channelId, () => {
                originalSelectVoiceChannel?.(channelId);
            });
        }) as typeof VoiceChannelActions.selectVoiceChannel;
    },
    stop() {
        activeGeneration++;
        if (originalSelectVoiceChannel) {
            VoiceChannelActions.selectVoiceChannel = originalSelectVoiceChannel;
        }

        warnedVoiceKeys.clear();
        warnedGroupChannels.clear();
        pendingVoiceJoins.clear();
        pendingGroupWarnings.clear();
        pendingVoiceWarnings.clear();
        seenVoiceChannelMembers.clear();
        clearDetectionState();
    },
    renderNicknameIcon({ userId }) {
        return <DetectBlockBadge user={UserStore.getUser(userId)} isProfile />;
    },
    renderMemberListDecorator({ user }) {
        return <DetectBlockBadge user={user} isMemberList />;
    },
    renderMessageDecoration({ message }) {
        return <DetectBlockBadge user={message?.author} isMessage />;
    }
});
