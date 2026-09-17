/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Flex } from "@components/Flex";
import { AtIcon, DiscordIconSizes, RightArrow, TextIcon } from "@components/Icons";
import { iconsModule } from "@equicordplugins/_core/concatenatedModules";
import { getGuildAcronym, getIntlMessage } from "@utils/discord";
import { getUserAvatarUrl, identity } from "@utils/misc";
import { BasicGuild, Channel, Guild, GuildProfile, Message, MessageAttachment } from "@vencord/discord-types";
import { findByCodeLazy, findComponentByCodeLazy } from "@webpack";
import { BasicGuildStore, ChannelActionCreators, ChannelStore, DateUtils, GuildProfileStore, GuildStore, IconUtils, InviteActions, Popout, React, RelationshipStore, RestAPI, SnowflakeUtils, useCallback, useEffect, useMemo, useRef, UserStore, useState, useStateFromStores } from "@webpack/common";

import { cl, ForwardOptionsContext, ForwardOptionsState } from ".";

type AttachmentType = "IMAGE" | "VIDEO" | "CLIP" | "AUDIO" | "VISUAL_PLACEHOLDER" | "PLAINTEXT_PREVIEW" | "OTHER" | "INVALID";

const TagGroup = findComponentByCodeLazy('"filter-tag-group"', '"tag-group"');
const ServerProfileComponent = findComponentByCodeLazy("{guildProfile:", "GUILD_PROFILE");
const getAttachmentType = findByCodeLazy('"PLAINTEXT_PREVIEW":"OTHER"');
const formatChannelName = findByCodeLazy("#{intl::NO_ACCESS}", "isObfuscated()");
const getChannelIcon = findByCodeLazy("textFocused:", "isGameInvitesChannel()");
const navigateTo = findByCodeLazy('getConfig({location:"channel_mention"})');
const fetchBasicGuild = findByCodeLazy('type:"BASIC_GUILD_FETCH_SUCCESS"');
const fetchGuildProfile = findByCodeLazy('type:"GUILD_PROFILE_FETCH_SUCCESS"');

export function ForwardFooter({ message }: { message: Message; }) {
    const targetChannelId = message.getChannelId();
    const targetGuildId = useStateFromStores([ChannelStore],
        () => ChannelStore.getChannel(targetChannelId).getGuildId(),
        [targetChannelId]
    );

    if (!message.messageReference) return null;

    const { channel_id, guild_id, message_id } = message.messageReference;

    return (
        <div className={cl("footer")}>
            {guild_id && targetGuildId !== guild_id && <GuildName guildId={guild_id} />}
            <ChannelName messageId={message_id} channelId={channel_id} guildId={guild_id} />
            <Timestamp snowflake={message_id} />
        </div>
    );
}

function GuildIcon({ guild }: { guild: Guild | BasicGuild | GuildProfile; }) {
    const { id, icon, name } = guild;
    const src = useMemo(
        () => IconUtils.getGuildIconURL({ id, icon, canAnimate: true, size: DiscordIconSizes.xs }),
        [id, icon],
    );

    return icon ? (
        <img src={src} alt={`Server icon for ${name}`} className={cl("guild-icon")} />
    ) : (
        <div className={cl("guild-acronym")}>{getGuildAcronym(guild)}</div>
    );
}

function WidgetIcon({ guildId, name }: { guildId: string; name: string; }) {
    const src = useMemo(() => `https://${window.GLOBAL_ENV.API_ENDPOINT}/guilds/${guildId}/widget.png?style=banner1`, [guildId]);

    return (
        <svg
            viewBox="20 27 50 50"
            preserveAspectRatio="xMidYMid slice"
            width={DiscordIconSizes.xs}
            height={DiscordIconSizes.xs}
            role="img"
            aria-label={`Server icon for ${name}`}
            className={cl("widget-guild-icon")}
        >
            <image href={src} width={300} height={160} x={0} y={0} />
        </svg>
    );
}

const UNKNOWN_GUILD = 10004;

function GuildName({ guildId }: { guildId: string; }) {
    const [widget, setWidget] = useState<{ name: string | null, ok: boolean; } | null>(null);
    const guild: Guild | BasicGuild | GuildProfile | null = useStateFromStores(
        [GuildStore, BasicGuildStore, GuildProfileStore],
        () => GuildStore.getGuild(guildId) ?? BasicGuildStore.getGuild(guildId) ?? GuildProfileStore.getProfile(guildId) ?? null,
        [guildId]
    );

    useEffect(() => void fetchBasicGuild(guildId), [guildId]);
    const prefetch = useCallback(async () => {
        const profile = await fetchGuildProfile(guildId, false, { respectBackoff: true });
        if (profile || GuildProfileStore.getFetchStatus(guildId) === "FETCHING") return;
        if (GuildProfileStore.getErrorCode(guildId) === UNKNOWN_GUILD || widget) return;

        // Not the same as the .GUILD_WIDGET endpoint, which only server admins have access to
        const { ok, body } = await RestAPI.get({ url: `/guilds/${guildId}/widget.json` }).catch(identity);

        // Wait until the invite is resolved, in case it has additional info
        const invite = ok ? URL.parse(body.instant_invite)?.pathname.split("/").at(-1) : null;
        if (invite) await InviteActions.resolveInvite(invite);

        setWidget({ ok, name: ok ? body.name : null });
    }, [guildId, widget]);

    const ref = useRef(null);
    const preload = !guild ? prefetch : undefined;

    return (
        <Popout position="top" renderPopout={() => <ServerProfileComponent guildId={guildId} />} targetElementRef={ref} preload={preload}>
            {popoutProps => (
                <div ref={ref} className={cl("footer-element")} onMouseEnter={preload} {...popoutProps}>
                    {guild ? <GuildIcon guild={guild} /> : widget?.ok ? <WidgetIcon guildId={guildId} name={widget.name!} /> : null}
                    <BaseText size="sm" weight="medium" className={cl("footer-text")}>
                        {guild?.name ?? widget?.name ?? "View server"}
                    </BaseText>
                    <RightArrow width={DiscordIconSizes.xxs} height={DiscordIconSizes.xxs} fill="currentColor" />
                </div>
            )}
        </Popout>
    );
}

function ChannelIcon({ channel, name }: { channel: Channel; name: string; }) {
    return useStateFromStores([UserStore], () => {
        if (channel.isDM()) {
            const user = channel.recipients.values().map(UserStore.getUser).find(Boolean);
            const src = user && getUserAvatarUrl(user, channel.getGuildId(), true, DiscordIconSizes.xs);
            return src && <img src={src} alt={`DM icon for ${name}`} className={cl("user-icon")} />;
        }

        if (channel.isGroupDM()) {
            const src = IconUtils.getChannelIconURL({ ...channel, applicationId: channel.getApplicationId(), size: DiscordIconSizes.xs });
            return src && <img src={src} alt={`Group DM icon for ${name}`} className={cl("user-icon")} />;
        }

        const Icon = getChannelIcon(channel);
        return Icon && <Icon size="xs" color="currentColor" />;
    }, [channel, name]);
}

function ChannelName({ guildId, channelId, messageId }: { guildId?: string; channelId: string; messageId: string; }) {
    const channel = useStateFromStores([ChannelStore], () => ChannelStore.getChannel(channelId), [channelId]);
    const name = useStateFromStores(
        [UserStore, RelationshipStore],
        () => {
            if (channel) return formatChannelName(channel, UserStore, RelationshipStore, false, false);
            return guildId ? getIntlMessage("UNKNOWN_CHANNEL").toLowerCase() : getIntlMessage("UNKNOWN_USER");
        },
        [channel, guildId],
    );

    const prefetch = useCallback(() => ChannelActionCreators.preload(guildId ?? "@me", channelId), [guildId, channelId]);
    const navigate = useCallback(() => navigateTo(guildId ?? "@me", channelId, messageId), [guildId, channelId, messageId]);
    const FallbackIcon = guildId ? TextIcon : AtIcon;

    return (
        <div className={cl("footer-element")} onClick={navigate} onMouseEnter={prefetch}>
            {channel ? <ChannelIcon channel={channel} name={name} /> : <FallbackIcon width={DiscordIconSizes.xs} height={DiscordIconSizes.xs} />}
            <BaseText size="sm" weight="medium" className={cl("footer-text")}>
                {channel ? name : <i>{name}</i>}
            </BaseText>
            <RightArrow width={DiscordIconSizes.xxs} height={DiscordIconSizes.xxs} fill="currentColor" />
        </div>
    );
}

function Timestamp({ snowflake }: { snowflake: string; }) {
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

function EmbedPicker(props: Required<ForwardOptionsState>) {
    const embeds = useMemo(() => {
        let id = 0;
        return props.message.embeds.map(({ rawTitle, rawDescription, image, images = image ? [image] : [], video }, i) => {
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
    }, [props.message]);

    return embeds?.map(embed => <SubEmbedPicker {...props} {...embed} key={embed.subEmbeds[0].id} />);
}

interface SubEmbedPickerProps extends Required<ForwardOptionsState> {
    title: string;
    subEmbeds: { id: number; name: string; isMainEmbed: boolean; }[];
}

function SubEmbedPicker({ title, subEmbeds, opts, setOpts, hasOpts, defaultOpts }: SubEmbedPickerProps) {
    const { EmbedIcon, ImageIcon } = iconsModule;
    const items = useMemo(() => subEmbeds.map(({ id, name, isMainEmbed }) => ({
        id,
        label: name,
        icon: isMainEmbed ? EmbedIcon : ImageIcon,
        isDisabled: !hasOpts,
    })), [subEmbeds, hasOpts]);
    const validItems = useMemo(() => new Set(subEmbeds.map(({ id }) => id)), [subEmbeds]);

    const selected = hasOpts ? opts.onlyEmbedIndices : defaultOpts.onlyEmbedIndices;
    const selectedKeys = useMemo(() => new Set(selected).intersection(validItems), [selected, validItems]);
    const onSelectionChange = useCallback(
        (selection: Set<number> | "all") => setOpts(prev => {
            const other = prev.onlyEmbedIndices?.filter(id => !validItems.has(id)) ?? [];
            return { ...prev, onlyEmbedIndices: [...other, ...(selection === "all" ? validItems : selection)] };
        }), [setOpts, validItems],
    );

    return (
        <Flex gap={4} flexDirection="column">
            <BaseText
                size="sm"
                color="text-subtle"
                className={cl("embed-name")}
                style={{ opacity: !hasOpts ? 0.5 : undefined }}
            >
                {title}
            </BaseText>
            <TagGroup
                label={title}
                selectionMode="multiple"
                size="sm"
                items={items}
                selectedKeys={selectedKeys}
                onSelectionChange={onSelectionChange}
            />
        </Flex>
    );
}

export function AttachmentPicker({ message, opts, setOpts, hasOpts, defaultOpts }: Required<ForwardOptionsState>) {
    const items = useMemo(() => message.attachments.map(attachment => ({
        id: attachment.id,
        label: attachment.title ?? attachment.filename,
        icon: props => <AttachmentIcon {...props} attachment={attachment} />,
        isDisabled: !hasOpts,
    })), [message.attachments, hasOpts]);

    const selected = hasOpts ? opts.onlyAttachmentIds : defaultOpts.onlyAttachmentIds;
    const selectedKeys = useMemo(() => new Set(selected), [selected]);
    const onSelectionChange = useCallback(
        (selection: Set<string> | "all") => setOpts(prev =>
            ({ ...prev, onlyAttachmentIds: selection === "all" ? items.map(({ id }) => id) : [...selection] })
        ), [setOpts, items],
    );

    return (
        <TagGroup
            label="Message attachments"
            selectionMode="multiple"
            size="sm"
            items={items}
            selectedKeys={selectedKeys}
            onSelectionChange={onSelectionChange}
        />
    );
}

const attachmentIcons: Partial<Record<AttachmentType, string>> = {
    IMAGE: "Image",
    VIDEO: "Video",
    CLIP: "Clips",
    AUDIO: "Music",
    PLAINTEXT_PREVIEW: "A"
};

function AttachmentIcon({ attachment, ...props }: { attachment: MessageAttachment; size?: string; color?: string; }) {
    const Icon = useMemo(() => {
        const type = getAttachmentType(attachment, true);
        return iconsModule[(attachmentIcons[type] ?? "ImageFile") + "Icon"];
    }, [attachment]);

    return Icon && <Icon style={{ flexShrink: 0 }} {...props} />;
}
