/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import equicordToolbox from "@equicordplugins/equicordToolbox";
import { OutcordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { MediaEngineStore, Menu } from "@webpack/common";

const VoiceActions = findByPropsLazy("toggleSelfDeaf")
interface IconProps {
    className?: string;
    active: boolean;
    display: "visible" | "crossed"
}

const toggleFakeDeafen = () => {
    const newFakeDeaf = !settings.store.active
    if (MediaEngineStore.isSelfDeaf()) {
        (window as any).__fakeDeafenProgrammatic = true
        VoiceActions.toggleSelfDeaf()
        VoiceActions.toggleSelfDeaf();
        (window as any).__fakeDeafenProgrammatic = false
    }
    settings.store.active = newFakeDeaf
    if (newFakeDeaf && !MediaEngineStore.isSelfDeaf()) {
        (window as any).__fakeDeafenProgrammatic = true
        VoiceActions.toggleSelfDeaf();
        (window as any).__fakeDeafenProgrammatic = false
    }
}

const getDisplay = (active: boolean): IconProps["display"] => {
    if (!MediaEngineStore.isSelfDeaf()) return "visible"
    if (active) return "visible"
    return "crossed"
}

function Icon({ className, active, display }: IconProps) {
    return (
        <svg
            className={className}
            aria-hidden="true"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="none"
            viewBox="0 0 24 24"
        >
            {/* Normal eye */}
            {display === "visible" && <>
                <path
                    fill="currentColor"
                    d="M15.56 11.77c.2-.1.44.02.44.23a4 4 0 1 1-4-4c.21 0 .33.25.23.44a2.5 2.5 0 0 0 3.32 3.32Z"
                ></path>
                <path
                    fill="currentColor"
                    d="M22.89 11.7c.07.2.07.4 0 .6C22.27 13.9 19.1 21 12 21c-7.11 0-10.27-7.11-10.89-8.7a.83.83 0 0 1 0-.6C1.73 10.1 4.9 3 12 3c7.11 0 10.27 7.11 10.89 8.7Zm-4.5-3.62A15.11 15.11 0 0 1 20.85 12c-.38.88-1.18 2.47-2.46 3.92C16.87 17.62 14.8 19 12 19c-2.8 0-4.87-1.38-6.39-3.08A15.11 15.11 0 0 1 3.15 12c.38-.88 1.18-2.47 2.46-3.92C7.13 6.38 9.2 5 12 5c2.8 0 4.87 1.38 6.39 3.08Z"
                    fillRule="evenodd"
                    clipRule="evenodd"
                ></path>
            </>}
            {display === "crossed" && <>
                <path
                    fill="var(--status-danger)"
                    d="M1.3 21.3a1 1 0 1 0 1.4 1.4l20-20a1 1 0 0 0-1.4-1.4l-20 20ZM3.16 16.05c.18.24.53.26.74.05l.72-.72c.18-.18.2-.45.05-.66a15.7 15.7 0 0 1-1.43-2.52.48.48 0 0 1 0-.4c.4-.9 1.18-2.37 2.37-3.72C7.13 6.38 9.2 5 12 5c.82 0 1.58.12 2.28.33.18.05.38 0 .52-.13l.8-.8c.25-.25.18-.67-.15-.79A9.79 9.79 0 0 0 12 3C4.89 3 1.73 10.11 1.11 11.7a.83.83 0 0 0 0 .6c.25.64.9 2.15 2.05 3.75Z"
                ></path>
                <path
                    fill="var(--status-danger)"
                    d="M8.18 10.81c-.13.43.36.65.67.34l2.3-2.3c.31-.31.09-.8-.34-.67a4 4 0 0 0-2.63 2.63ZM12.85 15.15c-.31.31-.09.8.34.67a4.01 4.01 0 0 0 2.63-2.63c.13-.43-.36-.65-.67-.34l-2.3 2.3Z"
                ></path>
                <path
                    fill="var(--status-danger)"
                    d="M9.72 18.67a.52.52 0 0 0-.52.13l-.8.8c-.25.25-.18.67.15.79 1.03.38 2.18.61 3.45.61 7.11 0 10.27-7.11 10.89-8.7a.83.83 0 0 0 0-.6c-.25-.64-.9-2.15-2.05-3.75a.49.49 0 0 0-.74-.05l-.72.72a.51.51 0 0 0-.05.66 15.7 15.7 0 0 1 1.43 2.52c.06.13.06.27 0 .4-.4.9-1.18 2.37-2.37 3.72C16.87 17.62 14.8 19 12 19c-.82 0-1.58-.12-2.28-.33Z"
                ></path>
            </>}
        </svg>
    )
}

function FakeDeafenToggleButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const { location, active } = settings.use(["location", "active"])

    if (location !== "PANEL" && isPluginEnabled(equicordToolbox.name)) return null
    const display = getDisplay(active)

    return (
        <UserAreaButton
            tooltipText={hideTooltips ? void 0 : <>Grey = cant heard<br/>Red = cant hear</>}
            // tooltipText={hideTooltips ? void 0 : enabled ? "Disable Fake Deafen" : "Enable Fake Deafen"}
            icon={<Icon className={iconForeground} active={active} display={display} />}
            role="switch"
            aria-checked={!active}
            redGlow={display === "crossed"}
            plated={nameplate != null}
            onClick={toggleFakeDeafen}
            disabled={!MediaEngineStore.isSelfDeaf()}
        />
    )
}

const settings = definePluginSettings({
    active: {
        type: OptionType.BOOLEAN,
        description: "Enable/Disable the plugin",
        default: false
    },
    location: {
        type: OptionType.SELECT,
        description: "Where to show the fake deafen toggle button",
        options: [
            { label: "Next to Mute/Deafen", value: "PANEL", default: true },
            { label: "Equicord Toolbox", value: "TOOLBOX" }
        ],
        get hidden() {
            return !isPluginEnabled(equicordToolbox.name)
        }
    }
})

export default definePlugin({
    name: "fakeDeafen",
    description: "Allow you to deafen you, but still hear others",
    tags: ["Voice"],
    authors: [OutcordDevs.Out],
    dependencies: ["UserAreaAPI"],

    settings,

    patches: [
        {
            find: "e.setSelfDeaf(t.deaf)",
            replacement: {
                match: /e\.setSelfDeaf\(t\.deaf\)/g,
                replace: "((deafState) => {" +
                    "const isScriptCall = window.__fakeDeafenProgrammatic === true;" +
                    "if (!isScriptCall && !deafState) {" +
                    "   Vencord.Settings.plugins.fakeDeafen.active = false" +
                    "};" +
                    "e.setSelfDeaf(Vencord.Settings.plugins.fakeDeafen.active ? false : deafState)" +
                "})(t.deaf)"
            }
        }
    ],

    userAreaButton: {
        icon: (props) => <Icon active={settings.store.active} display={getDisplay(settings.store.active)} {...props} />,
        render: FakeDeafenToggleButton
    },

    toolboxActions() {
        const { location, active } = settings.use(["location", "active"])

        if (location !== "TOOLBOX") return null

        return (
            <Menu.MenuCheckboxItem
                id="fake-deafen-toggle-toolbox"
                label="Fake Deafen"
                checked={active}
                action={toggleFakeDeafen}
                icon={({ className }) => <Icon className={className} active={active} display={getDisplay(active)} />}
                disabled={!MediaEngineStore.isSelfDeaf()}

                color="brand"
            />
        )
    },
 })
