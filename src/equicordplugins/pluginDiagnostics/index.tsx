/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Button, openModal } from "@webpack/common";

import { DiagnosticsModal } from "./DiagnosticsModal";
import { sampleHeapMB, scanPlugins } from "./scanner";
import { processSnapshot } from "./scoring";

// Scanner (layer 1) → Processing (layer 2). One synchronous pass, on demand.
function runScan() {
    return processSnapshot(scanPlugins());
}

function openDiagnostics() {
    const initial = runScan();          // single pass at click time
    const heapMB = sampleHeapMB();
    openModal(props => (
        <ErrorBoundary>
            <DiagnosticsModal modalProps={props} initial={initial} heapMB={heapMB} rescan={runScan} />
        </ErrorBoundary>
    ));
    // `initial` is referenced only by the modal closure; released for GC when the modal unmounts.
}

const settings = definePluginSettings({
    open: {
        type: OptionType.COMPONENT,
        component: () => (
            <Button onClick={openDiagnostics}>Scan Diagnostics</Button>
        ),
    },
});

export default definePlugin({
    name: "PluginDiagnostics",
    description: "On-demand, one-shot snapshot of each enabled plugin's footprint (patches, listeners, UI injects) with a computed risk score. Zero cost when idle.",
    authors: [EquicordDevs.LOSTSTR],
    settings,
});
