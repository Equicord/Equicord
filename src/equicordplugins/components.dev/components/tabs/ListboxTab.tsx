/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ListboxItem, ManaListbox, useState } from "..";
import { DocPage, type PropDef, type PropGroup } from "../DocPage";

const LISTBOX_PROPS: PropDef[] = [
    { name: "items", type: "ListboxItem[]", required: true, description: "Array of items to display in the listbox." },
    { name: "selectedItems", type: "ListboxItem[]", description: "Currently selected items (controlled)." },
    { name: "defaultSelectedItems", type: "ListboxItem[]", description: "Initially selected items (uncontrolled)." },
    { name: "onSelectionChange", type: "(items: ListboxItem[]) => void", description: "Called when the selection changes." },
    { name: "selectionMode", type: '"single" | "multiple"', description: "Whether one or many items can be selected." },
    { name: "disabled", type: "boolean", default: "false", description: "Disable the entire listbox." },
    { name: "required", type: "boolean", description: "Mark the listbox as required for form validation." },
    { name: "loading", type: "boolean", default: "false", description: "Show a loading state." },
    { name: "maxVisibleItems", type: "number", description: "Maximum items visible before scrolling." },
    { name: "shouldFocusWrap", type: "boolean", description: "Wrap keyboard focus when reaching the end." },
    { name: "typeahead", type: "boolean", description: "Enable keyboard search by typing item labels." },
    { name: "renderListItem", type: "(item: ListboxItem) => ReactNode", description: "Custom render function for list items." },
    { name: "renderEmptyState", type: "() => ReactNode", description: "Custom render for the empty state." },
];

const ITEM_PROPS: PropDef[] = [
    { name: "id", type: "string", required: true, description: "Unique identifier for the item." },
    { name: "label", type: "string", required: true, description: "Display label for the item." },
    { name: "disabled", type: "boolean", description: "Disable this specific item." },
];

const PROP_GROUPS: PropGroup[] = [
    { title: "ManaListbox", props: LISTBOX_PROPS },
    { title: "ListboxItem", props: ITEM_PROPS },
];

const SAMPLE_ITEMS: ListboxItem[] = [
    { id: "1", label: "Apple" },
    { id: "2", label: "Banana" },
    { id: "3", label: "Cherry" },
    { id: "4", label: "Date" },
    { id: "5", label: "Elderberry" },
];

const ITEMS_WITH_DISABLED: ListboxItem[] = [
    { id: "1", label: "Available option" },
    { id: "2", label: "Disabled option", disabled: true },
    { id: "3", label: "Another available" },
    { id: "4", label: "Also disabled", disabled: true },
    { id: "5", label: "Last option" },
];

const MANY_ITEMS: ListboxItem[] = Array.from({ length: 10 }, (_, i) => ({
    id: String(i + 1),
    label: `Item ${i + 1}`,
}));

function SingleSelectDemo() {
    const [selected, setSelected] = useState<ListboxItem[]>([SAMPLE_ITEMS[0]]);
    return (
        <ManaListbox
            items={SAMPLE_ITEMS}
            selectedItems={selected}
            onSelectionChange={setSelected}
            selectionMode="single"
        />
    );
}

function MultiSelectDemo() {
    const [selected, setSelected] = useState<ListboxItem[]>([SAMPLE_ITEMS[0], SAMPLE_ITEMS[2]]);
    return (
        <ManaListbox
            items={SAMPLE_ITEMS}
            selectedItems={selected}
            onSelectionChange={setSelected}
            selectionMode="multiple"
        />
    );
}

function DisabledItemsDemo() {
    const [selected, setSelected] = useState<ListboxItem[]>([]);
    return (
        <ManaListbox
            items={ITEMS_WITH_DISABLED}
            selectedItems={selected}
            onSelectionChange={setSelected}
            selectionMode="multiple"
        />
    );
}

function MaxVisibleDemo() {
    const [selected, setSelected] = useState<ListboxItem[]>([]);
    return (
        <ManaListbox
            items={MANY_ITEMS}
            selectedItems={selected}
            onSelectionChange={setSelected}
            selectionMode="multiple"
            maxVisibleItems={5}
        />
    );
}

export default function ListboxTab() {
    return (
        <DocPage
            componentName="ManaListbox"
            overview="ManaListbox is Discord's listbox component for selecting one or multiple items from a list. Supports single and multiple selection modes, disabled items, loading/empty states, keyboard navigation with typeahead, and custom item rendering."
            importPath={'import { ManaListbox, ListboxItem } from "../components";'}
            sections={[
                {
                    title: "Single Selection",
                    description: "Only one item can be selected at a time.",
                    children: <SingleSelectDemo />,
                    code: `<ManaListbox
  items={items}
  selectedItems={selected}
  onSelectionChange={setSelected}
  selectionMode="single"
/>`,
                    relevantProps: ["selectionMode", "selectedItems", "onSelectionChange"],
                },
                {
                    title: "Multiple Selection",
                    description: "Multiple items can be selected simultaneously.",
                    children: <MultiSelectDemo />,
                    code: `<ManaListbox
  items={items}
  selectedItems={selected}
  onSelectionChange={setSelected}
  selectionMode="multiple"
/>`,
                },
                {
                    title: "Disabled Items",
                    description: "Individual items can be disabled while the rest remain interactive.",
                    children: <DisabledItemsDemo />,
                },
                {
                    title: "Max Visible Items",
                    description: "Limits visible items to 5 with scrolling for the rest.",
                    children: <MaxVisibleDemo />,
                    relevantProps: ["maxVisibleItems"],
                },
                {
                    title: "Disabled State",
                    description: "The entire listbox is non-interactive when disabled.",
                    children: (
                        <ManaListbox
                            items={SAMPLE_ITEMS}
                            selectedItems={[SAMPLE_ITEMS[1]]}
                            disabled
                        />
                    ),
                    relevantProps: ["disabled"],
                },
                {
                    title: "Loading State",
                    description: "Shows a loading indicator while data is being fetched.",
                    children: <ManaListbox items={[]} loading />,
                    relevantProps: ["loading"],
                },
                {
                    title: "Empty State",
                    description: "Default empty appearance when no items are provided.",
                    children: <ManaListbox items={[]} />,
                },
            ]}
            props={PROP_GROUPS}
        />
    );
}
