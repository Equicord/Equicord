/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { sid } from "./util";

var version = "2.0.0";

function clean(link) {
	const url = new URL(link);
	url.protocol = "https";
	url.username = url.password = url.port = url.search = url.hash = "";
	return url.toString().replace(/\/?$/, "");
}
let makeRequest = fetch;
/**
* Lets you to set a custom `fetch()` function. Useful for passing requests through Electron's [net.fetch](https://www.electronjs.org/docs/latest/api/net#netfetchinput-init) for example.
* @example ```ts
* import { net } from "electron";
*
* setFetchHandler(net.fetch as unknown as typeof fetch);
* ```
*/
function setFetchHandler(fetcher) {
	makeRequest = fetcher;
}
async function request(options) {
	if (options.body) {
		const body = JSON.stringify(options.body);
		options.body = body;
		options.headers ??= {};
		options.headers["content-type"] ??= "application/json";
		options.headers["content-length"] ??= String(body.length);
	}
	const url = new URL(options.url);
	for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
	const res = await makeRequest(url, {
		method: options.method,
		redirect: "follow",
		headers: {
			"accept": "*/*",
			"user-agent": `SongSpotlight/${version}`,
			"cache-control": "public, max-age=3600",
			...options.headers ?? {}
		},
		cf: {
			cacheTtl: 3600,
			cacheEverything: true
		},
		body: options.body
	});
	const text = await res.text();
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		json = null;
	}
	return {
		ok: res.ok,
		redirected: res.redirected,
		url: res.url,
		status: res.status,
		headers: res.headers,
		text,
		json
	};
}
function parseNextData(html) {
	const data = html.match(/id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/)?.[1];
	if (!data) return void 0;
	try {
		return JSON.parse(data);
	} catch {
		return;
	}
}
const PLAYLIST_LIMIT = 15;

const $ = {
	services: [],
	parsers: []
};
const parseCache = /* @__PURE__ */ new Map();
const validateCache = /* @__PURE__ */ new Map();
/**
* Tries to parse the provided **link**. Returns a **Song** if successful, or `null` if nothing was found. Either response is temporarily cached.
* @example ```ts
* await parseLink("https://soundcloud.com/c0ncernn");
* // { service: "soundcloud", type: "user", id: "914653456" }
* ```
*/
async function parseLink(link) {
	const cleaned = clean(link);
	if (parseCache.has(cleaned)) return parseCache.get(cleaned);
	const { hostname, pathname } = new URL(cleaned);
	const path = pathname.slice(1).split(/\/+/);
	let song = null;
	for (const parser of $.parsers) if (parser.hosts.includes(hostname)) {
		song = await parser.parse(cleaned, hostname, path);
		if (song) break;
	}
	parseCache.set(cleaned, song);
	if (song) validateCache.set(sid(song), true);
	return song;
}
const renderCache = /* @__PURE__ */ new Map();
/**
* Tries to render the provided **Song**. Returns `RenderSongInfo` if successful, or `null` if nothing was found. Either response is temporarily cached.
* @example ```ts
* await renderSong({ service: "soundcloud", type: "user", id: "914653456" });
* // { label: "leroy", sublabel: "Top tracks", explicit: false, form: "list", ... }
* ```
*/
async function renderSong(song) {
	const id = sid(song);
	if (renderCache.has(id)) return renderCache.get(id);
	let info = null;
	const service = $.services.find(x => x.name === song.service);
	if (service?.types.includes(song.type)) info = await service.render(song.type, song.id);
	renderCache.set(id, info);
	if (song) validateCache.set(sid(song), true);
	return info;
}
/**
* Validates if the provided **Song** exists. Returns a `boolean` depending on if the check was successful or not. Either response is temporarily cached.
* @example ```ts
* await renderSong({ service: "soundcloud", type: "user", id: "914653456" });
* // true
* ```
*/
async function validateSong(song) {
	const id = sid(song);
	if (validateCache.has(id)) return validateCache.get(id);
	let valid = false;
	const service = $.services.find(x => x.name === song.service);
	if (service?.types.includes(song.type)) valid = await service.validate(song.type, song.id);
	validateCache.set(id, valid);
	return valid;
}
/** Clears the cache for all handler functions */
function clearCache() {
	parseCache.clear();
	renderCache.clear();
	validateCache.clear();
}

export { $, clearCache, parseLink, parseNextData, PLAYLIST_LIMIT, renderSong, request, setFetchHandler, validateSong };
