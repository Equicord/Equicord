/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ManaTextArea, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const TEXTAREA_PROPS: PropDef[] = [
    { name: "value", type: "string", description: "Current textarea value (controlled)." },
    { name: "defaultValue", type: "string", description: "Initial value (uncontrolled)." },
    { name: "onChange", type: "(value: string, name?: string) => void", description: "Called when the text changes." },
    { name: "placeholder", type: "string", description: "Placeholder text when empty." },
    { name: "name", type: "string", description: "HTML name attribute for form submission." },
    { name: "rows", type: "number", description: "Fixed number of visible text rows." },
    { name: "autosize", type: "boolean", description: "Automatically grow height to fit content." },
    { name: "autoFocus", type: "boolean", description: "Focus on mount." },
    { name: "maxLength", type: "number", description: "Maximum character limit." },
    { name: "minLength", type: "number", description: "Minimum character requirement." },
    { name: "showCharacterCount", type: "boolean", description: "Display current character count." },
    { name: "showRemainingCharacterCount", type: "boolean", description: "Display remaining characters instead of current count." },
    { name: "error", type: "string | boolean", description: "Error state. String shows error message, boolean shows red border." },
    { name: "disabled", type: "boolean", default: "false", description: "Disable the textarea." },
    { name: "readOnly", type: "boolean", description: "Make the textarea read-only." },
    { name: "fullWidth", type: "boolean", description: "Expand to full available width." },
    { name: "inputRef", type: "Ref<HTMLTextAreaElement>", internal: true, description: "Ref to the underlying textarea element." },
];

function BasicDemo() {
    const [value, setValue] = useState("Hello world\nThis is a textarea");
    return <ManaTextArea value={value} onChange={setValue} />;
}

function AutosizeDemo() {
    const [value, setValue] = useState("This textarea will grow as you type more content...");
    return <ManaTextArea value={value} onChange={setValue} autosize />;
}

function CharCountDemo() {
    const [value, setValue] = useState("Count characters");
    return <ManaTextArea value={value} onChange={setValue} showCharacterCount maxLength={200} />;
}

export default function TextAreaTab() {
    return (
        <DocPage
            overview="ManaTextArea is Discord's multi-line text input with support for autosize, character counting, fixed row count, error states, and disabled/read-only modes."
            importPath={'import { ManaTextArea } from "../components";'}
            sections={[
                {
                    title: "Basic",
                    description: "Default textarea with controlled value.",
                    children: <BasicDemo />,
                    code: "<ManaTextArea value={value} onChange={setValue} />",
                    relevantProps: ["value", "onChange"],
                },
                {
                    title: "With Placeholder",
                    children: (
                        <ManaTextArea value="" onChange={() => { }} placeholder="Enter your message..." />
                    ),
                    relevantProps: ["placeholder"],
                },
                {
                    title: "Autosize",
                    description: "Automatically grows to fit content as you type.",
                    children: <AutosizeDemo />,
                    relevantProps: ["autosize"],
                },
                {
                    title: "Fixed Rows",
                    description: "Fixed height with 5 visible rows.",
                    children: (
                        <ManaTextArea value="Fixed 5 rows" onChange={() => { }} rows={5} />
                    ),
                    relevantProps: ["rows"],
                },
                {
                    title: "Character Count",
                    description: "Shows character count with a max length of 200.",
                    children: <CharCountDemo />,
                    relevantProps: ["showCharacterCount", "maxLength"],
                },
                {
                    title: "States",
                    description: "Disabled and read-only states.",
                    children: (
                        <div className="vc-compfinder-grid-vertical">
                            <ManaTextArea value="Disabled textarea" disabled />
                            <ManaTextArea value="Read only textarea" readOnly />
                        </div>
                    ),
                    relevantProps: ["disabled", "readOnly"],
                },
            ]}
            props={TEXTAREA_PROPS}
        />
    );
}
