/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { $, parseLink, parseNextData, PLAYLIST_LIMIT, request } from "./finders";
import type { SongParser, SongService } from "./types";

const songdotlink: SongParser = {
	name: "song.link",
	label: "song.link",
	hosts: [
		"song.link",
		"album.link",
		"artist.link",
		"pods.link",
		"playlist.link",
		"mylink.page",
		"odesli.co"
	],
	async parse(link: string, _host: string, path: string[]) {
		const [first, second, third] = path;
		if (!first || third) return null;
		if (second && Number.isNaN(+second)) return null;
		else if (!second && (!first.match(/^[A-z0-9-_]+$/) || first.match(/^[-_]/) || first.match(/[-_]$/))) return null;
		const html = (await request({ url: link })).text;
		const sections = parseNextData(html)?.props?.pageProps?.pageData?.sections;
		if (!sections) return null;
		const links = sections.flatMap(x => x.links ?? []).filter(x => x.url && x.platform);
		const valid = links.find(x => x.platform === "spotify") ?? links.find(x => x.platform === "soundcloud") ?? links.find(x => x.platform === "appleMusic");
		if (!valid) return null;
		return await parseLink(valid.url);
	}
};

const handlerCache = /* @__PURE__ */ new Map<string, unknown>();
function makeCache(name: string, retrieve: (...args: any[]) => any) {
	return { retrieve(...args) {
		if (handlerCache.has(name)) return handlerCache.get(name);
		const res = retrieve(...args);
		if (res instanceof Promise) return res.then(ret => {
			handlerCache.set(name, ret);
			return ret;
		});
		else {
			handlerCache.set(name, res);
			return res;
		}
	} };
}

const geo = "us", defaultName = "songspotlight";
function applemusicLink(type: string, id: string) {
	return `https://music.apple.com/${geo}/${type}/${defaultName}/${id}`;
}
const applemusicToken = makeCache("applemusicToken", async (html?: string) => {
	html ??= (await request({ url: `https://music.apple.com/${geo}/new` })).text;
	const asset = html.match(/src="(\/assets\/index~\w+\.js)"/i)?.[1];
	if (!asset) return;
	return (await request({ url: `https://music.apple.com${asset}` })).text.match(/\w+="(ey.*?)"/i)?.[1];
});
const applemusic: SongService = {
	name: "applemusic",
	label: "Apple Music",
	hosts: ["music.apple.com", "geo.music.apple.com"],
	types: [
		"artist",
		"album",
		"playlist",
		"song"
	],
	async parse(_link: string, _host: string, path: string[]) {
		const [country, type, name, id, fourth] = path;
		if (!country || !type || !this.types.includes(type) || !name || !id || fourth) return null;
		const res = await request({ url: applemusicLink(type, id) });
		if (res.status !== 200) return null;
		await applemusicToken.retrieve(res.text);
		return {
			service: this.name,
			type,
			id
		};
	},
	async render(type: string, id: string) {
		const token = await applemusicToken.retrieve();
		if (!token) return null;
		const res = await request({
			url: `https://amp-api.music.apple.com/v1/catalog/${geo}/${type}s`,
			query: {
				include: "songs",
				ids: id
			},
			headers: {
				authorization: `Bearer ${token}`,
				origin: "https://music.apple.com"
			}
		});
		if (res.status !== 200) return null;
		const { attributes, relationships } = res.json.data[0];
		const base = {
			label: attributes.name,
			sublabel: attributes.artistName ?? "Top songs",
			link: attributes.url,
			explicit: attributes.contentRating === "explicit"
		};
		const thumbnailUrl = attributes.artwork?.url?.replace(/{[wh]}/g, "128");
		if (type === "song") {
			const duration = attributes.durationInMillis, previewUrl = attributes.previews?.[0]?.url;
			return {
				form: "single",
				...base,
				thumbnailUrl,
				single: { audio: previewUrl && duration ? {
					previewUrl,
					duration
				} : void 0 }
			};
		} else return {
			form: "list",
			...base,
			thumbnailUrl,
			list: (relationships.tracks?.data ?? relationships.songs?.data ?? []).slice(0, PLAYLIST_LIMIT).map(({ attributes }) => {
				const duration = attributes.durationInMillis, previewUrl = attributes.previews?.[0]?.url;
				return {
					label: attributes.name,
					sublabel: attributes.artistName,
					link: attributes.url,
					explicit: attributes.contentRating === "explicit",
					audio: previewUrl && duration ? {
						previewUrl,
						duration
					} : void 0
				};
			})
		};
	},
	async validate(type: string, id: string) {
		return (await request({ url: applemusicLink(type, id) })).status === 200;
	}
};

const client_id = "nIjtjiYnjkOhMyh5xrbqEW12DxeJVnic";
async function parseWidget(type: string, id: string, tracks: boolean) {
	return (await request({
		url: `https://api-widget.soundcloud.com/${type}s/${id}${tracks ? "/tracks" : ""}`,
		query: {
			format: "json",
			client_id,
			app_version: "1768986291",
			limit: "20"
		}
	})).json;
}
async function parsePreview(transcodings: any[]) {
	const preview = transcodings.sort((a, b) => {
		const isA = a.format.protocol === "progressive";
		const isB = b.format.protocol === "progressive";
		return isA && !isB ? -1 : isB && !isA ? 1 : 0;
	})?.[0];
	if (preview?.url && preview?.duration) {
		const link = (await request({
			url: preview.url,
			query: { client_id }
		})).json;
		if (!link?.url) return;
		return {
			duration: preview.duration,
			previewUrl: link.url
		};
	}
}
const soundcloud: SongService = {
	name: "soundcloud",
	label: "Soundcloud",
	hosts: [
		"soundcloud.com",
		"m.soundcloud.com",
		"on.soundcloud.com"
	],
	types: [
		"user",
		"track",
		"playlist"
	],
	async parse(link: string, host: string, path: string[]) {
		if (host === "on.soundcloud.com") {
			if (!path[0] || path[1]) return null;
			const { url, status } = await request({ url: link });
			return status === 200 ? await parseLink(url) : null;
		} else {
			const [user, second, track, fourth] = path;
			let valid = false;
			if (user && !second) valid = true;
			else if (user && second && second !== "sets" && !track) valid = true;
			else if (user && second === "sets" && track && !fourth) valid = true;
			if (!valid) return null;
			const data = (await request({
				url: "https://soundcloud.com/oembed",
				query: {
					format: "json",
					url: link
				}
			})).json;
			if (!data?.html) return null;
			const rawUrl = data.html.match(/w\.soundcloud\.com.*?url=(.*?)[&"]/)?.[1];
			if (!rawUrl) return null;
			const splits = decodeURIComponent(rawUrl).split(/\/+/);
			const kind = splits[2], id = splits[3];
			if (!kind || !id) return null;
			return {
				service: this.name,
				type: kind.slice(0, -1),
				id
			};
		}
	},
	async render(type: string, id: string) {
		const data = await parseWidget(type, id, false);
		if (!data?.id) return null;
		const base = {
			label: data.title ?? data.username,
			sublabel: data.user?.username ?? "Top tracks",
			link: data.permalink_url,
			explicit: Boolean(data.publisher_metadata?.explicit)
		};
		const thumbnailUrl = data.artwork_url ?? data.avatar_url;
		if (type === "track") {
			const audio = await parsePreview(data.media?.transcodings ?? []).catch(() => void 0);
			return {
				form: "single",
				...base,
				thumbnailUrl,
				single: { audio }
			};
		} else {
			let tracks: any[] = [];
			if (type === "user") {
				const got = await parseWidget(type, id, true).catch(() => void 0);
				if (got?.collection) tracks = got.collection;
			} else if (data.tracks) tracks = data.tracks;
			return {
				form: "list",
				...base,
				thumbnailUrl,
				list: await Promise.all(tracks.filter(x => x.title).slice(0, PLAYLIST_LIMIT).map(async track => ({
					label: track.title,
					sublabel: track.user?.username ?? "unknown",
					link: track.permalink_url,
					explicit: Boolean(track.publisher_metadata.explicit),
					audio: await parsePreview(track.media?.transcodings ?? []).catch(() => void 0)
				})))
			};
		}
	},
	async validate(type: string, id: string) {
		return (await parseWidget(type, id, false))?.id !== void 0;
	}
};

async function parseEmbed(type: string, id: string) {
	return parseNextData((await request({ url: `https://open.spotify.com/embed/${type}/${id}` })).text);
}
function fromUri(uri: string) {
	const [sanityCheck, type, id] = uri.split(":");
	if (sanityCheck === "spotify" && type && id) return `https://open.spotify.com/${type}/${id}`;
	else return null;
}
const spotify: SongService = {
	name: "spotify",
	label: "Spotify",
	hosts: ["open.spotify.com"],
	types: [
		"track",
		"album",
		"playlist",
		"artist"
	],
	async parse(_link: string, _host: string, path: string[]) {
		const [type, id, third] = path;
		if (!type || !this.types.includes(type) || !id || third) return null;
		if (!await this.validate(type, id)) return null;
		return {
			service: this.name,
			type,
			id
		};
	},
	async render(type: string, id: string) {
		const data = (await parseEmbed(type, id))?.props?.pageProps?.state?.data?.entity;
		if (!data) return null;
		const base = {
			label: data.title,
			sublabel: data.subtitle ?? data.artists?.map(x => x.name).join(", "),
			link: fromUri(data.uri) ?? "https://open.spotify.com",
			explicit: Boolean(data.isExplicit)
		};
		const thumbnailUrl = data.visualIdentity.image.sort((a, b) => a.maxWidth - b.maxWidth)[0]?.url.replace(/:\/\/.*?\.spotifycdn\.com\/image/, "://i.scdn.co/image");
		if (type === "track") return {
			form: "single",
			...base,
			thumbnailUrl,
			single: { audio: data.audioPreview && data.duration ? {
				duration: data.duration,
				previewUrl: data.audioPreview.url
			} : void 0 }
		};
		else return {
			form: "list",
			...base,
			thumbnailUrl,
				list: (data.trackList ?? []).slice(0, PLAYLIST_LIMIT).map(track => ({
					label: track.title,
					sublabel: track.subtitle ?? track.artists?.map(x => x.name).join(", "),
					link: fromUri(track.uri) ?? "https://open.spotify.com",
					explicit: Boolean(track.isExplicit),
				audio: track.audioPreview && track.duration ? {
					duration: track.duration,
					previewUrl: track.audioPreview.url
				} : void 0
			}))
		};
	},
	async validate(type: string, id: string) {
		return !(await parseEmbed(type, id))?.props?.pageProps?.title;
	}
};

const services: SongService[] = [
	spotify,
	soundcloud,
	applemusic
];
$.services = services;
const parsers: SongParser[] = [songdotlink, ...services];
$.parsers = parsers;

export { parsers, services };
