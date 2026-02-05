/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { popNotice, showNotice } from "@api/Notices";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import {
    GuildStore,
    Menu,
    MessageActions,
    showToast,
    Toasts } from "@webpack/common";
import { zipSync } from "fflate";

import * as AssetEx from "./exporters/assetExporter";
import * as BanEx from "./exporters/banExporter";
import * as ChanEx from "./exporters/channelExporter";
import * as InfoEx from "./exporters/infoExporter";
import * as MemberEx from "./exporters/memberExporter";
import * as RoleEx from "./exporters/roleExporter";
import { ExporterContext } from "./exporters/types";
import { sanitize } from "./exporters/utils";
import { ExportModal } from "./ExportModal";
import { getNative } from "./nativeUtils";

const logger = new Logger("GuildExport", "#7289da");
const EXPORT_NOTICE_BUTTON_TEXT = "Abort Export";

export const settings = definePluginSettings({
    exportDirectory: {
        type: OptionType.STRING,
        description: "The directory to export data to (if not using ZIP)",
        default: "C:\\GuildExports",
        restartNeeded: false,
    },
    exportMode: {
        type: OptionType.SELECT,
        description: "How to export the data",
        options: [
            { label: "Folder", value: "Folder" },
            { label: "Zip (Save)", value: "ZipSave", default: true },
            { label: "Zip (Send)", value: "ZipSend" },
        ],
        restartNeeded: false,
    },
    sendToChannelId: {
        type: OptionType.STRING,
        description: "Channel ID to send the ZIP to (if using Zip (Send))",
        default: "",
        restartNeeded: false,
    },
    exportInfo: {
        type: OptionType.BOOLEAN,
        description: "Export general guild info",
        default: true,
        restartNeeded: false,
    },
    exportChannels: {
        type: OptionType.BOOLEAN,
        description: "Export channels and their structures",
        default: true,
        restartNeeded: false,
    },
    exportRoles: {
        type: OptionType.BOOLEAN,
        description: "Export roles and their permissions",
        default: true,
        restartNeeded: false,
    },
    exportAutomod: {
        type: OptionType.BOOLEAN,
        description: "Export automod rules",
        default: true,
        restartNeeded: false,
    },
    exportBans: {
        type: OptionType.BOOLEAN,
        description: "Export banned users",
        default: true,
        restartNeeded: false,
    },
    exportMembers: {
        type: OptionType.BOOLEAN,
        description: "Export members (cached only)",
        default: true,
        restartNeeded: false,
    },
    exportEmojis: {
        type: OptionType.BOOLEAN,
        description: "Export custom emojis",
        default: true,
        restartNeeded: false,
    },
    exportStickers: {
        type: OptionType.BOOLEAN,
        description: "Export custom stickers",
        default: true,
        restartNeeded: false,
    },
    exportSounds: {
        type: OptionType.BOOLEAN,
        description: "Export soundboard sounds",
        default: true,
        restartNeeded: false,
    },
    filenameFormat: {
        type: OptionType.SELECT,
        description: "How to name exported asset files",
        options: [
            { label: "IDs (Unique, Safe)", value: "IDs", default: true },
            { label: "Names (Sanitized)", value: "Names" },
        ],
        restartNeeded: false,
    },
    actionDelay: {
        type: OptionType.SLIDER,
        description: "Delay between API calls and asset downloads (ms)",
        markers: [0, 100, 250, 500, 1000, 2000],
        default: 250,
        restartNeeded: false,
    },
});

async function exportGuildData(guildId: string) {
    const guild = GuildStore.getGuild(guildId);
    if (!guild) {
        showToast("Guild not found", Toasts.Type.FAILURE);
        return;
    }

    const s = settings.store;
    showToast(`Exporting ${guild.name}...`, Toasts.Type.MESSAGE);
    logger.info(`Starting export for guild: ${guild.name} (${guildId})`);

    const setProgress = (status: string, type = "GENERIC") => {
        logger.info(status);
        popNotice();
        showNotice(
            <div style={{ padding: "8px 0" }}>
                <strong>Exporting {guild.name}...</strong>
                <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--text-muted)" }}>
                    {status}
                </div>
            </div>,
            EXPORT_NOTICE_BUTTON_TEXT,
            () => {
                popNotice();
                showToast("Export aborted", Toasts.Type.MESSAGE);
            }
        );
    };

    showNotice(
        <div style={{ padding: "8px 0" }}>
            <strong>Exporting {guild.name}...</strong>
            <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--text-muted)" }}>
                Please wait while we gather all the data. Large servers may take a while.
            </div>
        </div>,
        EXPORT_NOTICE_BUTTON_TEXT,
        () => {
            popNotice();
            showToast("Export aborted", Toasts.Type.MESSAGE);
        }
    );

    try {
        const zipData: Record<string, Uint8Array> = {};
        const native = getNative();
        const exportToFolder = s.exportMode === "Folder" && native;

        if (s.exportMode === "Folder" && !native) {
            showToast("Direct folder export is not supported on Web. Falling back to ZIP.", Toasts.Type.MESSAGE);
        }

        const save = async (path: string, data: string | Uint8Array | undefined) => {
            if (data === undefined) return;
            const uint8 = typeof data === "string" ? new TextEncoder().encode(data) : data;
            if (exportToFolder) {
                logger.info(`Saving to folder: ${path} (${uint8.length} bytes)`);
                await native!.saveFile(s.exportDirectory, path, data);
            } else {
                logger.info(`Adding to ZIP: ${path} (${uint8.length} bytes)`);
                zipData[path] = uint8;
            }
        };

        const ctx: ExporterContext = {
            guildId,
            actionDelay: s.actionDelay,
            filenameFormat: s.filenameFormat as any,
            save,
            logger,
            setProgress,
        };

        if (s.exportInfo) await InfoEx.exportInfo(ctx);
        if (s.exportRoles) await RoleEx.exportRoles(ctx);
        if (s.exportChannels) await ChanEx.exportChannels(ctx);
        if (s.exportAutomod) await RoleEx.exportAutomod(ctx);
        if (s.exportBans) await BanEx.exportBans(ctx);
        if (s.exportMembers) await MemberEx.exportMembers(ctx);
        if (s.exportInfo) await AssetEx.exportGuildAssets(ctx);
        if (s.exportEmojis) await AssetEx.exportEmojis(ctx);
        if (s.exportStickers) await AssetEx.exportStickers(ctx);
        if (s.exportSounds) await AssetEx.exportSounds(ctx);

        // Generate and download ZIP or finish Folder export
        if (!exportToFolder) {
            const zipped = zipSync(zipData);
            const fileName = `${sanitize(guild.name)}_export.zip`;

            if (s.exportMode === "ZipSend" && s.sendToChannelId) {
                const file = new File([zipped as any], fileName, { type: "application/zip" });
                try {
                    // @ts-ignore
                    const { CloudUploader } = await import("@webpack/common");
                    if (CloudUploader) {
                        CloudUploader.upload({
                            channelId: s.sendToChannelId,
                            file: { file, platform: 1 },
                            draftType: 0
                        });
                    } else {
                        // Fallback attempt with MessageActions if CloudUploader not found
                        MessageActions.sendMessage(s.sendToChannelId, { content: "", invalidEmojis: [], validNonShortcutEmojis: [] }, null, {
                            uploads: [{ file, platform: 1 }]
                        });
                    }
                } catch (e) {
                    logger.error("Failed to send ZIP to channel", e);
                    showToast("Failed to send ZIP. Downloading instead.", Toasts.Type.FAILURE);
                    const blob = new Blob([zipped as any], { type: "application/zip" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = fileName;
                    a.click();
                    URL.revokeObjectURL(url);
                }
            } else {
                const blob = new Blob([zipped as any], { type: "application/zip" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(url);
            }
        }

        showToast(`Exported ${guild.name} successfully!`, Toasts.Type.SUCCESS);
        logger.info(`Export completed for guild: ${guild.name}`);

        popNotice();
        showNotice(
            <div style={{ padding: "8px 0" }}>
                <strong>Export Finished!</strong>
                <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--text-muted)" }}>
                    Successfully exported {guild.name}.
                </div>
            </div>,
            "Close",
            () => popNotice()
        );
    } catch (error) {
        logger.error("Failed to export guild data", error);
        showToast("Failed to export guild data", Toasts.Type.FAILURE);

        popNotice();
        showNotice(
            <div style={{ padding: "8px 0" }}>
                <strong>Export Failed!</strong>
                <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--text-muted)" }}>
                    {String(error)}
                </div>
            </div>,
            "Close",
            () => popNotice()
        );
    }
}

const GuildContextMenu: NavContextMenuPatchCallback = (children, { guild }) => {
    if (!guild) return;

    children.push(
        <Menu.MenuItem
            id="blu-guild-export"
            label="Export Server"
            action={() => openModal(props => <ExportModal modalProps={props} guild={guild} onExport={exportGuildData} />)}
        />
    );
};

export default definePlugin({
    name: "Guild Export",
    description: "Export guild info, assets, and settings to a ZIP file.",
    authors: [
        { name: "Bluscream", id: 467777925790564352n },
        { name: "Antigravity AI", id: 0n }
    ],
    settings,
    contextMenus: {
        "guild-context": GuildContextMenu,
    }
});
