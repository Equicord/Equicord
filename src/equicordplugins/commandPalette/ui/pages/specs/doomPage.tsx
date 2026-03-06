/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { useEffect, useRef, useState } from "@webpack/common";

import { doomZipBase64, jsDosV3Base64 } from "../../../doom/runtimeAssets";
import { getDoomBootstrapScript, getDoomRuntimeHtml } from "../../../doom/runtimeHtml";
import type { PalettePageSpec } from "../types";

const cl = classNameFactory("vc-command-palette-");

let focusDoomRuntime: (() => void) | null = null;

function base64ToBlobUrl(base64: string, type: string): string {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }

    return URL.createObjectURL(new Blob([bytes], { type }));
}

function DoomRuntime() {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const jsDosUrlRef = useRef<string | null>(null);
    const doomZipUrlRef = useRef<string | null>(null);
    const bootstrapUrlRef = useRef<string | null>(null);
    const [iframeSrcDoc, setIframeSrcDoc] = useState("");

    useEffect(() => {
        jsDosUrlRef.current = base64ToBlobUrl(jsDosV3Base64, "text/javascript");
        doomZipUrlRef.current = base64ToBlobUrl(doomZipBase64, "application/zip");
        bootstrapUrlRef.current = URL.createObjectURL(new Blob([
            getDoomBootstrapScript()
        ], { type: "text/javascript" }));
        setIframeSrcDoc(getDoomRuntimeHtml(bootstrapUrlRef.current));

        const focus = () => {
            iframeRef.current?.focus();
            iframeRef.current?.contentWindow?.postMessage("focus-doom", "*");
        };

        const onMessage = (event: MessageEvent) => {
            if (event.data?.type === "command-palette-doom-status" && typeof event.data?.message === "string") {
                console.log("[DOOM page]", event.data.message);
            }
        };

        const onLoad = () => {
            if (!iframeRef.current?.contentWindow || !jsDosUrlRef.current || !doomZipUrlRef.current) return;
            iframeRef.current.contentWindow.postMessage({
                type: "command-palette-doom-init",
                jsDosV3Url: jsDosUrlRef.current,
                doomZipUrl: doomZipUrlRef.current
            }, "*");
        };

        focusDoomRuntime = focus;
        const timer = window.setTimeout(focus, 200);
        window.addEventListener("message", onMessage);
        iframeRef.current?.addEventListener("load", onLoad);

        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("message", onMessage);
            iframeRef.current?.removeEventListener("load", onLoad);
            if (focusDoomRuntime === focus) {
                focusDoomRuntime = null;
            }
            if (bootstrapUrlRef.current) URL.revokeObjectURL(bootstrapUrlRef.current);
            if (jsDosUrlRef.current) URL.revokeObjectURL(jsDosUrlRef.current);
            if (doomZipUrlRef.current) URL.revokeObjectURL(doomZipUrlRef.current);
        };
    }, []);

    return (
        <div className={cl("doom-page")}>
            <iframe
                ref={iframeRef}
                className={cl("doom-iframe")}
                srcDoc={iframeSrcDoc}
                title="DOOM"
                allow="autoplay; fullscreen"
            />
        </div>
    );
}

const doomPageSpec: PalettePageSpec = {
    id: "doom",
    title: "DOOM",
    submitLabel: "Refocus DOOM",
    fields: [],
    async submit(context) {
        focusDoomRuntime?.();
        context.showSuccess("Focused DOOM.");
    },
    renderPage() {
        return <DoomRuntime />;
    }
};

export default doomPageSpec;
