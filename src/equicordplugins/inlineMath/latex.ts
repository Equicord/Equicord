/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Converts LaTeX math notation into our calculator's expression syntax.
// This is a best-effort preprocessor — it handles common LaTeX patterns
// but doesn't aim to be a full LaTeX parser.

const LATEX_REPLACEMENTS: [RegExp, string | ((...args: string[]) => string)][] = [
    // Fractions: \frac{a}{b} → (a)/(b)
    [/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)"],

    // Square root: \sqrt{x} → sqrt(x)
    [/\\sqrt\{([^{}]*)\}/g, "sqrt($1)"],
    // Nth root: \sqrt[n]{x} → (x)^(1/(n))
    [/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, "($2)^(1/($1))"],

    // Powers with braces: x^{n} → x^(n)  (handled after other replacements)
    [/\^{([^{}]*)}/g, "^($1)"],
    // Subscripts (just remove them, they're labels): x_{n} → x
    [/_{([^{}]*)}/g, ""],

    // Trig functions
    [/\\sin/g, "sin"],
    [/\\cos/g, "cos"],
    [/\\tan/g, "tan"],
    [/\\arcsin/g, "asin"],
    [/\\arccos/g, "acos"],
    [/\\arctan/g, "atan"],
    [/\\sinh/g, "sinh"],
    [/\\cosh/g, "cosh"],
    [/\\tanh/g, "tanh"],

    // Logarithms
    [/\\ln/g, "ln"],
    [/\\log/g, "log"],
    [/\\log_2/g, "log2"],
    [/\\log_{2}/g, "log2"],
    [/\\log_10/g, "log10"],
    [/\\log_{10}/g, "log10"],

    // Other functions
    [/\\exp/g, "exp"],
    [/\\abs\{([^{}]*)\}/g, "abs($1)"],
    [/\\left\|([^|]*)\right\|/g, "abs($1)"],
    [/\|([^|]*)\|/g, "abs($1)"],
    [/\\floor\{([^{}]*)\}/g, "floor($1)"],
    [/\\ceil\{([^{}]*)\}/g, "ceil($1)"],
    [/\\max/g, "max"],
    [/\\min/g, "min"],

    // Constants
    [/\\pi/g, "pi"],
    [/\\tau/g, "tau"],
    [/\\phi/g, "phi"],
    [/\\infty/g, "inf"],
    [/\\infinity/g, "inf"],

    // Operators
    [/\\cdot/g, "*"],
    [/\\times/g, "*"],
    [/\\div/g, "/"],
    [/\\pm/g, "+"],
    [/\\mod/g, "%"],

    // Grouping: \left( \right) → ( )
    [/\\left\(/g, "("],
    [/\\right\)/g, ")"],
    [/\\left\[/g, "("],
    [/\\right\]/g, ")"],
    [/\\{/g, "("],
    [/\\}/g, ")"],

    // Remove remaining backslash-space and common formatting
    [/\\ /g, " "],
    [/\\,/g, " "],
    [/\\;/g, " "],
    [/\\!/g, ""],
    [/\\quad/g, " "],
    [/\\qquad/g, " "],
];

export function latexToExpr(latex: string): string {
    let expr = latex.trim();

    // Handle nested \frac and \sqrt by running replacements multiple times
    for (let pass = 0; pass < 5; pass++) {
        const before = expr;
        for (const [pattern, replacement] of LATEX_REPLACEMENTS) {
            if (typeof replacement === "string") {
                expr = expr.replace(pattern, replacement);
            } else {
                expr = expr.replace(pattern, replacement);
            }
        }
        if (expr === before) break;
    }

    // Clean up any remaining braces
    expr = expr.replace(/[{}]/g, "");

    return expr;
}
