/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { BaseText } from "@components/BaseText";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { InfoIcon } from "@components/Icons";
import { Margins } from "@components/margins";
import { Devs, EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { sendMessage } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { proxyLazyWebpack } from "@webpack";
import { ChannelActionCreators, ChannelStore, Checkbox, React, Tooltip, useMemo, useState } from "@webpack/common";
import { Dispatch, MouseEvent, ReactNode, SetStateAction } from "react";

import { ChannelName, ForwardPicker, GuildName, Timestamp } from "./components";
import managedStyle from "./style.css?managed";

export const cl = classNameFactory("vc-betterforwards-");

export interface ForwardOptions {
    onlyEmbedIndices?: number[];
    onlyAttachmentIds?: string[];
}

export interface ForwardOptionsState {
    opts: ForwardOptions;
    setOpts: Dispatch<SetStateAction<ForwardOptions>>;
    defaultOpts: Required<ForwardOptions>;
    hasOpts: boolean;
    message: Message;
}

export const ForwardOptionsContext = proxyLazyWebpack(() =>
    React.createContext<ForwardOptionsState & { message: Message }>({
        opts: {},
        setOpts: () => {},
        defaultOpts: { onlyAttachmentIds: [], onlyEmbedIndices: [] },
        hasOpts: false,
        message: {} as Message
    })
);

let ignore = false;
const getId = ({ id, type }: { id: string; type: string; }) => {
    if (type !== "user") return id;
    return (
        ChannelStore.getDMFromUserId(id) ??
        (ChannelActionCreators.getOrEnsurePrivateChannel(id) as Promise<string | void>)
    );
};

// Taken From Signature :)
const settings = definePluginSettings({
    resendOnFail: {
        description: "This will attempt to resend a forwarded message if the forward fails. Could cause unintentional pings or text spam. Bypasses NSFW restrictions.",
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: true
    },
    forwardPreface: {
        description: "What should the forwarded message be prefaced with",
        type: OptionType.SELECT,
        hidden: () => !settings.store.resendOnFail,
        options: [
            { label: ">", value: ">", default: true },
            { label: "-#", value: "-#" }
        ]
    },
    dontFollowForwards: {
        description: "After forwarding a single message, don't jump to it. Hold shift to ignore this behavior.",
        displayName: "Don't Follow Forwards",
        type: OptionType.BOOLEAN,
        default: false,
        restartNeeded: true
    },
    selfForward: {
        description: "Show the current channel in the forward list popup.",
        type: OptionType.BOOLEAN,
        default: false,
        restartNeeded: true
    }
});

migratePluginSettings("BetterForwards", "ForwardAnywhere");
export default definePlugin({
    name: "BetterForwards",
    description: "Message forward utilities including NSFW bypass and UI improvements.",
    tags: ["Chat", "Utility"],
    searchTerms: ["selfForward", "betterForwardMeta"],
    authors: [Devs.thororen, Devs.sadan, Devs.nin0dev, EquicordDevs.VillainsRule, EquicordDevs.davri],
    settings,
    managedStyle,
    patches: [
        {
            find: "#{intl::MESSAGE_FORWARDING_NSFW_NOT_ALLOWED}",
            predicate: () => settings.store.resendOnFail,
            replacement: {
                match: /(\{if\().{0,50}(\)return.{0,25}#{intl::MESSAGE_FORWARDING_NSFW_NOT_ALLOWED})/,
                replace: "$1false$2"
            }
        },
        {
            find: "#{intl::MESSAGE_ACTION_FORWARD_TO}",
            replacement: [
                {
                    match: /(?<=hasContextMessage:null!=(\i)&&.{100,150}?let (\i)=.{0,25}rejected.{0,25}\);)(?=.{0,25}message:(\i))/,
                    replace: (_, additionalMessage, channels, message) =>
                        `if(${channels}.length>0)return await $self.sendForward(${additionalMessage},${channels},${message},__state.opts);`,
                    predicate: () => settings.store.resendOnFail
                },
                {
                    match: /(?<=source:\i,)\.\.\.(\i)\}=(\i),/,
                    replace: "__state,...$1}=$self.useProps($2),"
                },
                {
                    match: /\(0,\i\.jsx\)\(\i,\{message:\i,forwardOptions:\i,channel:\i\}\)/,
                    replace: "$self.renderWrapper(__state,$&)"
                },
                {
                    match: /(?<=#{intl::CHECKPOINT_2025}.{50,100}?)\i>0&&\(.{200,250}?\}\)\]\}\)/,
                    replace: "$self.renderForwardPicker()"
                },
                {
                    match: /(?<=transitionToDestination:)(1===\i\.length)(?=,|\})/,
                    replace: "$self.shouldTransition($1)",
                    predicate: () => settings.store.dontFollowForwards
                },
                {
                    // there are two useCallbacks with clearDraft in this module
                    // we need to anchor to the one that is used as an onClick handler
                    match: /((\i)=\i\.useCallback\(\()(\)=>\{)(null!=\i&&\i\.\i\.clearDraft)(?=.{1500,2000}onClick:\2)/,
                    replace: (_, beforeParen, _1, beforeBody, body) =>
                        `${beforeParen}vencordArg1${beforeBody}$self.setShift(vencordArg1);${body}`,
                    predicate: () => settings.store.dontFollowForwards
                }
            ]
        },
        {
            find: 'location:"ForwardFooter"',
            replacement: {
                match: /let{message:\i,snapshot:\i,index:\i}=(\i)/,
                replace: "return $self.renderForwardFooter($1);$&"
            }
        },
        {
            find: ".getChannelHistory(),",
            predicate: () => settings.store.selfForward,
            replacement: {
                match: /\i.id\]/,
                replace: "]"
            }
        }
    ],

    async sendForward(additionalMessage: string | null, channels: { id: string; type: string }[], message: Message, options: ForwardOptions) {
        const contentMessage = message.messageSnapshots[0]?.message ?? message;

        const newLine = `\n${settings.store.forwardPreface} `;
        const prefix = `${newLine}*Forwarded from <#${message.channel_id}>*${newLine}${contentMessage.content.trim().replaceAll("\n", newLine)}`;
        const suffix = additionalMessage ? `\n${additionalMessage.trim()}` : "";

        const attIds = options.onlyAttachmentIds;
        const attachments = attIds
            ? contentMessage.attachments.filter(a => attIds.includes(a.id))
            : contentMessage.attachments;

        const ids = (await Promise.all(channels.map(getId))).filter(Boolean) as string[];

        const chunkSize = 5;
        ids.forEach(id => {
            if (attachments.length > 0) {
                for (let i = 0; i < attachments.length; i += chunkSize) {
                    const group = attachments.slice(i, i + chunkSize);

                    let text = i === 0 ? `${prefix}${newLine}Attachments:${newLine}` : newLine;
                    text += `${group.map(a => a.url).join(newLine)}`;
                    if (i + chunkSize >= attachments.length) text += suffix;

                    sendMessage(id, { content: text });
                }
            } else {
                sendMessage(id, { content: prefix + suffix });
            }
        });
    },

    shouldTransition(origCond: boolean): boolean {
        return ignore ? origCond : false;
    },

    setShift(event: MouseEvent | undefined) {
        ignore = !!event?.shiftKey;
    },

    renderForwardFooter({ message }: { message: Message }) {
        if (!message.messageReference) return null;

        const { guild_id, channel_id, message_id } = message.messageReference;

        return (
            <ErrorBoundary noop>
                <div className={cl("footer")}>
                    {guild_id && <GuildName guildId={guild_id} />}
                    <ChannelName messageId={message_id} channelId={channel_id} guildId={guild_id} />
                    <Timestamp snowflake={message_id} />
                </div>
            </ErrorBoundary>
        );
    },

    useProps(props: { message: Message; forwardOptions?: ForwardOptions }) {
        const message = props.message.messageSnapshots[0]?.message ?? props.message;

        const [opts, setOpts] = useState(() => {
            if (!props.forwardOptions || !props.forwardOptions.onlyEmbedIndices)
                return props.forwardOptions ?? ({} as ForwardOptions);

            let id = 0;
            const embedsIds = new Set(props.forwardOptions.onlyEmbedIndices as number[]);

            // Discord incorrectly assumes that embed indices directly map to whole embeds, this is an attempt to fix that
            const onlyEmbedIndices = message.embeds
                .flatMap((e, i) => e.images?.map(() => ({ id: id++, eId: i })) ?? { id: id++, eId: i })
                .filter(({ eId }) => embedsIds.has(eId))
                .map(({ id }) => id);

            return { ...props.forwardOptions, onlyEmbedIndices };
        });

        const defaultOpts = useMemo(
            () => ({
                onlyAttachmentIds: message.attachments.map(a => a.id),
                onlyEmbedIndices: message.embeds.flatMap(e => e.images ?? [{}]).map((_, i) => i)
            }),
            [message]
        );

        const hasOpts = !!opts.onlyAttachmentIds || !!opts.onlyEmbedIndices;

        const forwardOptions = useMemo(() => {
            if (!hasOpts) return opts;

            const fixed = { onlyAttachmentIds: [], onlyEmbedIndices: [], ...opts };

            // Server-side validation can be bypassed by specifying a fake attachment id
            if (fixed.onlyAttachmentIds.length + fixed.onlyEmbedIndices.length === 0) fixed.onlyAttachmentIds = ["0"];

            // If the embed indices are in the incorrect order, embed metadata could get stripped out by the client
            fixed.onlyEmbedIndices = fixed.onlyEmbedIndices.toSorted((a, b) => a - b);

            return fixed;
        }, [opts, hasOpts]);

        const state = useMemo(
            () => ({ message, opts, setOpts, defaultOpts, hasOpts }),
            [message, opts, defaultOpts, hasOpts]
        );
        return { ...props, forwardOptions, __state: state };
    },

    renderWrapper(state: ForwardOptionsState, children: ReactNode) {
        const { message, hasOpts, setOpts, defaultOpts } = state;

        return (
            <ErrorBoundary noop>
                <ForwardOptionsContext.Provider value={state}>
                    {children}
                    {message.embeds.length + message.attachments.length > 0 && (
                        <Flex className={Margins.top16}>
                            <Checkbox value={!hasOpts} onChange={() => setOpts(!hasOpts ? defaultOpts : {})} size={20}>
                                <BaseText size="sm">Forward everything</BaseText>
                            </Checkbox>
                            <Tooltip text="Message text will not be forwarded when this option is disabled">
                                {props => <InfoIcon {...props} color="var(--text-muted)" width={20} height={20} />}
                            </Tooltip>
                        </Flex>
                    )}
                </ForwardOptionsContext.Provider>
            </ErrorBoundary>
        );
    },

    renderForwardPicker() {
        return (
            <ErrorBoundary noop>
                <ForwardPicker />
            </ErrorBoundary>
        );
    }
});
