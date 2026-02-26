/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { FocusLock, ManaButton, ManaTextInput, Paragraph, useRef, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const FOCUSLOCK_PROPS: PropDef[] = [
    { name: "containerRef", type: "RefObject<HTMLElement | null>", required: true, description: "React ref pointing to the container element that defines the focus trap boundary." },
    { name: "keyboardModeEnabled", type: "boolean", description: "Enable keyboard-based focus trapping. When true, Tab key cycles through focusable elements inside the container." },
    { name: "children", type: "ReactNode", description: "Content rendered inside the focus trap." },
];

function FocusLockDemo() {
    const [enabled, setEnabled] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [inputValue, setInputValue] = useState("");

    return (
        <div>
            <ManaButton
                variant={enabled ? "primary" : "secondary"}
                text={enabled ? "Disable Focus Lock" : "Enable Focus Lock"}
                onClick={() => setEnabled(!enabled)}
                style={{ marginBottom: 16 }}
            />
            <div
                ref={containerRef}
                style={{
                    padding: 16,
                    border: `2px solid ${enabled ? "var(--brand-500)" : "var(--background-modifier-accent)"}`,
                    borderRadius: 8,
                    background: "var(--background-secondary)",
                }}
            >
                {enabled ? (
                    <FocusLock containerRef={containerRef}>
                        <Paragraph style={{ marginBottom: 12 }}>
                            Focus is trapped. Try pressing Tab to cycle through these elements:
                        </Paragraph>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <ManaTextInput
                                value={inputValue}
                                onChange={setInputValue}
                                placeholder="First input"
                            />
                            <ManaTextInput
                                value=""
                                onChange={() => { }}
                                placeholder="Second input"
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                                <ManaButton variant="secondary" text="Button A" onClick={() => { }} />
                                <ManaButton variant="secondary" text="Button B" onClick={() => { }} />
                                <ManaButton variant="primary" text="Exit Focus Lock" onClick={() => setEnabled(false)} />
                            </div>
                        </div>
                    </FocusLock>
                ) : (
                    <Paragraph color="text-muted">
                        Click "Enable Focus Lock" to activate the focus trap demo.
                    </Paragraph>
                )}
            </div>
        </div>
    );
}

export default function FocusLockTab() {
    return (
        <DocPage
            componentName="FocusLock"
            overview="FocusLock traps keyboard focus within a container element. When active, pressing Tab cycles through focusable elements inside the boundary without escaping. Used in modals, dropdown menus, and anywhere keyboard accessibility requires scoped navigation."
            notices={[
                { type: "warn", children: "FocusLock traps all keyboard focus within its container. Always provide a way for the user to exit the focus trap (e.g. a close button or Escape key handler), otherwise they will be unable to navigate away." },
                { type: "info", children: "FocusLock is typically used inside modals and dropdown menus that already handle dismiss behavior. If you use it standalone, you must implement your own dismiss logic." },
            ]}
            importPath={'import { FocusLock } from "../components";'}
            sections={[
                {
                    title: "Focus Trap",
                    description: "Enable the focus lock and press Tab to see focus cycle within the container boundary.",
                    children: <FocusLockDemo />,
                    code: `const containerRef = useRef<HTMLDivElement>(null);

<div ref={containerRef}>
  <FocusLock containerRef={containerRef}>
    <input />
    <button>OK</button>
    <button>Cancel</button>
  </FocusLock>
</div>`,
                    relevantProps: ["containerRef"],
                },
            ]}
            props={FOCUSLOCK_PROPS}
        />
    );
}
