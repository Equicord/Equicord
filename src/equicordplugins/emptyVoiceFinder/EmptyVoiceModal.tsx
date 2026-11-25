/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Span } from "@components/Span";
import { classNameFactory } from "@utils/css";
import type { RenderModalProps } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { ChannelActions, ChannelStore, Clickable, GuildChannelStore, GuildStore, lodash, Modal, openModal, PermissionsBits, PermissionStore, TextInput, useState, useStateFromStores, VoiceStateStore } from "@webpack/common";

import { getIgnored, IgnoredIds, settings, toggleIgnored } from ".";

const cl = classNameFactory("vc-empty-voice-finder-");

export function getVoiceCategories(guildId: string) {
    const { ignoreAfk, includeStages } = settings.store;
    const { afkChannelId } = GuildStore.getGuild(guildId);
    const { VOCAL, [ChannelType.GUILD_CATEGORY]: categories } = GuildChannelStore.getChannels(guildId);

    const channels = VOCAL
        .map(({ channel }) => channel)
        .filter(channel =>
            (channel.isGuildVoice() || (includeStages && channel.isGuildStageVoice()))
            && !(ignoreAfk && channel.id === afkChannelId)
            && PermissionStore.can(PermissionsBits.VIEW_CHANNEL, channel)
            && PermissionStore.can(PermissionsBits.CONNECT, channel)
        )
        .map(({ id, name, parent_id, userLimit }) => ({
            id,
            name,
            userLimit,
            parentId: parent_id ?? "",
            userCount: Object.keys(VoiceStateStore.getVoiceStatesForChannel(id)).length
        }));

    return lodash.sortBy(
        Object.values(lodash.groupBy(channels, "parentId")),
        ([{ parentId }]) => categories.findIndex(({ channel }) => channel.id === parentId)
    ).map(group => ({
        id: group[0].parentId,
        name: ChannelStore.getChannel(group[0].parentId)?.name ?? "Uncategorized",
        channels: group
    }));
}

function EmptyVoiceModal({ guildId, ...modalProps }: RenderModalProps & { guildId: string; }) {
    const [query, setQuery] = useState("");
    const [showIgnored, setShowIgnored] = useState(false);
    const [ignored, setIgnored] = useState(() => getIgnored(guildId));
    const categories = useStateFromStores(
        [ChannelStore, GuildChannelStore, GuildStore, PermissionStore, VoiceStateStore],
        () => getVoiceCategories(guildId),
        [guildId],
        lodash.isEqual
    );

    const search = query.trim().toLowerCase();
    const visibleCategories = categories.flatMap(category => {
        const isCategoryIgnored = ignored.categories.includes(category.id);
        const matchesCategory = category.name.toLowerCase().includes(search);
        const channels = category.channels.filter(({ id, name, userCount }) => {
            if (!matchesCategory && !name.toLowerCase().includes(search)) return false;

            const isIgnored = isCategoryIgnored || ignored.channels.includes(id);
            return showIgnored ? isIgnored : !isIgnored && userCount === 0;
        });

        return channels.length ? [{ ...category, channels, isIgnored: isCategoryIgnored }] : [];
    });

    function toggle(key: keyof IgnoredIds, id: string) {
        setIgnored(toggleIgnored(guildId, key, id));
    }

    function join(channelId: string) {
        ChannelActions.selectVoiceChannel(channelId);
        modalProps.onClose();
    }

    return (
        <Modal {...modalProps} size="md" title="Empty Voice Channels">
            <div className={cl("controls")}>
                <TextInput autoFocus placeholder="Search channels or categories" value={query} onChange={setQuery} />
                <FormSwitch title="Show ignored" value={showIgnored} onChange={setShowIgnored} hideBorder />
            </div>

            {visibleCategories.map(category => (
                <div key={category.id} className={cl("category")}>
                    <div className={cl("header")}>
                        <Heading className={cl("name")}>{category.name}</Heading>
                        {category.id && showIgnored === category.isIgnored && (
                            <Button variant="secondary" size="small" onClick={() => toggle("categories", category.id)}>
                                {showIgnored ? "Unignore" : "Ignore category"}
                            </Button>
                        )}
                    </div>

                    {category.channels.map(({ id, name, userCount, userLimit }) => (
                        <div key={id} className={cl("row")}>
                            <Clickable className={cl("channel")} onClick={() => join(id)}>
                                <Span size="md" className={cl("name")}>{name}</Span>
                                <Span color="text-subtle">{userCount}/{userLimit || "∞"}</Span>
                            </Clickable>
                            {(!showIgnored || ignored.channels.includes(id)) && (
                                <Button variant="secondary" size="small" onClick={() => toggle("channels", id)}>
                                    {showIgnored ? "Unignore" : "Ignore"}
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            ))}

            {!visibleCategories.length && (
                <Paragraph className={cl("category")}>
                    {showIgnored ? "No ignored voice channels found." : "No empty voice channels found."}
                </Paragraph>
            )}
        </Modal>
    );
}

export function openEmptyVoiceModal(guildId: string) {
    openModal(props => <EmptyVoiceModal {...props} guildId={guildId} />);
}
