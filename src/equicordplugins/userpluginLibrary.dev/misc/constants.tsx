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
    const req = await fetch(`${plugin.settings.store.apiBasePath}${path}`, {
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

export const safetyIcons: {
    [id: string]: {
        icon: unknown;
        description: string;
    }
} = {
    malicious: {
        icon: <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="var(red)" d="M21.65 13.63c.1.17.35.1.35-.1V10.5a.5.5 0 0 0-.5-.5H19a5 5 0 0 1-5-5V2.5a.5.5 0 0 0-.5-.5H6a4 4 0 0 0-4 4v12a4 4 0 0 0 4 4h5.49c.27 0 .5-.22.54-.5.06-.32.18-.65.37-.97l3.95-6.9a3.06 3.06 0 0 1 5.3 0Z" className=""></path><path fill="var(red)" d="M21.7 7.94c.01.03 0 .06-.04.06H19a3 3 0 0 1-3-3V2.34c0-.03.03-.05.06-.04a3 3 0 0 1 .82.58l4.24 4.24a3 3 0 0 1 .58.82Z" className=""></path><path fill="var(red)" fillRule="evenodd" d="m14.13 21.52 3.96-6.9c.4-.68 1.43-.68 1.82 0l3.96 6.9c.38.67-.12 1.48-.91 1.48h-7.92c-.79 0-1.3-.81-.91-1.48Zm3.93-4.47a.5.5 0 0 1 .5-.55h.89c.3 0 .52.26.5.55l-.22 2.02c-.01.16-.17.26-.33.23a1.93 1.93 0 0 0-.8 0c-.16.03-.32-.07-.33-.23l-.21-2.02ZM19 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" className=""></path></svg>,
        description: "This plugin exhibits malicious behavior and has been manually flagged as such. You should uninstall it, and change your Discord password."
    },
    broken: {
        icon: <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="orange" d="M5 2a3 3 0 0 0-3 3v4.7l3.33 3.33 3.39-3.38a1.5 1.5 0 0 1 2.12 0l3.38 3.38 3.39-3.38a1.5 1.5 0 0 1 2.12 0L22 11.92V5a3 3 0 0 0-3-3H5Z" className=""></path><path fill="orange" d="m22 14.75-3.33-3.34-3.39 3.39a1.5 1.5 0 0 1-2.12 0L9.78 11.4 6.39 14.8a1.5 1.5 0 0 1-2.12 0L2 12.53V19a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-4.25Z" className=""></path></svg>,
        description: "This plugin was marked as broken by the author/our team. Consider disabling it, until it is fixed, or you may have issues."
    },
    unknown: {
        icon: <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="transparent" className=""></circle><path fill="yellow" fillRule="evenodd" d="M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm-.28-16c-.98 0-1.81.47-2.27 1.14A1 1 0 1 1 7.8 7.01 4.73 4.73 0 0 1 11.72 5c2.5 0 4.65 1.88 4.65 4.38 0 2.1-1.54 3.77-3.52 4.24l.14 1a1 1 0 0 1-1.98.27l-.28-2a1 1 0 0 1 .99-1.14c1.54 0 2.65-1.14 2.65-2.38 0-1.23-1.1-2.37-2.65-2.37ZM13 17.88a1.13 1.13 0 1 1-2.25 0 1.13 1.13 0 0 1 2.25 0Z" clipRule="evenodd" className=""></path></svg>,
        description: "This plugin does not come from the plugin library, and therefore has never been reviewed. You may request a review in the three-dot menu."
    },
    approved: {
        icon: <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="transparent" className=""></circle><path fill="green" fillRule="evenodd" d="M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm5.7-13.3a1 1 0 0 0-1.4-1.4L10 14.58l-2.3-2.3a1 1 0 0 0-1.4 1.42l3 3a1 1 0 0 0 1.4 0l7-7Z" clipRule="evenodd" className=""></path></svg>,
        description: "This plugin's latest commit has been reviewed and approved by the UserpluginLibrary team."
    },
    pendingApproval: {
        icon: <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="transparent" className=""></circle><path fill="yellow" fillRule="evenodd" d="M12 23a11 11 0 1 0 0-22 11 11 0 0 0 0 22Zm5.7-13.3a1 1 0 0 0-1.4-1.4L10 14.58l-2.3-2.3a1 1 0 0 0-1.4 1.42l3 3a1 1 0 0 0 1.4 0l7-7Z" clipRule="evenodd" className=""></path></svg>,
        description: "This plugin has been reviewed and approved in the past, but its most recent commit was not."
    },
    trustedAuthor: {
        icon: <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="green" d="M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM11.53 11A9.53 9.53 0 0 0 2 20.53c0 .81.66 1.47 1.47 1.47h.22c.24 0 .44-.17.5-.4.29-1.12.84-2.17 1.32-2.91.14-.21.43-.1.4.15l-.26 2.61c-.02.3.2.55.5.55h6.4a.5.5 0 0 0 .35-.85l-.02-.03a3 3 0 1 1 4.24-4.24l.53.52c.2.2.5.2.7 0l1.8-1.8c.17-.17.2-.43.06-.62A9.52 9.52 0 0 0 12.47 11h-.94Z" className=""></path><path fill="green" d="M23.7 17.7a1 1 0 1 0-1.4-1.4L18 20.58l-2.3-2.3a1 1 0 0 0-1.4 1.42l3 3a1 1 0 0 0 1.4 0l5-5Z" className=""></path></svg>,
        description: "The author of this plugin is marked as trusted by the UserpluginLibrary team."
    }
};
