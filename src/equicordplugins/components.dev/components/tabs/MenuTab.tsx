/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, ContextMenuApi, Menu, useState } from "..";
import { DocPage, type PropDef, type PropGroup } from "../DocPage";

const MENU_PROPS: PropDef[] = [
    { name: "navId", type: "string", required: true, description: "Unique navigation ID for the menu." },
    { name: "onClose", type: "() => void", required: true, description: "Called when the menu should close." },
    { name: "children", type: "ReactNode", required: true, description: "Menu items, groups, and separators." },
];

const MENUITEM_PROPS: PropDef[] = [
    { name: "id", type: "string", required: true, description: "Unique item identifier." },
    { name: "label", type: "ReactNode | ((props) => ReactNode)", required: true, description: "Display text for the item." },
    { name: "action", type: "(e: MouseEvent) => void", description: "Called when the item is clicked." },
    { name: "icon", type: "ComponentType", description: "Icon component displayed after the label." },
    { name: "iconLeft", type: "ComponentType", description: "Icon component displayed before the label." },
    { name: "iconProps", type: "MenuItemIconProps", description: "Props passed to the icon component." },
    { name: "leadingAccessory", type: "ReactNode", description: "Custom leading accessory element." },
    { name: "trailingIndicator", type: "ReactNode", description: "Trailing indicator element." },
    { name: "hint", type: "ReactNode | ((props) => ReactNode)", description: "Keyboard shortcut hint displayed on the right." },
    { name: "shortcut", type: "ReactNode", description: "Keyboard shortcut display." },
    { name: "subtext", type: "ReactNode", description: "Secondary text below the label." },
    { name: "subtextLineClamp", type: "number", description: "Max lines for subtext before truncation." },
    { name: "color", type: '"default" | "brand" | "danger" | "success" | "premium" | "premium-gradient"', description: "Item color variant." },
    { name: "loading", type: "boolean", description: "Show loading state." },
    { name: "badge", type: "ReactNode", description: "Badge element displayed alongside the label." },
    { name: "disabled", type: "boolean", description: "Disable interaction." },
    { name: "onClose", type: "() => void", description: "Called when the menu should close after this item's action." },
    { name: "onFocus", type: "() => void", description: "Called when the item receives focus." },
    { name: "dontCloseOnAction", type: "boolean", description: "Prevent menu from closing when this item is clicked." },
    { name: "dontCloseOnActionIfHoldingShiftKey", type: "boolean", description: "Prevent close on click if shift key is held." },
    { name: "className", type: "string", description: "Custom CSS class name." },
    { name: "focusedClassName", type: "string", description: "CSS class applied when focused." },
    { name: "children", type: "ReactNode", description: "Nested MenuItem elements create a submenu." },
];

const CHECKBOX_PROPS: PropDef[] = [
    { name: "id", type: "string", required: true, description: "Unique item identifier." },
    { name: "label", type: "ReactNode | ((props) => ReactNode)", required: true, description: "Display text." },
    { name: "checked", type: "boolean", required: true, description: "Current checked state." },
    { name: "color", type: "MenuItemColor", default: '"default"', description: "Item color variant." },
    { name: "action", type: "(e: MouseEvent) => void", description: "Called when toggled." },
    { name: "disabled", type: "boolean", description: "Disable interaction." },
    { name: "subtext", type: "ReactNode", description: "Secondary text below the label." },
    { name: "subtextLineClamp", type: "number", description: "Max lines for subtext before truncation." },
    { name: "leftIcon", type: "ComponentType", description: "Icon component displayed on the left." },
    { name: "leadingAccessory", type: "ReactNode", description: "Custom leading accessory element." },
    { name: "className", type: "string", description: "Custom CSS class name." },
    { name: "focusedClassName", type: "string", description: "CSS class applied when focused." },
];

const RADIO_PROPS: PropDef[] = [
    { name: "id", type: "string", required: true, description: "Unique item identifier." },
    { name: "label", type: "ReactNode | ((props) => ReactNode)", required: true, description: "Display text." },
    { name: "group", type: "string", required: true, description: "Radio group name for mutual exclusion." },
    { name: "checked", type: "boolean", required: true, description: "Whether this option is selected." },
    { name: "color", type: "MenuItemColor", default: '"default"', description: "Item color variant." },
    { name: "action", type: "(e: MouseEvent) => void", description: "Called when selected." },
    { name: "disabled", type: "boolean", description: "Disable interaction." },
    { name: "subtext", type: "ReactNode", description: "Secondary text below the label." },
    { name: "subtextLineClamp", type: "number", description: "Max lines for subtext before truncation." },
    { name: "leftIcon", type: "ComponentType", description: "Icon component displayed on the left." },
    { name: "leadingAccessory", type: "ReactNode", description: "Custom leading accessory element." },
];

const SLIDER_PROPS: PropDef[] = [
    { name: "minValue", type: "number", required: true, description: "Minimum slider value." },
    { name: "maxValue", type: "number", required: true, description: "Maximum slider value." },
    { name: "value", type: "number", required: true, description: "Current slider value." },
    { name: "onChange", type: "(value: number) => void", required: true, description: "Called when the value changes." },
    { name: "renderValue", type: "(value: number) => string", description: "Format the value label display." },
];

const SWITCH_PROPS: PropDef[] = [
    { name: "id", type: "string", required: true, description: "Unique item identifier." },
    { name: "label", type: "ReactNode", description: "Display text." },
    { name: "checked", type: "boolean", required: true, description: "Current switch state." },
    { name: "action", type: "(e: MouseEvent) => void", required: true, description: "Called when toggled." },
    { name: "color", type: "MenuItemColor", default: '"default"', description: "Item color variant." },
    { name: "disabled", type: "boolean", description: "Disable interaction." },
    { name: "subtext", type: "ReactNode", description: "Secondary text below the label." },
    { name: "subtextLineClamp", type: "number", description: "Max lines for subtext before truncation." },
    { name: "className", type: "string", description: "Custom CSS class name." },
];

const PROP_GROUPS: PropGroup[] = [
    { title: "Menu.Menu", props: MENU_PROPS },
    { title: "Menu.MenuItem", props: MENUITEM_PROPS },
    { title: "Menu.MenuCheckboxItem", props: CHECKBOX_PROPS },
    { title: "Menu.MenuRadioItem", props: RADIO_PROPS },
    { title: "Menu.MenuSwitchItem", props: SWITCH_PROPS },
    { title: "Menu.MenuSliderControl", props: SLIDER_PROPS },
];

function DemoMenu({ onClose }: { onClose: () => void; }) {
    const [checkboxValue, setCheckboxValue] = useState(false);
    const [switchValue, setSwitchValue] = useState(true);
    const [radioValue, setRadioValue] = useState("option1");
    const [sliderValue, setSliderValue] = useState(50);

    return (
        <Menu.Menu navId="demo-menu" onClose={onClose}>
            <Menu.MenuItem id="item-1" label="Basic Item" action={() => { }} />
            <Menu.MenuItem
                id="item-2"
                label="Item with Icon"
                icon={() => (
                    <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                )}
                action={() => { }}
            />
            <Menu.MenuItem id="item-hint" label="Item with Hint" hint="Ctrl+H" action={() => { }} />
            <Menu.MenuItem id="item-subtext" label="Item with Subtext" subtext="Additional description" action={() => { }} />
            <Menu.MenuItem id="item-disabled" label="Disabled Item" disabled />

            <Menu.MenuSeparator />

            <Menu.MenuGroup label="Colors">
                <Menu.MenuItem id="c-default" label="Default" color="default" action={() => { }} />
                <Menu.MenuItem id="c-brand" label="Brand" color="brand" action={() => { }} />
                <Menu.MenuItem id="c-danger" label="Danger" color="danger" action={() => { }} />
                <Menu.MenuItem id="c-success" label="Success" color="success" action={() => { }} />
                <Menu.MenuItem id="c-premium" label="Premium" color="premium" action={() => { }} />
                <Menu.MenuItem id="c-premium-g" label="Premium Gradient" color="premium-gradient" action={() => { }} />
            </Menu.MenuGroup>

            <Menu.MenuSeparator />

            <Menu.MenuCheckboxItem
                id="checkbox"
                label="Checkbox Item"
                checked={checkboxValue}
                action={() => setCheckboxValue(v => !v)}
            />
            <Menu.MenuSwitchItem
                id="switch"
                label="Switch Item"
                checked={switchValue}
                action={() => setSwitchValue(v => !v)}
            />

            <Menu.MenuSeparator />

            <Menu.MenuGroup label="Radio Group">
                <Menu.MenuRadioItem id="r-1" group="demo" label="Option 1" checked={radioValue === "option1"} action={() => setRadioValue("option1")} />
                <Menu.MenuRadioItem id="r-2" group="demo" label="Option 2" checked={radioValue === "option2"} action={() => setRadioValue("option2")} />
                <Menu.MenuRadioItem id="r-3" group="demo" label="Option 3" checked={radioValue === "option3"} action={() => setRadioValue("option3")} />
            </Menu.MenuGroup>

            <Menu.MenuSeparator />

            <Menu.MenuItem id="submenu" label="Submenu">
                <Menu.MenuItem id="sub-1" label="Sub Item 1" action={() => { }} />
                <Menu.MenuItem id="sub-2" label="Sub Item 2" action={() => { }} />
                <Menu.MenuItem id="nested" label="Nested Submenu">
                    <Menu.MenuItem id="nested-1" label="Nested Item" action={() => { }} />
                </Menu.MenuItem>
            </Menu.MenuItem>

            <Menu.MenuSeparator />

            <Menu.MenuControlItem
                id="slider"
                label="Volume"
                control={() => (
                    <Menu.MenuSliderControl
                        minValue={0}
                        maxValue={100}
                        value={sliderValue}
                        onChange={setSliderValue}
                        renderValue={v => `${v}%`}
                    />
                )}
            />
        </Menu.Menu>
    );
}

export default function MenuTab() {
    const openMenu = (e: React.MouseEvent) => {
        ContextMenuApi.openContextMenu(e, () => (
            <DemoMenu onClose={ContextMenuApi.closeContextMenu} />
        ));
    };

    return (
        <DocPage
            componentName="Menu"
            overview="Discord's Menu system provides context menus with items, checkboxes, radio buttons, switches, sliders, submenus, and groups. Open menus with ContextMenuApi.openContextMenu(). The Menu object contains all sub-components: Menu, MenuItem, MenuCheckboxItem, MenuRadioItem, MenuSwitchItem, MenuGroup, MenuSeparator, MenuControlItem, MenuSliderControl, and MenuSearchControl."
            notices={[
                { type: "info", children: "Menus must be opened via ContextMenuApi.openContextMenu(). Set the onClose prop to ContextMenuApi.closeContextMenu to ensure proper cleanup." },
            ]}
            importPath={'import { Menu, ContextMenuApi } from "../components";'}
            sections={[
                {
                    title: "Full Menu Demo",
                    description: "Click or right-click to open a menu showcasing all component types: basic items, icons, hints, subtext, colors, checkboxes, switches, radio groups, submenus, and sliders.",
                    children: (
                        <div className="vc-compfinder-grid">
                            <Button onClick={openMenu}>Open Menu (Click)</Button>
                            <Button variant="secondary" onContextMenu={openMenu}>Open Menu (Right-Click)</Button>
                        </div>
                    ),
                    code: `const openMenu = (e: React.MouseEvent) => {
  ContextMenuApi.openContextMenu(e, () => (
    <Menu.Menu navId="my-menu" onClose={ContextMenuApi.closeContextMenu}>
      <Menu.MenuItem id="item" label="Click me" action={() => { }} />
      <Menu.MenuSeparator />
      <Menu.MenuCheckboxItem id="check" label="Toggle" checked={on} action={() => setOn(!on)} />
    </Menu.Menu>
  ));
};`,
                },
                {
                    title: "MenuItem Colors",
                    description: "Items support color variants: default, brand, danger, success, premium, and premium-gradient. These are visible in the full demo above.",
                    children: (
                        <Button variant="secondary" onClick={openMenu}>
                            Open Menu to See Colors
                        </Button>
                    ),
                    relevantProps: ["color"],
                },
            ]}
            props={PROP_GROUPS}
        />
    );
}
