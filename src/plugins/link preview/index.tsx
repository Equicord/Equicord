/*
 * LinkPreview
 *
 * Author: Zot
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin, { PluginNative } from "@utils/types";
import { Menu, openModal, useEffect, useState } from "@webpack/common";

declare const VencordNative: {
    pluginHelpers: Record<
        string,
        Record<string, (...args: unknown[]) => Promise<unknown>>
    >;
};

const Native = VencordNative.pluginHelpers.LinkPreview as PluginNative<
    typeof import("./native")
>;

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

const URL_REGEX = /https?:\/\/[^\s<>()]+/gi;

function getUrls(content: string): string[] {
    const urls = content.match(URL_REGEX) ?? [];

    return [
        ...new Set(
            urls.map(url =>
                url.replace(/[.,!?;:'")\]}]+$/, ""),
            ),
        ),
    ];
}

function getStatusColor(status: number) {
    if (status >= 200 && status < 300) return "#57F287";
    if (status >= 300 && status < 400) return "#FEE75C";
    if (status >= 400 && status < 500) return "#ED4245";
    if (status >= 500) return "#ED4245";
    return "#FFFFFF";
}

function LinkCheckModal({
    url,
    onClose,
}: {
    url: string;
    onClose: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState<LinkResult | null>(null);

    useEffect(() => {
        let active = true;

        Native.checkLink(url)
            .then(response => {
                if (!active) return;

                setResult(response);
                setLoading(false);
            })
            .catch(error => {
                if (!active) return;

                setResult({
                    success: false,
                    chain: [],
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unable to inspect link.",
                });

                setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [url]);

    return (
        <div
            style={{
                width: "560px",
                maxWidth: "90vw",
                maxHeight: "80vh",
                overflowY: "auto",
                padding: "24px",
                background: "#000000",
                color: "#FFFFFF",
                borderRadius: "10px",
                boxSizing: "border-box",
            }}
        >
            <div
                style={{
                    fontSize: "22px",
                    fontWeight: 700,
                    color: "#FFFFFF",
                    marginBottom: "6px",
                }}
            >
                Link Inspector
            </div>

            <div
                style={{
                    fontSize: "13px",
                    color: "#B5BAC1",
                    lineHeight: "18px",
                    marginBottom: "20px",
                }}
            >
                See where a link redirects before opening it.
            </div>

            <div
                style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#FFFFFF",
                    marginBottom: "7px",
                }}
            >
                Original link
            </div>

            <div
                style={{
                    padding: "12px",
                    background: "#111111",
                    color: "#FFFFFF",
                    border: "1px solid #2A2A2A",
                    borderRadius: "6px",
                    wordBreak: "break-all",
                    fontSize: "14px",
                }}
            >
                {url}
            </div>

            <div
                style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#FFFFFF",
                    marginTop: "22px",
                    marginBottom: "8px",
                }}
            >
                Redirect chain
            </div>

            {loading ? (
                <div
                    style={{
                        padding: "14px",
                        background: "#111111",
                        color: "#FFFFFF",
                        border: "1px solid #2A2A2A",
                        borderRadius: "6px",
                    }}
                >
                    Checking link...
                </div>
            ) : result?.chain.length ? (
                <div
                    style={{
                        padding: "14px",
                        background: "#111111",
                        color: "#FFFFFF",
                        border: "1px solid #2A2A2A",
                        borderRadius: "6px",
                    }}
                >
                    {result.chain.map((hop, index) => (
                        <div key={`${hop.url}-${index}`}>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "9px",
                                }}
                            >
                                <span
                                    style={{
                                        flexShrink: 0,
                                        fontWeight: 700,
                                        color: "#FFFFFF",
                                    }}
                                >
                                    {index + 1}.
                                </span>

                                <div
                                    style={{
                                        minWidth: 0,
                                        flex: 1,
                                        wordBreak: "break-all",
                                        color: "#FFFFFF",
                                        fontSize: "14px",
                                    }}
                                >
                                    {hop.url}
                                </div>

                                <span
                                    style={{
                                        flexShrink: 0,
                                        fontWeight: 700,
                                        color: getStatusColor(hop.status),
                                    }}
                                >
                                    {hop.status}
                                </span>
                            </div>

                            {index < result.chain.length - 1 && (
                                <div
                                    style={{
                                        margin: "10px 0 10px 4px",
                                        color: "#FFFFFF",
                                        fontSize: "16px",
                                    }}
                                >
                                    ↓
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div
                    style={{
                        padding: "14px",
                        background: "#111111",
                        color: "#FFFFFF",
                        border: "1px solid #2A2A2A",
                        borderRadius: "6px",
                    }}
                >
                    {result?.error ?? "Unable to inspect link."}
                </div>
            )}

            {!loading && result?.finalUrl && (
                <>
                    <div
                        style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#FFFFFF",
                            marginTop: "22px",
                            marginBottom: "7px",
                        }}
                    >
                        Final destination
                    </div>

                    <div
                        style={{
                            padding: "12px",
                            background: "#111111",
                            color: "#FFFFFF",
                            border: "1px solid #2A2A2A",
                            borderRadius: "6px",
                            wordBreak: "break-all",
                            fontSize: "14px",
                        }}
                    >
                        {result.finalUrl}
                    </div>

                    <div
                        style={{
                            marginTop: "10px",
                            fontSize: "12px",
                            color: "#FFFFFF",
                        }}
                    >
                        {Math.max(result.chain.length - 1, 0)}{" "}
                        redirect
                        {result.chain.length - 1 === 1 ? "" : "s"}
                    </div>
                </>
            )}

            {!loading && result?.error && (
                <div
                    style={{
                        marginTop: "12px",
                        fontSize: "12px",
                        color: "#ED4245",
                    }}
                >
                    {result.error}
                </div>
            )}

            <button
                style={{
                    marginTop: "20px",
                    padding: "9px 16px",
                    border: "1px solid #444444",
                    borderRadius: "5px",
                    background: "#FFFFFF",
                    color: "#000000",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 600,
                }}
                onClick={onClose}
            >
                Close
            </button>
        </div>
    );
}

const messageContextMenu: NavContextMenuPatchCallback = (
    children,
    { message },
) => {
    if (!message?.content) return;

    const urls = getUrls(message.content);

    if (!urls.length) return;

    children.push(
        <Menu.MenuItem
            id="linkpreview-check-link"
            label="Check Link"
            action={() => {
                openModal(props => (
                    <LinkCheckModal
                        {...props}
                        url={urls[0]}
                    />
                ));
            }}
        />,
    );
};

export default definePlugin({
    name: "LinkPreview",
    description:
        "Inspect links in Discord and see their complete redirect chain before opening them. Right click a message with a link and select 'Check Link' to use this feature.",
    authors: [
        {
            name: "Zot",
            id: 1531412914005606513n,
        },
    ],
    contextMenus: {
        message: messageContextMenu,
    },
});