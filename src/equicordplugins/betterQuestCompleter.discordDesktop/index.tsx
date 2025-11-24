/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { playAudio } from "@api/AudioPlayer";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy, findStoreLazy } from "@webpack";
import { ChannelStore, FluxDispatcher, GuildChannelStore, React, RestAPI, Toasts, UserStore } from "@webpack/common";

import { type Game, type GuildChannels, type Quest, type QuestHeartbeatResponse, type QuestHeartbeatSuccess, QuestHelper, Task } from "./types";

const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_TOP:", '.iconBadge,"top"');
const StreamingStore = findStoreLazy("ApplicationStreamingStore");
const GameStore = findStoreLazy("RunningGameStore");
const QuestsStore = findByPropsLazy("getQuest");

const settings = definePluginSettings({
    playNotificationSound: {
        type: OptionType.BOOLEAN,
        description: "Play a notification sound when a quest is completed.",
        default: true
    }
});

let current: Quest | null = null;
let stopCurrent: (() => void) | null = null;

function playQuestCompletionSound() {
    if (settings.store.playNotificationSound) {
        playAudio("activity_user_join", { volume: 40 });
    }
}

function Icon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} fill="none" viewBox="0 0 24 24" >
            <path fill="currentColor" d="M6.69 2A3 3 0 0 0 3.7 4.67l-.33 3A3 3 0 0 0 6.35 11H7V9a1 1 0 0 1 2 0v2h6V9a1 1 0 1 1 2 0v2h.65a3.05 3.05 0 0 0 .9-.14 3 3 0 0 0 2.08-3.2l-.33-3A3 3 0 0 0 17.3 2H6.7Z" />
            <path fill="currentColor" fillRule="evenodd" d="M15 13v1a1 1 0 1 0 2 0v-1h.65c1.43 0 2.72-.6 3.62-1.56l.04.22.68 5.88A4 4 0 0 1 18 22H6A4 4 0 0 1 2 17.54l.68-5.88.04-.22c.9.96 2.19 1.56 3.62 1.56H7v1a1 1 0 1 0 2 0v-1h6Zm-6 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm7 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
        </svg>
    );
}

function getQuests(): Quest[] {
    return [...QuestsStore.quests.values()]
        .filter(QuestHelper.isValid)
        .sort((a, b) => QuestHelper.getTaskPriority(a) - QuestHelper.getTaskPriority(b));
}

async function processNext(questCompleted = false) {
    stopCurrent?.();
    stopCurrent = current = null;

    if (questCompleted) {
        playQuestCompletionSound();
        Toasts.show({
            message: "Quest completed successfully!",
            type: Toasts.Type.SUCCESS,
            id: Toasts.genId()
        });
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    const quests = getQuests();
    if (quests.length) startQuest(quests[0]);
}

async function completeVideo(quest: Quest, task: Task) {
    const target = QuestHelper.getTarget(quest, task);
    let progress = quest.userStatus?.progress?.[task]?.value ?? 0;
    const enrolledTimestamp = new Date(quest.userStatus!.enrolledAt).getTime();
    let isRunning = true;

    (async () => {
        while (isRunning && progress < target) {
            const maxAllowedProgress = Math.floor((Date.now() - enrolledTimestamp) / 1000) + 10;
            if (maxAllowedProgress - progress >= 7) {
                progress = Math.min(target, progress + 7);
                try {
                    await RestAPI.post({ url: `/quests/${quest.id}/video-progress`, body: { timestamp: progress + Math.random() } });
                } catch { }
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (progress >= target) processNext(true);
    })().catch(processNext);

    stopCurrent = () => { isRunning = false; };
}

function subscribeHeartbeat(quest: Quest, task: Task, target: number, cleanup: () => void) {
    const handler = (data: QuestHeartbeatSuccess) => {
        if (QuestHelper.getProgress(data, quest, task) >= target) {
            FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", handler);
            cleanup();
            processNext(true);
        }
    };
    FluxDispatcher.subscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", handler);
    stopCurrent = () => {
        FluxDispatcher.unsubscribe("QUESTS_SEND_HEARTBEAT_SUCCESS", handler);
        cleanup();
    };
}

async function completeDesktop(quest: Quest) {
    const target = QuestHelper.getTarget(quest, Task.PLAY_ON_DESKTOP);
    const response = await RestAPI.get({ url: `/applications/public?application_ids=${quest.config.application.id}` });
    if (!response.body?.[0]?.id) throw new Error();

    const applicationData = response.body[0];
    const executableName = applicationData.executables?.find((executable: { os: string; name: string; }) => executable.os === "win32")?.name.replace(">", "");
    if (!executableName) throw new Error();

    const processId = Math.floor(Math.random() * 30000) + 1000;
    const fakeGame: Game = {
        cmdLine: `C:\\Program Files\\${applicationData.name}\\${executableName}`,
        exeName: executableName,
        exePath: `c:/program files/${applicationData.name.toLowerCase()}/${executableName}`,
        hidden: false,
        isLauncher: false,
        id: quest.config.application.id,
        name: applicationData.name,
        pid: processId,
        pidPath: [processId],
        processName: applicationData.name,
        start: Date.now(),
    };

    const originalGetRunningGames = GameStore.getRunningGames;
    const originalGetGameForPID = GameStore.getGameForPID;

    GameStore.getRunningGames = () => [fakeGame];
    GameStore.getGameForPID = (pid: number) => pid === processId ? fakeGame : null;
    FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [], added: [fakeGame], games: [fakeGame] });

    subscribeHeartbeat(quest, Task.PLAY_ON_DESKTOP, target, () => {
        GameStore.getRunningGames = originalGetRunningGames;
        GameStore.getGameForPID = originalGetGameForPID;
        FluxDispatcher.dispatch({ type: "RUNNING_GAMES_CHANGE", removed: [fakeGame], added: [], games: [] });
    });
}

async function completeStream(quest: Quest) {
    const target = QuestHelper.getTarget(quest, Task.STREAM_ON_DESKTOP);
    const currentUserId = UserStore.getCurrentUser().id;
    if (!StreamingStore.getAnyStreamForUser(currentUserId)) throw new Error();

    const processId = Math.floor(Math.random() * 30000) + 1000;
    const originalGetStreamMetadata = StreamingStore.getStreamerActiveStreamMetadata;

    StreamingStore.getStreamerActiveStreamMetadata = () => ({
        id: quest.config.application.id,
        pid: processId,
        sourceName: null
    });

    subscribeHeartbeat(quest, Task.STREAM_ON_DESKTOP, target, () => {
        StreamingStore.getStreamerActiveStreamMetadata = originalGetStreamMetadata;
    });
}

async function completeActivity(quest: Quest) {
    const target = QuestHelper.getTarget(quest, Task.PLAY_ACTIVITY);
    const privateChannels = ChannelStore.getSortedPrivateChannels();
    const guildChannel = (Object.values(GuildChannelStore.getAllGuilds()) as GuildChannels[]).find(guild => guild?.VOCAL?.length);
    const channelId = privateChannels[0]?.id ?? guildChannel?.VOCAL?.[0]?.channel?.id;
    if (!channelId) throw new Error();

    const streamKey = `call:${channelId}:1`;
    let isRunning = true;

    (async () => {
        while (isRunning) {
            try {
                const response = await RestAPI.post({
                    url: `/quests/${quest.id}/heartbeat`,
                    body: { stream_key: streamKey, terminal: false }
                }) as QuestHeartbeatResponse;

                if ((response.body.progress[Task.PLAY_ACTIVITY]?.value ?? 0) >= target) {
                    await RestAPI.post({
                        url: `/quests/${quest.id}/heartbeat`,
                        body: { stream_key: streamKey, terminal: true }
                    });
                    processNext(true);
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 20000));
            } catch { }
        }
    })().catch(processNext);

    stopCurrent = () => { isRunning = false; };
}

async function startQuest(quest: Quest) {
    if (current?.id === quest.id) return;
    stopCurrent?.();
    current = quest;
    stopCurrent = null;

    const task = QuestHelper.getTask(quest);
    if (!task) return processNext();

    try {
        if (QuestHelper.isVideoTask(task)) await completeVideo(quest, task);
        else if (task === Task.PLAY_ON_DESKTOP) await completeDesktop(quest);
        else if (task === Task.STREAM_ON_DESKTOP) await completeStream(quest);
        else if (task === Task.PLAY_ACTIVITY) await completeActivity(quest);
        else processNext();
    } catch { processNext(); }
}

export default definePlugin({
    name: "BetterQuestCompleter",
    description: "Complete Discord quests in a lazy way.",
    authors: [EquicordDevs.Prism],
    settings,

    patches: [{
        find: '?"BACK_FORWARD_NAVIGATION":',
        replacement: {
            match: /"HELP".{0,100}className:(\i)\}\)(?=\])/,
            replace: "$&,$self.Button({buttonClass:$1})"
        }
    }],

    stop() {
        stopCurrent?.();
        current = stopCurrent = null;
    },

    Button: ErrorBoundary.wrap(({ buttonClass }: { buttonClass: string; }) => (
        <HeaderBarIcon
            className={buttonClass}
            onClick={() => {
                if (current) {
                    Toasts.show({
                        message: "Quest completion already running.",
                        type: Toasts.Type.MESSAGE,
                        id: Toasts.genId()
                    });
                    return;
                }

                const quests = getQuests();
                if (quests.length) {
                    Toasts.show({
                        message: "Starting quest completion.",
                        type: Toasts.Type.SUCCESS,
                        id: Toasts.genId()
                    });
                    startQuest(quests[0]);
                } else {
                    Toasts.show({
                        message: "No available quests to complete.",
                        type: Toasts.Type.FAILURE,
                        id: Toasts.genId()
                    });
                }
            }}
            tooltip="Complete Quests"
            icon={Icon}
        />
    ), { noop: true })
});
