/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Flex, FlexProps } from "@components/Flex";
import { RightArrow } from "@components/Icons";
import { Margins } from "@components/margins";
import { iconsModule } from "@equicordplugins/_core/concatenatedModules";
import { Message, MessageAttachment } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { findByCodeLazy, findComponentByCodeLazy, findCssClassesLazy } from "@webpack";
import { ChannelStore, DateUtils, GuildStore, IconUtils, match, NavigationRouter, Popout, SelectedGuildStore, SnowflakeUtils, Tooltip, useMemo, useRef, UserStore, useStateFromStores } from "@webpack/common";
import { Dispatch, PropsWithChildren, SetStateAction } from "react";

import { cl, ForwardOptions } from ".";

type AttachmentType = "IMAGE" | "VIDEO" | "CLIP" | "AUDIO" | "VISUAL_PLACEHOLDER" | "PLAINTEXT_PREVIEW" | "OTHER" | "INVALID";

const tagClasses = findCssClassesLazy("tagList", "tagGroup", "tag");
const ServerProfileComponent = findComponentByCodeLazy("{guildProfile:", "GUILD_PROFILE");
const getAttachmentType: (attachment: MessageAttachment, inlineAttachmentMedia?: boolean) => AttachmentType =
    findByCodeLazy('"PLAINTEXT_PREVIEW":"OTHER"');

export function GuildName({ guildId }: { guildId: string; }) {
    const guild = useStateFromStores(
        [GuildStore, SelectedGuildStore],
        () => {
            const current = SelectedGuildStore.getGuildId();
            return current !== guildId ? GuildStore.getGuild(guildId) : null;
        },
        [guildId]
    );
    const icon = useMemo(() => {
        if (!guild?.icon) return null;
        return IconUtils.getGuildIconURL({ id: guildId, icon: guild.icon, canAnimate: true, size: 16 });
    }, [guildId, guild?.icon]);

    const guildDivRef = useRef(null);

    return (
        guild && (
            <Popout
                position="top"
                renderPopout={() => <ServerProfileComponent guildId={guildId} />}
                targetElementRef={guildDivRef}
            >
                {popoutProps => (
                    <div ref={guildDivRef} className={cl("footer-element")} {...popoutProps}>
                        {icon && <img src={icon} alt={`Server icon for ${guild.name}`} className={cl("guild-icon")} />}
                        <BaseText size="sm" weight="medium" className={cl("footer-text")}>
                            {guild ? guild.name : "View server"}
                        </BaseText>
                        <RightArrow width={12} height={12} fill="var(--text-muted)" />
                    </div>
                )}
            </Popout>
        )
    );
}

export function ChannelName({ guildId, channelId, messageId }: { guildId?: string; channelId: string; messageId: string; }) {
    const name = useStateFromStores(
        [ChannelStore, UserStore],
        () => {
            const channel = ChannelStore.getChannel(channelId);
            if (!channel) return null;

            return match(channel.type)
                .with(ChannelType.DM, () => {
                    const user = UserStore.getUser(channel.recipients[0]);
                    return `@${user.globalName || user.username}`;
                })
                .with(ChannelType.GROUP_DM, () => {
                    if (channel.name) return channel.name;
                    const users = channel.recipients.map(r => UserStore.getUser(r));
                    return users.map(u => u.globalName || u.username).join(", ");
                })
                .with(
                    ChannelType.ANNOUNCEMENT_THREAD,
                    ChannelType.PRIVATE_THREAD,
                    ChannelType.PUBLIC_THREAD,
                    () => channel.name
                )
                .otherwise(() => `#${channel.name}`);
        },
        [channelId]
    );

    return (
        name && (
            <div
                className={cl("footer-element")}
                onClick={() => NavigationRouter.transitionTo(`/channels/${guildId ?? "@me"}/${channelId}/${messageId}`)}
            >
                <BaseText size="sm" weight="medium" className={cl("footer-text")}>
                    {name}
                </BaseText>
                <RightArrow width={12} height={12} fill="var(--text-muted)" />
            </div>
        )
    );
}

export function Timestamp({ snowflake }: { snowflake: string; }) {
    const formatted = useMemo(
        () => DateUtils.calendarFormat(new Date(SnowflakeUtils.extractTimestamp(snowflake))),
        [snowflake]
    );

    return (
        <div className={cl("footer-element")} style={{ pointerEvents: "none" }}>
            <BaseText size="sm" weight="medium" className={cl("footer-text")}>
                {formatted}
            </BaseText>
        </div>
    );
}

export function ForwardPicker({ message, options, onChange }: { message: Message; options: ForwardOptions; onChange: Dispatch<SetStateAction<ForwardOptions>>; }) {
    const textEnabled = !options.onlyAttachmentIds && !options.onlyEmbedIndices;
    const embeds = useMemo(() => {
        let id = 0;
        return message.embeds.map(({ rawTitle, rawDescription, image, images = image ? [image] : [], video }, i) => {
            const current = {
                title: rawTitle?.trim() || rawDescription?.trim() || `Embed ${i + 1}`,
                subEmbeds: [] as { id: number; name: string; }[]
            };

            if (images.length > 0) {
                current.subEmbeds = images.map((image, i) => ({
                    id: id++,
                    name: `Image ${images.length > 1 ? `${i + 1} ` : ""}(${image!.width} x ${image!.height})`
                }));
            } else if (video) {
                current.subEmbeds = [{ id: id++, name: "Video" }];
            } else {
                current.subEmbeds = [{ id: id++, name: "Embed" }];
            }

            return current;
        });
    }, [message]);

    const defaultOpts = useMemo(
        () => ({
            onlyAttachmentIds: message.attachments.map(a => a.id),
            onlyEmbedIndices: embeds.flatMap(e => e.subEmbeds.map(se => se.id))
        }),
        [message, embeds]
    );

    const { EmbedIcon, ChatIcon } = iconsModule;

    return (
        <Flex className={Margins.top8} gap={12} flexDirection="column">
            <TagContainer>
                <Tooltip text="Can be used when all embeds and attachments are enabled">
                    {props => (
                        <div
                            className={tagClasses.tag}
                            data-selection-mode="multiple"
                            data-selected={textEnabled ? "true" : undefined}
                            {...props}
                            onClick={() => (onChange(textEnabled ? defaultOpts : {}), props.onClick())}
                        >
                            {ChatIcon && <ChatIcon size="xs" style={{ flexShrink: 0 }} />}
                            <BaseText size="sm">Original message</BaseText>
                        </div>
                    )}
                </Tooltip>
                {message.attachments.map(attachment => (
                    <Tag
                        key={attachment.id}
                        id={attachment.id}
                        source={options.onlyAttachmentIds ?? defaultOpts.onlyAttachmentIds}
                        onChange={data => onChange(prev => ({ ...prev, onlyAttachmentIds: data }))}
                    >
                        <AttachmentIcon attachment={attachment} />
                        <BaseText size="sm">{attachment.filename}</BaseText>
                    </Tag>
                ))}
            </TagContainer>
            {embeds.map(({ title, subEmbeds }) => (
                <Flex gap={4} flexDirection="column" key={subEmbeds[0].id}>
                    <BaseText
                        size="sm"
                        color="text-muted"
                        style={{ textWrap: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                        {title}
                    </BaseText>
                    <TagContainer>
                        {subEmbeds.map(({ id, name }) => (
                            <Tag
                                key={id}
                                id={id}
                                source={options.onlyEmbedIndices ?? defaultOpts.onlyEmbedIndices}
                                onChange={data => onChange(prev => ({ ...prev, onlyEmbedIndices: data }))}
                            >
                                {EmbedIcon && <EmbedIcon size="xs" style={{ flexShrink: 0 }} />}
                                <BaseText size="sm">{name}</BaseText>
                            </Tag>
                        ))}
                    </TagContainer>
                </Flex>
            ))}
        </Flex>
    );
}

function TagContainer(props: FlexProps) {
    return <Flex gap={8} flexWrap="wrap" className={tagClasses.tagGroup} data-layout="inline" {...props} />;
}

function Tag<T>({ id, children, source, onChange }: { id: T; source: T[]; onChange: (data: T[]) => void; } & PropsWithChildren) {
    const selected = useMemo(() => source.includes(id), [source, id]);

    return (
        <div
            className={tagClasses.tag}
            data-selection-mode="multiple"
            data-selected={selected ? "true" : undefined}
            onClick={() => onChange(selected ? source.filter(x => x !== id) : [...source, id])}
            style={{ textWrap: "wrap" }}
        >
            {children}
        </div>
    );
}

const icons: Partial<Record<AttachmentType, string>> = {
    IMAGE: "Image",
    VIDEO: "Video",
    CLIP: "Clips",
    AUDIO: "Music",
    PLAINTEXT_PREVIEW: "A"
};

function AttachmentIcon({ attachment }: { attachment: MessageAttachment; }) {
    const Icon = useMemo(() => {
        const type = getAttachmentType(attachment, true);
        return iconsModule[(icons[type] ?? "ImageFile") + "Icon"];
    }, [attachment]);

    return Icon && <Icon size="xs" style={{ flexShrink: 0 }} />;
}
