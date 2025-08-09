/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { Settings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { TidalPlayer } from "@equicordplugins/tidalControls/TidalPlayer";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import { Lyrics } from "./components/lyrics";
import settings from "./settings";


export default definePlugin({
    name: "TidalLyrics",
    authors: [EquicordDevs.vmohammad],
    description: "Adds lyrics to TidalControls",
    dependencies: ["TidalControls"],
    patches: [
        {
            find: "this.isCopiedStreakGodlike",
            replacement: {
                match: /Vencord\.Plugins\.plugins\["TidalControls"\]\.PanelWrapper/,
                replace: "$self.FakePanelWrapper",
            },
            predicate: () => Settings.plugins.TidalControls.enabled,
            noWarn: true,
        },
    ],
    FakePanelWrapper({ VencordOriginal, ...props }) {
        const { LyricsPosition } = settings.use(["LyricsPosition"]);
        return (
            <>
                <ErrorBoundary
                    fallback={() => (
                        <div className="vc-tidal-fallback">
                            <p>Failed to render Tidal Lyrics Modal :(</p>
                            <p>Check the console for errors</p>
                        </div>
                    )}
                >
                    {LyricsPosition === "above" && <Lyrics />}
                    <TidalPlayer />
                    {LyricsPosition === "below" && <Lyrics />}
                </ErrorBoundary>

                <VencordOriginal {...props} />
            </>
        );
    },
    settings,
});
