import { ConnectedAccount, FluxStore } from "..";

export class ConnectedAccountsStore extends FluxStore {
    getAccounts(): ConnectedAccount[];
}
