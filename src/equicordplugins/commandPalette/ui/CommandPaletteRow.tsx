/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CogWheel, ColorPaletteIcon, CopyIcon, FolderIcon, LinkIcon, MagnifyingGlassIcon, MainSettingsIcon, Microphone, NotesIcon, OpenExternalIcon, PluginIcon, RestartIcon, SafetyIcon, UpdaterIcon, WarningIcon } from "@components/Icons";

import type { PaletteCandidate } from "./types";

interface CommandPaletteRowProps {
    item: PaletteCandidate;
    selected: boolean;
    onClick(): void;
    onDoubleClick?(): void;
    onHover(): void;
}

export function CommandPaletteRow({ item, selected, onClick, onDoubleClick, onHover }: CommandPaletteRowProps) {
    const resolveQueryIcon = () => {
        if (item.type !== "query") return CogWheel;
        if (item.query.icon) return item.query.icon;

        const text = `${item.query.label} ${item.query.description ?? ""}`.toLowerCase();
        if (text.includes("send message")) return NotesIcon;
        if (text.includes("open dm")) return NotesIcon;
        if (text.includes("go to")) return MagnifyingGlassIcon;
        if (text.includes("open settings")) return MainSettingsIcon;
        if (text.includes("toggle plugin")) return PluginIcon;
        if (text.includes("open url")) return OpenExternalIcon;
        if (text.includes("invalid") || text.includes("no matching")) return WarningIcon;
        return CogWheel;
    };

    const resolveCommandIcon = () => {
        if (item.type !== "command") return CogWheel;
        if (item.command.icon) return item.command.icon;
        if (item.icon) return item.icon;

        const category = item.command.categoryId?.toLowerCase() ?? "";
        const metadata = `${item.command.id} ${item.command.label} ${(item.command.keywords ?? []).join(" ")}`.toLowerCase();

        if (category.includes("plugin") || metadata.includes("plugin")) return PluginIcon;
        if (category.includes("discord-settings") || metadata.includes("settings")) return MainSettingsIcon;
        if (metadata.includes("update") || metadata.includes("changelog")) return UpdaterIcon;
        if (metadata.includes("reload") || metadata.includes("restart")) return RestartIcon;
        if (metadata.includes("voice") || metadata.includes("mute") || metadata.includes("deafen")) return Microphone;
        if (metadata.includes("copy")) return CopyIcon;
        if (metadata.includes("link")) return LinkIcon;
        if (metadata.includes("browser") || metadata.includes("external") || metadata.includes("url")) return OpenExternalIcon;
        if (metadata.includes("theme") || metadata.includes("appearance") || metadata.includes("css") || metadata.includes("transparency")) return ColorPaletteIcon;
        if (metadata.includes("privacy") || metadata.includes("safety")) return SafetyIcon;
        if (metadata.includes("dm") || metadata.includes("message") || metadata.includes("chat")) return NotesIcon;
        if (metadata.includes("guild") || metadata.includes("server") || metadata.includes("channel")) return FolderIcon;
        if (metadata.includes("open") || metadata.includes("go to") || metadata.includes("navigate")) return MagnifyingGlassIcon;

        return CogWheel;
    };

    if (item.type === "section") {
        return <div className="vc-command-palette-section-label">{item.label}</div>;
    }

    if (item.type === "query") {
        const Icon = resolveQueryIcon();
        const hasInputPreview = Boolean(item.query.inputPreview?.length);
        return (
            <button
                type="button"
                className={selected ? "vc-command-palette-row vc-command-palette-row-selected" : "vc-command-palette-row"}
                onClick={onClick}
                onDoubleClick={onDoubleClick}
                onMouseEnter={onHover}
            >
                <div className="vc-command-palette-row-icon">
                    <Icon size="18" />
                </div>
                <div className="vc-command-palette-row-content">
                    <div className="vc-command-palette-row-title vc-command-palette-query-title">
                        <span className="vc-command-palette-query-prefix">{item.query.label}</span>
                        {hasInputPreview && (
                            <span className="vc-command-palette-query-field" title={item.query.inputPreview}>
                                {item.query.inputPreview}
                            </span>
                        )}
                    </div>
                    {item.query.description && <div className="vc-command-palette-row-subtitle">{item.query.description}</div>}
                </div>
                <div className="vc-command-palette-row-meta">{item.query.badge}</div>
            </button>
        );
    }

    const Icon = resolveCommandIcon();
    const hasDescription = item.command.description || item.subtitle;

    return (
        <button
            type="button"
            className={selected ? "vc-command-palette-row vc-command-palette-row-selected" : "vc-command-palette-row"}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onMouseEnter={onHover}
        >
            <div className="vc-command-palette-row-icon">
                <Icon size="18" />
            </div>
            <div className="vc-command-palette-row-content">
                <div className="vc-command-palette-row-title">{item.command.label}</div>
                {hasDescription && (
                    <div className="vc-command-palette-row-subtitle">
                        {item.command.description || item.subtitle}
                    </div>
                )}
            </div>
            <div className="vc-command-palette-row-meta">{item.badge}</div>
        </button>
    );
}
