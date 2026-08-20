import { FluxStore } from "..";

export interface AuthSession {
    id_hash: string;
}

export class AuthSessionsStore extends FluxStore {
    getSessions(): AuthSession[];
}
