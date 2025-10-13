/* eslint-disable simple-header/header */
/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * BD Compatibility Layer plugin
 * Copyright (c) 2023-2025 Davvy and WhoIsThis
 * Copyright (c) 2025 Pharaoh2k
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { React, useMemo, useState } from "@webpack/common";

export function RadioSettingComponent(props: {
    onChange: (value: any) => void;
    option: any;
    pluginSettings: any;
    id: string;
}) {
    const disabled = !!props.option?.disabled;
    const [selected, setSelected] = useState<any>(props.option?.value ?? null);

    const options = useMemo(() => {
        const raw = props.option?.options || [];
        return raw.map(opt =>
            typeof opt === "object"
                ? { name: opt.name || opt.label || String(opt.value), value: opt.value, desc: opt.desc || opt.description || "" }
                : { name: String(opt), value: opt, desc: "" }
        );
    }, [props.option?.options]);

    const commit = (val: any) => {
        if (disabled) return;
        setSelected(val);
        props.onChange(val);
    };

    const groupId = `radio-${props.id}`;
    const labelId = `${groupId}-label`;
    const descId = `${groupId}-desc`;

    return (
        <div style={{ display: "grid", gap: "8px", opacity: disabled ? 0.5 : 1 }}>

            <div role="radiogroup" aria-labelledby={labelId} aria-describedby={descId} style={{ display: "grid", gap: "8px" }}>
                {options.map((opt, i) => {
                    const checked = selected === opt.value;
                    const radioId = `${groupId}-${i}`;

                    return (
                        <label
                            key={i}
                            htmlFor={radioId}
                            role="radio"
                            aria-checked={checked}
                            tabIndex={disabled ? -1 : 0}
                            onKeyDown={e => { /* unchanged */ }}
                            onClick={() => commit(opt.value)}
                            style={{
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "8px 12px",
                                borderRadius: "4px",
                                background: checked ? "var(--background-modifier-selected)" : "var(--background-base-lower)",
                                cursor: disabled ? "not-allowed" : "pointer",
                                outline: "1px solid var(--background-tertiary)"
                            }}
                        >
                            <input
                                id={radioId}
                                type="radio"
                                name={groupId}
                                checked={checked}
                                onChange={() => commit(opt.value)}
                                disabled={disabled}
                                style={{
                                    position: "absolute",
                                    opacity: 0,
                                    width: 0,
                                    height: 0,
                                    pointerEvents: "none",
                                    appearance: "none" as any
                                }}
                            />
                            <span
                                aria-hidden="true"
                                style={{
                                    width: "16px",
                                    height: "16px",
                                    borderRadius: "9999px",
                                    boxSizing: "border-box",
                                    border: `2px solid ${checked ? "var(--brand-500)" : "var(--interactive-normal)"}`,
                                    background: checked ? "var(--brand-500)" : "transparent",
                                    flex: "0 0 auto"
                                }}
                            />
                            <span style={{ display: "grid", gap: "2px", color: "var(--text-default)" }}>
                                <span style={{ fontWeight: 600, fontSize: "1rem", lineHeight: 1.4 }}>{opt.name}</span>
                                {opt.desc && <span style={{ fontSize: "0.875rem", lineHeight: 1.3, opacity: 0.75 }}>{opt.desc}</span>}
                            </span>
                        </label>
                    );
                })}
            </div>

            <div id={descId} style={{ fontSize: "0.875rem", opacity: 0.7, color: "var(--text-muted)" }}>
                Use ↑/↓ or ←/→ to move, Space/Enter to select.
            </div>
        </div >
    );
}
