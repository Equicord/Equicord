/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2026 Vendicated and contributors
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

import assert from "node:assert/strict";
import test from "node:test";

import { getDescendantFolderIds, sanitizeNestedFolderMap } from "./nestedFolders";

test("sanitizeNestedFolderMap drops entries that target missing folders", () => {
    const map = sanitizeNestedFolderMap({
        "2": "1",
        "999": "1",
        "3": "404"
    }, new Set(["1", "2", "3"]));

    assert.deepEqual(map, { "2": "1" });
});

test("sanitizeNestedFolderMap drops cyclic entries", () => {
    const map = sanitizeNestedFolderMap({
        "2": "1",
        "1": "2",
        "3": "2"
    }, new Set(["1", "2", "3"]));

    assert.deepEqual(map, {
        "1": "2",
        "3": "2"
    });
});

test("getDescendantFolderIds does not loop on cyclic input", () => {
    const descendants = getDescendantFolderIds({
        "1": "2",
        "2": "1",
        "3": "2"
    }, "1");

    assert.deepEqual(descendants.sort(), ["2", "3"]);
});
