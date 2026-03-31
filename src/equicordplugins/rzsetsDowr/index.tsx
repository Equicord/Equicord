/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { React, Button } from "@webpack/common";
import { Flex } from "@components/Flex";
import { showNotification } from "@api/Notifications";
import { openModal } from "@utils/modal";
import { ModalRoot, ModalSize } from "@utils/modal";
import { findGroupChildrenByChildId, addContextMenuPatch, removeContextMenuPatch } from "@api/ContextMenu";
import { Menu } from "@webpack/common";
import "./styles.css";

declare global {
    interface Window {
        JSZip?: any;
    }
}

async function loadJSZip() {
    if (window.JSZip) return window.JSZip;

    try {
        const jsZipScript = document.createElement('script');
        jsZipScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";

        const loadPromise = new Promise<void>((resolve, reject) => {
            jsZipScript.onload = () => resolve();
            jsZipScript.onerror = () => reject(new Error("JSZip could not be loaded"));
        });

        document.head.appendChild(jsZipScript);
        await loadPromise;

        return window.JSZip;
    } catch (error) {
        console.error("JSZip loading error:", error);
        return null;
    }
}

const GuildStore = findStoreLazy("GuildStore");
const EmojiStore = findStoreLazy("EmojiStore");
const CDNUtils = findByPropsLazy("getGuildIconURL", "getGuildBannerURL");

const DOWNLOAD_FORMATS = {
    ZIP: "zip"
};

const settings = definePluginSettings({
    emojiSize: {
        type: OptionType.SELECT,
        description: "Emoji download size",
        options: [
            { label: "32px", value: "32" },
            { label: "48px", value: "48" },
            { label: "64px", value: "64" },
            { label: "128px", value: "128" },
            { label: "Original", value: "0" }
        ],
        default: "128"
    },
});

declare global {
    interface Window {
        JSZip?: any;
    }
}

function loadJSZipScript(): Promise<any> {
    return new Promise((resolve, reject) => {
        if (window.JSZip) {
            return resolve(window.JSZip);
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = () => {
            if (window.JSZip) {
                resolve(window.JSZip);
            } else {
                reject(new Error("JSZip loaded but not globally accessible"));
            }
        };
        script.onerror = () => reject(new Error("JSZip loading error"));
        document.head.appendChild(script);
    });
}

async function ensureJSZipLoaded() {
    try {
        if (window.JSZip) return window.JSZip;

        console.log("[ServerAssetsDownloader] Loading JSZip...");
        const JSZip = await loadJSZipScript();
        console.log("[ServerAssetsDownloader] JSZip loaded successfully!");
        return JSZip;
    } catch (error) {
        console.error("[ServerAssetsDownloader] JSZip loading error:", error);
        return null;
    }
}

function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
}

function getEmojiUrl(emoji: any, size: string = "0"): string {
    if (!emoji || typeof emoji.id === 'undefined') return "";

    const format = emoji.animated ? "gif" : "png";
    const sizeParam = size === "0" ? "" : `?size=${size}`;
    return `https://cdn.discordapp.com/emojis/${emoji.id}.${format}${sizeParam}`;
}

async function downloadFile(url: string, fileName: string, silent: boolean = false): Promise<void> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const blob = await response.blob();

        const blobUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        if (!silent) {
            showNotification({
                title: "Download Successful",
                body: `${fileName} downloaded successfully!`,
                color: "var(--green)"
            });
        }

        return Promise.resolve();
    } catch (error) {
        console.error(`[ServerAssetsDownloader] Download error (${fileName}):`, error);

        if (!silent) {
            showNotification({
                title: "Download Error",
                body: error instanceof Error ? error.message : "An unknown error occurred",
                color: "var(--error)"
            });
        }

        return Promise.reject(error);
    }
}

async function downloadAsZip(files: Array<{ url: string; name: string; category?: string; }>, zipName: string): Promise<void> {
    try {
        const JSZip = await ensureJSZipLoaded();
        if (!JSZip) {
            showNotification({
                title: "ZIP Creation Error",
                body: "JSZip could not be loaded. Will open as HTML page.",
                color: "var(--error)"
            });

            downloadAsHtmlPage(files, zipName.replace(".zip", ""));
            return;
        }

        const zip = new JSZip();

        const batchSize = 5;

        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);

            await Promise.all(batch.map(async file => {
                try {
                    const response = await fetch(file.url);
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }

                    const blob = await response.blob();

                    let filePath = file.name;
                    if (file.category) {
                        filePath = `${file.category}/${file.name}`;
                    }

                    zip.file(filePath, blob);

                } catch (error) {
                    console.error(`File download error (${file.name}):`, error);
                }
            }));
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });

        const blobUrl = URL.createObjectURL(zipBlob);
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = zipName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

        showNotification({
            title: "Download Successful",
            body: `${zipName} downloaded successfully!`,
            color: "var(--green)"
        });
    } catch (error) {
        console.error("ZIP download error:", error);
        showNotification({
            title: "ZIP Download Error",
            body: error instanceof Error ? error.message : "An unknown error",
            color: "var(--error)"
        });
    }
}

function downloadAsHtmlPage(files: Array<{ url: string; name: string; category?: string; }>, pageTitle: string): void {
    try {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${pageTitle} - Download Page</title>
                <style>
                    body { font-family: Arial, sans-serif; background: #36393f; color: white; padding: 20px; }
                    h1 { color: #7289da; }
                    .container { max-width: 1200px; margin: 0 auto; }
                    .file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; margin-top: 20px; }
                    .file-item { background: #2f3136; border-radius: 5px; padding: 10px; text-align: center; transition: transform 0.2s; }
                    .file-item:hover { transform: scale(1.05); }
                    .file-preview { height: 100px; width: 100%; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
                    .file-preview img { max-height: 100px; max-width: 100%; object-fit: contain; }
                    .file-name { font-size: 12px; word-break: break-word; }
                    .file-link { color: #7289da; text-decoration: none; display: block; margin-top: 5px; }
                    .download-all { background: #5865f2; color: white; border: none; padding: 12px 20px; border-radius: 4px; font-size: 14px; cursor: pointer; margin: 20px 0; }
                    .category { margin-top: 30px; }
                    .category h2 { color: #7289da; }
                </style>
                <script>
                    function downloadAll() {
                        const links = document.querySelectorAll('.download-link');
                        let delay = 0;
                        const increment = 300;

                        links.forEach(link => {
                            setTimeout(() => {
                                link.click();
                            }, delay);
                            delay += increment;
                        });
                    }
                </script>
            </head>
            <body>
                <div class="container">
                    <h1>${pageTitle} - Download Page</h1>
                    <p>From this page, you can download files individually or in bulk. When you click the "Download All" button, the download process will start sequentially.</p>
                    <button class="download-all" onclick="downloadAll()">Download All</button>

                    ${Array.from(new Set(files.map(f => f.category || 'General'))).map(category => {
            const categoryFiles = files.filter(f => (f.category || 'General') === category);
            return `
                            <div class="category">
                                <h2>${category}</h2>
                                <div class="file-grid">
                                    ${categoryFiles.map(file => {
                const isImage = file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.gif') || file.name.endsWith('.webp');
                return `
                                            <div class="file-item">
                                                <div class="file-preview">
                                                    ${isImage ? `<img src="${file.url}" alt="${file.name}">` : '<div style="font-size: 48px;">📄</div>'}
                                                </div>
                                                <div class="file-name">${file.name}</div>
                                                <a href="${file.url}" download="${file.name}" class="file-link download-link">Download</a>
                                            </div>
                                        `;
            }).join('')}
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');

        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);

        showNotification({
            title: "Download Page Opened",
            body: "A page has been opened where you can download emojis and other assets.",
            color: "var(--green)"
        });
    } catch (error) {
        console.error("HTML page creation error:", error);
        showNotification({
            title: "Page Creation Error",
            body: error instanceof Error ? error.message : "An unknown error",
            color: "var(--error)"
        });
    }
}

function getGuildEmojis(guildId: string): any[] {
    try {
        const guildEmojis = EmojiStore.getGuildEmoji(guildId) || {};
        return Object.values(guildEmojis).filter((emoji: any) => emoji && typeof emoji.id !== 'undefined');
    } catch (error) {
        console.error("[ServerAssetsDownloader] Could not get emoji list:", error);
        return [];
    }
}

async function downloadAllEmojis(guildId: string): Promise<void> {
    try {
        const guild = GuildStore.getGuild(guildId);
        if (!guild) throw new Error("Server not found!");

        const emojis = getGuildEmojis(guildId);
        if (!emojis || emojis.length === 0) {
            showNotification({
                title: "Download Error",
                body: "No downloadable emojis found in this server!",
                color: "var(--error)"
            });
            return;
        }

        const guildName = sanitizeFileName(guild.name);
        const emojiFiles = emojis.map(emoji => {
            const emojiName = sanitizeFileName(emoji.name);
            const fileType = emoji.animated ? "gif" : "png";
            const fileName = `${emojiName}.${fileType}`;

            return {
                url: getEmojiUrl(emoji, settings.store.emojiSize),
                name: fileName,
                category: "emojis"
            };
        });

        await downloadAsZip(emojiFiles, `${guildName}_emojis.zip`);
    } catch (error) {
        console.error("[ServerAssetsDownloader] Emoji download error:", error);
        showNotification({
            title: "Emoji Download Error",
            body: error instanceof Error ? error.message : "An unknown error occurred",
            color: "var(--error)"
        });
    }
}

async function downloadServerIcon(guildId: string): Promise<void> {
    try {
        const guild = GuildStore.getGuild(guildId);
        if (!guild) throw new Error("Server not found!");
        if (!guild.icon) throw new Error("This server doesn't have an icon!");

        const guildName = sanitizeFileName(guild.name);

        const iconUrl = CDNUtils.getGuildIconURL({
            id: guildId,
            icon: guild.icon,
            size: 4096,
            canAnimate: true
        });

        if (!iconUrl) throw new Error("Could not create icon URL!");

        await downloadFile(iconUrl, `${guildName}_icon.png`);
    } catch (error) {
        console.error("[ServerAssetsDownloader] Icon download error:", error);
        showNotification({
            title: "Icon Download Error",
            body: error instanceof Error ? error.message : "An unknown error occurred",
            color: "var(--error)"
        });
    }
}

function addServerContextMenuPatch(children, { guild }) {
    if (!guild) return;

    const group = findGroupChildrenByChildId("privacy", children);

    group?.push(
        <Menu.MenuItem
            id="vc-server-assets-downloader"
            label="Download Server Assets"
            action={() => openAssetDownloaderModal(guild.id)}
        />
    );
}

function openAssetDownloaderModal(guildId: string) {
    openModal((props: { onClose: () => void; transitionState: number; }) => (
        <ModalRoot
            size={ModalSize.SMALL}
            onClose={() => props.onClose()}
            transitionState={props.transitionState}
        >
            <div className="server-assets-downloader-modal">
                <div className="server-assets-downloader-title">
                    Download Server Assets
                </div>

                <Flex
                    className="server-assets-downloader-buttons"
                    flexDirection="column"
                    style={{ gap: "8px" }}
                >
                    <Button
                        look={Button.Looks.FILLED}
                        color={Button.Colors.PRIMARY}
                        size={Button.Sizes.MEDIUM}
                        onClick={() => {
                            try {
                                downloadAllEmojis(guildId);
                                props.onClose?.();
                            } catch (e) {
                                console.error("Emoji download error:", e);
                            }
                        }}
                    >
                        Download All Emojis
                    </Button>

                    <Button
                        look={Button.Looks.FILLED}
                        color={Button.Colors.PRIMARY}
                        size={Button.Sizes.MEDIUM}
                        onClick={() => {
                            try {
                                downloadServerIcon(guildId);
                                props.onClose?.();
                            } catch (e) {
                                console.error("Icon download error:", e);
                            }
                        }}
                    >
                        Download Server Icon
                    </Button>

                    <Button
                        look={Button.Looks.LINK}
                        color={Button.Colors.LINK}
                        size={Button.Sizes.MEDIUM}
                        onClick={() => props.onClose?.()}
                    >
                        Cancel
                    </Button>
                </Flex>
            </div>
        </ModalRoot>
    ));
}

export default definePlugin({
    name: "ServerAssetsDownloader",
    description: "Allows you to download server assets like emojis, icons, banners.",
    authors: [Devs.rz30, Devs.r3r1],
    tags: ["server", "download", "emoji"],
    settings,

    contextMenus: {
        "guild-context": addServerContextMenuPatch,
        "guild-header-popout": addServerContextMenuPatch
    },

    async start() {
        console.log("[ServerAssetsDownloader] Plugin started!");

        try {
            const JSZip = await ensureJSZipLoaded();
            if (JSZip) {
                console.log("[ServerAssetsDownloader] JSZip successfully loaded at startup!");
            } else {
                console.warn("[ServerAssetsDownloader] JSZip could not be loaded. Alternative methods will be used.");
            }
        } catch (e) {
            console.error("[ServerAssetsDownloader] JSZip loading error:", e);
        }
    },

    stop() {
        console.log("[ServerAssetsDownloader] Plugin stopped!");
    }
});
