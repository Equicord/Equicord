import { FluxStore, GuildFolder } from "..";

export class SortedGuildStore extends FluxStore {
    getFlattenedGuildIds(): string[];
    getGuildFolderById(folderId: number): GuildFolder;
    getGuildFolders(): GuildFolder[];
}
