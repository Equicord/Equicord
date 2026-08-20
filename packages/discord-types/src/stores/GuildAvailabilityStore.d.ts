import { FluxStore } from "..";

export class GuildAvailabilityStore extends FluxStore {
    totalGuilds: number;
    totalUnavailableGuilds: number;
    unavailableGuilds: string[];
    isUnavailable(guildId: string): boolean;
}
