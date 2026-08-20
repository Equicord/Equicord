import { FluxStore } from "..";

export interface ApplicationStreamingSettingsState {
    soundshareEnabled: boolean;
}

export class ApplicationStreamingSettingsStore extends FluxStore {
    getState(): ApplicationStreamingSettingsState;
}
