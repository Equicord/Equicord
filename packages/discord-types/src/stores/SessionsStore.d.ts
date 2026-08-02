import { FluxStore } from "..";

export interface Session {
    sessionId: string;
    status: string;
    active: boolean;
    clientInfo: {
        version: number;
        os: string;
        client: string;
    };
}

export class SessionsStore extends FluxStore {
    getSessions(): Record<string, Session>;
}
