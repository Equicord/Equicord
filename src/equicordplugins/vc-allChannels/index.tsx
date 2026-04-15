import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin, { OptionType } from "@utils/types";

import { AllChannelsButton } from "./components/AllChannelsButton";
import { SettingsPanel } from "./components/SettingsPanel";

let isAllChannelsViewOpen = false;

export function setAllChannelsViewOpen(open: boolean) {
    isAllChannelsViewOpen = open;
}

export const settings = definePluginSettings({
    trackEdits: {
        description: "Show message edit history (before → after) in the feed",
        type: OptionType.BOOLEAN,
        default: true,
    }
});

export default definePlugin({
    name: "AllChannels",
    description: "Live message feed that aggregates messages from all or selected channels across your servers فوضى",
    authors:[Devs.rz30],
    dependencies: ["ServerListAPI"],
    settings,

    renderAllChannelsButton: ErrorBoundary.wrap(AllChannelsButton, { noop: true }),

    start() {
        addServerListElement(ServerListRenderPosition.Above, this.renderAllChannelsButton);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, this.renderAllChannelsButton);
        isAllChannelsViewOpen = false;
    },

    settingsAboutComponent: SettingsPanel
});
