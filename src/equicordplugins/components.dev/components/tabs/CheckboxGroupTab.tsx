/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CheckboxGroupOption, ManaCheckboxGroup, useState } from "..";
import { DocPage, type PropDef } from "../DocPage";
import { EquicordIcon } from "../icons/EquicordIcon";

const BASIC_OPTIONS: CheckboxGroupOption[] = [
    { value: "option1", label: "Option 1" },
    { value: "option2", label: "Option 2" },
    { value: "option3", label: "Option 3" },
];

const OPTIONS_WITH_DESCRIPTIONS: CheckboxGroupOption[] = [
    { value: "notifications", label: "Notifications", description: "Receive push notifications" },
    { value: "sounds", label: "Sounds", description: "Play sounds for events" },
    { value: "badges", label: "Badges", description: "Show unread badges" },
];

const OPTIONS_WITH_ICONS: CheckboxGroupOption[] = [
    { value: "item1", label: "Item with icon", description: "This option has an icon", leadingIcon: EquicordIcon },
    { value: "item2", label: "Another with icon", leadingIcon: EquicordIcon },
    { value: "item3", label: "Third with icon", leadingIcon: EquicordIcon },
];

const OPTIONS_MIXED: CheckboxGroupOption[] = [
    { value: "enabled", label: "Enabled option" },
    { value: "disabled", label: "Disabled option", disabled: true },
    { value: "another", label: "Another enabled" },
];

const GROUP_PROPS: PropDef[] = [
    { name: "options", type: "CheckboxGroupOption[]", required: true, description: "Array of checkbox options to render." },
    { name: "selectedValues", type: "(string | number)[]", required: true, description: "Currently selected option values." },
    { name: "onChange", type: "(values: (string | number)[]) => void", description: "Called with the updated selection array when any checkbox is toggled." },
    { name: "disabled", type: "boolean", default: "false", description: "Disables the entire group. Individual option disabled flags still apply." },
    { name: "label", type: "string", description: "Field label displayed above the group." },
    { name: "hideLabel", type: "boolean", description: "Visually hides the label while keeping it accessible." },
    { name: "badge", type: "ReactNode", description: "Badge element displayed next to the label." },
    { name: "icon", type: "ReactNode", description: "Icon element displayed next to the label." },
    { name: "required", type: "boolean", description: "Marks the field as required." },
    { name: "description", type: "string", description: "Description text displayed below the label." },
    { name: "helperText", type: "string", description: "Helper text displayed below the group." },
    { name: "errorMessage", type: "string", description: "Error message displayed below the group." },
    { name: "successMessage", type: "string", description: "Success message displayed below the group." },
    { name: "id", type: "string", description: "Custom ID for the control element." },
    { name: "layout", type: "string", description: "Field layout variant." },
    { name: "layoutConfig", type: "Record<string, unknown>", description: "Configuration for the field layout." },
];

const OPTION_PROPS: PropDef[] = [
    { name: "value", type: "string | number", required: true, description: "Unique identifier for this option." },
    { name: "label", type: "string", required: true, description: "Label text displayed next to the checkbox." },
    { name: "description", type: "string", description: "Description text below the label." },
    { name: "disabled", type: "boolean", description: "Disables this individual option." },
    { name: "leadingIcon", type: "ComponentType<any>", description: "Icon component displayed before the checkbox." },
];

function BasicDemo() {
    const [selected, setSelected] = useState<(string | number)[]>(["option1"]);
    return <ManaCheckboxGroup options={BASIC_OPTIONS} selectedValues={selected} onChange={setSelected} />;
}

function DescriptionDemo() {
    const [selected, setSelected] = useState<(string | number)[]>(["notifications", "sounds"]);
    return <ManaCheckboxGroup options={OPTIONS_WITH_DESCRIPTIONS} selectedValues={selected} onChange={setSelected} />;
}

function IconDemo() {
    const [selected, setSelected] = useState<(string | number)[]>(["item1"]);
    return <ManaCheckboxGroup options={OPTIONS_WITH_ICONS} selectedValues={selected} onChange={setSelected} />;
}

function MixedDemo() {
    const [selected, setSelected] = useState<(string | number)[]>(["enabled"]);
    return <ManaCheckboxGroup options={OPTIONS_MIXED} selectedValues={selected} onChange={setSelected} />;
}

export default function CheckboxGroupTab() {
    return (
        <DocPage
            componentName="ManaCheckboxGroup"
            overview="ManaCheckboxGroup renders a group of checkboxes from an options array with multi-select state management. Each option supports labels, descriptions, icons, and individual disabled state. The group can also be disabled entirely."
            notices={[
                { type: "info", children: "CheckboxGroup manages multi-select state internally by delegating to individual ManaCheckbox instances. Use this instead of manually rendering multiple checkboxes when you need shared state tracking." },
            ]}
            importPath={'import { ManaCheckboxGroup } from "../components";'}
            sections={[
                {
                    title: "Basic",
                    description: "Simple group with three options.",
                    children: <BasicDemo />,
                    code: '<ManaCheckboxGroup\n  options={[\n    { value: "a", label: "Option A" },\n    { value: "b", label: "Option B" },\n  ]}\n  selectedValues={selected}\n  onChange={setSelected}\n/>',
                    relevantProps: ["options", "selectedValues", "onChange"],
                },
                {
                    title: "With Descriptions",
                    description: "Each option can have a description below its label.",
                    children: <DescriptionDemo />,
                },
                {
                    title: "With Leading Icons",
                    description: "Options can display an icon component before the checkbox.",
                    children: <IconDemo />,
                },
                {
                    title: "With Disabled Option",
                    description: "Individual options can be disabled while others remain interactive.",
                    children: <MixedDemo />,
                },
                {
                    title: "Entire Group Disabled",
                    description: "The disabled prop on the group disables all options.",
                    children: (
                        <ManaCheckboxGroup
                            options={BASIC_OPTIONS}
                            selectedValues={["option1", "option2"]}
                            disabled
                        />
                    ),
                    relevantProps: ["disabled"],
                },
            ]}
            props={[
                { title: "ManaCheckboxGroup", props: GROUP_PROPS },
                { title: "CheckboxGroupOption", props: OPTION_PROPS },
            ]}
        />
    );
}
