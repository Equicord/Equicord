#!/usr/bin/env bun

import { join } from "path";

const ROOT = join(import.meta.dir, "..");

const patches = {
    "@types/less": {
        file: join(ROOT, "node_modules/@types/less/index.d.ts"),
        original: "export = less;",
        patched: "export = LessStatic;",
        removeLines: ["declare var less: LessStatic;"]
    }
};

for (const [pkg, patch] of Object.entries(patches)) {
    const file = Bun.file(patch.file);
    if (!await file.exists()) continue;

    let content = await file.text();

    if (content.includes(patch.patched)) continue;

    content = content.replace(patch.original, patch.patched);
    for (const line of patch.removeLines) {
        content = content.replace(line, "").replace(/\n{3,}/g, "\n\n");
    }

    await Bun.write(patch.file, content.trimEnd() + "\n");
    console.log(`Patched ${pkg}`);
}
