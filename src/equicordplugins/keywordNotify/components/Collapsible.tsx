/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./Collapsible.css";

import { TextButton } from "@components/Button";
import { Heading } from "@components/Heading";
import { useState } from "@webpack/common";

import { cl } from "..";

export function Collapsible({ title, children }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div>
            <TextButton
                onClick={() => setIsOpen(!isOpen)}
                className={cl("collapsible")}>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <div style={{
                        marginLeft: "auto",
                        color: "var(--text-muted)",
                        paddingRight: "5px"
                    }}>{isOpen ? "▼" : "▶"}</div>
                    <Heading tag="h4">{title}</Heading>
                </div>
            </TextButton>
            {isOpen && children}
        </div>
    );
}
