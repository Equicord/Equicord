/*
 * SilentFolder
 *
 * Author: Zot
 */
import { definePluginSettings } from "@api/Settings";
import { findByPropsLazy } from "@webpack";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, useState } from "@webpack/common";

const GuildFolderStore = findByPropsLazy("getGuildFolders");
const NotificationUtils = findByPropsLazy("updateGuildNotificationSettings");
const ChannelStore = findByPropsLazy("getChannel", "getDMFromUserId");
const MentionCountStore = findByPropsLazy("getMentionCount");

interface GuildFolder {
    guildIds: string[];
    folderId?: number;
    folderName?: string;
    folderColor?: number;
}

let origGetMentionCount: typeof MentionCountStore.getMentionCount | null = null;
let patched = false;

function getFolders(): GuildFolder[] {
    return (GuildFolderStore.getGuildFolders?.() ?? []).filter(
        (f: GuildFolder) => f.folderId != null && f.guildIds?.length
    );
}

function getSelectedFolderIds(): string[] {
    return settings.store.folders ?? [];
}

function getSelectedFolders(): GuildFolder[] {
    const ids = getSelectedFolderIds();
    return getFolders().filter(f => ids.includes(String(f.folderId)));
}

function getSelectedGuildIds(): string[] {
    const ids = new Set<string>();
    for (const folder of getSelectedFolders()) {
        for (const guildId of folder.guildIds ?? []) {
            ids.add(guildId);
        }
    }
    return [...ids];
}

function isTargetGuild(guildId: string | undefined | null): boolean {
    if (!guildId) return false;
    return getSelectedGuildIds().includes(guildId);
}

function resolveGuildId(id: string): string | undefined {
    if (isTargetGuild(id)) return id;
    const channel = ChannelStore.getChannel?.(id);
    if (channel && isTargetGuild(channel.guild_id)) return channel.guild_id;
    return undefined;
}

function muteGuild(guildId: string) {
    NotificationUtils.updateGuildNotificationSettings(guildId, {
        muted: true,
        suppress_everyone: true,
        suppress_roles: true,
    });
}

function markGuildRead(guildId: string) {
    FluxDispatcher.dispatch({
        type: "MARK_GUILD_READ",
        guildId,
    });
}

function applyToSelectedGuilds() {
    for (const guildId of getSelectedGuildIds()) {
        muteGuild(guildId);
        markGuildRead(guildId);
    }
}

function patchMentionCount() {
    if (patched) return;
    patched = true;

    origGetMentionCount = MentionCountStore.getMentionCount;
    MentionCountStore.getMentionCount = function (id: string, ...rest: any[]) {
        if (resolveGuildId(id)) return 0;
        return origGetMentionCount!.call(this, id, ...rest);
    };
}

function unpatchMentionCount() {
    if (!patched) return;
    patched = false;
    if (origGetMentionCount) MentionCountStore.getMentionCount = origGetMentionCount;
}

const boxCSS = `
.silentfolder-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow-y: auto;
    padding: 4px 2px;
}
.silentfolder-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    background-color: var(--background-secondary);
    border: 1px solid var(--interactive-active, #b9bbbe);
    cursor: pointer;
    user-select: none;
}
.silentfolder-row:hover {
    border-color: var(--interactive-hover, #dcddde);
}
.silentfolder-row input {
    cursor: pointer;
}
.silentfolder-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-normal);
}
`;

function FolderSelectComponent() {
    const [folders, setFolders] = useState(getFolders());
    const [selected, setSelected] = useState<string[]>(settings.store.folders ?? []);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <style>{boxCSS}</style>
            <div className="silentfolder-list" onFocus={() => setFolders(getFolders())}>
                {folders.map(folder => {
                    const id = String(folder.folderId);
                    const checked = selected.includes(id);
                    return (
                        <label className="silentfolder-row" key={id}>
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                    const next = checked
                                        ? selected.filter(f => f !== id)
                                        : [...selected, id];
                                    setSelected(next);
                                    settings.store.folders = next;
                                    applyToSelectedGuilds();
                                }}
                            />
                            <span className="silentfolder-label">
                                {folder.folderName || `Folder ${folder.folderId}`}
                            </span>
                        </label>
                    );
                })}
            </div>
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
    folders: {
        type: OptionType.COMPONENT,
        description: "Choose which server folders to mute",
        component: FolderSelectComponent,
    },
});

export default definePlugin({
    name: "SilentFolder",
    description:
        "Mute every server inside the selected Discord server folders.",
    authors: [
        {
            name: "Zot",
            id: 1531412914005606513n,
        },
    ],
    settings,
    start() {
        applyToSelectedGuilds();
        patchMentionCount();
    },
    stop() {
        unpatchMentionCount();
    },
    flux: {
        GUILD_FOLDER_UPDATE() {
            applyToSelectedGuilds();
        },
        GUILD_CREATE() {
            applyToSelectedGuilds();
        },
        GUILD_DELETE() {
            applyToSelectedGuilds();
        },
        MESSAGE_CREATE({ guildId }: { guildId?: string; }) {
            if (isTargetGuild(guildId)) {
                markGuildRead(guildId!);
            }
        },
        CHANNEL_UNREAD_UPDATE() {
            for (const guildId of getSelectedGuildIds()) {
                markGuildRead(guildId);
            }
        },
    },
});
