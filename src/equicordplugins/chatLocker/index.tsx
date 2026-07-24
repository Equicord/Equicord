import "./styles.css";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import { SelectedChannelStore, Menu, PermissionStore, PermissionsBits, React } from "@webpack/common";

import { loadAll, lock, isLocked, hasPassword, getCurrentId } from "./storage";
import { LockIcon, actSetLock, actUnlock, actRelock } from "./modals";
import { Overlay } from "./overlay";
import { refreshOverlay } from "./overlayManager";

// Context menu patch
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
    if (!has) label = "Set Password";
    else if (locked) label = "Unlock Chat";
    else label = "Lock Chat";

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

// Auto‑re‑lock on channel switch
let previousChannelId: string | null = null;
function handleChannelChange() {
    const newId = getCurrentId();
    if (previousChannelId && previousChannelId !== newId) {
        lock(previousChannelId);
    }
    previousChannelId = newId;
    refreshOverlay();
}

async function startupLockAll() {
    const data = await loadAll();
    for (const id of Object.keys(data)) lock(id);
}

export default definePlugin({
    name: "ChatLockButton",
    description: "Adds a 'Lock Chat' item to the + dropdown. Blurs the chat when locked, auto‑locks on channel switch, and persists lock state.",
    authors: [{ name: "You", id: 0n }],
    contextMenus: { "channel-attach": channelAttachPatch },

    // Expose Overlay for the patch
    Overlay,

    /**
     * Verified against a live Discord build (July 2026): module 10822
     * contains the message-list wrapper div, whose className is built from
     * `oi.Og` (which resolves to the `messagesWrapper__...` DOM class) plus
     * the component's `className` and `messageGroupSpacing` props (locally
     * named `s` and `o` in that build's minified output). We inject our
     * Overlay as the first child of that div, using the module's own local
     * JSX runtime reference (`a`) rather than any global.
     *
     * NOTE: minified identifiers like `oi`, `s`, `o`, and `a` are specific
     * to this exact Discord build and WILL change on future Discord
     * updates, which will break this patch (Vencord will just skip it
     * silently). If that happens: Settings -> Vencord -> Patch Helper,
     * find "messagesNavigationDescription" (or similar unique string) to
     * confirm the module, view its source, and re-locate the div whose
     * className includes the messagesWrapper CSS-module class, then update
     * the `find`/`match` below to match the new local variable names.
     */
    patches: [
        {
            find: "messagesNavigationDescription",
            replacement: {
                match: /className:c\(\)\(oi\.Og,s,`group-spacing-\$\{o\}`\),children:\[/,
                replace: (match: string) => `${match}a.jsx($self.Overlay,{}),`
            }
        }
    ],

    start() {
        startupLockAll();
        this._unsub = SelectedChannelStore.addChangeListener(handleChannelChange);
        refreshOverlay();
    },

    stop() {
        this._unsub?.();
    }
});
