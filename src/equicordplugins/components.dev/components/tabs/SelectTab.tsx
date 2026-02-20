/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ManaSelect, ManaSelectOption, useState } from "..";
import { DocPage, type PropDef, type PropGroup } from "../DocPage";

const SELECT_PROPS: PropDef[] = [
    { name: "options", type: "ManaSelectOption[]", required: true, description: "Array of selectable options." },
    { name: "value", type: "string | string[] | null", description: "Currently selected value(s)." },
    { name: "onSelectionChange", type: "(value: string | string[] | null) => void", description: "Called when the selection changes. Note: NOT onChange." },
    { name: "selectionMode", type: '"single" | "multiple"', description: "Single or multi-select mode." },
    { name: "placeholder", type: "string", description: "Placeholder text when nothing is selected." },
    { name: "disabled", type: "boolean", default: "false", description: "Disable the select." },
    { name: "readOnly", type: "boolean", description: "Make the select read-only." },
    { name: "clearable", type: "boolean", description: "Allow clearing the selection." },
    { name: "fullWidth", type: "boolean", description: "Expand to fill available width." },
    { name: "autoFocus", type: "boolean", description: "Focus on mount." },
    { name: "closeOnSelect", type: "boolean", description: "Close the dropdown after selecting." },
    { name: "shouldFocusWrap", type: "boolean", description: "Wrap keyboard focus at list ends." },
    { name: "maxOptionsVisible", type: "number", description: "Maximum options visible before scrolling." },
    { name: "wrapTags", type: "boolean", description: "Wrap selected tags to multiple lines in multi-select." },
    { name: "formatOption", type: "(option: ManaSelectOption) => ReactNode", description: "Custom render for each option." },
    { name: "label", type: "string", description: "Label text for the select." },
    { name: "required", type: "boolean", description: "Mark as required for form validation." },
];

const OPTION_PROPS: PropDef[] = [
    { name: "id", type: "string", required: true, description: "Unique option identifier." },
    { name: "value", type: "string", required: true, description: "Option value." },
    { name: "label", type: "string", required: true, description: "Display label." },
];

const PROP_GROUPS: PropGroup[] = [
    { title: "ManaSelect", props: SELECT_PROPS },
    { title: "ManaSelectOption", props: OPTION_PROPS },
];

const SAMPLE_OPTIONS: ManaSelectOption[] = [
    { id: "1", value: "option1", label: "Option 1" },
    { id: "2", value: "option2", label: "Option 2" },
    { id: "3", value: "option3", label: "Option 3" },
    { id: "4", value: "option4", label: "Option 4" },
];

function SingleDemo() {
    const [value, setValue] = useState<string>("option1");
    return (
        <ManaSelect
            options={SAMPLE_OPTIONS}
            value={value}
            onSelectionChange={v => setValue(v as string)}
            selectionMode="single"
        />
    );
}

function MultiDemo() {
    const [value, setValue] = useState<string[]>(["option1", "option2"]);
    return (
        <ManaSelect
            options={SAMPLE_OPTIONS}
            value={value}
            onSelectionChange={v => setValue(v as string[])}
            selectionMode="multiple"
        />
    );
}

function PlaceholderDemo() {
    const [value, setValue] = useState<string>("");
    return (
        <ManaSelect
            options={SAMPLE_OPTIONS}
            value={value}
            onSelectionChange={v => setValue(v as string)}
            placeholder="Select an option..."
        />
    );
}

function ClearableDemo() {
    const [value, setValue] = useState<string>("option1");
    return (
        <ManaSelect
            options={SAMPLE_OPTIONS}
            value={value}
            onSelectionChange={v => setValue(v as string)}
            clearable
        />
    );
}

export default function SelectTab() {
    return (
        <DocPage
            componentName="ManaSelect"
            overview="ManaSelect is Discord's dropdown select component supporting single and multi-select modes. Important: uses onSelectionChange (not onChange) for the selection callback. Supports clearable selection, placeholder text, full width, and custom option rendering."
            notices={[
                { type: "warn", children: "ManaSelect uses onSelectionChange, not onChange. This is a common source of confusion since most other Discord form components use onChange." },
            ]}
            importPath={'import { ManaSelect, ManaSelectOption } from "../components";'}
            sections={[
                {
                    title: "Single Selection",
                    description: "Default single-select dropdown.",
                    children: <SingleDemo />,
                    code: `<ManaSelect
  options={options}
  value={value}
  onSelectionChange={v => setValue(v as string)}
  selectionMode="single"
/>`,
                    relevantProps: ["options", "value", "onSelectionChange", "selectionMode"],
                },
                {
                    title: "Multiple Selection",
                    description: "Multi-select with tag pills for each selected option.",
                    children: <MultiDemo />,
                },
                {
                    title: "With Placeholder",
                    description: "Shows placeholder text when no option is selected.",
                    children: <PlaceholderDemo />,
                    relevantProps: ["placeholder"],
                },
                {
                    title: "Clearable",
                    description: "Adds a clear button to reset the selection.",
                    children: <ClearableDemo />,
                    relevantProps: ["clearable"],
                },
                {
                    title: "Full Width",
                    description: "Expands to fill the available width.",
                    children: (
                        <ManaSelect options={SAMPLE_OPTIONS} value="option1" fullWidth />
                    ),
                    relevantProps: ["fullWidth"],
                },
                {
                    title: "Disabled",
                    description: "Non-interactive disabled state.",
                    children: (
                        <ManaSelect options={SAMPLE_OPTIONS} value="option2" disabled />
                    ),
                    relevantProps: ["disabled"],
                },
            ]}
            props={PROP_GROUPS}
        />
    );
}
