/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { MessageObject } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import type { CloudUpload } from "@vencord/discord-types";
import { CloudUploadPlatform } from "@vencord/discord-types/enums";
import { ChannelStore, CloudUploader, DraftType, MessageActions, PermissionsBits, PermissionStore, showToast, UploadAttachmentStore, UploadManager, UserStore } from "@webpack/common";

interface SendOptions {
    attachmentsToUpload: CloudUpload[];
    scheduledTimestamp?: unknown;
    nonce?: string;
    flags?: number;
    location?: string;
    onAttachmentUploadError?: unknown;
    [key: string]: unknown;
}

interface BatchJob {
    cancelled: boolean;
    restore: boolean;
}

const jobs = new Map<string, BatchJob>();
const logger = new Logger("AttachmentBatches");
const settings = definePluginSettings({
    sendDelay: {
        type: OptionType.NUMBER,
        description: "Minimum seconds between attachment messages. Channel slowmode is also respected.",
        default: 1,
        min: 1,
        max: 60
    }
});

function restoreUploads(channelId: string, uploads: CloudUpload[], remaining: CloudUpload[]) {
    const originals = new Set(uploads.map(upload => upload.id));
    const current = UploadAttachmentStore.getUploads(channelId, DraftType.ChannelMessage)
        .filter(upload => !originals.has(upload.id));
    const restored = remaining.map(upload => {
        const fresh = new CloudUploader({ ...upload.item, platform: CloudUploadPlatform.WEB }, channelId);
        fresh.filename = upload.filename;
        fresh.description = upload.description;
        fresh.spoiler = upload.spoiler;
        fresh.isThumbnail = upload.isThumbnail;
        return fresh;
    });
    UploadManager.setUploads({ channelId, draftType: DraftType.ChannelMessage, uploads: [...restored, ...current] });
}

function cancelJobs(restore: boolean) {
    for (const job of jobs.values()) {
        job.cancelled = true;
        job.restore = restore;
    }
}

export default definePlugin({
    name: "AttachmentBatches",
    description: "Attach more than ten files and send them in ordered messages of up to ten attachments.",
    authors: [EquicordDevs.kismeria],
    tags: ["Chat", "Utility"],
    settings,

    patches: [
        {
            find: "getSendMessageOptionsForReply:",
            replacement: {
                match: /async _sendMessage\((\i),(\i),(\i)\)\{/,
                replace: "$&if($3.attachmentsToUpload?.length>10)return $self.sendBatches($1,$2,$3);"
            }
        },
        {
            find: "Unexpected mismatch between files and file metadata",
            replacement: {
                match: /(\.getUploadCount\(\i\.id,(\i)\)\+\i\.length)>10/,
                replace: "$1>$self.getAttachmentLimit($2)"
            }
        },
        {
            find: '"UploadAttachmentStore"',
            replacement: {
                match: /(\i\.length\+\i\.length)>10&&(\i)!==/,
                replace: "$1>$self.getAttachmentLimit($2)&&$2!=="
            }
        }
    ],

    getAttachmentLimit(draftType: number) {
        return draftType === DraftType.ChannelMessage && MessageActions._sendMessage.toString().includes(".sendBatches(")
            ? Infinity
            : 10;
    },

    async sendBatches(channelId: string, message: MessageObject, options: SendOptions) {
        const uploads = [...options.attachmentsToUpload];
        if (jobs.has(channelId) || options.scheduledTimestamp != null) {
            const userId = UserStore.getCurrentUser()?.id;
            setTimeout(() => {
                if (UserStore.getCurrentUser()?.id === userId) restoreUploads(channelId, uploads, uploads);
            }, 0);
            showToast({ text: jobs.has(channelId) ? "Wait for the current attachment batch to finish." : "Send attachment batches now. Scheduled batches are not supported.", variant: "critical" });
            return;
        }

        const job: BatchJob = { cancelled: false, restore: true };
        const userId = UserStore.getCurrentUser()?.id;
        jobs.set(channelId, job);
        let sent = 0;
        let firstResult: unknown;

        try {
            while (sent < uploads.length) {
                const channel = ChannelStore.getChannel(channelId);
                if (job.cancelled || !channel || UserStore.getCurrentUser()?.id !== userId) break;

                const batch = uploads.slice(sent, sent + 10);
                const batchOptions = sent === 0
                    ? { ...options, attachmentsToUpload: batch }
                    : {
                        attachmentsToUpload: batch,
                        location: options.location,
                        flags: options.flags,
                        allowedMentions: { parse: [], replied_user: false },
                        onAttachmentUploadError: options.onAttachmentUploadError
                    };
                const batchMessage = sent === 0 ? message : { content: "", tts: false, invalidEmojis: [], validNonShortcutEmojis: [] };
                const result: unknown = await MessageActions._sendMessage(channelId, batchMessage, batchOptions);
                if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) break;
                if (sent === 0) firstResult = result;
                sent += batch.length;

                if (sent < uploads.length) {
                    const bypass = channel.isPrivate()
                        || PermissionStore.can(PermissionsBits.MANAGE_MESSAGES, channel)
                        || PermissionStore.can(PermissionsBits.MANAGE_CHANNELS, channel);
                    const delay = Math.max(settings.store.sendDelay * 1000, bypass ? 0 : (channel.rateLimitPerUser ?? 0) * 1000 + 250);
                    const until = Date.now() + delay;
                    while (!job.cancelled && Date.now() < until) await sleep(Math.min(1000, until - Date.now()));
                }
            }
        } catch (error) {
            logger.error("Attachment batch stopped.", error);
        } finally {
            jobs.delete(channelId);
            if (sent < uploads.length && job.restore && UserStore.getCurrentUser()?.id === userId) {
                setTimeout(() => {
                    if (UserStore.getCurrentUser()?.id !== userId) return;
                    restoreUploads(channelId, uploads, uploads.slice(sent));
                    showToast({ text: `Sent ${sent} of ${uploads.length} files. The remaining files are back in this channel's draft.`, variant: "critical" });
                }, 0);
            }
        }

        return firstResult;
    },

    toolboxActions: {
        "Cancel attachment batches": () => cancelJobs(true)
    },

    flux: {
        LOGOUT: () => cancelJobs(false)
    },

    stop() {
        cancelJobs(true);
    }
});
