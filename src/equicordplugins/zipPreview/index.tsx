/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { EquicordDevs } from "@utils/constants";
import { openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { ContextMenuApi, createRoot, Menu, React, showToast, useEffect, useState } from "@webpack/common";

import ZipPreview from "./ZipPreview";

async function fetchBlobWithDebug(url: string) {
    try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
            console.error("ZipPreview: fetch failed", url, res.status, res.statusText);
            return null;
        }
        const blob = await res.blob();
        return blob;
    } catch (err) {
        console.error("ZipPreview: fetch error for", url, err);
        return null;
    }
}

async function tryNativeDownloadAttachment(attachment: any) {
    try {
        const helpers = (globalThis as any).VencordNative?.pluginHelpers?.MessageLoggerEnhanced;
        if (!helpers) return null;

        const filename = attachment?.filename || attachment?.title || attachment?.name || "";
        const extMatch = filename?.includes(".") ? `.${filename.split(".").pop()}` : "";
        const logged = {
            id: attachment?.id,
            url: attachment?.url || attachment?.proxy_url || attachment?.proxyUrl,
            oldUrl: attachment?.oldUrl || attachment?.url || attachment?.proxy_url || attachment?.proxyUrl,
            fileExtension: attachment?.fileExtension || extMatch,
            filename: filename,
            proxy_url: attachment?.proxy_url,
            content_type: attachment?.content_type
        };

        if (!logged.id || !logged.url) return null;

        const res = await helpers.downloadAttachment(logged);
        if (!res || res.error || !res.path) return null;

        // now retrieve raw bytes from native cache
        const bytes = await helpers.getImageNative(logged.id);
        if (!bytes) return null;

        // bytes may be Buffer-like or Uint8Array
        const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        return new Blob([arr.buffer]);
    } catch (err) {
        console.error("ZipPreview: native download failed", err);
        return null;
    }
}

let handler: ((e: MouseEvent) => void) | null = null;

function MessageContextMenu(children: Array<any>, props: any) {
    try {
        const { mediaItem, message } = props ?? {};
        if (!mediaItem || !message) return;

        const attachment = (message.attachments || []).find((a: any) =>
            a?.proxy_url === mediaItem.proxyUrl || a?.url === mediaItem.url || a?.proxy_url === mediaItem.url || a?.url === mediaItem.proxyUrl
        );

        const filename = attachment?.filename || attachment?.title || mediaItem?.filename || mediaItem?.name || "";
        const contentType = (attachment?.content_type || mediaItem?.contentType || "").toLowerCase();

        const looksLikeZip = contentType.includes("zip") || filename.toLowerCase().endsWith(".zip") || (mediaItem?.url || "").toLowerCase().endsWith(".zip");
        if (!looksLikeZip) return;

        children.push(
            <Menu.MenuItem
                id="zippreview-open"
                label="Preview zip"
                action={async () => {
                    try {
                        const url = attachment?.proxy_url || attachment?.url || mediaItem?.proxyUrl || mediaItem?.url;
                        if (!url) return;

                        // try native download first to avoid CORS issues
                        let blob = await tryNativeDownloadAttachment(attachment || mediaItem);
                        if (!blob) blob = await fetchBlobWithDebug(url);

                        if (!blob || blob.size === 0) {
                            console.error("ZipPreview: fetched empty blob for", url);
                            showToast("Failed to fetch attachment for preview (empty response). Try Download.");
                            return;
                        }
                        openModal((props: any) => <ZipPreview blob={blob} name={filename} /> as any);
                    } catch (err) {
                        console.error("ZipPreview: failed to open from context menu", err);
                    }
                }}
            />
        );
    } catch (err) {
        // ignore
    }
}

// Store for expanded state and loaded blobs per attachment
const expandedState = new Map<string, boolean>();
const blobCache = new Map<string, Blob>();

// Component to render inside each zip attachment
function ZipAttachmentPreview({ attachment }: { attachment: any; }) {
    const [blob, setBlob] = useState<Blob | null>(() => blobCache.get(attachment.id) || null);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<boolean>(() => {
        try { return expandedState.get(attachment.id) ?? false; } catch { return false; }
    });

    useEffect(() => {
        // If already cached, skip fetch
        if (blobCache.has(attachment.id)) return;

        let mounted = true;
        (async () => {
            try {
                const url = attachment.proxy_url || attachment.url;
                if (!url) {
                    if (mounted) setError("No URL for attachment");
                    return;
                }
                let b = await tryNativeDownloadAttachment(attachment);
                if (!b) b = await fetchBlobWithDebug(url);
                if (!b || b.size === 0) {
                    if (mounted) setError("Failed to fetch archive");
                    return;
                }
                if (mounted) {
                    setBlob(b);
                    blobCache.set(attachment.id, b);
                }
            } catch (err) {
                if (mounted) setError("Failed to fetch archive");
            }
        })();
        return () => { mounted = false; };
    }, [attachment.id]);

    if (error) return <div className="zp-error">{error}</div>;
    if (!blob) return <div className="zp-loading">Loading preview…</div>;

    return (
        <div className="zp-attachment-integrated">
            <ZipPreview
                blob={blob}
                name={attachment.filename || attachment.name || "archive.zip"}
                expanded={expanded}
                onExpandedChange={v => { setExpanded(v); expandedState.set(attachment.id, v); }}
            />
        </div>
    );
}

export default definePlugin({
    name: "ZipPreview",
    description: "Preview and navigate inside zip files without extracting.",
    authors: [EquicordDevs.justjxke],

    patches: [],

    contextMenus: {
        "message": MessageContextMenu
    },

    start() {
        // use mutationobserver to inject preview into file attachments
        const observer = new MutationObserver(() => {
            document.querySelectorAll(".file__0ccae").forEach((fileEl: any) => {
                if (fileEl.dataset.zpProcessed) return;

                // find the filename anchor
                const anchor = fileEl.querySelector("a[href*=\".zip\"]");
                if (!anchor) return;

                const { href } = anchor;
                if (!href.toLowerCase().includes(".zip")) return;

                const wrapEl = document.createElement("div");
                wrapEl.className = "zp-wrap";

                const contentEl = document.createElement("div");
                contentEl.className = "zp-content";

                while (fileEl.firstChild) {
                    contentEl.appendChild(fileEl.firstChild);
                }

                wrapEl.appendChild(contentEl);

                // create and inject preview element
                const container = document.createElement("div");
                container.className = "zp-injected-preview";
                wrapEl.appendChild(container);

                fileEl.appendChild(wrapEl);
                fileEl.classList.add("zp-file-wrapper");
                fileEl.dataset.zpProcessed = "true";

                // extract attachment ID from the URL or use href as fallback
                const urlParts = href.split("/");
                const attachmentId = urlParts[urlParts.length - 2] || href;

                // render React component into it
                const attachment = {
                    url: href,
                    proxy_url: href,
                    filename: anchor.textContent || "archive.zip",
                    id: attachmentId
                };

                const root = createRoot(container);
                root.render(React.createElement(ZipAttachmentPreview, { attachment }));
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
        (this as any)._observer = observer;

        handler = (e: MouseEvent) => {
            try {
                const target = e.target as HTMLElement;
                const a = target.closest ? (target.closest("a") as HTMLAnchorElement | null) : null;
                const href = a?.href ?? (target.getAttribute ? target.getAttribute("href") : null);
                if (!href) return;
                // quick check for zip
                if (!href.toLowerCase().endsWith(".zip")) return;

                e.preventDefault();
                ContextMenuApi.openContextMenu(e as any, () => (
                    <Menu.Menu
                        navId="zippreview"
                        onClose={() => (window as any).FluxDispatcher?.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
                        aria-label="Zip Preview"
                    >
                        <Menu.MenuItem id="zippreview-open" label="Preview zip" action={async () => {
                            try {
                                // try native download first (if this is an attachment-like link)
                                let blob: Blob | null = null;
                                try {
                                    // attempt to construct minimal attachment info from href
                                    const maybe = { url: href } as any;
                                    blob = await tryNativeDownloadAttachment(maybe);
                                } catch (e) {
                                    blob = null;
                                }
                                if (!blob) blob = await fetchBlobWithDebug(href);
                                if (!blob || blob.size === 0) {
                                    console.error("ZipPreview: fetched empty blob for", href);
                                    showToast("Failed to fetch attachment for preview (empty response). Try Download.");
                                    return;
                                }
                                // extract name from href
                                const urlParts = href.split("/");
                                const inferred = urlParts[urlParts.length - 1] || "archive.zip";
                                openModal(props => <ZipPreview blob={blob} name={inferred} /> as any);
                            } catch (err) {
                                console.error("ZipPreview: failed to open", err);
                            }
                        }} />
                    </Menu.Menu>
                ));
            } catch (err) {
                // ignore
            }
        };

        document.addEventListener("contextmenu", handler, true);
    },

    stop() {
        const observer = (this as any)._observer;
        if (observer) observer.disconnect();
        if (handler) document.removeEventListener("contextmenu", handler, true);
        handler = null;
    }
});

export { MessageContextMenu };
