/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openModal } from "@utils/modal";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";

import { Heading, ManaButton, Paragraph, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const LayerModal = findComponentByCodeLazy('"data-mana-component":"layer-modal"') as React.ComponentType<{
    transitionState: number;
    animationVariant?: "default" | string;
    returnRef?: React.Ref<HTMLDivElement>;
    "aria-label"?: string;
    onClose: () => void;
    children: React.ReactNode;
}>;

const TransitionState = findByPropsLazy("ENTERING", "ENTERED", "EXITING") as {
    ENTERING: number;
    ENTERED: number;
    EXITING: number;
    EXITED: number;
    HIDDEN: number;
};

const LAYERMODAL_PROPS: PropDef[] = [
    { name: "transitionState", type: "number", required: true, description: "Animation state. Use TransitionState.ENTERED for visible." },
    { name: "onClose", type: "() => void", required: true, description: "Called when the modal should close." },
    { name: "children", type: "ReactNode", required: true, description: "Modal content." },
    { name: "animationVariant", type: '"default" | string', default: '"default"', description: "Animation style for enter/exit transitions." },
    { name: "returnRef", type: "Ref<HTMLDivElement>", internal: true, description: "Ref forwarded to the modal root element." },
    { name: "aria-label", type: "string", description: "Accessibility label for the modal." },
];

function ModalContentDemo({ onClose }: { onClose: () => void; }) {
    return (
        <LayerModal
            transitionState={TransitionState.ENTERED}
            onClose={onClose}
            aria-label="Demo Layer Modal"
        >
            <div style={{ padding: 24, minWidth: 300 }}>
                <Heading tag="h2" style={{ marginBottom: 8 }}>Layer Modal</Heading>
                <Paragraph color="text-muted" style={{ marginBottom: 16 }}>
                    This is a layer modal opened via openModal. It supports stacked/layered
                    modal experiences with built-in animation handling.
                </Paragraph>
                <ManaButton variant="primary" text="Close" onClick={onClose} />
            </div>
        </LayerModal>
    );
}

function InlineDemo() {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <ManaButton
                variant="secondary"
                text={visible ? "Hide Inline" : "Show Inline"}
                onClick={() => setVisible(!visible)}
            />
            {visible && (
                <div style={{ marginTop: 16, position: "relative", minHeight: 200 }}>
                    <LayerModal
                        transitionState={TransitionState.ENTERED}
                        onClose={() => setVisible(false)}
                        aria-label="Inline Demo"
                    >
                        <div style={{ padding: 16 }}>
                            <Paragraph>Inline layer modal content</Paragraph>
                            <ManaButton variant="primary" text="Close" onClick={() => setVisible(false)} style={{ marginTop: 8 }} />
                        </div>
                    </LayerModal>
                </div>
            )}
        </div>
    );
}

export default function LayerModalTab() {
    return (
        <DocPage
            componentName="LayerModal"
            overview="LayerModal is Discord's component for stacked/layered modal experiences. It has different animation behavior than regular modals and is typically used with openModal() for proper backdrop and positioning. Requires TransitionState for controlling visibility."
            notices={[
                { type: "warn", children: "LayerModal must be used with openModal() for proper backdrop, positioning, and transition state management. Rendering it inline without the modal system will result in incorrect behavior." },
                { type: "info", children: "LayerModal is found via findComponentByCodeLazy, not exported directly. The TransitionState constants are also required and must be found separately." },
            ]}
            importPath={`import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";

const LayerModal = findComponentByCodeLazy('"data-mana-component":"layer-modal"');
const TransitionState = findByPropsLazy("ENTERING", "ENTERED", "EXITING");`}
            sections={[
                {
                    title: "Open via openModal",
                    description: "The recommended way to use LayerModal is with openModal() which handles backdrop and positioning.",
                    children: (
                        <ManaButton
                            variant="secondary"
                            text="Open Layer Modal"
                            onClick={() => openModal(props => (
                                <ModalContentDemo onClose={props.onClose} />
                            ))}
                        />
                    ),
                    code: `openModal(props => (
  <LayerModal
    transitionState={TransitionState.ENTERED}
    onClose={props.onClose}
    aria-label="My Modal"
  >
    <div style={{ padding: 24 }}>
      <p>Modal content here</p>
    </div>
  </LayerModal>
))`,
                    relevantProps: ["transitionState", "onClose"],
                },
                {
                    title: "Inline Preview",
                    description: "Rendered inline for preview purposes. Not recommended for production use.",
                    children: <InlineDemo />,
                    relevantProps: ["aria-label", "animationVariant"],
                },
            ]}
            props={LAYERMODAL_PROPS}
        />
    );
}
