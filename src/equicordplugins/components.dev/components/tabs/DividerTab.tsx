/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Divider, Paragraph } from "..";
import { DocPage, type PropDef } from "../DocPage";

const DIVIDER_PROPS: PropDef[] = [
    { name: "className", type: "string", description: "Custom CSS class for the divider." },
    { name: "style", type: "CSSProperties", description: "Inline styles applied to the hr element." },
    { name: "...restProps", type: "HTMLAttributes<hr>", description: "Any other standard hr element attributes." },
];

export default function DividerTab() {
    return (
        <DocPage
            componentName="Divider"
            overview="Divider is a simple horizontal rule component from Vencord's @components/Divider. It renders an hr element with the vc-divider class and accepts standard HTML attributes."
            importPath={'import { Divider } from "../components";'}
            sections={[
                {
                    title: "Basic Divider",
                    description: "A simple horizontal rule separating content.",
                    children: (
                        <div style={{ padding: "8px 0" }}>
                            <Paragraph>Content above divider</Paragraph>
                            <Divider />
                            <Paragraph>Content below divider</Paragraph>
                        </div>
                    ),
                    code: "<Divider />",
                },
                {
                    title: "Custom Spacing",
                    description: "Control the spacing around dividers using inline styles.",
                    children: (
                        <div style={{ padding: "8px 0" }}>
                            <Paragraph>Tight spacing (8px)</Paragraph>
                            <Divider style={{ margin: "8px 0" }} />
                            <Paragraph>Medium spacing (16px)</Paragraph>
                            <Divider style={{ margin: "16px 0" }} />
                            <Paragraph>Large spacing (24px)</Paragraph>
                            <Divider style={{ margin: "24px 0" }} />
                            <Paragraph>End</Paragraph>
                        </div>
                    ),
                    code: '<Divider style={{ margin: "16px 0" }} />',
                    relevantProps: ["style"],
                },
            ]}
            props={DIVIDER_PROPS}
        />
    );
}
