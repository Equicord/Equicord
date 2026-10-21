/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";

import type { DetailPageSpec } from "../../api/types";

const cl = classNameFactory("vc-cmdpal-");

export function DetailPage({ spec }: { spec: DetailPageSpec; }) {
    return (
        <div className={cl("detail")}>
            <div className={cl("detail-heading")}>{spec.heading}</div>
            {spec.body != null && <div className={cl("detail-body")}>{spec.body}</div>}
            {spec.rows && spec.rows.length > 0 && (
                <div className={cl("detail-rows")}>
                    {spec.rows.map(row => (
                        <div key={row.label} className={cl("detail-row")}>
                            <span className={cl("detail-row-label")}>{row.label}</span>
                            <span className={cl("detail-row-value")}>{row.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
