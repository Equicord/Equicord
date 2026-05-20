#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const VALID_MODIFIERS = new Set(["raw", "hash"]);
const MARKER_RE = /#\{intl::([\w$+/]*)(?:::(\w+))?\}/g;
const HASH_RE = /["'`]\s*\.([A-Za-z][A-Za-z0-9+/]{5})\b/g;

const tracked = execFileSync("git", ["ls-files", "src"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(p => /\.(ts|tsx|js|jsx|mjs)$/.test(p))
    .map(p => p.replace(/\//g, sep));

let errors = 0;
let warnings = 0;

for (const rel of tracked) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    if (!text.includes("#{intl::") && !text.includes("find:") && !text.includes("match:")) continue;

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const at = `${rel.replace(/\\/g, "/")}:${i + 1}`;

        if (/#\{intl::[^}]*$/.test(line)) {
            console.error(`${at}: ERROR unclosed #{intl:: marker`);
            errors++;
        }
        for (const [full, key, modifier] of line.matchAll(MARKER_RE)) {
            if (!key) {
                console.error(`${at}: ERROR empty intl key: ${full}`);
                errors++;
            }
            if (modifier && !VALID_MODIFIERS.has(modifier)) {
                console.error(`${at}: ERROR unknown intl modifier "${modifier}": ${full}`);
                errors++;
            }
        }
        if (/\b(find|match)\s*:/.test(line) && !line.includes("#{intl::")) {
            for (const [, hash] of line.matchAll(HASH_RE)) {
                if (!/[0-9+/]/.test(hash)) continue;
                console.warn(`${at}: WARN baked intl hash ".${hash}", prefer #{intl::KEY}`);
                warnings++;
            }
        }
    }
}

console.log(`\nintl lint: ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors > 0 ? 1 : 0);
