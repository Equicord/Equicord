/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 nin0
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";
import { relaunch } from "@utils/native";
import { Alerts, showToast, Toasts } from "@webpack/common";

import plugin from "..";
import { authorize } from "../oauth";

// if edited, also edit in native.ts!!!
export const CLONE_LINK_REGEX = /https:\/\/(?:((?:git(?:hub|lab)\.com|git\.(?:[a-zA-Z0-9]|\.)+|codeberg\.org))\/(?!user-attachments)((?:[a-zA-Z0-9]|-)+)\/((?:[a-zA-Z0-9]|-|\.)+)(?:\.git)?|(plugins\.(nin0)\.dev)\/((?:[a-zA-Z0-9]|-|\.)+))(?:\/)?/;
export const WHITELISTED_SHARE_CHANNELS = ["1256395889354997771", "1032200195582197831", "1301947896601509900", "1322935137591365683"];
export const cl = classNameFactory("vc-userplugininstaller-");

export const apiBaseDomain = "http://localhost:9182";
export const applicationID = "1498661325327433799";

export function showInstallFinishedAlert(pluginToEnable: string, native: boolean) {
    Alerts.show({
        title: "Done!",
        body: `${pluginToEnable} has been successfully installed.${native ? " However, as it makes use of native functions, a client restart is required." : ""} What now?`,
        confirmText: `Enable & ${native ? "restart" : "refresh"}`,
        cancelText: native ? "Restart" : "Refresh",
        onConfirm() {
            !Vencord.Plugins.plugins[pluginToEnable] ? Vencord.Settings.plugins[pluginToEnable] = { enabled: true } : Vencord.Settings.plugins[pluginToEnable].enabled = true;
            native ? relaunch() : window.location.reload();
        },
        onCancel: () => native ? relaunch() : window.location.reload()
    });
}

export async function uplFetch(path: `/${string}`, opts?: RequestInit, body?: object): Promise<{ ok: boolean; body: object; res: Response; }> {
    const req = await fetch(`${apiBaseDomain}${path}`, {
        ...opts,
        headers: {
            ...opts?.headers,
            "Content-Type": "application/json",
            "Authorization": plugin.auth.value().token ?? ""
        },
        ...(() => {
            const method = opts?.method?.toUpperCase() ?? "GET";
            if (["GET", "HEAD"].includes(method)) return {};
            return { body: JSON.stringify(body ?? {}) };
        })()
    });
    const text = await req.text();
    switch (req.status) {
        case 403: {
            Alerts.show({
                title: "Forbidden",
                body: text
            });
            break;
        }
        case 401: {
            showToast("You must be logged in to do this", Toasts.Type.FAILURE);
            authorize();
            break;
        }
    }
    return {
        ok: req.status < 400,
        res: req,
        body: req.status === 200 ? JSON.parse(text) : { text }
    };
}
