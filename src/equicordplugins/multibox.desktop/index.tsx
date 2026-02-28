/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and Equicord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import * as DataStore from "@api/DataStore";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { PluginNative } from "@utils/types";
import { useState } from "@webpack/common";
import { JSX } from "react";

import MultiboxTabBar from "./components/TabBar";

const Native = VencordNative.pluginHelpers.Multibox as PluginNative<typeof import("./native")>;

const STORE_KEY = "multibox-accounts";

export interface AccountTab {
    id: string;
    label: string;
}

let accounts: AccountTab[] = [];
let activeTab = "main";
let forceUpdateFn: (() => void) | null = null;

function generateId(): string {
    return Math.random().toString(36).substring(2, 10);
}

async function switchTab(id: string) {
    activeTab = id;
    await Native.switchTo(id);
    forceUpdateFn?.();
}

async function addTab() {
    const id = generateId();
    const label = `Account ${accounts.length + 2}`;
    accounts = [...accounts, { id, label }];
    await Native.addAccount(id);
    await DataStore.set(STORE_KEY, accounts);
    await switchTab(id);
}

async function removeTab(id: string) {
    await Native.removeAccount(id);
    accounts = accounts.filter(a => a.id !== id);
    await DataStore.set(STORE_KEY, accounts);
    if (activeTab === id) {
        await switchTab("main");
    } else {
        forceUpdateFn?.();
    }
}

function MultiboxContainer({ children }: { children: JSX.Element; }) {
    const [, setTick] = useState(0);
    forceUpdateFn = () => setTick(t => t + 1);

    return (
        <>
            <ErrorBoundary>
                <MultiboxTabBar
                    accounts={accounts}
                    activeTab={activeTab}
                    onSwitch={switchTab}
                    onAdd={addTab}
                    onRemove={removeTab}
                />
            </ErrorBoundary>
            {children}
        </>
    );
}

export default definePlugin({
    name: "Multibox",
    description: "Run multiple Discord accounts in tabs within a single Equibop window",
    authors: [EquicordDevs.DonutsDelivery],

    patches: [
        {
            find: '"AppView"',
            replacement: {
                match: /((\i\?.params)\?\.channelId.{0,600})"div",{(?=className:\i\.\i)/,
                replace: "$1$self.render,{",
            }
        }
    ],

    render({ children }: { children: JSX.Element; }) {
        return <MultiboxContainer>{children}</MultiboxContainer>;
    },

    async start() {
        await Native.initialize();

        const saved: AccountTab[] = await DataStore.get(STORE_KEY) ?? [];
        accounts = saved;
        for (const account of accounts) {
            await Native.addAccount(account.id);
        }

        activeTab = "main";
        forceUpdateFn?.();
    },

    async stop() {
        await Native.cleanup();
        accounts = [];
        activeTab = "main";
        forceUpdateFn = null;
    }
});
