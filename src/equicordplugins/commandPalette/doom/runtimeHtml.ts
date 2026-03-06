/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { jsDosApiSource } from "./runtimeAssets";

export function getDoomBootstrapScript() {
    return `
const statusNode = document.getElementById("doom-status");
const setStatus = message => {
    if (statusNode) {
        statusNode.textContent = message;
    }
    parent.postMessage({ type: "command-palette-doom-status", message }, "*");
    console.log("[DOOM]", message);
};

window.addEventListener("error", event => {
    setStatus(\`error: \${event.message}\`);
});

window.addEventListener("unhandledrejection", event => {
    setStatus(\`promise rejection: \${event.reason}\`);
});

${jsDosApiSource}
setStatus("boot: js-dos api injected");

Dosbox.prototype.downloadScript = function(runtimeUrl) {
    setStatus("boot: loading js-dos runtime");
    this.module.setStatus("Downloading js-dos");
    this.ui.updateMessage("Downloading js-dos");
    window.Module = this.module;

    const scriptTag = document.createElement("script");
    scriptTag.src = runtimeUrl;
    scriptTag.onload = () => {
        setStatus("boot: js-dos runtime loaded");
        this.ui.updateMessage("Initializing dosbox");
        if (this.onload) {
            this.onload(this);
        }
    };
    scriptTag.onerror = () => {
        setStatus("error: failed to load js-dos runtime");
    };
    document.body.appendChild(scriptTag);
};

const originalRun = Dosbox.prototype.run;
Dosbox.prototype.run = function(archiveUrl, executable) {
    setStatus(\`boot: mounting \${executable}\`);
    return originalRun.call(this, archiveUrl, executable);
};

window.addEventListener("message", event => {
    if (event.data === "focus-doom") {
        window.__doom?.ui?.canvas?.focus();
        return;
    }

    if (event.data?.type !== "command-palette-doom-init") {
        return;
    }

    const { jsDosV3Url, doomZipUrl } = event.data;
    setStatus("boot: js-dos blobs prepared");

    const doom = new Dosbox({
        id: "DOOM",
        onload: dosbox => {
            window.__doom = dosbox;
            setStatus("boot: dosbox initialized");
            dosbox.run(doomZipUrl, "./DOOM/DOOM.EXE");
        }
    });

    doom.ui.start.remove();
    doom.ui.overlay.hide();
    setStatus("boot: starting dosbox");
    doom.ui.showLoader();
    doom.downloadScript(jsDosV3Url);
});
`;
}

export function getDoomRuntimeHtml(bootstrapScriptUrl: string) {
    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>DOOM</title>
    <style>
        html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #0a0a0a;
            color: #f5f5f5;
            font-family: system-ui, sans-serif;
        }
        body {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #DOOM {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #doom-root {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            background:
                radial-gradient(circle at top, rgb(153 27 27 / 22%), transparent 45%),
                linear-gradient(180deg, #171717 0%, #090909 100%);
        }
        #DOOM > .dosbox-container {
            width: min(960px, 96vw);
            height: min(600px, 78vh);
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
        #DOOM > .dosbox-container > .dosbox-canvas {
            display: block;
            margin: auto;
        }
        #DOOM > .dosbox-container > .dosbox-overlay {
            background: linear-gradient(180deg, rgb(0 0 0 / 45%), rgb(0 0 0 / 72%));
        }
        #DOOM > .dosbox-container > .dosbox-overlay > .dosbox-start {
            margin: 0 auto;
            width: 12rem;
            padding: 10px 12px;
            border-radius: 12px;
            background: rgb(255 255 255 / 10%);
            border: 1px solid rgb(255 255 255 / 14%);
            text-align: center;
        }
    </style>
</head>
<body>
    <div id="doom-root">
        <div id="DOOM" class="dosbox-default"></div>
    </div>
    <script src="${bootstrapScriptUrl}"></script>
</body>
</html>`;
}
