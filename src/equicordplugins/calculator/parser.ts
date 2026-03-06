/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// ── Token types ──────────────────────────────────────────────

const enum TokenType {
    Number,
    Ident,
    Plus,
    Minus,
    Star,
    Slash,
    Percent,
    Caret,
    LParen,
    RParen,
    Comma,
    Excl,
    EOF,
}

interface Token {
    type: TokenType;
    value: string;
}

// ── Tokenizer ────────────────────────────────────────────────

const MAX_EXPR_LENGTH = 512;

function tokenize(input: string): Token[] {
    if (input.length > MAX_EXPR_LENGTH)
        throw new Error(`Expression too long (max ${MAX_EXPR_LENGTH} characters)`);

    const tokens: Token[] = [];
    let i = 0;

    while (i < input.length) {
        const ch = input[i];

        if (ch === " " || ch === "\t") { i++; continue; }

        if (ch === "+") { tokens.push({ type: TokenType.Plus, value: "+" }); i++; continue; }
        if (ch === "-") { tokens.push({ type: TokenType.Minus, value: "-" }); i++; continue; }
        if (ch === "*") { tokens.push({ type: TokenType.Star, value: "*" }); i++; continue; }
        if (ch === "/") { tokens.push({ type: TokenType.Slash, value: "/" }); i++; continue; }
        if (ch === "%") { tokens.push({ type: TokenType.Percent, value: "%" }); i++; continue; }
        if (ch === "^") { tokens.push({ type: TokenType.Caret, value: "^" }); i++; continue; }
        if (ch === "(") { tokens.push({ type: TokenType.LParen, value: "(" }); i++; continue; }
        if (ch === ")") { tokens.push({ type: TokenType.RParen, value: ")" }); i++; continue; }
        if (ch === ",") { tokens.push({ type: TokenType.Comma, value: "," }); i++; continue; }
        if (ch === "!") { tokens.push({ type: TokenType.Excl, value: "!" }); i++; continue; }

        // Numbers: 123, 12.5, .5
        if (ch >= "0" && ch <= "9" || ch === ".") {
            let num = "";
            let hasDot = false;
            while (i < input.length && ((input[i] >= "0" && input[i] <= "9") || (input[i] === "." && !hasDot))) {
                if (input[i] === ".") hasDot = true;
                num += input[i];
                i++;
            }
            tokens.push({ type: TokenType.Number, value: num });
            continue;
        }

        // Identifiers: function names and constants
        if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
            let ident = "";
            while (i < input.length && ((input[i] >= "a" && input[i] <= "z") || (input[i] >= "A" && input[i] <= "Z") || (input[i] >= "0" && input[i] <= "9") || input[i] === "_")) {
                ident += input[i];
                i++;
            }
            tokens.push({ type: TokenType.Ident, value: ident });
            continue;
        }

        throw new Error(`Unexpected character: '${ch}'`);
    }

    tokens.push({ type: TokenType.EOF, value: "" });
    return tokens;
}

// ── AST node types ───────────────────────────────────────────

type ASTNode =
    | { kind: "number"; value: number; }
    | { kind: "unary"; op: "+" | "-"; operand: ASTNode; }
    | { kind: "binary"; op: "+" | "-" | "*" | "/" | "%" | "^"; left: ASTNode; right: ASTNode; }
    | { kind: "call"; name: string; args: ASTNode[]; }
    | { kind: "factorial"; operand: ASTNode; };

// ── Recursive-descent parser ─────────────────────────────────

const MAX_DEPTH = 64;

class Parser {
    private tokens: Token[];
    private pos = 0;
    private depth = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    private peek(): Token {
        return this.tokens[this.pos];
    }

    private advance(): Token {
        return this.tokens[this.pos++];
    }

    private expect(type: TokenType): Token {
        const tok = this.advance();
        if (tok.type !== type)
            throw new Error(`Expected ${TokenType[type]} but got '${tok.value}'`);
        return tok;
    }

    private enterDepth() {
        if (++this.depth > MAX_DEPTH)
            throw new Error("Expression too deeply nested");
    }

    private exitDepth() {
        this.depth--;
    }

    parse(): ASTNode {
        const node = this.parseExpr();
        if (this.peek().type !== TokenType.EOF)
            throw new Error(`Unexpected token: '${this.peek().value}'`);
        return node;
    }

    // expr = term (('+' | '-') term)*
    private parseExpr(): ASTNode {
        this.enterDepth();
        let left = this.parseTerm();
        while (this.peek().type === TokenType.Plus || this.peek().type === TokenType.Minus) {
            const op = this.advance().value as "+" | "-";
            const right = this.parseTerm();
            left = { kind: "binary", op, left, right };
        }
        this.exitDepth();
        return left;
    }

    // term = factor (('*' | '/' | '%') factor)*
    private parseTerm(): ASTNode {
        this.enterDepth();
        let left = this.parsePower();
        while (this.peek().type === TokenType.Star || this.peek().type === TokenType.Slash || this.peek().type === TokenType.Percent) {
            const op = this.advance().value as "*" | "/" | "%";
            const right = this.parsePower();
            left = { kind: "binary", op, left, right };
        }
        this.exitDepth();
        return left;
    }

    // power = unary ('^' power)?   (right-associative)
    private parsePower(): ASTNode {
        this.enterDepth();
        let base = this.parseUnary();
        if (this.peek().type === TokenType.Caret) {
            this.advance();
            const exp = this.parsePower(); // right-associative recursion
            base = { kind: "binary", op: "^", left: base, right: exp };
        }
        this.exitDepth();
        return base;
    }

    // unary = ('+' | '-') unary | postfix
    private parseUnary(): ASTNode {
        this.enterDepth();
        let node: ASTNode;
        if (this.peek().type === TokenType.Plus) {
            this.advance();
            node = this.parseUnary();
        } else if (this.peek().type === TokenType.Minus) {
            this.advance();
            node = { kind: "unary", op: "-", operand: this.parseUnary() };
        } else {
            node = this.parsePostfix();
        }
        this.exitDepth();
        return node;
    }

    // postfix = primary ('!')*
    private parsePostfix(): ASTNode {
        this.enterDepth();
        let node = this.parsePrimary();
        while (this.peek().type === TokenType.Excl) {
            this.advance();
            node = { kind: "factorial", operand: node };
        }
        this.exitDepth();
        return node;
    }

    // primary = NUMBER | IDENT '(' args ')' | IDENT | '(' expr ')'
    private parsePrimary(): ASTNode {
        this.enterDepth();
        const tok = this.peek();
        let node: ASTNode;

        if (tok.type === TokenType.Number) {
            this.advance();
            node = { kind: "number", value: parseFloat(tok.value) };
        } else if (tok.type === TokenType.Ident) {
            this.advance();
            if (this.peek().type === TokenType.LParen) {
                // Function call
                this.advance(); // consume '('
                const args: ASTNode[] = [];
                if (this.peek().type !== TokenType.RParen) {
                    args.push(this.parseExpr());
                    while (this.peek().type === TokenType.Comma) {
                        this.advance();
                        args.push(this.parseExpr());
                    }
                }
                this.expect(TokenType.RParen);
                node = { kind: "call", name: tok.value.toLowerCase(), args };
            } else {
                // Constant reference — treat as zero-arg call to resolve in evaluator
                node = { kind: "call", name: tok.value.toLowerCase(), args: [] };
            }
        } else if (tok.type === TokenType.LParen) {
            this.advance();
            node = this.parseExpr();
            this.expect(TokenType.RParen);
        } else {
            throw new Error(`Unexpected token: '${tok.value || "end of input"}'`);
        }

        this.exitDepth();
        return node;
    }
}

// ── Whitelisted functions & constants ────────────────────────

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    atan2: Math.atan2,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    asinh: Math.asinh,
    acosh: Math.acosh,
    atanh: Math.atanh,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
    trunc: Math.trunc,
    sign: Math.sign,
    log: Math.log,
    log2: Math.log2,
    log10: Math.log10,
    ln: Math.log,
    exp: Math.exp,
    pow: Math.pow,
    min: Math.min,
    max: Math.max,
    hypot: Math.hypot,
    random: Math.random,
    deg: (x: number) => x * (180 / Math.PI),
    rad: (x: number) => x * (Math.PI / 180),
};

const CONSTANTS: Record<string, number> = {
    pi: Math.PI,
    e: Math.E,
    tau: Math.PI * 2,
    inf: Infinity,
    infinity: Infinity,
    phi: (1 + Math.sqrt(5)) / 2,
    ln2: Math.LN2,
    ln10: Math.LN10,
    sqrt2: Math.SQRT2,
};

// ── Evaluator ────────────────────────────────────────────────

function factorial(n: number): number {
    if (!Number.isInteger(n) || n < 0) throw new Error("Factorial requires a non-negative integer");
    if (n > 170) return Infinity;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

function evaluate(node: ASTNode): number {
    switch (node.kind) {
        case "number":
            return node.value;

        case "unary":
            return node.op === "-" ? -evaluate(node.operand) : evaluate(node.operand);

        case "binary": {
            const left = evaluate(node.left);
            const right = evaluate(node.right);
            switch (node.op) {
                case "+": return left + right;
                case "-": return left - right;
                case "*": return left * right;
                case "/":
                    if (right === 0) throw new Error("Division by zero");
                    return left / right;
                case "%":
                    if (right === 0) throw new Error("Modulo by zero");
                    return left % right;
                case "^": return Math.pow(left, right);
            }
            break;
        }

        case "call": {
            // Check constants (zero-arg "calls")
            if (node.args.length === 0 && node.name in CONSTANTS)
                return CONSTANTS[node.name];

            const fn = FUNCTIONS[node.name];
            if (!fn) {
                if (node.name in CONSTANTS)
                    throw new Error(`'${node.name}' is a constant — don't use parentheses`);
                throw new Error(`Unknown function: '${node.name}'`);
            }

            const args = node.args.map(evaluate);
            return fn(...args);
        }

        case "factorial":
            return factorial(evaluate(node.operand));
    }
}

// ── Stringify (AST → string) ─────────────────────────────────

function opPrecedence(op: string): number {
    switch (op) {
        case "+": case "-": return 1;
        case "*": case "/": case "%": return 2;
        case "^": return 3;
        default: return 0;
    }
}

function childNeedsParens(child: ASTNode, parentOp: string, isRight: boolean): boolean {
    if (child.kind !== "binary") return false;
    const cp = opPrecedence(child.op);
    const pp = opPrecedence(parentOp);
    if (cp < pp) return true;
    if (cp === pp) {
        if (isRight && (parentOp === "-" || parentOp === "/" || parentOp === "%")) return true;
        if (!isRight && parentOp === "^") return true;
    }
    return false;
}

function stringify(node: ASTNode): string {
    switch (node.kind) {
        case "number":
            return formatResult(node.value);
        case "unary": {
            const inner = stringify(node.operand);
            return node.operand.kind === "binary" ? `${node.op}(${inner})` : `${node.op}${inner}`;
        }
        case "binary": {
            const l = childNeedsParens(node.left, node.op, false) ? `(${stringify(node.left)})` : stringify(node.left);
            const r = childNeedsParens(node.right, node.op, true) ? `(${stringify(node.right)})` : stringify(node.right);
            const op = node.op === "*" ? "\\*" : node.op;
            return `${l} ${op} ${r}`;
        }
        case "call":
            if (node.args.length === 0 && node.name in CONSTANTS) return node.name;
            return `${node.name}(${node.args.map(a => stringify(a)).join(", ")})`;
        case "factorial": {
            const inner = stringify(node.operand);
            return (node.operand.kind === "binary" || node.operand.kind === "unary") ? `(${inner})!` : `${inner}!`;
        }
    }
}

// ── Step-by-step reducer ─────────────────────────────────────

function isValue(node: ASTNode): boolean {
    return node.kind === "number" || (node.kind === "call" && node.args.length === 0 && node.name in CONSTANTS);
}

function reduceOneStep(node: ASTNode): ASTNode | null {
    if (isValue(node)) return null;

    switch (node.kind) {
        case "number": return null;

        case "unary": {
            if (isValue(node.operand)) return { kind: "number", value: evaluate(node) };
            const r = reduceOneStep(node.operand);
            return r ? { kind: "unary", op: node.op, operand: r } : null;
        }

        case "binary": {
            if (!isValue(node.left)) {
                const r = reduceOneStep(node.left);
                if (r) return { kind: "binary", op: node.op, left: r, right: node.right };
            }
            if (!isValue(node.right)) {
                const r = reduceOneStep(node.right);
                if (r) return { kind: "binary", op: node.op, left: node.left, right: r };
            }
            if (isValue(node.left) && isValue(node.right))
                return { kind: "number", value: evaluate(node) };
            return null;
        }

        case "call": {
            for (let i = 0; i < node.args.length; i++) {
                if (!isValue(node.args[i])) {
                    const r = reduceOneStep(node.args[i]);
                    if (r) {
                        const newArgs = [...node.args];
                        newArgs[i] = r;
                        return { kind: "call", name: node.name, args: newArgs };
                    }
                }
            }
            if (node.args.every(isValue))
                return { kind: "number", value: evaluate(node) };
            return null;
        }

        case "factorial": {
            if (isValue(node.operand)) return { kind: "number", value: evaluate(node) };
            const r = reduceOneStep(node.operand);
            return r ? { kind: "factorial", operand: r } : null;
        }
    }
}

// ── Public API ───────────────────────────────────────────────

export function calculate(expression: string): number {
    const tokens = tokenize(expression);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    return evaluate(ast);
}

export function formatResult(result: number): string {
    return Number.isInteger(result) ? result.toString() : result.toPrecision(15).replace(/\.?0+$/, "");
}

export function calculateWithSteps(expression: string): string {
    const tokens = tokenize(expression);
    const parser = new Parser(tokens);
    let ast = parser.parse();

    const steps: string[] = [expression.trim()];

    for (let i = 0; i < 100; i++) {
        const reduced = reduceOneStep(ast);
        if (!reduced) break;
        ast = reduced;
        const step = stringify(ast);
        // Avoid duplicate steps
        if (step !== steps[steps.length - 1]) steps.push(step);
    }

    return steps.join(" = ");
}
