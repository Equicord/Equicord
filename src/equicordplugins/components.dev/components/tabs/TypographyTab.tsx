/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CodeColors, FontSizeMap, Paragraph, TextColors, TextSizes, TextWeights } from "..";
import { DocPage, type PropGroup } from "../DocPage";

const PROP_GROUPS: PropGroup[] = [
    {
        title: "Text Colors",
        props: TextColors.map(color => ({
            name: color,
            type: "CSS variable",
            description: `var(--${color})`,
        })),
    },
    {
        title: "Text Sizes",
        props: TextSizes.map(({ name, value, pixels }) => ({
            name,
            type: "font-size",
            description: `${value} (${pixels}).`,
        })),
    },
    {
        title: "Text Weights",
        props: TextWeights.map(({ name, value }) => ({
            name,
            type: "font-weight",
            description: `font-weight: ${value}.`,
        })),
    },
    {
        title: "Code Colors",
        props: CodeColors.map(color => ({
            name: color,
            type: "CSS variable",
            description: `var(--${color})`,
        })),
    },
];

export default function TypographyTab() {
    return (
        <DocPage
            componentName="Typography Reference"
            overview="Typography reference for Discord's design system CSS variables. Shows all available text colors, sizes, weights, and code syntax colors. Use these with the Paragraph, DiscordHeading, and DiscordText components."
            importPath={'import { TextColors, TextSizes, TextWeights, CodeColors, FontSizeMap } from "../components";'}
            sections={[
                {
                    title: "Text Colors",
                    description: "All available text color CSS variables. Use these as the color prop on Paragraph and DiscordText.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            {TextColors.map(color => (
                                <div key={color} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                    <span style={{ color: `var(--${color})`, minWidth: 200 }}>
                                        {color}
                                    </span>
                                    <code style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                        var(--{color})
                                    </code>
                                </div>
                            ))}
                        </div>
                    ),
                    code: '<Paragraph color="text-muted">Muted text</Paragraph>',
                },
                {
                    title: "Text Sizes",
                    description: "Font sizes from xxs (10px) to xxl (32px).",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            {TextSizes.map(({ name, value, pixels }) => (
                                <div key={name} style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                                    <span style={{ fontSize: FontSizeMap[name], minWidth: 200 }}>
                                        {name}
                                    </span>
                                    <code style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                        {value} ({pixels})
                                    </code>
                                </div>
                            ))}
                        </div>
                    ),
                },
                {
                    title: "Text Weights",
                    description: "Font weights from thin (100) to extrabold (800).",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            {TextWeights.map(({ name, value }) => (
                                <div key={name} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                    <span style={{ fontWeight: Number(value), minWidth: 200 }}>
                                        {name}
                                    </span>
                                    <code style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                        font-weight: {value}
                                    </code>
                                </div>
                            ))}
                        </div>
                    ),
                },
                {
                    title: "Code Colors",
                    description: "Syntax highlighting colors for code blocks.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            {CodeColors.map(color => (
                                <div key={color} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                    <span style={{ color: `var(--${color})`, minWidth: 200, fontFamily: "monospace" }}>
                                        {color}
                                    </span>
                                    <code style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                        var(--{color})
                                    </code>
                                </div>
                            ))}
                        </div>
                    ),
                },
                {
                    title: "Usage with Components",
                    description: "These values are used with Paragraph, DiscordHeading, and DiscordText. See those tabs for component-specific documentation.",
                    children: (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <Paragraph color="text-default">text-default: Primary readable text.</Paragraph>
                            <Paragraph color="text-muted">text-muted: Secondary, less prominent text.</Paragraph>
                            <Paragraph color="text-link">text-link: Clickable link text.</Paragraph>
                            <Paragraph color="text-brand">text-brand: Brand-colored text.</Paragraph>
                        </div>
                    ),
                    code: `<Paragraph color="text-muted">Muted text</Paragraph>
<DiscordText variant="text-md/semibold" color="text-brand">Brand text</DiscordText>
<DiscordHeading variant="heading-lg/bold">Bold heading</DiscordHeading>`,
                },
            ]}
            props={PROP_GROUPS}
        />
    );
}
