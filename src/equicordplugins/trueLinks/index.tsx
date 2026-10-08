/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import definePlugin, { OptionType } from "@utils/types";
import { Tooltip, useState } from "@webpack/common";
import type { ReactNode } from "react";

import { BRANDS } from "./brands";
import { TrustedSites } from "./TrustedSites";

const cl = classNameFactory("vc-truelinks-");
const FAVICONS = "https://icons.duckduckgo.com";

const settings = definePluginSettings({
    warnLookalikes: {
        type: OptionType.BOOLEAN,
        description: "Turn the label red when a link pretends to be another site",
        default: true,
    },
    brandIcons: {
        type: OptionType.BOOLEAN,
        description: "Show logos for popular sites",
        default: true,
    },
    siteIcons: {
        type: OptionType.BOOLEAN,
        description: "Show icons for all other sites",
        default: false,
        async onChange(enabled: boolean) {
            if (enabled && !await VencordNative.csp.isDomainAllowed(FAVICONS, ["img-src"]))
                VencordNative.csp.requestAddOverride(FAVICONS, ["img-src"], "TrueLinks");
        },
    },
    trustedSites: {
        type: OptionType.COMPONENT,
        component: TrustedSites,
    },
});

function hostOf(url: string) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return null;
    }
}

function textOf(node: ReactNode): string {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(textOf).join("");
    return (node as any)?.props ? textOf((node as any).props.children) : "";
}

const isSameSite = (a: string, b: string) => a === b || a.endsWith("." + b) || b.endsWith("." + a);

const POPULAR = [
    "discord.com", "discord.gg", "discord.gift", "discordapp.com", "steamcommunity.com", "steampowered.com",
    "github.com", "gitlab.com", "youtube.com", "twitch.tv", "roblox.com", "epicgames.com", "paypal.com", "spotify.com",
];

function imitates(host: string) {
    if (POPULAR.some(site => isSameSite(host, site))) return;
    const name = host.split(".").at(-2) ?? "";
    return POPULAR.find(site => {
        const real = site.split(".")[0];
        const diff = [...real].filter((c, i) => c !== name[i]).length;
        return real.length >= 5 && name.length === real.length && diff > 0 && diff <= (real.length >= 10 ? 2 : 1);
    });
}

function warningFor(host: string, claimed?: string) {
    if (claimed && !isSameSite(claimed, host)) return `Actually goes to ${host}`;
    if (host.split(".").some(part => part.startsWith("xn--"))) return `${host} uses look-alike letters`;
    const site = imitates(host);
    if (site) return `${host} is not ${site}`;
}

function SiteIcon({ host }: { host: string; }) {
    const { brandIcons, siteIcons } = settings.use(["brandIcons", "siteIcons"]);
    const [failed, setFailed] = useState(false);
    const brand = brandIcons && BRANDS.find(b => b.hosts.some(h => isSameSite(host, h)));

    if (brand) return <svg className={cl("icon")} viewBox="0 0 24 24"><path fill="currentColor" d={brand.path} /></svg>;
    if (siteIcons && !failed) return <img className={cl("icon", "favicon")} src={`${FAVICONS}/ip3/${host}.ico`} alt="" onError={() => setFailed(true)} />;
    return null;
}

const Host = ErrorBoundary.wrap(({ host, warning }: { host: string; warning?: string; }) => (
    <Tooltip text={warning ?? `Goes to ${host}`}>
        {props => (
            <span {...props} className={cl("host", { lookalike: !!warning })}>
                {!warning && <SiteIcon host={host} />}
                {host}
            </span>
        )}
    </Tooltip>
), { noop: true });

export default definePlugin({
    name: "TrueLinks",
    description: "Shows where masked links really go",
    tags: ["Chat", "Privacy"],
    authors: [EquicordDevs.Vantin, EquicordDevs.Descent, EquicordDevs.Icey23, EquicordDevs.Memory, EquicordDevs.Entagya],
    settings,

    patches: [
        {
            find: ".MASKED_LINK),",
            replacement: {
                match: /children:(\i)\?\?(\i)\}\)\}\)/,
                replace: "children:$self.renderLink($1??$2,arguments[0])})})"
            }
        }
    ],

    renderLink(children: ReactNode, { href, className }: { href?: string; className?: string; }) {
        const host = href && hostOf(href);
        if (!host) return children;

        const text = textOf(children).trim().toLowerCase();
        const claimed = text.match(/^(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/:?#]|$)/)?.[1];
        const warning = settings.store.warnLookalikes ? warningFor(host, claimed) : undefined;
        const obvious = claimed ? isSameSite(claimed, host) : text.includes(host);
        if (!warning && (obvious || className?.includes("embed"))) return children;

        return <>{children}<Host host={host} warning={warning} /></>;
    },
});
