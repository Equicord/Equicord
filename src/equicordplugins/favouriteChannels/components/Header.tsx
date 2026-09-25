/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { ChevronSmallDownIcon, StarFilled } from "@components/Icons";
import { classNameFactory } from "@utils/css";
import { classes } from "@utils/misc";
import { Popout, Tooltip, useRef } from "@webpack/common";

import { headerClasses } from "./discord";
import { PlusIcon } from "./icons";
import { AddMenu, FavouritesSettingsMenu } from "./Menus";

const cl = classNameFactory("vc-favourites-");

export function FavouritesHeader() {
    const containerRef = useRef<HTMLDivElement>(null);
    const addRef = useRef<HTMLDivElement>(null);

    return (
        <div ref={containerRef} className={headerClasses.container} data-has-banner="false" data-banner-visible="false">
            <header className={headerClasses.header}>
                <div className={classes(headerClasses.headerContent, headerClasses.primaryInfo)}>
                    <Popout
                        targetElementRef={containerRef}
                        position="bottom"
                        align="center"
                        spacing={4}
                        renderPopout={({ closePopout }) => <FavouritesSettingsMenu navId="vc-favourites-header-popout" variant="fixed" onClose={closePopout} />}
                    >
                        {(props, { isShown }) => (
                            <div
                                {...props}
                                className={headerClasses.guildDropdown}
                                aria-label="Favourites, server actions"
                                aria-expanded={isShown}
                                role="button"
                                tabIndex={0}
                            >
                                <div className={headerClasses.guildBadgeAndName}>
                                    <StarFilled className={headerClasses.favoritesIcon} width={20} height={20} />
                                    <BaseText tag="h2" size="md" weight="semibold" lineClamp={1} className={headerClasses.name}>Favourites</BaseText>
                                </div>
                                <div className={headerClasses.headerChildren}>
                                    <ChevronSmallDownIcon width={16} height={16} />
                                </div>
                            </div>
                        )}
                    </Popout>
                    <Popout
                        targetElementRef={addRef}
                        position="bottom"
                        align="left"
                        spacing={4}
                        renderPopout={({ closePopout }) => <AddMenu navId="vc-favourites-header-add" onClose={closePopout} />}
                    >
                        {(popoutProps, { isShown }) => (
                            <Tooltip text="Add to Favourites" position="bottom" shouldShow={!isShown}>
                                {tooltipProps => (
                                    <span>
                                        <div
                                            {...tooltipProps}
                                            {...popoutProps}
                                            ref={addRef}
                                            className={headerClasses.addActionButton}
                                            aria-label="Add to Favourites"
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <PlusIcon width={20} height={20} />
                                        </div>
                                    </span>
                                )}
                            </Tooltip>
                        )}
                    </Popout>
                </div>
            </header>
            <div className={classes(headerClasses.headerEllipseBackdrop, cl("header-backdrop"))} />
            <div className={headerClasses.headerEllipseForeground} />
        </div>
    );
}
