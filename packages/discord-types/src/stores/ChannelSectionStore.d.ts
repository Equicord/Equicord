import { FluxStore } from "..";

export class ChannelSectionStore extends FluxStore {
    getGuildSidebarState(guildId?: string): unknown;
    getSidebarState(channelId?: string): unknown;
}
