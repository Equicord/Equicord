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

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs, EquicordDevs } from "@utils/constants";
import { ModalContent, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { User } from "@vencord/discord-types";
import { Forms, React, Tooltip, UserStore } from "@webpack/common";
import { JSX } from "react";

type CustomBadge = {
    tooltip: string;
    badge: string;
    custom?: boolean;
};

interface BadgeCache {
    badges: { [mod: string]: CustomBadge[]; };
    expires: number;
}

let badgeImages;
const API_URL = "https://badges.equicord.org/";
const cache = new Map<string, BadgeCache>();
const EXPIRES = 1000 * 60 * 15;

const fetchBadges = (id: string): BadgeCache["badges"] | undefined => {
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

const BadgeComponent = ({ name, img }: { name: string, img: string; }) => {
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

const GlobalBadges = ({ userId }: { userId: string; }) => {
    const [badges, setBadges] = React.useState<BadgeCache["badges"]>({});
    React.useEffect(() => setBadges(fetchBadges(userId) ?? {}), [userId]);

    if (!badges) return null;
    const globalBadges: JSX.Element[] = [];
    const badgeModal: JSX.Element[] = [];

    Object.keys(badges).forEach(mod => {
        if (!badges[mod] || !Array.isArray(badges[mod]) || badges[mod].length === 0) return;

        badges[mod].forEach(badge => {
            if (!badge || !badge.tooltip || !badge.badge) return;

            let displayName = badge.tooltip;
            const prefix = settings.store.showPrefix ? mod : "";

            if (mod.toLowerCase() === "badgevault") {
                badge.custom = true;
            }

            if (badge.custom && prefix) {
                displayName = `${badge.tooltip} (${prefix})`;
            } else if (!badge.custom && prefix) {
                displayName = `${prefix} ${badge.tooltip}`;
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

const Badge: ProfileBadge = {
    component: b => <GlobalBadges {...b} />,
    position: BadgePosition.START,
    shouldShow: userInfo => !!Object.keys(fetchBadges(userInfo.userId) ?? {}).length,
    key: "GlobalBadges"
};

const settings = definePluginSettings({
    showPrefix: {
        type: OptionType.BOOLEAN,
        description: "Shows the Mod as Prefix",
        default: true,
        restartNeeded: false
    },
    showCustom: {
        type: OptionType.BOOLEAN,
        description: "Show Custom Badges",
        default: true,
        restartNeeded: false
    },
    showNekocord: {
        type: OptionType.BOOLEAN,
        description: "Show Nekocord Badges",
        default: true,
        restartNeeded: false
    },
    showReviewDB: {
        type: OptionType.BOOLEAN,
        description: "Show ReviewDB Badges",
        default: true,
        restartNeeded: false
    },
    showAero: {
        type: OptionType.BOOLEAN,
        description: "Show Aero Badges",
        default: true,
        restartNeeded: false
    },
    showAliucord: {
        type: OptionType.BOOLEAN,
        description: "Show Aliucord Badges",
        default: true,
        restartNeeded: false
    },
    showRa1ncord: {
        type: OptionType.BOOLEAN,
        description: "Show Ra1ncord Badges",
        default: true,
        restartNeeded: false
    },
    showVelocity: {
        type: OptionType.BOOLEAN,
        description: "Show Velocity Badges",
        default: true,
        restartNeeded: false
    },
    showEnmity: {
        type: OptionType.BOOLEAN,
        description: "Show Enmity Badges",
        default: true,
        restartNeeded: false
    },
    showReplugged: {
        type: OptionType.BOOLEAN,
        description: "Show Replugged Badges",
        default: true,
        restartNeeded: false
    }
});

export default definePlugin({
    name: "GlobalBadges",
    description: "Adds global badges from other client mods",
    authors: [Devs.HypedDomi, EquicordDevs.Wolfie],
    settings,
    start: () => addProfileBadge(Badge),
    stop: () => removeProfileBadge(Badge),
});

/*
Badge duping fix for modal lines below
L39 the value for everything below
L81 for not reusing globalbadges const
L100 for the size of the badges
L103 actual dupe fix
L109 is when clicking the badge open the modal
Everything below is related to the badge modal
*/
const cl = classNameFactory("vc-author-modal-");

const BadgeModalComponent = ({ name, img }: { name: string, img: string; }) => {
    return (
        <Tooltip text={name} >
            {(tooltipProps: any) => (
                <img
                    {...tooltipProps}
                    src={img}
                    style={{ width: "50px", height: "50px", margin: "2px 2px" }}
                />
            )}
        </Tooltip>
    );
};

function BadgeModal({ user }: { user: User; }) {
    return (
        <>
            <div className={cl("header")}>
                <img
                    className={cl("avatar")}
                    src={user.getAvatarURL(void 0, 512, true)}
                    alt=""
                />
                <Forms.FormTitle tag="h2" className={cl("name")}>{user.username}</Forms.FormTitle>
            </div>
            {badgeImages.length ? (
                <Forms.FormText>
                    {user.username} has {badgeImages.length} global badges.
                </Forms.FormText>
            ) : (
                <Forms.FormText>
                    {user.username} has no global badges.
                </Forms.FormText>
            )}
            {!!badgeImages.length && (
                <div className={cl("badges")}>
                    {badgeImages}
                </div>
            )}
        </>
    );
}

function openBadgeModal(user: User) {
    openModal(modalprops =>
        <ModalRoot {...modalprops}>
            <ErrorBoundary>
                <ModalContent className={cl("root")}>
                    <BadgeModal user={user} />
                </ModalContent>
            </ErrorBoundary>
        </ModalRoot>
    );
}
