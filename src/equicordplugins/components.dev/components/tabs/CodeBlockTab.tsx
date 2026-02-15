/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CodeBlock } from "@components/CodeBlock";

import { InlineCode, Paragraph } from "..";
import { DocPage, type PropDef } from "../DocPage";

const CODEBLOCK_PROPS: PropDef[] = [
    { name: "content", type: "string", description: "The code text to render inside the block." },
    { name: "lang", type: "string", required: true, description: "Language identifier for syntax highlighting (e.g. \"tsx\", \"js\", \"css\", \"py\"). Use empty string for no highlighting." },
];

const INLINECODE_PROPS: PropDef[] = [
    { name: "children", type: "ReactNode", required: true, description: "Content to render as inline code." },
];

const JS_EXAMPLE = `function greet(name) {
    return \`Hello, \${name}!\`;
}

console.log(greet("World"));`;

const TS_EXAMPLE = `interface User {
    id: string;
    name: string;
    email?: string;
}

const getUser = (id: string): User => {
    return { id, name: "John" };
};`;

const CSS_EXAMPLE = `.container {
    display: flex;
    gap: 8px;
    padding: 16px;
    background: var(--background-secondary);
    border-radius: 8px;
}`;

const PYTHON_EXAMPLE = `def fibonacci(n: int) -> list[int]:
    if n <= 0:
        return []
    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])
    return sequence[:n]

print(fibonacci(10))`;

const JSON_EXAMPLE = `{
    "name": "equicord",
    "version": "1.0.0",
    "plugins": ["example"],
    "settings": {
        "enabled": true,
        "theme": "dark"
    }
}`;

export default function CodeBlockTab() {
    return (
        <DocPage
            componentName="CodeBlock"
            overview="CodeBlock renders syntax-highlighted code using Discord's built-in markdown parser. InlineCode renders small code snippets inline within text. Both are Vencord components wrapping Discord's markup system."
            importPath={'import { CodeBlock } from "@components/CodeBlock";\nimport { InlineCode } from "../components";'}
            sections={[
                {
                    title: "Inline Code",
                    description: "Small code snippets rendered inline within text.",
                    children: (
                        <>
                            <Paragraph>I really like <InlineCode>cats</InlineCode> so yeah</Paragraph>
                            <Paragraph>Use <InlineCode>console.log()</InlineCode> to debug your code.</Paragraph>
                            <Paragraph>
                                Combine <InlineCode>const</InlineCode> with <InlineCode>let</InlineCode> and
                                use <InlineCode>===</InlineCode> for strict equality.
                            </Paragraph>
                        </>
                    ),
                    code: "<Paragraph>Use <InlineCode>console.log()</InlineCode> to debug.</Paragraph>",
                },
                {
                    title: "JavaScript",
                    children: <CodeBlock content={JS_EXAMPLE} lang="js" />,
                    code: '<CodeBlock content={jsCode} lang="js" />',
                    relevantProps: ["content", "lang"],
                },
                {
                    title: "TypeScript",
                    children: <CodeBlock content={TS_EXAMPLE} lang="ts" />,
                },
                {
                    title: "CSS",
                    children: <CodeBlock content={CSS_EXAMPLE} lang="css" />,
                },
                {
                    title: "Python",
                    children: <CodeBlock content={PYTHON_EXAMPLE} lang="py" />,
                },
                {
                    title: "JSON",
                    children: <CodeBlock content={JSON_EXAMPLE} lang="json" />,
                },
                {
                    title: "Plain Text",
                    description: "Use an empty string for lang to render without syntax highlighting.",
                    children: <CodeBlock content={"This is plain text\nwithout any syntax highlighting."} lang="" />,
                    code: '<CodeBlock content="plain text" lang="" />',
                },
            ]}
            props={[
                { title: "CodeBlock", props: CODEBLOCK_PROPS },
                { title: "InlineCode", props: INLINECODE_PROPS },
            ]}
        />
    );
}
