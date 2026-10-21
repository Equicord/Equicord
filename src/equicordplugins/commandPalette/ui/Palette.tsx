/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IS_MAC } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { copyWithToast } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { useEffect, useRef, useState } from "@webpack/common";

import { getVisibleCommands, subscribePalette } from "../api/registry";
import type { PageEntry, PaletteAction, PaletteCommand, PaletteContext, PaletteListItem } from "../api/types";
import { evaluateExpression } from "../commands/calculator/evaluator";
import { fuzzyScore, rankCommands } from "../search/ranker";
import { settings } from "../settings";
import { getAlias, setAlias } from "../state/aliases";
import { recordUse, topFrecent } from "../state/frecency";
import { getHotkey, setHotkey } from "../state/hotkeys";
import { getPins, isPinned, togglePin } from "../state/pins";
import { ActionBar, Shortcut } from "./ActionBar";
import { ActionsPanel } from "./ActionsPanel";
import { CalculatorIcon, ChevronLeftIcon, CopyIcon, KeyboardIcon, PencilIcon, PinIcon, SearchIcon } from "./icons";
import { comboFromEvent, isEditableTarget, setPaletteKeyHandler } from "./keyboard";
import { DetailPage } from "./pages/DetailPage";
import { type FormHandle, FormPage } from "./pages/FormPage";
import { PaletteIcon } from "./PaletteIcon";
import { flattenSections, type ResultSection, ResultsList, type RowItem } from "./ResultsList";

const cl = classNameFactory("vc-cmdpal-");
const logger = new Logger("CommandPalette");

const SUGGESTION_LIMIT = 6;

function commandToRow(command: PaletteCommand): RowItem | null {
    const ownActions = command.actions ?? [];
    const { page } = command;
    const actions: PaletteAction[] = page
        ? [
            {
                id: `${command.id}.open`,
                label: "Open Command",
                icon: command.icon,
                keepOpen: true,
                run: context => context.push(page())
            },
            ...ownActions
        ]
        : ownActions;

    if (actions.length === 0) return null;

    const hotkey = getHotkey(command.id);
    const alias = getAlias(command.id);

    return {
        id: command.id,
        commandId: command.id,
        label: command.title,
        sublabel: command.subtitle,
        icon: command.icon,
        actions,
        accessory: (
            <>
                {alias && <span className={cl("alias-chip")}>{alias}</span>}
                {hotkey ? <Shortcut combo={hotkey} /> : <span className={cl("row-kind")}>Command</span>}
            </>
        )
    };
}

function listItemToRow(item: PaletteListItem): RowItem {
    return {
        id: item.id,
        label: item.label,
        sublabel: item.sublabel,
        icon: item.icon,
        actions: item.actions
    };
}

function calculatorRow(query: string): RowItem | null {
    const result = evaluateExpression(query);
    if (!result) return null;

    const expression = query.trim();
    const copyAction: PaletteAction = {
        id: "calculator.copy",
        label: "Copy Answer",
        icon: CopyIcon,
        run: () => copyWithToast(result.plain, "Answer copied to clipboard.")
    };

    return {
        id: "calculator.inline",
        label: result.formatted,
        sublabel: `${expression} =`,
        icon: CalculatorIcon,
        accessory: <span className={cl("row-kind")}>Calculator</span>,
        actions: [
            copyAction,
            {
                id: "calculator.details",
                label: "Open Details",
                icon: CalculatorIcon,
                keepOpen: true,
                run: context => context.push({
                    title: "Calculator",
                    icon: CalculatorIcon,
                    spec: {
                        type: "detail",
                        heading: result.formatted,
                        rows: [
                            { label: "Expression", value: expression },
                            { label: "Result", value: result.plain }
                        ],
                        actions: [copyAction, {
                            id: "calculator.copyExpression",
                            label: "Copy Expression",
                            icon: CopyIcon,
                            run: () => copyWithToast(`${expression} = ${result.plain}`, "Calculation copied to clipboard.")
                        }]
                    }
                })
            }
        ]
    };
}

function groupRanked(rows: { row: RowItem; section: string; }[]): ResultSection[] {
    const sections: ResultSection[] = [];
    const byLabel = new Map<string, ResultSection>();

    for (const { row, section } of rows) {
        let target = byLabel.get(section);
        if (!target) {
            target = { label: section, items: [] };
            byLabel.set(section, target);
            sections.push(target);
        }
        target.items.push(row);
    }

    return sections;
}

interface PaletteProps {
    onClose(): void;
    initialPage?: PageEntry;
}

export function Palette({ onClose, initialPage }: PaletteProps) {
    const [pages, setPages] = useState<PageEntry[]>(initialPage ? [initialPage] : []);
    const [query, setQuery] = useState("");
    const [forceExpanded, setForceExpanded] = useState(initialPage != null);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [actionsIndex, setActionsIndex] = useState(0);
    const [recordingFor, setRecordingFor] = useState<string | null>(null);
    const [listItems, setListItems] = useState<PaletteListItem[]>([]);
    const [, setVersion] = useState(0);

    const inputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<FormHandle | null>(null);

    useEffect(() => {
        return subscribePalette(() => setVersion(v => v + 1));
    }, []);

    const currentPage = pages.length > 0 ? pages[pages.length - 1] : null;
    const pageType = currentPage?.spec.type ?? "root";

    const ctx: PaletteContext = {
        close: onClose,
        pop() {
            setPages(prev => prev.slice(0, -1));
            setQuery("");
            setSelectedIndex(0);
            setActionsOpen(false);
        },
        push(entry: PageEntry) {
            setPages(prev => [...prev, entry]);
            setQuery("");
            setSelectedIndex(0);
            setActionsOpen(false);
        },
        setQuery(next: string) {
            setQuery(next);
            setSelectedIndex(0);
        }
    };

    useEffect(() => {
        if (currentPage?.spec.type !== "list") {
            setListItems([]);
            return;
        }

        let cancelled = false;
        Promise.resolve(currentPage.spec.items(query)).then(items => {
            if (!cancelled) setListItems(items);
        }).catch(e => logger.error("List page items failed", e));

        return () => { cancelled = true; };
    }, [currentPage, query]);

    const expanded = currentPage != null || query.trim() !== "" || forceExpanded;

    let sections: ResultSection[] = [];

    if (pageType === "root") {
        const commands = getVisibleCommands();
        const trimmed = query.trim();

        if (trimmed) {
            const calc = calculatorRow(query);
            if (calc) sections.push({ label: "Calculator", items: [calc] });

            const ranked = rankCommands(trimmed, commands)
                .map(entry => ({ row: commandToRow(entry.command), section: entry.command.section }))
                .filter((entry): entry is { row: RowItem; section: string; } => entry.row !== null);
            sections.push(...groupRanked(ranked));
        } else if (expanded) {
            const byId = new Map(commands.map(c => [c.id, c]));
            const shown = new Set<string>();

            const pinnedRows = getPins()
                .map(id => byId.get(id))
                .filter((c): c is PaletteCommand => c != null)
                .map(c => { shown.add(c.id); return commandToRow(c); })
                .filter((row): row is RowItem => row !== null);
            if (pinnedRows.length) sections.push({ label: "Pinned", items: pinnedRows });

            const suggestionRows = topFrecent(SUGGESTION_LIMIT + shown.size)
                .map(id => byId.get(id))
                .filter((c): c is PaletteCommand => c != null && !shown.has(c.id))
                .slice(0, SUGGESTION_LIMIT)
                .map(c => { shown.add(c.id); return commandToRow(c); })
                .filter((row): row is RowItem => row !== null);
            if (suggestionRows.length) sections.push({ label: "Suggestions", items: suggestionRows });

            const rest = commands
                .filter(c => !shown.has(c.id))
                .map(c => ({ row: commandToRow(c), section: c.section }))
                .filter((entry): entry is { row: RowItem; section: string; } => entry.row !== null);
            sections.push(...groupRanked(rest));
        }
    } else if (pageType === "list") {
        const trimmed = query.trim();
        const filtered = trimmed
            ? listItems
                .map(item => ({
                    item,
                    score: Math.max(
                        fuzzyScore(trimmed, item.label),
                        ...(item.keywords ?? []).map(k => fuzzyScore(trimmed, k) * 0.7),
                        item.sublabel ? fuzzyScore(trimmed, item.sublabel) * 0.5 : 0
                    )
                }))
                .filter(entry => entry.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(entry => entry.item)
            : listItems;

        if (filtered.length > 0) sections = [{ label: null, items: filtered.map(listItemToRow) }];
    }

    const flatRows = flattenSections(sections);
    const selectedRow = flatRows[Math.min(selectedIndex, flatRows.length - 1)] ?? null;

    useEffect(() => {
        if (selectedIndex > 0 && selectedIndex >= flatRows.length) {
            setSelectedIndex(Math.max(0, flatRows.length - 1));
        }
    }, [flatRows.length, selectedIndex]);

    async function runAction(action: PaletteAction, commandId?: string) {
        if (commandId) recordUse(commandId);
        setActionsOpen(false);

        try {
            await action.run(ctx);
        } catch (e) {
            logger.error(`Action ${action.id} failed`, e);
        }

        if (!action.keepOpen && settings.store.closeAfterExecute) onClose();
    }

    function panelActions(): PaletteAction[] {
        const detailActions = currentPage?.spec.type === "detail" ? currentPage.spec.actions ?? [] : [];
        const rowActions = selectedRow?.actions ?? [];
        const base = pageType === "detail" ? detailActions : rowActions;

        const commandId = selectedRow?.commandId;
        if (!commandId || pageType !== "root") return base;

        return [
            ...base,
            {
                id: "builtin.pin",
                label: isPinned(commandId) ? "Unpin Command" : "Pin Command",
                icon: PinIcon,
                keepOpen: true,
                run: () => togglePin(commandId)
            },
            {
                id: "builtin.alias",
                label: "Set Alias",
                icon: PencilIcon,
                keepOpen: true,
                run: context => context.push({
                    title: "Set Alias",
                    icon: PencilIcon,
                    spec: {
                        type: "form",
                        submitLabel: "Save Alias",
                        fields: [{
                            key: "alias",
                            label: `Alias for ${selectedRow.label}`,
                            type: "text",
                            placeholder: "Leave empty to remove",
                            initial: getAlias(commandId) ?? ""
                        }],
                        submit(values, context) {
                            setAlias(commandId, values.alias);
                            context.pop();
                        }
                    }
                })
            },
            {
                id: "builtin.hotkey",
                label: getHotkey(commandId) ? "Change Hotkey" : "Record Hotkey",
                icon: KeyboardIcon,
                keepOpen: true,
                run: () => setRecordingFor(commandId)
            }
        ];
    }

    const availablePanelActions = panelActions();

    function handleKey(e: KeyboardEvent): boolean {
        const mod = IS_MAC ? e.metaKey : e.ctrlKey;
        const key = e.key.toLowerCase();

        if (recordingFor) {
            if (key === "escape") {
                setRecordingFor(null);
                return true;
            }
            if (key === "backspace") {
                setHotkey(recordingFor, null);
                setRecordingFor(null);
                return true;
            }
            const combo = comboFromEvent(e);
            if (combo && combo.length >= 2) {
                setHotkey(recordingFor, combo);
                setRecordingFor(null);
            }
            return true;
        }

        const editing = isEditableTarget(document.activeElement);
        if (editing && (pageType === "form" || pageType === "detail")) {
            if (key === "escape") {
                if (actionsOpen) setActionsOpen(false);
                else if (currentPage) ctx.pop();
                else onClose();
                return true;
            }
            if (mod && key === "k") {
                if (availablePanelActions.length > 0) {
                    setActionsOpen(open => !open);
                    setActionsIndex(0);
                }
                return true;
            }
            return false;
        }

        if (key === "escape") {
            if (actionsOpen) setActionsOpen(false);
            else if (query) {
                setQuery("");
                setSelectedIndex(0);
                setForceExpanded(false);
            }
            else if (currentPage) ctx.pop();
            else onClose();
            return true;
        }

        if (mod && key === "k") {
            if (availablePanelActions.length > 0) {
                setActionsOpen(open => !open);
                setActionsIndex(0);
            }
            return true;
        }

        if (actionsOpen) {
            if (key === "arrowdown") {
                setActionsIndex(i => Math.min(i + 1, availablePanelActions.length - 1));
                return true;
            }
            if (key === "arrowup") {
                setActionsIndex(i => Math.max(i - 1, 0));
                return true;
            }
            if (key === "enter") {
                const action = availablePanelActions[Math.min(actionsIndex, availablePanelActions.length - 1)];
                if (action) void runAction(action, selectedRow?.commandId);
                return true;
            }
            return true;
        }

        if (pageType === "form") {
            if (key === "enter" && !e.shiftKey && !mod && !e.altKey) {
                if (editing) return false;
                formRef.current?.submit();
                return true;
            }
            return false;
        }

        if (key === "arrowdown") {
            if (!expanded) setForceExpanded(true);
            else setSelectedIndex(i => Math.min(i + 1, Math.max(0, flatRows.length - 1)));
            return true;
        }

        if (key === "arrowup") {
            setSelectedIndex(i => Math.max(i - 1, 0));
            return true;
        }

        if (key === "enter") {
            if (pageType === "detail") {
                const detailActions = currentPage?.spec.type === "detail" ? currentPage.spec.actions ?? [] : [];
                if (detailActions[0]) void runAction(detailActions[0]);
                return true;
            }
            if (selectedRow) {
                const action = mod ? selectedRow.actions[1] ?? selectedRow.actions[0] : selectedRow.actions[0];
                void runAction(action, selectedRow.commandId);
            }
            return true;
        }

        if (key === "backspace" && query === "" && currentPage) {
            ctx.pop();
            return true;
        }

        return false;
    }

    useEffect(() => {
        setPaletteKeyHandler(handleKey);
    });

    useEffect(() => () => setPaletteKeyHandler(null), []);

    useEffect(() => {
        if (pageType === "root" || pageType === "list") inputRef.current?.focus();
    }, [pageType]);

    const showSearch = pageType === "root" || pageType === "list";

    const primaryLabel = recordingFor
        ? null
        : pageType === "form"
            ? (currentPage?.spec.type === "form" ? currentPage.spec.submitLabel ?? "Submit" : null)
            : pageType === "detail"
                ? (currentPage?.spec.type === "detail" ? currentPage.spec.actions?.[0]?.label ?? null : null)
                : selectedRow?.actions[0]?.label ?? null;

    const footerHint = recordingFor
        ? "Press a key combo, Backspace to clear, Esc to cancel"
        : currentPage?.title ?? "Equicord";

    return (
        <div
            className={cl("shell")}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
        >
            <div
                className={cl("backdrop")}
                onMouseDown={e => {
                    e.stopPropagation();
                    onClose();
                }}
            />
            <div
                className={cl("root", {
                    "root-compact": !expanded,
                    "root-form": pageType === "form"
                })}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
            >
            <div className={cl("header")}>
                {currentPage
                    ? (
                        <button type="button" className={cl("back")} onClick={() => ctx.pop()}>
                            <ChevronLeftIcon className={cl("back-icon")} />
                        </button>
                    )
                    : <SearchIcon className={cl("search-icon")} />}
                {showSearch
                    ? (
                        <input
                            ref={inputRef}
                            className={cl("input")}
                            value={query}
                            placeholder={currentPage?.spec.type === "list"
                                ? currentPage.spec.placeholder ?? `Search ${currentPage.title.toLowerCase()}...`
                                : "Search for commands..."}
                            onChange={e => ctx.setQuery(e.target.value)}
                            onMouseDown={e => e.stopPropagation()}
                            onBlur={() => {
                                if (actionsOpen || isEditableTarget(document.activeElement)) return;
                                inputRef.current?.focus();
                            }}
                        />
                    )
                    : (
                        <div className={cl("breadcrumb")}>
                            <div className={cl("chip-wrap", "chip-wrap-sm")}>
                                <PaletteIcon icon={currentPage?.icon} className={cl("breadcrumb-icon")} />
                            </div>
                            <span>{currentPage?.title}</span>
                        </div>
                    )}
            </div>
            {expanded && (
                <>
                    <div className={cl("body")}>
                        {(pageType === "root" || pageType === "list") && (
                            <ResultsList
                                sections={sections}
                                selectedIndex={Math.min(selectedIndex, Math.max(0, flatRows.length - 1))}
                                onSelect={setSelectedIndex}
                                onRun={row => void runAction(row.actions[0], row.commandId)}
                            />
                        )}
                        {currentPage?.spec.type === "form" && (
                            <FormPage spec={currentPage.spec} ctx={ctx} formRef={formRef} />
                        )}
                        {currentPage?.spec.type === "detail" && (
                            <DetailPage spec={currentPage.spec} />
                        )}
                        {actionsOpen && (
                            <ActionsPanel
                                actions={availablePanelActions}
                                selectedIndex={actionsIndex}
                                onSelect={setActionsIndex}
                                onRun={action => void runAction(action, selectedRow?.commandId)}
                            />
                        )}
                    </div>
                    <ActionBar
                        hint={footerHint}
                        primaryLabel={primaryLabel}
                        showActionsHint={!recordingFor && availablePanelActions.length > 0}
                    />
                </>
            )}
            </div>
        </div>
    );
}
