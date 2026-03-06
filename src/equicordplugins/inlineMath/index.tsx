/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, ComponentDispatch, DraftType, Forms, PermissionsBits, PermissionStore, showToast, Toasts, UploadHandler, UserStore } from "@webpack/common";

import { latexToExpr } from "./latex";
import { createEvaluationState, evaluateExpressionWithOutputs } from "./parser";
import { canvasToBlob, renderMathToCanvas } from "./renderer";
import { tryConvertUnits } from "./units";

const settings = definePluginSettings({
    showSteps: {
        type: OptionType.BOOLEAN,
        description: "Show step-by-step decomposition of calculations.",
        default: false
    },
    latexInput: {
        type: OptionType.BOOLEAN,
        description: "Support LaTeX notation in expressions (e.g. \\frac{a}{b}, \\sqrt{x}).",
        default: false
    },
    imageOutput: {
        type: OptionType.BOOLEAN,
        description: "Render calculation result as an image instead of text.",
        default: false
    },
    textColor: {
        type: OptionType.STRING,
        description: "Text color for rendered images.",
        default: "#e0e0e0"
    },
    operatorColor: {
        type: OptionType.STRING,
        description: "Operator color for rendered images.",
        default: "#7289da"
    },
    equalsColor: {
        type: OptionType.STRING,
        description: "Equals sign color for rendered images.",
        default: "#57f287"
    }
});

function resolveExpr(raw: string): string {
    return settings.store.latexInput ? latexToExpr(raw) : raw;
}

function canUploadInChannel(channelId: string) {
    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return null;
    return channel.isPrivate() || PermissionStore.can(PermissionsBits.ATTACH_FILES, channel) ? channel : null;
}

const exampleStyle = {
    fontFamily: "var(--font-code)",
    backgroundColor: "var(--background-secondary)",
    borderRadius: "4px",
    padding: "2px 6px",
    fontSize: "0.875rem"
} as const;

export default definePlugin({
    name: "InlineMath",
    description: "Evaluate inline {math expressions} in messages.",
    authors: [EquicordDevs.ape],
    tags: ["math", "calculate", "calculator", "latex"],
    settings,

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
        const evalState = createEvaluationState();

        // Collect expressions for potential image rendering
        const exprs: { raw: string; detailed?: string; simple: string; }[] = [];
        const matches = Array.from(msg.content.matchAll(/\{([^{}]+)\}/g));
        if (matches.length === 0) return;

        let hasMatch = false;
        let lastIndex = 0;
        let replaced = "";
        let simpleReplaced = "";
        let imageReplaced = "";

        for (const match of matches) {
            const fullMatch = match[0];
            const rawExpr = match[1];
            const matchIndex = match.index ?? 0;
            const plainText = msg.content.slice(lastIndex, matchIndex);

            replaced += plainText;
            simpleReplaced += plainText;
            imageReplaced += plainText;

            let detailedReplacement = fullMatch;
            let simpleReplacement = fullMatch;

            try {
                // Try unit conversion first (e.g. "5 km to miles")
                const conversion = tryConvertUnits(rawExpr);
                if (conversion) {
                    hasMatch = true;
                    detailedReplacement = conversion;
                    simpleReplacement = conversion;
                } else {
                    const expr = resolveExpr(rawExpr);
                    const { statementKind, simpleText, detailedText } = evaluateExpressionWithOutputs(expr, evalState);
                    hasMatch = true;

                    if (statementKind === "function_def") {
                        detailedReplacement = "";
                        simpleReplacement = "";
                    } else if (settings.store.imageOutput) {
                        exprs.push({
                            raw: rawExpr,
                            detailed: settings.store.showSteps ? detailedText : undefined,
                            simple: simpleText,
                        });
                        detailedReplacement = simpleText;
                        simpleReplacement = simpleText;
                    } else {
                        detailedReplacement = settings.store.showSteps ? detailedText : simpleText;
                        simpleReplacement = simpleText;
                    }
                }
            } catch {
                detailedReplacement = fullMatch;
                simpleReplacement = fullMatch;
            }

            replaced += detailedReplacement;
            simpleReplaced += simpleReplacement;
            lastIndex = matchIndex + fullMatch.length;
        }

        if (!hasMatch) return;

        replaced += msg.content.slice(lastIndex);
        simpleReplaced += msg.content.slice(lastIndex);
        imageReplaced += msg.content.slice(lastIndex);

        // Image output mode: send text normally, then prompt image upload
        const channel = canUploadInChannel(channelId);
        if (settings.store.imageOutput && exprs.length > 0 && channel) {
            replaced = imageReplaced;

            const imageLines = exprs.map(e => {
                if (e.detailed) return e.detailed.replace(/\s*;\s*/g, "\n");
                return `${e.raw} = ${e.simple}`.replace(/\s*;\s*/g, "\n");
            });

            const canvas = renderMathToCanvas(
                imageLines.join("\n"),
                undefined,
                {
                    text: settings.store.textColor,
                    operator: settings.store.operatorColor,
                    equals: settings.store.equalsColor
                }
            );

            canvasToBlob(canvas).then(blob => {
                const file = new File([blob], "calculation.png", { type: "image/png" });
                UploadHandler.promptToUpload([file], channel, DraftType.ChannelMessage);
            }).catch(() => {
                showToast("[InlineMath] Failed to render calculation image.", Toasts.Type.FAILURE);
            });

            ComponentDispatch.dispatchToLastSubscribed("CLEAR_TEXT");
            setTimeout(() => {
                ComponentDispatch.dispatchToLastSubscribed("INSERT_TEXT", {
                    rawText: replaced,
                    plainText: replaced
                });
            }, 50);

            return { cancel: true };
        }

        // Text output mode
        msg.content = replaced;

        // If steps made it too long, fall back to just the result
        if (msg.content.length > maxLen && settings.store.showSteps) {
            msg.content = simpleReplaced;
        }

        if (msg.content.length > maxLen) {
            msg.content = msg.content.slice(0, maxLen);
        }
    },
});
