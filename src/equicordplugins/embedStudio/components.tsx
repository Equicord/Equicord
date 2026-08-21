/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { classes } from "@utils/misc";
import { TextInput, Tooltip } from "@webpack/common";
import type { ComponentType, PropsWithChildren, ReactNode } from "react";

import { cl } from "./utils";

interface IconButtonProps {
    tooltip: string;
    icon: ComponentType<{ width?: number; height?: number; }>;
    onClick: () => void;
    disabled?: boolean;
    variant?: "secondary" | "dangerSecondary";
}

export function IconButton({ tooltip, icon: Icon, onClick, disabled, variant = "secondary" }: IconButtonProps) {
    return (
        <Tooltip text={tooltip}>
            {tooltipProps => (
                <Button
                    {...tooltipProps}
                    aria-label={tooltip}
                    variant={variant}
                    size="iconOnly"
                    disabled={disabled}
                    onClick={() => {
                        tooltipProps.onClick();
                        onClick();
                    }}
                >
                    <Icon width={16} height={16} />
                </Button>
            )}
        </Tooltip>
    );
}

export function Section({ title, children }: PropsWithChildren<{ title: string; }>) {
    return (
        <section className={cl("section")}>
            <Heading>{title}</Heading>
            {children}
        </section>
    );
}

interface LabeledInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    maxLength?: number;
}

export function LabeledInput({ label, value, onChange, placeholder, maxLength }: LabeledInputProps) {
    return (
        <div className={cl("input")}>
            <div className={cl("input-label")}>
                <span>{label}</span>
                {maxLength !== undefined && <Counter used={value.length} max={maxLength} />}
            </div>
            <TextInput
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                maxLength={null}
                aria-label={label}
            />
        </div>
    );
}

export function Counter({ used, max }: { used: number; max: number; }) {
    return (
        <span className={classes(cl("counter"), used > max ? cl("counter-over") : null)}>
            {used} / {max}
        </span>
    );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode; }) {
    if (value === undefined || value === null || value === "") return null;
    return (
        <div className={cl("info-row")}>
            <span className={cl("info-label")}>{label}</span>
            <span className={cl("info-value")}>{value}</span>
        </div>
    );
}
