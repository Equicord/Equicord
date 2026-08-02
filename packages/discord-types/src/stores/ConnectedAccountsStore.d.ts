import { FluxStore } from "..";

export interface ConnectedAccount {
    id: string;
    type: string;
    revoked: boolean;
    showActivity: boolean;
}

export class ConnectedAccountsStore extends FluxStore {
    getAccounts(): ConnectedAccount[];
}
