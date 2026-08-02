import { FluxStore } from "..";

export class CollapsedVoiceChannelStore extends FluxStore {
    isCollapsed(channelId: string): boolean;
}
