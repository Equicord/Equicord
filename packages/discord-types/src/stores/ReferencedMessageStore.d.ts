import { FluxStore, Message } from "..";

export class ReferencedMessageStore extends FluxStore {
    getMessageByReference(reference: Message["messageReference"]): { message: Message; } | undefined;
}
