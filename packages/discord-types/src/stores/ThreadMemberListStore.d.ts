import { FluxStore } from "..";

export interface ThreadMemberListSection {
    sectionId: string;
    userIds: string[];
}

export class ThreadMemberListStore extends FluxStore {
    getMemberListSections(channelId?: string): Record<string, ThreadMemberListSection>;
}
