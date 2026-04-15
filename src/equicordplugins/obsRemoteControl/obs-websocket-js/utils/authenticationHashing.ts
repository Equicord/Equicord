/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * SHA256 Hashing.
 * @param  {string} [salt=''] salt.
 * @param  {string} [challenge=''] challenge.
 * @param  {string} msg Message to encode.
 * @returns {string} sha256 encoded string.
 */
export default async function (salt: string, challenge: string, msg: string): Promise<string> {
	const hash = await sha256Hash(msg + salt);

	return await sha256Hash(hash + challenge);
}

async function sha256Hash(inputText) {
	const utf8 = new TextEncoder().encode(inputText);
	const hashBuffer = await crypto.subtle.digest("SHA-256", utf8);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const base64Hash = btoa(String.fromCharCode(...hashArray));
	return base64Hash;
}
