import { FluxStore } from "..";
import { StandingState } from "../../enums";

export interface AccountStanding {
    state: StandingState;
}

export class SafetyHubStore extends FluxStore {
    getAccountStanding(): AccountStanding;
    isInitialized(): boolean;
}
