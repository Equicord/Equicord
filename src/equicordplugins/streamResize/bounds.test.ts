/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { ASPECT_RATIO, computeBounds, sizeForPct } from "./bounds";

test("sizeForPct keeps 16:9 ratio", () => {
    const s = sizeForPct(1920, 1080, 50);
    assert.ok(Math.abs(s.w / s.h - ASPECT_RATIO) < 1e-6);
});

test("sizeForPct is width-limited on a square screen", () => {
    // 1000x1000: wByWidth=1000, wByHeight=1000*16/9≈1778 -> width wins
    const s = sizeForPct(1000, 1000, 100);
    assert.ok(Math.abs(s.w - 1000) < 1e-6);
});

test("sizeForPct is height-limited on an ultrawide screen", () => {
    // 3440x1440: wByWidth=3440, wByHeight=1440*16/9=2560 -> height wins
    const s = sizeForPct(3440, 1440, 100);
    assert.ok(Math.abs(s.w - 2560) < 1e-6);
    assert.ok(Math.abs(s.h - 1440) < 1e-6);
});

test("computeBounds maps minPct/maxPct to min/max sizes", () => {
    const b = computeBounds(1920, 1080, 20, 90);
    assert.ok(b.min.w < b.max.w);
    assert.ok(Math.abs(b.min.w / b.min.h - ASPECT_RATIO) < 1e-6);
    assert.ok(Math.abs(b.max.w / b.max.h - ASPECT_RATIO) < 1e-6);
});

test("computeBounds swaps when minPct > maxPct", () => {
    const swapped = computeBounds(1920, 1080, 90, 20);
    const ordered = computeBounds(1920, 1080, 20, 90);
    assert.ok(Math.abs(swapped.min.w - ordered.min.w) < 1e-6);
    assert.ok(Math.abs(swapped.max.w - ordered.max.w) < 1e-6);
});

test("computeBounds falls back when a screen dimension is 0", () => {
    const b = computeBounds(0, 1080, 20, 90);
    assert.equal(b.min.w, 320);
    assert.equal(b.max.w, 1280);
});
