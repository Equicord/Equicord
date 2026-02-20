/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Accordion, Paragraph, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const ACCORDION_PROPS: PropDef[] = [
    { name: "title", type: "string", required: true, description: "Header title text. Rendered as text-sm/medium." },
    { name: "children", type: "ReactNode", required: true, description: "Content revealed when expanded." },
    { name: "subtitle", type: "string", description: "Optional subtitle below the title. Rendered as text-xs/medium in text-subtle." },
    { name: "icon", type: "ReactNode", description: "Optional icon displayed before the title." },
    { name: "defaultExpanded", type: "boolean", default: "false", description: "Initial expanded state for uncontrolled usage." },
    { name: "isExpanded", type: "boolean", description: "Controlled expanded state. When set, the component becomes controlled." },
    { name: "onExpandedChange", type: "(expanded: boolean) => void", description: "Called when expanded state changes. Works in both controlled and uncontrolled modes." },
    { name: "onOpen", type: "() => void", description: "Called only when the accordion opens, not when it closes." },
    { name: "maxHeight", type: "number | string", description: "Maximum content height when expanded. Numbers are converted to px. Without this, height is based on scrollHeight." },
    { name: "className", type: "string", description: "Additional CSS class name on the root element." },
];

function ControlledDemo() {
    const [controlled, setControlled] = useState(false);

    return (
        <Accordion
            title="Controlled Accordion"
            isExpanded={controlled}
            onExpandedChange={setControlled}
        >
            <Paragraph>This accordion's state is controlled externally.</Paragraph>
        </Accordion>
    );
}

export default function AccordionTab() {
    return (
        <DocPage
            componentName="Accordion"
            overview="Accordion is a collapsible content container with a clickable header. It supports both controlled and uncontrolled modes, optional subtitle and icon, and configurable max height for overflowing content."
            importPath={'import { Accordion } from "../components";'}
            sections={[
                {
                    title: "Basic",
                    description: "Click the header to expand and collapse.",
                    children: (
                        <Accordion title="Click to expand">
                            <Paragraph>This is the accordion content that is revealed when expanded.</Paragraph>
                        </Accordion>
                    ),
                    code: '<Accordion title="Details">\n  <Paragraph>Hidden content here.</Paragraph>\n</Accordion>',
                    relevantProps: ["title", "children"]
                },
                {
                    title: "With Subtitle",
                    description: "A subtitle renders below the title in smaller, subtler text.",
                    children: (
                        <Accordion title="Settings" subtitle="Configure options">
                            <Paragraph>Content with a subtitle in the header.</Paragraph>
                        </Accordion>
                    ),
                    relevantProps: ["subtitle", "icon"]
                },
                {
                    title: "Default Expanded",
                    description: "Starts open on mount using defaultExpanded.",
                    children: (
                        <Accordion title="Already Open" defaultExpanded>
                            <Paragraph>This accordion starts expanded by default.</Paragraph>
                        </Accordion>
                    ),
                    relevantProps: ["defaultExpanded"]
                },
                {
                    title: "Controlled",
                    description: "Use isExpanded and onExpandedChange to manage state externally.",
                    children: <ControlledDemo />,
                    code: '<Accordion title="Settings" isExpanded={open} onExpandedChange={setOpen}>\n  <Paragraph>Controlled content.</Paragraph>\n</Accordion>',
                    relevantProps: ["isExpanded", "onExpandedChange"]
                },
                {
                    title: "With Max Height",
                    description: "Constrains expanded content height. Overflowing content is clipped.",
                    children: (
                        <Accordion title="Limited Height" maxHeight={100}>
                            <Paragraph>Line 1</Paragraph>
                            <Paragraph>Line 2</Paragraph>
                            <Paragraph>Line 3</Paragraph>
                            <Paragraph>Line 4</Paragraph>
                            <Paragraph>Line 5</Paragraph>
                            <Paragraph>Line 6</Paragraph>
                        </Accordion>
                    ),
                    code: '<Accordion title="Advanced" subtitle="Extra options" icon={<GearIcon />} maxHeight={200}>\n  <Paragraph>Scrollable content area.</Paragraph>\n</Accordion>',
                    relevantProps: ["maxHeight"]
                },
            ]}
            props={ACCORDION_PROPS}
        />
    );
}
