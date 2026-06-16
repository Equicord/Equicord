/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { Devs, EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { sendMessage } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelActionCreators, ChannelStore, useState } from "@webpack/common";
import { Dispatch, MouseEvent, SetStateAction } from "react";

import { ChannelName, ForwardPicker, GuildName, Timestamp } from "./components";
import managedStyle from "./style.css?managed";

export const cl = classNameFactory("vc-betterforwards-");

export interface ForwardOptions {
    onlyEmbedIndices?: number[];
    onlyAttachmentIds?: string[];
}

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
        description: "What should forwarded from be prefaced with",
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
                    match: /(?<=let (\i)=.{0,25}rejected.{0,25}\);)(?=.{0,25}message:(\i))/,
                    replace: "if($1.length>0)return await $self.sendForward($1,$2,__state.opts);",
                    predicate: () => settings.store.resendOnFail
                },
                {
                    match: /(?<=source:\i,)\.\.\.(\i)\}=(\i),/,
                    replace: "__state,...$1}=$self.useProps($2),"
                },
                {
                    match: /\{message:(\i),forwardOptions:\i,channel:\i\}\),/,
                    replace: "$&$self.renderPicker($1,__state),"
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
                    replace: (_, beforeParen, _1, beforeBody, body) => `${beforeParen}vencordArg1${beforeBody}$self.setShift(vencordArg1);${body}`,
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

    async sendForward(channels: { id: string; type: string; }[], message: Message, options: ForwardOptions) {
        const contentMessage = message.messageSnapshots[0]?.message ?? message;

        const attIds = options.onlyAttachmentIds;
        const attachments = attIds
            ? contentMessage.attachments.filter(a => attIds.includes(a.id))
            : contentMessage.attachments;

        const ids = (await Promise.all(channels.map(getId))).filter(Boolean) as string[];

        const chunkSize = 5;
        ids.forEach(id => {
            if (attachments.length) {
                for (let i = 0; i < attachments.length; i += chunkSize) {
                    const group = attachments.slice(i, i + chunkSize);

                    let text = i === 0 ? `${contentMessage.content}\nAttachments:\n` : "";
                    text += `${group.map(a => a.url).join("\n")}\n`;
                    if (i + chunkSize >= attachments.length)
                        text += `${settings.store.forwardPreface} Forwarded from <#${message.channel_id}>`;

                    sendMessage(id, { content: text });
                }
            } else {
                sendMessage(id, {
                    content: `${contentMessage.content}\n${settings.store.forwardPreface} Forwarded from <#${message.channel_id}>`
                });
            }
        });
    },

    shouldTransition(origCond: boolean): boolean {
        return ignore ? origCond : false;
    },

    setShift(event: MouseEvent | undefined) {
        ignore = !!event?.shiftKey;
    },

    renderForwardFooter({ message }: { message: Message; }) {
        const { guild_id, channel_id, message_id } = message.messageReference!;
        return (
            <div className={cl("footer")}>
                {guild_id && <GuildName guildId={guild_id} />}
                <ChannelName messageId={message_id} channelId={channel_id} guildId={guild_id} />
                <Timestamp snowflake={message_id} />
            </div>
        );
    },

    useProps(props: { message: Message; forwardOptions?: ForwardOptions; }) {
        const [opts, setOpts] = useState(() => {
            if (!props.forwardOptions || !props.forwardOptions.onlyEmbedIndices)
                return props.forwardOptions ?? ({} as ForwardOptions);

            let id = 0;
            const embedsIds = new Set(props.forwardOptions.onlyEmbedIndices as number[]);

            // Discord incorrectly assumes that embed indices directly map to whole embeds, this is an attempt to fix that
            const onlyEmbedIndices = props.message.embeds
                .flatMap((e, i) => e.images?.map(() => ({ id: id++, eId: i })) ?? { id: id++, eId: i })
                .filter(({ eId }) => embedsIds.has(eId))
                .map(({ id }) => id);

            return { ...props.forwardOptions, onlyEmbedIndices };
        });

        const forwardOptions: ForwardOptions = { ...opts };
        const hasOpts = !!opts.onlyAttachmentIds || !!opts.onlyEmbedIndices;

        // Server-side validation can be bypassed by specifying a fake attachment id
        if (hasOpts && !forwardOptions.onlyAttachmentIds?.length) forwardOptions.onlyAttachmentIds = ["0"];

        return { ...props, forwardOptions, __state: { opts, setOpts } };
    },

    renderPicker(message: Message, state: { opts: ForwardOptions; setOpts: Dispatch<SetStateAction<ForwardOptions>>; }) {
        const contentMessage = message.messageSnapshots[0]?.message ?? message;
        if (contentMessage.embeds.length === 0 && contentMessage.attachments.length === 0) return null;

        return <ForwardPicker message={contentMessage} options={state.opts} onChange={state.setOpts} />;
    }
});
