/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, ComponentDispatch, DraftType, Forms, UploadHandler, UserStore } from "@webpack/common";

import { latexToExpr } from "./latex";
import { calculate, calculateWithSteps, formatResult } from "./parser";
import { canvasToBlob, renderMathToCanvas } from "./renderer";
import { tryConvertUnits } from "./units";

const settings = definePluginSettings({
    showSteps: {
        type: OptionType.BOOLEAN,
        description: "Show step-by-step decomposition of calculations",
        default: false
    },
    latexInput: {
        type: OptionType.BOOLEAN,
        description: "Support LaTeX notation in expressions (e.g. \\frac{a}{b}, \\sqrt{x})",
        default: false
    },
    imageOutput: {
        type: OptionType.BOOLEAN,
        description: "Render calculation result as an image instead of text",
        default: false
    },
    autoCloseBraces: {
        type: OptionType.BOOLEAN,
        description: "Auto-close curly braces when typing { (disabled inside code blocks)",
        default: true
    }
});

function resolveExpr(raw: string): string {
    return settings.store.latexInput ? latexToExpr(raw) : raw;
}

function isInsideCode(textBefore: string): boolean {
    if ((textBefore.split("```").length - 1) % 2 !== 0) return true;
    const withoutBlocks = textBefore.replace(/```/g, "");
    if ((withoutBlocks.split("`").length - 1) % 2 !== 0) return true;
    return false;
}

function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "{" || !settings.store.autoCloseBraces) return;

    const target = e.target as HTMLElement;
    const editor = target.closest?.("[data-slate-editor]");
    if (!editor) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const preRange = document.createRange();
    preRange.setStart(editor, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const textBefore = preRange.toString();

    if (isInsideCode(textBefore)) return;

    e.preventDefault();

    ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", {
        rawText: "{}",
        plainText: "{}"
    });

    setTimeout(() => {
        const s = window.getSelection();
        if (s) (s as any).modify("move", "backward", "character");
    }, 0);
}

const exampleStyle = {
    fontFamily: "var(--font-code)",
    backgroundColor: "var(--background-secondary)",
    borderRadius: "4px",
    padding: "2px 6px",
    fontSize: "0.875rem"
} as const;

export default definePlugin({
    name: "Inline Calculator",
    description: "Evaluate inline {math expressions} in messages.",
    authors: [EquicordDevs.ape],
    tags: ["math", "calculate", "calculator", "latex"],
    settings,

    start() {
        document.addEventListener("keydown", onKeyDown);
    },

    stop() {
        document.removeEventListener("keydown", onKeyDown);
    },

    settingsAboutComponent: () => (
        <>
            <Forms.FormTitle style={{ marginTop: 12 }}>Supported Functions</Forms.FormTitle>
            <Forms.FormText>
                <span style={exampleStyle}>
                    sin cos tan asin acos atan atan2 sinh cosh tanh sqrt cbrt abs ceil floor round trunc sign log log2 log10 ln exp pow min max hypot deg rad
                </span>
            </Forms.FormText>

            <Forms.FormTitle style={{ marginTop: 12 }}>Supported Constants</Forms.FormTitle>
            <Forms.FormText>
                <span style={exampleStyle}>
                    pi e tau phi inf ln2 ln10 sqrt2
                </span>
            </Forms.FormText>
        </>
    ),

    async onBeforeMessageSend(channelId, msg) {
        const maxLen = (UserStore.getCurrentUser().premiumType ?? 0) === 2 ? 4000 : 2000;

        // Collect expressions for potential image rendering
        const exprs: { raw: string; expr: string; result: number; steps?: string; }[] = [];
        let hasMatch = false;

        var replaced = msg.content.replace(/\{([^{}]+)\}/g, (match, rawExpr) => {
            try {
                // Try unit conversion first (e.g. "5 km to miles")
                const conversion = tryConvertUnits(rawExpr);
                if (conversion) {
                    hasMatch = true;
                    return conversion;
                }

                const expr = resolveExpr(rawExpr);
                const result = calculate(expr);
                hasMatch = true;

                if (settings.store.imageOutput) {
                    const steps = settings.store.showSteps ? calculateWithSteps(expr) : undefined;
                    exprs.push({ raw: rawExpr, expr, result, steps });
                    return formatResult(result);
                }

                if (settings.store.showSteps) {
                    return calculateWithSteps(expr);
                }
                return formatResult(result);
            } catch {
                return match;
            }
        });

        if (!hasMatch) return;

        // Image output mode: send text normally, then prompt image upload
        if (settings.store.imageOutput && exprs.length > 0) {
            replaced = msg.content.replace(/\{([^{}]+)\}/g, "");

            const imageLines = exprs.map(e => {
                if (e.steps) return e.steps;
                return `${e.raw} = ${formatResult(e.result)}`;
            });

            const canvas = renderMathToCanvas(
                imageLines.join("\n"),
            );

            const channel = ChannelStore.getChannel(channelId);
            if (channel) {
                // Fire-and-forget: convert to blob then open upload dialog
                canvasToBlob(canvas).then(blob => {
                    const file = new File([blob], "calculation.png", { type: "image/png" });
                    UploadHandler.promptToUpload([file], channel, DraftType.ChannelMessage);
                });
            }

            ComponentDispatch.dispatchToLastSubscribed("CLEAR_TEXT");
            setTimeout(() => {
                ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", {
                    rawText: replaced,
                    plainText: replaced
                }, 50);
            });
            return { cancel: true };
        }

        // Text output mode
        msg.content = replaced;

        // If steps made it too long, fall back to just the result
        if (msg.content.length > maxLen && settings.store.showSteps) {
            msg.content = msg.content.replace(/\{([^{}]+)\}/g, (match, rawExpr) => {
                try {
                    const expr = resolveExpr(rawExpr);
                    return formatResult(calculate(expr));
                } catch {
                    return match;
                }
            });
        }

        if (msg.content.length > maxLen) {
            msg.content = msg.content.slice(0, maxLen);
        }
    },
});
