/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Application } from "@vencord/discord-types/src/common/Application";

export enum Task {
    WATCH_VIDEO = "WATCH_VIDEO",
    PLAY_ACTIVITY = "PLAY_ACTIVITY",
    STREAM_ON_DESKTOP = "STREAM_ON_DESKTOP",
    PLAY_ON_DESKTOP = "PLAY_ON_DESKTOP"
}

export const TASK_CONFIG = {
    [Task.WATCH_VIDEO]: { priority: 1 },
    [Task.PLAY_ACTIVITY]: { priority: 2 },
    [Task.STREAM_ON_DESKTOP]: { priority: 3 },
    [Task.PLAY_ON_DESKTOP]: { priority: 4 }
} as const;

export const EXCLUDED_QUEST_ID = "1412491570820812933";

export interface GuildChannels {
    VOCAL?: Array<{ channel: { id: string; }; }>;
}

export interface Game {
    cmdLine: string;
    exeName: string;
    exePath: string;
    hidden: boolean;
    isLauncher: boolean;
    id: string;
    name: string;
    pid: number;
    pidPath: number[];
    processName: string;
    start: number;
}

export interface QuestHeartbeatSuccess {
    userStatus?: {
        streamProgressSeconds?: number;
        progress?: Partial<Record<Task, { value: number; }>>;
    };
}

export interface QuestHeartbeatResponse {
    body: {
        progress: Partial<Record<Task, { value: number; }>>;
    };
}

export interface Quest {
    id: string;
    config: {
        application: Application;
        taskConfigV2: {
            tasks: Partial<Record<Task, { target: number; }>>;
        };
        assets: { gameTile: string; };
        expiresAt: string;
        configVersion?: number;
    };
    userStatus?: {
        enrolledAt: string;
        completedAt?: string;
        progress?: Partial<Record<Task, { value: number; }>>;
        streamProgressSeconds?: number;
    };
}

export class QuestHelper {
    static getTaskPriority(quest: Quest): number {
        const task = Object.keys(quest.config.taskConfigV2.tasks).find(t => TASK_CONFIG[t as Task]);
        return task ? TASK_CONFIG[task as Task].priority : 999;
    }

    static getTask(quest: Quest): Task | null {
        return Object.keys(quest.config.taskConfigV2.tasks).find(t => TASK_CONFIG[t as Task]) as Task ?? null;
    }

    static getTarget(quest: Quest, task: Task): number {
        return quest.config.taskConfigV2.tasks[task]?.target ?? 0;
    }

    static getProgress(data: QuestHeartbeatSuccess, quest: Quest, task: Task): number {
        return quest.config.configVersion === 1
            ? data.userStatus?.streamProgressSeconds ?? 0
            : data.userStatus?.progress?.[task]?.value ?? 0;
    }

    static isValid(quest: Quest): boolean {
        return quest.id !== EXCLUDED_QUEST_ID &&
            !!quest.userStatus?.enrolledAt &&
            !quest.userStatus.completedAt &&
            new Date(quest.config.expiresAt).getTime() > Date.now();
    }

    static isVideoTask(task: Task): boolean {
        return task === Task.WATCH_VIDEO;
    }
}
