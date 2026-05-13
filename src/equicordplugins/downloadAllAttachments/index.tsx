/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CloudDownloadIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { pluralise } from "@utils/misc";
import definePlugin from "@utils/types";
import { Message, MessageAttachment } from "@vencord/discord-types";
import { ChannelStore, showToast, Toasts } from "@webpack/common";

const logger = new Logger("DownloadAllAttachments");

async function downloadAll(attachments: MessageAttachment[]) {
    let dir: FileSystemDirectoryHandle;
    try {
        dir = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        logger.error("Failed to open directory picker:", e);
        return;
    }

    const usedNames = new Map<string, number>();

    function uniqueName(original: string): string {
        const count = usedNames.get(original) ?? 0;
        usedNames.set(original, count + 1);
        if (count === 0) return original;
        const dot = original.lastIndexOf(".");
        return dot === -1
            ? `${original}_${count}`
            : `${original.slice(0, dot)}_${count}${original.slice(dot)}`;
    }

    const tasks = attachments.map(a => ({ attachment: a, filename: uniqueName(a.filename) }));

    const results = await Promise.allSettled(tasks.map(async ({ attachment, filename }) => {
        if (!attachment.proxy_url) throw new Error("Missing Proxy URL");

        const res = await fetch(attachment.proxy_url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error("Response body is empty");

        let fileHandle: FileSystemFileHandle | undefined;
        try {
            fileHandle = await dir.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            try {
                await res.body.pipeTo(writable);
            } catch (e) {
                await writable.abort();
                throw e;
            }
        } catch (e) {
            if (fileHandle) {
                try { await dir.removeEntry(filename); } catch { }
            }
            throw e;
        }
    }));

    const failed = results.filter(r => {
        if (r.status === "rejected") {
            logger.warn("Failed to download attachment:", r.reason);
            return true;
        }
        return false;
    }).length;

    const succeeded = attachments.length - failed;

    if (failed === 0)
        showToast(`Downloaded ${pluralise(succeeded, "attachment")}.`, Toasts.Type.SUCCESS);
    else
        showToast(`Downloaded ${succeeded} of ${attachments.length} attachments. ${failed} failed.`, Toasts.Type.FAILURE);
}

export default definePlugin({
    name: "DownloadAllAttachments",
    description: "Adds a popover button to download all attachments in a message at once.",
    tags: ["Utility", "Chat"],
    authors: [EquicordDevs.dhopcs],
    dependencies: ["MessagePopoverAPI"],
    messagePopoverButton: {
        icon: CloudDownloadIcon,
        render(message: Message) {
            if (!message.attachments.length) return null;
            return {
                label: "Download All Attachments",
                icon: CloudDownloadIcon,
                message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => downloadAll(message.attachments)
            };
        }
    }
});
