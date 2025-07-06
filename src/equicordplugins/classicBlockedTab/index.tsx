/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy, findComponentByCodeLazy } from "@webpack";
import { Constants, FluxDispatcher, React, RelationshipStore, UserStore, useStateFromStores } from "@webpack/common";

const FriendsNavBar = findByPropsLazy("PENDING", "ADD_FRIEND");
const FriendRow = findComponentByCodeLazy("discriminatorClass:", ".isMobileOnline", "getAvatarURL");

function XIcon({ size = 20, color = "var(--interactive-normal)", className }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }} className={className}>
            <path fill={color} d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
        </svg>
    );
}

function BlockedTabPanel() {
    const [refresh, setRefresh] = React.useState(0);
    React.useEffect(() => {
        const handler = () => setRefresh(r => r + 1);
        RelationshipStore.addChangeListener(handler);
        const fluxHandler = e => {
            if (e.type === "RELATIONSHIP_ADD" || e.type === "RELATIONSHIP_REMOVE") handler();
        };
        require("@webpack/common").FluxDispatcher.subscribe(fluxHandler);
        return () => {
            RelationshipStore.removeChangeListener(handler);
            require("@webpack/common").FluxDispatcher.unsubscribe(fluxHandler);
        };
    }, []);
    const blockedIds = useStateFromStores([RelationshipStore], () => RelationshipStore.getBlockedIDs());
    const users = blockedIds.map(id => UserStore.getUser(id)).filter(Boolean);
    return (
        <div style={{ padding: 16 }}>
            <h2 style={{ marginBottom: 12, color: "var(--header-primary)" }}>Blocked Users ({users.length})</h2>
            {users.length === 0 ? (
                <div>No blocked users.</div>
            ) : (
                users.map(user => (
                    <div key={user.id} className="vc-blocked-row">
                        <div className="vc-blocked-user-info">
                            <img src={user.getAvatarURL ? user.getAvatarURL() : user.avatar} alt="avatar" style={{ width: 32, height: 32, borderRadius: "50%" }} />
                            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <span className="vc-blocked-username">{user.username}</span>
                                {user.discriminator && <span className="vc-blocked-tag">#{user.discriminator}</span>}
                            </div>
                        </div>
                        <button
                            className="vc-blocked-unblock-btn"
                            title="Unblock"
                            aria-label="Unblock"
                            onClick={() => {
                                FluxDispatcher.dispatch({
                                    type: "RELATIONSHIP_REMOVE",
                                    relationship: {
                                        id: user.id,
                                        type: 2 // BLOCKED
                                    }
                                });
                            }}
                        >
                            <XIcon size={20} color="var(--interactive-normal)" className="vc-blocked-unblock-icon" />
                        </button>
                    </div>
                ))
            )}
        </div>
    );
}

export default definePlugin({
    name: "ClassicBlockedTab",
    description: "Restores the classic 'Blocked' tab to the Friends page.",
    authors: [EquicordDevs.SteelTech],
    patches: [
        {
            find: "case o.PENDING:",
            replacement: {
                match: /case (\w+)\.PENDING:/,
                replace: (m, enumName) => `case ${enumName}.BLOCKED: return "Blocked"; case ${enumName}.PENDING:`
            }
        },
        {
            find: "{id:o.PENDING,show:",
            replacement: {
                match: /\{id:(\w+)\.PENDING,show:[^}]+\}/,
                replace: (m, enumName) => `{id:${enumName}.BLOCKED,show:true,className:c.item,content:"Blocked"},${m}`
            }
        },
        {
            find: "case o.PENDING:",
            replacement: {
                match: /case (\w+)\.PENDING:(.+?return .+?;)/s,
                replace: (m, enumName, rest) => `case ${enumName}.BLOCKED: return window.__classicBlockedTabPanel ? window.__classicBlockedTabPanel() : null; case ${enumName}.PENDING:${rest}`
            }
        },
        {
            find: 'Object.defineProperty(exports,"__esModule",{value:!0})',
            replacement: {
                match: /Object\.defineProperty\(exports,"__esModule",\{value:!0\}\)/,
                replace: m => `${m};window.__classicBlockedTabPanel = ${BlockedTabPanel.toString()}`
            }
        }
    ],
    start() {
        if (!Constants.FriendsSections.BLOCKED) {
            Constants.FriendsSections.BLOCKED = "BLOCKED";
        }
        const addBlockedTab = () => {
            if (!location.pathname.startsWith("/channels/@me")) return;

            const navBar = document.querySelector('[role="tablist"]');
            if (!navBar || navBar.querySelector(".vc-blocked-tab")) return;

            const pendingTab = navBar.children[2];
            if (!pendingTab) return;

            const blockedTab = pendingTab.cloneNode(true) as HTMLElement;
            blockedTab.className = (pendingTab as HTMLElement).className;
            blockedTab.classList.add("vc-blocked-tab");
            blockedTab.setAttribute("aria-label", "Blocked");
            blockedTab.textContent = "Blocked";

            blockedTab.addEventListener("click", () => {
                Array.from(navBar.children).forEach(tab => (tab as HTMLElement).classList.remove("selected"));
                blockedTab.classList.add("selected");

                const content = document.querySelector('[class*="peopleColumn"]');
                if (content) {
                    const userList = content.querySelector('[class*="scroller"]');
                    if (userList) (userList as HTMLElement).style.display = "none";

                    let blockedMount = document.getElementById("vc-blocked-tab-mount");
                    if (!blockedMount) {
                        blockedMount = document.createElement("div");
                        blockedMount.id = "vc-blocked-tab-mount";
                        content.appendChild(blockedMount);
                    }

                    if (window.__vcBlockedTabRoot && window.__vcBlockedTabRoot.unmount) {
                        window.__vcBlockedTabRoot.unmount();
                    }
                    window.__vcBlockedTabRoot = require("@webpack/common").createRoot(blockedMount);
                    window.__vcBlockedTabRoot.render(React.createElement(BlockedTabPanel));
                }
            });

            navBar.insertBefore(blockedTab, navBar.lastElementChild);
            Array.from(navBar.children).forEach(tab => {
                if (tab === blockedTab) return;
                tab.addEventListener("click", () => {
                    const content = document.querySelector('[class*="peopleColumn"]');
                    const blockedMount = document.getElementById("vc-blocked-tab-mount");
                    if (blockedMount) {
                        if (window.__vcBlockedTabRoot && window.__vcBlockedTabRoot.unmount) {
                            window.__vcBlockedTabRoot.unmount();
                        }
                        blockedMount.remove();
                    }
                    if (content) {
                        const userList = content.querySelector('[class*="scroller"]');
                        if (userList) (userList as HTMLElement).style.display = "";
                    }
                });
            });
        };
        addBlockedTab();
        this._interval = setInterval(addBlockedTab, 1000);
    },
    stop() {
        if (window.__classicBlockedTabPanel) delete window.__classicBlockedTabPanel;
        if (this._interval) clearInterval(this._interval);
        const tab = document.querySelector(".vc-blocked-tab");
        if (tab) tab.remove();
        const content = document.querySelector('[class*="peopleColumn"]');
        if (content && content.firstChild) {
            if (window.__vcBlockedTabRoot && window.__vcBlockedTabRoot.unmount) window.__vcBlockedTabRoot.unmount();
            content.firstChild.remove();
        }
    }
});
