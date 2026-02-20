/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useRef, useState } from "@webpack/common";

import type { CalculatorResult } from "../calculator";

interface CommandPaletteCalculatorCardsProps {
    result: CalculatorResult;
}

interface AutoFitLineProps {
    text: string;
    className: string;
    maxSize: number;
    minSize: number;
}

const SUPERSCRIPT_MAP: Record<string, string> = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
    "+": "⁺",
    "-": "⁻",
    "(": "⁽",
    ")": "⁾"
};

function toSuperscript(value: string): string {
    return Array.from(value).map(char => SUPERSCRIPT_MAP[char] ?? char).join("");
}

function formatMathDisplayInput(value: string): string {
    return value
        .replace(/\*\*/g, "^")
        .replace(/\^([+-]?\d+)/g, (_, exponent: string) => toSuperscript(exponent));
}

function AutoFitLine({ text, className, maxSize, minSize }: AutoFitLineProps) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [fontSize, setFontSize] = useState(maxSize);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        let frame = 0;
        const fit = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                let next = maxSize;
                node.style.fontSize = `${next}px`;

                while (next > minSize && node.scrollWidth > node.clientWidth) {
                    next -= 1;
                    node.style.fontSize = `${next}px`;
                }

                setFontSize(next);
            });
        };

        fit();

        const observer = typeof ResizeObserver !== "undefined"
            ? new ResizeObserver(fit)
            : null;
        observer?.observe(node);
        window.addEventListener("resize", fit);

        return () => {
            cancelAnimationFrame(frame);
            observer?.disconnect();
            window.removeEventListener("resize", fit);
        };
    }, [maxSize, minSize, text]);

    return (
        <div ref={ref} className={className} style={{ fontSize }}>
            {text}
        </div>
    );
}

export function CommandPaletteCalculatorCards({ result }: CommandPaletteCalculatorCardsProps) {
    const today = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
    }).format(new Date());
    const leftLabel = result.tertiaryText
        ?? (result.kind === "number" ? "Sum" : result.kind === "unit" ? "Input" : today);
    const rightLabel = result.secondaryText ?? "Answer";
    const displayInput = result.kind === "number"
        ? formatMathDisplayInput(result.displayInput)
        : result.displayInput;

    return (
        <section className="vc-command-palette-calculator">
            <h3 className="vc-command-palette-calculator-title">Calculator</h3>
            <div className="vc-command-palette-calculator-card">
                <div className="vc-command-palette-calculator-section vc-command-palette-calculator-section-left">
                    <AutoFitLine text={displayInput} className="vc-command-palette-calculator-value" maxSize={44} minSize={18} />
                    <span className="vc-command-palette-calculator-label">{leftLabel}</span>
                </div>
                <div className="vc-command-palette-calculator-arrow">→</div>
                <div className="vc-command-palette-calculator-section vc-command-palette-calculator-section-right">
                    <AutoFitLine text={result.displayAnswer} className="vc-command-palette-calculator-value" maxSize={44} minSize={18} />
                    <span className="vc-command-palette-calculator-label">{rightLabel}</span>
                </div>
            </div>
        </section>
    );
}
