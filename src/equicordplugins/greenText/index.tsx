/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { Parser } from "@webpack/common";

import { equicordDevs } from "../../../scripts/utils";

function makeColorRule(char: string, regex: RegExp, color: string) {
    return {
        order: 9,
        match: (source: string, state: any) => {
            if (state.prevCapture?.[0].slice(-1) !== "\n" && state.prevCapture != null)
                return null;
            return regex.exec(source);
        },
        parse: (capture: string[]) => ({ content: capture[0] }),
        react: (node: any) => <span style={{ color }}>{node.content}</span>,
        requiredFirstCharacters: [char],
    } as any;
}

export default definePlugin({
    name: "greenText",
    description: "Renders imageboard-style colored text (>, <, ^).",
    authors: [equicordDevs.NonsensicalOne],

    start() {
        Parser.defaultRules.greentext = makeColorRule(">", /^>[^\n]*/, "#789922");
        Parser.defaultRules.orangetext = makeColorRule("<", /^<(?!@)[^\n]*/, "#f6750b");
        Parser.defaultRules.bluetext = makeColorRule("^", /^\^[^\n]*/, "#6577E6");

        this._oldParse = Parser.parse;
        Parser.parse = Parser.reactParserFor(Parser.defaultRules);
    },

    stop() {
        delete Parser.defaultRules.greentext;
        delete Parser.defaultRules.orangetext;
        delete Parser.defaultRules.bluetext;
        Parser.parse = this._oldParse;
    }
});
