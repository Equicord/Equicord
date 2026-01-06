/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync, readFileSync } from "fs";
import { createServer } from "http";
import { resolve } from "path";
import puppeteer from "puppeteer-core";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";

import {
    addUserToStateChangeFilterList,
    clean,
    formatText,
    parseStateChangeFilterList,
    parseUserVoiceMap,
    removeUserFromStateChangeFilterList,
    removeUserVoiceFromMap,
    serializeStateChangeFilterList,
    serializeUserVoiceMap,
    upsertUserVoiceMap,
    VOICE_OPTIONS,
} from "./util";

const API_BASE = "https://tiktok-tts-aio.exampleuser.workers.dev";

type TestResult = { name: string; ok: boolean; details?: string; };

function ok(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function uniq<T>(arr: T[]) {
    return new Set(arr).size === arr.length;
}

function pickChromeExecutable() {
    const candidates = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        process.env.CHROME_PATH
    ].filter(Boolean) as string[];

    for (const p of candidates) {
        if (existsSync(p)) return p;
    }

    return null;
}

async function testApiOnce(): Promise<void> {
    const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hello world", voice: "en_us_001", base64: true }),
    });

    ok(res.status >= 200 && res.status < 500, `Unexpected status: ${res.status}`);
    ok(res.ok, `API request failed: HTTP ${res.status}`);

    const base64 = (await res.text()).trim();
    ok(base64.length > 0, "API response was empty");

    const bytes = Buffer.from(base64, "base64");
    ok(bytes.length > 256, "Decoded audio is too small");

    const header3 = bytes.subarray(0, 3).toString("ascii");
    const looksLikeMp3 = header3 === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    ok(looksLikeMp3, "Decoded data does not look like an MP3");
}

function runNodeOnlyTests(): TestResult[] {
    const results: TestResult[] = [];

    const push = (name: string, fn: () => void) => {
        try {
            fn();
            results.push({ name, ok: true });
        } catch (e) {
            results.push({ name, ok: false, details: e instanceof Error ? e.message : String(e) });
        }
    };

    push("VOICE_OPTIONS looks sane", () => {
        ok(VOICE_OPTIONS.length > 5, "VOICE_OPTIONS seems too small");
        ok(VOICE_OPTIONS.some(v => v.value === "en_us_001"), "Missing en_us_001 voice");
        ok(uniq(VOICE_OPTIONS.map(v => v.value)), "VOICE_OPTIONS has duplicate values");
    });

    push("User voice map parse/serialize roundtrip", () => {
        const input = "123:en_us_001,456:en_uk_001";
        const map = parseUserVoiceMap(input);
        ok(map.get("123") === "en_us_001", "Failed to parse mapping for 123");
        ok(map.get("456") === "en_uk_001", "Failed to parse mapping for 456");

        const output = serializeUserVoiceMap(map);
        ok(output.includes("123:en_us_001"), "Serialize missing 123 mapping");
        ok(output.includes("456:en_uk_001"), "Serialize missing 456 mapping");
    });

    push("User voice map upsert/remove", () => {
        let m = "";
        m = upsertUserVoiceMap(m, "1", "en_us_001");
        ok(parseUserVoiceMap(m).get("1") === "en_us_001", "Upsert failed");

        m = upsertUserVoiceMap(m, "1", "en_uk_001");
        ok(parseUserVoiceMap(m).get("1") === "en_uk_001", "Upsert overwrite failed");

        m = removeUserVoiceFromMap(m, "1");
        ok(!parseUserVoiceMap(m).has("1"), "Remove failed");
    });

    push("State-change filter list add/remove", () => {
        let list = "";
        list = addUserToStateChangeFilterList(list, "10");
        list = addUserToStateChangeFilterList(list, "20");
        const set = parseStateChangeFilterList(list);
        ok(set.has("10") && set.has("20"), "Add to filter list failed");

        list = removeUserFromStateChangeFilterList(list, "10");
        ok(!parseStateChangeFilterList(list).has("10"), "Remove from filter list failed");

        ok(serializeStateChangeFilterList(new Set(["20"])) === "20", "Serialize filter list unexpected");
    });

    push("clean()/formatText() basic behavior", () => {
        const cleaned = clean("  hi__there  ");
        ok(cleaned === "hi_there", `Unexpected clean result: ${cleaned}`);

        const out = formatText("{{DISPLAY_NAME}} joined {{CHANNEL}}", "u", "general", "Bob", "Bobby");
        ok(out.includes("Bob joined general"), "formatText did not substitute placeholders");
    });

    return results;
}

async function runBrowserCacheTests(opts: { evictionTest: boolean; }): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const push = (name: string, ok_: boolean, details?: string) => results.push({ name, ok: ok_, details });

    const executablePath = pickChromeExecutable();
    if (!executablePath) {
        push(
            "Browser persistent-cache tests",
            false,
            "No Chrome/Chromium executable found. Set CHROME_PATH or PUPPETEER_EXECUTABLE_PATH to enable browser tests."
        );
        return results;
    }

    const server = createServer((req, res) => {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end("<!doctype html><html><head><meta charset='utf-8'></head><body>vcNarratorCustom smoke test</body></html>");
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address();
    const port = typeof address === "object" && address ? address.port : null;
    if (!port) {
        server.close();
        push("Browser persistent-cache tests", false, "Failed to bind local test server");
        return results;
    }

    const originUrl = `http://127.0.0.1:${port}/`;

    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    try {
        const page = await browser.newPage();
        await page.goto(originUrl, { waitUntil: "domcontentloaded" });

        const utilPath = resolve(process.cwd(), "src/equicordplugins/vcNarratorCustom/util.ts");
        const utilTs = readFileSync(utilPath, "utf8");
        const utilJs = transpileModule(utilTs, {
            compilerOptions: { target: ScriptTarget.ES2020, module: ModuleKind.CommonJS },
        }).outputText;

        await page.addScriptTag({
            content: `
(() => {
  const exports = {};
  const module = { exports };
  ${utilJs}
  window.__vcNarratorUtil = exports;
})();
            `,
        });

        const browserResults = await page.evaluate(
            // Avoid passing an inline function to Puppeteer here: some TS/ESBuild setups
            // wrap it with helpers (e.g. `__name`) that don't exist in the page context.
            new Function(
                "doEvictionTest",
                `
return (async () => {
  const results = [];
  const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

  const util = window.__vcNarratorUtil;
  ok(util, "Failed to load util exports into browser context");

  const makeBlob = (bytes) => new Blob([new Uint8Array(bytes)], { type: "audio/mpeg" });

  try {
    await util.clearTtsCache();
    const s0 = await util.getPersistentTtsCacheStats();
    ok(s0.entries === 0, "Expected empty cache after clear");
    results.push({ name: "clearTtsCache() clears persistent cache", ok: true });
  } catch (e) {
    results.push({ name: "clearTtsCache() clears persistent cache", ok: false, details: String(e) });
    return results;
  }

  try {
    await util.setCachedVoiceInDB("a", makeBlob(1024));
    await util.setCachedVoiceInDB("b", makeBlob(2048));
    const s = await util.getPersistentTtsCacheStats();
    ok(s.entries >= 2, "Expected at least 2 cache entries");
    ok(s.bytes >= 3072, "Expected bytes >= sum of blobs");

    const a = await util.getCachedVoiceFromDB("a");
    ok(a && a.size === 1024, "Expected to retrieve blob a");
    results.push({ name: "set/get/stats work in IndexedDB", ok: true });
  } catch (e) {
    results.push({ name: "set/get/stats work in IndexedDB", ok: false, details: String(e) });
  }

  if (!doEvictionTest) {
    results.push({ name: "LRU eviction (optional)", ok: true, details: "skipped (pass --eviction)" });
    return results;
  }

  try {
    await util.clearTtsCache();

    // 2x 60MB => exceeds 100MB cap and should trigger eviction.
    await util.setCachedVoiceInDB("big1", makeBlob(60 * 1024 * 1024));
    await util.setCachedVoiceInDB("big2", makeBlob(60 * 1024 * 1024));

    const s = await util.getPersistentTtsCacheStats();
    ok(s.bytes <= util.PERSISTENT_TTS_CACHE_MAX_BYTES + 1024 * 1024, "Expected cache trimmed near max size");
    ok(s.entries >= 1 && s.entries <= 2, "Expected entries evicted to stay under limit");
    results.push({ name: "LRU eviction keeps cache under 100MB", ok: true });
  } catch (e) {
    results.push({ name: "LRU eviction keeps cache under 100MB", ok: false, details: String(e) });
  }

  return results;
})();
                `
            ) as any,
            opts.evictionTest
        );

        for (const r of browserResults) push(r.name, r.ok, r.details);
    } finally {
        await browser.close();
        server.close();
    }

    return results;
}

function printResults(title: string, results: TestResult[]) {
    const pad = (s: string) => s.padEnd(46);
    console.log(`\n${title}`);
    for (const r of results) {
        const status = r.ok ? "PASS" : "FAIL";
        console.log(`- ${pad(r.name)} ${status}${r.details ? ` (${r.details})` : ""}`);
    }
}

function hasFailures(results: TestResult[]) {
    return results.some(r => !r.ok);
}

function parseArgs(argv: string[]) {
    const args = new Set(argv);
    return {
        browser: args.has("--browser"),
        noBrowser: args.has("--no-browser"),
        eviction: args.has("--eviction"),
    };
}

(async () => {
    const { browser, noBrowser, eviction } = parseArgs(process.argv.slice(2));

    console.log("vcNarratorCustom smoke test");
    console.log(`- API base: ${API_BASE}`);

    const nodeResults = runNodeOnlyTests();
    printResults("Node-only tests (pure helpers)", nodeResults);

    const apiResults: TestResult[] = [];
    try {
        await testApiOnce();
        apiResults.push({ name: "TikTok TTS API returns MP3 base64", ok: true });
    } catch (e) {
        apiResults.push({ name: "TikTok TTS API returns MP3 base64", ok: false, details: e instanceof Error ? e.message : String(e) });
    }
    printResults("Network test", apiResults);

    const shouldRunBrowser = browser || (!noBrowser && Boolean(pickChromeExecutable()));
    const browserResults = shouldRunBrowser
        ? await runBrowserCacheTests({ evictionTest: eviction })
        : [{ name: "Browser persistent-cache tests", ok: true, details: "skipped (pass --browser to force)" }];

    printResults("Browser tests (IndexedDB cache)", browserResults);

    const all = [...nodeResults, ...apiResults, ...browserResults];
    if (hasFailures(all)) {
        process.exitCode = 1;
    } else {
        console.log("\nAll checks passed.");
    }
})().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
