/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 sioaeko and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { PluginNative } from "@utils/types";
import { chooseFile, saveFile } from "@utils/web";
import { Message } from "@vencord/discord-types";
import { CloudUploadPlatform } from "@vencord/discord-types/enums";
import { findLazy } from "@webpack";
import { Constants, MessageStore, React, RestAPI, SelectedChannelStore, SnowflakeUtils, Toasts } from "@webpack/common";

import { ChunkData, ChunkEntry, ChunkMeta, MergedResult } from "./types";

const cl = classNameFactory("vc-file-splitter-");
const CloudUpload = findLazy(m => m.prototype?.trackUploadFinished);

const Native = IS_DISCORD_DESKTOP
    ? VencordNative.pluginHelpers.FileSplitter as PluginNative<typeof import("./native")>
    : null;

const CHUNK_SIZE = 10 * 1024 * 1024;
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const CHUNK_TIMEOUT = 30 * 60 * 1000;

const IMAGE_MIME: Record<string, string> = {
    avif: "image/avif", bmp: "image/bmp", gif: "image/gif",
    jpeg: "image/jpeg", jpg: "image/jpeg", png: "image/png", webp: "image/webp"
};

const chunkStore: Record<string, ChunkEntry> = {};
const mergedResults = new Map<string, MergedResult>();
const storeListeners = new Set<() => void>();
let storeVersion = 0;

function emitChange() {
    storeVersion++;
    for (const listener of storeListeners) listener();
}

function useStore() {
    const [, setVersion] = React.useState(storeVersion);
    React.useEffect(() => {
        const listener = () => setVersion(storeVersion);
        storeListeners.add(listener);
        return () => {
            storeListeners.delete(listener);
        };
    }, []);
}

function chunkKey(c: Pick<ChunkMeta, "originalName" | "originalSize" | "timestamp">) {
    return `${c.originalName}_${c.originalSize}_${c.timestamp}`;
}

function mimeType(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return IMAGE_MIME[ext] ?? null;
}

function isImage(filename: string) {
    return mimeType(filename)?.startsWith("image/") ?? false;
}

function normalizeUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const u = new URL(url);
        if (u.hostname === "media.discordapp.net") u.hostname = "cdn.discordapp.com";
        return u.toString();
    } catch {
        return url.replace("://media.discordapp.net/", "://cdn.discordapp.com/");
    }
}

function isComplete(entry: ChunkEntry) {
    if (!entry.chunks.length) return false;
    const { total } = entry.chunks[0];
    const indices = new Set(entry.chunks.map(c => c.index));
    if (indices.size !== total) return false;
    for (let i = 0; i < total; i++) if (!indices.has(i)) return false;
    return true;
}

function parseChunkMeta(content: string | undefined): Omit<ChunkMeta, "type"> | null {
    if (!content) return null;
    try {
        const c = JSON.parse(content);
        const { type, index, total, originalName, originalSize, timestamp } = c;
        if (
            type === "FileSplitterChunk"
            && Number.isInteger(index) && index >= 0
            && Number.isInteger(total) && total > 0 && index < total
            && typeof originalName === "string"
            && typeof originalSize === "number"
            && typeof timestamp === "number"
        ) return { index, total, originalName, originalSize, timestamp };
    } catch { }
    return null;
}

function getChunkFromMessage(message: Message): ChunkData | null {
    if (!message.attachments?.length) return null;
    const meta = parseChunkMeta(message.content);
    if (!meta) return null;
    const url = normalizeUrl(message.attachments[0].url ?? message.attachments[0].proxy_url);
    if (!url) return null;
    return { ...meta, type: "FileSplitterChunk", url, channelId: message.channel_id, messageId: message.id };
}

function anchorMessageId(key: string): string | null {
    const entry = chunkStore[key];
    if (!entry?.chunks.length) return null;
    return [...entry.chunks].sort((a, b) => a.index - b.index)[0].messageId;
}

async function fetchBlob(url: string, filename?: string): Promise<Blob> {
    const normalized = normalizeUrl(url) ?? url;

    if (Native) {
        try {
            const res = await Native.fetchChunk(normalized);
            if (res.success && res.data)
                return new Blob([res.data], { type: res.contentType ?? (filename ? mimeType(filename) : null) ?? "application/octet-stream" });
        } catch { }
    }

    const r = await fetch(normalized);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.blob();
}

async function assembleBlob(key: string): Promise<{ blob: Blob; mimeType: string; }> {
    const entry = chunkStore[key];
    if (!entry?.chunks.length) throw new Error("No chunks available");

    const name = entry.chunks[0].originalName;
    const parts = await Promise.all(entry.chunks.map(c => fetchBlob(c.url, name)));
    const mime = mimeType(name) ?? "application/octet-stream";
    return { blob: new Blob(parts, { type: mime }), mimeType: mime };
}

async function downloadBlob(blob: Blob, filename: string) {
    if (IS_DISCORD_DESKTOP) {
        try {
            await DiscordNative.fileManager.saveWithDialog(new Uint8Array(await blob.arrayBuffer()), filename);
            return;
        } catch { }
    }
    saveFile(new File([blob], filename, { type: blob.type || "application/octet-stream" }));
}

async function handleDownload(key: string) {
    const result = mergedResults.get(key);
    if (!result) return;

    try {
        if (!result.blob) {
            result.status = "loading";
            result.error = undefined;
            emitChange();
            const assembled = await assembleBlob(key);
            result.blob = assembled.blob;
            result.mimeType = assembled.mimeType;
            result.status = "ready";
        }
        await downloadBlob(result.blob, result.originalName);
    } catch (e) {
        result.status = "error";
        result.error = e instanceof Error ? e.message : String(e);
        emitChange();
        Toasts.show({ message: `Download failed: ${result.error}`, id: Toasts.genId(), type: Toasts.Type.FAILURE });
        return;
    }

    emitChange();
    Toasts.show({ message: `Downloaded: ${result.originalName}`, id: Toasts.genId(), type: Toasts.Type.SUCCESS });
}

function storeChunk(chunk: ChunkData) {
    const key = chunkKey(chunk);
    const entry = chunkStore[key] ?? (chunkStore[key] = { chunks: [], lastUpdated: Date.now() });
    const existing = entry.chunks.find(c => c.index === chunk.index);

    let changed = false;
    if (!existing) {
        entry.chunks.push(chunk);
        changed = true;
    } else if (existing.url !== chunk.url || existing.messageId !== chunk.messageId) {
        Object.assign(existing, chunk);
        changed = true;
    }

    entry.chunks.sort((a, b) => a.index - b.index);
    entry.lastUpdated = Date.now();
    if (changed) emitChange();
    return key;
}

async function prepareImagePreview(key: string) {
    const result = mergedResults.get(key);
    if (!result || result.objectUrl || result.status === "loading") return;

    result.status = "loading";
    emitChange();

    try {
        const { blob, mimeType: mime } = await assembleBlob(key);
        if (result.objectUrl) URL.revokeObjectURL(result.objectUrl);
        result.blob = blob;
        result.mimeType = mime;
        result.objectUrl = URL.createObjectURL(blob);
        result.status = "ready";
    } catch (e) {
        result.status = "error";
        result.error = e instanceof Error ? e.message : String(e);
    }

    emitChange();
}

function processComplete(key: string) {
    const entry = chunkStore[key];
    if (!entry) return;

    const name = entry.chunks[0].originalName;
    if (!mergedResults.has(key)) {
        mergedResults.set(key, {
            key,
            originalName: name,
            isImage: isImage(name),
            mimeType: mimeType(name) ?? "application/octet-stream",
            status: "pending"
        });
        emitChange();
    }

    if (isImage(name)) void prepareImagePreview(key);
}

function processMessage(message: Message) {
    const chunk = getChunkFromMessage(message);
    if (!chunk) return;
    const key = storeChunk(chunk);
    if (isComplete(chunkStore[key])) processComplete(key);
}

function scanChannel(channelId: string) {
    try {
        const messages = MessageStore.getMessages(channelId).toArray();
        for (const msg of messages) processMessage(msg);
    } catch { }
}

function clearAll() {
    for (const r of mergedResults.values()) if (r.objectUrl) URL.revokeObjectURL(r.objectUrl);
    for (const k of Object.keys(chunkStore)) delete chunkStore[k];
    mergedResults.clear();
    emitChange();
}

function pruneOldChunks() {
    const now = Date.now();
    let changed = false;
    for (const key of Object.keys(chunkStore)) {
        if (!mergedResults.has(key) && now - chunkStore[key].lastUpdated > CHUNK_TIMEOUT) {
            delete chunkStore[key];
            changed = true;
        }
    }
    if (changed) emitChange();
}

function uploadChunk(channelId: string, file: File, meta: ChunkMeta): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const uploader = new CloudUpload({ file, platform: CloudUploadPlatform.WEB }, channelId);
            uploader.on("complete", () => {
                RestAPI.post({
                    url: Constants.Endpoints.MESSAGES(channelId),
                    body: {
                        flags: 0,
                        channel_id: channelId,
                        content: JSON.stringify(meta),
                        nonce: SnowflakeUtils.fromTimestamp(Date.now()),
                        sticker_ids: [],
                        type: 0,
                        attachments: [{ id: "0", filename: uploader.filename, uploaded_filename: uploader.uploadedFilename }]
                    }
                }).then(() => resolve()).catch((e: unknown) => reject(new Error(`Send failed: ${e instanceof Error ? e.message : String(e)}`)));
            });
            uploader.on("error", (e: unknown) => reject(new Error(`Upload failed: ${e instanceof Error ? e.message : String(e)}`)));
            uploader.upload();
        } catch (e) {
            reject(new Error(e instanceof Error ? e.message : String(e)));
        }
    });
}

const SplitIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6zm8-4h-4v-2h4v-2l3 3-3 3v-2z" />
    </svg>
);

const FILE_BADGE_KINDS: Array<[string[], string]> = [
    [["zip", "rar", "7z", "tar", "gz"], "archive"],
    [["pdf"], "document"],
    [["txt", "md", "json", "csv", "xml", "yaml", "yml"], "text"],
    [["mp3", "wav", "flac", "ogg", "m4a"], "audio"],
    [["mp4", "mkv", "avi", "mov", "webm"], "video"],
    [["exe", "msi", "apk"], "app"],
];

function getFileBadge(filename: string) {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const kind = FILE_BADGE_KINDS.find(([exts]) => exts.includes(ext))?.[1] ?? "file";
    return { kind, label: ext.toUpperCase().slice(0, 4) || "FILE" };
}

const FILE_ICON_PATHS: Record<string, string[]> = {
    archive: ["M10 10v8", "M12 10v8", "M10 12h2", "M10 15h2", "M10 18h2"],
    video: ["M10 10.5v5l4-2.5z"],
    audio: ["M10 10v6", "M14 9v5", "M10 16a1.5 1.5 0 1 1-1.5 1.5", "M14 14a1.5 1.5 0 1 1-1.5 1.5"],
    text: ["M9 11h6", "M9 14h6", "M9 17h4"],
    document: ["M9 11h6", "M9 15h6"],
    app: ["M9 10h6v6H9z"],
    file: ["M9 11h6", "M9 15h6", "M9 19h4"],
};

const FileTypeIcon = ({ kind, label }: { kind: string; label: string; }) => (
    <div className={cl("file-icon")} title={label}>
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
            <path d="M14 2v5h5" />
            {(FILE_ICON_PATHS[kind] ?? FILE_ICON_PATHS.file).map(d => <path key={d} d={d} />)}
        </svg>
    </div>
);

const ActionButton = ({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; }) => (
    <button
        className={cl("action")}
        type="button"
        disabled={disabled}
        onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        }}
    >
        {children}
    </button>
);

function ProgressCard({ entry }: { entry: ChunkEntry; }) {
    const first = entry.chunks[0];
    const count = new Set(entry.chunks.map(c => c.index)).size;
    return (
        <div className={cl("card")} data-status="pending">
            <div className={cl("body")}>
                <div className={cl("text")}>
                    <div className={cl("title")}>{first?.originalName ?? "Split file"}</div>
                    <div className={cl("subtitle")}>Waiting for chunks: {count}/{first?.total ?? 0}</div>
                </div>
            </div>
        </div>
    );
}

function MergedResultCard({ result }: { result: MergedResult; }) {
    const badge = getFileBadge(result.originalName);
    const subtitle = result.error
        ? `Merge failed: ${result.error}`
        : result.isImage
            ? result.status === "ready" ? "Merged image preview" : "Preparing image preview..."
            : result.status === "loading" ? "Preparing download..." : "Merged file ready to download";

    return (
        <div className={cl("card")} data-status={result.status} data-image={String(result.isImage)}>
            {result.isImage && result.objectUrl && (
                <img className={cl("image")} src={result.objectUrl} alt={result.originalName} />
            )}
            <div className={cl("body")}>
                {!result.isImage && <FileTypeIcon kind={badge.kind} label={badge.label} />}
                <div className={cl("text")}>
                    <div className={cl("title")}>{result.originalName}</div>
                    <div className={cl("subtitle")}>{subtitle}</div>
                </div>
                <div className={cl("actions")}>
                    {result.status === "error" ? (
                        <ActionButton onClick={() => {
                            if (result.isImage) void prepareImagePreview(result.key);
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

function FileSplitterAccessory({ message }) {
    useStore();

    React.useEffect(() => {
        processMessage(message);
    }, [message.id, message.content, message.attachments.length]);

    const chunk = getChunkFromMessage(message);
    const key = chunk ? chunkKey(chunk) : null;
    const entry = key ? chunkStore[key] : null;
    const complete = Boolean(entry && isComplete(entry));
    const result = key ? mergedResults.get(key) : null;

    if (!chunk || !key || !entry || anchorMessageId(key) !== message.id) return null;
    if (!complete) return <ProgressCard entry={entry} />;
    if (!result) return null;
    return <MergedResultCard result={result} />;
}

const SafeFileSplitterAccessory = ErrorBoundary.wrap(FileSplitterAccessory, { noop: true });

const SplitButton: ChatBarButtonFactory = ({ isMainChat }) => {
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
            const timestamp = Date.now();
            for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_SIZE;
                const chunkFile = new File(
                    [file.slice(start, start + CHUNK_SIZE)],
                    `${file.name}.part${String(i + 1).padStart(3, "0")}`,
                    { type: "application/octet-stream" }
                );
                await uploadChunk(channelId, chunkFile, {
                    type: "FileSplitterChunk",
                    index: i, total: totalChunks,
                    originalName: file.name, originalSize: file.size,
                    timestamp
                });
                setStatus(`${Math.round(((i + 1) / totalChunks) * 100)}%`);
            }
            Toasts.show({ message: `Uploaded ${totalChunks} parts for ${file.name}`, id: Toasts.genId(), type: Toasts.Type.SUCCESS });
        } catch (e) {
            Toasts.show({ message: `Error: ${e instanceof Error ? e.message : String(e)}`, id: Toasts.genId(), type: Toasts.Type.FAILURE });
        } finally {
            setStatus(null);
        }
    }

    if (!isMainChat) return null;

    return (
        <ChatBarButton tooltip={status ? `Uploading ${status}` : "Split & Upload"} onClick={status ? () => { } : () => void doUpload()}>
            <SplitIcon />
        </ChatBarButton>
    );
};

let delayedScan: ReturnType<typeof setTimeout> | undefined;
let cleanupInterval: ReturnType<typeof setInterval> | undefined;

export default definePlugin({
    name: "FileSplitter",
    description: "Splits large files into Discord-sized chunks and rebuilds them in chat.",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.sioaeko],
    dependencies: ["ChatInputButtonAPI", "MessageAccessoriesAPI"],

    chatBarButton: {
        icon: SplitIcon,
        render: SplitButton
    },

    patches: [
        {
            find: ".NITRO_NOTIFICATION,[",
            replacement: [
                {
                    match: /renderContentOnly:\i}=\i;/,
                    replace: "$&if($self.shouldHideChunkMessage(arguments[0].message)) return null;"
                },
                {
                    match: /childrenMessageContent:(\i),/g,
                    replace: "childrenMessageContent:$self.isChunkMessage(arguments[0].message)?null:$1,"
                },
            ]
        },
        {
            find: "this.renderAttachments(",
            replacement: {
                match: /(?<=\i=)this\.render(?:Attachments|Embeds|StickersAccessories|ComponentAccessories)\((\i)\)/g,
                replace: "$self.isChunkMessage($1)?null:$&"
            }
        }
    ],

    renderMessageAccessory({ message }) {
        return <SafeFileSplitterAccessory message={message} />;
    },

    isChunkMessage(message?: Message | null) {
        return Boolean(message && getChunkFromMessage(message));
    },

    shouldHideChunkMessage(message?: Message | null) {
        if (!message) return false;
        const chunk = getChunkFromMessage(message);
        if (!chunk) return false;
        const key = chunkKey(chunk);
        return anchorMessageId(key) !== message.id;
    },

    flux: {
        MESSAGE_CREATE({ message }) {
            processMessage(message);
        },
        MESSAGE_UPDATE({ message }) {
            processMessage(message);
        },
        LOAD_MESSAGES_SUCCESS({ channelId }) {
            if (channelId) scanChannel(channelId);
        },
        CHANNEL_SELECT({ channelId }) {
            if (!channelId) return;
            scanChannel(channelId);
            clearTimeout(delayedScan);
            delayedScan = setTimeout(() => scanChannel(channelId), 1500);
        }
    },

    start() {
        clearAll();
        const ch = SelectedChannelStore.getChannelId();
        if (ch) {
            scanChannel(ch);
            delayedScan = setTimeout(() => scanChannel(ch), 1500);
        }
        cleanupInterval = setInterval(pruneOldChunks, 60_000);
    },

    stop() {
        clearTimeout(delayedScan);
        clearInterval(cleanupInterval);
        delayedScan = cleanupInterval = undefined;
        clearAll();
    }
});
