/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { SearchBar, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";

const SEARCHBAR_PROPS: PropDef[] = [
    { name: "query", type: "string", required: true, description: "Current search query value." },
    { name: "onChange", type: "(value: string) => void", required: true, description: "Called when the query text changes." },
    { name: "onClear", type: "() => void", description: "Called when the clear button is clicked." },
    { name: "placeholder", type: "string", description: "Placeholder text when empty." },
    { name: "size", type: '"sm" | "md"', description: "Input size variant." },
    { name: "autoFocus", type: "boolean", description: "Focus the input on mount." },
    { name: "disabled", type: "boolean", default: "false", description: "Disable the search bar." },
    { name: "onKeyDown", type: "(e: KeyboardEvent) => void", description: "Keyboard event handler." },
    { name: "onBlur", type: "() => void", description: "Called when the input loses focus." },
    { name: "onFocus", type: "() => void", description: "Called when the input gains focus." },
    { name: "autoComplete", type: "string", description: "HTML autocomplete attribute value." },
    { name: "inputProps", type: "Record<string, any>", description: "Additional props passed to the underlying input element." },
    { name: "className", type: "string", description: "Custom CSS class." },
    { name: "aria-label", type: "string", description: "Accessibility label." },
];

function BasicDemo() {
    const [query, setQuery] = useState("");
    return (
        <SearchBar
            query={query}
            onChange={setQuery}
            onClear={() => setQuery("")}
            placeholder="Search..."
        />
    );
}

function SizesDemo() {
    const [query, setQuery] = useState("");
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SearchBar query={query} onChange={setQuery} onClear={() => setQuery("")} placeholder="Small size" size="sm" />
            <SearchBar query={query} onChange={setQuery} onClear={() => setQuery("")} placeholder="Medium size (default)" size="md" />
        </div>
    );
}

function StatesDemo() {
    const [prefilled, setPrefilled] = useState("prefilled");
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <SearchBar query="" onChange={() => { }} placeholder="Disabled" disabled />
            <SearchBar query={prefilled} onChange={setPrefilled} onClear={() => setPrefilled("")} placeholder="Prefilled" />
        </div>
    );
}

export default function SearchBarTab() {
    return (
        <DocPage
            componentName="SearchBar"
            overview="SearchBar is Discord's search input component with a built-in search icon, clearable button, and two size variants. Used throughout Discord for filtering and searching content."
            importPath={'import { SearchBar } from "../components";'}
            sections={[
                {
                    title: "Basic",
                    description: "Default search bar with clear button.",
                    children: <BasicDemo />,
                    code: `<SearchBar
  query={query}
  onChange={setQuery}
  onClear={() => setQuery("")}
  placeholder="Search..."
/>`,
                    relevantProps: ["query", "onChange", "onClear", "placeholder"],
                },
                {
                    title: "Sizes",
                    description: "Available in sm and md (default) sizes.",
                    children: <SizesDemo />,
                    relevantProps: ["size"],
                },
                {
                    title: "States",
                    description: "Disabled and prefilled states.",
                    children: <StatesDemo />,
                    relevantProps: ["disabled"],
                },
            ]}
            props={SEARCHBAR_PROPS}
        />
    );
}
