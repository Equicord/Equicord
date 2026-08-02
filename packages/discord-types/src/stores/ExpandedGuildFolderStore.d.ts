import { FluxStore } from "..";

export class ExpandedGuildFolderStore extends FluxStore {
    getExpandedFolders(): Set<number>;
    isFolderExpanded(folderId: number): boolean;
}
