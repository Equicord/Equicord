/*
 * LinkPreview
 *
 * Author: Zot
 */

import { IpcMainInvokeEvent } from "electron";
import { request } from "https";

const MAX_REDIRECTS = 10;
const MAX_URL_LENGTH = 2048;
const TIMEOUT = 8000;

interface LinkHop {
    url: string;
    status: number;
}

interface LinkResult {
    success: boolean;
    chain: LinkHop[];
    finalUrl?: string;
    error?: string;
}

function requestRedirect(
    url: string,
): Promise<{
    status: number;
    location?: string;
}> {
    return new Promise((resolve, reject) => {
        let parsed: URL;

        try {
            parsed = new URL(url);
        } catch {
            reject(new Error("Invalid URL."));
            return;
        }

        if (
            parsed.protocol !== "https:" &&
            parsed.protocol !== "http:"
        ) {
            reject(new Error("Unsupported URL protocol."));
            return;
        }

        const req = request(
            parsed,
            {
                method: "HEAD",
                headers: {
                    "User-Agent": "LinkPreview/1.0",
                },
            },
            response => {
                resolve({
                    status: response.statusCode ?? 0,
                    location:
                        typeof response.headers.location === "string"
                            ? response.headers.location
                            : undefined,
                });

                response.resume();
            },
        );

        req.setTimeout(TIMEOUT, () => {
            req.destroy();
        });

        req.once("error", reject);
        req.end();
    });
}

export async function checkLink(
    _: IpcMainInvokeEvent,
    input: unknown,
): Promise<LinkResult> {
    if (
        typeof input !== "string" ||
        input.length === 0 ||
        input.length > MAX_URL_LENGTH
    ) {
        return {
            success: false,
            chain: [],
            error: "Invalid link.",
        };
    }

    try {
        let current = new URL(input);

        const chain: LinkHop[] = [];
        const visited = new Set<string>();

        for (let i = 0; i <= MAX_REDIRECTS; i++) {
            if (visited.has(current.href)) {
                return {
                    success: false,
                    chain,
                    error: "Redirect loop detected.",
                };
            }

            visited.add(current.href);

            const response = await requestRedirect(
                current.href,
            );

            chain.push({
                url: current.href,
                status: response.status,
            });

            const isRedirect =
                response.status >= 300 &&
                response.status < 400;

            if (!isRedirect || !response.location) {
                return {
                    success: true,
                    chain,
                    finalUrl: current.href,
                };
            }

            const next = new URL(
                response.location,
                current.href,
            );

            if (
                next.protocol !== "https:" &&
                next.protocol !== "http:"
            ) {
                return {
                    success: false,
                    chain,
                    error: "Redirected to an unsupported protocol.",
                };
            }

            current = next;
        }

        return {
            success: false,
            chain,
            error: "Too many redirects.",
        };
    } catch {
        return {
            success: false,
            chain: [],
            error: "Unable to inspect this link.",
        };
    }
}