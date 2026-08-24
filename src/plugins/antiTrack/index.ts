import definePlugin from "@utils/types";
import { showToast } from "@webpack/common";

let originalFetch: typeof window.fetch | null = null;
let originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;

const BLOCKED_ENDPOINTS = [
    "/api/v9/science",
    "/api/v9/track",
    "/api/v9/metrics",
    "sentry.io",
    "discord.com/api/v9/science"
];

const TRACKING_PARAMS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "igshid",
    "fbclid",
    "si",
    "ref",
    "gclid"
];

function sanitizeUrl(urlStr: string): string {
    try {
        const url = new URL(urlStr);
        let modified = false;
        for (const param of TRACKING_PARAMS) {
            if (url.searchParams.has(param)) {
                url.searchParams.delete(param);
                modified = true;
            }
        }
        return modified ? url.toString() : urlStr;
    } catch {
        return urlStr;
    }
}

export default definePlugin({
    name: "AntiTrack",
    description: "Blocks Discord telemetry, metrics, and strips link tracking parameters.",
    authors: [{ name: "NashyLove", id: 195516525631897600n }],

    start() {
        // Intercept Fetch API calls
        originalFetch = window.fetch;
        window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

            if (BLOCKED_ENDPOINTS.some(endpoint => url.includes(endpoint))) {
                return new Response(JSON.stringify({ status: "blocked" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" }
                });
            }

            return originalFetch!.apply(this, arguments as any);
        };

        // Intercept XMLHttpRequest calls
        originalXHROpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
            const urlStr = url.toString();
            if (BLOCKED_ENDPOINTS.some(endpoint => urlStr.includes(endpoint))) {
                // Point request to a no-op endpoint
                url = "data:application/json,{}";
            }
            return originalXHROpen!.apply(this, arguments as any);
        };

        // Clean clipboard links on copy
        document.addEventListener("copy", (e) => {
            const selectedText = window.getSelection()?.toString();
            if (selectedText && selectedText.startsWith("http")) {
                const cleaned = sanitizeUrl(selectedText);
                if (cleaned !== selectedText && e.clipboardData) {
                    e.preventDefault();
                    e.clipboardData.setData("text/plain", cleaned);
                    showToast("Link trackers stripped from clipboard");
                }
            }
        });
    },

    stop() {
        if (originalFetch) {
            window.fetch = originalFetch;
            originalFetch = null;
        }
        if (originalXHROpen) {
            XMLHttpRequest.prototype.open = originalXHROpen;
            originalXHROpen = null;
        }
    }
});