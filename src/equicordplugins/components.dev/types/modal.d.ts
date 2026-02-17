/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type NativeModalSize = "sm" | "md";

export type ModalActionVariant = "primary" | "secondary" | "critical-primary" | "critical-secondary";

export interface ModalAction {
    text: string;
    variant: ModalActionVariant;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
}

export interface ModalNotice {
    message: string;
    type: "info" | "warn" | "critical" | "positive";
}

export type ModalAnimationVariant = "default" | "fade" | "slide-up";

export type ModalMaxHeight = "default" | "full";

export interface ModalProps {
    title: string;
    subtitle?: string;
    size?: NativeModalSize;
    transitionState?: number;
    animationVariant?: ModalAnimationVariant;
    paddingSize?: "sm" | "lg";
    fullScreenOnMobile?: boolean;
    maxHeight?: ModalMaxHeight;
    dismissable?: boolean;
    children?: React.ReactNode;
    actions?: ModalAction[];
    actionBarInput?: React.ReactNode;
    actionBarInputLayout?: "default" | "full-width";
    input?: React.ReactNode;
    preview?: React.ReactNode;
    listProps?: Record<string, any>;
    notice?: ModalNotice;
    onClose: () => void;
    onScroll?: (e: React.UIEvent) => void;
    scrollerRef?: React.Ref<HTMLDivElement>;
    returnRef?: React.Ref<HTMLElement>;
    role?: string;
    "aria-label"?: string;
    className?: string;
}

export interface ConfirmModalProps extends Omit<ModalProps, "actions" | "transitionState"> {
    transitionState?: number;
    confirmText: string;
    cancelText?: string;
    onConfirm?: (setError?: (error: string) => void) => void | Promise<void>;
    onCancel?: () => void;
    onCloseCallback?: () => void;
    variant?: "critical" | "primary" | "secondary";
    checkboxProps?: {
        label: string;
        checked: boolean;
        onChange: (checked: boolean) => void;
    };
}

export type ExpressiveGradientColor = "purple" | "blue" | "pink" | "green";

export interface ModalGraphic {
    type: "image";
    src: string;
    aspectRatio?: string;
}

export interface ExpressiveModalProps {
    title: string;
    subtitle?: string;
    size?: NativeModalSize;
    transitionState?: number;
    gradientColor?: ExpressiveGradientColor;
    graphic?: ModalGraphic;
    badge?: React.ReactNode;
    actionBarInput?: React.ReactNode;
    actions?: ModalAction[];
    children?: React.ReactNode;
    onClose: () => void;
}

export interface OpenModalOptions {
    modalKey?: string;
    dismissable?: boolean;
    instant?: boolean;
    onCloseRequest?: () => void;
    onCloseCallback?: () => void;
    backdropStyle?: "default" | "dark" | "transparent";
    stackingBehavior?: "stack" | "replace";
    stackNextByDefault?: boolean;
    allowsNavigation?: boolean;
}

export type ModalRenderFn = (props: { onClose: () => void; transitionState: number }) => React.ReactNode;

export interface ModalAPI {
    openModal: (render: ModalRenderFn, options?: OpenModalOptions) => string;
    openModalLazy: (renderFactory: () => Promise<{ default: React.ComponentType<any> }>, options?: OpenModalOptions) => Promise<string>;
    closeModal: (modalKey: string) => void;
    closeAllModals: () => void;
    hasModalOpen: (modalKey: string) => boolean;
    hasAnyModalOpen: () => boolean;
}

export interface ModalComponents {
    Modal: React.ComponentType<ModalProps>;
    ConfirmModal: React.ComponentType<ConfirmModalProps>;
    ExpressiveModal: React.ComponentType<ExpressiveModalProps>;
}
