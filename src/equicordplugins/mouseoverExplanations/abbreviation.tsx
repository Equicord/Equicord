/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Tooltip } from "@webpack/common";
import type { ReactElement } from "react";

export interface AbbreviationProps {
    abbreviation: string;
    desc: string;
}
export default function Abbreviation({
    abbreviation,
    desc,
}: AbbreviationProps): ReactElement {
    return (
        <Tooltip text={desc}>
            {tooltipProps => (
                <span
                    {...tooltipProps}
                    style={{
                        color: "var(--text-normal)",
                        userSelect: "text",
                    }}
                >
                    {abbreviation}
                </span>
            )}
        </Tooltip>
    );
}
