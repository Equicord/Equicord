/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "../settings.css";

import { Card } from "@components/Card";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { findComponentByCodeLazy } from "@webpack";
import { ColorPicker, React, Tooltip } from "@webpack/common";
import type { ComponentProps, JSX, ReactNode } from "react";

import { q } from "../utils/ui";

export function SettingsSection({ title, description, trailing, className, children }: { title: string; description?: string; trailing?: ReactNode; className?: string | string[]; children: ReactNode; }): JSX.Element {
    return (
        <Card className={q("settings-section", className)} role="region" aria-label={title}>
            <div className={q("settings-section-header")}>
                <div>
                    <Heading tag="h3" className={q("settings-section-title")}>{title}</Heading>
                    {description && <SettingsDescription>{description}</SettingsDescription>}
                </div>
                {trailing}
            </div>
            {children}
        </Card>
    );
}

export function SettingsDescription({ children }: { children: ReactNode; }): JSX.Element {
    return (
        <Paragraph className={q("setting-description")}>
            {children}
        </Paragraph>
    );
}

export function SettingsParagraph({ children, className, dimmed }: { children: ReactNode; className?: string | string[]; dimmed?: boolean; }): JSX.Element {
    return (
        <Paragraph className={q("setting-paragraph", className, { "dimmed-settings-item": dimmed })}>
            {children}
        </Paragraph>
    );
}

interface SettingsRowProps {
    children: ReactNode;
    className?: string | string[];
}

export function SettingsRow({ children, className }: SettingsRowProps): JSX.Element {
    return (
        <div className={q("settings-row", className)}>
            {children}
        </div>
    );
}

export function SettingsRowItem({
    children,
    className,
}: SettingsRowProps): JSX.Element {
    return (
        <div className={q("settings-row-item", className)}>
            {children}
        </div>
    );
}

export interface ManaSelectOption {
    id: string;
    value: string;
    label: string;
    disabled?: boolean;
}

export function toManaOptions(options: readonly { label: string; value: string | number; }[]): ManaSelectOption[] {
    return options.map(({ label, value }) => ({ id: String(value), label, value: String(value) }));
}

export interface ManaSelectFormattedOption extends ManaSelectOption {
    description?: ReactNode;
    leading?: ReactNode;
    trailing?: ReactNode;
}

export interface ManaSelectProps {
    id?: string;
    options: ManaSelectOption[];
    value?: string | string[] | null;
    onSelectionChange?: (value: string | string[] | null) => void;
    selectionMode?: "single" | "multiple";
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
    fullWidth?: boolean;
    closeOnSelect?: boolean;
    maxOptionsVisible?: number;
    wrapTags?: boolean;
    formatOption?: (option: ManaSelectOption) => ManaSelectFormattedOption;
    label?: string;
    hideLabel?: boolean;
}

export const ManaSelect = findComponentByCodeLazy('"data-mana-component":"select"') as React.ComponentType<ManaSelectProps>;

export function SettingsTooltip({ text, className, wide, children }: { text?: string; className?: string; wide?: boolean; children: ReactNode; }): JSX.Element {
    const targetElementRef = React.useRef<Element | null>(null);
    if (!text) return <div className={className}>{children}</div>;

    return (
        <Tooltip text={text} targetElementRef={targetElementRef} delay={500} position="top" tooltipClassName={q("settings-tooltip", wide ? "settings-tooltip-wide" : undefined)} tooltipContentClassName={q("settings-tooltip-content")}>
            {props => <div
                {...props}
                className={className}
                onMouseEnter={undefined}
                onMouseOver={event => {
                    if (!event.currentTarget.contains(event.target as Node)) return;
                    if (event.currentTarget.querySelector('[role="combobox"][aria-expanded="true"]')) {
                        targetElementRef.current = null;
                        props.onMouseLeave();
                        return;
                    }

                    const target = (event.target as Element).closest('[data-mana-component="tag"], [data-mana-component="select-input-field"], label') ?? event.currentTarget;
                    if (targetElementRef.current !== target) {
                        props.onMouseLeave();
                        targetElementRef.current = target;
                        props.onMouseEnter();
                    }
                }}
                onMouseLeave={() => {
                    targetElementRef.current = null;
                    props.onMouseLeave();
                }}
                onFocus={event => {
                    if (event.currentTarget.contains(event.target)
                        && !event.currentTarget.querySelector('[role="combobox"][aria-expanded="true"]')) {
                        targetElementRef.current = event.target.closest('[data-mana-component="tag"], [data-mana-component="select-input-field"], label') ?? event.currentTarget;
                        props.onFocus();
                    }
                }}
                onClickCapture={props.onBlur}
                onKeyDownCapture={props.onBlur}
            >{children}</div>}
        </Tooltip>
    );
}

export interface SettingsSelectProps extends ManaSelectProps {
    tooltip?: string;
    wideTooltip?: boolean;
    label: string;
    className?: string | string[];
}

export function SettingsSelect({ className, tooltip, wideTooltip, label, hideLabel, id, ...props }: SettingsSelectProps): JSX.Element {
    const generatedId = React.useId();
    const controlId = id ?? generatedId;

    return (
        <SettingsTooltip text={tooltip} wide={wideTooltip} className={q("settings-select", className)}>
            {!hideLabel && (
                <SettingsParagraph dimmed={props.disabled}>
                    <label htmlFor={controlId}>{label}</label>
                </SettingsParagraph>
            )}
            <ManaSelect selectionMode="single" fullWidth={true} wrapTags={true} clearable={false} {...props} id={controlId} label={label} hideLabel={true} />
        </SettingsTooltip>
    );
}

export interface SettingsColorPickerProps extends ComponentProps<typeof ColorPicker> {
    className?: string | string[];
    label?: ReactNode;
    labelClassName?: string | string[];
}

export function SettingsColorPicker({
    className,
    label,
    labelClassName,
    ...props
}: SettingsColorPickerProps): JSX.Element {
    return (
        <>
            {label != null && <SettingsParagraph className={labelClassName} dimmed={props.disabled}>{label}</SettingsParagraph>}
            <div className={q("settings-color-picker", className)}>
                <ColorPicker {...props} />
            </div>
        </>
    );
}

interface SwitchWithLabelProps {
    checked: boolean;
    onChange?: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
    description?: string;
    tooltip?: string;
}

const SwitchWithLabel = findComponentByCodeLazy("switchIconsEnabled:", ".hasIcon") as React.ComponentType<SwitchWithLabelProps>;

export function SettingsSubtleSwitch({ tooltip, ...props }: SwitchWithLabelProps): JSX.Element {
    return (
        <SettingsTooltip text={tooltip} className={q("setting-subtle-switch")}>
            <SwitchWithLabel {...props} />
        </SettingsTooltip>
    );
}

type ManaButtonVariant = "primary" | "secondary" | "critical-primary" | "critical-secondary" | "active" | "overlay-primary" | "overlay-secondary" | "expressive";

type ManaButtonSize = "xs" | "sm" | "md";

export interface ManaButtonProps {
    text?: string;
    variant?: ManaButtonVariant;
    size?: ManaButtonSize;
    disabled?: boolean;
    fullWidth?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    style?: React.CSSProperties;
}

export const ManaButton = findComponentByCodeLazy('"data-mana-component":"button"') as React.ComponentType<ManaButtonProps>;
