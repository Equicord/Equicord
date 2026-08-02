import { FluxStore } from "..";

export interface GuildFolder {
    folderId: number | null;
    folderName: string | null;
    folderColor: number | null;
    guildIds: string[];
    expanded?: boolean;
}

export class SortedGuildStore extends FluxStore {
    getFlattenedGuildIds(): string[];
    getGuildFolderById(folderId: number): GuildFolder;
    getGuildFolders(): GuildFolder[];
}
