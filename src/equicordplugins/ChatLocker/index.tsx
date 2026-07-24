/*
 * Equicord User Plugin: ChatLockButton
 *
 * Adds a "Lock Chat" item to the + (attachment) dropdown.
 * Shows a blur overlay when locked – persistent across restarts.
 * Auto‑locks when you switch away from a channel.
 * Uses DataStore for reliable persistence.
 */

import "./styles.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import {
    SelectedChannelStore,
    Menu,
    PermissionStore,
    PermissionsBits,
} from "@webpack/common";

import {
    loadAll,
    lock,
    isLocked,
    hasPassword,
    settingsCache,
} from "./storage";
import {
    LockIcon,
    actSetLock,
    actUnlock,
    actRelock,
} from "./modals";
import {
    createOverlay,
    removeOverlay,
    updateOverlay,
    startOverlayRetryLoop,
    cleanupOverlay,
    getCurrentId,
    overlayElement,        // <-- add
    overlayRetryInterval,  // <-- add
} from "./overlay";

// ============================================================================
// Context Menu Patch
// ============================================================================

const channelAttachPatch: NavContextMenuPatchCallback = (children, props) => {
    const channel = props?.channel;
    if (!channel) return;
    if (channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, channel)) return;
    if (children.some(child => child?.props?.id === "chatlock-button")) return;

    const id = getCurrentId();
    const has = id ? hasPassword(id) : false;
    const locked = id ? isLocked(id) : false;

    let label = "Lock Chat";
    let icon = LockIcon;
    if (!has) {
        label = "Set Password";
    } else if (locked) {
        label = "Unlock Chat";
    } else {
        label = "Lock Chat";
    }

    children.splice(1, 0, (
        <Menu.MenuItem
            id="chatlock-button"
            label={label}
            iconLeft={icon}
            action={() => {
                const id = getCurrentId();
                if (!id) return;
                const has = hasPassword(id);
                if (!has) actSetLock();
                else if (isLocked(id)) actUnlock();
                else actRelock();
            }}
        />
    ));
};

// ============================================================================
// Auto‑re‑lock on channel switch
// ============================================================================

let previousChannelId: string | null = null;

function handleChannelChange() {
    const newId = getCurrentId();

    if (previousChannelId && previousChannelId !== newId) {
        lock(previousChannelId);
    }

    previousChannelId = newId;
    updateOverlay();
}

// ============================================================================
// Startup: load and lock all password-protected channels
// ============================================================================

async function startupLockAll() {
    const data = await loadAll();
    const keys = Object.keys(data);
    for (const channelId of keys) {
        lock(channelId);
    }
    console.log(`[ChatLockButton] Locked ${keys.length} stored channels on startup.`);
    if (keys.length > 0) {
        console.log("[ChatLockButton] Stored channel IDs:", keys);
    }
    return keys;
}

// ============================================================================
// Plugin definition
// ============================================================================

export default definePlugin({
    name: "ChatLockButton",
    description: "Adds a 'Lock Chat' item to the + dropdown. Blurs the chat when locked, auto‑locks on channel switch, and persists lock state across restarts.",
    authors: [{ name: "You", id: 0n }],

    contextMenus: {
        "channel-attach": channelAttachPatch,
    },

    start() {
        // Load and lock all stored channels
        startupLockAll().then(() => {
            // After loading, attempt overlay creation
            setTimeout(() => {
                const id = getCurrentId();
                if (id && isLocked(id)) {
                    const created = createOverlay();
                    if (!created && !overlayRetryInterval) {
                        startOverlayRetryLoop();
                    }
                }
            }, 200);
        });

        // Channel change listener
        this._unsubChannel = SelectedChannelStore.addChangeListener(() => {
            handleChannelChange();
        });

        // Mutation observer to re-create overlay if it disappears
        this._observer = new MutationObserver(() => {
            const id = getCurrentId();
            if (id && isLocked(id) && (!overlayElement || !document.body.contains(overlayElement))) {
                const created = createOverlay();
                if (!created && !overlayRetryInterval) {
                    startOverlayRetryLoop();
                }
            }
            if (overlayElement && (!id || !isLocked(id))) {
                removeOverlay();
            }
        });
        this._observer.observe(document.body, { childList: true, subtree: true });

        previousChannelId = getCurrentId();

        // Final check after 2 seconds
        setTimeout(() => {
            updateOverlay();
        }, 2000);
    },

    stop() {
        this._unsubChannel?.();
        this._observer?.disconnect();
        cleanupOverlay();
        previousChannelId = null;
    },
});