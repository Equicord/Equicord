/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 VisaHolder
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { DataStore } from "@api/index";
import { addMessagePreSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { popNotice, showNotice } from "@api/Notices";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { Forms, MessageActions, React, RestAPI, UserProfileStore, UserStore } from "@webpack/common";

// Discord's CSP blocks fetch() to non-whitelisted hosts (steamcommunity.com, csfloat.com, etc.).
// Route all external calls through Vencord's native (Electron main-process) helper, which is CSP-free.
const Native = (window as any).VencordNative?.pluginHelpers?.SteamInventoryValue as PluginNative<typeof import("./native")> | undefined;

async function fetchJson(url: string, opts?: { method?: string; body?: any; headers?: Record<string, string> }): Promise<any> {
    const bodyStr = opts?.body != null ? JSON.stringify(opts.body) : undefined;
    if (Native?.fetchJson) return await Native.fetchJson(url, { method: opts?.method, body: bodyStr, headers: opts?.headers });
    // Fallback: renderer fetch — will fail for CSP-blocked hosts but worth a shot for whitelisted ones.
    const res = await fetch(url, {
        method: opts?.method || "GET",
        headers: { ...(bodyStr ? { "Content-Type": "application/json" } : {}), ...(opts?.headers ?? {}) },
        body: bodyStr,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
}

// ─── vsi-share cloud (cross-plugin trade URL / Steam sharing) ────────────────
const DEFAULT_SHARE_WORKER = "https://vsi-share.reap-dev.workers.dev";
const shareBase = () => (settings.store.shareWorkerUrl?.trim() || DEFAULT_SHARE_WORKER).replace(/\/+$/, "");
const cloudProfileCache = new Map<string, { data: any | null; ts: number }>();

async function getCloudSharedProfile(discordId: string): Promise<{ trade_url?: string; steam_id?: string } | null> {
    const ttl = 5 * 60_000;
    const hit = cloudProfileCache.get(discordId);
    if (hit && Date.now() - hit.ts < ttl) return hit.data;
    try {
        const data = await fetchJson(`${shareBase()}/profile/${discordId}`);
        const result = data?.found ? data : null;
        cloudProfileCache.set(discordId, { data: result, ts: Date.now() });
        return result;
    } catch {
        // 404 is expected for unpublished users — cache null to avoid re-hitting
        cloudProfileCache.set(discordId, { data: null, ts: Date.now() });
        return null;
    }
}

async function maybePromptForTradeUrl(): Promise<void> {
    // Only prompt if cloud share is on AND user hasn't set a trade URL yet AND we haven't shown it before.
    if (!settings.store.shareViaCloud) return;
    if (settings.store.tradeUrl?.trim()) return;
    const shown = await DataStore.get("vsi.tradePromptShown");
    if (shown) return;

    // Delay so the notice appears after Vencord finishes booting.
    setTimeout(() => {
        try {
            showNotice(
                "💼 Steam Inventory Value: paste your Steam trade URL into the plugin settings to publish it and see friends' trade offers.",
                "Open Settings",
                () => {
                    popNotice();
                    DataStore.set("vsi.tradePromptShown", true).catch(() => { });
                },
            );
        } catch (e) { console.warn("[VSI] notice failed", e); }
    }, 8000);
}

let lastPublishHash = "";
async function publishSharedProfile(): Promise<void> {
    if (!settings.store.shareViaCloud) return;
    const me = UserStore.getCurrentUser();
    if (!me?.id) return;

    const tradeUrl = settings.store.tradeUrl?.trim();
    const body: any = {
        discord_id: me.id,
        share_trade: !!settings.store.shareTradeUrl,
        share_steam: !!settings.store.shareSteamProfile,
    };
    if (tradeUrl) {
        body.trade_url = tradeUrl;
        try {
            const u = new URL(tradeUrl);
            const partner = u.searchParams.get("partner");
            if (partner && /^\d+$/.test(partner)) {
                body.steam_id = (76561197960265728n + BigInt(partner)).toString();
            }
        } catch { /* ignore malformed URL */ }
    }

    const hash = JSON.stringify(body);
    if (hash === lastPublishHash) return; // dedupe
    try {
        await fetchJson(`${shareBase()}/profile`, { method: "POST", body });
        lastPublishHash = hash;
    } catch (e) {
        console.error("[VSI] publish failed", e);
    }
}

async function fetchText(url: string): Promise<string> {
    if (Native?.fetchText) return await Native.fetchText(url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
}

interface SteamProfile { steamId: string; persona?: string; avatar?: string }

async function resolveSteamRef(input: string): Promise<SteamProfile | null> {
    let raw = input.trim().replace(/^@+/, "").replace(/\/+$/, "");
    // Strip protocol garbage so downstream regex is simpler
    raw = raw.replace(/^<|>$/g, "");

    let steamId: string | null = null;

    // Raw SteamID64 (17 digits starting with 7656)
    if (/^7656\d{13}$/.test(raw)) steamId = raw;

    // Trade URL: partner param → SteamID64
    if (!steamId) {
        const m = raw.match(/[?&]partner=(\d+)/);
        if (m) steamId = (76561197960265728n + BigInt(m[1])).toString();
    }

    // Profile URL: /profiles/76561...
    if (!steamId) {
        const m = raw.match(/\/profiles\/(7656\d{13})/);
        if (m) steamId = m[1];
    }

    // Vanity URL: /id/<name>, OR bare vanity name
    if (!steamId) {
        let vanity: string | null = null;
        const m = raw.match(/steamcommunity\.com\/id\/([^/?\s]+)/i);
        if (m) vanity = m[1];
        else if (!/[\s/]/.test(raw) && !/^\d+$/.test(raw)) vanity = raw;

        if (vanity) {
            try {
                const xml = await fetchText(`https://steamcommunity.com/id/${encodeURIComponent(vanity)}/?xml=1`);
                const m2 = xml.match(/<steamID64>(\d+)<\/steamID64>/);
                if (m2) steamId = m2[1];
            } catch (e) { console.warn("[VSI] vanity resolve failed", e); }
        }
    }

    if (!steamId) return null;

    // Fetch persona + avatar so the embed feels complete
    try {
        const xml = await fetchText(`https://steamcommunity.com/profiles/${steamId}/?xml=1`);
        const persona = xml.match(/<steamID>(?:<!\[CDATA\[)?([^\]<]+?)(?:\]\]>)?<\/steamID>/)?.[1];
        const avatar = xml.match(/<avatarFull>(?:<!\[CDATA\[)?([^\]<]+?)(?:\]\]>)?<\/avatarFull>/)?.[1];
        return { steamId, persona: persona?.trim(), avatar: avatar?.trim() };
    } catch {
        return { steamId };
    }
}

const settings = definePluginSettings({
    tradeUrl: {
        type: OptionType.STRING,
        description: "Your Steam trade offer URL. Grab it from steamcommunity.com/my/tradeoffers/privacy — this is what the Trade button opens.",
        default: "",
        placeholder: "https://steamcommunity.com/tradeoffer/new/?partner=...&token=...",
    },
    buttonTheme: {
        type: OptionType.SELECT,
        description: "Color scheme for the Trade and Steam buttons.",
        options: [
            { label: "Blurple — Discord's brand purple", value: "blurple", default: true },
            { label: "Green — success-style accent", value: "green" },
            { label: "Steam Blue — dark navy → sky-blue gradient", value: "steam" },
            { label: "Dark — matte black minimal", value: "dark" },
            { label: "Auto — follows your Discord accent", value: "auto" },
        ],
    },
    showOnOwnProfile: {
        type: OptionType.BOOLEAN,
        description: "Show the Trade + Steam button row on your own profile popout.",
        default: true,
    },
    showInventoryOnProfile: {
        type: OptionType.BOOLEAN,
        description: "Show the CS2 Inventory card (value, delta, top 5 items) on profile popouts — yours and friends'.",
        default: true,
    },

    // ── Sharing ─────────────────────────────────────────────────────────────
    shareViaCloud: {
        type: OptionType.BOOLEAN,
        description: "Publish your data to the vsi-share cloud. Requires a Trade URL set above.",
        default: true,
    },
    shareTradeUrl: {
        type: OptionType.BOOLEAN,
        description: "Include your Trade URL in what you publish. Turn off if you want to publish Steam profile only.",
        default: true,
    },
    shareSteamProfile: {
        type: OptionType.BOOLEAN,
        description: "Include a link to your Steam profile in what you publish.",
        default: true,
    },
    shareWorkerUrl: {
        type: OptionType.STRING,
        description: "Advanced: point at a self-hosted vsi-share Worker instead of the default. Leave blank for the hosted instance.",
        default: "",
        placeholder: "https://vsi-share.reap-dev.workers.dev",
    },

    // ── Prices ──────────────────────────────────────────────────────────────
    priceSource: {
        type: OptionType.SELECT,
        description: "Which marketplace's prices to use for /inventory.",
        options: [
            { label: "CSFloat — bulk (~300ms), refreshed hourly", value: "csfloat", default: true },
            { label: "Skinport — bulk (USD/GBP/EUR only)", value: "skinport" },
            { label: "Live Steam Market — always fresh, ~1min per inventory", value: "live_steam" },
        ],
    },
    marketCurrency: {
        type: OptionType.SELECT,
        description: "Currency for prices. CSFloat is USD-only under the hood — CSFloat mode ignores this. Steam Market and Skinport respect it.",
        options: [
            { label: "USD ($)", value: 1, default: true },
            { label: "CAD (C$)", value: 22 },
            { label: "GBP (£)", value: 2 },
            { label: "EUR (€)", value: 3 },
            { label: "AUD (A$)", value: 23 },
            { label: "CHF", value: 5 },
            { label: "PLN (zł)", value: 7 },
            { label: "BRL (R$)", value: 8 },
            { label: "SGD (S$)", value: 24 },
            { label: "JPY (¥)", value: 9 },
            { label: "RUB (₽)", value: 6 },
        ],
    },
    skinportPriceKind: {
        type: OptionType.SELECT,
        description: "Only applies when Price Source = Skinport. Which price to use.",
        options: [
            { label: "Suggested — Skinport's mid-market estimate", value: "suggested_price", default: true },
            { label: "Min — cheapest current listing", value: "min_price" },
            { label: "Median — middle of all listings", value: "median_price" },
            { label: "Mean — average of all listings", value: "mean_price" },
        ],
    },
    useLiveSteamFallback: {
        type: OptionType.BOOLEAN,
        description: "When on: after the bulk lookup, hit live Steam Market for anything the bulk feed missed (stickered/nametagged skins). Complete numbers but adds ~2s per missing item.",
        default: false,
    },
    csfloatApiKey: {
        type: OptionType.STRING,
        description: "Optional CSFloat API key (csfloat.com → Profile → Developer). When set, Doppler & Gamma Doppler knives are priced by their actual phase (Ruby/Sapphire/Black Pearl/Phase 1-4) instead of the generic blended price. Leave blank for generic prices.",
        default: "",
        placeholder: "CSFloat API key",
    },

    // ── Profile card behavior ───────────────────────────────────────────────
    showPriceChange: {
        type: OptionType.BOOLEAN,
        description: "Show a green/red delta chip when the total moved since your last /inventory run.",
        default: true,
    },
    showItemCount: {
        type: OptionType.BOOLEAN,
        description: 'Add "X items" to the card meta line.',
        default: false,
    },
    deltaMinAgeMinutes: {
        type: OptionType.NUMBER,
        description: 'Ignore snapshots newer than this when computing the delta. Prevents noisy "since 2m ago" deltas from back-to-back runs.',
        default: 60,
    },
    snapshotStalenessHours: {
        type: OptionType.NUMBER,
        description: "Mark the card as STALE if the last /inventory is older than this many hours. Set to 0 to never mark stale.",
        default: 24,
    },

    postPublicly: {
        type: OptionType.BOOLEAN,
        description: "When on: /inventory sends a real message to the channel (markdown, visible to everyone). When off: rich embed only you see.",
        default: false,
    },

    // ── Advanced ────────────────────────────────────────────────────────────
    priceCacheMinutes: {
        type: OptionType.NUMBER,
        description: "How long to keep the bulk price feed in memory before refetching. Skinport/CSFloat only refresh hourly on their end so 60 is fine.",
        default: 60,
    },
    requestDelayMs: {
        type: OptionType.NUMBER,
        description: "Live Steam Market only: delay between per-item requests, in milliseconds. 1600 keeps you under Steam's ~20/min rate limit. Bump if you 429.",
        default: 1600,
    },
});

// ─── /inventory command internals ─────────────────────────────────────────────

function getAccounts(profile: any): any[] {
    return profile?.connectedAccounts || profile?.connected_accounts || profile?.user?.connectedAccounts || [];
}

async function getSteamId(userId: string): Promise<string | null> {
    let profile: any = UserProfileStore.getUserProfile(userId);

    if (!getAccounts(profile).length) {
        const me = UserStore.getCurrentUser()?.id;
        const guildId = (window as any).Vencord?.Webpack?.Common?.SelectedGuildStore?.getGuildId?.() || "";
        const attempts: string[] = [];
        if (userId === me) attempts.push("/users/@me/profile");
        if (guildId) attempts.push(`/users/${userId}/profile?guild_id=${guildId}&with_mutual_guilds=false`);
        attempts.push(`/users/${userId}/profile?with_mutual_guilds=false`);
        attempts.push(`/users/${userId}/profile`);

        for (const url of attempts) {
            try {
                const res: any = await RestAPI.get({ url });
                const body = res?.body;
                if (body && getAccounts(body).length) {
                    profile = body;
                    break;
                }
                if (body) profile = body;
            } catch (e: any) {
                console.warn("[VSI] profile fetch failed", url, e?.status || e?.message || e);
            }
        }
    }

    const accounts = getAccounts(profile);
    const steam = accounts.find((c: any) => c.type === "steam" || c.type === "STEAM");
    return steam?.id ?? null;
}

// Session-scoped price memo for live Steam per-item lookups: keyed by "name|currency"
const priceMemo = new Map<string, { price: number; ts: number }>();

// Session-scoped bulk feed cache: keyed by "source|currency|kind"
type PriceMap = Map<string, number>;
let bulkCache: { key: string; prices: PriceMap; ts: number } | null = null;

// Steam Market currency ID → ISO 4217 code (used for Skinport's `currency=` query param).
function currencyCode(cur: number): string {
    return ({
        1: "USD", 2: "GBP", 3: "EUR", 5: "CHF", 6: "RUB", 7: "PLN", 8: "BRL",
        9: "JPY", 22: "CAD", 23: "AUD", 24: "SGD",
    } as Record<number, string>)[cur] || "USD";
}

async function loadCsfloatBulk(): Promise<PriceMap> {
    // CSFloat's price-list is USD only, in cents. Free, no auth.
    const url = "https://csfloat.com/api/v1/listings/price-list";
    const arr: any[] = await fetchJson(url);
    const map: PriceMap = new Map();
    for (const it of arr) {
        const name = it?.market_hash_name;
        const cents = it?.min_price;
        if (typeof name === "string" && typeof cents === "number" && cents > 0) {
            map.set(name, cents / 100);
        }
    }
    return map;
}

async function loadSkinportBulk(): Promise<PriceMap> {
    const kind = settings.store.skinportPriceKind || "suggested_price";
    // Fetch in USD; getBulkPrices applies the FX conversion so every bulk source shares one path.
    const url = "https://api.skinport.com/v1/items?app_id=730&currency=USD&tradable=0";
    const arr: any[] = await fetchJson(url);
    const map: PriceMap = new Map();
    for (const it of arr) {
        const name = it?.market_hash_name;
        const p = it?.[kind] ?? it?.suggested_price ?? it?.min_price;
        if (typeof name === "string" && typeof p === "number" && p > 0) map.set(name, p);
    }
    return map;
}

// USD→currency FX rate, cached 6h. Free, no-key endpoint. The bulk feeds (CSFloat, Skinport)
// are priced in USD, so we convert to the user's currency exactly the way CSFloat's own website
// does — a live FX multiply. Steam live-market prices are already native, so they skip this.
let fxCache: { code: string; rate: number; ts: number } | null = null;
async function getUsdRate(targetCode: string): Promise<number> {
    if (targetCode === "USD") return 1;
    if (fxCache && fxCache.code === targetCode && Date.now() - fxCache.ts < 6 * 3_600_000) return fxCache.rate;
    try {
        const data: any = await fetchJson("https://open.er-api.com/v6/latest/USD");
        const rate = data?.rates?.[targetCode];
        if (typeof rate === "number" && rate > 0) {
            fxCache = { code: targetCode, rate, ts: Date.now() };
            return rate;
        }
    } catch (e) {
        console.warn("[VSI] FX rate fetch failed, prices will show in USD", e);
    }
    return fxCache?.code === targetCode ? fxCache.rate : 1;
}

async function getBulkPrices(source: string): Promise<PriceMap> {
    const cur = settings.store.marketCurrency || 1;
    const kind = settings.store.skinportPriceKind || "suggested_price";
    const key = `${source}|${cur}|${kind}`;
    const ttl = (settings.store.priceCacheMinutes || 60) * 60_000;
    if (bulkCache && bulkCache.key === key && Date.now() - bulkCache.ts < ttl) {
        return bulkCache.prices;
    }
    let prices: PriceMap = new Map();
    if (source === "csfloat") prices = await loadCsfloatBulk();
    else if (source === "skinport") prices = await loadSkinportBulk();

    // Both bulk feeds are USD-denominated — convert to the user's chosen currency.
    const targetCode = currencyCode(cur);
    if (targetCode !== "USD" && prices.size) {
        const rate = await getUsdRate(targetCode);
        if (rate > 0 && rate !== 1) {
            const conv: PriceMap = new Map();
            for (const [k, v] of prices) conv.set(k, v * rate);
            prices = conv;
        }
    }
    bulkCache = { key, prices, ts: Date.now() };
    return prices;
}

function parseSteamPrice(raw: string): number {
    // "$12.34" → 12.34, "12,34€" → 12.34, "1,234.56" → 1234.56
    const cleaned = String(raw).replace(/[^\d.,]/g, "");
    // If both . and , present, assume . is thousands: "1,234.56" → 1234.56
    // If only , present, assume , is decimal: "12,34" → 12.34
    let normalized: string;
    if (cleaned.includes(".") && cleaned.includes(",")) {
        normalized = cleaned.replace(/,/g, "");
    } else if (cleaned.includes(",") && !cleaned.includes(".")) {
        normalized = cleaned.replace(",", ".");
    } else {
        normalized = cleaned;
    }
    const n = parseFloat(normalized);
    return isFinite(n) ? n : 0;
}

async function fetchSteamMarketPrice(marketHashName: string, currency: number): Promise<number> {
    const key = `${marketHashName}|${currency}`;
    const ttl = (settings.store.priceCacheMinutes || 15) * 60_000;
    const hit = priceMemo.get(key);
    if (hit && Date.now() - hit.ts < ttl) return hit.price;

    const url = `https://steamcommunity.com/market/priceoverview/?country=US&currency=${currency}&appid=730&market_hash_name=${encodeURIComponent(marketHashName)}`;
    try {
        const data = await fetchJson(url);
        if (!data?.success) { priceMemo.set(key, { price: 0, ts: Date.now() }); return 0; }
        const raw = data.lowest_price ?? data.median_price ?? "";
        const price = parseSteamPrice(raw);
        priceMemo.set(key, { price, ts: Date.now() });
        return price;
    } catch (e: any) {
        // Rate-limit or transient error — don't cache, so next run retries
        if (String(e?.message || e).includes("429")) throw new Error("Steam rate-limited (429). Wait a minute and re-run.");
        throw e;
    }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface InventoryResult {
    total: number;
    priced: number;
    count: number; // total assets Steam returned
    marketableCount: number; // assets that can actually be sold on Steam Market
    uniqueNames: number; // distinct marketable market_hash_names
    isPrivate: boolean;
    topItems: { name: string; price: number }[];
    unpriced: string[]; // marketable but no price found
    skippedNonMarketable: number; // medals/coins/badges filtered out
}

interface PricingOptions {
    source: string;
    useLiveFallback: boolean;
    onProgress?: (done: number, total: number) => void;
}

// ── Doppler / Gamma Doppler phase pricing ──────────────────────────────────────
// Steam gives every Doppler the same market_hash_name, so the phase (Ruby, Sapphire,
// Black Pearl, Emerald, Phase 1-4) is invisible in the item name — and phases differ
// wildly in value (a Ruby is worth 10x a Phase 3). The item's `icon_url` DOES differ
// per phase, so we map icon_url → phase using the community ByMykel dataset. Phase-
// specific prices then come from CSFloat's authenticated listings API (the user's
// free API key); without a key we fall back to the generic blended price.
interface PhaseInfo { phase: string; paintIndex: number }
let dopplerIconMap: Map<string, PhaseInfo> | null = null;
let dopplerMapPromise: Promise<Map<string, PhaseInfo>> | null = null;
async function getDopplerIconMap(): Promise<Map<string, PhaseInfo>> {
    if (dopplerIconMap) return dopplerIconMap;
    if (!dopplerMapPromise) {
        dopplerMapPromise = (async () => {
            const map = new Map<string, PhaseInfo>();
            try {
                const skins: any[] = await fetchJson("https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json");
                for (const s of skins) {
                    if (!s?.phase || !s?.image || s?.paint_index == null) continue;
                    const hash = String(s.image).split("/economy/image/")[1]?.split("/")[0];
                    if (hash) map.set(hash, { phase: s.phase, paintIndex: Number(s.paint_index) });
                }
            } catch (e) {
                console.warn("[VSI] Doppler phase map fetch failed — Dopplers will use generic prices", e);
            }
            dopplerIconMap = map;
            return map;
        })();
    }
    return dopplerMapPromise;
}
const isDopplerName = (name: string): boolean => /\bDoppler\b/i.test(name); // "Doppler" and "Gamma Doppler"

// CSFloat authenticated phase-specific lowest price (USD → user currency). Cached like the bulk feed.
// We filter by paint_index (the exact phase) — sorting the generic name by price would only ever
// surface the cheapest phases, never the user's Phase 2 / Ruby / Sapphire / Black Pearl.
const phasePriceCache = new Map<string, { price: number; ts: number }>();
async function getCsfloatPhasePrice(marketHashName: string, paintIndex: number): Promise<number | null> {
    const apiKey = (settings.store.csfloatApiKey || "").trim();
    if (!apiKey) return null;
    const cur = settings.store.marketCurrency || 1;
    const cacheKey = `${marketHashName}::${paintIndex}::${cur}`;
    const ttl = (settings.store.priceCacheMinutes || 60) * 60_000;
    const hit = phasePriceCache.get(cacheKey);
    if (hit && Date.now() - hit.ts < ttl) return hit.price;
    try {
        const url = `https://csfloat.com/api/v1/listings?sort_by=lowest_price&limit=1&market_hash_name=${encodeURIComponent(marketHashName)}&paint_index=${paintIndex}`;
        const resp: any = await fetchJson(url, { headers: { Authorization: apiKey } });
        const list: any[] = Array.isArray(resp) ? resp : (resp?.data ?? []);
        const cents = list[0]?.price;
        if (typeof cents !== "number" || cents <= 0) return null;
        let price = cents / 100; // CSFloat prices are USD cents
        const targetCode = currencyCode(cur);
        if (targetCode !== "USD") { const r = await getUsdRate(targetCode); if (r > 0) price *= r; }
        phasePriceCache.set(cacheKey, { price, ts: Date.now() });
        return price;
    } catch (e) {
        console.warn("[VSI] CSFloat phase price failed for", marketHashName, paintIndex, e);
        return null;
    }
}

async function loadInventory(steamId: string, opts: PricingOptions): Promise<InventoryResult> {
    const empty = (isPriv: boolean): InventoryResult => ({
        total: 0, priced: 0, count: 0, marketableCount: 0, uniqueNames: 0, isPrivate: isPriv, topItems: [], unpriced: [], skippedNonMarketable: 0,
    });

    // Steam's inventory endpoint PAGINATES. Without an explicit count it returns only a partial
    // first page (~a few hundred items) with `more_items: 1` — so large inventories silently lose
    // everything past that page (knives, gloves, and any newly-added item can land off-page).
    // We must pass count=2000 (Valve's per-request max; higher 400s) AND follow the `last_assetid`
    // cursor until the inventory is exhausted.
    const base = `https://steamcommunity.com/inventory/${steamId}/730/2?l=english&count=2000`;
    const assets: any[] = [];
    const descriptions: any[] = [];
    const seenDesc = new Set<string>();
    let startAssetId: string | undefined;
    let pages = 0;
    try {
        do {
            const url = startAssetId ? `${base}&start_assetid=${startAssetId}` : base;
            const page: any = await fetchJson(url);
            if (!page?.assets || !page?.descriptions) {
                if (pages === 0) return empty(true); // first page blocked → private / no CS2 inventory
                break;
            }
            assets.push(...page.assets);
            for (const d of page.descriptions) {
                const k = `${d.classid}_${d.instanceid}`;
                if (!seenDesc.has(k)) { seenDesc.add(k); descriptions.push(d); }
            }
            startAssetId = page.more_items ? String(page.last_assetid) : undefined;
            pages++;
            if (startAssetId) await sleep(600); // be gentle — Steam rate-limits inventory requests
        } while (startAssetId && pages < 8);
    } catch (e: any) {
        if (String(e?.message || e).includes("403")) return empty(true);
        if (assets.length === 0) throw e; // nothing fetched → surface the error; else price partial
    }
    if (assets.length === 0) return empty(true);
    const inv = { assets, descriptions };

    // Steam's `marketable` (0/1) tells us if the item can even be listed on the Market.
    // Medals, service coins, achievement badges, non-tradeable capsules etc. have marketable=0.
    // We skip those entirely — otherwise we'd hit CSFloat/Steam for nothing and pad the "missing" list.
    // For Dopplers we also resolve the phase from the icon so a Ruby isn't priced as a Phase 3.
    const dopMap = await getDopplerIconMap();
    interface Meta { name: string; marketable: boolean; phase: string | null; paintIndex: number | null }
    const metaByKey = new Map<string, Meta>();
    for (const d of inv.descriptions) {
        const name = d.market_hash_name;
        const dp = (isDopplerName(name) && d.icon_url) ? (dopMap.get(d.icon_url) ?? null) : null;
        metaByKey.set(`${d.classid}_${d.instanceid}`, {
            name,
            marketable: d.marketable === 1 || d.marketable === "1",
            phase: dp?.phase ?? null,
            paintIndex: dp?.paintIndex ?? null,
        });
    }

    // Group identical items. Dopplers group by name+phase so each phase is counted & priced on its own.
    interface Group { name: string; phase: string | null; paintIndex: number | null; qty: number }
    const groups = new Map<string, Group>();
    let marketableCount = 0;
    let skippedNonMarketable = 0;
    for (const a of inv.assets) {
        const meta = metaByKey.get(`${a.classid}_${a.instanceid}`);
        if (!meta) continue;
        if (!meta.marketable) { skippedNonMarketable++; continue; }
        marketableCount++;
        const gk = meta.phase ? `${meta.name}::${meta.phase}` : meta.name;
        const g = groups.get(gk);
        if (g) g.qty++;
        else groups.set(gk, { name: meta.name, phase: meta.phase, paintIndex: meta.paintIndex, qty: 1 });
    }
    const uniqueNames = [...new Set([...groups.values()].map(g => g.name))];

    // ── Generic (name-keyed) pricing: bulk feed first, live Steam Market for the misses. ──
    const priceByName = new Map<string, number>();
    const misses: string[] = [];
    if (opts.source !== "live_steam") {
        const bulk = await getBulkPrices(opts.source);
        for (const name of uniqueNames) {
            const p = bulk.get(name);
            if (p && p > 0) priceByName.set(name, p);
            else misses.push(name);
        }
    } else {
        misses.push(...uniqueNames);
    }
    const shouldRunLive = opts.source === "live_steam" || (opts.useLiveFallback && misses.length > 0);
    if (shouldRunLive && misses.length > 0) {
        const currency = settings.store.marketCurrency || 1;
        const delay = Math.max(500, settings.store.requestDelayMs || 1600);
        for (let i = 0; i < misses.length; i++) {
            const name = misses[i];
            try {
                const p = await fetchSteamMarketPrice(name, currency);
                if (p > 0) priceByName.set(name, p);
            } catch (e) {
                console.error("[VSI] live price fetch failed for", name, e);
            }
            opts.onProgress?.(i + 1, misses.length);
            if (i < misses.length - 1) await sleep(delay);
        }
    }

    // ── Per-group pricing. Doppler phases get a phase-specific CSFloat price (if a key is set),
    //    falling back to the generic name price; everything else uses the generic name price. ──
    const priceByGroup = new Map<string, number>();
    const hasKey = !!(settings.store.csfloatApiKey || "").trim();
    for (const [gk, g] of groups) {
        let p: number | null = null;
        if (g.phase && g.paintIndex != null && hasKey) {
            p = await getCsfloatPhasePrice(g.name, g.paintIndex);
            await sleep(350); // gentle on CSFloat's API
        }
        if (p == null) p = priceByName.get(g.name) ?? null;
        if (p != null) priceByGroup.set(gk, p);
    }

    // Everything not priced is unpriced.
    const unpriced: string[] = [];
    for (const [gk, g] of groups) if (!priceByGroup.has(gk)) unpriced.push(g.phase ? `${g.name} (${g.phase})` : g.name);

    let total = 0, priced = 0;
    const perItem: { name: string; price: number; qty: number }[] = [];
    for (const [gk, g] of groups) {
        const p = priceByGroup.get(gk);
        if (p == null) continue;
        total += p * g.qty;
        priced += g.qty;
        perItem.push({ name: g.phase ? `${g.name} (${g.phase})` : g.name, price: p, qty: g.qty });
    }
    perItem.sort((a, b) => (b.price * b.qty) - (a.price * a.qty));
    const topItems = perItem.slice(0, 5).map(i => ({ name: i.qty > 1 ? `${i.name} ×${i.qty}` : i.name, price: i.price * i.qty }));

    return {
        total,
        priced,
        count: inv.assets.length,
        marketableCount,
        uniqueNames: uniqueNames.length,
        isPrivate: false,
        topItems,
        unpriced: unpriced.slice(0, 5),
        skippedNonMarketable,
    };
}

function currencySymbol(c: number): string {
    return ({
        1: "$", 2: "£", 3: "€", 5: "CHF ", 6: "₽", 7: "zł ", 8: "R$",
        9: "¥", 22: "C$", 23: "A$", 24: "S$",
    } as Record<number, string>)[c] || "$";
}
const fmt = (n: number, cur = 1) => `${currencySymbol(cur)}${n.toFixed(2)}`;

function abbrevItem(name: string): string {
    return name
        .replace(/\(Factory New\)/gi, "(FN)")
        .replace(/\(Minimal Wear\)/gi, "(MW)")
        .replace(/\(Field-Tested\)/gi, "(FT)")
        .replace(/\(Well-Worn\)/gi, "(WW)")
        .replace(/\(Battle-Scarred\)/gi, "(BS)")
        .replace(/StatTrak™\s*/g, "ST ")
        .replace(/Souvenir\s+/g, "Souv ")
        .replace(/★\s*/g, "★ ");
}

// ─── Snapshot persistence for +/- delta ──────────────────────────────────────
interface Snapshot {
    total: number;
    priced: number;
    itemCount: number;
    marketableCount?: number;
    uniqueNames: number;
    ts: number;
    source: string;
    currency: number;
    topItems?: { name: string; price: number }[];
}

const snapKey = (steamId: string) => `vsi.snap.${steamId}`;

async function getSnapshots(steamId: string): Promise<Snapshot[]> {
    return (await DataStore.get(snapKey(steamId))) ?? [];
}

async function pushSnapshot(steamId: string, snap: Snapshot) {
    const list = await getSnapshots(steamId);
    list.unshift(snap);
    await DataStore.set(snapKey(steamId), list.slice(0, 20));
}

function humanAgo(ms: number): string {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    return `${d}d ago`;
}

function computeDelta(currentTotal: number, snaps: Snapshot[], minAgeMs: number): { delta: number; ago: string } | null {
    const now = Date.now();
    // First snapshot in `snaps` is the just-pushed current run; skip it and find something older than minAge.
    const prev = snaps.find(s => now - s.ts >= minAgeMs && s.total !== currentTotal);
    if (!prev) return null;
    return { delta: currentTotal - prev.total, ago: humanAgo(now - prev.ts) };
}

function formatDeltaText(delta: number, ago: string, cur: number): string {
    const sign = delta >= 0 ? "+" : "";
    const emoji = delta > 0 ? "📈" : delta < 0 ? "📉" : "➖";
    return `${emoji} ${sign}${fmt(delta, cur).replace(currencySymbol(cur), currencySymbol(cur))} since ${ago}`;
}

// ─── Trade button injection ───────────────────────────────────────────────────

const STEAM_ICON_SVG = "<svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M11.98 2C6.7 2 2.36 6.03 2 11.13l5.38 2.22a2.86 2.86 0 0 1 1.6-.48h.15l2.4-3.47v-.05a3.83 3.83 0 1 1 3.83 3.83h-.09l-3.42 2.44v.13a2.87 2.87 0 0 1-5.42 1.3L2.5 15.5A9.99 9.99 0 0 0 22 12c0-5.52-4.48-10-10.02-10ZM8.79 17.16l-1.22-.5a2.16 2.16 0 0 0 1.15 1.13c1.09.45 2.35-.06 2.8-1.16.22-.53.22-1.11 0-1.64a2.15 2.15 0 0 0-1.14-1.16 2.14 2.14 0 0 0-1.64.01l1.26.52a1.59 1.59 0 1 1-1.21 2.94v-.14Zm10.02-7.6a2.55 2.55 0 0 1-5.11 0 2.55 2.55 0 0 1 5.11 0Zm-4.47 0a1.92 1.92 0 1 0 3.83 0 1.92 1.92 0 0 0-3.83 0Z\"/></svg>";
const USER_ICON_SVG = "<svg viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2c0-2.76-3.58-5-8-5Z\"/></svg>";

// Match `steamcommunity.com/tradeoffer/new/?partner=...&token=...` anywhere in a string.
const TRADE_URL_RE = /https?:\/\/(?:www\.)?steamcommunity\.com\/tradeoffer\/new\/\?partner=\d+(?:&(?:amp;)?token=[A-Za-z0-9_-]+)?/i;

function extractTradeUrl(text: string | undefined | null): string | null {
    if (!text) return null;
    const m = text.match(TRADE_URL_RE);
    if (!m) return null;
    // Un-HTML-entity the &amp; that Discord bios sometimes contain.
    return m[0].replace(/&amp;/g, "&");
}

async function getTradeUrlForUser(userId: string): Promise<string | null> {
    // Try Vencord/Discord profile cache first, no network hit.
    const profile: any = UserProfileStore.getUserProfile(userId);
    let bio: string | undefined = profile?.bio ?? profile?.userProfile?.bio ?? profile?.user_profile?.bio;
    if (!bio) {
        // Fall through to a REST fetch (uses the same param dance as getSteamId).
        const guildId = (window as any).Vencord?.Webpack?.Common?.SelectedGuildStore?.getGuildId?.() || "";
        const attempts: string[] = [];
        if (guildId) attempts.push(`/users/${userId}/profile?guild_id=${guildId}&with_mutual_guilds=false`);
        attempts.push(`/users/${userId}/profile?with_mutual_guilds=false`);
        for (const url of attempts) {
            try {
                const res: any = await RestAPI.get({ url });
                const body = res?.body;
                bio = body?.user_profile?.bio ?? body?.userProfile?.bio ?? body?.bio;
                if (bio) break;
            } catch { /* try next */ }
        }
    }
    return extractTradeUrl(bio ?? null);
}

function deriveSteamProfileUrl(tradeUrl: string): string | null {
    try {
        const u = new URL(tradeUrl);
        const partner = u.searchParams.get("partner");
        if (!partner || !/^\d+$/.test(partner)) return null;
        const steamId64 = (76561197960265728n + BigInt(partner)).toString();
        return `https://steamcommunity.com/profiles/${steamId64}`;
    } catch {
        return null;
    }
}

const BUTTON_CSS = `
.vsi-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 8px 0 10px 0;
    padding: 0 12px;
    box-sizing: border-box;
    width: 100%;
}
.vsi-trade-row {
    display: flex;
    gap: 8px;
    margin: 0;
    width: 100%;
    box-sizing: border-box;
}
/* Only rows added from an async network fetch get the slide-in; sync (cache-hit) rows
   are rendered as .vsi-trade-row.instant and skip the animation entirely. */
.vsi-trade-row:not(.instant) {
    animation: vsi-row-in 0.32s cubic-bezier(.16,.84,.44,1) both;
}
@keyframes vsi-row-in {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
}
.vsi-trade-row > .vsi-trade-btn { min-width: 0; flex: 1 1 0; }
.vsi-trade-row > .vsi-trade-main { flex: 5 1 0; }
.vsi-trade-row > .vsi-trade-profile { flex: 3 1 0; }
.vsi-trade-row > .vsi-trade-btn:only-child { flex: 1 1 100%; }
.vsi-inv-card {
    display: flex;
    flex-direction: column;
    padding: 10px 12px 10px 12px;
    border-radius: 8px;
    font-family: var(--font-primary, "gg sans"), sans-serif;
    background: linear-gradient(180deg, rgba(255,255,255,.045) 0%, rgba(255,255,255,.02) 100%);
    border: 1px solid rgba(255,255,255,.06);
    color: var(--text-normal, #dbdee1);
    line-height: 1.25;
    user-select: none;
    cursor: default;
    overflow: hidden;
    box-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 1px 2px rgba(0,0,0,.15);
}
.vsi-inv-card .vsi-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.07em;
    color: var(--text-muted, #949ba4);
    text-transform: uppercase;
    margin-bottom: 6px;
}
.vsi-inv-card .vsi-card-header .vsi-refresh {
    display: inline-block;
    cursor: pointer;
    opacity: 0.55;
    font-size: 13px;
    padding: 1px 5px;
    border-radius: 4px;
    transition: opacity .12s ease, background .12s ease, color .12s ease;
    line-height: 1;
    transform-origin: 50% 50%;
    color: var(--text-muted, #949ba4);
    text-transform: none;
    letter-spacing: 0;
    user-select: none;
}
.vsi-inv-card .vsi-card-header .vsi-refresh:hover { opacity: 1; background: rgba(255,255,255,.08); color: var(--text-normal, #f2f3f5); }
.vsi-inv-card .vsi-card-header .vsi-refresh:active { background: rgba(88,101,242,.25); }
.vsi-inv-card.loading .vsi-refresh {
    animation: vsi-spin 0.9s linear infinite;
    opacity: 1;
    color: var(--brand-500, #5865F2);
    pointer-events: none;
}
@keyframes vsi-spin { to { transform: rotate(360deg); } }

.vsi-inv-card .vsi-value-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
}
.vsi-inv-card .vsi-value {
    font-size: 18px;
    font-weight: 800;
    color: var(--text-normal, #f2f3f5);
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
}
.vsi-inv-card .vsi-delta {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    font-variant-numeric: tabular-nums;
}
.vsi-inv-card .vsi-delta.up { color: #4ade80; background: rgba(35,165,90,.15); }
.vsi-inv-card .vsi-delta.down { color: #f87171; background: rgba(242,63,67,.15); }
.vsi-inv-card .vsi-meta {
    font-size: 11px;
    color: var(--text-muted, #949ba4);
    font-weight: 500;
    margin-bottom: 8px;
}
.vsi-inv-card .vsi-meta .vsi-stale-tag {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    background: rgba(240, 178, 42, .18);
    color: #f0b22a;
    letter-spacing: .06em;
    margin-left: 6px;
    vertical-align: 1px;
}
.vsi-inv-card .vsi-top-list {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-top: 6px;
    border-top: 1px solid rgba(255,255,255,.05);
}
.vsi-inv-card .vsi-top-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-size: 11.5px;
    font-weight: 500;
}
.vsi-inv-card .vsi-top-row .vsi-top-name {
    color: var(--text-normal, #dbdee1);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
}
.vsi-inv-card .vsi-top-row .vsi-top-price {
    color: var(--text-normal, #f2f3f5);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.vsi-inv-card .vsi-empty {
    font-size: 11.5px;
    color: var(--text-muted, #949ba4);
    padding: 4px 0 2px 0;
    text-align: center;
    font-style: italic;
}
.vsi-inv-card.stale { opacity: 0.85; }

/* Empty-state "Load inventory" button */
.vsi-inv-card .vsi-load-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    margin-top: 6px;
    padding: 7px 10px;
    border: none;
    border-radius: 6px;
    background: #5865F2;
    color: #fff;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background .15s ease, transform .1s ease;
}
.vsi-inv-card .vsi-load-btn:hover { background: #4752C4; }
.vsi-inv-card .vsi-load-btn:active { transform: translateY(1px); }
.vsi-inv-card .vsi-load-btn svg { flex-shrink: 0; }
.vsi-inv-card.loading .vsi-load-btn { opacity: .6; pointer-events: none; }

/* Loading skeleton */
.vsi-skel {
    background: linear-gradient(90deg,
        rgba(255,255,255,.06) 0%,
        rgba(255,255,255,.12) 50%,
        rgba(255,255,255,.06) 100%);
    background-size: 200% 100%;
    animation: vsi-shimmer 1.4s ease-in-out infinite;
    border-radius: 4px;
    display: inline-block;
}
@keyframes vsi-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
.vsi-skel-value { width: 90px; height: 20px; }
.vsi-skel-meta  { width: 140px; height: 11px; margin-top: 6px; }
.vsi-skel-row   { width: 100%; height: 14px; margin: 3px 0; opacity: .8; }

.vsi-trade-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    box-sizing: border-box;
    padding: 8px 12px;
    border-radius: 8px;
    font-family: var(--font-primary, "gg sans"), sans-serif;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1;
    text-decoration: none !important;
    cursor: pointer;
    user-select: none;
    border: 1px solid transparent;
    transition: transform .15s cubic-bezier(.4,.14,.3,1), box-shadow .15s ease, background .15s ease, filter .15s ease, border-color .15s ease;
    -webkit-app-region: no-drag;
    white-space: nowrap;
    box-shadow: 0 1px 0 rgba(255,255,255,.08) inset, 0 1px 2px rgba(0,0,0,.18);
}
.vsi-trade-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 1px 0 rgba(255,255,255,.11) inset, 0 5px 14px rgba(0,0,0,.28);
}
.vsi-trade-btn:active {
    transform: translateY(0);
    box-shadow: 0 1px 0 rgba(255,255,255,.05) inset, 0 1px 2px rgba(0,0,0,.18);
    filter: brightness(.94);
}
.vsi-trade-btn svg { transition: transform .15s ease; }
.vsi-trade-btn:hover svg { transform: scale(1.06); }

.vsi-trade-main { flex: 5 1 0; }
.vsi-trade-profile { flex: 3 1 0; }
.vsi-trade-btn:hover { transform: translateY(-1px); }
.vsi-trade-btn:active { transform: translateY(0); filter: brightness(.92); }
.vsi-trade-btn svg { flex-shrink: 0; }

.vsi-trade-btn.blurple { background: #5865F2; color: #fff; box-shadow: 0 2px 10px rgba(88,101,242,.35); }
.vsi-trade-btn.blurple:hover { background: #4752C4; box-shadow: 0 4px 14px rgba(88,101,242,.5); }

.vsi-trade-btn.green { background: #23A55A; color: #fff; box-shadow: 0 2px 10px rgba(35,165,90,.35); }
.vsi-trade-btn.green:hover { background: #1A8146; box-shadow: 0 4px 14px rgba(35,165,90,.5); }

.vsi-trade-btn.steam {
    background: linear-gradient(135deg, #1b2838 0%, #2a475e 55%, #3b8ac4 120%);
    color: #f5faff;
    border-color: rgba(102,192,244,.35);
    box-shadow: 0 2px 12px rgba(27,40,56,.55), inset 0 1px 0 rgba(255,255,255,.06);
}
.vsi-trade-btn.steam:hover {
    background: linear-gradient(135deg, #2a475e 0%, #3a6a8f 55%, #66c0f4 120%);
    box-shadow: 0 4px 18px rgba(102,192,244,.45), inset 0 1px 0 rgba(255,255,255,.08);
}

.vsi-trade-btn.dark {
    background: #111214;
    color: #f2f3f5;
    border-color: rgba(255,255,255,.06);
    box-shadow: 0 2px 10px rgba(0,0,0,.5);
}
.vsi-trade-btn.dark:hover { background: #1e1f22; border-color: rgba(255,255,255,.14); }

.vsi-trade-btn.auto {
    background: var(--brand-500, #5865F2);
    color: var(--white-500, #fff);
    box-shadow: 0 2px 10px color-mix(in srgb, var(--brand-500, #5865F2) 40%, transparent);
}
.vsi-trade-btn.auto:hover { background: var(--brand-600, #4752C4); }
`;

let styleEl: HTMLStyleElement | null = null;
let observer: MutationObserver | null = null;

// Set by the commands closure at module load — allows the preSend listener to invoke the same pipeline.
let csInvExec: ((ref: string, channelId: string) => Promise<void>) | null = null;
let preSendListener: ((channelId: string, message: any) => Promise<void | { cancel: boolean }>) | null = null;
let publishTimeout: ReturnType<typeof setTimeout> | null = null;
let publishInterval: ReturnType<typeof setInterval> | null = null;

function ensureStyle() {
    if (styleEl) return;
    styleEl = document.createElement("style");
    styleEl.id = "vsi-styles";
    styleEl.textContent = BUTTON_CSS;
    document.head.appendChild(styleEl);
}

function buildButton(shownUserId: string, isOwn: boolean, wantTradeRow: boolean, wantCard: boolean): HTMLElement {
    const theme = settings.store.buttonTheme || "blurple";
    const wrap = document.createElement("div");
    wrap.className = "vsi-wrap";
    wrap.dataset.vsi = "1";
    wrap.dataset.vsiUser = shownUserId;

    if (wantTradeRow) {
        const row = document.createElement("div");
        row.className = "vsi-trade-row";

        const trade = document.createElement("a");
        trade.className = `vsi-trade-btn ${theme} vsi-trade-main`;
        trade.href = settings.store.tradeUrl;
        trade.target = "_blank";
        trade.rel = "noopener noreferrer";
        trade.innerHTML = `${STEAM_ICON_SVG}<span>Send Trade Offer</span>`;
        row.appendChild(trade);

        const profileUrl = deriveSteamProfileUrl(settings.store.tradeUrl);
        if (profileUrl) {
            const prof = document.createElement("a");
            prof.className = `vsi-trade-btn ${theme} vsi-trade-profile`;
            prof.href = profileUrl;
            prof.target = "_blank";
            prof.rel = "noopener noreferrer";
            prof.title = "Open Steam profile";
            prof.innerHTML = `${USER_ICON_SVG}<span>Steam</span>`;
            row.appendChild(prof);
        }
        wrap.appendChild(row);
    }

    if (wantCard) {
        const card = document.createElement("div");
        card.className = "vsi-inv-card loading";
        card.dataset.vsiBadge = "1";
        card.innerHTML = `
            <div class="vsi-card-header">
                <span>💼 CS2 Inventory</span>
                <span class="vsi-refresh" title="Loading…">↻</span>
            </div>
            <div class="vsi-value-row"><span class="vsi-skel vsi-skel-value"></span></div>
            <div class="vsi-skel vsi-skel-meta"></div>
            <div class="vsi-top-list">
                <span class="vsi-skel vsi-skel-row"></span>
                <span class="vsi-skel vsi-skel-row"></span>
                <span class="vsi-skel vsi-skel-row"></span>
            </div>
        `;
        // Delegate refresh / load clicks at the card level so innerHTML rewrites don't kill the handler.
        card.addEventListener("click", e => {
            const t = e.target as HTMLElement | null;
            const hit = t?.closest?.(".vsi-refresh, .vsi-load-btn");
            if (hit) {
                e.stopPropagation();
                e.preventDefault();
                refreshCard(card, shownUserId, isOwn);
            }
        });
        wrap.appendChild(card);
        populateInventoryCard(card, shownUserId, isOwn).catch(e => console.error("[VSI] populateInventoryCard", e));
    }

    return wrap;
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!));
}

// Runs the same pricing pipeline as /inventory but for a given Discord user id, then persists a snapshot.
async function runInventoryForUser(shownUserId: string): Promise<void> {
    const steamId = await getSteamId(shownUserId);
    if (!steamId) throw new Error("no-steam");

    const validSources = new Set(["csfloat", "skinport", "live_steam"]);
    const stored = settings.store.priceSource as string;
    const source = validSources.has(stored) ? stored : "csfloat";
    const useLiveFallback = !!settings.store.useLiveSteamFallback;
    const cur = settings.store.marketCurrency || 1;

    const inv = await loadInventory(steamId, { source, useLiveFallback });
    if (inv.isPrivate) throw new Error("inventory-private");

    const snap: Snapshot = {
        total: inv.total,
        priced: inv.priced,
        itemCount: inv.count,
        marketableCount: inv.marketableCount,
        uniqueNames: inv.uniqueNames,
        ts: Date.now(),
        source,
        currency: cur,
        topItems: inv.topItems,
    };
    await pushSnapshot(steamId, snap);
}

async function refreshCard(card: HTMLElement, shownUserId: string, isOwn: boolean) {
    if (card.classList.contains("loading")) return; // already refreshing
    card.classList.add("loading");
    const refresh = card.querySelector<HTMLElement>(".vsi-refresh");
    const originalTitle = refresh?.title;
    if (refresh) refresh.title = "Refreshing…";
    try {
        await runInventoryForUser(shownUserId);
    } catch (e: any) {
        console.error("[VSI] refresh failed", e);
        if (e?.message === "no-steam") {
            card.innerHTML = `
                <div class="vsi-card-header"><span>💼 CS2 Inventory</span></div>
                <div class="vsi-empty">No visible Steam account on this profile.</div>
            `;
            card.classList.remove("loading");
            return;
        }
        if (e?.message === "inventory-private") {
            card.innerHTML = `
                <div class="vsi-card-header"><span>💼 CS2 Inventory</span><span class="vsi-refresh" title="Try again">↻</span></div>
                <div class="vsi-empty">Steam inventory is private.</div>
            `;
            card.classList.remove("loading");
            const r = card.querySelector<HTMLElement>(".vsi-refresh");
            if (r) r.addEventListener("click", () => refreshCard(card, shownUserId, isOwn));
            return;
        }
        // Generic failure — restore title, drop loading
        if (refresh && originalTitle) refresh.title = originalTitle;
    }
    card.classList.remove("loading");
    await populateInventoryCard(card, shownUserId, isOwn);
}

async function populateInventoryCard(card: HTMLElement, shownUserId: string, isOwn: boolean) {
    card.classList.remove("loading");
    const steamId = await getSteamId(shownUserId);
    if (!steamId) {
        card.innerHTML = `
            <div class="vsi-card-header"><span>💼 CS2 Inventory</span></div>
            <div class="vsi-empty">No visible Steam account on this profile.</div>
        `;
        return;
    }
    const snaps = await getSnapshots(steamId);
    const latest = snaps[0];
    if (!latest) {
        const who = isOwn ? "your" : "their";
        card.innerHTML = `
            <div class="vsi-card-header"><span>💼 CS2 Inventory</span></div>
            <div class="vsi-empty">No snapshot yet — load ${who} CS2 inventory to price it.</div>
            <button class="vsi-load-btn" type="button">${STEAM_ICON_SVG}<span>Load inventory</span></button>
        `;
        return;
    }

    const cur = latest.currency || 1;
    const ageMs = Date.now() - latest.ts;
    const staleH = settings.store.snapshotStalenessHours || 0;
    const isStale = staleH > 0 && ageMs > staleH * 3_600_000;
    if (isStale) card.classList.add("stale");

    let deltaHtml = "";
    if (settings.store.showPriceChange) {
        const minAge = (settings.store.deltaMinAgeMinutes || 60) * 60_000;
        const d = computeDelta(latest.total, snaps.slice(1), minAge);
        if (d) {
            const cls = d.delta > 0 ? "up" : d.delta < 0 ? "down" : "";
            const sign = d.delta >= 0 ? "+" : "";
            deltaHtml = `<span class="vsi-delta ${cls}">${sign}${fmt(d.delta, cur)}</span>`;
        }
    }

    const shortSource = latest.source === "csfloat" ? "CSFloat"
        : latest.source === "skinport" ? "Skinport"
        : latest.source === "live_steam" ? "Steam Live"
        : latest.source;

    const itemCountBit = settings.store.showItemCount
        ? ` · ${latest.marketableCount ?? latest.itemCount} items`
        : "";

    const staleTag = isStale ? "<span class=\"vsi-stale-tag\">STALE</span>" : "";

    const topItems = latest.topItems ?? [];
    const topHtml = topItems.length
        ? `<div class="vsi-top-list">${topItems.map(i => `
            <div class="vsi-top-row">
                <span class="vsi-top-name">${escapeHtml(abbrevItem(i.name))}</span>
                <span class="vsi-top-price">${fmt(i.price, cur)}</span>
            </div>
        `).join("")}</div>`
        : "<div class=\"vsi-empty\">Top items will show after next /inventory run.</div>";

    card.innerHTML = `
        <div class="vsi-card-header">
            <span>💼 CS2 Inventory</span>
            <span class="vsi-refresh" title="Refresh">↻</span>
        </div>
        <div class="vsi-value-row">
            <span class="vsi-value">${fmt(latest.total, cur)}</span>
            ${deltaHtml}
        </div>
        <div class="vsi-meta">${shortSource} · ${humanAgo(ageMs)}${itemCountBit}${staleTag}</div>
        ${topHtml}
    `;
}

function panelUserId(panel: HTMLElement): string | null {
    const withId = panel.querySelector<HTMLElement>("[data-user-id]");
    if (withId?.dataset.userId) return withId.dataset.userId;
    const img = panel.querySelector<HTMLImageElement>('img[src*="/avatars/"], img[src*="/users/"]');
    if (img) {
        const m = img.src.match(/\/(?:avatars|users)\/(\d{15,25})\//);
        if (m) return m[1];
    }
    return null;
}

function findLeaf(root: HTMLElement, textRegex: RegExp): HTMLElement | null {
    const all = root.querySelectorAll<HTMLElement>("*");
    for (const el of all) {
        if (el.children.length !== 0) continue;
        if (textRegex.test((el.textContent || "").trim())) return el;
    }
    return null;
}

function containerBlock(leaf: HTMLElement, boundary: HTMLElement): HTMLElement {
    // Walk up to the biggest sibling-level block that still isn't the whole popout.
    let node: HTMLElement = leaf;
    while (node.parentElement && node.parentElement !== boundary && node.offsetHeight < 24) {
        node = node.parentElement;
    }
    while (node.parentElement && node.parentElement !== boundary && (node.parentElement.children.length === 1)) {
        node = node.parentElement;
    }
    return node;
}

function findInsertionPoint(inner: HTMLElement): { parent: HTMLElement; before: Node | null } | null {
    // Priority 1: sit right above "Game Collection" section (below View Full Bio, above the section list)
    const gc = findLeaf(inner, /^Game Collection$/i);
    if (gc) {
        const block = containerBlock(gc, inner);
        if (block.parentElement) return { parent: block.parentElement, before: block };
    }
    // Priority 2: sit right below "View Full Bio"
    const vfb = findLeaf(inner, /^View Full Bio$/i);
    if (vfb) {
        const block = containerBlock(vfb, inner);
        if (block.parentElement) return { parent: block.parentElement, before: block.nextSibling };
    }
    // Priority 3: sit above Edit Profile
    const ep = [...inner.querySelectorAll<HTMLElement>("button, a")].find(b => /edit\s+profile/i.test(b.textContent || ""));
    if (ep?.parentElement) return { parent: ep.parentElement, before: ep };
    // Priority 4: above the popout's "Message @user" input (some popouts have no Game Collection / no bio)
    const msgInput = inner.querySelector<HTMLElement>('[role="textbox"], [contenteditable="true"], [class*="channelTextArea"]');
    if (msgInput) {
        let node: HTMLElement | null = msgInput;
        // Walk up to the direct child of inner
        while (node && node.parentElement && node.parentElement !== inner) node = node.parentElement;
        if (node && node.parentElement === inner) {
            return { parent: inner, before: node };
        }
    }
    // Fallback: append to inner
    return { parent: inner, before: null };
}

function tryInject(panel: HTMLElement) {
    if (panel.querySelector('[data-vsi="1"]')) return;
    const shownId = panelUserId(panel);
    if (!shownId) return;
    const myId = UserStore.getCurrentUser()?.id;
    const isOwn = shownId === myId;

    // Own-profile trade URL comes from plugin settings; foreign trade URL comes from their bio (async).
    const ownTradeUrl = isOwn ? settings.store.tradeUrl?.trim() : undefined;
    const wantTradeRow = isOwn && !!settings.store.showOnOwnProfile && !!ownTradeUrl;
    const wantCard = !!settings.store.showInventoryOnProfile;
    // Also willing to render a trade row for a foreign user IF their bio has a trade URL — we resolve that
    // asynchronously after injecting the card (so the popout doesn't block on a REST call).
    const canRenderForeignTradeRow = !isOwn && !!settings.store.showInventoryOnProfile;
    if (!wantTradeRow && !wantCard && !canRenderForeignTradeRow) return;

    const inner = panel.querySelector<HTMLElement>('[class*="inner_"]') ?? panel;
    const target = findInsertionPoint(inner);
    if (!target) return;
    const btn = buildButton(shownId, isOwn, wantTradeRow, wantCard);
    target.parent.insertBefore(btn, target.before);

    // For foreign users, resolve trade URL + Steam ID from three sources:
    // 1. Cloud share (vsi-share worker) — HIGHEST priority
    // 2. Bio scrape (steamcommunity.com/tradeoffer/new/ URL in About Me)
    // 3. Discord's own Steam connection (Steam profile URL fallback)
    // Priority 1 > 2 > 3. Check caches synchronously first for an instant no-flash render,
    // fall back to async fetch (with fade-in) only on cache miss.
    if (!isOwn) {
        const sync = resolveForeignSync(shownId);
        if (sync) {
            const row = buildForeignRow(sync.tradeUrl, sync.steamId);
            if (row) {
                row.classList.add("instant"); // skip fade — this was cache-hit, no delay to soften
                btn.insertBefore(row, btn.firstChild);
            }
        } else {
            (async () => {
                const [bioTradeUrl, discordSteamId, cloud] = await Promise.all([
                    getTradeUrlForUser(shownId).catch(e => { console.warn("[VSI] getTradeUrlForUser threw", e); return null as string | null; }),
                    getSteamId(shownId).catch(e => { console.warn("[VSI] getSteamId threw", e); return null as string | null; }),
                    getCloudSharedProfile(shownId).catch(e => { console.warn("[VSI] cloud fetch threw", e); return null; }),
                ]);
                const tradeUrl = cloud?.trade_url ?? bioTradeUrl;
                const steamId = cloud?.steam_id ?? discordSteamId;
                if (!tradeUrl && !steamId) return;
                if (!btn.isConnected) return;
                if (btn.querySelector(".vsi-trade-row")) return;
                const row = buildForeignRow(tradeUrl, steamId);
                if (!row) return;
                btn.insertBefore(row, btn.firstChild); // no .instant class → animation runs
            })().catch(e => console.error("[VSI] foreign row outer", e));
        }
    }
}

/**
 * Fully synchronous resolution: only returns something when the cloud fetch AND (bio or Steam)
 * are already cached in memory. Anything requiring a network round-trip returns null so the
 * caller falls back to the async path (which fades in when data arrives).
 */
function resolveForeignSync(shownId: string): { tradeUrl: string | null; steamId: string | null } | null {
    const cloudTtl = 5 * 60_000;
    const cacheHit = cloudProfileCache.get(shownId);
    const cloudFresh = cacheHit && Date.now() - cacheHit.ts < cloudTtl;
    if (!cloudFresh) return null; // cloud never checked or stale → async

    const cloud = cacheHit!.data;
    const profile: any = UserProfileStore.getUserProfile(shownId);
    const accounts = profile?.connectedAccounts || profile?.connected_accounts || [];
    const discordSteamId = accounts.find((c: any) => c?.type === "steam" || c?.type === "STEAM")?.id ?? null;
    const bioText = profile?.bio ?? profile?.userProfile?.bio ?? profile?.user_profile?.bio;
    const bioTradeUrl = extractTradeUrl(bioText ?? null);

    const tradeUrl = cloud?.trade_url ?? bioTradeUrl;
    const steamId = cloud?.steam_id ?? discordSteamId;
    if (!tradeUrl && !steamId) return null; // nothing to show — skip render entirely

    return { tradeUrl, steamId };
}

function buildForeignRow(tradeUrl: string | null, steamId: string | null): HTMLElement | null {
    const theme = settings.store.buttonTheme || "blurple";
    const row = document.createElement("div");
    row.className = "vsi-trade-row";

    if (tradeUrl) {
        const trade = document.createElement("a");
        trade.className = `vsi-trade-btn ${theme} vsi-trade-main`;
        trade.href = tradeUrl;
        trade.target = "_blank";
        trade.rel = "noopener noreferrer";
        trade.innerHTML = `${STEAM_ICON_SVG}<span>Send Trade Offer</span>`;
        row.appendChild(trade);
    }

    // Steam profile: prefer the trade URL's partner param (has the exact user), fall back to raw SteamID.
    const profileUrl = tradeUrl ? deriveSteamProfileUrl(tradeUrl)
        : steamId ? `https://steamcommunity.com/profiles/${steamId}`
        : null;

    if (profileUrl) {
        const prof = document.createElement("a");
        // If there's no trade button, the Steam button gets the wide "main" width instead of the narrow "profile" width.
        prof.className = `vsi-trade-btn ${theme} ${tradeUrl ? "vsi-trade-profile" : "vsi-trade-main"}`;
        prof.href = profileUrl;
        prof.target = "_blank";
        prof.rel = "noopener noreferrer";
        prof.title = "Open Steam profile";
        prof.innerHTML = `${USER_ICON_SVG}<span>Steam Profile</span>`;
        row.appendChild(prof);
    }

    return row.children.length ? row : null;
}

function scan(root: ParentNode) {
    // Discord's stable class is `user-profile-popout` (kebab-case). Older camelCase kept as fallback.
    const sel = '[class*="user-profile-popout"], [class~="user-profile-popout"], [class*="userPopout"], [class*="userProfile"], [class*="userPanelOuter"], [class*="profilePanel"]';
    if (root instanceof HTMLElement && root.matches(sel)) tryInject(root);
    root.querySelectorAll<HTMLElement>(sel).forEach(tryInject);
}

function startObserver() {
    observer = new MutationObserver(muts => {
        for (const m of muts) {
            for (const n of Array.from(m.addedNodes)) {
                if (n instanceof HTMLElement) scan(n);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scan(document.body);
}

// ─── Settings header ─────────────────────────────────────────────────────────

const GITHUB_URL = "https://github.com/VisaHolder/steam-inventory-value";
const AUTHOR_STEAM_URL = "https://steamcommunity.com/profiles/76561199109828420";

const GITHUB_SVG = "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.2 0 1.9 1.3 1.9 1.3 1.1 1.9 3 1.3 3.7 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.4-5.5-6 0-1.3.5-2.4 1.3-3.2 0-.4-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.6.2 2.9.1 3.2.8.9 1.3 2 1.3 3.3 0 4.6-2.8 5.6-5.5 5.9.5.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3\"/></svg>";
const STEAM_SVG = "<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M11.98 2C6.7 2 2.36 6.03 2 11.13l5.38 2.22a2.86 2.86 0 0 1 1.6-.48h.15l2.4-3.47v-.05a3.83 3.83 0 1 1 3.83 3.83h-.09l-3.42 2.44v.13a2.87 2.87 0 0 1-5.42 1.3L2.5 15.5A9.99 9.99 0 0 0 22 12c0-5.52-4.48-10-10.02-10ZM8.79 17.16l-1.22-.5a2.16 2.16 0 0 0 1.15 1.13c1.09.45 2.35-.06 2.8-1.16.22-.53.22-1.11 0-1.64a2.15 2.15 0 0 0-1.14-1.16 2.14 2.14 0 0 0-1.64.01l1.26.52a1.59 1.59 0 1 1-1.21 2.94v-.14Zm10.02-7.6a2.55 2.55 0 0 1-5.11 0 2.55 2.55 0 0 1 5.11 0Zm-4.47 0a1.92 1.92 0 1 0 3.83 0 1.92 1.92 0 0 0-3.83 0Z\"/></svg>";

const linkStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.2,
    textDecoration: "none",
    color: "var(--text-normal)",
    background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02))",
    border: "1px solid rgba(255,255,255,.08)",
    boxShadow: "0 1px 0 rgba(255,255,255,.06) inset, 0 1px 2px rgba(0,0,0,.2)",
    transition: "background 120ms ease, transform 120ms ease, border-color 120ms ease",
    cursor: "pointer",
    userSelect: "none",
};

const AboutComponent: React.FC = () => {
    // Reactive — re-renders when any of these settings change so the CTA card, publish state, etc
    // update the instant the user pastes their trade URL (no waiting for the 15-second poll).
    const s = settings.use(["tradeUrl", "shareViaCloud", "shareTradeUrl", "shareSteamProfile"]);
    const tradeUrlSet = !!s.tradeUrl?.trim();
    React.useEffect(() => {
        publishSharedProfile().catch(() => { });
    }, [s.tradeUrl, s.shareViaCloud, s.shareTradeUrl, s.shareSteamProfile]);
    return (<>
    <div style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 14px",
        marginBottom: tradeUrlSet ? 16 : 10,
        borderRadius: 10,
        background: "linear-gradient(180deg, rgba(88,101,242,.10) 0%, rgba(255,255,255,.02) 100%)",
        border: "1px solid rgba(88,101,242,.28)",
        boxShadow: "0 1px 0 rgba(255,255,255,.05) inset, 0 4px 14px rgba(88,101,242,.10)",
    }}>
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 15,
                fontWeight: 700,
                color: "var(--header-primary)",
                marginBottom: 4,
                letterSpacing: 0.1,
            }}>
                <span style={{ fontSize: 16 }}>💼</span>
                Steam Inventory Value
            </div>
            <Forms.FormText style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--text-muted)" }}>
                CS2 inventory value + Trade / Steam buttons on Discord profile popouts.
                Ephemeral rich embed or public markdown for <code>/inventory</code>, plus <code>/csinv &lt;ref&gt;</code>
                for any Steam profile — SteamID64, vanity, URL, or trade link.
            </Forms.FormText>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="View source on GitHub"
                style={linkStyle}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04))";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.16)";
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02))";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.08)";
                }}
                dangerouslySetInnerHTML={{ __html: `${GITHUB_SVG}<span>GitHub</span>` }}
            />
            <a
                href={AUTHOR_STEAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                title="Author's Steam profile"
                style={{
                    ...linkStyle,
                    color: "#f5faff",
                    background: "linear-gradient(135deg, #1b2838 0%, #2a475e 55%, #3b8ac4 130%)",
                    border: "1px solid rgba(102,192,244,.35)",
                }}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #2a475e 0%, #3a6a8f 55%, #66c0f4 130%)";
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, #1b2838 0%, #2a475e 55%, #3b8ac4 130%)";
                }}
                dangerouslySetInnerHTML={{ __html: `${STEAM_SVG}<span>Steam</span>` }}
            />
        </div>
    </div>
    {!tradeUrlSet && (
        <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            marginBottom: 16,
            borderRadius: 10,
            background: "linear-gradient(180deg, rgba(240,178,42,.10) 0%, rgba(240,178,42,.03) 100%)",
            border: "1px solid rgba(240,178,42,.30)",
        }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>🎯</span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0b22a", marginBottom: 2 }}>
                    Set your trade URL to publish it
                </div>
                <Forms.FormText style={{ fontSize: 11.5, lineHeight: 1.4, color: "var(--text-muted)" }}>
                    Cloud share is on — but without a trade URL there's nothing to publish. Grab your URL from{" "}
                    <a href="https://steamcommunity.com/my/tradeoffers/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#f0b22a", textDecoration: "underline" }}>
                        steamcommunity.com/my/tradeoffers/privacy
                    </a>{" "}
                    and paste it into the <b>Trade URL</b> field below.
                </Forms.FormText>
            </div>
        </div>
    )}
    </>);
};

// ─── Plugin definition ────────────────────────────────────────────────────────

export default definePlugin({
    name: "SteamInventoryValue",
    description: "Look up a Discord user's CS2 inventory value via their linked Steam (CSFloat prices), and show a Trade Offer button on your own profile.",
    authors: [EquicordDevs.VisaHolder],
    settings,
    settingsAboutComponent: AboutComponent,

    start() {
        ensureStyle();
        startObserver();

        // Publish shared profile to the vsi-share worker (if user has cloud share on).
        // Non-blocking — fire-and-forget with a short delay so it doesn't race Vencord's boot.
        publishTimeout = setTimeout(() => { publishSharedProfile().catch(e => console.warn("[VSI] initial publish", e)); }, 5000);
        // Poll every 15 seconds; publishSharedProfile dedupes via lastPublishHash so identical
        // state is a cheap no-op. This means pasting a trade URL in settings publishes within 15s
        // even without a plugin reload.
        publishInterval = setInterval(() => { publishSharedProfile().catch(() => {}); }, 15 * 1000);

        // Prompt for trade URL on first run (once) so users know cloud share needs it.
        maybePromptForTradeUrl().catch(() => {});

        // Intercept "/csinv <ref>" typed in any channel — resolves + prices before Discord sends.
        preSendListener = async (channelId: string, message: any) => {
            const raw = (message?.content ?? "").trim();
            const m = raw.match(/^\/csinv\s+(.+)$/i);
            if (!m) return;
            const ref = m[1].trim();
            try { await csInvExec?.(ref, channelId); } catch (e) { console.error("[VSI] csinv preSend", e); }
            return { cancel: true };
        };
        addMessagePreSendListener(preSendListener);
    },

    stop() {
        observer?.disconnect();
        observer = null;
        styleEl?.remove();
        styleEl = null;
        if (publishTimeout) { clearTimeout(publishTimeout); publishTimeout = null; }
        if (publishInterval) { clearInterval(publishInterval); publishInterval = null; }
        if (preSendListener) { removeMessagePreSendListener(preSendListener); preSendListener = null; }
        document.querySelectorAll('[data-vsi="1"]').forEach(n => n.remove());
    },

    commands: (() => {
        interface PricingTarget { steamId: string; displayName: string; avatarUrl?: string }

        const priceAndSend = async (
            target: PricingTarget,
            ctx: any,
            say: (s: string) => void,
            sendResult: (embed: any, markdown: string) => void,
        ) => {
            const cur = settings.store.marketCurrency || 1;
            const validSources = new Set(["csfloat", "skinport", "live_steam"]);
            const stored = settings.store.priceSource as string;
            const source = validSources.has(stored) ? stored : "csfloat";
            const useLiveFallback = !!settings.store.useLiveSteamFallback;
            const shortSource = source === "live_steam" ? "Steam Live"
                : source === "csfloat" ? "CSFloat"
                : source === "skinport" ? "Skinport"
                : source;

            if (source === "live_steam") {
                say(`⏳ Fetching **${target.displayName}**'s inventory (live Steam, ~${Math.round((settings.store.requestDelayMs || 1600) / 1000) * 2}s/item)…`);
            }

            const started = Date.now();
            const inv = await loadInventory(target.steamId, { source, useLiveFallback });
            if (inv.isPrivate) { say(`**${target.displayName}**'s Steam inventory is private.`); return; }

            const priorSnaps = await getSnapshots(target.steamId);
            const nowSnap: Snapshot = {
                total: inv.total,
                priced: inv.priced,
                itemCount: inv.count,
                marketableCount: inv.marketableCount,
                uniqueNames: inv.uniqueNames,
                ts: Date.now(),
                source,
                currency: cur,
                topItems: inv.topItems,
            };
            await pushSnapshot(target.steamId, nowSnap);

            let deltaTag = "";
            let deltaValueForColor: number | null = null;
            if (settings.store.showPriceChange) {
                const minAge = (settings.store.deltaMinAgeMinutes || 60) * 60_000;
                const d = computeDelta(inv.total, priorSnaps, minAge);
                if (d) {
                    const sign = d.delta >= 0 ? "+" : "";
                    deltaTag = ` \`${sign}${fmt(d.delta, cur)}\``;
                    deltaValueForColor = d.delta;
                }
            }
            const embedColor = deltaValueForColor === null ? 0x5865F2
                : deltaValueForColor > 0 ? 0x23A55A
                : deltaValueForColor < 0 ? 0xF23F43
                : 0x5865F2;

            const elapsed = Math.round((Date.now() - started) / 1000);
            const topList = inv.topItems.map(i => `\`${fmt(i.price, cur).padStart(9)}\`  ${abbrevItem(i.name)}`).join("\n") || "_(no priced items)_";
            const untradeableField = inv.skippedNonMarketable > 0 ? ` · ${inv.skippedNonMarketable} untradeable` : "";

            const embed: any = {
                type: "rich",
                color: embedColor,
                author: {
                    name: `${target.displayName} · CS2 Inventory`,
                    icon_url: target.avatarUrl,
                    url: `https://steamcommunity.com/profiles/${target.steamId}`,
                },
                description: `# ${fmt(inv.total, cur)}${deltaTag ? `  ${deltaTag}` : ""}`,
                fields: [
                    { name: "Priced", value: `\`${inv.priced}/${inv.marketableCount}\``, inline: true },
                    { name: "Unique", value: `\`${inv.uniqueNames}\``, inline: true },
                    { name: "Source", value: `\`${shortSource}\``, inline: true },
                    { name: "Top items", value: topList, inline: false },
                ],
                footer: { text: `${shortSource} · ${elapsed}s${untradeableField}` },
                timestamp: new Date().toISOString(),
            };
            if (target.avatarUrl) embed.thumbnail = { url: target.avatarUrl };

            // Padded prices so they right-align in monospace `code` blocks.
            const maxPriceWidth = inv.topItems.reduce((w, i) => Math.max(w, fmt(i.price, cur).length), 0);
            const topLines = inv.topItems
                .map(i => `\`${fmt(i.price, cur).padStart(maxPriceWidth)}\`  ${abbrevItem(i.name)}`)
                .join("\n");
            const untradeableInline = inv.skippedNonMarketable > 0 ? ` · ${inv.skippedNonMarketable} untradeable` : "";

            const markdown =
                `### 💼 ${target.displayName} — CS2 Inventory\n` +
                `# ${fmt(inv.total, cur)}${deltaTag}\n` +
                `-# ${shortSource} · ${inv.priced}/${inv.marketableCount} priced · ${inv.uniqueNames} unique${untradeableInline} · ${elapsed}s\n` +
                (topLines ? `\n**Top items**\n${topLines}` : "");

            sendResult(embed, markdown);
        };

        const makeSayAndSend = (ctx: any, post: boolean) => {
            const say = (content: string) => {
                try {
                    if (post) {
                        const nonce = String(Date.now()) + String(Math.floor(Math.random() * 1000));
                        const msg: any = { content, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] };
                        MessageActions.sendMessage(ctx.channel.id, msg, undefined, { nonce });
                    } else sendBotMessage(ctx.channel.id, {
                        content,
                        author: { id: "1", username: "CS2 Inventory", avatar: null, discriminator: "0000", bot: true },
                    } as any);
                } catch (e) { console.error("[VSI] say() threw", e); }
            };
            const sendResult = (embed: any, markdown: string) => {
                try {
                    if (post) {
                        const nonce = String(Date.now()) + String(Math.floor(Math.random() * 1000));
                        const msg: any = { content: markdown, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] };
                        MessageActions.sendMessage(ctx.channel.id, msg, undefined, { nonce });
                    } else {
                        sendBotMessage(ctx.channel.id, {
                            content: "",
                            embeds: [embed],
                            author: { id: "1", username: "CS2 Inventory", avatar: null, discriminator: "0000", bot: true },
                        } as any);
                    }
                } catch (e) { console.error("[VSI] sendResult threw", e); }
            };
            return { say, sendResult };
        };

        const runInventory = async (args: any[], ctx: any) => {
            const userId = args.find(a => a.name === "user")?.value as string | undefined;
            const steamRef = (args.find(a => a.name === "steam")?.value as string | undefined ?? "").trim();
            const post = !!settings.store.postPublicly;
            const { say, sendResult } = makeSayAndSend(ctx, post);

            if (!userId && !steamRef) { say("Give me either a **user** (Discord picker) or a **steam** ref (URL / vanity / SteamID64)."); return; }
            if (!Native?.fetchJson) { say("⚠️ Native fetch helper not loaded — restart Discord."); return; }

            try {
                // Discord user takes precedence when both are supplied.
                if (userId) {
                    const u = UserStore.getUser(userId);
                    const uname = u?.username ?? userId;
                    const steamId = await getSteamId(userId);
                    if (!steamId) {
                        // Fall back to steam ref if user provided both and Discord had no linked Steam
                        if (steamRef) {
                            const resolved = await resolveSteamRef(steamRef);
                            if (!resolved) { say(`**${uname}** has no visible Steam and \`${steamRef}\` didn't resolve either.`); return; }
                            await priceAndSend({
                                steamId: resolved.steamId,
                                displayName: resolved.persona ?? uname,
                                avatarUrl: resolved.avatar,
                            }, ctx, say, sendResult);
                            return;
                        }
                        say(`**${uname}** has no visible Steam account linked on Discord.`);
                        return;
                    }
                    const avatarHash = (u as any)?.avatar;
                    const avatarUrl = avatarHash
                        ? `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${avatarHash.startsWith("a_") ? "gif" : "png"}?size=128`
                        : undefined;
                    await priceAndSend({ steamId, displayName: uname, avatarUrl }, ctx, say, sendResult);
                    return;
                }

                // steam ref only
                const resolved = await resolveSteamRef(steamRef);
                if (!resolved) {
                    say(`Couldn't resolve **${steamRef}** to a Steam profile. Try a full URL like \`https://steamcommunity.com/id/YourVanity\` or a raw SteamID64.`);
                    return;
                }
                await priceAndSend({
                    steamId: resolved.steamId,
                    displayName: resolved.persona ?? `SteamID ${resolved.steamId}`,
                    avatarUrl: resolved.avatar,
                }, ctx, say, sendResult);
            } catch (e: any) {
                console.error("[VSI] /inventory error", e);
                say(`Error: ${e?.message ?? e}`);
            }
        };

        const runCsInv = async (ref: string, ctx: any) => {
            const post = !!settings.store.postPublicly;
            const { say, sendResult } = makeSayAndSend(ctx, post);

            if (!ref) { say("Give me a Steam profile URL, vanity name, or SteamID64."); return; }
            if (!Native?.fetchJson) { say("⚠️ Native fetch helper not loaded — restart Discord."); return; }

            try {
                const resolved = await resolveSteamRef(ref);
                if (!resolved) {
                    say(`Couldn't resolve **${ref}** to a Steam profile. Try a full URL like \`https://steamcommunity.com/id/YourVanity\` or a raw SteamID64.`);
                    return;
                }
                await priceAndSend({
                    steamId: resolved.steamId,
                    displayName: resolved.persona ?? `SteamID ${resolved.steamId}`,
                    avatarUrl: resolved.avatar,
                }, ctx, say, sendResult);
            } catch (e: any) {
                console.error("[VSI] csinv error", e);
                say(`Error: ${e?.message ?? e}`);
            }
        };

        // Publish for the preSend listener registered in start().
        csInvExec = (ref, channelId) => runCsInv(ref, { channel: { id: channelId } });

        const inventoryOpts = [
            { name: "user", description: "Discord user (picker) — uses their linked Steam", type: ApplicationCommandOptionType.USER, required: false },
            { name: "steam", description: "OR: Steam profile URL, vanity name, or SteamID64", type: ApplicationCommandOptionType.STRING, required: false },
        ];
        // /csinv intentionally not registered as a slash command — it's handled by the preSend listener
        // (in start()) so it can be typed as "/csinv <ref>" WITHOUT Discord's mandatory "label:" prefix.
        return [
            { name: "inventory", description: "CS2 inventory value — pick a Discord user OR paste a Steam ref", inputType: ApplicationCommandInputType.BUILT_IN, options: inventoryOpts, execute: runInventory },
        ];
    })(),
});
