/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ManaCheckbox, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";
import { EquicordIcon } from "../icons/EquicordIcon";

const CHECKBOX_PROPS: PropDef[] = [
    { name: "checked", type: "boolean", required: true, description: "Current checked state." },
    { name: "onChange", type: "(checked: boolean) => void", description: "Called when the checkbox is toggled." },
    { name: "label", type: "string", description: "Label text displayed next to the checkbox." },
    { name: "description", type: "string", description: "Description text below the label." },
    { name: "labelType", type: '"primary" | "secondary"', default: '"primary"', description: "Label text styling. Primary uses normal weight, secondary uses muted color." },
    { name: "leadingIcon", type: "ComponentType<any>", description: "Icon component displayed before the checkbox." },
    { name: "usageVariant", type: '"single" | "indicator"', default: '"single"', internal: true, description: "Visual style. Single has full padding and spacing, indicator is compact." },
    { name: "disabled", type: "boolean", default: "false", description: "Disables the checkbox interaction." },
    { name: "displayOnly", type: "boolean", internal: true, description: "Renders the checkbox in a display-only state without interaction." },
    { name: "value", type: "string | number", description: "Value identifier used when inside a CheckboxGroup." },
    { name: "labeledBy", type: "string", internal: true, description: "ID of an external element that labels this checkbox for accessibility." },
];

function BasicDemo() {
    const [checked, setChecked] = useState(true);
    const [unchecked, setUnchecked] = useState(false);

    return (
        <div className="vc-compfinder-grid-vertical">
            <ManaCheckbox label="Checked" checked={checked} onChange={setChecked} />
            <ManaCheckbox label="Unchecked" checked={unchecked} onChange={setUnchecked} />
        </div>
    );
}

function DescriptionDemo() {
    const [checked, setChecked] = useState(true);

    return (
        <ManaCheckbox
            label="Option with description"
            description="This is a helpful description for the option."
            checked={checked}
            onChange={setChecked}
        />
    );
}

function LabelTypesDemo() {
    const [primary, setPrimary] = useState(true);
    const [secondary, setSecondary] = useState(false);

    return (
        <div className="vc-compfinder-grid-vertical">
            <ManaCheckbox label="Primary label (default)" labelType="primary" checked={primary} onChange={setPrimary} />
            <ManaCheckbox label="Secondary label" labelType="secondary" checked={secondary} onChange={setSecondary} />
        </div>
    );
}

function IconDemo() {
    const [checked, setChecked] = useState(true);

    return (
        <ManaCheckbox
            label="With icon"
            description="This checkbox has a leading icon."
            leadingIcon={EquicordIcon}
            checked={checked}
            onChange={setChecked}
        />
    );
}

function UsageVariantsDemo() {
    const [single, setSingle] = useState(true);
    const [indicator, setIndicator] = useState(false);

    return (
        <div className="vc-compfinder-grid-vertical">
            <ManaCheckbox label="Single (default)" usageVariant="single" checked={single} onChange={setSingle} />
            <ManaCheckbox label="Indicator" usageVariant="indicator" checked={indicator} onChange={setIndicator} />
        </div>
    );
}

export default function CheckboxTab() {
    return (
        <DocPage
            componentName="ManaCheckbox"
            overview="ManaCheckbox is Discord's checkbox component with label, description, icon support, and two visual variants. Supports controlled state, disabled and display-only modes, and integrates with CheckboxGroup for multi-select patterns."
            notices={[
                { type: "info", children: "ManaCheckbox is a controlled component. The checked prop must always be provided, and you must update it via onChange to reflect the new state." },
            ]}
            importPath={'import { ManaCheckbox } from "../components";'}
            sections={[
                {
                    title: "Basic",
                    description: "Toggle checkboxes on and off.",
                    children: <BasicDemo />,
                    code: '<ManaCheckbox label="Enable feature" checked={enabled} onChange={setEnabled} />',
                    relevantProps: ["checked", "onChange", "label"],
                },
                {
                    title: "With Description",
                    description: "A description renders below the label in smaller text.",
                    children: <DescriptionDemo />,
                    code: '<ManaCheckbox\n  label="Notifications"\n  description="Receive email notifications for new messages."\n  checked={checked}\n  onChange={setChecked}\n/>',
                    relevantProps: ["description"],
                },
                {
                    title: "Label Types",
                    description: "Primary uses normal text styling, secondary uses a muted, lighter appearance.",
                    children: <LabelTypesDemo />,
                    relevantProps: ["labelType"],
                },
                {
                    title: "With Leading Icon",
                    description: "An icon component displayed before the checkbox indicator.",
                    children: <IconDemo />,
                    code: '<ManaCheckbox\n  label="With icon"\n  leadingIcon={BellIcon}\n  checked={checked}\n  onChange={setChecked}\n/>',
                    relevantProps: ["leadingIcon"],
                },
                {
                    title: "States",
                    description: "Disabled prevents interaction. Display only renders without any interactive behavior.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            <ManaCheckbox label="Disabled (checked)" checked={true} disabled />
                            <ManaCheckbox label="Disabled (unchecked)" checked={false} disabled />
                            <ManaCheckbox label="Display only" checked={true} displayOnly />
                        </div>
                    ),
                    relevantProps: ["disabled", "displayOnly"],
                },
                {
                    title: "Usage Variants",
                    description: "Single has full padding and spacing for standalone use. Indicator is compact for inline contexts.",
                    children: <UsageVariantsDemo />,
                    relevantProps: ["usageVariant"],
                },
            ]}
            props={CHECKBOX_PROPS}
        />
    );
}
