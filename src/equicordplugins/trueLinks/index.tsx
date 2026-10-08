/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { Tooltip, useState } from "@webpack/common";
import type { ReactNode } from "react";

import { BRANDS } from "./brands";
import managedStyle from "./style.css?managed";
import { TrustedSites } from "./TrustedSites";

const cl = classNameFactory("vc-truelinks-");

const settings = definePluginSettings({
    warnLookalikes: {
        type: OptionType.BOOLEAN,
        description: "Mark links whose text looks like a different site in red",
        default: true,
    },
    brandIcons: {
        type: OptionType.BOOLEAN,
        description: "Show logos for well-known sites (Discord, GitLab, GitHub, YouTube…)",
        default: true,
    },
    siteIcons: {
        type: OptionType.BOOLEAN,
        description: "Show greyed favicons for other sites (loaded from DuckDuckGo; asks to allow it once)",
        default: false,
        onChange: on => on && allowFavicons(),
    },
    trustedSites: {
        type: OptionType.COMPONENT,
        component: TrustedSites,
    },
});

const FAVICONS = "https://icons.duckduckgo.com";

async function allowFavicons() {
    if (await VencordNative.csp.isDomainAllowed(FAVICONS, ["img-src"])) return;
    await VencordNative.csp.requestAddOverride(FAVICONS, ["img-src"], "TrueLinks");
}

const brandFor = (host: string) => BRANDS.find(b => b.hosts.some(h => host === h || host.endsWith("." + h)));

function SiteIcon({ host }: { host: string; }) {
    const { brandIcons, siteIcons } = settings.use(["brandIcons", "siteIcons"]);
    const [failed, setFailed] = useState(false);
    const brand = brandIcons && brandFor(host);

    if (brand) return (
        <svg className={cl("icon")} viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d={brand.path} />
        </svg>
    );
    if (siteIcons && !failed) return <img className={cl("icon", "favicon")} src={`${FAVICONS}/ip3/${host}.ico`} alt="" loading="lazy" onError={() => setFailed(true)} />;
    return null;
}

const hostOf = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
        return null;
    }
};

function textOf(node: ReactNode): string {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(textOf).join("");
    return textOf((node as any).props?.children);
}

// Text like "discord.com/nitro" or "https://steam.com" names a site; returns that site.
function claimedHost(text: string) {
    const match = text.trim().match(/^(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]|$)/i);
    return match?.[1].toLowerCase() ?? null;
}

const sameSite = (a: string, b: string) => a === b || a.endsWith("." + b) || b.endsWith("." + a);

const Badge = ErrorBoundary.wrap(({ host, lookalike }: { host: string; lookalike: boolean; }) => (
    <Tooltip text={lookalike ? `The text names a different site. This goes to ${host}` : `Goes to ${host}`}>
        {props => <span {...props} className={cl("host", { lookalike })}>{!lookalike && <SiteIcon host={host} />}{host}</span>}
    </Tooltip>
), { noop: true });

export default definePlugin({
    name: "TrueLinks",
    description: "Shows where masked links really go, and flags links pretending to be another site",
    tags: ["Chat", "Privacy"],
    authors: [EquicordDevs.Vantin, EquicordDevs.Descent, EquicordDevs.Icey23, EquicordDevs.Memory, EquicordDevs.Entagya],
    settings,
    managedStyle,

    patches: [
        {
            find: ".MASKED_LINK),",
            replacement: {
                match: /children:(\i)\?\?(\i)\}\)\}\)/,
                replace: "children:$self.withHost($1??$2,arguments[0])})})"
            }
        }
    ],

    withHost(children: ReactNode, props: { href?: string; }) {
        const host = props?.href && hostOf(props.href);
        if (!host) return children;

        const text = textOf(children).toLowerCase();
        const claimed = claimedHost(text);
        if (claimed ? sameSite(claimed, host) : text.includes(host)) return children;

        return <>{children}<Badge host={host} lookalike={!!claimed && settings.store.warnLookalikes} /></>;
    },
});
