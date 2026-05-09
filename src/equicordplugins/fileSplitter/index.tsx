/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 sioaeko and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ChatBarButton, addChatBarButton, removeChatBarButton } from "@api/ChatButtons";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { PluginNative } from "@utils/types";
import { chooseFile, saveFile } from "@utils/web";
import { findLazy } from "@webpack";
import { Constants, MessageStore, React, RestAPI, SelectedChannelStore, SnowflakeUtils, Toasts } from "@webpack/common";

const cl = classNameFactory("vc-file-splitter-");
const CloudUpload = findLazy(m => m.prototype?.trackUploadFinished);

const Native = IS_DISCORD_DESKTOP
    ? VencordNative.pluginHelpers.FileSplitter as PluginNative<typeof import("./native")>
    : null;

const CHUNK_SIZE = 10 * 1024 * 1024;
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const CHUNK_TIMEOUT = 30 * 60 * 1000;

interface ChunkData {
    index: number;
    total: number;
    originalName: string;
    originalSize: number;
    timestamp: number;
    url: string;
    channelId?: string;
    messageId?: string;
}

interface ChunkStorageEntry {
    ch: ChunkData[];
    lu: number;
    mg?: boolean;
}

interface MergedResult {
    key: string;
    originalName: string;
    isImage: boolean;
    mimeType: string;
    status: "pending" | "loading" | "ready" | "error";
    blob?: Blob;
    objectUrl?: string;
    error?: string;
}

type ChunkMessage = {
    id?: string;
    channel_id?: string;
    channelId?: string;
    content?: string;
    attachments?: any[];
};

const cs: Record<string, ChunkStorageEntry> = {};
const mergedResults = new Map<string, MergedResult>();
const storeListeners = new Set<() => void>();
let storeVersion = 0;
let delayedChannelScan: ReturnType<typeof setTimeout> | undefined;
let hideObserver: MutationObserver | undefined;
let pendingHideSweep: number | undefined;

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
    avif: "image/avif",
    bmp: "image/bmp",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
};

function emitStoreChange() {
    storeVersion++;
    for (const listener of storeListeners) listener();
}

function useFileSplitterStore() {
    const [, setVersion] = React.useState(storeVersion);

    React.useEffect(() => {
        const listener = () => setVersion(storeVersion);
        storeListeners.add(listener);
        return () => {
            storeListeners.delete(listener);
        };
    }, []);
}

async function downloadBlob(blob: Blob, filename: string) {
    if (IS_DISCORD_DESKTOP) {
        try {
            const buffer = await blob.arrayBuffer();
            await DiscordNative.fileManager.saveWithDialog(new Uint8Array(buffer), filename);
            return;
        } catch (e) {
            console.warn("[FileSplitter] saveWithDialog failed, using browser fallback:", e);
        }
    }

    saveFile(new File([blob], filename, { type: blob.type || "application/octet-stream" }));
}

function getChunkKey(c: Pick<ChunkData, "originalName" | "timestamp"> & Partial<Pick<ChunkData, "originalSize">>) {
    return `${c.originalName}_${c.originalSize ?? "unknown"}_${c.timestamp}`;
}

function normalizeAttachmentUrl(url: string | null | undefined) {
    if (!url) return null;

    try {
        const parsed = new URL(url);
        if (parsed.hostname === "media.discordapp.net") {
            parsed.hostname = "cdn.discordapp.com";
        }
        return parsed.toString();
    } catch {
        return url.replace("://media.discordapp.net/", "://cdn.discordapp.com/");
    }
}

function getAttachmentUrl(attachment: any) {
    return attachment?.url
        ?? attachment?.proxy_url
        ?? attachment?.download_url
        ?? attachment?.proxyUrl
        ?? null;
}

function getMessageId(message: ChunkMessage) {
    return message.id ?? "";
}

function getMessageChannelId(message: ChunkMessage) {
    return message.channel_id ?? message.channelId ?? "";
}

function parseChunkMeta(content: string | undefined): Omit<ChunkData, "url" | "channelId" | "messageId"> | null {
    if (!content) return null;

    try {
        const c = JSON.parse(content);
        if (
            typeof c === "object"
            && c?.type === "FileSplitterChunk"
            && Number.isInteger(c.index)
            && c.index >= 0
            && Number.isInteger(c.total)
            && c.total > 0
            && c.index < c.total
            && typeof c.originalName === "string"
            && typeof c.originalSize === "number"
            && typeof c.timestamp === "number"
        ) {
            return c;
        }
    } catch { }

    return null;
}

function getStoredMessages(channelId: string): ChunkMessage[] {
    const messages = MessageStore.getMessages(channelId);
    if (!messages) return [];

    if (Array.isArray(messages)) return messages;
    if (typeof messages.toArray === "function") return messages.toArray();
    if (typeof messages.values === "function") return Array.from(messages.values());
    if (Array.isArray((messages as any)._array)) return (messages as any)._array;
    if (Array.isArray((messages as any).array)) return (messages as any).array;
    if ((messages as any)._map && typeof (messages as any)._map.values === "function") {
        return Array.from((messages as any)._map.values());
    }

    return Object.values(messages).filter((message: any) => typeof message?.content === "string") as ChunkMessage[];
}

function inferMimeType(filename: string) {
    const extension = filename.split(".").pop()?.toLowerCase();
    return extension ? IMAGE_MIME_BY_EXTENSION[extension] ?? null : null;
}

function isInlinePreviewableImage(filename: string) {
    const mimeType = inferMimeType(filename);
    return mimeType?.startsWith("image/") ?? false;
}

function getFileBadge(filename: string) {
    const extension = filename.split(".").pop()?.toLowerCase() ?? "";
    if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return { kind: "archive", label: extension.toUpperCase() };
    if (["pdf"].includes(extension)) return { kind: "document", label: "PDF" };
    if (["txt", "md", "json", "csv", "xml", "yaml", "yml"].includes(extension)) return { kind: "text", label: extension.toUpperCase() };
    if (["mp3", "wav", "flac", "ogg", "m4a"].includes(extension)) return { kind: "audio", label: extension.toUpperCase() };
    if (["mp4", "mkv", "avi", "mov", "webm"].includes(extension)) return { kind: "video", label: extension.toUpperCase() };
    if (["exe", "msi", "apk"].includes(extension)) return { kind: "app", label: extension.toUpperCase() };
    return { kind: "file", label: (extension || "FILE").slice(0, 4).toUpperCase() };
}

function getChunkFromMessage(message: ChunkMessage): (ChunkData & { attachmentUrl: string; }) | null {
    if (!message?.attachments?.length) return null;

    const meta = parseChunkMeta(message.content);
    if (!meta) return null;

    const attachmentUrl = normalizeAttachmentUrl(getAttachmentUrl(message.attachments[0]));
    if (!attachmentUrl) return null;

    return {
        ...meta,
        url: attachmentUrl,
        attachmentUrl,
        channelId: getMessageChannelId(message),
        messageId: getMessageId(message)
    };
}

function getAnchorChunk(key: string) {
    const entry = cs[key];
    if (!entry?.ch.length) return null;

    return entry.ch.find(chunk => chunk.channelId && chunk.messageId && getMessageElement(chunk.channelId, chunk.messageId, chunk.url))
        ?? [...entry.ch].sort((a, b) => a.index - b.index)[0]
        ?? null;
}

function getMessageElement(channelId: string, messageId: string, attachmentUrl?: string) {
    const directId = document.getElementById(`chat-messages-${channelId}-${messageId}`);
    if (directId instanceof HTMLElement) return directId;

    const fallbackSelectors = [
        `[data-list-item-id="chat-messages___${channelId}-${messageId}"]`,
        `[data-message-id="${messageId}"]`,
        `[id$="-${messageId}"]`
    ];

    for (const selector of fallbackSelectors) {
        const element = document.querySelector(selector);
        if (element instanceof HTMLElement) return element;
    }

    if (!attachmentUrl) return null;

    let normalizedAttachmentUrl = normalizeAttachmentUrl(attachmentUrl)?.split("?")[0] ?? null;
    if (!normalizedAttachmentUrl) return null;

    for (const link of Array.from(document.querySelectorAll("a[href]"))) {
        if (!(link instanceof HTMLAnchorElement)) continue;

        const href = normalizeAttachmentUrl(link.href)?.split("?")[0] ?? null;
        if (href !== normalizedAttachmentUrl) continue;

        const container = link.closest("[id^='chat-messages-'], [data-list-item-id^='chat-messages___'], li, article, [class*='message']");
        if (container instanceof HTMLElement) return container;
    }

    return null;
}

function isFileSplitterNode(element: HTMLElement) {
    return Boolean(element.closest(".vc-file-splitter-card") || element.querySelector(".vc-file-splitter-card"));
}

function markHidden(element: HTMLElement) {
    if (element.dataset.filesplitterHidden === "true") return;

    element.dataset.filesplitterHidden = "true";
    element.dataset.filesplitterPrevDisplay = element.style.display || "";
    element.style.display = "none";
}

function restoreHiddenChunkMessages() {
    for (const node of Array.from(document.querySelectorAll("[data-filesplitter-hidden='true']"))) {
        if (!(node instanceof HTMLElement)) continue;

        node.style.display = node.dataset.filesplitterPrevDisplay ?? "";
        delete node.dataset.filesplitterHidden;
        delete node.dataset.filesplitterPrevDisplay;
    }
}

function hideAnchorChunkPayload(messageEl: HTMLElement, chunk: ChunkData) {
    const contentCandidates = messageEl.querySelectorAll("[id^='message-content-'], [class*='messageContent'], [class*='markup']");
    for (const candidate of Array.from(contentCandidates)) {
        if (!(candidate instanceof HTMLElement) || isFileSplitterNode(candidate)) continue;
        if ((candidate.textContent ?? "").includes("FileSplitterChunk")) markHidden(candidate);
    }

    const attachmentBlocks = messageEl.querySelectorAll([
        "[class*='attachment']",
        "[class*='mediaMosaic']",
        "[class*='visualMediaItemContainer']",
        "[class*='fileWrapper']",
        "[class*='file']"
    ].join(", "));

    for (const block of Array.from(attachmentBlocks)) {
        if (!(block instanceof HTMLElement) || isFileSplitterNode(block)) continue;
        markHidden(block);
    }

    const attachmentHref = normalizeAttachmentUrl(chunk.url)?.split("?")[0] ?? null;
    if (attachmentHref) {
        for (const link of Array.from(messageEl.querySelectorAll("a[href]"))) {
            if (!(link instanceof HTMLAnchorElement) || isFileSplitterNode(link)) continue;

            const href = normalizeAttachmentUrl(link.href)?.split("?")[0] ?? null;
            if (href !== attachmentHref) continue;

            const target = link.closest("[class*='attachment'], [class*='fileWrapper'], [class*='file'], [class*='embed'], [class*='container'], a[href]");
            if (target instanceof HTMLElement && target !== messageEl && !isFileSplitterNode(target)) markHidden(target);
        }
    }

    for (const node of Array.from(messageEl.querySelectorAll("a, button, div, span"))) {
        if (!(node instanceof HTMLElement) || isFileSplitterNode(node)) continue;

        const text = node.textContent ?? "";
        if (!/FileSplitterChunk|\.part\d{3}/i.test(text)) continue;

        const target = node.closest("[id^='message-content-'], [class*='messageContent'], [class*='markup'], [class*='attachment'], [class*='fileWrapper'], [class*='file'], [class*='embed'], [class*='container'], a[href]");
        if (target instanceof HTMLElement && target !== messageEl && !isFileSplitterNode(target)) {
            markHidden(target);
        } else {
            markHidden(node);
        }
    }
}

function hideChunkMessages(key: string) {
    const entry = cs[key];
    const anchorChunk = getAnchorChunk(key);
    if (!entry?.ch.length || !anchorChunk?.messageId) return;

    for (const chunk of entry.ch) {
        if (!chunk.channelId || !chunk.messageId) continue;

        const messageEl = getMessageElement(chunk.channelId, chunk.messageId, chunk.url);
        if (!messageEl) continue;

        if (chunk.messageId !== anchorChunk.messageId) {
            markHidden(messageEl);
            continue;
        }

        hideAnchorChunkPayload(messageEl, chunk);
    }
}

function hideKnownChunkMessages() {
    for (const key of Object.keys(cs)) hideChunkMessages(key);
}

function scheduleHideSweep() {
    if (pendingHideSweep !== undefined) return;

    pendingHideSweep = requestAnimationFrame(() => {
        pendingHideSweep = undefined;
        hideKnownChunkMessages();
    });
}

function getCompleteChunkCount(entry: ChunkStorageEntry) {
    return new Set(entry.ch.map(chunk => chunk.index)).size;
}

function hasAllChunks(entry: ChunkStorageEntry) {
    if (!entry.ch.length) return false;

    const expectedCount = entry.ch[0].total;
    if (getCompleteChunkCount(entry) !== expectedCount) return false;

    const indexes = new Set(entry.ch.map(chunk => chunk.index));
    for (let i = 0; i < expectedCount; i++) {
        if (!indexes.has(i)) return false;
    }

    return true;
}

function storeChunk(c: ChunkData) {
    const key = getChunkKey(c);
    const entry = cs[key] ?? (cs[key] = { ch: [], lu: Date.now() });
    const existing = entry.ch.find(chunk => chunk.index === c.index);
    let changed = false;

    if (!existing) {
        entry.ch.push(c);
        changed = true;
    } else if (existing.url !== c.url || existing.messageId !== c.messageId || existing.channelId !== c.channelId) {
        Object.assign(existing, c);
        changed = true;
    }

    entry.ch.sort((a, b) => a.index - b.index);
    entry.lu = Date.now();

    if (changed) emitStoreChange();
    return { key, entry, changed };
}

async function fetchBlob(url: string, filename?: string): Promise<Blob> {
    const normalizedUrl = normalizeAttachmentUrl(url) ?? url;

    if (Native) {
        try {
            const res = await Native.fetchChunk(normalizedUrl);
            if (res.success && res.data) {
                return new Blob([res.data], {
                    type: res.contentType || (filename ? inferMimeType(filename) : null) || "application/octet-stream"
                });
            }
            console.warn("[FileSplitter] Native fetch failed:", res.error);
        } catch (e) {
            console.warn("[FileSplitter] Native fetch errored:", e);
        }
    }

    const r = await fetch(normalizedUrl);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.blob();
}

async function assembleBlob(key: string) {
    const entry = cs[key];
    if (!entry?.ch.length) throw new Error("No chunks available");

    const filename = entry.ch[0].originalName;
    const parts: Blob[] = [];
    for (const chunk of entry.ch) {
        parts.push(await fetchBlob(chunk.url, filename));
    }

    const mimeType = inferMimeType(filename) ?? "application/octet-stream";
    return {
        blob: new Blob(parts, { type: mimeType }),
        mimeType
    };
}

async function ensureMergedResult(key: string, eagerImagePreview = false) {
    const entry = cs[key];
    if (!entry?.ch.length) return;

    const originalName = entry.ch[0].originalName;
    const isImage = isInlinePreviewableImage(originalName);
    let result = mergedResults.get(key);
    let changed = false;

    if (!result) {
        result = {
            key,
            originalName,
            isImage,
            mimeType: inferMimeType(originalName) ?? "application/octet-stream",
            status: "pending"
        };
        mergedResults.set(key, result);
        changed = true;
    }

    const shouldPreparePreview = isImage && eagerImagePreview && !result.objectUrl && result.status !== "loading";
    if (changed) emitStoreChange();
    if (!shouldPreparePreview) return;

    result.status = "loading";
    result.error = undefined;
    emitStoreChange();

    try {
        const { blob, mimeType } = await assembleBlob(key);
        if (result.objectUrl) URL.revokeObjectURL(result.objectUrl);
        result.blob = blob;
        result.mimeType = mimeType;
        result.objectUrl = URL.createObjectURL(blob);
        result.status = "ready";
        result.error = undefined;
    } catch (e: any) {
        result.status = "error";
        result.error = e?.message ?? String(e);
        console.error("[FileSplitter] Preview preparation failed:", e);
    }

    emitStoreChange();
}

async function handleDownload(key: string) {
    const result = mergedResults.get(key);
    if (!result) return;

    try {
        if (!result.blob) {
            result.status = "loading";
            result.error = undefined;
            emitStoreChange();

            const assembled = await assembleBlob(key);
            result.blob = assembled.blob;
            result.mimeType = assembled.mimeType;
            result.status = "ready";
        }

        await downloadBlob(result.blob, result.originalName);
    } catch (e: any) {
        result.status = "error";
        result.error = e?.message ?? String(e);
        emitStoreChange();
        console.error("[FileSplitter] Download failed:", e);
        Toasts.show({
            message: `Download failed: ${e?.message ?? e}`,
            id: Toasts.genId(),
            type: Toasts.Type.FAILURE
        });
        return;
    }

    emitStoreChange();
    Toasts.show({
        message: `Downloaded: ${result.originalName}`,
        id: Toasts.genId(),
        type: Toasts.Type.SUCCESS
    });
}

function tryMergeChunks(key: string) {
    const entry = cs[key];
    if (!entry || entry.mg || !hasAllChunks(entry)) return;

    entry.mg = true;
    entry.ch.sort((a, b) => a.index - b.index);
    emitStoreChange();
    void ensureMergedResult(key, isInlinePreviewableImage(entry.ch[0].originalName));
}

function processMessage(message: ChunkMessage) {
    const chunk = getChunkFromMessage(message);
    if (!chunk) return false;

    const { key } = storeChunk(chunk);
    tryMergeChunks(key);
    scheduleHideSweep();
    return true;
}

function scanExistingMessages(channelId: string) {
    try {
        const messages = getStoredMessages(channelId);
        for (const msg of messages) {
            processMessage(msg);
        }
    } catch (e) {
        console.error("[FileSplitter] Scan error:", e);
    }
}

function clearAllState() {
    if (pendingHideSweep !== undefined) {
        cancelAnimationFrame(pendingHideSweep);
        pendingHideSweep = undefined;
    }

    for (const result of mergedResults.values()) {
        if (result.objectUrl) URL.revokeObjectURL(result.objectUrl);
    }

    for (const key of Object.keys(cs)) delete cs[key];
    mergedResults.clear();
    restoreHiddenChunkMessages();
    emitStoreChange();
}

function pruneOldChunks() {
    const now = Date.now();
    let changed = false;

    for (const key of Object.keys(cs)) {
        if (!cs[key].mg && now - cs[key].lu > CHUNK_TIMEOUT) {
            delete cs[key];
            changed = true;
        }
    }

    if (changed) emitStoreChange();
}

function uploadChunk(channelId: string, chunkFile: File, metadata: any): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const uploader = new (CloudUpload as any)({ file: chunkFile, platform: 1 }, channelId);

            uploader.on("complete", () => {
                RestAPI.post({
                    url: Constants.Endpoints.MESSAGES(channelId),
                    body: {
                        flags: 0,
                        channel_id: channelId,
                        content: JSON.stringify(metadata),
                        nonce: SnowflakeUtils.fromTimestamp(Date.now()),
                        sticker_ids: [],
                        type: 0,
                        attachments: [{
                            id: "0",
                            filename: uploader.filename,
                            uploaded_filename: uploader.uploadedFilename
                        }]
                    }
                }).then(() => resolve()).catch((e: any) => reject(new Error(`Send failed: ${JSON.stringify(e)}`)));
            });

            uploader.on("error", (e: any) => reject(new Error(`Upload failed: ${JSON.stringify(e)}`)));
            uploader.upload();
        } catch (e: any) {
            reject(new Error(e?.message ?? JSON.stringify(e)));
        }
    });
}

const SplitIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm8-4h-4v-2h4v-2l3 3-3 3v-2z" />
    </svg>
);

const FileTypeIcon = ({ kind, label }: { kind: string; label: string; }) => {
    const paths = [
        "M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z",
        "M14 2v5h5"
    ];

    if (kind === "archive") paths.push("M10 10v8", "M12 10v8", "M10 12h2", "M10 15h2", "M10 18h2");
    else if (kind === "video") paths.push("M10 10.5v5l4-2.5z");
    else if (kind === "audio") paths.push("M10 10v6", "M14 9v5", "M10 16a1.5 1.5 0 1 1-1.5 1.5", "M14 14a1.5 1.5 0 1 1-1.5 1.5");
    else if (kind === "text") paths.push("M9 11h6", "M9 14h6", "M9 17h4");
    else if (kind === "document") paths.push("M9 11h6", "M9 15h6");
    else if (kind === "app") paths.push("M9 10h6v6H9z");
    else paths.push("M9 11h6", "M9 15h6", "M9 19h4");

    return (
        <div className={cl("file-icon")} title={label}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {paths.map(path => <path key={path} d={path} />)}
            </svg>
        </div>
    );
};

const ActionButton = ({ children, disabled, onClick }: { children: any; disabled?: boolean; onClick: () => void; }) => (
    <button
        className={cl("action")}
        type="button"
        disabled={disabled}
        onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
        }}
    >
        {children}
    </button>
);

function ProgressCard({ entry }: { entry: ChunkStorageEntry; }) {
    const first = entry.ch[0];
    const count = getCompleteChunkCount(entry);
    const total = first?.total ?? 0;

    return (
        <div className={cl("card")} data-status="pending">
            <div className={cl("body")}>
                <div className={cl("text")}>
                    <div className={cl("title")}>{first?.originalName ?? "Split file"}</div>
                    <div className={cl("subtitle")}>Waiting for chunks: {count}/{total}</div>
                </div>
            </div>
        </div>
    );
}

function MergedResultCard({ result }: { result: MergedResult; }) {
    const badgeInfo = getFileBadge(result.originalName);
    const subtitle = result.error
        ? `Merge failed: ${result.error}`
        : result.isImage
            ? result.status === "ready"
                ? "Merged image preview"
                : "Preparing image preview..."
            : result.status === "loading"
                ? "Preparing download..."
                : "Merged file ready to download";

    return (
        <div className={cl("card")} data-status={result.status} data-image={String(result.isImage)}>
            {result.isImage && result.objectUrl && (
                <img className={cl("image")} src={result.objectUrl} alt={result.originalName} />
            )}
            <div className={cl("body")}>
                {!result.isImage && <FileTypeIcon kind={badgeInfo.kind} label={badgeInfo.label} />}
                <div className={cl("text")}>
                    <div className={cl("title")}>{result.originalName}</div>
                    <div className={cl("subtitle")}>{subtitle}</div>
                </div>
                <div className={cl("actions")}>
                    {result.status === "error" ? (
                        <ActionButton onClick={() => {
                            if (result.isImage) void ensureMergedResult(result.key, true);
                            else void handleDownload(result.key);
                        }}>
                            Retry
                        </ActionButton>
                    ) : (
                        <ActionButton disabled={result.status === "loading" && !result.blob} onClick={() => void handleDownload(result.key)}>
                            Download
                        </ActionButton>
                    )}
                </div>
            </div>
        </div>
    );
}

function FileSplitterAccessory({ message }: { message: ChunkMessage; }) {
    useFileSplitterStore();

    React.useEffect(() => {
        processMessage(message);
    }, [message?.id, message?.content, message?.attachments?.length]);

    const chunk = getChunkFromMessage(message);
    const key = chunk ? getChunkKey(chunk) : null;
    const entry = key ? cs[key] : null;
    const anchorChunk = key ? getAnchorChunk(key) : null;
    const isAnchor = Boolean(anchorChunk?.messageId && anchorChunk.messageId === getMessageId(message));
    const count = entry ? getCompleteChunkCount(entry) : 0;
    const total = entry?.ch[0]?.total ?? 0;
    const complete = Boolean(entry && count === total && hasAllChunks(entry));
    const result = key ? mergedResults.get(key) : null;

    React.useEffect(() => {
        if (!key || !entry || !complete) return;
        void ensureMergedResult(key, isInlinePreviewableImage(entry.ch[0].originalName));
    }, [key, count, total, complete]);

    React.useEffect(() => {
        if (key) scheduleHideSweep();
    }, [key, count, total, complete, result?.status]);

    if (!chunk || !key || !entry || !isAnchor) return null;
    if (!complete) return <ProgressCard entry={entry} />;
    if (!result) return null;

    return <MergedResultCard result={result} />;
}

const SafeFileSplitterAccessory = ErrorBoundary.wrap(FileSplitterAccessory, { noop: true });

const SplitButton = () => {
    const [status, setStatus] = React.useState<string | null>(null);

    async function doUpload() {
        const file = await chooseFile("*/*");
        if (!file) return;

        if (file.size > MAX_FILE_SIZE) {
            Toasts.show({ message: "File exceeds 500MB limit.", id: Toasts.genId(), type: Toasts.Type.FAILURE });
            return;
        }

        if (file.size <= CHUNK_SIZE) {
            Toasts.show({ message: "File is small enough to send directly.", id: Toasts.genId(), type: Toasts.Type.MESSAGE });
            return;
        }

        const channelId = SelectedChannelStore.getChannelId();
        if (!channelId) {
            Toasts.show({ message: "No channel selected.", id: Toasts.genId(), type: Toasts.Type.FAILURE });
            return;
        }

        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        Toasts.show({ message: `Splitting ${file.name} into ${totalChunks} chunks...`, id: Toasts.genId(), type: Toasts.Type.MESSAGE });
        setStatus("0%");

        try {
            const uploadTimestamp = Date.now();
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunkBlob = file.slice(start, end);

                const metadata = {
                    type: "FileSplitterChunk",
                    index: i,
                    total: totalChunks,
                    originalName: file.name,
                    originalSize: file.size,
                    timestamp: uploadTimestamp
                };

                const chunkFile = new File(
                    [chunkBlob],
                    `${file.name}.part${String(i + 1).padStart(3, "0")}`,
                    { type: "application/octet-stream" }
                );

                await uploadChunk(channelId, chunkFile, metadata);
                setStatus(`${Math.round(((i + 1) / totalChunks) * 100)}%`);
            }

            Toasts.show({ message: `Uploaded ${totalChunks} parts for ${file.name}`, id: Toasts.genId(), type: Toasts.Type.SUCCESS });
        } catch (e: any) {
            Toasts.show({ message: `Error: ${e?.message ?? JSON.stringify(e)}`, id: Toasts.genId(), type: Toasts.Type.FAILURE });
        } finally {
            setStatus(null);
        }
    }

    const label = status ? `Uploading ${status}` : "Split & Upload";

    return (
        <ChatBarButton tooltip={label} onClick={status ? () => { } : () => void doUpload()}>
            <SplitIcon />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "FileSplitter",
    description: "Splits large files into Discord-sized chunks and rebuilds them in chat.",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.sioaeko],
    dependencies: ["ChatInputButtonAPI", "MessageAccessoriesAPI"],
    _cleanupInterval: undefined as any,

    renderMessageAccessory(props: { message: ChunkMessage; }) {
        return <SafeFileSplitterAccessory message={props.message} />;
    },

    flux: {
        MESSAGE_CREATE({ message }: { message: ChunkMessage; }) {
            processMessage(message);
        },
        MESSAGE_UPDATE({ message }: { message: ChunkMessage; }) {
            processMessage(message);
        },
        LOAD_MESSAGES_SUCCESS({ channelId }: { channelId?: string; }) {
            if (channelId) scanExistingMessages(channelId);
        },
        CHANNEL_SELECT({ channelId }: { channelId?: string; }) {
            if (!channelId) return;

            scanExistingMessages(channelId);
            if (delayedChannelScan) clearTimeout(delayedChannelScan);
            delayedChannelScan = setTimeout(() => {
                scanExistingMessages(channelId);
            }, 1500);
        }
    },

    start() {
        clearAllState();
        addChatBarButton("FileSplitter", SplitButton, SplitIcon);

        if (typeof MutationObserver !== "undefined" && document.body) {
            hideObserver = new MutationObserver(() => scheduleHideSweep());
            hideObserver.observe(document.body, { childList: true, subtree: true });
        }

        const currentChannel = SelectedChannelStore.getChannelId();
        if (currentChannel) {
            scanExistingMessages(currentChannel);
            delayedChannelScan = setTimeout(() => scanExistingMessages(currentChannel), 1500);
        }

        scheduleHideSweep();
        this._cleanupInterval = setInterval(pruneOldChunks, 60000);
    },

    stop() {
        removeChatBarButton("FileSplitter");
        if (delayedChannelScan) clearTimeout(delayedChannelScan);
        if (this._cleanupInterval) clearInterval(this._cleanupInterval);
        if (hideObserver) hideObserver.disconnect();
        hideObserver = undefined;
        clearAllState();
    }
});
