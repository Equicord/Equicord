/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import { EquicordDevs, IS_MAC } from "@utils/constants";
import { proxyLazy } from "@utils/lazy";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import { ModalContent, ModalFooter, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import { Queue } from "@utils/Queue";
import definePlugin, { OptionType } from "@utils/types";
import { Button, GuildStore, RestAPI, showToast, Text, Toasts, useEffect, zustandCreate } from "@webpack/common";

import styles from "./style.css?managed";

const cl = classNameFactory("ec-quickleave-");
const SELECTED_CLASS = cl("selected");
const SELECTION_ATTRIBUTE = "data-quickleave-selected";
const GUILD_LIST_ID = "guildsnav";
const GUILD_ITEM_SELECTOR = `[data-list-item-id^="${GUILD_LIST_ID}"]`;
const MAX_RETRY = 5;
const RETRY_SLOP_MS = 200;
const LEAVE_DELAY_MS = 1100;
const LEAVE_JITTER_MS = 250;
let leaveCooldownUntil = 0;
const leaveQueue = new Queue();
type LeaveOutcome = "success" | "already" | "owner" | "failed";
const completedOutcomes = new Set<LeaveOutcome>(["success", "already", "owner"]);

interface QuickLeaveState {
    selectedGuildIds: Set<string>;
    isLeaving: boolean;
    addSelection: (guildId: string) => void;
    removeSelection: (guildId: string) => void;
    toggleSelection: (guildId: string) => void;
    clearSelection: () => void;
    setLeaving: (leaving: boolean) => void;
}

interface QuickLeaveSettings {
    confirmBeforeLeave: boolean;
}

const logger = new Logger("QuickLeave", "#e91e63");

const settings = definePluginSettings({
    confirmBeforeLeave: {
        type: OptionType.BOOLEAN,
        description: "Ask for confirmation before leaving",
        default: true,
    },
});

const getSettings = () => settings.store as QuickLeaveSettings;

type StoreSetter = (updater: (state: QuickLeaveState) => QuickLeaveState) => void;
type StoreGetter = () => QuickLeaveState;

const createQuickLeaveStore = (set: StoreSetter, get: StoreGetter): QuickLeaveState => ({
    selectedGuildIds: new Set<string>(),
    isLeaving: false,

    addSelection(guildId: string) {
        set(state => {
            if (state.isLeaving || state.selectedGuildIds.has(guildId)) return state;
            const guild = GuildStore.getGuild?.(guildId);
            if (!guild) {
                logger.error("Tried to queue unknown guild", guildId);
                return state;
            }

            const selectedGuildIds = new Set(state.selectedGuildIds);
            selectedGuildIds.add(guildId);
            return { ...state, selectedGuildIds };
        });
    },

    removeSelection(guildId: string) {
        set(state => {
            if (state.isLeaving || !state.selectedGuildIds.has(guildId)) return state;
            const selectedGuildIds = new Set(state.selectedGuildIds);
            selectedGuildIds.delete(guildId);
            return { ...state, selectedGuildIds };
        });
    },

    toggleSelection(guildId: string) {
        const { selectedGuildIds } = get();
        if (selectedGuildIds.has(guildId)) {
            get().removeSelection(guildId);
        } else {
            get().addSelection(guildId);
        }
    },

    clearSelection() {
        set(state => {
            if (state.isLeaving || state.selectedGuildIds.size === 0) return state;
            return { ...state, selectedGuildIds: new Set<string>() };
        });
    },

    setLeaving(leaving: boolean) {
        set(state => (state.isLeaving === leaving ? state : { ...state, isLeaving: leaving }));
    }
});

const useQuickLeaveStore = proxyLazy(() => zustandCreate(createQuickLeaveStore));

function getQuickLeaveState(): QuickLeaveState {
    return useQuickLeaveStore.getState();
}

function clearSelection() {
    getQuickLeaveState().clearSelection();
}

const highlightedGuildIds = new Set<string>();
const missingGuildIds = new Set<string>();
let selectionUnsubscribe: (() => void) | null = null;
let listenersAttached = false;
let guildListRootEl: HTMLElement | null = null;
let pointerListenerTarget: Document | HTMLElement = document;
let pointerListenersActive = false;
let guildListObserver: MutationObserver | null = null;
let resyncQueued = false;
const pointerListenerOptions: AddEventListenerOptions = { capture: true, passive: false };

function scheduleResync() {
    if (resyncQueued) return;
    resyncQueued = true;
    requestAnimationFrame(() => {
        resyncQueued = false;
        const selected = getQuickLeaveState().selectedGuildIds;
        for (const guildId of selected) setHighlightState(guildId, true);
    });
}

function resolveGuildListRoot(): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-list-id="${GUILD_LIST_ID}"]`);
}

function addPointerListeners(target: Document | HTMLElement) {
    target.addEventListener("pointerdown", handleGuildListPointerDown, pointerListenerOptions);
    target.addEventListener("click", handleGuildListClick, pointerListenerOptions);
}

function removePointerListeners(target: Document | HTMLElement) {
    target.removeEventListener("pointerdown", handleGuildListPointerDown, pointerListenerOptions);
    target.removeEventListener("click", handleGuildListClick, pointerListenerOptions);
}

function setPointerListenerTarget(root: HTMLElement | null) {
    const nextTarget = root ?? document;
    if (pointerListenersActive && nextTarget === pointerListenerTarget) return;

    if (pointerListenersActive) {
        removePointerListeners(pointerListenerTarget);
        pointerListenersActive = false;
    }

    pointerListenerTarget = nextTarget;
    addPointerListeners(pointerListenerTarget);
    pointerListenersActive = true;
}

function findListItemsByGuildId(guildId: string): NodeListOf<HTMLElement> {
    const root = guildListRootEl ?? document;
    return root.querySelectorAll<HTMLElement>(
        `${GUILD_ITEM_SELECTOR}[data-list-item-id*="${guildId}"]`
    );
}

function extractGuildId(element: HTMLElement): string | null {
    const listItemId = element.getAttribute("data-list-item-id") ?? "";

    const match = /guildsnav___(\d{16,22})/.exec(listItemId);
    if (match) return match[1];

    const allDigits = listItemId.match(/\d{16,22}/g);
    if (allDigits?.length) return allDigits[allDigits.length - 1];

    const anchor = element.querySelector<HTMLAnchorElement>('a[href*="/channels/"]');
    const href = anchor?.getAttribute("href") ?? "";
    const idFromHref = href.match(/\/channels\/(\d{16,22})(?!\d)/);
    if (idFromHref?.[1]) return idFromHref[1];

    const dataId = element.dataset?.guildId as string | undefined;
    if (dataId && /^(\d{16,22})$/.test(dataId)) return dataId;

    logger.error("Failed to extract guild ID", { listItemId, href: anchor?.getAttribute("href") ?? "" });
    return null;
}

function findTreeItem(element: HTMLElement): HTMLElement | null {
    return element.closest<HTMLElement>("[data-list-item-id]") ?? element.querySelector<HTMLElement>("[data-list-item-id]");
}

function getSelectionTargets(element: HTMLElement): HTMLElement[] {
    const container = findTreeItem(element) ?? element;
    return [container];
}

function applySelectionState(element: HTMLElement, selected: boolean) {
    for (const target of getSelectionTargets(element)) {
        if (selected) {
            target.setAttribute(SELECTION_ATTRIBUTE, "true");
            target.classList.add(SELECTED_CLASS);
        } else {
            target.removeAttribute(SELECTION_ATTRIBUTE);
            target.classList.remove(SELECTED_CLASS);
        }
    }
}

function toggleNodeHighlight(node: HTMLElement, shouldHighlight: boolean) {
    applySelectionState(node, shouldHighlight);
}

function updateGuildHighlight(guildId: string, shouldHighlight: boolean): boolean {
    const listItems = findListItemsByGuildId(guildId);
    if (listItems.length === 0) return false;

    for (const listItem of Array.from(listItems)) {
        toggleNodeHighlight(listItem, shouldHighlight);
    }

    return true;
}

function setHighlightState(guildId: string, shouldHighlight: boolean) {
    const updated = updateGuildHighlight(guildId, shouldHighlight);
    if (shouldHighlight) {
        if (updated) {
            highlightedGuildIds.add(guildId);
            missingGuildIds.delete(guildId);
        } else {
            missingGuildIds.add(guildId);
        }
    } else {
        if (updated) highlightedGuildIds.delete(guildId);
        missingGuildIds.delete(guildId);
    }
}

function syncDomSelection(selected: Set<string>) {
    for (const guildId of Array.from(highlightedGuildIds)) {
        if (!selected.has(guildId)) setHighlightState(guildId, false);
    }

    for (const guildId of Array.from(missingGuildIds)) if (!selected.has(guildId)) missingGuildIds.delete(guildId);

    for (const guildId of selected) {
        if (highlightedGuildIds.has(guildId)) continue;
        setHighlightState(guildId, true);
    }
}

function clearDomSelection() {
    for (const guildId of Array.from(highlightedGuildIds)) setHighlightState(guildId, false);
    highlightedGuildIds.clear();
    missingGuildIds.clear();
}

function shouldIgnoreTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (target.closest("input, textarea, select")) return true;
    return false;
}

function findGuildItemFromNode(node: EventTarget | null): HTMLElement | null {
    if (!(node instanceof HTMLElement)) return null;
    return node.closest<HTMLElement>(GUILD_ITEM_SELECTOR) ?? node.closest<HTMLElement>("[data-list-item-id]");
}

function findGuildItemFromEvent(event: Event): HTMLElement | null {
    if (typeof event.composedPath === "function") {
        for (const element of event.composedPath()) {
            const item = findGuildItemFromNode(element);
            if (item) return item;
        }
    }

    return findGuildItemFromNode(event.target);
}

function handleGuildListPointerDown(event: Event) {
    const pe = event as PointerEvent;
    if (pe.button !== 0) return;
    if (!(pe.ctrlKey || (IS_MAC && pe.metaKey))) return;
    if (getQuickLeaveState().isLeaving) return;

    const item = findGuildItemFromEvent(event);
    if (!item) return;

    const guildId = extractGuildId(item);
    if (!guildId) {
        logger.error("Failed to extract guildId from item", {
            listItemId: item.getAttribute("data-list-item-id"),
        });
        return;
    }

    stopEvent(event);

    const wasSelected = getQuickLeaveState().selectedGuildIds.has(guildId);
    const willSelect = !wasSelected;
    setHighlightState(guildId, willSelect);
    getQuickLeaveState().toggleSelection(guildId);
}

function handleGuildListClick(event: Event) {
    const mouseEvent = event as MouseEvent;
    if (!(mouseEvent.ctrlKey || (IS_MAC && mouseEvent.metaKey))) return;
    const item = findGuildItemFromEvent(event);
    if (!item) return;
    stopEvent(event);
}

async function handleDeleteKey(): Promise<void> {
    await triggerBulkLeave();
}

function handleDocumentKeyDown(event: KeyboardEvent) {
    if (getQuickLeaveState().isLeaving) return;
    if (shouldIgnoreTarget(event.target)) return;

    if (event.key === "Escape") {
        const { selectedGuildIds } = getQuickLeaveState();
        if (selectedGuildIds.size === 0) return;
        event.stopPropagation();
        event.preventDefault();
        clearSelection();
        return;
    }

    if (event.key === "Delete" && !event.repeat) {
        if (getQuickLeaveState().selectedGuildIds.size === 0) return;
        event.preventDefault();
        event.stopPropagation();
        void handleDeleteKey();
    }
}

function openConfirmModal(count: number): Promise<boolean> {
    if (!getSettings().confirmBeforeLeave) return Promise.resolve(true);

    return new Promise(resolve => {
        let settled = false;
        const { selectedGuildIds } = getQuickLeaveState();
        const names = Array.from(selectedGuildIds)
            .map(id => GuildStore.getGuild(id)?.name ?? id)
            .slice(0, 5);

        openModal(modalProps => {
            const { onClose, ...restProps } = modalProps;
            const first = names[0];
            const title = count === 1 ? (first ? `Leave '${first}'` : "Leave Server") : `Leave ${count} Servers`;

            const complete = (result: boolean) => {
                if (!settled) {
                    settled = true;
                    resolve(result);
                }
                onClose();
            };

            return (
                <ModalRoot {...restProps} size={ModalSize.SMALL}>
                    <ModalHeader separator={false}>
                        <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>{title}</Text>
                    </ModalHeader>
                    <ModalContent scrollbarType="none">
                        <Text variant="text-md/normal" color="header-secondary">
                            {count === 1
                                ? <>Are you sure you want to leave <strong>{first ?? "this server"}</strong>? You won't be able to re-join unless you are re-invited.</>
                                : <>Are you sure you want to leave <strong>{count} servers</strong>? You won't be able to re-join them unless you are re-invited.</>}
                        </Text>
                    </ModalContent>
                    <ModalFooter separator>
                        <div style={{ display: "flex", gap: 8 }}>
                            <Button
                                color={Button.Colors.PRIMARY}
                                look={Button.Looks.FILLED}
                                size={Button.Sizes.MEDIUM}
                                tabIndex={-1}
                                onClick={() => complete(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                color={Button.Colors.RED}
                                look={Button.Looks.FILLED}
                                size={Button.Sizes.MEDIUM}
                                style={{ flex: 1 }}
                                tabIndex={-1}
                                onClick={() => complete(true)}
                            >
                                {count === 1 ? "Leave Server" : "Leave Servers"}
                            </Button>
                        </div>
                    </ModalFooter>
                </ModalRoot>
            );
        }, {
            onCloseCallback: () => {
                if (!settled) {
                    settled = true;
                    resolve(false);
                }
            }
        });
    });
}

async function triggerBulkLeave(): Promise<void> {
    const { selectedGuildIds, isLeaving } = getQuickLeaveState();
    if (isLeaving || selectedGuildIds.size === 0) return;

    const guildIds = Array.from(selectedGuildIds);
    const proceed = await openConfirmModal(guildIds.length);
    if (!proceed) return;

    getQuickLeaveState().setLeaving(true);

    const deselectAfter = new Set<string>();
    const failedGuildIds: string[] = [];

    try {
        for (let i = 0; i < guildIds.length; i++) {
            const guildId = guildIds[i];
            const guild = GuildStore.getGuild(guildId);
            if (!guild) {
                setHighlightState(guildId, false);
                deselectAfter.add(guildId);
                continue;
            }

            const outcome = await enqueueLeave(guildId);
            if (completedOutcomes.has(outcome)) {
                setHighlightState(guildId, false);
                deselectAfter.add(guildId);
            } else {
                failedGuildIds.push(guildId);
            }
        }
    } finally {
        getQuickLeaveState().setLeaving(false);
    }

    const state = getQuickLeaveState();
    for (const guildId of deselectAfter) {
        try {
            state.removeSelection(guildId);
        } catch (error) {
            logger.error("Failed to remove guild from selection after leave", { guildId, error });
        }
    }

    scheduleResync();

    if (failedGuildIds.length > 0) {
        const noun = failedGuildIds.length === 1 ? "server" : "servers";
        showToast(`${failedGuildIds.length} ${noun} failed to leave and remain selected.`, Toasts.Type.FAILURE);
    }
}

function attachListeners() {
    if (listenersAttached) return;
    guildListRootEl = resolveGuildListRoot();
    setPointerListenerTarget(guildListRootEl);
    document.addEventListener("keydown", handleDocumentKeyDown, true);

    if (typeof MutationObserver === "function") {
        const observerTarget = document.body ?? document.documentElement ?? document;
        guildListObserver?.disconnect();
        guildListObserver = new MutationObserver(() => {
            const nextRoot = resolveGuildListRoot();
            if (nextRoot !== guildListRootEl) {
                guildListRootEl = nextRoot;
                setPointerListenerTarget(guildListRootEl);
            }
            scheduleResync();
        });
        guildListObserver.observe(observerTarget, { childList: true, subtree: true });
    }

    listenersAttached = true;
}

function detachListeners() {
    if (!listenersAttached) return;
    if (pointerListenersActive) {
        removePointerListeners(pointerListenerTarget);
        pointerListenersActive = false;
    }
    document.removeEventListener("keydown", handleDocumentKeyDown, true);
    guildListObserver?.disconnect();
    guildListObserver = null;
    guildListRootEl = null;
    pointerListenerTarget = document;
    listenersAttached = false;
}


function getRetryAfterMs(error: unknown): number | null {
    if (typeof error !== "object" || error === null) return null;

    const maybeError = error as {
        status?: number;
        body?: { retry_after?: number; };
        headers?: Record<string, string>;
        retry_after?: number;
    };

    const retryAfterBody = maybeError.body?.retry_after ?? maybeError.retry_after;
    if (typeof retryAfterBody === "number" && Number.isFinite(retryAfterBody)) {
        return Math.max(0, retryAfterBody * 1000);
    }

    const headerValue = maybeError.headers?.["retry-after"];
    if (headerValue) {
        const headerSeconds = Number(headerValue);
        if (Number.isFinite(headerSeconds)) {
            return Math.max(0, headerSeconds * 1000);
        }
    }

    if (maybeError.status === 429) {
        return 1000;
    }

    return null;
}

function stopEvent(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}

function enqueueLeave(guildId: string): Promise<LeaveOutcome> {
    return new Promise(resolve => {
        leaveQueue.push(async () => {
            try {
                const result = await leaveGuildSafely(guildId);
                resolve(result);
            } catch (error) {
                logger.error("Unexpected error while leaving guild", guildId, error);
                resolve("failed");
            }
        });
    });
}

async function leaveGuildSafely(guildId: string): Promise<LeaveOutcome> {
    let attempt = 0;
    while (attempt < MAX_RETRY) {
        try {
            const now = Date.now();
            if (leaveCooldownUntil > now) {
                await sleep(leaveCooldownUntil - now);
            }
            await RestAPI.del({ url: `/users/@me/guilds/${guildId}` });
            const jitter = Math.floor(Math.random() * LEAVE_JITTER_MS);
            leaveCooldownUntil = Date.now() + LEAVE_DELAY_MS + jitter;
            return "success";
        } catch (error) {
            attempt += 1;
            const retryAfterMs = getRetryAfterMs(error);
            if (retryAfterMs != null) {
                leaveCooldownUntil = Date.now() + retryAfterMs + RETRY_SLOP_MS;
                await sleep(retryAfterMs + RETRY_SLOP_MS);
                continue;
            }
            if (isAlreadyGoneOrNoAccess(error)) {
                return "already";
            }
            if (isOwnerOrInvalidServer(error)) {
                const name = GuildStore.getGuild(guildId)?.name ?? "this server";
                showToast(`You own the server"${name}", you can't yeet it like this.`, Toasts.Type.FAILURE);
                return "owner";
            }
            logger.error(`Failed to leave guild ${guildId}:`, error);
            return "failed";
        }
    }
    return "failed";
}


interface DiscordErrorInfo {
    status?: number;
    code?: number;
    message?: string;
}

function parseDiscordError(error: unknown): DiscordErrorInfo | null {
    if (!error || typeof error !== "object") return null;
    const e = error as { status?: number; body?: any; text?: string; };
    const code = e.body?.code;
    const message = e.body?.message ?? e.text;
    return { status: e.status, code, message: typeof message === "string" ? message : undefined };
}

function isOwnerOrInvalidServer(error: unknown): boolean {
    const info = parseDiscordError(error);
    if (!info || info.status !== 400) return false;
    const msg = info.message ?? "";
    return info.code === 50055 || /invalid server|owner/i.test(msg);
}

function isAlreadyGoneOrNoAccess(error: unknown): boolean {
    const info = parseDiscordError(error);
    if (!info) return false;
    if (info.status === 404) return true; // Unknown Guild
    if (info.status === 403) return true; // Missing Access
    return info.code === 10004 /* Unknown Guild */ || info.code === 50001 /* Missing Access */;
}

export default definePlugin({
    name: "QuickLeave",
    description: "Queue servers with Ctrl/Cmd+Click and leave them in bulk with Delete key.",
    authors: [EquicordDevs.Prism],
    settings,
    managedStyle: styles,
    patches: [
        {
            find: '("guildsnav")',
            replacement: {
                match: /let\{disableAppDownload.{0,40}?isPlatformEmbedded/,
                replace: "$self.useRerender();$&"
            }
        }
    ],

    start() {
        selectionUnsubscribe = useQuickLeaveStore.subscribe(
            state => state.selectedGuildIds,
            selected => syncDomSelection(selected)
        );
        syncDomSelection(getQuickLeaveState().selectedGuildIds);

        attachListeners();
        scheduleResync();
    },

    stop() {
        detachListeners();


        if (selectionUnsubscribe) {
            selectionUnsubscribe();
            selectionUnsubscribe = null;
        }

        clearSelection();
        clearDomSelection();
    },

    useRerender() {
        useQuickLeaveStore(s => s.selectedGuildIds.size);
        useEffect(() => {
            scheduleResync();
        }, []);
    }
});
