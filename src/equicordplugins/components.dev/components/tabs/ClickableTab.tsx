/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Clickable, Paragraph, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const CLICKABLE_PROPS: PropDef[] = [
    { name: "tag", type: "keyof JSX.IntrinsicElements", default: '"div"', description: "HTML element to render as." },
    { name: "onClick", type: "MouseEventHandler", description: "Click handler. When absent, renders as a non-interactive element without keyboard handling." },
    { name: "onKeyPress", type: "KeyboardEventHandler", description: "Key press handler called after internal Enter/Space handling." },
    { name: "role", type: "string", default: '"button"', description: "ARIA role attribute." },
    { name: "tabIndex", type: "number", default: "0", description: "Tab index for keyboard navigation." },
    { name: "ignoreKeyPress", type: "boolean", description: "When true, Enter and Space keys will not trigger onClick." },
    { name: "focusProps", type: "Record<string, unknown>", internal: true, description: "Props forwarded to the focus management wrapper." },
    { name: "innerRef", type: "Ref<HTMLElement>", internal: true, description: "Ref to the underlying DOM element." },
    { name: "href", type: "string", description: "Optional href. Affects key handling behavior (Space won't preventDefault when set)." },
    { name: "className", type: "string", description: "Additional CSS class name." },
    { name: "children", type: "ReactNode", description: "Child elements." },
];

const boxStyle: React.CSSProperties = {
    padding: "8px 16px",
    backgroundColor: "var(--background-secondary)",
    borderRadius: 4,
    cursor: "pointer",
};

function BasicDemo() {
    const [count, setCount] = useState(0);

    return (
        <>
            <Paragraph color="text-muted" style={{ marginBottom: 8 }}>Click count: {count}</Paragraph>
            <Clickable onClick={() => setCount(c => c + 1)} style={boxStyle}>
                Click me!
            </Clickable>
        </>
    );
}

function TagDemo() {
    const [last, setLast] = useState("None");

    return (
        <>
            <div style={{ display: "flex", gap: 8 }}>
                <Clickable tag="div" onClick={() => setLast("div")} style={{ ...boxStyle, backgroundColor: "var(--background-tertiary)" }}>
                    tag="div"
                </Clickable>
                <Clickable tag="span" onClick={() => setLast("span")} style={{ ...boxStyle, backgroundColor: "var(--background-tertiary)" }}>
                    tag="span"
                </Clickable>
                <Clickable tag="button" onClick={() => setLast("button")} style={{ ...boxStyle, backgroundColor: "var(--background-tertiary)", border: "none", color: "inherit" }}>
                    tag="button"
                </Clickable>
            </div>
            <Paragraph color="text-muted" style={{ marginTop: 8 }}>Last clicked: {last}</Paragraph>
        </>
    );
}

function KeyPressDemo() {
    const [last, setLast] = useState("None");

    return (
        <>
            <div style={{ display: "flex", gap: 8 }}>
                <Clickable tabIndex={0} onClick={() => setLast("Normal (keys work)")} style={boxStyle}>
                    Normal (try Enter/Space)
                </Clickable>
                <Clickable tabIndex={0} ignoreKeyPress onClick={() => setLast("Keys blocked")} style={boxStyle}>
                    ignoreKeyPress (keys blocked)
                </Clickable>
            </div>
            <Paragraph color="text-muted" style={{ marginTop: 8 }}>Last action: {last}</Paragraph>
        </>
    );
}

export default function ClickableTab() {
    return (
        <DocPage
            componentName="Clickable"
            overview="Clickable is a generic interactive wrapper that adds click and keyboard handling to any HTML element. It handles Enter/Space key presses, integrates with Discord's focus management context, and gracefully degrades to a non-interactive element when no onClick is provided. It's a class component with configurable tag, role, and tabIndex defaults."
            notices={[
                { type: "positive", children: 'Use Clickable instead of adding onClick to plain divs. It handles keyboard accessibility, focus management, and proper ARIA role="button" automatically.' },
            ]}
            importPath={'import { Clickable } from "../components";'}
            sections={[
                {
                    title: "Basic",
                    description: "Default clickable element. Renders as a div with role=\"button\" and tabIndex=0.",
                    children: <BasicDemo />,
                    code: "<Clickable onClick={() => doSomething()} style={myStyles}>\n  Click me!\n</Clickable>",
                    relevantProps: ["onClick", "children"],
                },
                {
                    title: "Custom Tag",
                    description: "Clickable can render as any HTML element using the tag prop.",
                    children: <TagDemo />,
                    code: '<Clickable tag="button" onClick={handleClick}>\n  I am a button element\n</Clickable>',
                    relevantProps: ["tag"],
                },
                {
                    title: "Role and TabIndex",
                    description: "Accessibility props for keyboard navigation. Defaults to role=\"button\" and tabIndex=0.",
                    children: (
                        <div style={{ display: "flex", gap: 8 }}>
                            <Clickable role="button" tabIndex={0} onClick={() => { }} style={boxStyle}>
                                role="button"
                            </Clickable>
                            <Clickable role="link" tabIndex={0} onClick={() => { }} style={boxStyle}>
                                role="link"
                            </Clickable>
                        </div>
                    ),
                    relevantProps: ["role", "tabIndex"],
                },
                {
                    title: "Ignore Key Press",
                    description: "When ignoreKeyPress is true, Enter and Space will not trigger onClick. Only mouse clicks work.",
                    children: <KeyPressDemo />,
                    relevantProps: ["ignoreKeyPress"],
                },
                {
                    title: "Non-Interactive",
                    description: "When no onClick is provided, renders without keyboard handling or interactive behavior.",
                    children: (
                        <Clickable style={{ padding: "8px 16px", backgroundColor: "var(--background-modifier-accent)", borderRadius: 4 }}>
                            Non-interactive (no onClick)
                        </Clickable>
                    ),
                },
            ]}
            props={CLICKABLE_PROPS}
        />
    );
}
