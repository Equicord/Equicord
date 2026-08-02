import { FluxStore } from "..";

export interface AuthorizedAppToken {
    id: string;
}

export class AuthorizedAppsStore extends FluxStore {
    getNewestTokenForApplication(applicationId: string): AuthorizedAppToken | undefined;
}
