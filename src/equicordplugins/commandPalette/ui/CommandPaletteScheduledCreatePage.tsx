/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TextInput, useEffect, useState } from "@webpack/common";

interface ChannelSuggestion {
    id: string;
    display: string;
    iconUrl?: string;
    kind: "guild" | "dm" | "group";
}

interface CommandPaletteScheduledCreatePageProps {
    channelValue: string;
    hasSelectedChannel: boolean;
    timeValue: string;
    messageValue: string;
    channelSuggestions: ChannelSuggestion[];
    error: string | null;
    onChannelChange(value: string): void;
    onTimeChange(value: string): void;
    onMessageChange(value: string): void;
    onPickSuggestion(suggestion: ChannelSuggestion): void;
}

export function CommandPaletteScheduledCreatePage({
    channelValue,
    hasSelectedChannel,
    timeValue,
    messageValue,
    channelSuggestions,
    error,
    onChannelChange,
    onTimeChange,
    onMessageChange,
    onPickSuggestion
}: CommandPaletteScheduledCreatePageProps) {
    const [showChannelDropdown, setShowChannelDropdown] = useState(false);

    useEffect(() => {
        if (hasSelectedChannel) {
            setShowChannelDropdown(false);
        }
    }, [hasSelectedChannel]);

    const renderFallbackIcon = (kind: ChannelSuggestion["kind"]) => {
        if (kind === "dm") {
            return <span className="vc-command-palette-scheduled-create-option-fallback">@</span>;
        }

        if (kind === "group") {
            return <span className="vc-command-palette-scheduled-create-option-fallback">👥</span>;
        }

        return <span className="vc-command-palette-scheduled-create-option-fallback">#</span>;
    };

    return (
        <div className="vc-command-palette-scheduled-create-page">
            <div className="vc-command-palette-scheduled-create-grid">
                <label className="vc-command-palette-scheduled-create-label">Channel</label>
                <div className="vc-command-palette-scheduled-create-field">
                    <TextInput
                        className="vc-command-palette-scheduled-create-input"
                        value={channelValue}
                        onChange={value => {
                            onChannelChange(value);
                            setShowChannelDropdown(true);
                        }}
                        placeholder="Current channel, DM, or group DM"
                        onFocus={() => {
                            if (!hasSelectedChannel) {
                                setShowChannelDropdown(true);
                            }
                        }}
                        onBlur={() => {
                            window.setTimeout(() => {
                                setShowChannelDropdown(false);
                            }, 0);
                        }}
                    />
                    {showChannelDropdown && channelSuggestions.length > 0 && (
                        <div className="vc-command-palette-scheduled-create-dropdown">
                            {channelSuggestions.map(suggestion => (
                                <button
                                    key={suggestion.id}
                                    type="button"
                                    className="vc-command-palette-scheduled-create-option"
                                    onMouseDown={event => {
                                        event.preventDefault();
                                        setShowChannelDropdown(false);
                                        onPickSuggestion(suggestion);
                                    }}
                                    onClick={() => {
                                        setShowChannelDropdown(false);
                                        onPickSuggestion(suggestion);
                                    }}
                                >
                                    {suggestion.iconUrl ? (
                                        <img
                                            className="vc-command-palette-scheduled-create-option-icon"
                                            src={suggestion.iconUrl}
                                            alt=""
                                        />
                                    ) : (
                                        <span className="vc-command-palette-scheduled-create-option-icon vc-command-palette-scheduled-create-option-icon-fallback">
                                            {renderFallbackIcon(suggestion.kind)}
                                        </span>
                                    )}
                                    <span className="vc-command-palette-scheduled-create-option-label">{suggestion.display}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <label className="vc-command-palette-scheduled-create-label">Time</label>
                <TextInput
                    className="vc-command-palette-scheduled-create-input"
                    value={timeValue}
                    onChange={onTimeChange}
                    placeholder="in 10m, tomorrow 5pm, 2026-02-14 18:00"
                />

                <label className="vc-command-palette-scheduled-create-label">Message</label>
                <TextInput
                    className="vc-command-palette-scheduled-create-input"
                    value={messageValue}
                    onChange={onMessageChange}
                    placeholder="Message content"
                />
            </div>

            {error && (
                <div className="vc-command-palette-scheduled-create-error">{error}</div>
            )}
        </div>
    );
}
