/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { CodeBlock } from "@components/CodeBlock";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { ChevronSmallDownIcon, ChevronSmallUpIcon, FolderIcon } from "@components/Icons";
import { classNameFactory } from "@utils/css";
import { copyWithToast } from "@utils/discord";
import { closeModal, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { useEffect, useMemo, useRef, useState } from "@webpack/common";

import {
    createImageObjectUrl,
    getAttachmentFileName,
    getAttachmentUrl,
    getCachedZip,
    getCodeLanguage,
    isZipFile,
    makeDownload,
    MAX_ENTRIES,
    readTextEntry,
    ZipEntry,
    ZipPreviewAttachmentProps,
    ZipPreviewCacheState
} from "./utils";

export const cl = classNameFactory("vc-zip-preview-");
const breadcrumbColorStyle = { color: "var(--text-muted)" };

interface VisibleEntries {
    directories: string[];
    files: ZipEntry[];
}

function getVisibleEntries(entries: ZipEntry[], currentPath: string): VisibleEntries {
    const dirs = new Set<string>();
    const files: ZipEntry[] = [];
    const prefix = currentPath ? `${currentPath}/` : "";

    for (const entry of entries) {
        if (!entry.path.startsWith(prefix)) continue;

        const remainder = entry.path.slice(prefix.length);
        const slashIndex = remainder.indexOf("/");

        if (slashIndex === -1) {
            files.push(entry);
        } else {
            dirs.add(remainder.slice(0, slashIndex));
        }
    }

    return {
        directories: Array.from(dirs).sort(),
        files
    };
}

export function ZipPreviewInline(props: ZipPreviewAttachmentProps) {
    const fileName = getAttachmentFileName(props);
    const url = getAttachmentUrl(props);
    const [cacheState, setCacheState] = useState<ZipPreviewCacheState | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isContentMounted, setIsContentMounted] = useState(false);
    const [currentPath, setCurrentPath] = useState("");
    const ToggleIcon = isExpanded ? ChevronSmallUpIcon : ChevronSmallDownIcon;
    const animationFrameRef = useRef<number | null>(null);
    const animationTimeoutRef = useRef<number | null>(null);
    const loadRequestIdRef = useRef(0);

    useEffect(() => {
        loadRequestIdRef.current++;
        setCacheState(null);
        setCurrentPath("");
        setIsExpanded(false);
        setIsContentMounted(false);
    }, [url]);

    useEffect(() => () => {
        loadRequestIdRef.current++;
        if (animationFrameRef.current != null) cancelAnimationFrame(animationFrameRef.current);
        if (animationTimeoutRef.current != null) clearTimeout(animationTimeoutRef.current);
    }, []);

    if (!isZipFile(fileName) || !url) return null;

    const loadPreview = () => {
        const loadRequestId = ++loadRequestIdRef.current;
        const state = getCachedZip(url);
        setCacheState(state);

        if (state.status === "pending") {
            state.promise
                .then(() => {
                    if (loadRequestIdRef.current === loadRequestId) setCacheState(getCachedZip(url));
                })
                .catch(error => {
                    if (loadRequestIdRef.current !== loadRequestId) return;

                    const message = error instanceof Error ? error.message : "Failed to preview ZIP.";
                    setCacheState({ status: "rejected", message });
                });
        }
    };

    const setExpanded = (nextIsExpanded: boolean) => {
        if (animationFrameRef.current != null) cancelAnimationFrame(animationFrameRef.current);
        if (animationTimeoutRef.current != null) clearTimeout(animationTimeoutRef.current);

        if (nextIsExpanded) {
            if (!cacheState || cacheState.status === "rejected") loadPreview();
            setIsContentMounted(true);
            animationFrameRef.current = requestAnimationFrame(() => {
                animationFrameRef.current = null;
                setIsExpanded(true);
            });
            return;
        }

        setIsExpanded(false);
        animationTimeoutRef.current = window.setTimeout(() => {
            animationTimeoutRef.current = null;
            setIsContentMounted(false);
        }, 180);
    };

    return (
        <div className={cl("inline", isContentMounted ? "expanded" : "collapsed", isExpanded ? "open" : "closed")}>
            {isContentMounted && (
                <div className={cl("content")} aria-hidden={!isExpanded}>
                    <div className={cl("content-inner")}>
                        <ZipPreviewContent cacheState={cacheState} currentPath={currentPath} onNavigate={setCurrentPath} />
                    </div>
                </div>
            )}
            <button
                className={cl("toggle")}
                type="button"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse ZIP preview" : "Expand ZIP preview"}
                onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setExpanded(!isExpanded);
                }}
            >
                <ToggleIcon className={cl("toggle-icon")} />
            </button>
        </div>
    );
}

function ZipPreviewContent({
    cacheState,
    currentPath,
    onNavigate
}: {
    cacheState: ZipPreviewCacheState | null;
    currentPath: string;
    onNavigate: (path: string) => void;
}) {
    if (!cacheState || cacheState.status === "pending") {
        return <div className={cl("state")}>Loading ZIP preview...</div>;
    }

    if (cacheState.status === "rejected") {
        return <div className={cl("state")}>{cacheState.message}</div>;
    }

    const { entries, truncated } = cacheState.result;
    if (entries.length === 0) {
        return <div className={cl("state")}>This ZIP is empty.</div>;
    }

    return (
        <>
            <ZipPreviewBreadcrumb path={currentPath} onNavigate={onNavigate} />
            {truncated && <div className={cl("state")}>Only showing first {MAX_ENTRIES} entries.</div>}
            <div className={cl("entries")}>
                <ZipPreviewFileList entries={entries} currentPath={currentPath} onNavigate={onNavigate} />
            </div>
        </>
    );
}

function ZipPreviewBreadcrumb({ path, onNavigate }: { path: string; onNavigate: (path: string) => void; }) {
    if (!path) {
        return (
            <div className={cl("breadcrumb")}>
                <FolderIcon className={cl("breadcrumb-icon")} style={breadcrumbColorStyle} />
                <span className={cl("breadcrumb-current")} style={breadcrumbColorStyle}>/</span>
            </div>
        );
    }

    const parts = path.split("/");

    return (
        <div className={cl("breadcrumb")}>
            <FolderIcon className={cl("breadcrumb-icon")} style={breadcrumbColorStyle} />
            <button
                className={cl("breadcrumb-segment")}
                type="button"
                onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onNavigate("");
                }}
            >
                /
            </button>
            {parts.map((part, index) => {
                const segmentPath = parts.slice(0, index + 1).join("/");
                const isLast = index === parts.length - 1;

                return (
                    <span key={segmentPath}>
                        {isLast
                            ? <span className={cl("breadcrumb-current")} style={breadcrumbColorStyle}>{part}/</span>
                            : (
                                <button
                                    className={cl("breadcrumb-segment")}
                                    type="button"
                                    onClick={event => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        onNavigate(segmentPath);
                                    }}
                                >
                                    {part}
                                </button>
                            )}
                    </span>
                );
            })}
        </div>
    );
}

function ZipPreviewFileList({ entries, currentPath, onNavigate }: { entries: ZipEntry[]; currentPath: string; onNavigate: (path: string) => void; }) {
    const { directories, files } = useMemo(() => getVisibleEntries(entries, currentPath), [entries, currentPath]);

    if (directories.length === 0 && files.length === 0) {
        return <div className={cl("state")}>This folder is empty.</div>;
    }

    return (
        <>
            {directories.map(dir => (
                <button
                    key={dir}
                    className={cl("row", "directory", "button")}
                    type="button"
                    onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        onNavigate(currentPath ? `${currentPath}/${dir}` : dir);
                    }}
                >
                    {dir}/
                </button>
            ))}
            {files.map(entry => (
                <ZipPreviewFileRow key={entry.path} entry={entry} />
            ))}
        </>
    );
}

function ZipPreviewFileRow({ entry }: { entry: ZipEntry; }) {
    const previewable = entry.kind !== "unsupported";

    if (!previewable) {
        return (
            <div className={cl("row", "file", "unsupported")}>
                {entry.name} <span className={cl("size")}>({formatBytes(entry.size)})</span>
            </div>
        );
    }

    return (
        <button
            className={cl("row", "file", "button")}
            type="button"
            onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                openZipEntryModal(entry);
            }}
        >
            {entry.name} <span className={cl("size")}>({formatBytes(entry.size)})</span>
        </button>
    );
}

function openZipEntryModal(entry: ZipEntry) {
    if (entry.kind === "image") {
        openImageEntryModal(entry);
        return;
    }

    if (entry.kind === "text") {
        openTextEntryModal(entry);
    }
}

function openTextEntryModal(entry: ZipEntry) {
    const content = readTextEntry(entry);
    const key = openModal(modalProps => (
        <ErrorBoundary>
            <ModalRoot {...modalProps} size={ModalSize.LARGE}>
                <ModalHeader>
                    <Heading tag="h2" className={cl("modal-title")}>{entry.name}</Heading>
                    <ModalCloseButton onClick={() => closeModal(key)} />
                </ModalHeader>
                <ModalContent className={cl("modal-content")}>
                    <div className={cl("code-wrap")}>
                        <CodeBlock content={content} lang={getCodeLanguage(entry)} />
                    </div>
                </ModalContent>
                <ModalFooter>
                    <Flex gap={8} justifyContent="flex-end">
                        <Button variant="secondary" onClick={() => copyWithToast(content, "File contents copied to clipboard!")}>
                            Copy
                        </Button>
                        <Button onClick={() => makeDownload(entry)}>
                            Download
                        </Button>
                    </Flex>
                </ModalFooter>
            </ModalRoot>
        </ErrorBoundary>
    ));
}

function openImageEntryModal(entry: ZipEntry) {
    const key = openModal(modalProps => (
        <ErrorBoundary>
            <ModalRoot {...modalProps} size={ModalSize.LARGE}>
                <ModalHeader>
                    <Heading tag="h2" className={cl("modal-title")}>{entry.name}</Heading>
                    <ModalCloseButton onClick={() => closeModal(key)} />
                </ModalHeader>
                <ModalContent className={cl("modal-content")}>
                    <ZipImagePreview entry={entry} />
                </ModalContent>
                <ModalFooter>
                    <Flex gap={8} justifyContent="flex-end">
                        <Button onClick={() => makeDownload(entry)}>
                            Download
                        </Button>
                    </Flex>
                </ModalFooter>
            </ModalRoot>
        </ErrorBoundary>
    ));
}

function ZipImagePreview({ entry }: { entry: ZipEntry; }) {
    const [url] = useState(() => createImageObjectUrl(entry));

    useEffect(() => {
        return () => URL.revokeObjectURL(url);
    }, [url]);

    return (
        <div className={cl("image-wrap")}>
            <img className={cl("image")} src={url} alt={entry.name} />
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export const SafeZipPreviewInline = ErrorBoundary.wrap(ZipPreviewInline, { noop: true });
