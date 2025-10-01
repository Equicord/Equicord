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

import { classNameFactory } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { ModalContent, ModalRoot, openModal } from "@utils/modal";
import { User } from "@vencord/discord-types";
import { Forms, React, Tooltip } from "@webpack/common";

import { badgeImages } from "./badgeComponent";

export const cl = classNameFactory("vc-author-modal-");

export const BadgeModalComponent = ({ name, img }: { name: string, img: string; }) => {
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

export function BadgeModal({ user }: { user: User; }) {
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

export function openBadgeModal(user: User) {
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
