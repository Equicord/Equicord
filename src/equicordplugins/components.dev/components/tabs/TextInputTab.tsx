/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ManaTextInput, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const TEXTINPUT_PROPS: PropDef[] = [
    { name: "value", type: "string", description: "Current input value (controlled)." },
    { name: "defaultValue", type: "string", description: "Initial value (uncontrolled)." },
    { name: "onChange", type: "(value: string, name?: string) => void", description: "Called when the input value changes." },
    { name: "placeholder", type: "string", description: "Placeholder text when empty." },
    { name: "name", type: "string", description: "HTML name attribute for form submission." },
    { name: "type", type: '"text" | "password" | "email" | "number" | "search" | "tel" | "url"', default: '"text"', description: "Input type." },
    { name: "size", type: '"sm" | "md"', default: '"md"', description: "Input size variant." },
    { name: "clearable", type: "boolean | { show: boolean }", description: "Show a clear button when the input has a value." },
    { name: "showCharacterCount", type: "boolean", description: "Display current character count." },
    { name: "maxLength", type: "number", description: "Maximum character limit." },
    { name: "minLength", type: "number", description: "Minimum character requirement." },
    { name: "error", type: "string | boolean", description: "Error state. String shows error message, boolean shows red border." },
    { name: "disabled", type: "boolean", default: "false", description: "Disable the input." },
    { name: "readOnly", type: "boolean", description: "Make the input read-only." },
    { name: "fullWidth", type: "boolean", description: "Expand to full available width." },
    { name: "leading", type: "TextInputLeadingAccessory", description: "Leading accessory (icon, button, tags, or image)." },
    { name: "trailing", type: "TextInputTrailingAccessory", description: "Trailing accessory (icon or button)." },
    { name: "inputRef", type: "Ref<HTMLInputElement>", internal: true, description: "Ref to the underlying input element." },
];

function BasicDemo() {
    const [value, setValue] = useState("Hello world");
    return <ManaTextInput value={value} onChange={setValue} />;
}

function SizesDemo() {
    const [sm, setSm] = useState("Small");
    const [md, setMd] = useState("Medium");
    return (
        <div className="vc-compfinder-grid-vertical">
            <ManaTextInput value={sm} onChange={setSm} size="sm" placeholder="Size: sm" />
            <ManaTextInput value={md} onChange={setMd} size="md" placeholder="Size: md" />
        </div>
    );
}

function ClearableDemo() {
    const [value, setValue] = useState("Clear me");
    return <ManaTextInput value={value} onChange={setValue} clearable />;
}

function CharCountDemo() {
    const [value, setValue] = useState("Count chars");
    return <ManaTextInput value={value} onChange={setValue} showCharacterCount maxLength={50} />;
}

function ErrorDemo() {
    const [value, setValue] = useState("Invalid input");
    return <ManaTextInput value={value} onChange={setValue} error />;
}

export default function TextInputTab() {
    return (
        <DocPage
            overview="ManaTextInput is Discord's single-line text input with support for two sizes, clearable button, character counting, error states, leading/trailing accessories, and disabled/read-only modes."
            importPath={'import { ManaTextInput } from "../components";'}
            sections={[
                {
                    title: "Basic",
                    description: "Default text input with controlled value.",
                    children: <BasicDemo />,
                    code: "<ManaTextInput value={value} onChange={setValue} />",
                    relevantProps: ["value", "onChange"],
                },
                {
                    title: "Sizes",
                    description: "Available in sm and md (default) sizes.",
                    children: <SizesDemo />,
                    relevantProps: ["size"],
                },
                {
                    title: "With Placeholder",
                    children: (
                        <ManaTextInput value="" onChange={() => { }} placeholder="Enter text here..." />
                    ),
                    relevantProps: ["placeholder"],
                },
                {
                    title: "Clearable",
                    description: "Shows a clear button when the input has a value.",
                    children: <ClearableDemo />,
                    relevantProps: ["clearable"],
                },
                {
                    title: "Character Count",
                    description: "Displays character count with a 50-character max.",
                    children: <CharCountDemo />,
                    relevantProps: ["showCharacterCount", "maxLength"],
                },
                {
                    title: "Error State",
                    description: "Red border indicating invalid input.",
                    children: <ErrorDemo />,
                    relevantProps: ["error"],
                },
                {
                    title: "States",
                    description: "Disabled and read-only states.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            <ManaTextInput value="Disabled" disabled />
                            <ManaTextInput value="Read only" readOnly />
                        </div>
                    ),
                    relevantProps: ["disabled", "readOnly"],
                },
            ]}
            props={TEXTINPUT_PROPS}
        />
    );
}
