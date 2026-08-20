/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Flex, FlexProps } from "@components/Flex";
import { RightArrow } from "@components/Icons";
import { iconsModule } from "@equicordplugins/_core/concatenatedModules";
import { getGuildAcronym, getIntlMessage } from "@utils/discord";
import { getUserAvatarUrl } from "@utils/misc";
import { BasicGuild, Guild, MessageAttachment } from "@vencord/discord-types";
import { findByCodeLazy, findComponentByCodeLazy, findCssClassesLazy } from "@webpack";
import { BasicGuildStore, ChannelActionCreators, ChannelStore, DateUtils, GuildStore, IconUtils, Popout, React, RelationshipStore, SelectedGuildStore, SnowflakeUtils, useEffect, useMemo, useRef, UserStore, useStateFromStores } from "@webpack/common";
import { PropsWithChildren, ReactNode } from "react";

import { cl, ForwardOptionsContext, ForwardOptionsState } from ".";

type AttachmentType = "IMAGE" | "VIDEO" | "CLIP" | "AUDIO" | "VISUAL_PLACEHOLDER" | "PLAINTEXT_PREVIEW" | "OTHER" | "INVALID";

const tagClasses = findCssClassesLazy("tagList", "tagGroup", "tag");
const ServerProfileComponent = findComponentByCodeLazy("{guildProfile:", "GUILD_PROFILE");
const getAttachmentType = findByCodeLazy('"PLAINTEXT_PREVIEW":"OTHER"');
const formatChannelName = findByCodeLazy("#{intl::NO_ACCESS}", "isObfuscated()");
const getChannelIcon = findByCodeLazy("textFocused:", "isGameInvitesChannel()");
const navigateTo = findByCodeLazy('getConfig({location:"channel_mention"})');
const fetchBasicGuild = findByCodeLazy('type:"BASIC_GUILD_FETCH_SUCCESS"');

export function GuildName({ guildId }: { guildId: string; }) {
    const currentGuildId = useStateFromStores([SelectedGuildStore], () => SelectedGuildStore.getGuildId(), []);
    const guild: Guild | BasicGuild | undefined = useStateFromStores(
        [GuildStore, BasicGuildStore],
        () => GuildStore.getGuild(guildId) ?? BasicGuildStore.getGuild(guildId),
        [guildId]
    );

    const icon = useMemo(() => {
        if (!guild) return null;

        return guild.icon ? (
            <img
                src={IconUtils.getGuildIconURL({ ...guild, canAnimate: true, size: 16 })}
                alt={`Server icon for ${guild.name}`}
                className={cl("guild-icon")}
            />
        ) : (
            <div className={cl("guild-acronym")}>{getGuildAcronym(guild)}</div>
        );
    }, [guild]);

    const guildDivRef = useRef(null);

    useEffect(() => void fetchBasicGuild(guildId), [guildId]);

    return (
        currentGuildId !== guildId && (
            <Popout
                position="top"
                renderPopout={() => <ServerProfileComponent guildId={guildId} />}
                targetElementRef={guildDivRef}
            >
                {popoutProps => (
                    <div ref={guildDivRef} className={cl("footer-element")} {...popoutProps}>
                        {icon}
                        <BaseText size="sm" weight="medium" className={cl("footer-text")}>
                            {guild ? guild.name : "View server"}
                        </BaseText>
                        <RightArrow width={12} height={12} fill="currentColor" />
                    </div>
                )}
            </Popout>
        )
    );
}

export function ChannelName({ guildId, channelId, messageId }: { guildId?: string; channelId: string; messageId: string; }) {
    const channel = useStateFromStores([ChannelStore], () => ChannelStore.getChannel(channelId), [channelId]);
    const name: ReactNode = useStateFromStores(
        [UserStore, RelationshipStore],
        () =>
            channel ? (
                formatChannelName(channel, UserStore, RelationshipStore, false, false)
            ) : (
                <i>{guildId ? getIntlMessage("UNKNOWN_CHANNEL").toLowerCase() : getIntlMessage("UNKNOWN_USER")}</i>
            ),
        [channel, guildId]
    );

    const icon = useMemo(() => {
        if (channel?.isDM()) {
            const [user] = channel.recipients.map(UserStore.getUser).filter(Boolean);
            if (user)
                return (
                    <img
                        src={getUserAvatarUrl(user, guildId, true, 16)}
                        alt={`DM icon for ${name}`}
                        className={cl("user-icon")}
                    />
                );
        }

        if (channel?.isGroupDM()) {
            return (
                <img
                    src={IconUtils.getChannelIconURL({
                        ...channel,
                        applicationId: channel.getApplicationId(),
                        size: 16
                    })}
                    alt={`Group DM icon for ${name}`}
                    className={cl("user-icon")}
                />
            );
        }

        const Icon = (channel && getChannelIcon(channel)) ?? (guildId ? iconsModule.TextIcon : iconsModule.AtIcon);
        return <Icon size="xs" color="currentColor" />;
    }, [channel, guildId, name]);

    return (
        <div
            className={cl("footer-element")}
            onClick={() => navigateTo(guildId ?? "@me", channelId, messageId)}
            onMouseEnter={() => ChannelActionCreators.preload(guildId ?? "@me", channelId)}
        >
            {icon}
            <BaseText size="sm" weight="medium" className={cl("footer-text")}>
                {name}
            </BaseText>
            <RightArrow width={12} height={12} fill="currentColor" />
        </div>
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
    const { message } = state;

    if (!message || message.embeds.length + message.attachments.length === 0) return null;

    return (
        <Flex gap={12} flexDirection="column">
            {message.attachments.length > 0 && <AttachmentPicker {...state} message={message} />}
            {message.embeds.length > 0 && <EmbedPicker {...state} message={message} />}
        </Flex>
    );
}

export function EmbedPicker({ message, opts, setOpts, hasOpts, defaultOpts }: Required<ForwardOptionsState>) {
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

    return embeds?.map(({ title, subEmbeds }) => (
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
                            onChange={onlyEmbedIndices => setOpts(prev => ({ ...prev, onlyEmbedIndices }))}
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

export function AttachmentPicker({ message, opts, setOpts, hasOpts, defaultOpts }: Required<ForwardOptionsState>) {
    return (
        <TagContainer>
            {message.attachments.map(attachment => (
                <Tag
                    key={attachment.id}
                    id={attachment.id}
                    source={hasOpts ? opts.onlyAttachmentIds ?? [] : defaultOpts.onlyAttachmentIds}
                    onChange={onlyAttachmentIds => setOpts(prev => ({ ...prev, onlyAttachmentIds }))}
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
            data-selected={!disabled && selected ? "true" : undefined}
            onClick={() => onChange(selected ? source.filter(x => x !== id) : [...source, id])}
            style={{ textWrap: "wrap", opacity: disabled ? .5 : undefined }}
            inert={disabled}
        >
            {children}
        </div>
    );
}

const attachmentIcons: Partial<Record<AttachmentType, string>> = {
    IMAGE: "Image",
    VIDEO: "Video",
    CLIP: "Clips",
    AUDIO: "Music",
    PLAINTEXT_PREVIEW: "A"
};

function AttachmentIcon({ attachment }: { attachment: MessageAttachment; }) {
    const Icon = useMemo(() => {
        const type = getAttachmentType(attachment, true);
        return iconsModule[(attachmentIcons[type] ?? "ImageFile") + "Icon"];
    }, [attachment]);

    return Icon && <Icon size="xs" style={{ flexShrink: 0 }} />;
}
