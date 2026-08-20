import { FluxStore } from "..";

export interface ChannelMemberGroup {
    count: number;
    id: string;
}

export interface ChannelMemberProps {
    groups: ChannelMemberGroup[];
}

export class ChannelMemberStore extends FluxStore {
    getProps(guildId?: string, channelId?: string): ChannelMemberProps;
}
