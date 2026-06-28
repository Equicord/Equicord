/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import { EquicordDevs } from "@utils/constants";
import {
    ChannelStore,
    React,
    UserStore,
    VoiceStateStore
} from "@webpack/common";
import {
    currentVoiceChannelId,
    loadData,
    recordInteraction,
    setCurrentVoiceChannelId,
    startVoiceScoring,
    stopVoiceScoring,
    syncWithAffinities
} from "./scoring";
import settings from "./settings";
import { getForceUpdateWidget, isPluginEnabled, setIsEnabled } from "./state";
import { FrequentFriendsWidget } from "./ui";
import "./style.css";

function onMessage(e: any) {
    const msg = e?.message;
    const currentUser = UserStore.getCurrentUser();
    if (!msg?.author?.id || !currentUser) return;
    const channel = ChannelStore.getChannel(msg.channel_id!);
    if (!channel || channel.type !== 1) return;
    const targetId = msg.author.id === currentUser.id ? channel.recipients?.[0] : msg.author.id;
    if (targetId) recordInteraction(targetId, "dm");
}

function onVoiceStateUpdate(e: any) {
    const currentUser = UserStore.getCurrentUser();
    if (!currentUser) return;
    if (!Array.isArray(e?.voiceStates)) return;
    for (const vs of e.voiceStates) {
        if (vs.userId !== currentUser.id) continue;
        const newChannelId = vs.channelId ?? null;
        if (newChannelId === currentVoiceChannelId) return;
        setCurrentVoiceChannelId(newChannelId);
        newChannelId ? startVoiceScoring() : stopVoiceScoring();
        return;
    }
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null;

async function onCurrentUserUpdate() {
    if (syncTimeout) {
        clearTimeout(syncTimeout);
        syncTimeout = null;
    }
    if (!isPluginEnabled()) return;
    stopVoiceScoring();
    setCurrentVoiceChannelId(null);
    await loadData();
    syncTimeout = setTimeout(() => {
        syncTimeout = null;
        if (isPluginEnabled()) syncWithAffinities();
    }, 5000);
}


export default definePlugin({
    name: "FrequentFriends",
    description: "Shows friends you interact with most frequently in your DM sidebar.",
    authors: [EquicordDevs["0nerf"]],
    settings,

    patches: [
        {
            find: '"dm-quick-launcher"===',
            replacement: [
                {
                    match: /(renderSection:)([^,}]+)/,
                    replace: "$1 (this._ffRenderSection ??= $self.hookRenderSection(this, $2))"
                }
            ]
        }
    ],

    hookRenderSection(instance: any, originalRenderSection: (...args: any[]) => any) {
        if (typeof originalRenderSection === "function" && (originalRenderSection as any)._ffWrapped) {
            return originalRenderSection;
        }

        const wrapped = function (this: any, e: any) {
            const originalResult = originalRenderSection.call(instance, e);
            if (e.section === 1 && isPluginEnabled()) {
                return (
                    <React.Fragment key="ff-section-1">
                        <ErrorBoundary noop>
                            <FrequentFriendsWidget />
                        </ErrorBoundary>
                        {originalResult}
                    </React.Fragment>
                );
            }
            return originalResult;
        };

        Object.defineProperty(wrapped, "_ffWrapped", { value: true, writable: false });
        return wrapped;
    },

    flux: {
        MESSAGE_CREATE: onMessage,
        VOICE_STATE_UPDATES: onVoiceStateUpdate,
        CURRENT_USER_UPDATE: onCurrentUserUpdate,
    },

    async start() {
        setIsEnabled(true);
        getForceUpdateWidget()?.();
        await loadData();
        await syncWithAffinities();
        this._initVoiceState();
    },

    _initVoiceState() {
        const currentUser = UserStore.getCurrentUser();
        if (!currentUser) return;
        const myState = (VoiceStateStore as any).getVoiceStateForUser?.(currentUser.id);
        if (myState?.channelId) {
            setCurrentVoiceChannelId(myState.channelId);
            startVoiceScoring();
        }
    },

    stop() {
        setIsEnabled(false);
        getForceUpdateWidget()?.();
        stopVoiceScoring();
        setCurrentVoiceChannelId(null);
        if (syncTimeout) {
            clearTimeout(syncTimeout);
            syncTimeout = null;
        }
    }
});
