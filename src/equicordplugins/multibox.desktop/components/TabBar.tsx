/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and Equicord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";

import type { AccountTab } from "..";

const cl = classNameFactory("vc-multibox-");

interface TabBarProps {
    accounts: AccountTab[];
    activeTab: string;
    onSwitch: (id: string) => void;
    onAdd: () => void;
    onRemove: (id: string) => void;
}

export default function MultiboxTabBar({ accounts, activeTab, onSwitch, onAdd, onRemove }: TabBarProps) {
    return (
        <div className={cl("bar")}>
            <div
                className={cl("tab", activeTab === "main" ? "tab-active" : "")}
                onClick={() => onSwitch("main")}
            >
                Main
            </div>
            {accounts.map(account => (
                <div
                    key={account.id}
                    className={cl("tab", activeTab === account.id ? "tab-active" : "")}
                    onClick={() => onSwitch(account.id)}
                >
                    <span className={cl("tab-label")}>{account.label}</span>
                    <span
                        className={cl("tab-close")}
                        onClick={e => {
                            e.stopPropagation();
                            onRemove(account.id);
                        }}
                    >
                        {"\u00d7"}
                    </span>
                </div>
            ))}
            <div className={cl("tab-add")} onClick={onAdd}>
                +
            </div>
        </div>
    );
}
