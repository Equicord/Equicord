/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { Button, React, ReactDOM } from "@webpack/common";

import { clearLogs, downloadLogs, getCapturedLogs, LogEntry } from "../utils/consoleLogger";

const timeFormat = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
});
const ErrorFallback = () => (
    <div className="console-viewer-error">Failed to load Console Viewer</div>
);
function ConsoleViewerModal() {
    const [logs, setLogs] = React.useState<LogEntry[]>([]);
    const [search, setSearch] = React.useState("");
    const [filter, setFilter] = React.useState("all");
    const [autoScroll, setAutoScroll] = React.useState(true);
    const logContainerRef = React.useRef<HTMLDivElement>(null);
    const modalRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        function updateLogs() {
            setLogs([...getCapturedLogs()]);
        }
        updateLogs();
        window.addEventListener("console-captured", updateLogs);
        return () => {
            window.removeEventListener("console-captured", updateLogs);
        };
    }, []);
    React.useEffect(() => {
        if (autoScroll && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                closeConsoleViewer();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);
    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                closeConsoleViewer();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    const filteredLogs = React.useMemo(() => {
        return logs.filter(log => {
            if (filter !== "all" && log.type !== filter) return false;

            if (search) {
                const searchLower = search.toLowerCase();
                const contentStr = typeof log.content === "string"
                    ? log.content.toLowerCase()
                    : JSON.stringify(log.content || "").toLowerCase();

                return contentStr.includes(searchLower);
            }

            return true;
        });
    }, [logs, filter, search]);
    const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const atBottom = scrollHeight - scrollTop - clientHeight < 50;
        setAutoScroll(atBottom);
    }, []);
    const renderLogEntry = (log: LogEntry, index: number) => {
        let contentDisplay: React.ReactNode;

        if (typeof log.content === "string") {
            contentDisplay = log.content;
        } else if (Array.isArray(log.content)) {
            contentDisplay = log.content.map((item, i) => (
                <span key={i} className="console-viewer-arg">
                    {typeof item === "object" && item !== null
                        ? JSON.stringify(item, null, 2)
                        : String(item ?? "")}
                </span>
            ));
        } else if (typeof log.content === "object" && log.content !== null) {
            try {
                contentDisplay = JSON.stringify(log.content, null, 2);
            } catch {
                contentDisplay = "[Object]";
            }
        } else {
            contentDisplay = String(log.content ?? "");
        }

        return (
            <div key={index} className={`console-viewer-log-entry console-viewer-log-${log.type}`}>
                <div className="console-viewer-log-time">
                    {timeFormat.format(log.timestamp)}
                </div>
                <div className="console-viewer-log-badge">{log.type.toUpperCase()}</div>
                <div className="console-viewer-log-content">{contentDisplay}</div>
            </div>
        );
    };
    const toggleAutoScroll = React.useCallback(() => {
        setAutoScroll(prev => !prev);
    }, []);
    const handleClear = React.useCallback(() => {
        clearLogs();
        setLogs([]);
    }, []);
    const clearSearch = React.useCallback(() => {
        setSearch("");
    }, []);

    return (
        <>
            <div
                className="console-viewer-backdrop"
                onClick={closeConsoleViewer}
            />
            <div className="console-viewer-modal" ref={modalRef}>
                <div className="console-viewer-header">
                    <div className="console-viewer-title">Console Viewer</div>
                    <div className="console-viewer-actions">
                        <Button
                            color={Button.Colors.PRIMARY}
                            look={Button.Looks.OUTLINED}
                            size={Button.Sizes.SMALL}
                            onClick={downloadLogs}
                        >
                            Export
                        </Button>
                        <Button
                            color={Button.Colors.RED}
                            look={Button.Looks.OUTLINED}
                            size={Button.Sizes.SMALL}
                            onClick={handleClear}
                        >
                            Clear
                        </Button>
                        <button
                            className="console-viewer-close-button"
                            onClick={closeConsoleViewer}
                            aria-label="Close"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="console-viewer-toolbar">
                    <div className="console-viewer-filters">
                        {["all", "log", "info", "warn", "error"].map(type => (
                            <Button
                                key={type}
                                size={Button.Sizes.SMALL}
                                color={filter === type ? Button.Colors.PRIMARY : Button.Colors.TRANSPARENT}
                                onClick={() => setFilter(type)}
                            >
                                {type === "all" ? "All" :
                                    type === "log" ? "Log" :
                                        type === "info" ? "Info" :
                                            type === "warn" ? "Warning" : "Error"}
                            </Button>
                        ))}
                    </div>

                    <div className="console-viewer-search">
                        <input
                            className="console-viewer-search-input"
                            type="text"
                            placeholder="Search logs..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <button
                                className="console-viewer-search-clear"
                                onClick={clearSearch}
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>

                <div
                    className="console-viewer-logs"
                    ref={logContainerRef}
                    onScroll={handleScroll}
                >
                    {filteredLogs.length > 0 ? (
                        filteredLogs.map(renderLogEntry)
                    ) : (
                        <div className="console-viewer-no-logs">
                            {search || filter !== "all" ? "No logs match your filters" : "No console logs captured yet"}
                        </div>
                    )}
                </div>

                <div className="console-viewer-status">
                    <div className="console-viewer-count">
                        {filteredLogs.length} {filteredLogs.length === 1 ? "log" : "logs"}
                        {(search || filter !== "all") ? " (filtered)" : ""}
                    </div>
                    <div className="console-viewer-auto-scroll">
                        <label className="auto-scroll-label">
                            <input
                                type="checkbox"
                                checked={autoScroll}
                                onChange={toggleAutoScroll}
                            />
                            Auto-scroll
                        </label>
                    </div>
                </div>
            </div>
        </>
    );
}
let modalContainer: HTMLDivElement | null = null;
const ReactRender = {
    canUseCreateRoot() {
        return typeof ReactDOM.createRoot === "function";
    },
    render(element: React.ReactElement, container: HTMLElement) {
        if (this.canUseCreateRoot()) {
            try {
                const root = ReactDOM.createRoot(container);
                root.render(element);
                return {
                    unmount: () => {
                        try {
                            root.unmount();
                        } catch (e) {
                            console.error("[Console Viewer] Error unmounting with createRoot:", e);
                            this.fallbackUnmount(container);
                        }
                    }
                };
            } catch (e) {
                console.error("[Console Viewer] Error using createRoot:", e);
            }
        }
        try {
            const root = ReactDOM.hydrateRoot(container, element);
            return {
                unmount: () => root.unmount()
            };
        } catch (e) {
            console.error("[Console Viewer] Error rendering component:", e);
            throw e;
        }
    },
    fallbackUnmount(container: HTMLElement) {
        try {
            if (ReactRender.canUseCreateRoot()) {
                console.warn("[Console Viewer] Attempting to unmount using root.unmount");
            } else {
                console.warn("[Console Viewer] Falling back to container removal for unmounting.");
                try {
                    container.remove();
                } catch (e) {
                    console.error("[Console Viewer] Failed to remove container:", e);
                }
            }
        } catch (e) {
            console.error("[Console Viewer] Error in fallback unmount:", e);
        }
    }
};
let currentRenderer: { unmount: () => void; } | null = null;
export function openConsoleViewer() {
    try {
        if (!modalContainer) {
            modalContainer = document.createElement("div");
            modalContainer.className = "console-viewer-root";
            document.body.appendChild(modalContainer);
        }
        currentRenderer = ReactRender.render(
            <ErrorBoundary fallback={ErrorFallback}>
                <ConsoleViewerModal />
            </ErrorBoundary>,
            modalContainer
        );
        document.body.classList.add("console-viewer-open");
    } catch (error) {
        console.error("[Console Viewer] Failed to open modal:", error);
    }
}
export function closeConsoleViewer() {
    try {
        if (currentRenderer) {
            currentRenderer.unmount();
            currentRenderer = null;
        }
        if (modalContainer) {
            document.body.removeChild(modalContainer);
            modalContainer = null;
        }
        document.body.classList.remove("console-viewer-open");
        document.querySelectorAll(".console-viewer-backdrop").forEach(el => el.remove());
    } catch (error) {
        console.error("[Console Viewer] Failed to close modal:", error);
        document.querySelectorAll(".console-viewer-backdrop, .console-viewer-root").forEach(el => el.remove());
        document.body.classList.remove("console-viewer-open");
        modalContainer = null;
        currentRenderer = null;
    }
}
