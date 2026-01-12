/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Button, ColorPicker } from "@webpack/common";

import fathorse from "./fathorse";
import oneko from "./oneko";

const ONEKO_IMAGE = "https://raw.githubusercontent.com/adryd325/oneko.js/5281d057c4ea9bd4f6f997ee96ba30491aed16c0/oneko.gif";
const FATASS_HORSE_IMAGE = "https://raw.githubusercontent.com/nexpid/fatass-horse/08bc4042750d5f995c55327f7b6c6710158f5263/sheet.png";

function OnekoColorSettings() {
    const { furColor, outlineColor } = settings.use(["furColor", "outlineColor"]);

    const parseHexToNumber = (hex: string): number | null => {
        if (!hex || typeof hex !== "string") return null;
        const cleanHex = hex.replace(/^#/, "");
        if (cleanHex.length !== 6) return null;
        const num = parseInt(cleanHex, 16);
        return isNaN(num) ? null : num;
    };

    const formatNumberToHex = (num: number | null): string => {
        if (num === null) return "#FFFFFF";
        return "#" + num.toString(16).padStart(6, "0").toUpperCase();
    };

    const handleFurColorChange = (value: number | null) => {
        const hex = formatNumberToHex(value);
        settings.store.furColor = hex;
        load();
    };

    const handleOutlineColorChange = (value: number | null) => {
        const hex = formatNumberToHex(value);
        settings.store.outlineColor = hex;
        load();
    };

    return (
        <div>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginTop: "10px" }}>
                <div>
                    <Heading className="form-subtitle">Fur Color</Heading>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <ColorPicker
                            color={parseHexToNumber(furColor)}
                            onChange={handleFurColorChange}
                            showEyeDropper={true}
                        />
                        <Button
                            className="button button-blue"
                            onClick={() => handleFurColorChange(parseHexToNumber("#FFFFFF"))}
                        >
                            Default
                        </Button>
                    </div>
                </div>

                <div>
                    <Heading className="form-subtitle">Outline Color</Heading>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <ColorPicker
                            color={parseHexToNumber(outlineColor)}
                            onChange={handleOutlineColorChange}
                            showEyeDropper={true}
                        />
                        <Button
                            className="button button-blue"
                            onClick={() => handleOutlineColorChange(parseHexToNumber("#000000"))}
                        >
                            Default
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

const settings = definePluginSettings({
    buddy: {
        description: "Pick a cursor buddy",
        type: OptionType.SELECT,
        options: [
            {
                label: "Oneko",
                value: "oneko",
                default: true
            },
            {
                label: "Fatass Horse",
                value: "fathorse"
            }
        ],
        onChange: load,
    },
    speed: {
        description: "Speed of your buddy",
        type: OptionType.NUMBER,
        default: 10,
        isValid: (value: number) => value >= 0 || "Speed must be bigger than 0",
        onChange: load,
    },
    fps: {
        description: "Framerate of your buddy",
        type: OptionType.NUMBER,
        default: 24,
        isValid: (value: number) => value > 0 || "Framerate must be bigger than 0",
        onChange: load
    },
    // Oneko Specific
    onekoSection: {
        type: OptionType.COMPONENT,
        component: () => (
            <div>
                <Heading style={{ fontSize: "1.6em", marginTop: "10px" }}>Oneko</Heading>
                <Divider style={{ marginBottom: "-10px" }}></Divider>
            </div>
        ),
    },
    onekoColorSettings: {
        type: OptionType.COMPONENT,
        component: OnekoColorSettings,
    },
    furColor: {
        description: "Fur hex color for Oneko",
        type: OptionType.STRING,
        default: "#FFFFFF",
        onChange: load,
        hidden: true,
    },
    outlineColor: {
        description: "Outline hex color for Oneko",
        type: OptionType.STRING,
        default: "#000000",
        onChange: load,
        hidden: true,
    },
    // Fatass Horse Specific
    fathorseSection: {
        type: OptionType.COMPONENT,
        component: () => (
            <div>
                <Heading style={{ fontSize: "1.6em", marginTop: "10px" }}>Fatass Horse</Heading>
                <Divider style={{ marginBottom: "-10px" }}></Divider>
            </div>
        ),
    },
    size: {
        description: "Size of the fatass horse",
        type: OptionType.NUMBER,
        default: 120,
        isValid: (value: number) => value > 0 || "Size must be bigger than 0",
        onChange: load
    },
    fade: {
        description: "If the horse should fade when the cursor is near",
        type: OptionType.BOOLEAN,
        default: true,
        onChange: load
    },
    freeroam: {
        description: "If the horse should roam freely when idle",
        type: OptionType.BOOLEAN,
        default: true,
        onChange: load
    },
    shake: {
        description: "If the horse should shake the window when it's walking",
        type: OptionType.BOOLEAN,
        default: false,
        onChange: load,
    },
}, {
    // Oneko Specific
    furColor: {
        disabled() { return this.store.buddy !== "oneko"; }
    },
    outlineColor: {
        disabled() { return this.store.buddy !== "oneko"; }
    },
    // Fatass Horse Specific
    size: {
        disabled() { return this.store.buddy !== "fathorse"; },
    },
    fade: {
        disabled() { return this.store.buddy !== "fathorse"; },
    },
    freeroam: {
        disabled() { return this.store.buddy !== "fathorse"; },
    },
    shake: {
        disabled() { return this.store.buddy !== "fathorse"; },
    }
});

function unload() {
    document.getElementById("oneko")?.remove();
    document.getElementById("fathorse")?.remove();
}

function load() {
    if (!isPluginEnabled("CursorBuddy")) return;
    unload();

    switch (settings.store.buddy) {
        case "oneko": {
            oneko({
                speed: settings.store.speed,
                fps: settings.store.fps,
                image: ONEKO_IMAGE,
                persistPosition: false,
                furColor: settings.store.furColor,
                outlineColor: settings.store.outlineColor
            });
            break;
        }
        case "fathorse": {
            fathorse({
                speed: settings.store.speed,
                fps: settings.store.fps,
                size: settings.store.size,
                fade: settings.store.fade,
                freeroam: settings.store.freeroam,
                shake: settings.store.shake,
                image: FATASS_HORSE_IMAGE
            });
        }
    }
}

migratePluginSettings("CursorBuddy", "Oneko", "oneko");
export default definePlugin({
    name: "CursorBuddy",
    description: "only a slightly annoying plugin",
    authors: [Devs.Ven, Devs.adryd, EquicordDevs.nexpid, EquicordDevs.ZcraftElite],
    tags: ["Oneko", "FatassHorse", "Pet"],
    settings,
    isModified: true,

    start: load,
    stop: unload,
});
