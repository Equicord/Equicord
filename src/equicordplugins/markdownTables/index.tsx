/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { CodeBlock } from "@components/CodeBlock";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { waitFor } from "@webpack";
import { Parser, useLayoutEffect, useRef, useState } from "@webpack/common";
import type { ReactNode } from "react";

import { type MarkdownTableMatch, parseMarkdownTableMatch, type TableAlignment } from "./parser";
import managedStyle from "./styles.css?managed";

const TABLE_RULE = "markdownTable";
const cl = classNameFactory("vc-markdownTables-");

const settings = definePluginSettings({
    hideToggle: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Hide the Table/Raw toggle and always show rendered tables.",
    },
});

const TABLE_BLOCK_SETTING_KEYS: Array<"hideToggle"> = ["hideToggle"];

type ScrollDirection = "left" | "right" | null;
type ParsedCell = unknown[];
type ParserState = Record<string, unknown> & { inline?: boolean; messageId?: string; };
type ParserParse = (source: string, state: ParserState) => ParsedCell;
type ParserOutput = (node: unknown, state: ParserState) => ReactNode;
type MarkdownTableCapture = RegExpExecArray & { markdownTable: MarkdownTableMatch; };

interface MarkdownTableNode {
    before: unknown[];
    raw: string;
    header: ParsedCell[];
    alignments: TableAlignment[];
    rows: ParsedCell[][];
}

interface MarkdownRule {
    order: number;
    match(source: string, state: ParserState): MarkdownTableCapture | null;
    parse(capture: MarkdownTableCapture, parse: ParserParse, state: ParserState): MarkdownTableNode;
    react(node: MarkdownTableNode, output: ParserOutput, state: ParserState): ReactNode;
}

interface ScrollMaskState {
    left: boolean;
    right: boolean;
    direction: ScrollDirection;
}

interface TableViewProps {
    output: ParserOutput;
    outputState: ParserState;
    table: MarkdownTableNode;
}

interface MarkdownTableRendererProps {
    node: MarkdownTableNode;
    output: ParserOutput;
    state: ParserState;
}

let shouldInstallTableRule = false;
let installedRules: MarkdownRules | null = null;

type MarkdownRules = Record<string, Partial<MarkdownRule> | undefined>;

function alignmentClass(alignment: TableAlignment) {
    if (alignment === "left") return cl("align-left");
    if (alignment === "center") return cl("align-center");
    if (alignment === "right") return cl("align-right");
    return undefined;
}

function createTableCapture(markdownTable: MarkdownTableMatch, input: string): MarkdownTableCapture {
    return Object.assign([markdownTable.raw] as RegExpExecArray, {
        index: 0,
        input,
        groups: undefined,
        markdownTable,
    });
}

function renderParsedNodes(nodes: ParsedCell, output: ParserOutput, state: ParserState) {
    return nodes.map(node => output(node, state));
}

function TableBlock({
    output,
    outputState,
    table,
}: TableViewProps) {
    const { hideToggle } = settings.use(TABLE_BLOCK_SETTING_KEYS);

    return (
        <div className={cl("root")}>
            {hideToggle
                ? <TableScrollFrame output={output} outputState={outputState} table={table} />
                : <ToggleableTableBlock output={output} outputState={outputState} table={table} />}
        </div>
    );
}

function ToggleableTableBlock({
    output,
    outputState,
    table,
}: TableViewProps) {
    const [showRaw, setShowRaw] = useState(false);

    return (
        <>
            <div className={cl("toolbar")} role="group" aria-label="Markdown table view">
                <button
                    aria-pressed={!showRaw}
                    className={cl("toggle", { "toggle-active": !showRaw })}
                    onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        setShowRaw(false);
                    }}
                    type="button"
                >
                    Table
                </button>
                <button
                    aria-pressed={showRaw}
                    className={cl("toggle", { "toggle-active": showRaw })}
                    onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        setShowRaw(true);
                    }}
                    type="button"
                >
                    Raw
                </button>
            </div>
            {showRaw
                ? (
                    <div className={cl("rawBlock")}>
                        <CodeBlock content={table.raw} lang="markdown" />
                    </div>
                )
                : <TableScrollFrame output={output} outputState={outputState} table={table} />}
        </>
    );
}

function TableScrollFrame({
    output,
    outputState,
    table,
}: TableViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastScrollLeftRef = useRef(0);
    const frameRef = useRef(0);
    const directionResetRef = useRef(0);
    const [maskState, setMaskState] = useState<ScrollMaskState>({
        left: false,
        right: false,
        direction: null,
    });

    useLayoutEffect(() => {
        const scrollElement = scrollRef.current;
        if (!scrollElement) return;
        const observedElement: HTMLDivElement = scrollElement;

        function updateMask(element: HTMLDivElement, trackDirection = false) {
            const maxScrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
            const scrollLeft = Math.min(Math.max(element.scrollLeft, 0), maxScrollLeft);
            let nextDirection: ScrollDirection = null;

            if (trackDirection && scrollLeft > lastScrollLeftRef.current) {
                nextDirection = "right";
            } else if (trackDirection && scrollLeft < lastScrollLeftRef.current) {
                nextDirection = "left";
            }

            lastScrollLeftRef.current = scrollLeft;

            setMaskState(previousState => {
                const nextState: ScrollMaskState = {
                    left: scrollLeft > 1,
                    right: maxScrollLeft - scrollLeft > 1,
                    direction: nextDirection ?? previousState.direction,
                };

                if (!nextState.left && !nextState.right) {
                    nextState.direction = null;
                }

                return previousState.left === nextState.left
                    && previousState.right === nextState.right
                    && previousState.direction === nextState.direction
                    ? previousState
                    : nextState;
            });

            if (nextDirection) {
                window.clearTimeout(directionResetRef.current);
                directionResetRef.current = window.setTimeout(() => {
                    setMaskState(previousState => {
                        if (!previousState.direction) return previousState;

                        return { ...previousState, direction: null };
                    });
                }, 450);
            }
        }

        function scheduleMaskUpdate(trackDirection = false) {
            window.cancelAnimationFrame(frameRef.current);
            frameRef.current = window.requestAnimationFrame(() => updateMask(observedElement, trackDirection));
        }

        function handleScroll() {
            scheduleMaskUpdate(true);
        }

        function handleResize() {
            scheduleMaskUpdate();
        }

        const resizeObserver = new ResizeObserver(() => scheduleMaskUpdate());
        resizeObserver.observe(observedElement);
        if (observedElement.firstElementChild) resizeObserver.observe(observedElement.firstElementChild);

        updateMask(observedElement);
        observedElement.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", handleResize);

        return () => {
            resizeObserver.disconnect();
            observedElement.removeEventListener("scroll", handleScroll);
            window.removeEventListener("resize", handleResize);
            window.cancelAnimationFrame(frameRef.current);
            window.clearTimeout(directionResetRef.current);
        };
    }, []);

    return (
        <div
            className={cl(
                "scrollFrame",
                {
                    "mask-left": maskState.left,
                    "mask-right": maskState.right,
                    "scroll-left": maskState.direction === "left",
                    "scroll-right": maskState.direction === "right",
                },
            )}
        >
            <div className={cl("scroll")} ref={scrollRef}>
                <table className={cl("table")}>
                    {table.header.length > 0 && (
                        <thead>
                            <tr>
                                {table.header.map((cell, cellIndex) => (
                                    <th className={alignmentClass(table.alignments[cellIndex])} key={cellIndex} scope="col">
                                        {renderParsedNodes(cell, output, outputState)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                    )}
                    <tbody>
                        {table.rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                {row.map((cell, cellIndex) => (
                                    <td className={alignmentClass(table.alignments[cellIndex])} key={cellIndex}>
                                        {renderParsedNodes(cell, output, outputState)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function parseCellContent(cells: string[], parse: ParserParse, state: ParserState) {
    const inlineState: ParserState = {
        ...state,
        inline: true,
    };

    return cells.map(cell => parse(cell, inlineState));
}

function shouldSkipTableRule(state: ParserState) {
    return state.inline && !state.messageId;
}

const MarkdownTableRenderer = ErrorBoundary.wrap(function MarkdownTableRenderer({
    node,
    output,
    state,
}: MarkdownTableRendererProps) {
    return (
        <>
            {renderParsedNodes(node.before, output, state)}
            <TableBlock output={output} outputState={state} table={node} />
        </>
    );
}, { noop: true });

function createTableRule(order: number): MarkdownRule {
    return {
        order,
        match(source, state) {
            if (shouldSkipTableRule(state)) return null;

            const parsed = parseMarkdownTableMatch(source);
            return parsed ? createTableCapture(parsed, source) : null;
        },
        parse(capture, parse, state) {
            const parsed = capture.markdownTable;

            return {
                before: parsed.leadingMarkdown ? parse(parsed.leadingMarkdown, state) : [],
                raw: parsed.tableRaw,
                alignments: parsed.table.alignments,
                header: parseCellContent(parsed.table.header, parse, state),
                rows: parsed.table.rows.map(row => parseCellContent(row, parse, state)),
            };
        },
        react(node, output, state) {
            return <MarkdownTableRenderer node={node} output={output} state={state} />;
        },
    };
}
function scheduleTableRuleInstall(parser: { defaultRules?: MarkdownRules; }) {
    window.setTimeout(() => installTableRuleForParser(parser), 0);
}

function installTableRuleForParser(parser: { defaultRules?: MarkdownRules; }) {
    if (!shouldInstallTableRule) return;

    const rules = parser.defaultRules;
    if (!rules || rules[TABLE_RULE]) return;

    installedRules = rules;
    const paragraphOrder = typeof rules.paragraph?.order === "number" ? rules.paragraph.order : 1;
    rules[TABLE_RULE] = createTableRule(paragraphOrder - 0.5);
}

export default definePlugin({
    name: "MarkdownTables",
    description: "Render GitHub-style markdown tables in Discord messages.",
    tags: ["Chat", "Appearance"],
    authors: [EquicordDevs.yafyx],
    managedStyle,
    settings,
    patches: [
        {
            find: "simple-markdown: Invalid order for rule",
            replacement: {
                match: /paragraph:\{order:/,
                replace: "markdownTable:$self.getTableRule(),$&",
            },
        },
        {
            find: "Unknown markdown rule:",
            replacement: {
                match: /paragraph:{type:/,
                replace: 'markdownTable:{type:"block"},$&',
            },
        },
    ],
    start() {
        shouldInstallTableRule = true;

        if (Parser?.defaultRules) {
            scheduleTableRuleInstall(Parser);
        }

        waitFor("parseTopic", scheduleTableRuleInstall);
    },

    stop() {
        shouldInstallTableRule = false;
        if (installedRules) delete installedRules[TABLE_RULE];
        installedRules = null;
    },

    getTableRule(paragraphOrder = 1) {
        return createTableRule(paragraphOrder - 0.5);
    },
});
