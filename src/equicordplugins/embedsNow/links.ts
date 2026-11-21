/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const SITES = {
    spotify: { name: "Spotify", description: "Embeds tracks, albums, artists, playlists, podcast episodes, shows, profiles and share links." },
    twitter: { name: "X/Twitter", description: "Embeds posts with their photos or video, and profiles." },
    instagram: { name: "Instagram", description: "Embeds posts, reels, carousels, profiles and share links." },
    tiktok: { name: "TikTok", description: "Embeds videos, photo posts, profiles and share links." },
    reddit: { name: "Reddit", description: "Embeds posts, comment links, user profiles and share links." },
    facebook: { name: "Facebook", description: "Embeds public posts, videos, reels, pages, profiles and share links." },
    threads: { name: "Threads", description: "Embeds posts and profiles." },
    bluesky: { name: "Bluesky", description: "Embeds posts and profiles." },
    mastodon: { name: "Mastodon", description: "Embeds posts from the larger servers, such as mastodon.social." },
    pinterest: { name: "Pinterest", description: "Embeds pins and pin.it share links." },
    linkedin: { name: "LinkedIn", description: "Embeds public posts and lnkd.in share links." },
    tumblr: { name: "Tumblr", description: "Embeds posts." },
    youtube: { name: "YouTube", description: "Embeds community posts and channels. Videos keep Discord's own player and only have tracking removed." }
} as const;

export type Site = keyof typeof SITES;

export type LinkOptions = Readonly<Record<Site | "stripTracking" | "shortLinks", boolean>>;

interface Rule {
    site: Site;
    hosts: readonly string[];
    path: RegExp;
    host?: string;
    keep?: readonly string[];
    needs?: string;
    trim?: RegExp;
    cleanOnly?: true;
}

const DOMAIN = "embeds.now";

const SHORT_CODES = new Map([
    ["open.spotify.com", "sp"],
    ["spotify.link", "sl"],
    ["x.com", "x"],
    ["twitter.com", "tw"],
    ["instagram.com", "i"],
    ["tiktok.com", "tt"],
    ["vm.tiktok.com", "vm"],
    ["vt.tiktok.com", "vt"],
    ["reddit.com", "r"],
    ["redd.it", "rd"],
    ["facebook.com", "fb"],
    ["fb.watch", "fw"],
    ["threads.com", "th"],
    ["bsky.app", "bs"],
    ["mastodon.social", "ma"],
    ["pinterest.com", "pi"],
    ["pin.it", "pn"],
    ["linkedin.com", "li"],
    ["lnkd.in", "ld"],
    ["tumblr.com", "tb"],
    ["youtube.com", "yt"]
]);

const SHORT_HOSTS = new Map(Array.from(SHORT_CODES, ([host, code]) => [code, host]));

const SHARE_CODE = /^\/[\w-]+\/?$/;

const X_PATH = /^\/(?:(?:\w{1,15}|i(?:\/web)?)\/status(?:es)?\/\d+|(?!(?:home|explore|search|notifications|messages|settings|compose|hashtag|i|intent|login|logout|signup|share|tos|privacy|jobs|premium|communities|bookmarks|lists)\/?$)\w{1,15}\/?$)/i;

const FACEBOOK_HOSTS = ["facebook.com", "m.facebook.com", "web.facebook.com", "fb.com"];

const MASTODON_HOSTS = [
    "mastodon.social", "mastodon.online", "mstdn.social", "mas.to", "fosstodon.org", "hachyderm.io", "infosec.exchange",
    "techhub.social", "universeodon.com", "mastodon.world", "social.vivaldi.net", "mstdn.party", "pawoo.net", "mastodon.cloud",
    "chaos.social", "sigmoid.social", "ruby.social", "floss.social", "toot.community", "mastodon.art", "mastodon.gamedev.place",
    "newsie.social", "social.tchncs.de", "mamot.fr", "piaille.fr", "det.social", "mstdn.jp", "troet.cafe"
];

const PINTEREST_HOSTS = [
    "*.pinterest.com",
    ...[
        "com", "co.uk", "ca", "de", "fr", "it", "es", "com.au", "jp", "com.mx", "com.br", "nl", "se", "pt", "ie", "nz", "ph", "pl",
        "at", "ch", "dk", "ru", "cl", "co.kr"
    ].map(tld => `pinterest.${tld}`)
];

const RULES: readonly Rule[] = [
    {
        site: "spotify",
        hosts: ["open.spotify.com", "play.spotify.com", "embed.spotify.com"],
        host: "open.spotify.com",
        path: /^\/(?:intl-[\w-]+\/)?(?:embed\/)?(?:track|album|artist|playlist|episode|show|user)\/[^/]+/i
    },
    { site: "spotify", hosts: ["spotify.link", "spotify.app.link"], path: SHARE_CODE },
    { site: "twitter", hosts: ["x.com", "mobile.x.com"], host: "x.com", path: X_PATH },
    { site: "twitter", hosts: ["twitter.com", "mobile.twitter.com"], host: "twitter.com", path: X_PATH },
    {
        site: "instagram",
        hosts: ["instagram.com", "instagr.am"],
        host: "instagram.com",
        path: /^\/(?:(?:[\w.]+\/)?(?:p|reels?|tv)\/(?!audio\/)[\w-]+|share\/(?:(?:p|reels?|tv)\/)?[\w-]+|(?!(?:explore|accounts|direct|stories|reels?|p|tv|share|about|developer|legal|web|challenge|privacy|emails|session|oauth|directory|create)\/?$)[\w.]{1,30}\/?$)/i,
        keep: ["img_index"]
    },
    {
        site: "tiktok",
        hosts: ["tiktok.com", "m.tiktok.com"],
        host: "tiktok.com",
        path: /^\/(?:@[\w.-]+(?:\/(?:video|photo)\/\d+|\/?$)|(?:v|embed(?:\/v2)?)\/\d+|t\/[\w-]+)/i
    },
    { site: "tiktok", hosts: ["vm.tiktok.com", "vt.tiktok.com"], path: SHARE_CODE },
    { site: "tiktok", hosts: ["t.tiktok.com"], path: /^\/(?:[\w-]+\/?$|i18n\/share\/video\/\d+)/i },
    {
        site: "reddit",
        hosts: ["reddit.com", "old.reddit.com", "new.reddit.com", "np.reddit.com", "m.reddit.com"],
        host: "reddit.com",
        path: /^\/(?:(?:r|u|user)\/[\w-]+\/(?:comments|s)\/\w+|comments\/\w+|(?:u|user)\/[\w-]+\/?$)/i
    },
    { site: "reddit", hosts: ["redd.it"], path: SHARE_CODE },
    {
        site: "facebook",
        hosts: FACEBOOK_HOSTS,
        host: "facebook.com",
        path: /^\/(?:[\w.-]+\/(?:posts|videos)\/[\w.-]+|(?:reel|videos)\/\d+|share\/[prv]\/[\w-]+)/i
    },
    { site: "facebook", hosts: FACEBOOK_HOSTS, host: "facebook.com", path: /^\/watch\/?$/i, keep: ["v"], needs: "v" },
    {
        site: "facebook",
        hosts: FACEBOOK_HOSTS,
        host: "facebook.com",
        path: /^\/(?!(?:watch|groups|marketplace|gaming|events|friends|messages|notifications|settings|login|logout|reels|stories|share|sharer|photo|photos|pages|business|policies|privacy|legal|search|hashtag|bookmarks|saved|memories|fundraisers|people|places|video|videos|dialog|plugins|recover|checkpoint|terms|about|careers|mobile|notes|media|offers|games|developers|directory|adsmanager|campaign)\/?$|[\w.]*\.php\/?$)[a-z\d.]{5,}\/?$/i
    },
    { site: "facebook", hosts: ["fb.watch"], path: SHARE_CODE },
    {
        site: "threads",
        hosts: ["threads.com", "threads.net"],
        host: "threads.com",
        path: /^\/(?:@[\w.]+(?:\/post\/[\w-]+|\/?$)|(?:share|t)\/[\w-]+)/i
    },
    { site: "bluesky", hosts: ["bsky.app"], path: /^\/profile\/[\w.:-]+(?:\/post\/\w+)?\/?$/i },
    { site: "mastodon", hosts: MASTODON_HOSTS, path: /^\/(?:@\w+(?:@[\w.-]+)?|users\/\w+\/statuses)\/\d+/i },
    { site: "pinterest", hosts: PINTEREST_HOSTS, host: "pinterest.com", path: /^\/pin\/[\w-]+/i, trim: /\/sent\/?$/i },
    { site: "pinterest", hosts: ["pin.it"], path: SHARE_CODE },
    {
        site: "linkedin",
        hosts: ["linkedin.com", "*.linkedin.com"],
        host: "linkedin.com",
        path: /^\/(?:posts\/[^/]+|(?:embed\/)?feed\/update\/urn:li:(?:activity|share|ugcPost):\d+)/i
    },
    { site: "linkedin", hosts: ["lnkd.in"], path: /^\/(?:p\/)?[\w-]+\/?$/ },
    { site: "tumblr", hosts: ["tumblr.com"], path: /^\/[\w-]+\/\d+/ },
    { site: "tumblr", hosts: ["*.tumblr.com"], path: /^\/post\/\d+/ },
    {
        site: "youtube",
        hosts: ["youtube.com", "m.youtube.com"],
        host: "youtube.com",
        path: /^\/(?:post\/[\w-]+|(?:@[\w.-]+|channel\/UC[\w-]{22}|user\/\w+)(?:\/(?:featured|videos|shorts|streams|playlists|community|posts|podcasts|releases|store|about))?\/?$)/i,
        keep: ["lb"]
    },
    {
        site: "youtube",
        hosts: ["youtube.com", "m.youtube.com", "music.youtube.com"],
        path: /^\/(?:(?:watch|playlist)\/?$|(?:shorts|live|embed)\/[\w-]+\/?$)/i,
        keep: ["v", "t", "start", "end", "list", "index"],
        cleanOnly: true
    },
    { site: "youtube", hosts: ["youtu.be"], path: SHARE_CODE, keep: ["t", "start", "list", "index"], cleanOnly: true }
];

const RULES_BY_HOST = new Map<string, Rule[]>();
for (const rule of RULES)
    for (const host of rule.hosts)
        RULES_BY_HOST.set(host, [...RULES_BY_HOST.get(host) ?? [], rule]);

const LINK = /(`{3}[\s\S]*?`{3}|`{2}[\s\S]*?`{2}|`[^`]*`)|https?:\/\/[^\s<>|`]+[^\s<>|`.,:;"')\]]/gi;

const normalizeHost = (hostname: string) => hostname.replace(/^www\./, "");

function findRule(url: URL) {
    const host = normalizeHost(url.hostname);
    return (RULES_BY_HOST.get(host) ?? RULES_BY_HOST.get(`*${host.slice(host.indexOf("."))}`))
        ?.find(rule => rule.path.test(url.pathname) && (!rule.needs || url.searchParams.has(rule.needs)));
}

function unwrap(url: URL) {
    const host = normalizeHost(url.hostname);
    if (host === DOMAIN) return URL.parse(`https:/${url.pathname}${url.search}`);
    const target = host.endsWith(`.${DOMAIN}`) && SHORT_HOSTS.get(host.slice(0, -DOMAIN.length - 1));
    return target ? URL.parse(`https://${target}${url.pathname}${url.search}`) : null;
}

function cleanPath(url: URL, rule: Rule) {
    const query = url.search.slice(1).split("&").filter(pair => {
        const key = pair.split("=", 1)[0];
        return key === "refresh" || rule.keep?.includes(key);
    }).join("&");
    return (rule.trim ? url.pathname.replace(rule.trim, "/") : url.pathname) + (query && `?${query}`);
}

function embedUrl(host: string, path: string, short: boolean) {
    const code = short ? SHORT_CODES.get(host) : undefined;
    return code ? `https://${code}.${DOMAIN}${path}` : `https://${DOMAIN}/${host}${path}`;
}

function rewriteLink(raw: string, options: LinkOptions, embed: boolean) {
    const url = URL.parse(raw);
    if (!url) return raw;

    const wrapped = unwrap(url);
    const target = wrapped ?? url;
    const rule = findRule(target);
    if (!rule) return raw;

    const path = options.stripTracking ? cleanPath(target, rule) : target.pathname + target.search + target.hash;
    const result = !rule.cleanOnly && (wrapped || (embed && options[rule.site]))
        ? embedUrl(rule.host ?? normalizeHost(target.hostname), path, options.shortLinks)
        : `${target.protocol}//${target.host}${path}`;

    return result === url.href ? raw : result;
}

export function rewriteLinks(content: string, options: LinkOptions, embed: boolean) {
    if (!embed && !options.stripTracking) return content;

    return content.replace(LINK, (match: string, code: string | undefined, offset: number) => {
        if (code) return match;
        const suppressed = content[offset - 1] === "<" && content[offset + match.length] === ">";
        return rewriteLink(match, options, embed && !suppressed);
    });
}
