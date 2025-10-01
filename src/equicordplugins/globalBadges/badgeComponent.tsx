/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { React, Tooltip, UserStore } from "@webpack/common";
import { JSX } from "react";

import { BadgeModalComponent, openBadgeModal } from "./badgeModal";
import { settings } from "./settings";

type CustomBadge = {
    tooltip: string;
    badge: string;
    custom?: boolean;
};

interface BadgeCache {
    badges: { [mod: string]: CustomBadge[]; };
    expires: number;
}

export let badgeImages;
const API_URL = "https://badges.equicord.org/";
const cache = new Map<string, BadgeCache>();
const EXPIRES = 1000 * 60 * 15;

export const serviceMap = {
    "nekocord": "Nekocord",
    "reviewdb": "ReviewDB",
    "aero": "Aero",
    "aliucord": "Aliucord",
    "ra1ncord": "Ra1ncord",
    "velocity": "Velocity",
    "enmity": "Enmity",
    "replugged": "Replugged",
    "badgevault": "BadgeVault"
};

export const fetchBadges = (id: string): BadgeCache["badges"] | undefined => {
    const cachedValue = cache.get(id);
    if (!cache.has(id) || (cachedValue && cachedValue.expires < Date.now())) {
        const services: string[] = [];
        if (settings.store.showNekocord) services.push("nekocord");
        if (settings.store.showReviewDB) services.push("reviewdb");
        if (settings.store.showAero) services.push("aero");
        if (settings.store.showAliucord) services.push("aliucord");
        if (settings.store.showRa1ncord) services.push("ra1ncord");
        if (settings.store.showVelocity) services.push("velocity");
        if (settings.store.showEnmity) services.push("enmity");
        if (settings.store.showReplugged) services.push("replugged");
        if (settings.store.showCustom) services.push("badgevault");

        if (services.length === 0) {
            cache.set(id, { badges: {}, expires: Date.now() + EXPIRES });
            return {};
        }

        fetch(`${API_URL}${id}?seperated=true&services=${services.join(",")}`)
            .then(res => res.json() as Promise<{ status: number; badges: BadgeCache["badges"]; }>)
            .then(body => {
                cache.set(id, { badges: body.badges, expires: Date.now() + EXPIRES });
                return body.badges;
            })
            .catch(() => null);
    } else if (cachedValue) {
        return cachedValue.badges;
    }
};

export const BadgeComponent = ({ name, img }: { name: string, img: string; }) => {
    return (
        <Tooltip text={name} >
            {(tooltipProps: any) => (
                <img
                    {...tooltipProps}
                    src={img}
                    style={{
                        width: "20px",
                        height: "20px",
                        transform: name.includes("Replugged") ? "scale(0.9)" : null
                    }}
                />
            )}
        </Tooltip>
    );
};

export const GlobalBadges = ({ userId }: { userId: string; }) => {
    const [badges, setBadges] = React.useState<BadgeCache["badges"]>({});
    React.useEffect(() => setBadges(fetchBadges(userId) ?? {}), [userId]);

    if (!badges) return null;
    const globalBadges: JSX.Element[] = [];
    const badgeModal: JSX.Element[] = [];

    Object.keys(badges).forEach(mod => {
        if (!badges[mod] || !Array.isArray(badges[mod]) || badges[mod].length === 0) return;

        badges[mod].forEach(badge => {
            if (!badge || !badge.tooltip || !badge.badge) return;

            const modDisplay = serviceMap[mod.toLowerCase()] || mod;
            const prefix = settings.store.showPrefix ? `(${modDisplay})` : "";
            const suffix = settings.store.showSuffix ? `(${modDisplay})` : "";
            const displayName = `${prefix} ${badge.tooltip} ${suffix}`;

            if (mod.toLowerCase() === "badgevault") {
                badge.custom = true;
            }

            globalBadges.push(<BadgeComponent name={displayName} img={badge.badge} />);
            badgeModal.push(<BadgeModalComponent name={displayName} img={badge.badge} />);
        });
    });
    badgeImages = badgeModal;

    return (
        <div
            className="vc-global-badges"
            style={{ alignItems: "center", display: "flex" }}
            onClick={_ => openBadgeModal(UserStore.getUser(userId))}
        >
            {globalBadges}
        </div>
    );
};
