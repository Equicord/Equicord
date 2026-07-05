/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";

import {
    isSafeFolderId,
    isSafeImageUrl,
    normalizePresetName,
    PRESET_NAME_MAX_LENGTH,
    sanitizeImageUrl,
    sanitizePresetForStorage,
} from "./sanitize";

assert.equal(isSafeFolderId("abc"), true);
assert.equal(isSafeFolderId("__proto__"), false);
assert.equal(isSafeFolderId("constructor"), false);

assert.equal(isSafeImageUrl("https://cdn.discordapp.com/avatars/1/2.png"), true);
assert.equal(isSafeImageUrl("http://evil.test/x.png"), false);
assert.equal(isSafeImageUrl("data:image/png;base64,abc"), true);
assert.equal(isSafeImageUrl("data:image/svg+xml;base64,abc"), false);
assert.equal(isSafeImageUrl("data:text/html;base64,abc"), false);
assert.equal(isSafeImageUrl("javascript:alert(1)"), false);
assert.equal(isSafeImageUrl('data:image/png;url("x")'), false);

assert.equal(sanitizeImageUrl("https://example.com/a.png"), "https://example.com/a.png");
assert.equal(sanitizeImageUrl("javascript:alert(1)"), null);

assert.equal(normalizePresetName("  hello  "), "hello");
assert.equal(normalizePresetName("").length > 0, true);
assert.equal(normalizePresetName("x".repeat(PRESET_NAME_MAX_LENGTH + 10)).length, PRESET_NAME_MAX_LENGTH);

const sanitized = sanitizePresetForStorage({
    name: "Test",
    timestamp: 1,
    bannerDataUrl: "javascript:alert(1)",
    avatarDataUrl: "https://cdn.discordapp.com/x.png",
    folderId: "__proto__",
} as never);
assert.equal(sanitized.bannerDataUrl, null);
assert.equal(sanitized.avatarDataUrl, "https://cdn.discordapp.com/x.png");
assert.equal(sanitized.folderId, null);

console.log("sanitize.test.ts: all assertions passed");
