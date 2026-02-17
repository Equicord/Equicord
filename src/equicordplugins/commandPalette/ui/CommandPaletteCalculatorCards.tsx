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
    const leftSecondary = result.kind === "number" || result.kind === "unit" ? "Input" : today;

    return (
        <section className="vc-command-palette-calculator">
            <h3 className="vc-command-palette-calculator-title">Calculator</h3>
            <div className="vc-command-palette-calculator-cards">
                <div className="vc-command-palette-calculator-card vc-command-palette-calculator-card-left">
                    <AutoFitLine text={result.displayInput} className="vc-command-palette-calculator-primary" maxSize={34} minSize={14} />
                    <div className="vc-command-palette-calculator-secondary">{leftSecondary}</div>
                </div>
                <div className="vc-command-palette-calculator-arrow">→</div>
                <div className="vc-command-palette-calculator-card vc-command-palette-calculator-card-right">
                    <AutoFitLine text={result.displayAnswer} className="vc-command-palette-calculator-primary" maxSize={34} minSize={14} />
                    <div className="vc-command-palette-calculator-secondary">{result.secondaryText ?? "Answer"}</div>
                </div>
            </div>
        </section>
    );
}
