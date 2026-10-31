/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Heading } from "@components/Heading";
import { XSmallIcon } from "@components/Icons";
import { HiddenServersStore } from "@equicordplugins/hideServers/HiddenServersStore";
import { classNameFactory } from "@utils/css";
import { getGuildAcronym } from "@utils/discord";
import { classes } from "@utils/misc";
import { Guild, RenderModalProps } from "@vencord/discord-types";
import { findCssClassesLazy } from "@webpack";
import { closeModal, IconUtils, Modal, openModal, SortedGuildStore, useStateFromStores } from "@webpack/common";

const cl = classNameFactory("vc-hideservers-");
const IconClasses = findCssClassesLazy("icon", "acronym", "childWrapper");

function HiddenServersModal({ modalProps, close }: { modalProps: RenderModalProps; close(): void; }) {
    const guilds = useStateFromStores([HiddenServersStore], () => HiddenServersStore.hiddenGuildsDetail());
    return (
        <Modal {...modalProps} size="lg" title="Hidden Servers">
            <HiddenServersMenu guilds={guilds} />
        </Modal>
    );
}

function isGuildHidden(guild: Guild, SortedGuildStore: any) {
    const folder = SortedGuildStore.getGuildFolders().find((f: any) => f.guildIds.includes(guild.id));
    if (folder && HiddenServersStore.hiddenGuilds.has("folder-" + folder.folderId)) return true;
    return HiddenServersStore.hiddenGuilds.has(guild.id);
}

function getFolderForGuild(SortedGuildStore: any, guildId: string) {
    return SortedGuildStore.getGuildFolders()
        .filter((f: any) => f.folderId !== undefined)
        .find((f: any) => f.guildIds.includes(guildId));
}

function restoreGuild(guild: Guild, SortedGuildStore: any) {
    HiddenServersStore.removeHiddenGuild(guild.id);

    const folder = getFolderForGuild(SortedGuildStore, guild.id);
    if (!folder) return;

    HiddenServersStore.removeHiddenGuild("folder-" + folder.folderId);
}

function GuildRow({ guild }) {
    return (
        <div key={guild.id} className={cl("row")}>
            <div className={cl("guildicon")}>
                {guild.icon ? (
                    <img
                        alt=""
                        src={IconUtils.getGuildIconURL({
                            id: guild.id,
                            icon: guild.icon,
                            canAnimate: true,
                            size: 240,
                        })}
                    />
                ) : (
                    <div
                        aria-hidden
                        className={classes(IconClasses.childWrapper, IconClasses.acronym)}
                    >
                        {getGuildAcronym(guild)}
                    </div>
                )}
            </div>
            <BaseText size="md" weight="medium" className={cl("name")}>
                {guild.name}
            </BaseText>
            <Button
                variant="dangerSecondary"
                size="iconOnly"
                onClick={() => restoreGuild(guild, SortedGuildStore)}
            >
                <XSmallIcon/>
            </Button>
        </div>
    );
}

function Group({ folderName, guilds }) {
    return (
        <Card variant="primary" className={cl("folder-group")}>
            <div className={cl("folder-header")}>
                <Heading tag="h4">{folderName}</Heading>
                <Button
                    variant="dangerSecondary"
                    onClick={() => {
                        guilds.forEach(g => restoreGuild(g, SortedGuildStore));
                    }}
                    size="small"
                    className={cl("restore-all")}
                >
                    Remove All
                </Button>
            </div>
            <div className={cl("rows")}>
                {guilds.map(guild => (
                <GuildRow
                    key={guild.id}
                    guild={guild}
                />
            ))}
            </div>
        </Card>
    );
}

export function HiddenServersMenu({ guilds }: { guilds: Guild[]; }) {
    const hiddenGuilds = guilds.filter(g => isGuildHidden(g, SortedGuildStore));
    const folders: Record<string, Guild[]> = {};
    const guildsWithoutFolder: Guild[] = [];

    hiddenGuilds.forEach(guild => {
        const folder = getFolderForGuild(SortedGuildStore, guild.id);
        if (folder) {
            if (!folders[folder.folderId]) folders[folder.folderId] = [];
            folders[folder.folderId].push(guild);
        } else {
            guildsWithoutFolder.push(guild);
        }
    });

    return <div className={cl("list")}>
        {Object.entries(folders).map(([folderId, folderGuilds]) => {
            const folder = SortedGuildStore.getGuildFolders().find(f => f.folderId === Number(folderId));
            if (!folder) return null;

            return (
                <Group
                    key={folderId}
                    folderName={folder.folderName}
                    guilds={folderGuilds}
                />
            );
        })}

        {guildsWithoutFolder.length > 0 ? (
            <Group
                folderName="Guilds"
                guilds={guildsWithoutFolder}
            />
        ) : null}

        {hiddenGuilds.length === 0 && <BaseText size="md" weight="medium">No hidden servers</BaseText>}
    </div>;
}

export function openHiddenServersModal() {
    const key = openModal(modalProps => {
        return (
            <HiddenServersModal
                modalProps={modalProps}
                close={() => closeModal(key)}
            />
        );
    });
}
