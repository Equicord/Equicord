/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ManaButton, Paragraph, Spinner, SpinnerTypes, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const SPINNER_PROPS: PropDef[] = [
    { name: "type", type: "SpinnerType", description: 'Spinner variant. One of: "wanderingCubes", "chasingDots", "pulsingEllipsis", "spinningCircle", "spinningCircleSimple", "lowMotion".' },
    { name: "animated", type: "boolean", default: "true", description: "Enable or pause the animation." },
    { name: "className", type: "string", description: "CSS class for the container." },
    { name: "itemClassName", type: "string", description: "CSS class for inner animation items." },
    { name: "aria-label", type: "string", description: "Accessibility label." },
];

function AnimationToggleDemo() {
    const [animated, setAnimated] = useState(true);
    return (
        <div>
            <ManaButton
                variant="secondary"
                text={animated ? "Pause Animation" : "Resume Animation"}
                onClick={() => setAnimated(!animated)}
                style={{ marginBottom: 16 }}
            />
            <div style={{ textAlign: "center", padding: 16 }}>
                <Spinner type="spinningCircle" animated={animated} />
                <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 8 }}>
                    animated={animated.toString()}
                </Paragraph>
            </div>
        </div>
    );
}

export default function SpinnerTab() {
    return (
        <DocPage
            componentName="Spinner"
            overview="Spinner provides animated loading indicators in six visual styles. Automatically switches to the lowMotion variant when the user has reduced motion enabled. The animation can be paused via the animated prop."
            notices={[
                { type: "positive", children: "Spinner automatically respects the user's reduced motion setting by switching to the lowMotion variant. You don't need to handle this manually." },
            ]}
            importPath={'import { Spinner, SpinnerTypes } from "../components";'}
            sections={[
                {
                    title: "All Types",
                    description: "All six spinner variants.",
                    children: (
                        <div className="vc-compfinder-grid">
                            {SpinnerTypes.map(type => (
                                <div key={type} style={{ textAlign: "center", padding: 16 }}>
                                    <Spinner type={type} />
                                    <Paragraph color="text-muted" style={{ fontSize: 10, marginTop: 8 }}>
                                        {type}
                                    </Paragraph>
                                </div>
                            ))}
                        </div>
                    ),
                    code: '<Spinner type="spinningCircle" />',
                    relevantProps: ["type"],
                },
                {
                    title: "Animation Toggle",
                    description: "Spinners can be paused with animated=false.",
                    children: <AnimationToggleDemo />,
                    relevantProps: ["animated"],
                },
                {
                    title: "Low Motion",
                    description: "The lowMotion type is used when the user prefers reduced motion. The component automatically switches to this variant.",
                    children: (
                        <div style={{ textAlign: "center", padding: 16 }}>
                            <Spinner type="lowMotion" />
                        </div>
                    ),
                },
            ]}
            props={SPINNER_PROPS}
        />
    );
}
