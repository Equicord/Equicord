/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { React } from "@webpack/common";

import { listBindings, setBinding } from "../utils/themeBindings";

export function BindingSettings() {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    const bindings = listBindings();

    if (!bindings.length) {
        return (
            <Paragraph>
                No preset-theme bindings yet. Open a preset&apos;s
                {" "}
                <strong>⋮</strong>
                {" "}
                menu and choose
                {" "}
                <strong>Equicord theme</strong>
                {" "}
                to assign one.
            </Paragraph>
        );
    }

    return (
        <>
            <HeadingSecondary>Assigned themes</HeadingSecondary>
            <Paragraph>
                These themes switch when you click the matching preset (pinned themes stay on too).
            </Paragraph>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {bindings.map(({ key, binding }) => (
                    <div
                        key={key}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "8px 12px",
                            borderRadius: 8,
                            background: "var(--background-mod-subtle)",
                        }}
                    >
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{key}</div>
                            <div style={{ opacity: 0.75, fontSize: 12 }}>
                                {binding.themeName ?? binding.themeId}
                                {" "}
                                (
                                {binding.type}
                                )
                            </div>
                        </div>
                        <button
                            type="button"
                            className="vc-settings-button"
                            onClick={() => {
                                setBinding(key, null);
                                forceUpdate();
                            }}
                        >
                            Remove
                        </button>
                    </div>
                ))}
            </div>
        </>
    );
}
