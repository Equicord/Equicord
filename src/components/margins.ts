/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

import { classNameFactory } from "@utils/css";

const marginCls = classNameFactory("vc-margin-");

const Directions = ["top", "bottom", "left", "right"] as const;
const Sizes = [4, 8, 16, 20, 24, 40, 60] as const;

export type MarginDirection = (typeof Directions)[number];
export type MarginSize = (typeof Sizes)[number];

export const Margins = {} as Record<`${MarginDirection}${MarginSize}` | "reset" | "centerHorz", string>;

export function generateMarginCss() {
    let css = "";

    for (const direction of Directions) {
        for (const size of Sizes) {
            const cl = marginCls(`${direction}-${size}`);
            Margins[`${direction}${size}`] = cl;
            css += `.${cl}{margin-${direction}:${size}px;}`;
        }
    }

    Margins.reset = marginCls("reset");
    css += `.${Margins.reset}{margin:0;}`;

    Margins.centerHorz = marginCls("center-horz");
    css += `.${Margins.centerHorz}{margin-left:auto;margin-right:auto;}`;

    return css;
}
