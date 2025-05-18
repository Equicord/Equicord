/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

declare global {
    interface Window {
        EmojiMart?: {
            Picker: new (options: any) => HTMLElement;
        };
        EmojiMartLoading?: boolean;
        EmojiMartLoaded?: boolean;
    }
}

import "./style.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Settings } from "@api/Settings";
import { openPluginModal } from "@components/PluginSettings/PluginModal";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, Forms, Menu, React, RestAPI, Toasts, UserStore } from "@webpack/common";

import Plugins from "~plugins";

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
    onClose: () => void;
}

function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
    const pickerRef = React.useRef<HTMLDivElement>(null);
    const [ready, setReady] = React.useState(false);

    React.useEffect(() => {
        if (window.EmojiMartLoaded) {
            setReady(true);
            return;
        }

        if (!window.EmojiMartLoading) {
            window.EmojiMartLoading = true;
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://cdn.jsdelivr.net/npm/emoji-mart@latest/css/emoji-mart.css";
            document.head.appendChild(link);

            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/emoji-mart@latest/dist/browser.js";
            script.async = true;
            script.onload = () => {
                window.EmojiMartLoaded = true;
                setReady(true);
            };
            document.body.appendChild(script);
        } else {
            const interval = setInterval(() => {
                if (window.EmojiMartLoaded) {
                    setReady(true);
                    clearInterval(interval);
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, []);

    React.useEffect(() => {
        if (!ready || !pickerRef.current || !window.EmojiMart) return;

        const picker = new window.EmojiMart.Picker({
            onEmojiSelect: (emoji: any) => {
                onSelect(emoji.native);
                onClose();
            },
            theme: "dark",
            previewPosition: "none",
            searchPosition: "static",
            perLine: 8,
            emojiSize: 24,
            emojiButtonSize: 36,
            navPosition: "top"
        });
        pickerRef.current.appendChild(picker);

        const handleOutsideClick = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => {
            if (pickerRef.current) pickerRef.current.innerHTML = "";
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, [ready]);

    return (
        <div className="auto-react-emoji-picker">
            {!ready ? (
                <div className="auto-react-emoji-picker-loading">Loading emoji picker...</div>
            ) : (
                <div ref={pickerRef} />
            )}
        </div>
    );
}

interface AutoReactSettings {
    enabled: boolean;
    emojis: string;
    ignoreBots: boolean;
    ignoreSelf: boolean;
    channelSettings: Record<string, { enabled: boolean; }>;
    blacklistedUsers: string[];
}

const DEFAULT_SETTINGS: AutoReactSettings = {
    enabled: false,
    emojis: "",
    ignoreBots: true,
    ignoreSelf: false,
    channelSettings: {},
    blacklistedUsers: []
};

const rateLimitTracker = {
    lastRequest: 0,
    minDelay: 50,

    async addReaction(channelId: string, messageId: string, emoji: string) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequest;

        if (timeSinceLastRequest < this.minDelay) {
            await new Promise(resolve => setTimeout(resolve, this.minDelay - timeSinceLastRequest));
        }

        try {
            await RestAPI.put({
                url: `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me?location=Message%20Inline%20Button&type=0`
            });
            this.lastRequest = Date.now();
        } catch (err: any) {
            console.error("[AutoReact] Failed to add reaction:", err);
            if (!err.message?.includes("rate limit")) {
                Toasts.show({
                    message: "Failed to add reaction",
                    type: Toasts.Type.FAILURE,
                    id: Toasts.genId()
                });
            }
        }
    }
};

const channelContextMenuPatch: NavContextMenuPatchCallback = (children, { channel }) => {
    if (!channel) return;

    const channelSettings = typeof Settings.plugins.AutoReact.channelSettings === "string"
        ? JSON.parse(Settings.plugins.AutoReact.channelSettings)
        : Settings.plugins.AutoReact.channelSettings;
    const channelEnabled = channelSettings[channel.id]?.enabled ?? false;

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuItem
            id="auto-react-toggle"
            label={channelEnabled ? "Disable Auto-React" : "Enable Auto-React"}
            action={() => {
                const newSettings = { ...Settings.plugins.AutoReact };
                newSettings.channelSettings = { ...newSettings.channelSettings, [channel.id]: { enabled: !channelEnabled } };
                Settings.plugins.AutoReact = newSettings;

                Toasts.show({
                    message: `Auto-React ${!channelEnabled ? "enabled" : "disabled"} for this channel`,
                    type: Toasts.Type.SUCCESS,
                    id: Toasts.genId()
                });
            }}
        />,
        <Menu.MenuItem
            id="auto-react-open"
            label="Open Auto-React Settings"
            action={() => openPluginModal(Plugins.AutoReact)}
        />
    );
};

const userContextMenuPatch: NavContextMenuPatchCallback = (children, { user }) => {
    if (!user) return;

    const blacklistedUsers = Array.isArray(Settings.plugins.AutoReact.blacklistedUsers)
        ? Settings.plugins.AutoReact.blacklistedUsers
        : [];
    const isBlacklisted = blacklistedUsers.includes(user.id);

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuItem
            id="auto-react-blacklist"
            label={isBlacklisted ? "Remove from Auto-React Blacklist" : "Add to Auto-React Blacklist"}
            action={() => {
                Settings.plugins.AutoReact.blacklistedUsers = isBlacklisted
                    ? blacklistedUsers.filter(id => id !== user.id)
                    : [...blacklistedUsers, user.id];

                Toasts.show({
                    message: `User ${isBlacklisted ? "removed from" : "added to"} Auto-React blacklist`,
                    type: Toasts.Type.SUCCESS,
                    id: Toasts.genId()
                });
            }}
        />
    );
};

function BlacklistedUsersList() {
    const blacklistedUsers = Array.isArray(Settings.plugins.AutoReact.blacklistedUsers)
        ? Settings.plugins.AutoReact.blacklistedUsers
        : [];
    const [users, setUsers] = React.useState<Record<string, any>>({});
    const [loading, setLoading] = React.useState(true);

    const loadUsers = React.useCallback(async () => {
        const userData = { ...users };
        let hasChanges = false;

        await Promise.all(blacklistedUsers.map(async userId => {
            try {
                const response = await RestAPI.get({ url: `/users/${userId}` });
                if (response.body) {
                    userData[userId] = response.body;
                    hasChanges = true;
                }
            } catch (err) {
                console.error("[AutoReact] Failed to fetch user:", err);
            }
        }));

        if (hasChanges) setUsers(userData);
        setLoading(false);
    }, [blacklistedUsers, users]);

    React.useEffect(() => {
        loadUsers();
        const interval = setInterval(loadUsers, 30000);
        return () => clearInterval(interval);
    }, [loadUsers]);

    return (
        <Forms.FormSection>
            <Forms.FormTitle>Blacklisted Users</Forms.FormTitle>
            <Forms.FormText>
                {blacklistedUsers.length === 0 ? (
                    "No users currently blacklisted."
                ) : (
                    <ul>
                        {blacklistedUsers.map(userId => {
                            const user = users[userId];
                            return (
                                <li key={userId} className="auto-react-blacklist-item">
                                    {loading ? (
                                        <div className="auto-react-blacklist-loading">Loading user data...</div>
                                    ) : user ? (
                                        <>
                                            <img
                                                src={`https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png`}
                                                alt={`${user.username}'s avatar`}
                                                className="auto-react-blacklist-avatar"
                                            />
                                            <div className="auto-react-blacklist-user-info">
                                                <span className="auto-react-blacklist-displayname">
                                                    {user.global_name || user.username}
                                                </span>
                                                {user.global_name && (
                                                    <span className="auto-react-blacklist-username-only">
                                                        {user.username}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="auto-react-blacklist-user-info">
                                            <span className="auto-react-blacklist-displayname">Unknown User</span>
                                            <span className="auto-react-blacklist-username-only">{userId}</span>
                                        </div>
                                    )}
                                    <button
                                        className="auto-react-remove-button"
                                        onClick={() => {
                                            Settings.plugins.AutoReact.blacklistedUsers = blacklistedUsers.filter(id => id !== userId);
                                        }}
                                        aria-label="Remove user from blacklist"
                                    >
                                        <svg aria-hidden="true" role="img" width="16" height="16" viewBox="0 0 24 24">
                                            <path fill="currentColor" d="M16 8V17H8V8H16ZM14 4H10V6H14V4ZM21 6V8H20V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V8H3V6H8V5C8 3.9 8.9 3 10 3H14C15.1 3 16 3.9 16 5V6H21ZM6 8H18V17H6V8Z" />
                                        </svg>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Forms.FormText>
        </Forms.FormSection>
    );
}

export default definePlugin({
    name: "AutoReact",
    description: "Automatically reacts to messages with specified emojis. Configure settings in the channel's context menu.",
    authors: [Devs.Greyxp1],
    options: {
        emojiSeparator: {
            type: OptionType.COMPONENT,
            description: "",
            component: () => <Forms.FormDivider />,
        },
        emojis: {
            type: OptionType.COMPONENT,
            description: "",
            component: ({ setValue }) => {
                const [emoji, setEmoji] = React.useState(Settings.plugins.AutoReact.emojis);
                const [showPicker, setShowPicker] = React.useState(false);

                return (
                    <div className="auto-react-settings-section">
                        <Forms.FormTitle>Reaction Emoji</Forms.FormTitle>
                        <div className="auto-react-container">
                            <button
                                onClick={() => setShowPicker(!showPicker)}
                                className="auto-react-emoji-display-button"
                            >
                                {emoji || "\u{1FAE0}"}
                            </button>
                            {showPicker && (
                                <EmojiPicker
                                    onSelect={selectedEmoji => {
                                        setEmoji(selectedEmoji);
                                        setValue(selectedEmoji);
                                        Settings.plugins.AutoReact.emojis = selectedEmoji;
                                    }}
                                    onClose={() => setShowPicker(false)}
                                />
                            )}
                        </div>
                    </div>
                );
            }
        },
        ignoreBots: {
            type: OptionType.BOOLEAN,
            default: true,
            description: ""
        },
        ignoreSelf: {
            type: OptionType.BOOLEAN,
            default: false,
            description: ""
        },
        viewBlacklistedUsers: {
            type: OptionType.COMPONENT,
            description: "",
            component: BlacklistedUsersList
        }
    },

    start() {
        Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
            if (Settings.plugins.AutoReact[key] === undefined) {
                Settings.plugins.AutoReact[key] = value;
            }
        });

        try {
            const currentValue = Settings.plugins.AutoReact.blacklistedUsers;
            Settings.plugins.AutoReact.blacklistedUsers = typeof currentValue === "string"
                ? JSON.parse(currentValue)
                : Array.isArray(currentValue) ? currentValue : [];
        } catch {
            Settings.plugins.AutoReact.blacklistedUsers = [];
        }

        FluxDispatcher.subscribe("MESSAGE_CREATE", this.handleMessage);
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", this.handleMessage);
    },

    contextMenus: {
        "channel-context": channelContextMenuPatch,
        "user-context": userContextMenuPatch
    },

    handleMessage({ type, channelId, message, optimistic }) {
        if (type !== "MESSAGE_CREATE" || optimistic) return;

        const channelSettings = typeof Settings.plugins.AutoReact.channelSettings === "string"
            ? JSON.parse(Settings.plugins.AutoReact.channelSettings)
            : Settings.plugins.AutoReact.channelSettings;
        const channelEnabled = channelSettings[channelId]?.enabled ?? false;
        if (!channelEnabled) return;

        if (Settings.plugins.AutoReact.ignoreBots && message.author?.bot) return;
        if (Settings.plugins.AutoReact.ignoreSelf && message.author?.id === UserStore.getCurrentUser().id) return;

        const blacklistedUsers = Array.isArray(Settings.plugins.AutoReact.blacklistedUsers)
            ? Settings.plugins.AutoReact.blacklistedUsers
            : [];
        if (blacklistedUsers.includes(message.author?.id)) return;

        const emoji = Settings.plugins.AutoReact.emojis.trim();
        if (!emoji) return;

        rateLimitTracker.addReaction(channelId, message.id, emoji);
    }
});
