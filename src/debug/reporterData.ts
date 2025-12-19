/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * this file is needed to avoid an import of plugins in ./runReporter.ts
 */
import { Patch } from "@utils/types";
import { TypeWebpackSearchHistory, WebpackSearchContext } from "@webpack";

interface EvaledPatch extends Patch {
    id: PropertyKey;
}
interface ErroredPatch extends EvaledPatch {
    oldModule: string,
    newModule: string;
}

export interface FailedWebpackFind {
    method: TypeWebpackSearchHistory;
    filter: string;
    context: WebpackSearchContext;
}

export interface ReporterData {
    failedPatches: {
        foundNoModule: Patch[];
        hadNoEffect: EvaledPatch[];
        undoingPatchGroup: EvaledPatch[];
        erroredPatch: ErroredPatch[];
    };
    failedWebpack: FailedWebpackFind[];
}

export const reporterData: ReporterData = {
    failedPatches: {
        foundNoModule: [],
        hadNoEffect: [],
        undoingPatchGroup: [],
        erroredPatch: []
    },
    failedWebpack: []
};
