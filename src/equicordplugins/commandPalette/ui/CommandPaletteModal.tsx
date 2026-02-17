/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "../style.css";

import { isPluginEnabled, plugins } from "@api/PluginManager";
import { toggleEnabled } from "@equicordplugins/equicordHelper/utils";
import { addScheduledMessage } from "@equicordplugins/scheduledMessages/utils";
import { copyWithToast } from "@utils/discord";
import { type ModalProps, ModalRoot, ModalSize } from "@utils/modal";
import { ChannelStore, SelectedChannelStore, TextInput, Toasts, useEffect, useMemo, useRef, useState } from "@webpack/common";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";

import { buildQueryResolution } from "../actions/executors";
import { resolveCalculatorQuery } from "../calculator";
import { SCHEDULED_MESSAGES_CREATE_PAGE_CATEGORY_ID } from "../extensions/catalog";
import { settings } from "../index";
import { getRecentCommandEntries } from "../providers/recentProvider";
import { resolveAllChannels } from "../query/resolvers";
import type { QueryActionCandidate } from "../query/types";
import {
    type CommandEntry,
    DEFAULT_CATEGORY_ID,
    executeCommandAction,
    getCategoryPath,
    getCategoryWeight,
    getMentionCommandsSnapshot,
    getRecentRank,
    getRegistryVersion,
    listChildCategories,
    listCommands,
    markCommandAsRecent,
    refreshAllContextProviders,
    subscribePinned,
    subscribeRegistry
} from "../registry";
import { rankItems } from "../search/ranker";
import { CommandPaletteActionBar } from "./CommandPaletteActionBar";
import { CommandPaletteActionsMenu, type PaletteAction } from "./CommandPaletteActionsMenu";
import { CommandPaletteCalculatorCards } from "./CommandPaletteCalculatorCards";
import { CommandPaletteInput } from "./CommandPaletteInput";
import { CommandPaletteRow } from "./CommandPaletteRow";
import { CommandPaletteScheduledCreatePage } from "./CommandPaletteScheduledCreatePage";
import type { CommandCandidate, PaletteCandidate } from "./types";

type NavigationLevel =
    | { type: "root"; }
    | { type: "category"; categoryId: string; parentLevels: NavigationLevel[]; };

const MENTIONS_CATEGORY_ID = "mentions-actions";
let persistedCategoryId: string | null = null;
const SINGLE_SELECT_PROMPT_COMMAND_IDS = new Set([
    "command-palette-open-dm-query",
    "command-palette-navigate-to-query",
    "extension-holy-notes-delete-notebook-query",
    "extension-holy-notes-move-note-query",
    "extension-holy-notes-jump-note-query"
]);

function asCommandCandidate(command: CommandEntry, pinned: boolean, badge: "Command" | "Recent"): CommandCandidate {
    const path = getCategoryPath(command.categoryId)
        .filter(category => category.id !== DEFAULT_CATEGORY_ID)
        .map(category => category.label)
        .join(" / ");

    return {
        type: "command",
        id: `command-${command.id}`,
        command,
        subtitle: path || undefined,
        badge,
        pinned,
        shortcut: command.shortcut ?? undefined,
        icon: command.icon
    };
}

function isSelectable(candidate: PaletteCandidate | undefined): candidate is CommandCandidate {
    return Boolean(candidate && candidate.type === "command");
}

function getSelectedLabel(item: PaletteCandidate | undefined): string | undefined {
    if (!isSelectable(item)) return undefined;
    return item.command.label;
}

function hasChildren(command: CommandEntry, allCommands: CommandEntry[]): boolean {
    const { drilldownCategoryId } = command;
    if (drilldownCategoryId) {
        if (listChildCategories(drilldownCategoryId).length > 0) return true;
        return allCommands.some(entry => entry.categoryId === drilldownCategoryId);
    }

    if (!command.categoryId) return false;
    const childCategories = listChildCategories(command.categoryId);
    if (childCategories.length > 0) return true;

    return allCommands.some(entry => entry.categoryId === command.categoryId && entry.id !== command.id);
}

function getCategoryCommands(categoryId: string, allCommands: CommandEntry[]): CommandEntry[] {
    return allCommands.filter(command => command.categoryId === categoryId);
}

function pushNavigationLevel(current: NavigationLevel, categoryId: string): NavigationLevel {
    if (current.type === "category") {
        return {
            type: "category",
            categoryId,
            parentLevels: [...current.parentLevels, current]
        };
    }

    return {
        type: "category",
        categoryId,
        parentLevels: [{ type: "root" }]
    };
}

function scoreSuggestion(id: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < id.length; i++) {
        hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
}

function getEnterActionKey(event: ReactKeyboardEvent<HTMLDivElement>): string {
    const keys: string[] = [];
    if (event.metaKey) keys.push("meta");
    if (event.altKey) keys.push("alt");
    if (event.ctrlKey) keys.push("ctrl");
    if (event.shiftKey) keys.push("shift");
    keys.push("enter");
    return keys.join("+");
}

function buildNavigationLevelForCategory(categoryId: string): NavigationLevel {
    const path = getCategoryPath(categoryId);
    if (path.length === 0) return { type: "root" };

    const chain = path.map(category => category.id);
    const parentLevels: NavigationLevel[] = [{ type: "root" }];
    for (const parentCategoryId of chain.slice(0, -1)) {
        parentLevels.push({
            type: "category",
            categoryId: parentCategoryId,
            parentLevels: [...parentLevels]
        });
    }

    return {
        type: "category",
        categoryId: chain[chain.length - 1],
        parentLevels
    };
}

function clearPersistedNavigation() {
    persistedCategoryId = null;
}

function parseClockToken(value: string, base: Date): number | null {
    const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return null;

    const rawHour = Number.parseInt(match[1], 10);
    const minute = Number.parseInt(match[2] ?? "0", 10);
    const meridiem = match[3]?.toLowerCase();

    if (Number.isNaN(rawHour) || Number.isNaN(minute) || minute < 0 || minute > 59) return null;

    let hour = rawHour;
    if (meridiem) {
        if (hour < 1 || hour > 12) return null;
        if (meridiem === "pm" && hour < 12) hour += 12;
        if (meridiem === "am" && hour === 12) hour = 0;
    } else if (hour < 0 || hour > 23) {
        return null;
    }

    const candidate = new Date(base);
    candidate.setHours(hour, minute, 0, 0);
    return candidate.getTime();
}

function parseScheduledTimeInput(input: string): number | null {
    const normalized = input.trim();
    if (!normalized) return null;

    const lower = normalized.toLowerCase();
    const now = Date.now();

    const relative = lower.match(/^in\s+(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/);
    if (relative) {
        const amount = Number.parseInt(relative[1], 10);
        if (amount < 1) return null;
        const unit = relative[2];
        const multiplier = unit.startsWith("m")
            ? 60_000
            : unit.startsWith("h")
                ? 3_600_000
                : 86_400_000;
        return now + amount * multiplier;
    }

    const tomorrow = lower.match(/^tomorrow(?:\s+at)?\s+(.+)$/);
    if (tomorrow?.[1]) {
        const base = new Date();
        base.setDate(base.getDate() + 1);
        return parseClockToken(tomorrow[1], base);
    }

    const today = lower.match(/^today(?:\s+at)?\s+(.+)$/);
    if (today?.[1]) {
        const timestamp = parseClockToken(today[1], new Date());
        return timestamp && timestamp > now ? timestamp : null;
    }

    const clockOnly = parseClockToken(normalized, new Date());
    if (clockOnly) {
        if (clockOnly > now) return clockOnly;
        return clockOnly + 86_400_000;
    }

    const absolute = normalized.match(/^(\d{4}-\d{2}-\d{2})(?:[ t](\d{1,2}:\d{2}(?:\s*(?:am|pm))?))?$/i);
    if (absolute) {
        if (absolute[2]) {
            const [year, month, day] = absolute[1].split("-").map(part => Number.parseInt(part, 10));
            const base = new Date(year, month - 1, day);
            return parseClockToken(absolute[2], base);
        }

        const dateOnly = new Date(`${absolute[1]}T09:00:00`);
        const timestamp = dateOnly.getTime();
        return Number.isNaN(timestamp) ? null : timestamp;
    }

    const parsed = new Date(normalized).getTime();
    if (Number.isNaN(parsed) || parsed <= now) return null;
    return parsed;
}

async function ensureScheduledMessagesPluginEnabled() {
    const plugin = plugins.ScheduledMessages;
    if (!plugin) {
        Toasts.show({
            message: "ScheduledMessages plugin is unavailable.",
            type: Toasts.Type.FAILURE,
            id: Toasts.genId(),
            options: { position: Toasts.Position.BOTTOM }
        });
        return false;
    }

    if (isPluginEnabled(plugin.name)) return true;

    const success = await toggleEnabled(plugin.name);
    if (!success || !isPluginEnabled(plugin.name)) {
        Toasts.show({
            message: "Failed to enable ScheduledMessages.",
            type: Toasts.Type.FAILURE,
            id: Toasts.genId(),
            options: { position: Toasts.Position.BOTTOM }
        });
        return false;
    }

    return true;
}

export function CommandPaletteModal({ modalProps }: { modalProps: ModalProps; }) {
    const [query, setQuery] = useState("");
    const [expanded, setExpanded] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [keyboardSelectedKey, setKeyboardSelectedKey] = useState<string | null>(null);
    const [registryVersion, setRegistryVersion] = useState(() => getRegistryVersion());
    const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
    const [navigationLevel, setNavigationLevel] = useState<NavigationLevel>(() => {
        if (!persistedCategoryId) return { type: "root" };
        return buildNavigationLevelForCategory(persistedCategoryId);
    });
    const [activePromptCommand, setActivePromptCommand] = useState<CommandEntry | null>(null);
    const [promptInputValue, setPromptInputValue] = useState("");
    const [selectedPromptCandidateId, setSelectedPromptCandidateId] = useState<string | null>(null);
    const [focusPromptInput, setFocusPromptInput] = useState(false);
    const [showPromptDropdown, setShowPromptDropdown] = useState(false);
    const [selectionSource, setSelectionSource] = useState<"keyboard" | "pointer">("keyboard");
    const [createScheduledChannel, setCreateScheduledChannel] = useState("");
    const [createScheduledChannelId, setCreateScheduledChannelId] = useState<string | null>(null);
    const [createScheduledTime, setCreateScheduledTime] = useState("");
    const [createScheduledMessage, setCreateScheduledMessage] = useState("");
    const [createScheduledError, setCreateScheduledError] = useState<string | null>(null);
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const activePromptCommandIdRef = useRef<string | null>(null);
    const promptContainerRef = useRef<HTMLDivElement | null>(null);
    const suggestionSeedRef = useRef((Math.random() * 0xffffffff) >>> 0);
    const listRef = useRef<HTMLDivElement | null>(null);
    const closeReasonRef = useRef<"programmatic" | "explicit-root" | null>(null);
    const keyboardNavigationAtRef = useRef(0);

    const {
        compactStartEnabled = true,
        closeAfterExecute = true
    } = settings.use();

    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

    useEffect(() => subscribeRegistry(setRegistryVersion), []);

    useEffect(() => subscribePinned(ids => setPinnedIds(new Set(ids))), []);

    useEffect(() => {
        return () => {
            if (closeReasonRef.current === "explicit-root") {
                clearPersistedNavigation();
                return;
            }

            if (closeReasonRef.current === "programmatic") {
                clearPersistedNavigation();
                return;
            }

            if (navigationLevel.type === "category") {
                persistedCategoryId = navigationLevel.categoryId;
                return;
            }

            clearPersistedNavigation();
        };
    }, [navigationLevel]);

    useEffect(() => {
        setIsActionsMenuOpen(false);
    }, [navigationLevel]);

    const trimmedQuery = query.trim();
    const compact = compactStartEnabled && trimmedQuery.length === 0 && !expanded && navigationLevel.type === "root";

    const allCommands = useMemo(() => listCommands(), [registryVersion]);

    const currentCommands = useMemo(() => {
        if (navigationLevel.type === "root") return allCommands;
        if (navigationLevel.categoryId === MENTIONS_CATEGORY_ID) {
            const snapshot = getMentionCommandsSnapshot();
            if (snapshot.length > 0) return snapshot;
        }
        return getCategoryCommands(navigationLevel.categoryId, allCommands);
    }, [allCommands, navigationLevel]);

    const includeHiddenInCurrentLevel = navigationLevel.type === "category";
    const searchableCommands = useMemo(
        () => currentCommands.filter(command => includeHiddenInCurrentLevel || !command.hiddenInSearch),
        [currentCommands, includeHiddenInCurrentLevel]
    );

    const rankedCommandCandidates = useMemo(() => {
        if (!trimmedQuery) {
            return searchableCommands.map(command => asCommandCandidate(command, pinnedIds.has(command.id), "Command"));
        }

        const ranked = rankItems(
            trimmedQuery,
            searchableCommands.map(entry => ({
                id: entry.id,
                label: entry.label,
                description: entry.description,
                keywords: entry.keywords,
                pinned: pinnedIds.has(entry.id),
                recentRank: getRecentRank(entry.id),
                categoryWeight: getCategoryWeight(entry.categoryId)
            })),
            { semantic: true }
        );

        return ranked
            .filter(item => item.score > 0)
            .slice(0, 40)
            .map(item => {
                const command = searchableCommands.find(entry => entry.id === item.item.id);
                if (!command) return null;
                return asCommandCandidate(command, pinnedIds.has(command.id), "Command");
            })
            .filter((entry): entry is CommandCandidate => Boolean(entry));
    }, [trimmedQuery, searchableCommands, pinnedIds]);

    const recentCandidates = useMemo(() => {
        return getRecentCommandEntries(5).map(command => asCommandCandidate(command, pinnedIds.has(command.id), "Recent"));
    }, [registryVersion, pinnedIds]);

    const suggestedCandidates = useMemo(() => {
        if (navigationLevel.type !== "root") return [];
        if (trimmedQuery.length > 0) return [];

        const recentIds = new Set(recentCandidates.map(item => item.command.id));
        const pool = searchableCommands
            .filter(command => !recentIds.has(command.id))
            .map(command => asCommandCandidate(command, pinnedIds.has(command.id), "Command"));

        return pool
            .sort((left, right) => scoreSuggestion(left.command.id, suggestionSeedRef.current) - scoreSuggestion(right.command.id, suggestionSeedRef.current))
            .slice(0, 8);
    }, [navigationLevel.type, trimmedQuery, recentCandidates, searchableCommands, pinnedIds]);

    const items = useMemo(() => {
        const expandedItems: PaletteCandidate[] = [];

        if (navigationLevel.type === "category") {
            const path = getCategoryPath(navigationLevel.categoryId);
            const breadcrumb = path.map(category => category.label).join(" → ");
            expandedItems.push({ type: "section", id: "section-breadcrumb", label: breadcrumb });
        }

        if (!compact && navigationLevel.type === "root" && trimmedQuery.length === 0) {
            if (recentCandidates.length > 0) {
                expandedItems.push({ type: "section", id: "section-recent", label: "Recent" });
                expandedItems.push(...recentCandidates);
            }

            if (suggestedCandidates.length > 0) {
                expandedItems.push({ type: "section", id: "section-suggested", label: "Suggested" });
                expandedItems.push(...suggestedCandidates);
            }
        }

        if (rankedCommandCandidates.length > 0) {
            if (navigationLevel.type === "root" && trimmedQuery.length === 0) {
                const seenCommandIds = new Set<string>();
                for (const item of expandedItems) {
                    if (item.type === "command") {
                        seenCommandIds.add(item.command.id);
                    }
                }
                expandedItems.push(...rankedCommandCandidates.filter(item => !seenCommandIds.has(item.command.id)));
            } else {
                expandedItems.push(...rankedCommandCandidates);
            }
        }

        return expandedItems;
    }, [compact, navigationLevel, rankedCommandCandidates, recentCandidates, suggestedCandidates, trimmedQuery]);

    const emptyStateText = navigationLevel.type === "category" && navigationLevel.categoryId === MENTIONS_CATEGORY_ID
        ? "All caught up."
        : "No results.";
    const hasCommandItems = items.some(item => item.type === "command");

    const explicitlySelectedCommand = useMemo(() => {
        if (!keyboardSelectedKey) return null;
        const keyed = items.find(item => item.type === "command" && item.id === keyboardSelectedKey);
        return keyed?.type === "command" ? keyed.command : null;
    }, [items, keyboardSelectedKey]);

    const previewPromptCommand = !activePromptCommand
        && selectionSource === "keyboard"
        && explicitlySelectedCommand?.queryTemplate
        ? explicitlySelectedCommand
        : null;
    const promptCommand = activePromptCommand ?? previewPromptCommand;
    const calculatorResult = useMemo(() => {
        if (!trimmedQuery) return null;
        if (activePromptCommand) return null;
        return resolveCalculatorQuery(trimmedQuery);
    }, [activePromptCommand, trimmedQuery]);

    const queryCandidates = useMemo(() => {
        if (!activePromptCommand?.queryTemplate) return [];

        const fullQuery = `${activePromptCommand.queryTemplate}${promptInputValue}`.trim();
        const resolution = buildQueryResolution(fullQuery);
        if (resolution.type !== "candidates") return [];
        return resolution.candidates;
    }, [activePromptCommand, promptInputValue]);
    const selectedPromptCandidate = useMemo<QueryActionCandidate | null>(() => {
        if (!selectedPromptCandidateId) return null;
        return queryCandidates.find(candidate => candidate.id === selectedPromptCandidateId) ?? null;
    }, [queryCandidates, selectedPromptCandidateId]);
    const activePromptIsSingleSelect = Boolean(activePromptCommand?.id && SINGLE_SELECT_PROMPT_COMMAND_IDS.has(activePromptCommand.id));

    const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : undefined;
    const selectedLabel = getSelectedLabel(selectedItem);

    const canDrillDown = isSelectable(selectedItem) && hasChildren(selectedItem.command, allCommands);
    const canGoBack = navigationLevel.type !== "root";
    const isScheduledCreatePage = navigationLevel.type === "category" && navigationLevel.categoryId === SCHEDULED_MESSAGES_CREATE_PAGE_CATEGORY_ID;
    const selectedCommand = isSelectable(selectedItem) ? selectedItem.command : null;
    const actionBarExtraHints = selectedCommand?.secondaryActions
        ? Object.values(selectedCommand.secondaryActions).map(action => ({
            key: action.hintKey,
            label: action.label
        }))
        : undefined;
    const calculatorActionHints = calculatorResult
        ? [
            { key: "↵", label: "Copy answer" },
            { key: "⌘↵", label: "Copy raw" },
            { key: "⌘⇧↵", label: "Copy Q+A" }
        ]
        : undefined;
    const actionBarHints = calculatorResult ? calculatorActionHints : undefined;
    const scheduledCreateHints = isScheduledCreatePage ? [
        { key: "⌘↵", label: "Create" },
        { key: "Esc", label: "Back" }
    ] : undefined;
    const defaultHints = canGoBack
        ? [
            { key: "←", label: "Back" },
            { key: "↑↓", label: "Navigate" },
            { key: "↵", label: "Execute" },
            { key: "Esc", label: "Close" },
            ...(canDrillDown ? [{ key: "→", label: "Open" }] : [])
        ]
        : [
            { key: "↑↓", label: "Navigate" },
            { key: "↵", label: "Execute" },
            { key: "Esc", label: "Close" },
            ...(canDrillDown ? [{ key: "→", label: "Open" }] : [])
        ];
    const actionHintsForBar = scheduledCreateHints ?? actionBarHints ?? actionBarExtraHints ?? defaultHints;

    const scheduledChannelSuggestions = useMemo(() => {
        if (!isScheduledCreatePage) return [];

        const toSuggestion = (entry: { id: string; display: string; iconUrl?: string; }) => {
            const channel = ChannelStore.getChannel(entry.id);
            const isDm = channel ? (typeof channel.isDM === "function" ? channel.isDM() : channel.type === 1) : false;
            const isGroupDm = channel ? (typeof channel.isGroupDM === "function" ? channel.isGroupDM() : channel.type === 3) : false;
            return {
                id: entry.id,
                display: entry.display,
                iconUrl: entry.iconUrl,
                kind: isDm ? "dm" as const : isGroupDm ? "group" as const : "guild" as const
            };
        };

        const target = createScheduledChannel.trim();
        return resolveAllChannels(target, {
            includeAllWhenEmpty: target.length === 0,
            limit: 24
        }).map(toSuggestion);
    }, [createScheduledChannel, isScheduledCreatePage]);

    const resolveCreateScheduledChannel = () => {
        if (createScheduledChannelId) {
            const selected = ChannelStore.getChannel(createScheduledChannelId);
            if (selected) {
                return {
                    id: createScheduledChannelId,
                    display: selected.name ? `#${selected.name}` : `Channel ${createScheduledChannelId}`
                };
            }
        }

        const typed = createScheduledChannel.trim();
        if (typed) {
            const match = resolveAllChannels(typed)[0];
            if (match) return { id: match.id, display: match.display };
            return null;
        }

        const currentChannelId = SelectedChannelStore.getChannelId();
        if (!currentChannelId) return null;
        const currentChannel = ChannelStore.getChannel(currentChannelId);
        if (!currentChannel) return null;
        return {
            id: currentChannelId,
            display: currentChannel.name ? `#${currentChannel.name}` : `Channel ${currentChannelId}`
        };
    };

    const promptOffsetChars = Math.min(42, Math.max(1, trimmedQuery.length));
    const showPromptCommandPreview = Boolean(promptCommand && trimmedQuery.length === 0);

    useEffect(() => {
        if (!selectedPromptCandidateId) return;
        if (queryCandidates.some(candidate => candidate.id === selectedPromptCandidateId)) return;
        setSelectedPromptCandidateId(null);
    }, [queryCandidates, selectedPromptCandidateId]);

    useEffect(() => {
        if (isScheduledCreatePage) return;
        setCreateScheduledError(null);
        setCreateScheduledChannelId(null);
    }, [isScheduledCreatePage]);

    useEffect(() => {
        if (!hasCommandItems) {
            setSelectedIndex(-1);
            setSelectedKey(null);
            return;
        }

        const firstSelectable = items.findIndex(item => isSelectable(item));
        if (firstSelectable < 0) {
            setSelectedIndex(-1);
            setSelectedKey(null);
            return;
        }

        if (selectedKey) {
            const found = items.findIndex(item => isSelectable(item) && item.id === selectedKey);
            if (found >= 0) {
                setSelectedIndex(found);
                return;
            }
        }

        setSelectedIndex(firstSelectable);
        setSelectedKey(items[firstSelectable].id);
    }, [hasCommandItems, items, selectedKey]);

    useEffect(() => {
        if (selectedIndex < 0) return;
        if (selectionSource !== "keyboard") return;
        const container = listRef.current;
        const node = itemRefs.current[selectedIndex];
        if (!container || !node) return;

        const containerRect = container.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();

        if (nodeRect.bottom > containerRect.bottom) {
            container.scrollTop += nodeRect.bottom - containerRect.bottom;
            return;
        }

        if (nodeRect.top < containerRect.top) {
            container.scrollTop -= containerRect.top - nodeRect.top;
        }
    }, [selectedIndex, selectionSource]);

    useEffect(() => {
        if (!focusPromptInput) return;

        requestAnimationFrame(() => {
            const node = document.querySelector<HTMLInputElement>("input.vc-command-palette-prompt-input, .vc-command-palette-prompt-input input");
            node?.focus();
        });
        setFocusPromptInput(false);
    }, [focusPromptInput]);

    const focusSearchInput = () => {
        const node = document.querySelector<HTMLInputElement>("input.vc-command-palette-main-search-input, .vc-command-palette-main-search-input input");
        node?.focus();
    };

    const clearPromptState = () => {
        setActivePromptCommand(null);
        setPromptInputValue("");
        setSelectedPromptCandidateId(null);
        setShowPromptDropdown(false);
        activePromptCommandIdRef.current = null;
    };

    const activatePromptCommand = (command: CommandEntry, shouldFocus: boolean) => {
        if (activePromptCommand?.id !== command.id) {
            setPromptInputValue("");
            setSelectedPromptCandidateId(null);
        }

        setActivePromptCommand(command);
        activePromptCommandIdRef.current = command.id;
        if (SINGLE_SELECT_PROMPT_COMMAND_IDS.has(command.id) && selectedPromptCandidateId) {
            setShowPromptDropdown(false);
        } else {
            setShowPromptDropdown(true);
        }
        if (shouldFocus) {
            setFocusPromptInput(true);
        }
    };

    const executePromptCandidate = async (run: () => Promise<boolean | void> | boolean | void, sourceCommandId?: string | null) => {
        const commandId = sourceCommandId ?? activePromptCommandIdRef.current ?? activePromptCommand?.id ?? null;
        let success = false;
        let shouldClose = true;

        try {
            const result = await run();
            if (result === false) {
                shouldClose = false;
                return;
            }
            success = true;
        } catch (error) {
            Toasts.show({
                message: "Unable to complete prompt action.",
                type: Toasts.Type.FAILURE,
                id: Toasts.genId(),
                options: { position: Toasts.Position.BOTTOM }
            });
            console.error("CommandPalette", "Prompt action failed", error);
        } finally {
            if (!success) return;
            if (commandId) {
                markCommandAsRecent(commandId);
            }
            if (!shouldClose) return;
            closePalette("programmatic");
        }
    };

    const copyCalculatorResult = async (mode: "formatted" | "raw" | "qa") => {
        if (!calculatorResult) return;

        const text = mode === "formatted"
            ? calculatorResult.displayAnswer
            : mode === "raw"
                ? calculatorResult.rawAnswer
                : `${calculatorResult.displayInput} = ${calculatorResult.displayAnswer}`;

        await copyWithToast(text, "Copied to clipboard.");
    };

    const submitCreateScheduledMessage = async () => {
        setCreateScheduledError(null);

        const content = createScheduledMessage.trim();
        if (!content) {
            setCreateScheduledError("Message content is required.");
            return;
        }

        const scheduledTime = parseScheduledTimeInput(createScheduledTime);
        if (!scheduledTime) {
            setCreateScheduledError("Enter a valid future time.");
            return;
        }

        const channel = resolveCreateScheduledChannel();
        if (!channel) {
            setCreateScheduledError("Select a valid channel.");
            return;
        }

        if (!await ensureScheduledMessagesPluginEnabled()) return;

        const result = await addScheduledMessage(channel.id, content, scheduledTime);
        if (!result.success) {
            setCreateScheduledError(result.error ?? "Failed to schedule message.");
            return;
        }

        Toasts.show({
            message: "Message scheduled.",
            type: Toasts.Type.SUCCESS,
            id: Toasts.genId(),
            options: { position: Toasts.Position.BOTTOM }
        });

        setCreateScheduledChannel("");
        setCreateScheduledChannelId(null);
        setCreateScheduledTime("");
        setCreateScheduledMessage("");
        setCreateScheduledError(null);
        closePalette("programmatic");
    };

    const openDrilldown = (command: CommandEntry): boolean => {
        if (command.drilldownCategoryId) {
            const { drilldownCategoryId } = command;
            refreshAllContextProviders();
            setNavigationLevel(current => pushNavigationLevel(current, drilldownCategoryId));
            clearPromptState();
            setSelectedKey(null);
            setKeyboardSelectedKey(null);
            setQuery("");
            setExpanded(false);
            return true;
        }

        const { categoryId } = command;
        if (!categoryId) return false;

        const childCategories = listChildCategories(categoryId);
        if (childCategories.length > 0) {
            setNavigationLevel(current => pushNavigationLevel(current, childCategories[0].id));
            clearPromptState();
            setSelectedKey(null);
            setKeyboardSelectedKey(null);
            setQuery("");
            setExpanded(false);
            return true;
        }

        return false;
    };

    const closePalette = (reason: "programmatic" | "explicit-root") => {
        closeReasonRef.current = reason;
        modalProps.onClose?.();
    };

    const executeItem = async (item: PaletteCandidate | undefined, actionKey: string = "primary") => {
        if (!isSelectable(item)) return;

        if (actionKey === "primary" && item.command.queryTemplate) {
            activatePromptCommand(item.command, true);
            return;
        }

        if (actionKey === "primary" && openDrilldown(item.command)) {
            return;
        }

        const executed = await executeCommandAction(item.command, actionKey);
        if (!executed) return;

        if (item.command.closeAfterExecute ?? closeAfterExecute) {
            closePalette("programmatic");
        }
    };

    const drillDown = () => {
        if (!isSelectable(selectedItem)) return;
        openDrilldown(selectedItem.command);
    };

    const goBack = () => {
        if (navigationLevel.type === "root") return;

        const { parentLevels } = navigationLevel;
        if (parentLevels.length === 0) {
            setNavigationLevel({ type: "root" });
        } else {
            setNavigationLevel(parentLevels[parentLevels.length - 1]);
        }

        clearPromptState();
        setSelectedKey(null);
        setKeyboardSelectedKey(null);
        setQuery("");
        setExpanded(false);
    };

    const updateSelection = (index: number, item: PaletteCandidate) => {
        if (!isSelectable(item)) return;

        keyboardNavigationAtRef.current = Date.now();
        setSelectionSource("keyboard");
        setSelectedIndex(index);
        setSelectedKey(item.id);
        setKeyboardSelectedKey(item.id);

        if (item.command.queryTemplate) {
            activatePromptCommand(item.command, false);
            return;
        }

        if (activePromptCommand) {
            clearPromptState();
        }
    };

    const updateSelectionFromPointer = (index: number, item: PaletteCandidate, force = false) => {
        if (!isSelectable(item)) return;
        if (!force && Date.now() - keyboardNavigationAtRef.current < 200) return;
        if (!force && activePromptCommand) return;
        if (!force && isSelectable(selectedItem) && selectedItem.command.queryTemplate) return;

        setSelectionSource("pointer");
        setSelectedIndex(index);
        setSelectedKey(item.id);
        setKeyboardSelectedKey(item.id);
    };

    const ensureSelectionForActions = () => {
        if (isSelectable(selectedItem)) return true;

        const firstSelectable = items.findIndex(item => isSelectable(item));
        if (firstSelectable < 0) return false;

        const firstItem = items[firstSelectable];
        if (!isSelectable(firstItem)) return false;

        setSelectionSource("keyboard");
        setSelectedIndex(firstSelectable);
        setSelectedKey(firstItem.id);
        setKeyboardSelectedKey(firstItem.id);
        return true;
    };

    const moveSelection = (direction: 1 | -1) => {
        if (!hasCommandItems) return;

        let start = selectedIndex;
        if (start < 0 || !isSelectable(items[start])) {
            start = items.findIndex(item => isSelectable(item));
        }
        if (start < 0) return;

        let index = start;
        for (; ;) {
            const next = index + direction;
            if (next < 0 || next >= items.length) break;

            index = next;
            const candidate = items[index];
            if (!isSelectable(candidate)) continue;

            updateSelection(index, candidate);
            return;
        }
    };

    const goRoot = () => {
        setNavigationLevel({ type: "root" });
        clearPromptState();
        setSelectedKey(null);
        setQuery("");
        setExpanded(false);
    };

    const onKeyDown = async (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement | null;
        const isPromptInputTarget = Boolean(target?.closest(".vc-command-palette-header-prompt-active"));
        const isMainInputTarget = Boolean(target?.closest(".vc-command-palette-main-input")) && !isPromptInputTarget;
        const isScheduledCreateTarget = Boolean(target?.closest(".vc-command-palette-scheduled-create-page"));
        const isScheduledCreateChannelTarget = Boolean(target?.closest(".vc-command-palette-scheduled-create-field"));

        if (event.key === "Escape" && event.metaKey) {
            event.preventDefault();
            event.stopPropagation();
            clearPersistedNavigation();
            goRoot();
            return;
        }

        if (event.key === "l" && event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            setIsActionsMenuOpen(prev => {
                if (prev) return false;
                if (!ensureSelectionForActions()) return false;
                return true;
            });
            return;
        }

        if (isActionsMenuOpen) {
            return;
        }

        if (isScheduledCreatePage && isScheduledCreateTarget) {
            if (event.key === "Enter" && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey) {
                if (isScheduledCreateChannelTarget && scheduledChannelSuggestions.length > 0) {
                    event.preventDefault();
                    const first = scheduledChannelSuggestions[0];
                    setCreateScheduledChannel(first.display);
                    setCreateScheduledChannelId(first.id);
                    setCreateScheduledError(null);
                    return;
                }
            }

            if (event.key === "Enter" && event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey) {
                event.preventDefault();
                await submitCreateScheduledMessage();
                return;
            }

            if (event.key === "Enter") {
                event.preventDefault();
                return;
            }

            if (event.key !== "Escape") {
                return;
            }
        }

        if (!isPromptInputTarget && event.key === "Enter" && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey && activePromptCommand && selectedPromptCandidate) {
            event.preventDefault();
            await executePromptCandidate(selectedPromptCandidate.run, activePromptCommand.id ?? activePromptCommandIdRef.current);
            return;
        }

        if (!isPromptInputTarget && calculatorResult && event.key === "Enter") {
            event.preventDefault();
            if (event.metaKey && event.shiftKey) {
                await copyCalculatorResult("qa");
                return;
            }

            if (event.metaKey) {
                await copyCalculatorResult("raw");
                return;
            }

            if (!event.altKey && !event.ctrlKey) {
                await copyCalculatorResult("formatted");
                return;
            }
        }

        if (isPromptInputTarget) {
            if (!activePromptIsSingleSelect && selectedPromptCandidate && event.key === "Backspace" && promptInputValue.length === 0) {
                event.preventDefault();
                setSelectedPromptCandidateId(null);
                return;
            }

            if (event.key === "Tab" || event.key === "ArrowLeft") {
                event.preventDefault();
                focusSearchInput();
                return;
            }

            if (event.key === "ArrowDown") {
                event.preventDefault();
                if (compact) {
                    setExpanded(true);
                    return;
                }
                moveSelection(1);
                return;
            }

            if (event.key === "ArrowUp") {
                event.preventDefault();
                if (compact) return;
                if (selectedIndex <= 0) {
                    focusSearchInput();
                    return;
                }
                moveSelection(-1);
                return;
            }

            if (event.key === "Enter") {
                event.preventDefault();
                const candidate = selectedPromptCandidate ?? queryCandidates[0];
                if (!candidate) return;

                await executePromptCandidate(candidate.run, activePromptCommand?.id ?? activePromptCommandIdRef.current);
                return;
            }

            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                clearPromptState();
                return;
            }

            return;
        }

        if (isMainInputTarget && promptCommand && (event.key === "Tab" || event.key === "ArrowRight")) {
            event.preventDefault();
            activatePromptCommand(promptCommand, true);
            return;
        }

        if (isMainInputTarget && event.key === "ArrowDown") {
            event.preventDefault();
            if (compact) {
                setExpanded(true);
                return;
            }
            moveSelection(1);
            return;
        }

        if (isMainInputTarget && event.key === "ArrowUp") {
            event.preventDefault();
            if (compact) return;
            if (selectedIndex <= 0) {
                focusSearchInput();
                return;
            }
            moveSelection(-1);
            return;
        }

        if (event.key === "ArrowRight") {
            event.preventDefault();
            if (canDrillDown) drillDown();
            return;
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            if (canGoBack) goBack();
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            if (compact) {
                setExpanded(true);
                return;
            }

            moveSelection(1);
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            if (compact) return;

            if (selectedIndex <= 0 && trimmedQuery.length === 0 && navigationLevel.type === "root") {
                setExpanded(false);
                return;
            }

            moveSelection(-1);
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            const actionKey = event.metaKey || event.altKey || event.ctrlKey || event.shiftKey
                ? getEnterActionKey(event)
                : "primary";
            await executeItem(selectedItem, actionKey);
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();

            if (activePromptCommand) {
                clearPromptState();
                return;
            }

            if (canGoBack) {
                goBack();
                return;
            }

            if (!compact && trimmedQuery.length > 0) {
                setQuery("");
                setExpanded(false);
                return;
            }

            if (!compact) {
                setExpanded(false);
                return;
            }

            closePalette("explicit-root");
        }
    };

    const paletteActions: PaletteAction[] = useMemo(() => {
        const actions: PaletteAction[] = [];

        if (isScheduledCreatePage) {
            actions.push({ id: "create", label: "Create Scheduled Message", shortcut: "⌘↵", handler: submitCreateScheduledMessage });
            actions.push({ id: "back", label: "Go Back", shortcut: "Esc", handler: goBack });
            return actions;
        }

        if (calculatorResult) {
            actions.push({ id: "copy-answer", label: "Copy Answer", shortcut: "↵", handler: () => copyCalculatorResult("formatted") });
            actions.push({ id: "copy-raw", label: "Copy Raw", shortcut: "⌘↵", handler: () => copyCalculatorResult("raw") });
            actions.push({ id: "copy-qa", label: "Copy Q+A", shortcut: "⌘⇧↵", handler: () => copyCalculatorResult("qa") });
        } else if (selectedCommand) {
            actions.push({ id: "execute", label: "Execute", shortcut: "↵", handler: () => executeItem(selectedItem, "primary") });

            if (selectedCommand.secondaryActions) {
                Object.entries(selectedCommand.secondaryActions).forEach(([key, action]) => {
                    actions.push({ id: `secondary-${key}`, label: action.label, shortcut: action.hintKey, handler: action.handler });
                });
            }

            if (canDrillDown) {
                actions.push({ id: "open", label: "Open", shortcut: "→", handler: drillDown });
            }
        }

        if (canGoBack) {
            actions.push({ id: "back", label: "Go Back", shortcut: "←", handler: goBack });
        }

        return actions;
    }, [isScheduledCreatePage, calculatorResult, selectedCommand, selectedItem, canDrillDown, canGoBack, submitCreateScheduledMessage, goBack, executeItem, drillDown, copyCalculatorResult]);

    return (
        <ModalRoot
            {...modalProps}
            className={compact ? "vc-command-palette vc-command-palette-compact" : "vc-command-palette"}
            size={ModalSize.LARGE}
        >
            <div className="vc-command-palette-shell" onKeyDown={onKeyDown}>
                <CommandPaletteInput
                    value={query}
                    onChange={value => {
                        const next = value.trim();
                        setQuery(value);

                        if (next.length > 0) {
                            setExpanded(true);
                        } else if (!activePromptCommand) {
                            if (navigationLevel.type !== "root") {
                                goBack();
                                return;
                            }
                            setExpanded(false);
                        }
                    }}
                    placeholder={undefined}
                    hideMainInput={showPromptCommandPreview}
                    compact={compact}
                >
                    {promptCommand && (
                        <div
                            ref={promptContainerRef}
                            className={showPromptCommandPreview ? "vc-command-palette-header-prompt vc-command-palette-header-prompt-with-command-preview" : "vc-command-palette-header-prompt"}
                            style={{ "--vc-prompt-offset-ch": String(promptOffsetChars) } as CSSProperties}
                        >
                            {showPromptCommandPreview && (
                                <span className="vc-command-palette-header-prompt-command-preview">
                                    {promptCommand.label}
                                </span>
                            )}
                            {activePromptCommand ? (
                                <div className={selectedPromptCandidate ? "vc-command-palette-header-prompt-active vc-command-palette-header-prompt-active-with-selection" : "vc-command-palette-header-prompt-active"}>
                                    {selectedPromptCandidate && (
                                        <span className="vc-command-palette-header-prompt-selection">
                                            <span className="vc-command-palette-header-prompt-selection-label">{selectedPromptCandidate.label}</span>
                                        </span>
                                    )}
                                    {!(activePromptIsSingleSelect && selectedPromptCandidate) && (
                                        <TextInput
                                            className={selectedPromptCandidate ? "vc-command-palette-prompt-input vc-command-palette-prompt-input-with-selection" : "vc-command-palette-prompt-input"}
                                            value={promptInputValue}
                                            onChange={value => {
                                                setPromptInputValue(value);
                                                if (selectedPromptCandidateId) {
                                                    setSelectedPromptCandidateId(null);
                                                }
                                            }}
                                            placeholder={selectedPromptCandidate ? "" : (promptCommand.queryPlaceholder ?? "Prompt")}
                                            onFocus={() => setShowPromptDropdown(true)}
                                            onBlur={() => {
                                                window.setTimeout(() => {
                                                    const active = document.activeElement;
                                                    if (promptContainerRef.current?.contains(active)) return;
                                                    setShowPromptDropdown(false);
                                                    if (selectedPromptCandidateId || promptInputValue.trim().length > 0) return;
                                                    clearPromptState();
                                                }, 0);
                                            }}
                                        />
                                    )}
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="vc-command-palette-header-prompt-trigger"
                                    onClick={() => activatePromptCommand(promptCommand, true)}
                                >
                                    <span className="vc-command-palette-header-prompt-placeholder">
                                        {promptCommand.queryPlaceholder ?? "Prompt"}
                                    </span>
                                </button>
                            )}
                            {activePromptCommand && showPromptDropdown && queryCandidates.length > 0 && (
                                <div className="vc-command-palette-header-prompt-dropdown">
                                    {queryCandidates.map(candidate => {
                                        const Icon = candidate.icon;
                                        return (
                                            <button
                                                key={candidate.id}
                                                type="button"
                                                className="vc-command-palette-header-prompt-option"
                                                onClick={async () => {
                                                    setSelectedPromptCandidateId(candidate.id);
                                                    setPromptInputValue("");
                                                    if (activePromptIsSingleSelect) {
                                                        setShowPromptDropdown(false);
                                                        focusSearchInput();
                                                    } else {
                                                        setFocusPromptInput(true);
                                                    }
                                                }}
                                            >
                                                {Icon && (
                                                    <span className="vc-command-palette-header-prompt-option-icon">
                                                        <Icon />
                                                    </span>
                                                )}
                                                <span className="vc-command-palette-header-prompt-option-label">{candidate.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </CommandPaletteInput>

                {!compact && !isScheduledCreatePage && calculatorResult && (
                    <CommandPaletteCalculatorCards result={calculatorResult} />
                )}

                {!compact && !isScheduledCreatePage && (
                    <div ref={listRef} className="vc-command-palette-list">
                        {!hasCommandItems && <div className="vc-command-palette-empty">{emptyStateText}</div>}
                        {items.map((item, index) => {
                            if (item.type === "section") {
                                itemRefs.current[index] = null;
                                return <CommandPaletteRow key={item.id} item={item} selected={false} onClick={() => undefined} onHover={() => undefined} />;
                            }

                            if (item.type !== "command") {
                                itemRefs.current[index] = null;
                                return null;
                            }

                            return (
                                <div key={item.id} ref={el => {
                                    itemRefs.current[index] = el?.querySelector("button") ?? null;
                                }}>
                                    <CommandPaletteRow
                                        item={item}
                                        selected={index === selectedIndex}
                                        onClick={() => {
                                            if (activePromptCommand && activePromptCommand.id !== item.command.id) {
                                                clearPromptState();
                                            }
                                            updateSelectionFromPointer(index, item, true);
                                        }}
                                        onDoubleClick={() => {
                                            void executeItem(item, "primary");
                                        }}
                                        onHover={() => {
                                            if (item.command.queryTemplate) return;
                                            updateSelectionFromPointer(index, item);
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}

                {!compact && isScheduledCreatePage && (
                    <CommandPaletteScheduledCreatePage
                        channelValue={createScheduledChannel}
                        hasSelectedChannel={createScheduledChannelId != null}
                        timeValue={createScheduledTime}
                        messageValue={createScheduledMessage}
                        channelSuggestions={scheduledChannelSuggestions}
                        error={createScheduledError}
                        onChannelChange={value => {
                            setCreateScheduledChannel(value);
                            setCreateScheduledChannelId(null);
                            setCreateScheduledError(null);
                        }}
                        onTimeChange={value => {
                            setCreateScheduledTime(value);
                            setCreateScheduledError(null);
                        }}
                        onMessageChange={value => {
                            setCreateScheduledMessage(value);
                            setCreateScheduledError(null);
                        }}
                        onPickSuggestion={suggestion => {
                            setCreateScheduledChannel(suggestion.display);
                            setCreateScheduledChannelId(suggestion.id);
                            setCreateScheduledError(null);
                        }}
                    />
                )}

                {!compact && isActionsMenuOpen && (
                    <CommandPaletteActionsMenu
                        actions={paletteActions}
                        title={selectedLabel || "Actions"}
                        onClose={() => setIsActionsMenuOpen(false)}
                    />
                )}

                {!compact && (
                    <CommandPaletteActionBar
                        selectedLabel={isScheduledCreatePage
                            ? "Create Scheduled Message"
                            : (calculatorResult ? calculatorResult.displayAnswer : selectedLabel)}
                        onOpenActions={() => {
                            if (!ensureSelectionForActions()) return;
                            setIsActionsMenuOpen(true);
                        }}
                    />
                )}
            </div>
        </ModalRoot>
    );
}
