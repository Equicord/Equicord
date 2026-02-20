/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Anchor, Paragraph } from "..";
import { DocPage, type PropDef } from "../DocPage";

const ANCHOR_PROPS: PropDef[] = [
    { name: "href", type: "string", description: "Link URL. External links automatically get rel=\"noreferrer noopener\" and target=\"_blank\"." },
    { name: "children", type: "ReactNode", description: "Link content." },
    { name: "onClick", type: "MouseEventHandler", description: "Click handler. If omitted and href is set, uses Discord's default link interceptor." },
    { name: "useDefaultUnderlineStyles", type: "boolean", default: "true", description: "Whether to show underline on hover." },
    { name: "title", type: "string", description: "Tooltip text shown on hover." },
    { name: "target", type: "string", description: "Link target. Auto-set to _blank for external URLs." },
    { name: "rel", type: "string", description: "Link relationship. Auto-set to \"noreferrer noopener\" for external URLs." },
    { name: "focusProps", type: "Record<string, unknown>", internal: true, description: "Props forwarded to the focus management wrapper." },
    { name: "ref", type: "Ref<HTMLAnchorElement>", description: "Ref to the underlying anchor element." },
    { name: "className", type: "string", description: "Additional CSS class name." },
    { name: "style", type: "CSSProperties", description: "Inline styles." },
];

export default function AnchorTab() {
    return (
        <DocPage
            componentName="Anchor"
            overview="Anchor is Discord's styled link component. It handles external link safety (adding noreferrer/noopener, opening in new tabs), untrusted link warning modals, and integrates with Discord's focus management system. Supports underline-on-hover styling by default."
            notices={[
                { type: "positive", children: 'Anchor automatically applies rel="noreferrer noopener" and target="_blank" for external URLs, so you don\'t need to set these manually.' },
            ]}
            importPath={'import { Anchor } from "../components";'}
            sections={[
                {
                    title: "Basic Link",
                    description: "A styled link with underline on hover.",
                    children: (
                        <Anchor href="https://discord.com">
                            Discord Homepage
                        </Anchor>
                    ),
                    code: '<Anchor href="https://example.com">Visit Example</Anchor>',
                    relevantProps: ["href", "children"]
                },
                {
                    title: "Without Underline",
                    description: "Disable the default underline-on-hover behavior with useDefaultUnderlineStyles={false}.",
                    children: (
                        <Anchor href="https://discord.com" useDefaultUnderlineStyles={false}>
                            No underline on hover
                        </Anchor>
                    ),
                    relevantProps: ["useDefaultUnderlineStyles"]
                },
                {
                    title: "With Title Tooltip",
                    description: "Hover to see the native title tooltip.",
                    children: (
                        <Anchor href="https://discord.com" title="Click to visit Discord">
                            Hover for tooltip
                        </Anchor>
                    ),
                    relevantProps: ["title"]
                },
                {
                    title: "Custom Styling",
                    children: (
                        <Anchor
                            href="https://discord.com"
                            style={{ color: "var(--text-positive)", fontWeight: 600 }}
                        >
                            Green styled link
                        </Anchor>
                    ),
                    relevantProps: ["style", "className"]
                },
                {
                    title: "With onClick Handler",
                    description: "Custom click handler prevents default navigation.",
                    children: (
                        <Anchor
                            href="#"
                            onClick={e => {
                                e.preventDefault();
                                alert("Link clicked!");
                            }}
                        >
                            Click me (shows alert)
                        </Anchor>
                    ),
                    code: '<Anchor href="#" onClick={e => { e.preventDefault(); doSomething(); }}>\n  Click me\n</Anchor>',
                    relevantProps: ["onClick"]
                },
                {
                    title: "Inline in Text",
                    description: "Links used naturally within a paragraph.",
                    children: (
                        <Paragraph>
                            Check out the <Anchor href="https://discord.com/terms">Terms of Service</Anchor> and{" "}
                            <Anchor href="https://discord.com/privacy">Privacy Policy</Anchor> for more info.
                        </Paragraph>
                    ),
                    code: '<Paragraph>\n  Read the <Anchor href="/docs" useDefaultUnderlineStyles={false}>documentation</Anchor>.\n</Paragraph>'
                },
            ]}
            props={ANCHOR_PROPS}
        />
    );
}
