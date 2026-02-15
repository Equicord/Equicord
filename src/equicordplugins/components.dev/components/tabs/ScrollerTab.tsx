/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ManaButton, Paragraph, ScrollerAuto, ScrollerNone, ScrollerThin, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const SCROLLER_PROPS: PropDef[] = [
    { name: "children", type: "ReactNode", required: true, description: "Content to render inside the scrollable area." },
    { name: "orientation", type: '"vertical" | "horizontal"', default: '"vertical"', description: "Scroll direction." },
    { name: "paddingFix", type: "boolean", default: "true", description: "Apply padding fix for scroll containers." },
    { name: "fade", type: "boolean", default: "false", description: "Add a fade effect at the edges to indicate more content." },
    { name: "dir", type: '"ltr" | "rtl"', default: '"ltr"', description: "Text direction for horizontal scrolling." },
    { name: "onScroll", type: "(e: UIEvent) => void", description: "Scroll event handler." },
    { name: "className", type: "string", description: "Custom CSS class." },
    { name: "style", type: "CSSProperties", description: "Inline styles." },
];

const SAMPLE_ITEMS = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`);

function ScrollerDemo({ Component, label }: { Component: React.ComponentType<any>; label: string; }) {
    const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
    const [fade, setFade] = useState(true);

    const scrollerStyle = orientation === "vertical"
        ? { height: 200, width: "100%", border: "1px solid var(--background-modifier-accent)", borderRadius: 8 }
        : { height: 60, width: "100%", border: "1px solid var(--background-modifier-accent)", borderRadius: 8 };

    const itemStyle = orientation === "vertical"
        ? { padding: "8px 12px", borderBottom: "1px solid var(--background-modifier-accent)" }
        : { padding: "8px 16px", display: "inline-block", whiteSpace: "nowrap" as const };

    return (
        <div>
            <div className="vc-compfinder-grid" style={{ marginBottom: 8 }}>
                <ManaButton
                    variant="secondary"
                    text={`Orientation: ${orientation}`}
                    onClick={() => setOrientation(o => o === "vertical" ? "horizontal" : "vertical")}
                />
                <ManaButton
                    variant="secondary"
                    text={`Fade: ${fade}`}
                    onClick={() => setFade(f => !f)}
                />
            </div>
            <Component orientation={orientation} fade={fade} style={scrollerStyle}>
                {SAMPLE_ITEMS.map(item => (
                    <div key={item} style={itemStyle}>
                        <Paragraph>{item}</Paragraph>
                    </div>
                ))}
            </Component>
        </div>
    );
}

export default function ScrollerTab() {
    return (
        <DocPage
            componentName="Scroller"
            overview="Discord provides three scroller variants for different scrollbar styles: ScrollerThin (thin scrollbar, most common), ScrollerAuto (standard auto-showing scrollbar), and ScrollerNone (hidden scrollbar, still scrollable). All support vertical/horizontal orientation and edge fade effects."
            importPath={'import { ScrollerThin, ScrollerAuto, ScrollerNone } from "../components";'}
            sections={[
                {
                    title: "ScrollerThin",
                    description: "Thin scrollbar, the most commonly used variant. Ideal for sidebars and lists.",
                    children: <ScrollerDemo Component={ScrollerThin} label="ScrollerThin" />,
                    code: `<ScrollerThin orientation="vertical" fade style={{ height: 200 }}>
  {items.map(item => <div key={item.id}>{item.label}</div>)}
</ScrollerThin>`,
                    relevantProps: ["orientation", "fade"],
                },
                {
                    title: "ScrollerAuto",
                    description: "Standard scrollbar that appears automatically when content overflows.",
                    children: <ScrollerDemo Component={ScrollerAuto} label="ScrollerAuto" />,
                },
                {
                    title: "ScrollerNone",
                    description: "No visible scrollbar. Content is still scrollable via mouse wheel or touch.",
                    children: <ScrollerDemo Component={ScrollerNone} label="ScrollerNone" />,
                },
            ]}
            props={SCROLLER_PROPS}
        />
    );
}
