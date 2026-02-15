/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Card, CardVariants, Paragraph } from "..";
import { DocPage, type PropDef } from "../DocPage";

const CARD_PROPS: PropDef[] = [
    { name: "variant", type: '"primary" | "warning" | "danger" | "success" | "brand"', default: '"primary"', description: "Visual style variant controlling background color." },
    { name: "outline", type: "boolean", default: "false", description: "Renders with a border outline instead of filled background." },
    { name: "defaultPadding", type: "boolean", description: "Adds 1em padding to the card. Defaults to true when no className is provided, false otherwise." },
    { name: "children", type: "ReactNode", description: "Card content." },
    { name: "className", type: "string", description: "Additional CSS class. When set, defaultPadding becomes false unless explicitly overridden." },
    { name: "style", type: "CSSProperties", description: "Inline styles." },
    { name: "...restProps", type: "HTMLDivAttributes", description: "All other standard div attributes are forwarded to the root element." },
];

export default function CardTab() {
    return (
        <DocPage
            componentName="Card"
            overview="Card is a Vencord component that renders a styled container div with variant-based coloring. It supports filled and outline modes, automatic default padding, and all standard div attributes. Useful for grouping content with visual emphasis."
            notices={[
                { type: "info", children: "Card is a Vencord component from @components/Card, not a Discord native component. Its API is stable but may differ from Discord's own card patterns." },
            ]}
            importPath={'import { Card } from "@components/Card";'}
            sections={[
                {
                    title: "Variants",
                    description: "Five visual styles for different content contexts.",
                    code: '<Card variant="primary">\n  <Paragraph>Content here</Paragraph>\n</Card>',
                    relevantProps: ["variant", "children"],
                    children: (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {CardVariants.map(variant => (
                                <Card key={variant} variant={variant}>
                                    <Paragraph style={{ fontWeight: 600, marginBottom: 4 }}>
                                        {variant.charAt(0).toUpperCase() + variant.slice(1)}
                                    </Paragraph>
                                    <Paragraph color="text-muted">
                                        {variant === "primary" ? "General purpose content container." :
                                            variant === "warning" ? "Cautionary or attention-needed messages." :
                                                variant === "danger" ? "Error states or destructive actions." :
                                                    variant === "success" ? "Positive feedback or confirmations." :
                                                        "Branded or highlighted content."}
                                    </Paragraph>
                                </Card>
                            ))}
                        </div>
                    )
                },
                {
                    title: "Outline Mode",
                    description: "Uses a border instead of a filled background.",
                    code: '<Card variant="warning" outline>\n  <Paragraph>Heads up!</Paragraph>\n</Card>',
                    relevantProps: ["outline"],
                    children: (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {CardVariants.map(variant => (
                                <Card key={variant} variant={variant} outline>
                                    <Paragraph>{variant} outline</Paragraph>
                                </Card>
                            ))}
                        </div>
                    )
                },
                {
                    title: "Padding Control",
                    description: "Cards get 1em padding by default when no className is set. You can override this behavior explicitly.",
                    code: '<Card variant="brand" className={myClass} defaultPadding>\n  <Paragraph>Keeps padding despite custom className</Paragraph>\n</Card>',
                    relevantProps: ["defaultPadding", "className"],
                    children: (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <Card defaultPadding>
                                <Paragraph>defaultPadding=true</Paragraph>
                            </Card>
                            <Card defaultPadding={false}>
                                <Paragraph style={{ padding: 8 }}>defaultPadding=false (content adds own padding)</Paragraph>
                            </Card>
                        </div>
                    )
                },
                {
                    title: "Nested Cards",
                    description: "Cards can nest for complex layouts.",
                    children: (
                        <Card variant="primary">
                            <Paragraph style={{ fontWeight: 600, marginBottom: 8 }}>Outer Card</Paragraph>
                            <Card variant="warning" style={{ marginBottom: 8 }}>
                                <Paragraph>Nested warning card</Paragraph>
                            </Card>
                            <Card variant="danger">
                                <Paragraph>Nested danger card</Paragraph>
                            </Card>
                        </Card>
                    )
                },
                {
                    title: "Custom Styling",
                    description: "Cards accept custom styles and all div attributes.",
                    relevantProps: ["style"],
                    children: (
                        <Card
                            variant="primary"
                            style={{ borderLeft: "4px solid var(--text-brand)", borderRadius: 4 }}
                        >
                            <Paragraph>Card with custom border accent</Paragraph>
                        </Card>
                    )
                },
            ]}
            props={CARD_PROPS}
        />
    );
}
