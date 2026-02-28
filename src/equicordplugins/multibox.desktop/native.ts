/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and Equicord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BrowserWindow, IpcMainInvokeEvent, session, shell, WebContentsView } from "electron";

const views = new Map<string, WebContentsView>();
let mainWindow: BrowserWindow | null = null;
const TAB_BAR_HEIGHT = 36;

function onResize() {
    if (!mainWindow) return;
    const [width, height] = mainWindow.getContentSize();
    for (const view of views.values()) {
        if (mainWindow.contentView.children.includes(view)) {
            view.setBounds({ x: 0, y: TAB_BAR_HEIGHT, width, height: height - TAB_BAR_HEIGHT });
        }
    }
}

export async function initialize(event: IpcMainInvokeEvent) {
    mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (mainWindow) {
        mainWindow.on("resize", onResize);
    }
}

export async function addAccount(event: IpcMainInvokeEvent, id: string) {
    if (!mainWindow || views.has(id)) return;

    const ses = session.fromPartition(`persist:multibox-${id}`);
    const view = new WebContentsView({
        webPreferences: {
            session: ses,
        }
    });

    const [width, height] = mainWindow.getContentSize();
    view.setBounds({ x: 0, y: TAB_BAR_HEIGHT, width, height: height - TAB_BAR_HEIGHT });

    view.webContents.setUserAgent(mainWindow.webContents.getUserAgent());

    view.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    views.set(id, view);
    view.webContents.loadURL("https://discord.com/app");
}

export async function switchTo(event: IpcMainInvokeEvent, id: string) {
    if (!mainWindow) return;

    for (const view of views.values()) {
        try { mainWindow.contentView.removeChildView(view); } catch { }
    }

    if (id === "main") return;

    const view = views.get(id);
    if (!view) return;

    const [width, height] = mainWindow.getContentSize();
    view.setBounds({ x: 0, y: TAB_BAR_HEIGHT, width, height: height - TAB_BAR_HEIGHT });
    mainWindow.contentView.addChildView(view);
}

export async function removeAccount(event: IpcMainInvokeEvent, id: string) {
    const view = views.get(id);
    if (!view || !mainWindow) return;

    try { mainWindow.contentView.removeChildView(view); } catch { }
    view.webContents.close();
    views.delete(id);
}

export async function cleanup(event: IpcMainInvokeEvent) {
    if (mainWindow) {
        mainWindow.removeListener("resize", onResize);
        for (const view of views.values()) {
            try { mainWindow.contentView.removeChildView(view); } catch { }
            view.webContents.close();
        }
    }
    views.clear();
    mainWindow = null;
}
