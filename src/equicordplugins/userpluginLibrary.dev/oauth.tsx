/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 nin0
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { OAuth2AuthorizeModal, openModal, showToast, Toasts } from "@webpack/common";

import plugin from ".";
import { apiBaseDomain, applicationID, uplFetch } from "./misc/constants";

export function authorize() {
    openModal(props =>
        <OAuth2AuthorizeModal
            {...props}
            scopes={["identify"]}
            responseType="code"
            redirectUri={`${apiBaseDomain}/oauth`}
            permissions={0n}
            clientId={applicationID}
            cancelCompletesFlow={false}
            callback={async (response: any) => {
                try {
                    const url = new URL(response.location);
                    const req = await uplFetch((url.pathname + url.search) as `/${string}`);
                    if (req.ok) {
                        plugin.auth.value(req.body);
                        showToast("Logged in", Toasts.Type.SUCCESS);
                    }
                } catch (e) {
                    new Logger("UserpluginLibrary").error("Failed to authorize", e);
                }
            }}
        />
    );
}
