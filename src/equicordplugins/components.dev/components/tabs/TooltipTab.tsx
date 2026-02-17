/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ManaButton, ManaTooltip, Paragraph, TooltipColors, TooltipPositions } from "..";
import { DocPage, type PropDef } from "../DocPage";

const TOOLTIP_PROPS: PropDef[] = [
    { name: "text", type: "string | (() => ReactNode)", required: true, description: "Tooltip content. Can be a string or a render function for rich content." },
    { name: "children", type: "(props) => ReactNode", required: true, description: "Render function that receives props to spread on the trigger element." },
    { name: "position", type: '"top" | "bottom" | "left" | "right"', default: '"top"', description: "Which side of the trigger the tooltip appears on." },
    { name: "align", type: '"start" | "center" | "end"', default: '"center"', description: "Alignment along the tooltip edge." },
    { name: "color", type: '"primary" | "grey" | "brand" | "green" | "red"', default: '"primary"', description: "Tooltip background color." },
    { name: "spacing", type: "number", default: "8", description: "Gap in pixels between the trigger and tooltip." },
    { name: "delay", type: "number", description: "Delay in milliseconds before the tooltip appears." },
    { name: "hideOnClick", type: "boolean", default: "true", description: "Hide the tooltip when the trigger is clicked." },
    { name: "forceOpen", type: "boolean", description: "Force the tooltip to stay open." },
    { name: "shouldShow", type: "boolean", description: "Externally control whether the tooltip is shown." },
    { name: "allowOverflow", type: "boolean", description: "Allow the tooltip to overflow its container." },
    { name: "overflowOnly", type: "boolean", description: "Only show the tooltip when the trigger text is overflowing." },
    { name: "tooltipClassName", type: "string", description: "CSS class for the tooltip container." },
    { name: "tooltipStyle", type: "CSSProperties", description: "Inline styles for the tooltip container." },
    { name: "tooltipContentClassName", type: "string", description: "CSS class for the tooltip content." },
    { name: "tooltipPointerClassName", type: "string", description: "CSS class for the tooltip arrow pointer." },
    { name: "positionKeyStemOverride", type: "string", internal: true, description: "Override the position key stem used for animation keying." },
    { name: "clickableOnMobile", type: "boolean", description: "Make the tooltip trigger clickable on mobile devices." },
    { name: "disableTooltipPointerEvents", type: "boolean", description: "Disable pointer events on the tooltip overlay." },
    { name: "targetElementRef", type: "RefObject<HTMLElement>", description: "Ref to an external element to position the tooltip against." },
    { name: "onTooltipShow", type: "() => void", description: "Callback when the tooltip becomes visible." },
    { name: "onTooltipHide", type: "() => void", description: "Callback when the tooltip is hidden." },
    { name: "onAnimationRest", type: "() => void", description: "Callback when the tooltip show/hide animation completes." },
    { name: "aria-label", type: "string | false", description: "Accessibility label. Set to false to disable." },
];

export default function TooltipTab() {
    return (
        <DocPage
            componentName="ManaTooltip"
            overview="ManaTooltip displays contextual information on hover via a render-props pattern. Supports positioning on all four sides, five color variants, configurable delay, and click-to-hide behavior. The children prop receives props that must be spread on the trigger element."
            notices={[
                { type: "info", children: "ManaTooltip uses a render-props pattern. The children function receives props that must be spread onto the trigger element for hover detection to work." },
            ]}
            importPath={'import { ManaTooltip, TooltipPositions, TooltipColors } from "../components";'}
            sections={[
                {
                    title: "Positions",
                    description: "Tooltip can appear on any side of the trigger element.",
                    children: (
                        <div className="vc-compfinder-grid">
                            {TooltipPositions.map(position => (
                                <ManaTooltip key={position} text={`Tooltip on ${position}`} position={position}>
                                    {props => (
                                        <ManaButton {...props} variant="secondary" text={position} />
                                    )}
                                </ManaTooltip>
                            ))}
                        </div>
                    ),
                    code: `<ManaTooltip text="Tooltip on top" position="top">
    {props => <ManaButton {...props} variant="secondary" text="Hover me" />}
</ManaTooltip>`,
                    relevantProps: ["position"],
                },
                {
                    title: "Colors",
                    description: "Five background color variants.",
                    children: (
                        <div className="vc-compfinder-grid">
                            {TooltipColors.map(color => (
                                <ManaTooltip key={color} text={`${color} tooltip`} color={color}>
                                    {props => (
                                        <ManaButton {...props} variant="secondary" text={color} />
                                    )}
                                </ManaTooltip>
                            ))}
                        </div>
                    ),
                    code: '<ManaTooltip text="Branded" color="brand">\n    {props => <ManaButton {...props} variant="secondary" text="Brand" />}\n</ManaTooltip>',
                    relevantProps: ["color"],
                },
                {
                    title: "Delay",
                    description: "Configure how long to wait before showing the tooltip.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <ManaTooltip text="No delay" delay={0}>
                                {props => (
                                    <ManaButton {...props} variant="secondary" text="No delay" />
                                )}
                            </ManaTooltip>
                            <ManaTooltip text="500ms delay" delay={500}>
                                {props => (
                                    <ManaButton {...props} variant="secondary" text="500ms delay" />
                                )}
                            </ManaTooltip>
                            <ManaTooltip text="1000ms delay" delay={1000}>
                                {props => (
                                    <ManaButton {...props} variant="secondary" text="1s delay" />
                                )}
                            </ManaTooltip>
                        </div>
                    ),
                    relevantProps: ["delay"],
                },
                {
                    title: "Hide on Click",
                    description: "By default tooltips hide when the trigger is clicked. Set hideOnClick=false to keep them visible.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <ManaTooltip text="Hides when clicked" hideOnClick>
                                {props => (
                                    <ManaButton {...props} variant="secondary" text="hideOnClick=true" />
                                )}
                            </ManaTooltip>
                            <ManaTooltip text="Stays visible when clicked" hideOnClick={false}>
                                {props => (
                                    <ManaButton {...props} variant="secondary" text="hideOnClick=false" />
                                )}
                            </ManaTooltip>
                        </div>
                    ),
                    relevantProps: ["hideOnClick"],
                },
                {
                    title: "Rich Content",
                    description: "The text prop accepts a function that returns JSX for rich tooltip content.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <ManaTooltip text={() => (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <Paragraph color="text-default" style={{ fontWeight: 600 }}>Rich Tooltip</Paragraph>
                                    <Paragraph color="text-muted" style={{ fontSize: 12 }}>With multiple lines of content.</Paragraph>
                                </div>
                            )}>
                                {props => (
                                    <ManaButton {...props} variant="secondary" text="Rich content" />
                                )}
                            </ManaTooltip>
                        </div>
                    ),
                    code: `<ManaTooltip text={() => (
    <div>
        <strong>Title</strong>
        <p>Description text</p>
    </div>
)}>
    {props => <ManaButton {...props} text="Hover me" />}
</ManaTooltip>`,
                    relevantProps: ["text"],
                },
            ]}
            props={TOOLTIP_PROPS}
        />
    );
}
