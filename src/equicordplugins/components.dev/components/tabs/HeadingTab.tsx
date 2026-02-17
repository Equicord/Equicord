/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DiscordHeading, DiscordText, HeadingVariants, TextColors, TextVariants } from "..";
import { DocPage, type PropDef, type PropGroup } from "../DocPage";

const HEADING_PROPS: PropDef[] = [
    { name: "variant", type: "HeadingVariant", required: true, description: 'Heading size and weight, e.g. "heading-xl/bold", "heading-sm/medium".' },
    { name: "color", type: "TextColor", description: "Text color name from Discord's color system." },
    { name: "className", type: "string", description: "Custom CSS class." },
    { name: "style", type: "CSSProperties", description: "Inline styles." },
    { name: "children", type: "ReactNode", description: "Heading content." },
];

const TEXT_PROPS: PropDef[] = [
    { name: "variant", type: "TextVariant", required: true, description: 'Text size and weight, e.g. "text-md/medium", "text-sm/normal".' },
    { name: "color", type: "TextColor", description: "Text color name from Discord's color system." },
    { name: "tag", type: "string", default: '"div"', description: "HTML tag to render (div, span, p, etc.)." },
    { name: "selectable", type: "boolean", description: "Allow text selection." },
    { name: "lineClamp", type: "number", description: "Number of lines before truncation with ellipsis." },
    { name: "tabularNumbers", type: "boolean", description: "Use tabular (monospace) number spacing for aligned columns." },
    { name: "scaleFontToUserSetting", type: "boolean", description: "Scale font size based on user's accessibility settings." },
    { name: "className", type: "string", description: "Custom CSS class." },
    { name: "style", type: "CSSProperties", description: "Inline styles." },
    { name: "children", type: "ReactNode", description: "Text content." },
];

const PROP_GROUPS: PropGroup[] = [
    { title: "DiscordHeading", props: HEADING_PROPS },
    { title: "DiscordText", props: TEXT_PROPS },
];

export default function HeadingTab() {
    return (
        <DocPage
            componentName="DiscordHeading"
            overview="Discord's typography system uses two components: DiscordHeading for headings (xxl through sm) and DiscordText for body text (xxl through xs). Both support multiple weight variants and Discord's color system."
            importPath={'import { DiscordHeading, DiscordText, HeadingVariants, TextVariants, TextColors } from "../components";'}
            sections={[
                {
                    title: "Heading Variants",
                    description: "All heading size/weight combinations from xxl to sm.",
                    children: (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {HeadingVariants.map(variant => (
                                <DiscordHeading key={variant} variant={variant}>
                                    {variant}
                                </DiscordHeading>
                            ))}
                        </div>
                    ),
                    code: '<DiscordHeading variant="heading-xl/bold">Title</DiscordHeading>',
                    relevantProps: ["variant"],
                },
                {
                    title: "Text Variants",
                    description: "All text size/weight combinations from xxl to xs.",
                    children: (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {TextVariants.map(variant => (
                                <DiscordText key={variant} variant={variant}>
                                    {variant}
                                </DiscordText>
                            ))}
                        </div>
                    ),
                    code: '<DiscordText variant="text-md/medium">Body text</DiscordText>',
                },
                {
                    title: "Text Colors",
                    description: "All available color values for the color prop.",
                    children: (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {TextColors.map(color => (
                                <DiscordText key={color} variant="text-md/medium" color={color}>
                                    {color}
                                </DiscordText>
                            ))}
                        </div>
                    ),
                    code: '<DiscordText variant="text-md/medium" color="text-brand">Branded</DiscordText>',
                    relevantProps: ["color"],
                },
                {
                    title: "Line Clamp",
                    description: "Truncate text after a specified number of lines.",
                    children: (
                        <div style={{ maxWidth: 300 }}>
                            <DiscordText variant="text-md/normal" lineClamp={2}>
                                This is a long paragraph of text that will be clamped to two lines maximum.
                                Any content beyond the second line will be hidden and replaced with an ellipsis.
                                This demonstrates the lineClamp prop in action.
                            </DiscordText>
                        </div>
                    ),
                    code: '<DiscordText variant="text-md/normal" lineClamp={2}>\n  Long text here...\n</DiscordText>',
                    relevantProps: ["lineClamp"],
                },
                {
                    title: "Tabular Numbers",
                    description: "Monospaced number spacing for aligned numeric columns.",
                    children: (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <DiscordText variant="text-md/medium" tabularNumbers>1,234,567</DiscordText>
                            <DiscordText variant="text-md/medium" tabularNumbers>89,012</DiscordText>
                            <DiscordText variant="text-md/medium" tabularNumbers>345</DiscordText>
                        </div>
                    ),
                    relevantProps: ["tabularNumbers"],
                },
            ]}
            props={PROP_GROUPS}
        />
    );
}
