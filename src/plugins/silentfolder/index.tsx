/*
 * SilentFolder
 * Mutes every server inside one selected Discord folder.
 *
 * Author: Zot
 */
import { definePluginSettings } from "@api/Settings";
import { findByPropsLazy } from "@webpack";
import definePlugin, { OptionType } from "@utils/types";
import { useState } from "@webpack/common";

const GuildFolderStore = findByPropsLazy("getGuildFolders");
const NotificationUtils = findByPropsLazy("updateGuildNotificationSettings");

interface GuildFolder {
    guildIds: string[];
    folderId?: number;
    folderName?: string;
    folderColor?: number;
}

function getFolders(): GuildFolder[] {
    return (GuildFolderStore.getGuildFolders?.() ?? []).filter(
        (f: GuildFolder) => f.folderId != null && f.guildIds?.length
    );
}

function muteGuild(guildId: string) {
    NotificationUtils.updateGuildNotificationSettings(guildId, {
        muted: true,
        suppress_everyone: true,
        suppress_roles: true,
    });
}

function muteSelectedFolder() {
    const folderId = settings.store.folder;
    if (!folderId || folderId === "none") return;

    const folder = getFolders().find(
        f => String(f.folderId) === String(folderId)
    );
    if (!folder?.guildIds) return;

    for (const guildId of folder.guildIds) {
        muteGuild(guildId);
    }
}

const dropdownCSS = `
.silentfolder-select {
    width: 100% !important;
    padding: 10px 12px !important;
    border-radius: 8px !important;
    border: 1px solid var(--interactive-active, #b9bbbe) !important;
    background-color: var(--background-secondary) !important;
    color: var(--text-normal) !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    cursor: pointer !important;
    outline: none !important;
    appearance: none !important;
    -webkit-appearance: none !important;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2380848e' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>") !important;
    background-repeat: no-repeat !important;
    background-position: right 10px center !important;
    background-size: 16px !important;
    transition: border-color 0.15s ease !important;
}
.silentfolder-select:hover {
    border-color: var(--interactive-hover, #dcddde) !important;
}
.silentfolder-select:focus {
    border-color: var(--brand-experiment, #5865f2) !important;
    box-shadow: 0 0 0 1px var(--brand-experiment, #5865f2) !important;
}
`;

function FolderSelectComponent() {
    const [folders, setFolders] = useState(getFolders());
    const [selected, setSelected] = useState(settings.store.folder ?? "none");

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <style>{dropdownCSS}</style>
            <select
                className="silentfolder-select"
                value={selected}
                onFocus={() => setFolders(getFolders())}
                onChange={e => {
                    setSelected(e.target.value);
                    settings.store.folder = e.target.value;
                    muteSelectedFolder();
                }}
            >
                <option value="none">None</option>
                {folders.map(folder => (
                    <option key={folder.folderId} value={String(folder.folderId)}>
                        {folder.folderName || `Folder ${folder.folderId}`}
                    </option>
                ))}
            </select>
            <div
                style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    lineHeight: "16px",
                }}
            >
                It is recommended to have a name for every folder to make the process simpler.
            </div>
        </div>
    );
}

const settings = definePluginSettings({
    folder: {
        type: OptionType.COMPONENT,
        description: "Choose which server folder to mute",
        component: FolderSelectComponent,
    },
});

export default definePlugin({
    name: "SilentFolder",
    description:
        "Mute every server inside a selected Discord server folder.",
    authors: [
        {
            name: "Zot",
            id: 1531412914005606513n,
        },
    ],
    settings,
    start() {
        muteSelectedFolder();
    },
    flux: {
        GUILD_FOLDER_UPDATE() {
            muteSelectedFolder();
        },
        GUILD_CREATE() {
            muteSelectedFolder();
        },
        GUILD_DELETE() {
            muteSelectedFolder();
        },
    },
});