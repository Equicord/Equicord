/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Flex, FlexProps } from "@components/Flex";
import { RightArrow } from "@components/Icons";
import { iconsModule } from "@equicordplugins/_core/concatenatedModules";
import { MessageAttachment } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { findByCodeLazy, findComponentByCodeLazy, findCssClassesLazy } from "@webpack";
import { ChannelStore, DateUtils, GuildStore, IconUtils, match, NavigationRouter, Popout, React, SelectedGuildStore, SnowflakeUtils, useMemo, useRef, UserStore, useStateFromStores } from "@webpack/common";
import { PropsWithChildren } from "react";

import { cl, ForwardOptionsContext, ForwardOptionsState } from ".";

type AttachmentType = "IMAGE" | "VIDEO" | "CLIP" | "AUDIO" | "VISUAL_PLACEHOLDER" | "PLAINTEXT_PREVIEW" | "OTHER" | "INVALID";

const tagClasses = findCssClassesLazy("tagList", "tagGroup", "tag");
const ServerProfileComponent = findComponentByCodeLazy("{guildProfile:", "GUILD_PROFILE");
const getAttachmentType: (attachment: MessageAttachment, inlineAttachmentMedia?: boolean) => AttachmentType = findByCodeLazy('"PLAINTEXT_PREVIEW":"OTHER"');

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

export function ForwardPicker() {
    const state = React.useContext(ForwardOptionsContext);

    if (state.message.embeds.length + state.message.attachments.length === 0) return null;

    return (
        <Flex gap={12} flexDirection="column">
            {state.message.attachments.length > 0 && <AttachmentPicker {...state} />}
            {state.message.embeds.length > 0 && <EmbedPicker {...state} />}
        </Flex>
    );
}

export function EmbedPicker({ message, opts, setOpts, hasOpts, defaultOpts }: ForwardOptionsState) {
    const embeds = useMemo(() => {
        let id = 0;
        return message.embeds.map(({ rawTitle, rawDescription, image, images = image ? [image] : [], video }, i) => {
            const current = {
                title: rawTitle?.trim() || rawDescription?.trim() || `Embed ${i + 1}`,
                subEmbeds: [] as { id: number; name: string; isMainEmbed: boolean; }[]
            };

            if (images.length > 0) {
                // The "main" embed is the first embed with the same url (in 99% cases), which is used for displaying embed metadata (title, description, etc).
                // It's only possible to tell it apart in the raw API message source since the client groups all related embeds together.
                current.subEmbeds = images.map((image, si) => ({
                    id: id++,
                    name: `${si === 0 ? "Embed + " : ""}Image ${images.length > 1 ? `${si + 1} ` : ""}(${image!.width} x ${image!.height})`,
                    isMainEmbed: si === 0
                }));
            } else if (video) {
                current.subEmbeds = [{ id: id++, name: "Embed + Video", isMainEmbed: true }];
            } else {
                current.subEmbeds = [{ id: id++, name: "Embed", isMainEmbed: true }];
            }

            return current;
        });
    }, [message]);

    const { EmbedIcon, ImageIcon } = iconsModule;

    return embeds.map(({ title, subEmbeds }) => (
        <Flex gap={4} flexDirection="column" key={subEmbeds[0].id}>
            <BaseText
                size="sm"
                color="text-subtle"
                className={cl("embed-name")}
                style={{ opacity: !hasOpts ? 0.5 : undefined }}
            >
                {title}
            </BaseText>
            <TagContainer>
                {subEmbeds.map(({ id, name, isMainEmbed }) => {
                    const Icon = isMainEmbed ? EmbedIcon : ImageIcon;
                    return (
                        <Tag
                            key={id}
                            id={id}
                            source={hasOpts ? (opts.onlyEmbedIndices ?? []) : defaultOpts.onlyEmbedIndices}
                            onChange={data => setOpts(prev => ({ ...prev, onlyEmbedIndices: data }))}
                            disabled={!hasOpts}
                        >
                            {Icon && <Icon size="xs" style={{ flexShrink: 0 }} />}
                            <BaseText size="sm">{name}</BaseText>
                        </Tag>
                    );
                })}
            </TagContainer>
        </Flex>
    ));
}

export function AttachmentPicker({ message, opts, setOpts, hasOpts, defaultOpts }: ForwardOptionsState) {
    return (
        <TagContainer>
            {message.attachments.map(attachment => (
                <Tag
                    key={attachment.id}
                    id={attachment.id}
                    source={hasOpts ? opts.onlyAttachmentIds ?? [] : defaultOpts.onlyAttachmentIds}
                    onChange={data => setOpts(prev => ({ ...prev, onlyAttachmentIds: data }))}
                    disabled={!hasOpts}
                >
                    <AttachmentIcon attachment={attachment} />
                    <BaseText size="sm">{attachment.filename}</BaseText>
                </Tag>
            ))}
        </TagContainer>
    );
}

function TagContainer(props: FlexProps) {
    return <Flex gap={8} flexWrap="wrap" className={tagClasses.tagGroup} data-layout="inline" {...props} />;
}

function Tag<T>({ id, children, source, onChange, disabled }: { id: T; source: T[]; onChange: (data: T[]) => void; disabled?: boolean; } & PropsWithChildren) {
    const selected = useMemo(() => source.includes(id), [source, id]);

    return (
        <div
            className={tagClasses.tag}
            data-selection-mode="multiple"
            data-selected={!disabled &&selected ? "true" : undefined}
            onClick={() => onChange(selected ? source.filter(x => x !== id) : [...source, id])}
            style={{ textWrap: "wrap", opacity: disabled ? .5 : undefined }}
            inert={disabled}
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
