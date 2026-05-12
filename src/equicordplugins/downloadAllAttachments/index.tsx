/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CloudDownloadIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { Message, MessageAttachment } from "@vencord/discord-types";
import { ChannelStore, showToast, Toasts } from "@webpack/common";

const logger = new Logger("DownloadAllAttachments");

async function downloadAll(attachments: MessageAttachment[]) {
    let dir: FileSystemDirectoryHandle;
    try {
        dir = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // user cancelled
        logger.error("Failed to open directory picker:", e);
        return;
    }

    let failed = 0;
    await Promise.all(attachments.map(async a => {
        try {
            const res = await fetch(a.proxy_url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            if (!res.body) throw new Error("Response body is empty");
            const file = await dir.getFileHandle(a.filename, { create: true });
            const writable = await file.createWritable();
            await res.body.pipeTo(writable);
        } catch (e) {
            logger.warn(`Failed to download ${a.filename}:`, e);
            failed++;
        }
    }));

    if (failed === 0)
        showToast(`Downloaded ${attachments.length} attachment${attachments.length === 1 ? "" : "s"}.`, Toasts.Type.SUCCESS);
    else
        showToast(`Downloaded ${attachments.length - failed} of ${attachments.length} attachments. ${failed} failed.`, Toasts.Type.FAILURE);
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
