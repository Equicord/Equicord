import { FluxStore } from "..";

export class UserProfileSettingsStore extends FluxStore {
    getPendingChanges(guildId?: string): Record<string, any>;
}
