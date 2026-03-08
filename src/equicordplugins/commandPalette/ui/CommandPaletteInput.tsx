/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import { TextInput } from "@webpack/common";
import { type FocusEventHandler, forwardRef, type MouseEventHandler, type ReactNode } from "react";

const cl = classNameFactory("vc-command-palette-");

interface CommandPaletteInputProps {
    value: string;
    onChange(value: string): void;
    placeholder?: string;
    autoFocus?: boolean;
    inputClassName?: string;
    readOnly?: boolean;
    onInputFocus?: FocusEventHandler<HTMLInputElement>;
    onInputBlur?: FocusEventHandler<HTMLInputElement>;
    onInputClick?: MouseEventHandler<HTMLInputElement>;
    children?: ReactNode;
}

export const CommandPaletteInput = forwardRef<HTMLInputElement, CommandPaletteInputProps>(function CommandPaletteInput({
    value,
    onChange,
    placeholder,
    autoFocus = true,
    inputClassName,
    readOnly = false,
    onInputFocus,
    onInputBlur,
    onInputClick,
    children
}, ref) {
    return (
        <div className={cl("input")}>
            <div className={cl("main-input")}>
                <TextInput
                    ref={ref}
                    className={classes(cl("main-search-input"), inputClassName)}
                    autoFocus={autoFocus}
                    value={value}
                    onChange={onChange}
                    readOnly={readOnly}
                    placeholder={placeholder ?? "Search commands or type a query"}
                    onFocus={onInputFocus}
                    onBlur={onInputBlur}
                    onClick={onInputClick}
                />
            </div>
            {children}
        </div>
    );
});
