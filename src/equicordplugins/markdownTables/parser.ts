/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type TableAlignment = "left" | "center" | "right" | null;

export interface MarkdownTable {
    header: string[];
    alignments: TableAlignment[];
    rows: string[][];
    startLine: number;
    endLine: number;
}

export interface MarkdownTableBlock {
    raw: string;
    table: MarkdownTable;
}

export interface MarkdownTableMatch {
    raw: string;
    leadingMarkdown: string;
    tableRaw: string;
    table: MarkdownTable;
}

interface SeparatorParseResult {
    alignments: TableAlignment[];
}

const separatorCellRe = /^:?-{3,}:?$/;

function isEscapedAt(value: string, index: number) {
    let slashCount = 0;

    for (let i = index - 1; i >= 0 && value[i] === "\\"; i--) {
        slashCount++;
    }

    return slashCount % 2 === 1;
}

function hasEscapedTableDelimiters(line: string) {
    let count = 0;

    for (let i = 0; i < line.length; i++) {
        if (line[i] !== "|" || !isEscapedAt(line, i)) continue;

        count++;
        if (count >= 2) return true;
    }

    return false;
}

function hasUnescapedTableDelimiter(line: string) {
    for (let i = 0; i < line.length; i++) {
        if (line[i] === "|" && !isEscapedAt(line, i)) return true;
    }

    return false;
}

function hasTableDelimiter(line: string) {
    return hasUnescapedTableDelimiter(line) || hasEscapedTableDelimiters(line);
}

function isIndentedCodeLine(line: string) {
    return /^(?: {4,}|\t)/.test(line);
}

function isFenceLine(line: string) {
    return /^(?: {0,3})(`{3,}|~{3,})/.test(line);
}

function canBeTableLine(line: string) {
    return line.trim() !== ""
        && !isIndentedCodeLine(line)
        && !isFenceLine(line)
        && hasTableDelimiter(line);
}

function stripOuterPipes(line: string) {
    const trimmed = line.trim();
    let start = 0;
    let end = trimmed.length;

    if (trimmed[start] === "|") start++;
    if (trimmed[end - 1] === "|" && !isEscapedAt(trimmed, end - 1)) end--;

    return trimmed.slice(start, end);
}

function hasOuterTablePipes(line: string) {
    const trimmed = line.trim();

    return (trimmed.startsWith("|") || trimmed.startsWith("\\|"))
        && (trimmed.endsWith("|") || trimmed.endsWith("\\|"));
}

export function splitTableRow(line: string) {
    const cells: string[] = [];
    const row = stripOuterPipes(hasUnescapedTableDelimiter(line) ? line : line.replace(/\\\|/g, "|"));
    let current = "";

    for (let i = 0; i < row.length; i++) {
        const char = row[i];

        if (char === "\\" && row[i + 1] === "|" && !isEscapedAt(row, i)) {
            current += "|";
            i++;
            continue;
        }

        if (char === "|" && !isEscapedAt(row, i)) {
            cells.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    cells.push(current.trim());
    return cells;
}

function parseAlignment(cell: string): TableAlignment | undefined {
    const value = cell.trim();

    if (!separatorCellRe.test(value)) return undefined;
    if (value.startsWith(":") && value.endsWith(":")) return "center";
    if (value.startsWith(":")) return "left";
    if (value.endsWith(":")) return "right";

    return null;
}

function parseSeparator(line: string): SeparatorParseResult | null {
    if (!canBeTableLine(line)) return null;

    const cells = splitTableRow(line);
    if (cells.length < 2) return null;

    const alignments = cells.map(parseAlignment);
    if (alignments.some(alignment => alignment === undefined)) return null;

    return {
        alignments: alignments as TableAlignment[],
    };
}

function normaliseCells(cells: string[], width: number) {
    return Array.from({ length: width }, (_, index) => cells[index] ?? "");
}

function isBlankLine(line: string) {
    return line.trim() === "";
}

function nextContentLine(lines: string[], cursor: number, fenced?: boolean[]) {
    for (let index = cursor; index < lines.length; index++) {
        if (fenced?.[index]) return -1;
        if (!isBlankLine(lines[index])) return index;
    }

    return -1;
}

function canStartTableAt(lines: string[], lineIndex: number, fenced?: boolean[]) {
    if (lineIndex < 0 || lineIndex >= lines.length - 1) return false;
    if (fenced?.[lineIndex] || fenced?.[lineIndex + 1]) return false;

    return canBeTableLine(lines[lineIndex]) && parseSeparator(lines[lineIndex + 1]) !== null;
}

function canContinueTableAt(lines: string[], lineIndex: number, fenced?: boolean[]) {
    if (lineIndex < 0 || fenced?.[lineIndex]) return false;

    const line = lines[lineIndex];
    if (!canBeTableLine(line) || parseSeparator(line)) return false;

    return lineIndex >= lines.length - 1
        || fenced?.[lineIndex + 1]
        || !parseSeparator(lines[lineIndex + 1]);
}

function getFenceMask(lines: string[]) {
    const mask = new Array<boolean>(lines.length).fill(false);
    let fenceChar: "`" | "~" | null = null;
    let fenceLength = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const openingMatch = /^(?: {0,3})(`{3,}|~{3,})/.exec(line);

        if (!fenceChar) {
            if (openingMatch) {
                fenceChar = openingMatch[1][0] as "`" | "~";
                fenceLength = openingMatch[1].length;
                mask[i] = true;
            }

            continue;
        }

        mask[i] = true;

        const trimmed = line.trimStart();
        let closingLength = 0;

        while (trimmed[closingLength] === fenceChar) {
            closingLength++;
        }

        if (closingLength >= fenceLength && trimmed.slice(closingLength).trim() === "") {
            fenceChar = null;
            fenceLength = 0;
        }
    }

    return mask;
}

function parseTableAtLine(lines: string[], lineIndex: number, fenced?: boolean[]) {
    if (lineIndex >= lines.length - 1) return null;
    if (fenced?.[lineIndex] || fenced?.[lineIndex + 1]) return null;
    if (!canBeTableLine(lines[lineIndex]) || !canBeTableLine(lines[lineIndex + 1])) return null;

    const headerCells = splitTableRow(lines[lineIndex]);
    if (headerCells.length < 2) return null;

    const separator = parseSeparator(lines[lineIndex + 1]);
    if (!separator) return null;

    const width = separator.alignments.length;
    const rows: string[][] = [];
    let cursor = lineIndex + 2;

    while (cursor < lines.length && !fenced?.[cursor]) {
        const line = lines[cursor];

        if (canBeTableLine(line)) {
            rows.push(normaliseCells(splitTableRow(line), width));
            cursor++;
            continue;
        }

        if (rows.length > 0) {
            if (isBlankLine(line)) {
                const nextLineIndex = nextContentLine(lines, cursor + 1, fenced);

                if (canContinueTableAt(lines, nextLineIndex, fenced)) {
                    cursor = nextLineIndex;
                    continue;
                }
            } else {
                const nextLineIndex = nextContentLine(lines, cursor + 1, fenced);

                if (canContinueTableAt(lines, nextLineIndex, fenced)) {
                    const lastRow = rows[rows.length - 1];
                    const lastCellIndex = width - 1;

                    // Treat prose between table-looking rows as wrapped cell text.
                    lastRow[lastCellIndex] = `${lastRow[lastCellIndex]}\n${line.trim()}`.trim();
                    cursor++;
                    continue;
                }
            }
        }

        break;
    }

    while (cursor > lineIndex + 2 && isBlankLine(lines[cursor - 1])) {
        cursor--;
    }

    if (rows.length === 0) {
        return null;
    }

    return {
        table: {
            header: normaliseCells(headerCells, width),
            alignments: separator.alignments,
            rows,
            startLine: lineIndex,
            endLine: cursor - 1,
        },
        nextLineIndex: cursor,
    };
}

function parseLooseRowsAtLine(lines: string[], lineIndex: number, fenced?: boolean[]) {
    if (fenced?.[lineIndex] || !canBeTableLine(lines[lineIndex]) || !hasOuterTablePipes(lines[lineIndex])) return null;

    const firstRow = splitTableRow(lines[lineIndex]);
    const width = firstRow.length;
    const rows: string[][] = [];
    let cursor = lineIndex;

    if (width < 3) return null;

    while (cursor < lines.length && !fenced?.[cursor] && canBeTableLine(lines[cursor]) && hasOuterTablePipes(lines[cursor])) {
        const cells = splitTableRow(lines[cursor]);
        if (cells.length < 3) break;

        rows.push(normaliseCells(cells, width));
        cursor++;
    }

    if (rows.length < 2) return null;

    return {
        table: {
            header: [],
            alignments: Array.from({ length: width }, () => null),
            rows,
            startLine: lineIndex,
            endLine: cursor - 1,
        },
        nextLineIndex: cursor,
    };
}

function stripLineEnding(line: string) {
    if (line.endsWith("\r\n")) return line.slice(0, -2);
    if (line.endsWith("\n") || line.endsWith("\r")) return line.slice(0, -1);

    return line;
}

function sourceLines(markdown: string) {
    const lines: Array<{ raw: string; text: string; }> = [];
    let start = 0;

    for (let i = 0; i < markdown.length; i++) {
        if (markdown[i] !== "\n") continue;

        const raw = markdown.slice(start, i + 1);
        lines.push({
            raw,
            text: stripLineEnding(raw),
        });
        start = i + 1;
    }

    if (start < markdown.length) {
        const raw = markdown.slice(start);
        lines.push({
            raw,
            text: stripLineEnding(raw),
        });
    }

    return lines;
}

function rawTableBlock(lines: Array<{ raw: string; }>, nextLineIndex: number) {
    return lines
        .slice(0, nextLineIndex)
        .map((line, index) => index === nextLineIndex - 1 ? stripLineEnding(line.raw) : line.raw)
        .join("");
}

export function parseMarkdownTableBlock(markdown: string): MarkdownTableBlock | null {
    const lines = sourceLines(markdown);
    const parsed = parseTableAtLine(lines.map(line => line.text), 0);

    if (!parsed) return null;

    return {
        raw: rawTableBlock(lines, parsed.nextLineIndex),
        table: parsed.table,
    };
}

export function parseMarkdownTableMatch(markdown: string): MarkdownTableMatch | null {
    const lines = sourceLines(markdown);
    const textLines = lines.map(line => line.text);
    const fenced = getFenceMask(textLines);

    for (let lineIndex = 0; lineIndex < textLines.length - 1; lineIndex++) {
        const parsed = parseTableAtLine(textLines, lineIndex, fenced) ?? parseLooseRowsAtLine(textLines, lineIndex, fenced);
        if (!parsed) continue;

        const leadingMarkdown = lines
            .slice(0, lineIndex)
            .map(line => line.raw)
            .join("");
        const tableRaw = rawTableBlock(lines.slice(lineIndex), parsed.nextLineIndex - lineIndex);

        return {
            raw: `${leadingMarkdown}${tableRaw}`,
            leadingMarkdown,
            tableRaw,
            table: parsed.table,
        };
    }

    return null;
}

export function parseMarkdownTables(markdown: string): MarkdownTable[] {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const fenced = getFenceMask(lines);
    const tables: MarkdownTable[] = [];

    for (let lineIndex = 0; lineIndex < lines.length - 1; lineIndex++) {
        const parsed = parseTableAtLine(lines, lineIndex, fenced);
        if (!parsed) continue;

        tables.push(parsed.table);
        lineIndex = parsed.nextLineIndex - 1;
    }

    return tables;
}
