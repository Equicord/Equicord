/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ManaButton, ManaPopover, PopoverAction, useRef, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const POPOVER_PROPS: PropDef[] = [
    { name: "targetElementRef", type: "RefObject<HTMLElement>", required: true, description: "Ref to the element the popover is anchored to." },
    { name: "shouldShow", type: "boolean", required: true, description: "Controls popover visibility." },
    { name: "onRequestClose", type: "(reason: string) => void", description: "Called when the popover wants to close (click outside, escape, etc.)." },
    { name: "title", type: "string", description: "Popover title text." },
    { name: "body", type: "string", description: "Popover body text." },
    { name: "size", type: '"sm" | "md" | "lg"', description: "Popover width size." },
    { name: "position", type: '"top" | "bottom" | "left" | "right"', description: "Position relative to the target element." },
    { name: "actions", type: "PopoverAction[]", description: "Action buttons rendered in the popover footer." },
    { name: "textLink", type: "{ text: string; onClick?: () => void }", description: "Text link displayed below the body." },
    { name: "graphic", type: "{ src: string; aspectRatio?: string }", description: "Image graphic shown in the popover." },
    { name: "badge", type: "ReactNode", description: "Badge element displayed near the title." },
    { name: "gradientColor", type: "string", description: "Background gradient color." },
    { name: "scrollBehavior", type: "string", description: "Scroll behavior for popover content." },
    { name: "hasVideo", type: "boolean", description: "Whether the popover contains video content." },
    { name: "popoverRef", type: "Ref<HTMLDivElement>", description: "Ref forwarded to the popover container." },
    { name: "caretConfig", type: '{ align?: "start" | "center" | "end" }', description: "Configuration for the caret arrow." },
    { name: "alignmentStrategy", type: '"edge" | "trigger-center"', description: "How the popover aligns to the target element." },
    { name: "align", type: '"left" | "center" | "right"', description: 'Alignment when alignmentStrategy is "edge".' },
];

function PopoverDemo({ label, title, body, size, actions, position }: {
    label: string;
    title: string;
    body: string;
    size?: "sm" | "md" | "lg";
    actions?: PopoverAction[];
    position?: "top" | "bottom" | "left" | "right";
}) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [show, setShow] = useState(false);

    return (
        <>
            <div ref={wrapperRef} style={{ display: "inline-block" }}>
                <ManaButton variant="secondary" text={label} onClick={() => setShow(!show)} />
            </div>
            <ManaPopover
                targetElementRef={wrapperRef}
                shouldShow={show}
                onRequestClose={() => setShow(false)}
                title={title}
                body={body}
                size={size}
                actions={actions}
                position={position}
            />
        </>
    );
}

export default function PopoverTab() {
    return (
        <DocPage
            componentName="ManaPopover"
            overview="ManaPopover is Discord's popover component that anchors to a target element. Supports title, body text, action buttons, graphics, text links, and badge elements. Positioned relative to the target with configurable direction and size."
            notices={[
                { type: "warn", children: "The targetElementRef must point to a mounted DOM element. If the ref is null when shouldShow becomes true, the popover will not position correctly." },
                { type: "info", children: "Handle onRequestClose to dismiss the popover when the user clicks outside or presses Escape. Without it, the popover will remain visible until shouldShow is manually set to false." },
            ]}
            importPath={'import { ManaPopover } from "../components";'}
            sections={[
                {
                    title: "Basic",
                    description: "Simple popover with title and body text.",
                    children: (
                        <PopoverDemo
                            label="Click me"
                            title="Popover Title"
                            body="This is the popover body text with some helpful information."
                        />
                    ),
                    code: `const ref = useRef<HTMLDivElement>(null);
const [show, setShow] = useState(false);

<div ref={ref}>
  <Button onClick={() => setShow(!show)}>Click me</Button>
</div>
<ManaPopover
  targetElementRef={ref}
  shouldShow={show}
  onRequestClose={() => setShow(false)}
  title="Popover Title"
  body="Body text here."
/>`,
                    relevantProps: ["targetElementRef", "shouldShow", "onRequestClose", "title", "body"],
                },
                {
                    title: "Sizes",
                    description: "Three size variants: sm, md, and lg.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <PopoverDemo label="sm" title="Small" body="Small popover." size="sm" />
                            <PopoverDemo label="md" title="Medium" body="Medium popover (default)." size="md" />
                            <PopoverDemo label="lg" title="Large" body="Large popover with more space." size="lg" />
                        </div>
                    ),
                    relevantProps: ["size"],
                },
                {
                    title: "Positions",
                    description: "Popover can be positioned on any side of the target element.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <PopoverDemo label="top" title="Top" body="Appears above." position="top" />
                            <PopoverDemo label="bottom" title="Bottom" body="Appears below." position="bottom" />
                            <PopoverDemo label="left" title="Left" body="Appears left." position="left" />
                            <PopoverDemo label="right" title="Right" body="Appears right." position="right" />
                        </div>
                    ),
                    relevantProps: ["position"],
                },
                {
                    title: "With Actions",
                    description: "Popover with action buttons in the footer.",
                    children: (
                        <PopoverDemo
                            label="With Actions"
                            title="Popover with Actions"
                            body="This popover has action buttons."
                            actions={[
                                { text: "Primary", variant: "primary" },
                                { text: "Secondary", variant: "secondary" },
                            ]}
                        />
                    ),
                    relevantProps: ["actions"],
                },
            ]}
            props={POPOVER_PROPS}
        />
    );
}
