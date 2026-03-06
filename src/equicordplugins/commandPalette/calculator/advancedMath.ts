/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { formatNumber, formatRawNumber } from "./formatters";
import type { CalculatorIntent, CalculatorResult } from "./types";

type Token =
    | { type: "number"; value: number; }
    | { type: "identifier"; value: string; }
    | { type: "operator"; value: "+" | "-" | "*" | "/" | "%" | "^"; }
    | { type: "leftParen"; }
    | { type: "rightParen"; }
    | { type: "comma"; }
    | { type: "equals"; }
    | { type: "semicolon"; };

type ExpressionNode =
    | { type: "number"; value: number; }
    | { type: "identifier"; name: string; }
    | { type: "unary"; operator: "+" | "-"; argument: ExpressionNode; }
    | { type: "binary"; operator: "+" | "-" | "*" | "/" | "%" | "^"; left: ExpressionNode; right: ExpressionNode; }
    | { type: "call"; callee: string; arguments: ExpressionNode[]; }
    | { type: "percent"; argument: ExpressionNode; };

interface FunctionDefinition {
    name: string;
    parameter: string;
    body: ExpressionNode;
}

interface ParsedAdvancedMathProgram {
    normalizedInput: string;
    definitions: FunctionDefinition[];
    expression: ExpressionNode;
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
    "⁺": "+",
    "⁻": "-"
};

const CONSTANTS: Record<string, number> = {
    e: Math.E,
    inf: Number.POSITIVE_INFINITY,
    infinity: Number.POSITIVE_INFINITY,
    nan: Number.NaN,
    pi: Math.PI,
    tau: Math.PI * 2
};

const BUILT_INS: Record<string, (...args: number[]) => number> = {
    abs: value => Math.abs(value),
    acos: value => Math.acos(value),
    asin: value => Math.asin(value),
    atan: value => Math.atan(value),
    ceil: value => Math.ceil(value),
    cos: value => Math.cos(value),
    exp: value => Math.exp(value),
    floor: value => Math.floor(value),
    ln: value => Math.log(value),
    log: value => Math.log10(value),
    max: (...values) => Math.max(...values),
    min: (...values) => Math.min(...values),
    round: (value, digits = 0) => {
        if (!Number.isFinite(digits)) return Number.NaN;
        const factor = 10 ** Math.trunc(digits);
        return Math.round(value * factor) / factor;
    },
    sin: value => Math.sin(value),
    sqrt: value => Math.sqrt(value),
    tan: value => Math.tan(value)
};

function isIdentifierChar(char: string | undefined): boolean {
    return Boolean(char && /[a-z0-9_]/i.test(char));
}

function normalizeMathWhitespace(input: string): string {
    return input.trim().replace(/\s+/g, " ");
}

function readBalancedGroup(input: string, start: number, open: string, close: string): { value: string; nextIndex: number; } | null {
    if (input[start] !== open) return null;

    let depth = 0;
    for (let index = start; index < input.length; index++) {
        const current = input[index];
        if (current === open) depth += 1;
        if (current === close) depth -= 1;
        if (depth === 0) {
            return {
                value: input.slice(start + 1, index),
                nextIndex: index + 1
            };
        }
    }

    return null;
}

function convertLatexFragments(input: string): string {
    let output = "";

    for (let index = 0; index < input.length;) {
        const remainder = input.slice(index);

        if (remainder.startsWith("\\frac")) {
            let cursor = index + 5;
            while (input[cursor] === " ") cursor += 1;
            const numerator = readBalancedGroup(input, cursor, "{", "}");
            if (!numerator) {
                output += "\\frac";
                index += 5;
                continue;
            }

            cursor = numerator.nextIndex;
            while (input[cursor] === " ") cursor += 1;
            const denominator = readBalancedGroup(input, cursor, "{", "}");
            if (!denominator) {
                output += "\\frac";
                index += 5;
                continue;
            }

            output += `((${convertLatexFragments(numerator.value)})/(${convertLatexFragments(denominator.value)}))`;
            index = denominator.nextIndex;
            continue;
        }

        if (remainder.startsWith("\\sqrt")) {
            let cursor = index + 5;
            while (input[cursor] === " ") cursor += 1;
            const group = readBalancedGroup(input, cursor, "{", "}") ?? readBalancedGroup(input, cursor, "(", ")");
            if (!group) {
                output += "sqrt";
                index += 5;
                continue;
            }

            output += `sqrt(${convertLatexFragments(group.value)})`;
            index = group.nextIndex;
            continue;
        }

        if (remainder.startsWith("\\operatorname")) {
            let cursor = index + "\\operatorname".length;
            while (input[cursor] === " ") cursor += 1;
            const group = readBalancedGroup(input, cursor, "{", "}");
            if (!group) {
                output += "\\operatorname";
                index += "\\operatorname".length;
                continue;
            }

            output += convertLatexFragments(group.value);
            index = group.nextIndex;
            continue;
        }

        if (remainder.startsWith("\\cdot") || remainder.startsWith("\\times")) {
            output += "*";
            index += remainder.startsWith("\\cdot") ? 5 : 6;
            continue;
        }

        if (remainder.startsWith("\\div")) {
            output += "/";
            index += 4;
            continue;
        }

        if (remainder.startsWith("\\pi")) {
            output += "pi";
            index += 3;
            continue;
        }

        if (remainder.startsWith("\\tau")) {
            output += "tau";
            index += 4;
            continue;
        }

        if (remainder.startsWith("\\infty")) {
            output += "infinity";
            index += 6;
            continue;
        }

        if (remainder.startsWith("\\left") || remainder.startsWith("\\right")) {
            index += remainder.startsWith("\\left") ? 5 : 6;
            continue;
        }

        output += input[index];
        index += 1;
    }

    return output;
}

function convertUnicodeSuperscripts(input: string): string {
    let output = "";

    for (let index = 0; index < input.length; index++) {
        const current = input[index];
        const superscript = SUPERSCRIPT_DIGITS[current];
        if (!superscript) {
            output += current;
            continue;
        }

        let sequence = superscript;
        while (index + 1 < input.length && SUPERSCRIPT_DIGITS[input[index + 1]]) {
            index += 1;
            sequence += SUPERSCRIPT_DIGITS[input[index]];
        }

        output += `^(${sequence})`;
    }

    return output;
}

function normalizeAdvancedMathInput(rawInput: string): string | null {
    const input = normalizeMathWhitespace(rawInput);
    if (!input) return null;

    let normalized = input
        .replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1")
        .replace(/[−–—]/g, "-")
        .replace(/[×·]/g, "*")
        .replace(/÷/g, "/")
        .replace(/π/gi, "pi")
        .replace(/τ/gi, "tau")
        .replace(/∞/g, "infinity")
        .replace(/√/g, "sqrt")
        .replace(/square root of/gi, "sqrt ")
        .replace(/([0-9.]+)\s*%\s+of\s+([a-z0-9_().\\{}^+\-*/\s]+)/gi, "(($1/100)*($2))");

    normalized = convertLatexFragments(normalized);
    normalized = convertUnicodeSuperscripts(normalized);
    normalized = normalized
        .replace(/[{}[\]]/g, match => (match === "{" || match === "[" ? "(" : ")"))
        .replace(/\bpower\b/gi, "^")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    if (!normalized) return null;
    if (/\\[a-z]+/i.test(normalized)) return null;
    if (!/[0-9a-z∞π\tau+\-*/%^()=;,]/i.test(normalized)) return null;

    return normalized;
}

function tokenizeAdvancedMath(normalizedInput: string): Token[] | null {
    const tokens: Token[] = [];
    let index = 0;

    while (index < normalizedInput.length) {
        const current = normalizedInput[index];

        if (current === " ") {
            index += 1;
            continue;
        }

        const numberMatch = normalizedInput.slice(index).match(/^(?:\d+\.\d+|\d+|\.\d+)(?:e[+-]?\d+)?/i);
        if (numberMatch) {
            const value = Number(numberMatch[0]);
            if (Number.isNaN(value)) return null;
            tokens.push({ type: "number", value });
            index += numberMatch[0].length;
            continue;
        }

        const identifierMatch = normalizedInput.slice(index).match(/^[a-z_][a-z0-9_]*/i);
        if (identifierMatch) {
            tokens.push({ type: "identifier", value: identifierMatch[0] });
            index += identifierMatch[0].length;
            continue;
        }

        if (current === "+") tokens.push({ type: "operator", value: "+" });
        else if (current === "-") tokens.push({ type: "operator", value: "-" });
        else if (current === "*") tokens.push({ type: "operator", value: "*" });
        else if (current === "/") tokens.push({ type: "operator", value: "/" });
        else if (current === "%") tokens.push({ type: "operator", value: "%" });
        else if (current === "^") tokens.push({ type: "operator", value: "^" });
        else if (current === "(") tokens.push({ type: "leftParen" });
        else if (current === ")") tokens.push({ type: "rightParen" });
        else if (current === ",") tokens.push({ type: "comma" });
        else if (current === "=") tokens.push({ type: "equals" });
        else if (current === ";") tokens.push({ type: "semicolon" });
        else return null;

        index += 1;
    }

    const expanded: Token[] = [];
    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
        const token = tokens[tokenIndex];
        const previous = expanded[expanded.length - 1];

        const previousEndsExpression = previous
            ? previous.type === "number"
                || previous.type === "identifier"
                || previous.type === "rightParen"
            : false;
        const currentStartsExpression = token.type === "number"
            || token.type === "identifier"
            || token.type === "leftParen";
        const isFunctionCall = previous?.type === "identifier" && token.type === "leftParen";

        if (previousEndsExpression && currentStartsExpression && !isFunctionCall) {
            expanded.push({ type: "operator", value: "*" });
        }

        expanded.push(token);
    }

    return expanded;
}

function splitStatements(tokens: Token[]): Token[][] {
    const statements: Token[][] = [];
    let depth = 0;
    let start = 0;

    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        if (token.type === "leftParen") depth += 1;
        if (token.type === "rightParen") depth -= 1;
        if (depth === 0 && token.type === "semicolon") {
            statements.push(tokens.slice(start, index));
            start = index + 1;
        }
    }

    if (start <= tokens.length) {
        statements.push(tokens.slice(start));
    }

    return statements.filter(statement => statement.length > 0);
}

class ExpressionParser {
    private index = 0;

    constructor(private readonly tokens: Token[]) {}

    parse(): ExpressionNode | null {
        const expression = this.parseAdditive();
        if (!expression) return null;
        if (this.index !== this.tokens.length) return null;
        return expression;
    }

    private parseAdditive(): ExpressionNode | null {
        let left = this.parseMultiplicative();
        if (!left) return null;

        while (true) {
            const token = this.tokens[this.index];
            if (token?.type !== "operator" || (token.value !== "+" && token.value !== "-")) break;
            this.index += 1;
            const right = this.parseMultiplicative();
            if (!right) return null;
            left = { type: "binary", operator: token.value, left, right };
        }

        return left;
    }

    private parseMultiplicative(): ExpressionNode | null {
        let left = this.parsePower();
        if (!left) return null;

        while (true) {
            const token = this.tokens[this.index];
            if (token?.type !== "operator" || (token.value !== "*" && token.value !== "/" && token.value !== "%")) break;

            const next = this.tokens[this.index + 1];
            const isPostfixPercent = token.value === "%" && (!next || next.type === "rightParen" || next.type === "comma");
            if (isPostfixPercent) break;

            this.index += 1;
            const right = this.parsePower();
            if (!right) return null;
            left = { type: "binary", operator: token.value, left, right };
        }

        return left;
    }

    private parsePower(): ExpressionNode | null {
        const left = this.parseUnary();
        if (!left) return null;

        const token = this.tokens[this.index];
        if (token?.type === "operator" && token.value === "^") {
            this.index += 1;
            const right = this.parsePower();
            if (!right) return null;
            return { type: "binary", operator: "^", left, right };
        }

        return left;
    }

    private parseUnary(): ExpressionNode | null {
        const token = this.tokens[this.index];
        if (token?.type === "operator" && (token.value === "+" || token.value === "-")) {
            this.index += 1;
            const argument = this.parseUnary();
            if (!argument) return null;
            return { type: "unary", operator: token.value, argument };
        }

        return this.parsePostfix();
    }

    private parsePostfix(): ExpressionNode | null {
        let expression = this.parsePrimary();
        if (!expression) return null;

        while (true) {
            const token = this.tokens[this.index];
            if (token?.type !== "operator" || token.value !== "%") break;
            const next = this.tokens[this.index + 1];
            if (next && next.type !== "rightParen" && next.type !== "comma") break;
            this.index += 1;
            expression = { type: "percent", argument: expression };
        }

        return expression;
    }

    private parsePrimary(): ExpressionNode | null {
        const token = this.tokens[this.index];
        if (!token) return null;

        if (token.type === "number") {
            this.index += 1;
            return { type: "number", value: token.value };
        }

        if (token.type === "identifier") {
            this.index += 1;
            const next = this.tokens[this.index];
            if (next?.type !== "leftParen") {
                return { type: "identifier", name: token.value };
            }

            this.index += 1;
            const args: ExpressionNode[] = [];
            const closing = this.tokens[this.index];
            if (closing?.type === "rightParen") {
                this.index += 1;
                return { type: "call", callee: token.value, arguments: args };
            }

            while (this.index < this.tokens.length) {
                const argument = this.parseAdditive();
                if (!argument) return null;
                args.push(argument);

                const separator = this.tokens[this.index];
                if (separator?.type === "comma") {
                    this.index += 1;
                    continue;
                }

                if (separator?.type === "rightParen") {
                    this.index += 1;
                    return { type: "call", callee: token.value, arguments: args };
                }

                return null;
            }

            return null;
        }

        if (token.type === "leftParen") {
            this.index += 1;
            const expression = this.parseAdditive();
            if (!expression) return null;
            if (this.tokens[this.index]?.type !== "rightParen") return null;
            this.index += 1;
            return expression;
        }

        return null;
    }
}

function parseFunctionDefinition(tokens: Token[]): FunctionDefinition | null {
    if (tokens.length < 6) return null;
    if (tokens[0]?.type !== "identifier") return null;
    if (tokens[1]?.type !== "leftParen") return null;
    if (tokens[2]?.type !== "identifier") return null;
    if (tokens[3]?.type !== "rightParen") return null;
    if (tokens[4]?.type !== "equals") return null;

    const parser = new ExpressionParser(tokens.slice(5));
    const body = parser.parse();
    if (!body) return null;

    return {
        name: tokens[0].value,
        parameter: tokens[2].value,
        body
    };
}

function parseAdvancedMathProgram(query: string): ParsedAdvancedMathProgram | null {
    const normalizedInput = normalizeAdvancedMathInput(query);
    if (!normalizedInput) return null;

    const tokens = tokenizeAdvancedMath(normalizedInput);
    if (!tokens || tokens.length === 0) return null;

    const statements = splitStatements(tokens);
    if (statements.length === 0) return null;

    const definitions: FunctionDefinition[] = [];
    let expression: ExpressionNode | null = null;

    for (let index = 0; index < statements.length; index++) {
        const statement = statements[index];
        const definition = parseFunctionDefinition(statement);
        if (definition) {
            if (expression) return null;
            definitions.push(definition);
            continue;
        }

        if (index !== statements.length - 1) return null;

        const parser = new ExpressionParser(statement);
        expression = parser.parse();
        if (!expression) return null;
    }

    if (!expression) return null;

    return {
        normalizedInput,
        definitions,
        expression
    };
}

function isTrivialNumericLiteral(expression: ExpressionNode): boolean {
    return expression.type === "number";
}

function isPlainNumericLiteral(query: string): boolean {
    return /^-?(?:\d+\.\d+|\d+|\.\d+)$/.test(query.trim());
}

type EvaluationScope = {
    values: Map<string, number>;
    functions: Map<string, FunctionDefinition>;
};

function evaluateExpression(expression: ExpressionNode, scope: EvaluationScope): number | null {
    switch (expression.type) {
        case "number":
            return expression.value;
        case "identifier": {
            const scoped = scope.values.get(expression.name);
            if (scoped != null) return scoped;
            if (Object.prototype.hasOwnProperty.call(CONSTANTS, expression.name)) {
                return CONSTANTS[expression.name];
            }
            return null;
        }
        case "unary": {
            const argument = evaluateExpression(expression.argument, scope);
            if (argument == null) return null;
            return expression.operator === "-" ? -argument : argument;
        }
        case "binary": {
            const left = evaluateExpression(expression.left, scope);
            const right = evaluateExpression(expression.right, scope);
            if (left == null || right == null) return null;
            if (expression.operator === "+") return left + right;
            if (expression.operator === "-") return left - right;
            if (expression.operator === "*") return left * right;
            if (expression.operator === "/") return left / right;
            if (expression.operator === "%") return left % right;
            return left ** right;
        }
        case "percent": {
            const argument = evaluateExpression(expression.argument, scope);
            if (argument == null) return null;
            return argument / 100;
        }
        case "call": {
            const args: number[] = [];
            for (const argument of expression.arguments) {
                const value = evaluateExpression(argument, scope);
                if (value == null) return null;
                args.push(value);
            }

            const builtIn = BUILT_INS[expression.callee];
            if (builtIn) {
                return builtIn(...args);
            }

            const userDefined = scope.functions.get(expression.callee);
            if (!userDefined || args.length !== 1) return null;

            const nestedValues = new Map(scope.values);
            nestedValues.set(userDefined.parameter, args[0]);
            return evaluateExpression(userDefined.body, {
                values: nestedValues,
                functions: scope.functions
            });
        }
    }
}

function classifyMathResult(program: ParsedAdvancedMathProgram, value: number): { secondaryText: string; tertiaryText?: string; } {
    if (!Number.isFinite(value) || Number.isNaN(value)) {
        return {
            secondaryText: "Special value",
            tertiaryText: Number.isNaN(value) ? "NaN" : value > 0 ? "Infinity" : "-Infinity"
        };
    }

    if (program.definitions.length > 0) {
        return {
            secondaryText: "Function result",
            tertiaryText: `${program.definitions.length} definition${program.definitions.length === 1 ? "" : "s"}`
        };
    }

    if (program.expression.type === "identifier") {
        return {
            secondaryText: "Constant",
            tertiaryText: program.expression.name
        };
    }

    if (program.expression.type === "call") {
        return {
            secondaryText: "Function",
            tertiaryText: program.expression.callee
        };
    }

    return {
        secondaryText: "Answer",
        tertiaryText: "Expression"
    };
}

function formatSpecialValue(value: number): string {
    if (Number.isNaN(value)) return "NaN";
    if (value === Number.POSITIVE_INFINITY) return "Infinity";
    if (value === Number.NEGATIVE_INFINITY) return "-Infinity";
    return formatNumber(value);
}

export function parseAdvancedMathQuery(query: string): CalculatorIntent | null {
    const program = parseAdvancedMathProgram(query);
    if (!program) return null;
    if (program.definitions.length === 0 && isTrivialNumericLiteral(program.expression) && isPlainNumericLiteral(query)) return null;

    return {
        kind: "advanced_math",
        displayInput: query,
        normalizedInput: program.normalizedInput
    };
}

export function evaluateAdvancedMath(displayInput: string, normalizedInput: string): CalculatorResult | null {
    const program = parseAdvancedMathProgram(normalizedInput);
    if (!program) return null;

    const functions = new Map<string, FunctionDefinition>();
    for (const definition of program.definitions) {
        functions.set(definition.name, definition);
    }

    const value = evaluateExpression(program.expression, {
        values: new Map(),
        functions
    });
    if (value == null) return null;

    const meta = classifyMathResult(program, value);
    const displayAnswer = formatSpecialValue(value);

    return {
        kind: "number",
        displayInput,
        normalizedInput,
        displayAnswer,
        rawAnswer: Number.isFinite(value) ? formatRawNumber(value) : displayAnswer,
        secondaryText: meta.secondaryText,
        tertiaryText: meta.tertiaryText
    };
}
