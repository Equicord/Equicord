/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    closeAllModals,
    ConfirmModal,
    ExpressiveModal,
    ManaButton,
    ManaTextInput,
    Modal,
    openModal,
    Paragraph,
    showToast,
    ToastType,
    useState,
} from "..";
import { DocPage, type PropDef, type PropGroup } from "../DocPage";

const MODAL_PROPS: PropDef[] = [
    { name: "title", type: "string", required: true, description: "Modal title displayed in the header." },
    { name: "onClose", type: "() => void", required: true, description: "Called when the modal should close." },
    { name: "subtitle", type: "string", description: "Subtitle text below the title." },
    { name: "size", type: '"sm" | "md"', description: "Modal width size." },
    { name: "transitionState", type: "number", description: "Animation state from openModal render props." },
    { name: "animationVariant", type: '"default" | "fade" | "slide-up"', default: '"default"', description: "Transition animation style." },
    { name: "paddingSize", type: '"sm" | "lg"', default: '"sm"', description: "Internal padding size." },
    { name: "fullScreenOnMobile", type: "boolean", default: "true", description: "Whether to go full screen on mobile." },
    { name: "maxHeight", type: '"default" | "full"', default: '"default"', description: "Maximum height constraint." },
    { name: "dismissable", type: "boolean", default: "true", description: "Whether the modal can be dismissed by clicking outside." },
    { name: "children", type: "ReactNode", description: "Modal body content." },
    { name: "actions", type: "ModalAction[]", description: "Array of action buttons in the footer." },
    { name: "actionBarInput", type: "ReactNode", description: "Input element in the action bar area." },
    { name: "actionBarInputLayout", type: '"default" | "full-width"', default: '"default"', description: "Layout of the action bar input." },
    { name: "notice", type: '{ message: string; type: "info" | "warn" | "critical" | "positive" }', description: "Notice banner shown at the top of the modal." },
    { name: "input", type: "ReactNode", description: "Input controls rendered in the header area." },
    { name: "preview", type: "ReactNode", description: "Preview content above the modal body." },
    { name: "onScroll", type: "(e: UIEvent) => void", description: "Scroll event handler for the modal body." },
    { name: "scrollerRef", type: "Ref<HTMLDivElement>", description: "Ref to the scroller element." },
    { name: "role", type: "string", default: '"dialog"', description: "ARIA role for the modal." },
    { name: "aria-label", type: "string", description: "ARIA label for the modal." },
    { name: "className", type: "string", description: "Custom CSS class." },
];

const CONFIRM_PROPS: PropDef[] = [
    { name: "title", type: "string", required: true, description: "Modal title." },
    { name: "confirmText", type: "string", required: true, description: "Text for the confirm button." },
    { name: "onClose", type: "() => void", required: true, description: "Called when the modal should close." },
    { name: "cancelText", type: "string", description: "Text for the cancel button." },
    { name: "variant", type: '"critical" | "primary" | "secondary"', description: "Visual style of the confirm button." },
    { name: "onConfirm", type: "() => void | Promise<void>", description: "Called when the confirm button is clicked. Can be async." },
    { name: "onCancel", type: "() => void", description: "Called when the cancel button is clicked." },
    { name: "checkboxProps", type: "{ label, checked, onChange }", description: "Optional checkbox in the modal body." },
    { name: "children", type: "ReactNode", description: "Body content." },
];

const EXPRESSIVE_PROPS: PropDef[] = [
    { name: "title", type: "string", required: true, description: "Modal title." },
    { name: "onClose", type: "() => void", required: true, description: "Called when the modal should close." },
    { name: "subtitle", type: "string", description: "Subtitle text below the title." },
    { name: "size", type: '"sm" | "md"', default: '"md"', description: "Modal width size." },
    { name: "transitionState", type: "number", description: "Animation state." },
    { name: "gradientColor", type: '"purple" | "blue" | "pink" | "green"', default: '"purple"', description: "Background gradient color." },
    { name: "graphic", type: '{ type: "image"; src: string; aspectRatio?: string }', description: "Image graphic shown above the content." },
    { name: "badge", type: "ReactNode", description: "Badge element shown near the title." },
    { name: "actionBarInput", type: "ReactNode", description: "Input element in the action bar area." },
    { name: "actions", type: "ModalAction[]", description: "Action buttons." },
    { name: "children", type: "ReactNode", description: "Modal body content." },
];

const ACTION_PROPS: PropDef[] = [
    { name: "text", type: "string", required: true, description: "Button text." },
    { name: "variant", type: '"primary" | "secondary" | "critical-primary" | "critical-secondary"', required: true, description: "Button style variant." },
    { name: "onClick", type: "() => void", required: true, description: "Click handler." },
    { name: "disabled", type: "boolean", description: "Disable the button." },
    { name: "loading", type: "boolean", description: "Show loading spinner." },
];

const PROP_GROUPS: PropGroup[] = [
    { title: "Modal", props: MODAL_PROPS },
    { title: "ConfirmModal", props: CONFIRM_PROPS },
    { title: "ExpressiveModal", props: EXPRESSIVE_PROPS },
    { title: "ModalAction", props: ACTION_PROPS },
];

function openBasicModal() {
    openModal(props => (
        <Modal
            title="Basic Modal"
            subtitle="This is a subtitle"
            transitionState={props.transitionState}
            onClose={props.onClose}
            actions={[
                { text: "Cancel", variant: "secondary", onClick: props.onClose },
                { text: "Confirm", variant: "primary", onClick: () => { showToast("Confirmed!", ToastType.SUCCESS); props.onClose(); } },
            ]}
        >
            <Paragraph>This is the modal body content. Any React components can go here.</Paragraph>
        </Modal>
    ));
}

function openNoticeModal() {
    openModal(props => (
        <Modal
            title="Modal with Notice"
            transitionState={props.transitionState}
            onClose={props.onClose}
            notice={{ message: "This is an informational notice", type: "info" }}
            actions={[{ text: "Got it", variant: "primary", onClick: props.onClose }]}
        >
            <Paragraph>Modals can display notices at the top for important information.</Paragraph>
        </Modal>
    ));
}

function ModalWithInputContent({ onClose, transitionState }: { onClose: () => void; transitionState: number; }) {
    const [inputValue, setInputValue] = useState("");
    return (
        <Modal
            title="Modal with Input"
            subtitle="Enter some information"
            transitionState={transitionState}
            onClose={onClose}
            actions={[
                { text: "Cancel", variant: "secondary", onClick: onClose },
                { text: "Submit", variant: "primary", onClick: () => { showToast(`Submitted: ${inputValue}`, ToastType.SUCCESS); onClose(); } },
            ]}
        >
            <ManaTextInput value={inputValue} onChange={setInputValue} placeholder="Type something..." />
        </Modal>
    );
}

function openConfirmCritical() {
    openModal(props => (
        <ConfirmModal
            title="Confirm Action"
            subtitle="Are you sure you want to proceed?"
            transitionState={props.transitionState}
            confirmText="Delete"
            cancelText="Cancel"
            variant="critical"
            onConfirm={() => showToast("Item deleted!", ToastType.SUCCESS)}
            onCancel={() => showToast("Cancelled", ToastType.MESSAGE)}
            onClose={props.onClose}
        >
            <Paragraph>This action cannot be undone. The item will be permanently deleted.</Paragraph>
        </ConfirmModal>
    ));
}

function openConfirmPrimary() {
    openModal(props => (
        <ConfirmModal
            title="Save Changes"
            transitionState={props.transitionState}
            confirmText="Save"
            variant="primary"
            onConfirm={() => showToast("Changes saved!", ToastType.SUCCESS)}
            onClose={props.onClose}
        >
            <Paragraph>Do you want to save your changes?</Paragraph>
        </ConfirmModal>
    ));
}

function openExpressive() {
    openModal(props => (
        <ExpressiveModal
            title="Welcome!"
            subtitle="This is an expressive modal with a more visual design."
            transitionState={props.transitionState}
            gradientColor="purple"
            actions={[{ text: "Get Started", variant: "primary", onClick: props.onClose }]}
            onClose={props.onClose}
        />
    ));
}

export default function ModalTab() {
    return (
        <DocPage
            componentName="Modal"
            overview="Discord's modal system includes Modal for general-purpose dialogs, ConfirmModal for confirmation flows, and ExpressiveModal for visual/onboarding experiences. All are opened via openModal() which handles backdrop, positioning, and transition states."
            notices={[
                { type: "warn", children: "Always use openModal() to display modals. It handles the backdrop, animation state, stacking context, and cleanup. Rendering modals inline will not work correctly." },
                { type: "info", children: "The transitionState prop from openModal's render callback must be forwarded to the modal component for enter/exit animations to work properly." },
            ]}
            importPath={'import { Modal, ConfirmModal, ExpressiveModal, openModal, closeModal, closeAllModals } from "../components";'}
            sections={[
                {
                    title: "Basic Modal",
                    description: "Simple modal with title, subtitle, body content, and action buttons.",
                    children: <ManaButton variant="secondary" text="Open Basic Modal" onClick={openBasicModal} />,
                    code: `openModal(props => (
  <Modal
    title="My Modal"
    subtitle="Subtitle text"
    transitionState={props.transitionState}
    onClose={props.onClose}
    actions={[
      { text: "Cancel", variant: "secondary", onClick: props.onClose },
      { text: "Confirm", variant: "primary", onClick: handleConfirm },
    ]}
  >
    <p>Modal content here</p>
  </Modal>
))`,
                    relevantProps: ["title", "subtitle", "actions"],
                },
                {
                    title: "Modal with Notice",
                    description: "A notice banner appears at the top of the modal for important info.",
                    children: <ManaButton variant="secondary" text="Open Modal with Notice" onClick={openNoticeModal} />,
                    relevantProps: ["notice"],
                },
                {
                    title: "Modal with Input",
                    description: "Modal with form controls in the body area.",
                    children: (
                        <ManaButton
                            variant="secondary"
                            text="Open Modal with Input"
                            onClick={() => openModal(props => (
                                <ModalWithInputContent onClose={props.onClose} transitionState={props.transitionState} />
                            ))}
                        />
                    ),
                },
                {
                    title: "ConfirmModal (Critical)",
                    description: "Confirmation dialog for destructive actions with danger styling.",
                    children: <ManaButton variant="critical-secondary" text="Open Confirm Modal" onClick={openConfirmCritical} />,
                    code: `openModal(props => (
  <ConfirmModal
    title="Delete Item?"
    confirmText="Delete"
    cancelText="Cancel"
    variant="critical"
    onConfirm={() => deleteItem()}
    onClose={props.onClose}
    transitionState={props.transitionState}
  >
    <p>This cannot be undone.</p>
  </ConfirmModal>
))`,
                    relevantProps: ["confirmText", "variant", "onConfirm"],
                },
                {
                    title: "ConfirmModal (Primary)",
                    description: "Confirmation dialog for non-destructive actions.",
                    children: <ManaButton variant="secondary" text="Open Save Dialog" onClick={openConfirmPrimary} />,
                },
                {
                    title: "ExpressiveModal",
                    description: "Visual modal for onboarding or promotional experiences.",
                    children: <ManaButton variant="secondary" text="Open Expressive Modal" onClick={openExpressive} />,
                    relevantProps: ["subtitle", "gradientColor", "graphic", "badge"],
                },
                {
                    title: "Close All Modals",
                    description: "Utility to close all open modals at once.",
                    children: <ManaButton variant="critical-secondary" text="Close All Modals" onClick={closeAllModals} />,
                    code: "closeAllModals();",
                },
            ]}
            props={PROP_GROUPS}
        />
    );
}
