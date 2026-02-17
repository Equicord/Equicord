/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph, TabBar, useState } from "..";
import { DocPage, type PropDef, type PropGroup } from "../DocPage";

const TABBAR_PROPS: PropDef[] = [
    { name: "type", type: '"side" | "top" | "top-pill"', description: "Tab bar visual style." },
    { name: "look", type: '"brand" | "grey"', description: "Color scheme." },
    { name: "selectedItem", type: "string", description: "ID of the currently selected tab." },
    { name: "onItemSelect", type: "(id: string) => void", description: "Called when a tab is selected." },
    { name: "orientation", type: '"horizontal" | "vertical"', description: "Layout direction." },
    { name: "className", type: "string", description: "Custom CSS class." },
    { name: "style", type: "CSSProperties", description: "Inline styles." },
    { name: "aria-label", type: "string", description: "Accessibility label." },
];

const ITEM_PROPS: PropDef[] = [
    { name: "id", type: "string", required: true, description: "Unique tab identifier." },
    { name: "children", type: "ReactNode", required: true, description: "Tab label content." },
    { name: "disabled", type: "boolean", description: "Disable the tab." },
    { name: "color", type: "string", description: "Custom tab color (hex or CSS color)." },
    { name: "variant", type: '"destructive"', description: "Danger styling for actions like logout." },
    { name: "disableItemStyles", type: "boolean", description: "Remove default tab styles." },
    { name: "onClick", type: "MouseEventHandler", description: "Custom click handler." },
];

const PROP_GROUPS: PropGroup[] = [
    { title: "TabBar", props: TABBAR_PROPS },
    { title: "TabBar.Item", props: ITEM_PROPS },
];

function SideDemo() {
    const [tab, setTab] = useState("tab1");
    return (
        <div>
            <Paragraph color="text-muted" style={{ marginBottom: 4 }}>Selected: {tab}</Paragraph>
            <TabBar type="side" look="grey" selectedItem={tab} onItemSelect={setTab}>
                <TabBar.Item id="tab1">First Tab</TabBar.Item>
                <TabBar.Item id="tab2">Second Tab</TabBar.Item>
                <TabBar.Item id="tab3">Third Tab</TabBar.Item>
            </TabBar>
        </div>
    );
}

function TopDemo() {
    const [tab, setTab] = useState("tab1");
    return (
        <TabBar type="top" look="grey" selectedItem={tab} onItemSelect={setTab}>
            <TabBar.Item id="tab1">Overview</TabBar.Item>
            <TabBar.Item id="tab2">Settings</TabBar.Item>
            <TabBar.Item id="tab3">Members</TabBar.Item>
        </TabBar>
    );
}

function TopPillDemo() {
    const [tab, setTab] = useState("tab1");
    return (
        <TabBar type="top-pill" look="grey" selectedItem={tab} onItemSelect={setTab}>
            <TabBar.Item id="tab1">All</TabBar.Item>
            <TabBar.Item id="tab2">Online</TabBar.Item>
            <TabBar.Item id="tab3">Pending</TabBar.Item>
            <TabBar.Item id="tab4">Blocked</TabBar.Item>
        </TabBar>
    );
}

function BrandDemo() {
    const [tab, setTab] = useState("tab1");
    return (
        <TabBar type="top" look="brand" selectedItem={tab} onItemSelect={setTab}>
            <TabBar.Item id="tab1">Home</TabBar.Item>
            <TabBar.Item id="tab2">Explore</TabBar.Item>
            <TabBar.Item id="tab3">Library</TabBar.Item>
        </TabBar>
    );
}

function HeaderSeparatorDemo() {
    const [tab, setTab] = useState("tab1");
    return (
        <TabBar type="side" look="grey" selectedItem={tab} onItemSelect={setTab}>
            <TabBar.Header>User Settings</TabBar.Header>
            <TabBar.Item id="tab1">My Account</TabBar.Item>
            <TabBar.Item id="tab2">Privacy</TabBar.Item>
            <TabBar.Separator />
            <TabBar.Header>App Settings</TabBar.Header>
            <TabBar.Item id="tab3">Appearance</TabBar.Item>
            <TabBar.Item id="tab4">Notifications</TabBar.Item>
        </TabBar>
    );
}

function FeaturesDemo() {
    const [tab, setTab] = useState("tab1");
    const [colorTab, setColorTab] = useState("tab1");

    return (
        <div className="vc-compfinder-grid-vertical">
            <div>
                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>Disabled items:</Paragraph>
                <TabBar type="top" look="grey" selectedItem={tab} onItemSelect={setTab}>
                    <TabBar.Item id="tab1">Active</TabBar.Item>
                    <TabBar.Item id="tab2" disabled>Disabled</TabBar.Item>
                    <TabBar.Item id="tab3">Another Active</TabBar.Item>
                </TabBar>
            </div>
            <div>
                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>Custom colors:</Paragraph>
                <TabBar type="top" look="grey" selectedItem={colorTab} onItemSelect={setColorTab}>
                    <TabBar.Item id="tab1" color="#43b581">Green</TabBar.Item>
                    <TabBar.Item id="tab2" color="#faa61a">Yellow</TabBar.Item>
                    <TabBar.Item id="tab3" color="#f04747">Red</TabBar.Item>
                </TabBar>
            </div>
            <div>
                <Paragraph color="text-muted" style={{ marginBottom: 4 }}>Destructive variant:</Paragraph>
                <TabBar type="side" look="grey" selectedItem={tab} onItemSelect={setTab}>
                    <TabBar.Item id="tab1">Settings</TabBar.Item>
                    <TabBar.Item id="logout" variant="destructive">Log Out</TabBar.Item>
                </TabBar>
            </div>
        </div>
    );
}

export default function TabBarTab() {
    return (
        <DocPage
            componentName="TabBar"
            overview="TabBar provides navigation tabs in three styles: side (vertical sidebar), top (horizontal with underline), and top-pill (horizontal pill buttons). Supports brand/grey color schemes, disabled items, custom colors, destructive variants, and section headers with separators."
            importPath={'import { TabBar } from "../components";'}
            sections={[
                {
                    title: "Side (Default)",
                    description: "Vertical sidebar-style tabs with grey look.",
                    children: <SideDemo />,
                    code: `<TabBar type="side" look="grey" selectedItem={tab} onItemSelect={setTab}>
  <TabBar.Item id="tab1">First Tab</TabBar.Item>
  <TabBar.Item id="tab2">Second Tab</TabBar.Item>
</TabBar>`,
                    relevantProps: ["type", "look", "selectedItem", "onItemSelect"],
                },
                {
                    title: "Top",
                    description: "Horizontal tabs with underline indicator.",
                    children: <TopDemo />,
                },
                {
                    title: "Top Pill",
                    description: "Pill-style horizontal tabs.",
                    children: <TopPillDemo />,
                },
                {
                    title: "Brand Look",
                    description: "Brand-colored tab styling.",
                    children: <BrandDemo />,
                },
                {
                    title: "Headers and Separators",
                    description: "TabBar.Header and TabBar.Separator for organizing groups of tabs.",
                    children: <HeaderSeparatorDemo />,
                },
                {
                    title: "Disabled, Colors, Destructive",
                    description: "Items can be disabled, colored, or styled as destructive.",
                    children: <FeaturesDemo />,
                    relevantProps: ["disabled", "color", "variant"],
                },
            ]}
            props={PROP_GROUPS}
        />
    );
}
