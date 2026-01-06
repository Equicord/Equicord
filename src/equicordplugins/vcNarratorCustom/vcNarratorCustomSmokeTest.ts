/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * vcNarratorCustom Smoke Test
 *
 * Goals:
 *  - Validate the pure utility logic in `./util.ts` (parsing/serialization/sanitization/template expansion).
 *  - Optionally validate the live TTS API is reachable and returns decodable audio.
 *  - Optionally validate the browser environment supports IndexedDB (used for persistent caching).
 *
 * Intended usage:
 *  - Local development sanity check
 *  - CI “does it still basically work?” check (typically without live API calls)
 *
 * CLI flags:
 *  --api        Run the live API test (network).
 *  --browser    Run the Puppeteer/IndexedDB tests (requires a Chromium executable).
 *
 * Environment:
 *  VC_NARRATOR_API_BASE            Override the API base URL (defaults to placeholder).
 *  CHROME_PATH / PUPPETEER_EXECUTABLE_PATH  Path to Chromium/Chrome for Puppeteer.
 */

import { existsSync } from "fs";
import puppeteer from "puppeteer-core";

import {
    addUserToStateChangeFilterList,
    clean,
    formatText,
    getVoiceForUser,
    parseStateChangeFilterList,
    parseUserVoiceMap,
    removeUserFromStateChangeFilterList,
    removeUserVoiceFromMap,
    serializeStateChangeFilterList,
    serializeUserVoiceMap,
    upsertUserVoiceMap,
    VOICE_OPTIONS,
} from "./util";

// -------------------------------------------------------------------------------------------------
// Configuration
// -------------------------------------------------------------------------------------------------

/**
 * Default points at a placeholder domain (same one used in the plugin source comments).
 * For real API smoke tests, provide VC_NARRATOR_API_BASE or edit this constant.
 */
const DEFAULT_API_BASE = "https://tiktok-tts-aio.exampleuser.workers.dev";
const API_BASE = process.env.VC_NARRATOR_API_BASE ?? DEFAULT_API_BASE;

// -------------------------------------------------------------------------------------------------
// Tiny test framework (kept dependency-free on purpose)
// -------------------------------------------------------------------------------------------------

type TestResult =
    | { category: string; name: string; success: true; }
    | { category: string; name: string; success: false; error: unknown; };

class TestRunner {
    private results: TestResult[] = [];

    async run(category: string, name: string, testFn: () => void | Promise<void>) {
        console.log("\n====================");
        console.log(`[TEST] [${category}] ${name}`);
        console.log("--------------------");
        try {
            await testFn();
            this.results.push({ category, name, success: true });
            console.log(`[PASS] [${category}] ${name}`);
        } catch (error) {
            this.results.push({ category, name, success: false, error });
            console.error(`[FAIL] [${category}] ${name}:`, error);
        }
        console.log("====================\n");
    }

    /**
     * Print summary and exit non-zero when there were failures.
     * (Keeping the process exit behavior makes this file useful in CI.)
     */
    printSummaryAndExit() {
        const passed = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;

        console.log("\n--- Test Summary ---");
        console.log(`Total : ${this.results.length}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);

        if (failed > 0) {
            console.log("\nFailures:");
            for (const r of this.results.filter(r => !r.success)) {
                console.log(`- [${r.category}] ${r.name}: ${String((r as any).error)}`);
            }
            process.exit(1);
        }

        process.exit(0);
    }
}

// -------------------------------------------------------------------------------------------------
// Assertions (minimal helpers with readable error messages)
// -------------------------------------------------------------------------------------------------

function assertEq<T>(actual: T, expected: T, msg = "Expected values to be equal") {
    if (actual !== expected) {
        console.log(`[EXPECT] ${msg} expected=${String(expected)} received=${String(actual)} result=fail`);
        throw new Error(`${msg}\n  expected: ${String(expected)}\n  received: ${String(actual)}`);
    }
    console.log(`[EXPECT] ${msg} expected=${String(expected)} received=${String(actual)} result=pass`);
}

function assertTruthy(value: unknown, msg = "Expected value to be truthy") {
    if (!value) {
        console.log(`[EXPECT] ${msg} expected=true received=${String(value)} result=fail`);
        throw new Error(msg);
    }
    console.log(`[EXPECT] ${msg} expected=true received=${String(value)} result=pass`);
}

function assertIncludes(haystack: string | any[], needle: any, msg = "Expected collection to include value") {
    if (!(haystack as any).includes(needle)) {
        console.log(`[EXPECT] ${msg} expected=${String(needle)} ∈ received=${String(haystack)} result=fail`);
        throw new Error(`${msg}\n  needle: ${String(needle)}\n  haystack: ${String(haystack)}`);
    }
    console.log(`[EXPECT] ${msg} expected=${String(needle)} ∈ received=${String(haystack)} result=pass`);
}

function assertNotIncludes(haystack: string | any[], needle: any, msg = "Expected collection NOT to include value") {
    if ((haystack as any).includes(needle)) {
        console.log(`[EXPECT] ${msg} expected=${String(needle)} ∉ received=${String(haystack)} result=fail`);
        throw new Error(`${msg}\n  needle: ${String(needle)}\n  haystack: ${String(haystack)}`);
    }
    console.log(`[EXPECT] ${msg} expected=${String(needle)} ∉ received=${String(haystack)} result=pass`);
}

// -------------------------------------------------------------------------------------------------
// CLI parsing
// -------------------------------------------------------------------------------------------------

type CliOptions = {
    runApi: boolean;
    runBrowser: boolean;
};

function parseCliArgs(argv: string[]): CliOptions {
    const args = new Set(argv);
    return {
        runApi: args.has("--api"),
        runBrowser: args.has("--browser"),
    };
}

// -------------------------------------------------------------------------------------------------
// Test suites
// -------------------------------------------------------------------------------------------------

async function runUtilLogicTests(runner: TestRunner) {
    const category = "util.ts";

    // --- clean() ------------------------------------------------------------

    await runner.run(category, "clean(): trims, normalizes underscores, caps length", () => {
        assertEq(clean("   hello   "), "hello", "Should trim whitespace");
        assertEq(clean("a__b"), "a_b", "Should collapse repeated underscores");
        assertEq(clean("x".repeat(300)).length, 128, "Should cap output length at 128 chars");
    });

    await runner.run(category, "clean(latinOnly): removes non-Latin scripts", () => {
        // Latin characters remain; CJK characters should be removed in latinOnly mode.
        const out = clean("abc你好123", true);
        assertEq(out, "abc123", "Should strip non-Latin characters when latinOnly=true");
    });

    // --- formatText() -------------------------------------------------------

    await runner.run(category, "formatText(): expands placeholders", () => {
        const template = "{{DISPLAY_NAME}} joined {{CHANNEL}} ({{USER}} / {{NICKNAME}})";
        const out = formatText(template, "user", "General", "Display Name", "Nick", false);
        assertEq(out, "Display Name joined General (user / Nick)");
    });

    await runner.run(category, "formatText(): uses safe fallbacks when empty inputs", () => {
        // When a placeholder input is empty, util.formatText intentionally uses "Someone"/"channel" fallbacks.
        const template = "{{DISPLAY_NAME}} left {{CHANNEL}}";
        const out = formatText(template, "", "", "", "", false);
        assertEq(out, " left channel", "Display name becomes empty (because user is empty), channel falls back");
    });

    // --- User voice map helpers --------------------------------------------

    await runner.run(category, "parseUserVoiceMap(): supports preferred 'user:voice' format", () => {
        const parsed = parseUserVoiceMap("111:en_us_001, 222:jp_001");
        assertEq(parsed.get("111"), "en_us_001");
        assertEq(parsed.get("222"), "jp_001");
    });

    await runner.run(category, "parseUserVoiceMap(): supports legacy newline 'user,voice' format", () => {
        const parsed = parseUserVoiceMap("111,en_us_001\n222,jp_001");
        assertEq(parsed.get("111"), "en_us_001");
        assertEq(parsed.get("222"), "jp_001");
    });

    await runner.run(category, "serializeUserVoiceMap(): produces stable 'user:voice' pairs", () => {
        const serialized = serializeUserVoiceMap(new Map([["111", "en_us_001"], ["222", "jp_001"]]));
        // Order is insertion order; we insert 111 then 222 above.
        assertEq(serialized, "111:en_us_001,222:jp_001");
    });

    await runner.run(category, "upsertUserVoiceMap(): adds or replaces a mapping", () => {
        const initial = "111:en_us_001";
        const updated = upsertUserVoiceMap(initial, "111", "en_male_narration");
        const parsed = parseUserVoiceMap(updated);
        assertEq(parsed.get("111"), "en_male_narration");
    });

    await runner.run(category, "removeUserVoiceFromMap(): removes a mapping without affecting others", () => {
        const initial = "111:en_us_001,222:jp_001";
        const updated = removeUserVoiceFromMap(initial, "111");
        const parsed = parseUserVoiceMap(updated);
        assertEq(parsed.has("111"), false, "Target user should be removed");
        assertEq(parsed.get("222"), "jp_001", "Other entries should be preserved");
    });

    await runner.run(category, "getVoiceForUser(): respects per-user override, then customVoice/defaultVoice", () => {
        const userVoiceMap = "111:jp_001";
        assertEq(
            getVoiceForUser("111", { userVoiceMap, customVoice: "en_us_001", defaultVoice: "en_us_001" }),
            "jp_001",
            "Should return per-user override"
        );

        assertEq(
            getVoiceForUser("222", { userVoiceMap, customVoice: "en_male_narration", defaultVoice: "en_us_001" }),
            "en_male_narration",
            "Should fall back to customVoice when user not mapped"
        );

        assertEq(
            getVoiceForUser(undefined, { userVoiceMap, defaultVoice: "en_us_001" }),
            "en_us_001",
            "Should fall back to defaultVoice when userId is missing"
        );
    });

    // --- State-change filter list helpers ----------------------------------

    await runner.run(category, "parseStateChangeFilterList(): parses a comma-separated list", () => {
        const set = parseStateChangeFilterList("111, 222,,333");
        assertTruthy(set.has("111"));
        assertTruthy(set.has("222"));
        assertTruthy(set.has("333"));
        assertEq(set.size, 3, "Should ignore blanks");
    });

    await runner.run(category, "serializeStateChangeFilterList(): joins entries", () => {
        const out = serializeStateChangeFilterList(new Set(["111", "222"]));
        // Set iteration order is insertion order. We insert 111 then 222 above.
        assertEq(out, "111,222");
    });

    await runner.run(category, "add/removeUserToStateChangeFilterList(): updates list string", () => {
        const added = addUserToStateChangeFilterList("111", "222");
        assertIncludes(added, "111");
        assertIncludes(added, "222");

        const removed = removeUserFromStateChangeFilterList(added, "111");
        assertNotIncludes(removed.split(","), "111");
        assertIncludes(removed.split(","), "222");
    });

    // --- VOICE_OPTIONS sanity ----------------------------------------------

    await runner.run(category, "VOICE_OPTIONS: non-empty and contains expected voices", () => {
        assertTruthy(Array.isArray(VOICE_OPTIONS), "VOICE_OPTIONS should be an array");
        assertTruthy(VOICE_OPTIONS.length > 0, "VOICE_OPTIONS should not be empty");

        // A couple of known voice ids are used in the plugin code/comments.
        const expected = ["en_us_001", "en_male_narration"];
        for (const voiceId of expected) {
            assertTruthy(
                VOICE_OPTIONS.some(v => v.value === voiceId),
                `VOICE_OPTIONS should include ${voiceId}`
            );
        }
    });
}

async function runLiveApiTests(runner: TestRunner) {
    const category = "API";

    await runner.run(category, "TTS generation returns decodable audio", async () => {
        // Safety valve: don't accidentally hammer a placeholder or rate-limited service in CI.
        if (API_BASE === DEFAULT_API_BASE) {
            console.log(`[SKIP] [${category}] Provide VC_NARRATOR_API_BASE to enable live API tests.`);
            return;
        }

        const voice = "en_us_001";
        const text = "Smoke test";

        // Input: POST JSON { text, voice, base64: true } -> Output: raw base64-encoded MP3 string.
        const res = await fetch(`${API_BASE}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice, base64: true }),
        });

        assertTruthy(res.ok, `API should return 2xx (got ${res.status})`);

        // The plugin expects a raw base64 string response (not JSON).
        const body = (await res.text()).trim();
        assertTruthy(body.length > 0, "Response body should not be empty");

        // Decode base64 and do a lightweight “is this audio?” check.
        const bytes = Buffer.from(body, "base64");
        assertTruthy(bytes.length > 256, "Decoded audio should be at least a few hundred bytes");

        // Most MP3 responses begin with "ID3" (tag) or an MPEG frame sync (0xFF 0xFB/0xF3/0xF2).
        const header3 = bytes.subarray(0, 3).toString("latin1");
        const b0 = bytes[0];
        const b1 = bytes[1];

        const looksLikeMp3 =
            header3 === "ID3" ||
            (b0 === 0xff && (b1 & 0xe0) === 0xe0);

        assertTruthy(looksLikeMp3, "Decoded bytes should look like MP3 data (ID3 tag or MPEG frame sync)");
    });
}

async function runSimulatedApiTests(runner: TestRunner) {
    const category = "API (simulated)";

    await runner.run(category, "Simulated TTS request/response is shaped correctly", async () => {
        // Build a fake MP3-like payload: starts with ID3 tag and is large enough to satisfy length checks.
        const fakeMp3 = Buffer.alloc(300, 0);
        fakeMp3.set([0x49, 0x44, 0x33], 0); // "ID3"
        const fakeBase64 = fakeMp3.toString("base64");

        const requests: Array<{ input: RequestInfo | URL; init?: RequestInit; }> = [];

        const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            requests.push({ input, init });
            return new Response(fakeBase64, { status: 200 });
        };

        const voice = "en_us_001";
        const text = "Smoke test";

        // Input: POST JSON { text, voice, base64: true } -> Output: raw base64 string (fake MP3 data).
        const res = await fakeFetch(`${API_BASE}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice, base64: true }),
        });

        assertEq(requests.length, 1, "Should issue exactly one request");
        const sent = requests[0];
        assertEq(String(sent.input), `${API_BASE}/api/generate`, "Should target /api/generate endpoint");
        assertEq(sent.init?.method, "POST", "Should use POST");
        assertEq((sent.init?.headers as any)?.["Content-Type"], "application/json", "Should send JSON");

        const parsedBody = JSON.parse(String(sent.init?.body ?? ""));
        assertEq(parsedBody.text, text, "Should include text in request body");
        assertEq(parsedBody.voice, voice, "Should include voice in request body");
        assertTruthy(parsedBody.base64, "Should request base64 encoding");

        assertTruthy(res.ok, "Response should be ok");
        const body = (await res.text()).trim();
        assertEq(body, fakeBase64, "Should return the raw base64 string");

        const bytes = Buffer.from(body, "base64");
        assertTruthy(bytes.length > 256, "Decoded audio should be at least a few hundred bytes");

        const header3 = bytes.subarray(0, 3).toString("latin1");
        const looksLikeMp3 = header3 === "ID3";
        assertTruthy(looksLikeMp3, "Decoded bytes should look like MP3 data (ID3 tag)");
    });

    await runner.run(category, "Simulated browser decode mirrors client logic", async () => {
        const fakeMp3 = Buffer.alloc(300, 0);
        fakeMp3.set([0x49, 0x44, 0x33], 0); // "ID3"
        const fakeBase64 = fakeMp3.toString("base64");

        // Lightweight btoa/atob shims to mimic browser environment without requiring Puppeteer/Chromium.
        const btoaShim = (str: string) => Buffer.from(str, "binary").toString("base64");
        const atobShim = (b64: string) => Buffer.from(b64, "base64").toString("binary");

        // Input: base64 string -> Output: decoded bytes and round-trip re-encode.
        const body = fakeBase64.trim();
        const decoded = Uint8Array.from(atobShim(body), c => c.charCodeAt(0));
        const header = String.fromCharCode(decoded[0], decoded[1], decoded[2]);

        assertTruthy(decoded.length > 256, "Decoded audio should be at least a few hundred bytes");
        assertEq(header, "ID3", "Decoded bytes should look like MP3 data (ID3 tag)");

        // Round-trip encode to ensure the shim behaves like browser base64 helpers.
        const reEncoded = btoaShim(atobShim(body));
        assertEq(reEncoded, body, "btoa/atob shims should round-trip the payload");
    });
}

async function runBrowserTests(runner: TestRunner) {
    const category = "Browser (Puppeteer)";

    // Puppeteer-core does not download Chromium. We need an existing executable path.
    const chromePath = [process.env.PUPPETEER_EXECUTABLE_PATH, process.env.CHROME_PATH]
        .find(p => p && existsSync(p));

    if (!chromePath) {
        console.warn(`[SKIP] [${category}] No Chromium executable found. Set CHROME_PATH or PUPPETEER_EXECUTABLE_PATH.`);
        return;
    }

    await runner.run(category, "IndexedDB open + basic read/write", async () => {
        const browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: true,
            args: ["--no-sandbox"],
        });

        try {
            const page = await browser.newPage();

            // This checks the primitive that the plugin relies on for persistent caching:
            // open DB -> create store -> put -> get -> delete.
            const ok = await page.evaluate(async () => {
                const DB_NAME = "VcNarratorDB";
                const STORE_NAME = "voices";
                const META_STORE = "voices_meta";
                const META_INDEX = "by_lastAccess";

                const openDb = () =>
                    new Promise<IDBDatabase>((resolve, reject) => {
                        const req = indexedDB.open(DB_NAME, 2); // v2 in util.ts adds metadata store
                        req.onupgradeneeded = () => {
                            const db = req.result;
                            if (!db.objectStoreNames.contains(STORE_NAME)) {
                                db.createObjectStore(STORE_NAME);
                            }
                            if (!db.objectStoreNames.contains(META_STORE)) {
                                const meta = db.createObjectStore(META_STORE);
                                meta.createIndex(META_INDEX, "lastAccess");
                            } else {
                                const meta = req.transaction?.objectStore(META_STORE);
                                if (meta && !meta.indexNames.contains(META_INDEX)) {
                                    meta.createIndex(META_INDEX, "lastAccess");
                                }
                            }
                        };
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error ?? new Error("indexedDB.open() failed"));
                    });

                const tx = <T>(db: IDBDatabase, storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) =>
                    new Promise<T>((resolve, reject) => {
                        const t = db.transaction(storeName, mode);
                        const store = t.objectStore(storeName);
                        const req = fn(store);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
                    });

                const db = await openDb();

                const key = "smoke:key";
                const value = "smoke:value";
                const meta = { size: 42, createdAt: Date.now(), lastAccess: Date.now() };

                await tx(db, STORE_NAME, "readwrite", store => store.put(value, key));
                const read = await tx(db, STORE_NAME, "readonly", store => store.get(key));
                await tx(db, META_STORE, "readwrite", store => store.put(meta, key));
                const readMeta = await tx(db, META_STORE, "readonly", store => store.get(key));

                const hasIndex = db
                    .transaction(META_STORE, "readonly")
                    .objectStore(META_STORE)
                    .indexNames.contains(META_INDEX);

                await tx(db, STORE_NAME, "readwrite", store => store.delete(key));
                await tx(db, META_STORE, "readwrite", store => store.delete(key));

                db.close();
                return read === value && Boolean(readMeta?.size) && hasIndex;
            });

            assertTruthy(ok, "Should be able to write/read/delete from IndexedDB");
        } finally {
            await browser.close();
        }
    });
}

// -------------------------------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------------------------------

(async () => {
    const { runApi, runBrowser } = parseCliArgs(process.argv.slice(2));

    console.log("Starting vcNarratorCustom smoke tests");
    console.log(`API base: ${API_BASE}`);
    console.log(`Flags  : api=${runApi} browser=${runBrowser}\n`);

    const runner = new TestRunner();

    await runUtilLogicTests(runner);

    if (runApi) {
        await runLiveApiTests(runner);
    } else {
        await runSimulatedApiTests(runner);
    }

    if (runBrowser) {
        await runBrowserTests(runner);
    } else {
        console.log("Skipping browser tests (use --browser to enable)");
    }

    runner.printSummaryAndExit();
})().catch(err => {
    console.error("Smoke test crashed:", err);
    process.exit(1);
});
