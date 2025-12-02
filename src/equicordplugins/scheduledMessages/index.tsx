/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import { Heading } from "@components/Heading";
import { EquicordDevs } from "@utils/constants";
import { sendMessage } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { closeModal, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { CloudUpload } from "@vencord/discord-types";
import { findLazy } from "@webpack";
import { Button, ChannelStore, ComponentDispatch, Constants, DraftType, FluxDispatcher, GuildStore, IconUtils, MessageActions, MessageStore, React, RelationshipStore, RestAPI, showToast, SnowflakeUtils, TextInput, Toasts, UploadManager, UserStore, useState } from "@webpack/common";

import { CalendarIcon, isScheduleModeEnabled, ScheduledMessagesButton, setScheduleModeEnabled, TimerIcon } from "./components";

const CloudUploadConstructor = findLazy(m => m.prototype?.trackUploadFinished) as typeof CloudUpload;

const logger = new Logger("ScheduledMessages");
const STORAGE_KEY = "ScheduledMessages_queue";
const MAX_MESSAGES_PER_CHANNEL_PER_MINUTE = 3;

export interface ScheduledReaction {
    emoji: {
        id: string | null;
        name: string;
        animated?: boolean;
    };
    count: number;
}

export interface ScheduledAttachment {
    filename: string;
    data: string;
    type: string;
}

export interface ScheduledMessage {
    id: string;
    channelId: string;
    content: string;
    scheduledTime: number;
    createdAt: number;
    reactions?: ScheduledReaction[];
    attachments?: ScheduledAttachment[];
}

let scheduledMessages: ScheduledMessage[] = [];
let checkInterval: ReturnType<typeof setInterval> | null = null;
let isProcessingMessages = false;
let reactionInterceptor: ((event: any) => any) | null = null;
let originalRestAPIPut: typeof RestAPI.put | null = null;
let originalRestAPIGet: typeof RestAPI.get | null = null;

export const phantomMessageMap = new Map<string, { scheduledTime: number; messageId: string; channelId: string; }>();
const pendingReactions = new Map<string, ScheduledReaction[]>();

const cl = classNameFactory("vc-scheduled-msg-");

const settings = definePluginSettings({
    maxMessagesPerMinute: {
        type: OptionType.SLIDER,
        description: "Max scheduled messages per channel that can fire in the same minute",
        markers: [1, 2, 3, 4, 5],
        default: MAX_MESSAGES_PER_CHANNEL_PER_MINUTE,
        stickToMarkers: true
    },
    checkIntervalSeconds: {
        type: OptionType.SLIDER,
        description: "How often to check for messages to send (seconds)",
        markers: [5, 10, 15, 30, 60],
        default: 10,
        stickToMarkers: true
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Show toast notifications when messages are sent",
        default: true
    },
    showPhantomMessages: {
        type: OptionType.BOOLEAN,
        description: "Show scheduled messages as phantom messages in chat",
        default: true
    }
});

async function loadScheduledMessages(): Promise<void> {
    const saved = await DataStore.get<ScheduledMessage[]>(STORAGE_KEY);
    scheduledMessages = Array.isArray(saved) ? saved : [];
}

async function saveScheduledMessages(): Promise<void> {
    await DataStore.set(STORAGE_KEY, scheduledMessages);
}

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getScheduledMessages(): ScheduledMessage[] {
    return [...scheduledMessages];
}

export function getScheduledMessagesForChannel(channelId: string): ScheduledMessage[] {
    return scheduledMessages.filter(msg => msg.channelId === channelId);
}

function getChannelDisplayInfo(channelId: string): { name: string; avatar: string; } {
    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return { name: "Unknown", avatar: "" };

    if (channel.isDM() || channel.isMultiUserDM()) {
        const recipientId = channel.recipients?.[0];
        const user = recipientId ? UserStore.getUser(recipientId) : null;
        if (user) {
            const friendNick = RelationshipStore.getNickname(user.id);
            const displayName = friendNick || user.globalName || user.username;
            const avatar = IconUtils.getUserAvatarURL(user, true, 64);
            return { name: displayName, avatar };
        }
        return { name: "DM", avatar: "" };
    }

    if (channel.isGroupDM()) {
        return {
            name: channel.name || "Group DM",
            avatar: IconUtils.getChannelIconURL(channel) || ""
        };
    }

    const guild = GuildStore.getGuild(channel.guild_id);
    if (guild) {
        return {
            name: channel.name || "Channel",
            avatar: IconUtils.getGuildIconURL({
                id: guild?.id,
                icon: guild?.icon,
                canAnimate: true,
                size: 512
            }) || ""
        };
    }

    return {
        name: channel.name || "Channel",
        avatar: ""
    };
}

function createPhantomMessage(msg: ScheduledMessage): void {
    if (!settings.store.showPhantomMessages) return;

    const currentUser = UserStore.getCurrentUser();
    if (!currentUser) return;

    const messageId = `scheduled-${msg.id}`;

    const phantomAttachments = (msg.attachments || []).map((att, idx) => {
        const dataUrl = `data:${att.type};base64,${att.data}`;
        const isImage = att.type.startsWith("image/");
        return {
            id: String(idx),
            filename: att.filename,
            size: Math.ceil(att.data.length * 0.75),
            url: dataUrl,
            proxy_url: dataUrl,
            content_type: att.type,
            ...(isImage && {
                width: 400,
                height: 300
            })
        };
    });

    const rawMessage = {
        id: messageId,
        channel_id: msg.channelId,
        author: {
            id: currentUser.id,
            username: currentUser.username,
            discriminator: currentUser.discriminator || "0",
            avatar: currentUser.avatar,
            global_name: currentUser.globalName,
            bot: false
        },
        content: msg.content,
        timestamp: new Date().toISOString(),
        edited_timestamp: null,
        tts: false,
        mention_everyone: false,
        mentions: [],
        mention_roles: [],
        attachments: phantomAttachments,
        embeds: [],
        pinned: false,
        type: 0,
        flags: 0,
        components: [],
        reactions: [],
        nonce: messageId,
        scheduledMessageData: {
            scheduledTime: msg.scheduledTime,
            messageId: msg.id
        }
    };

    phantomMessageMap.set(messageId, {
        scheduledTime: msg.scheduledTime,
        messageId: msg.id,
        channelId: msg.channelId
    });

    if (msg.reactions?.length) {
        pendingReactions.set(msg.id, [...msg.reactions]);
    }

    const messagesLoaded: Promise<any> = MessageStore.hasPresent(msg.channelId)
        ? Promise.resolve()
        : MessageActions.fetchMessages({ channelId: msg.channelId });

    messagesLoaded.then(() => {
        FluxDispatcher.dispatch({
            type: "MESSAGE_CREATE",
            channelId: msg.channelId,
            message: rawMessage,
            optimistic: true,
            sendMessageOptions: {},
            isPushNotification: false
        });

        const applyPhantomClass = (retries = 0) => {
            const el = document.getElementById(`chat-messages-${msg.channelId}-${messageId}`);
            if (el) {
                el.classList.add("vc-scheduled-msg-phantom");
            } else if (retries < 10) {
                setTimeout(() => applyPhantomClass(retries + 1), 200 * (retries + 1));
            }
        };
        setTimeout(() => applyPhantomClass(), 100);
    }).catch(e => {
        logger.error(`Failed to create phantom message: ${e}`);
    });
}

function removePhantomMessage(msg: ScheduledMessage): void {
    const messageId = `scheduled-${msg.id}`;
    phantomMessageMap.delete(messageId);
    FluxDispatcher.dispatch({
        type: "MESSAGE_DELETE",
        channelId: msg.channelId,
        id: messageId,
        mlDeleted: true
    });
}

export async function addScheduledMessage(channelId: string, content: string, scheduledTime: number, attachments?: ScheduledAttachment[]): Promise<{ success: boolean; error?: string; }> {
    const minuteStart = Math.floor(scheduledTime / 60000) * 60000;
    const minuteEnd = minuteStart + 60000;

    const messagesInSameMinute = scheduledMessages.filter(
        msg => msg.channelId === channelId &&
            msg.scheduledTime >= minuteStart &&
            msg.scheduledTime < minuteEnd
    );

    if (messagesInSameMinute.length >= settings.store.maxMessagesPerMinute) {
        return {
            success: false,
            error: `Maximum of ${settings.store.maxMessagesPerMinute} messages per channel per minute reached`
        };
    }

    const newMessage: ScheduledMessage = {
        id: generateId(),
        channelId,
        content,
        scheduledTime,
        createdAt: Date.now(),
        attachments
    };

    scheduledMessages.push(newMessage);
    scheduledMessages.sort((a, b) => a.scheduledTime - b.scheduledTime);
    await saveScheduledMessages();
    createPhantomMessage(newMessage);

    return { success: true };
}

export async function removeScheduledMessage(id: string): Promise<void> {
    const msg = scheduledMessages.find(m => m.id === id);
    if (msg) removePhantomMessage(msg);
    scheduledMessages = scheduledMessages.filter(m => m.id !== id);
    await saveScheduledMessages();
}

async function addReactionsToMessage(channelId: string, messageId: string, reactions: ScheduledReaction[]): Promise<void> {
    for (const reaction of reactions) {
        const emojiStr = reaction.emoji.id
            ? `${reaction.emoji.name}:${reaction.emoji.id}`
            : encodeURIComponent(reaction.emoji.name);

        let success = false;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const result: any = await RestAPI.put({
                    url: `/channels/${channelId}/messages/${messageId}/reactions/${emojiStr}/@me`
                });

                if (result.ok) {
                    success = true;
                    break;
                }

                if (result.status === 404) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    continue;
                }

                logger.error(`Failed to add reaction ${reaction.emoji.name}:`, result);
                break;
            } catch (e: any) {
                if (e?.status === 404 || e?.body?.code === 10008) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    continue;
                }
                logger.error(`Failed to add reaction ${reaction.emoji.name}:`, e);
                break;
            }
        }

        if (!success) {
            logger.warn(`Could not add reaction ${reaction.emoji.name} after retries`);
        }

        await new Promise(resolve => setTimeout(resolve, 250));
    }
}

async function uploadAttachment(channelId: string, attachment: ScheduledAttachment): Promise<{ filename: string; uploaded_filename: string; } | null> {
    return new Promise(resolve => {
        const binaryStr = atob(attachment.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        const file = new File([bytes], attachment.filename, { type: attachment.type });

        const upload = new CloudUploadConstructor({
            file,
            isThumbnail: false,
            platform: 1,
        }, channelId);

        upload.on("complete", () => {
            resolve({
                filename: upload.filename,
                uploaded_filename: upload.uploadedFilename
            });
        });
        upload.on("error", () => {
            logger.error(`Failed to upload attachment ${attachment.filename}`);
            resolve(null);
        });

        upload.upload();
    });
}

async function sendScheduledMessage(msg: ScheduledMessage): Promise<boolean> {
    try {
        const channel = ChannelStore.getChannel(msg.channelId);
        if (!channel) return false;

        const reactions = pendingReactions.get(msg.id) || msg.reactions || [];
        removePhantomMessage(msg);
        pendingReactions.delete(msg.id);

        let sentMessageId: string | null = null;

        if (msg.attachments?.length) {
            const uploadedAttachments: Array<{ id: string; filename: string; uploaded_filename: string; }> = [];

            for (let i = 0; i < msg.attachments.length; i++) {
                const result = await uploadAttachment(msg.channelId, msg.attachments[i]);
                if (result) {
                    uploadedAttachments.push({ id: String(i), ...result });
                }
            }

            if (uploadedAttachments.length > 0) {
                await RestAPI.post({
                    url: Constants.Endpoints.MESSAGES(msg.channelId),
                    body: {
                        channel_id: msg.channelId,
                        content: msg.content,
                        nonce: SnowflakeUtils.fromTimestamp(Date.now()),
                        sticker_ids: [],
                        type: 0,
                        attachments: uploadedAttachments,
                    }
                });
            } else {
                await sendMessage(msg.channelId, { content: msg.content });
            }
        } else {
            await sendMessage(msg.channelId, { content: msg.content });
        }

        if (reactions.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 1500));

            const messages = MessageStore.getMessages(msg.channelId);
            const currentUserId = UserStore.getCurrentUser()?.id;
            const msgArray = messages?._array || [];

            for (let i = msgArray.length - 1; i >= 0 && i >= msgArray.length - 10; i--) {
                const m = msgArray[i];
                if (m?.author?.id === currentUserId && m?.content === msg.content && !m?.id?.startsWith("scheduled-")) {
                    sentMessageId = m.id;
                    break;
                }
            }

            if (sentMessageId) {
                await addReactionsToMessage(msg.channelId, sentMessageId, reactions);
            }
        }

        if (settings.store.showNotifications) {
            const { name } = getChannelDisplayInfo(msg.channelId);
            showToast(`Scheduled message sent to ${name}`, Toasts.Type.SUCCESS);
        }

        return true;
    } catch (e) {
        logger.error("Failed to send scheduled message:", e);
        if (settings.store.showNotifications) {
            showToast("Failed to send scheduled message", Toasts.Type.FAILURE);
        }
        return false;
    }
}

async function checkAndSendMessages(): Promise<void> {
    if (isProcessingMessages) return;
    isProcessingMessages = true;

    try {
        const now = Date.now();
        const dueMessages = scheduledMessages.filter(msg => msg.scheduledTime <= now);

        for (const msg of dueMessages) {
            await removeScheduledMessage(msg.id);
            await sendScheduledMessage(msg);
        }
    } finally {
        isProcessingMessages = false;
    }
}

function startScheduler(): void {
    if (checkInterval) return;
    checkAndSendMessages();
    checkInterval = setInterval(checkAndSendMessages, settings.store.checkIntervalSeconds * 1000);
}

function stopScheduler(): void {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
}

function recreatePhantomMessages(): void {
    for (const msg of scheduledMessages) {
        createPhantomMessage(msg);
    }
}

function ScheduleTimeModal({ channelId, content, attachments, rootProps, close }: {
    channelId: string;
    content: string;
    attachments?: ScheduledAttachment[];
    rootProps: ModalProps;
    close: () => void;
}) {
    const [scheduleType, setScheduleType] = useState<"delay" | "time">("delay");
    const [delayMinutes, setDelayMinutes] = useState("5");
    const [scheduledDateTime, setScheduledDateTime] = useState("");
    const [error, setError] = useState("");

    const { name, avatar } = getChannelDisplayInfo(channelId);
    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return null;
    const isDM = channel.isDM() || channel.isGroupDM() || channel.isMultiUserDM();

    const handleSchedule = async () => {
        let scheduledTime: number;

        if (scheduleType === "delay") {
            const minutes = parseInt(delayMinutes, 10);
            if (isNaN(minutes) || minutes < 1) {
                setError("Please enter a valid delay (minimum 1 minute)");
                return;
            }
            scheduledTime = Date.now() + minutes * 60 * 1000;
        } else {
            const dateTime = new Date(scheduledDateTime).getTime();
            if (isNaN(dateTime) || dateTime <= Date.now()) {
                setError("Please select a future date and time");
                return;
            }
            scheduledTime = dateTime;
        }

        const result = await addScheduledMessage(channelId, content, scheduledTime, attachments);

        if (result.success) {
            ComponentDispatch.dispatchToLastSubscribed("CLEAR_TEXT");
            UploadManager.clearAll(channelId, DraftType.ChannelMessage);
            showToast("Message scheduled!", Toasts.Type.SUCCESS);
            close();
        } else {
            setError(result.error || "Failed to schedule message");
        }
    };

    return (
        <ModalRoot {...rootProps}>
            <ModalHeader separator={false} className={cl("modal-header")}>
                <Heading tag="h2" className={cl("modal-title")}>Schedule Message</Heading>
                <ModalCloseButton onClick={close} />
            </ModalHeader>

            <ModalContent className={cl("modal-content")}>
                <div className={cl("channel-info")}>
                    {avatar && <img src={avatar} className={cl("channel-avatar")} alt="" />}
                    <span className={cl("channel-text")}>
                        Scheduling for: <strong>{isDM ? name : `#${name}`}</strong>
                    </span>
                </div>

                <Heading tag="h5" className={cl("field-label")}>Schedule Type</Heading>
                <div className={cl("schedule-type-buttons")}>
                    <Button size={Button.Sizes.SMALL} color={scheduleType === "delay" ? Button.Colors.BRAND : Button.Colors.PRIMARY} onClick={() => setScheduleType("delay")}>Delay</Button>
                    <Button size={Button.Sizes.SMALL} color={scheduleType === "time" ? Button.Colors.BRAND : Button.Colors.PRIMARY} onClick={() => setScheduleType("time")}>Specific Time</Button>
                </div>

                {scheduleType === "delay" ? (
                    <>
                        <Heading tag="h5" className={cl("field-label")}>Delay (minutes)</Heading>
                        <TextInput value={delayMinutes} onChange={setDelayMinutes} placeholder="5" type="number" />
                    </>
                ) : (
                    <>
                        <Heading tag="h5" className={cl("field-label")}>Date & Time</Heading>
                        <input type="datetime-local" className={cl("datetime-input")} value={scheduledDateTime} onChange={e => setScheduledDateTime(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
                    </>
                )}

                {error && (
                    <div className={cl("error")}>
                        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                        <span>{error}</span>
                    </div>
                )}
            </ModalContent>

            <ModalFooter separator className={cl("modal-footer")}>
                <Button onClick={handleSchedule} color={Button.Colors.GREEN}>Schedule</Button>
                <Button color={Button.Colors.TRANSPARENT} look={Button.Looks.LINK} onClick={close}>Cancel</Button>
            </ModalFooter>
        </ModalRoot>
    );
}

function openScheduleTimeModal(channelId: string, content: string, attachments?: ScheduledAttachment[]): void {
    const key = openModal(props => (
        <ScheduleTimeModal
            channelId={channelId}
            content={content}
            attachments={attachments}
            rootProps={props}
            close={() => closeModal(key)}
        />
    ));
}

function ViewScheduledModal({ rootProps, close }: { rootProps: ModalProps; close: () => void; }) {
    const [messages, setMessages] = useState(getScheduledMessages());

    const handleDelete = async (id: string) => {
        await removeScheduledMessage(id);
        setMessages(getScheduledMessages());
        showToast("Scheduled message removed", Toasts.Type.SUCCESS);
    };

    return (
        <ModalRoot {...rootProps}>
            <ModalHeader separator={false} className={cl("modal-header")}>
                <Heading tag="h2" className={cl("modal-title")}>Scheduled Messages</Heading>
                <ModalCloseButton onClick={close} />
            </ModalHeader>

            <ModalContent className={cl("modal-content")}>
                {messages.length === 0 ? (
                    <div className={cl("empty-state")}><CalendarIcon width={48} height={48} /><span>No scheduled messages</span></div>
                ) : (
                    <div className={cl("message-list")}>
                        {messages.map(msg => {
                            const { name, avatar } = getChannelDisplayInfo(msg.channelId);
                            const channel = ChannelStore.getChannel(msg.channelId);
                            if (!channel) return null;
                            const isDM = channel.isDM() || channel.isGroupDM() || channel.isMultiUserDM();
                            return (
                                <div key={msg.id} className={cl("message-item")}>
                                    <div className={cl("message-info")}>
                                        <div className={cl("message-header")}>
                                            {avatar && <img src={avatar} className={cl("message-avatar")} alt="" />}
                                            <span className={cl("message-channel")}>{isDM ? name : `#${name}`}</span>
                                        </div>
                                        <div className={cl("message-time")}><TimerIcon width={14} height={14} /><span>{new Date(msg.scheduledTime).toLocaleString()}</span></div>
                                        <div className={cl("message-content")}>{msg.content.length > 200 ? msg.content.slice(0, 200) + "..." : msg.content}</div>
                                    </div>
                                    <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => handleDelete(msg.id)}>Delete</Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </ModalContent>

            <ModalFooter separator className={cl("modal-footer")}>
                <Button onClick={close} color={Button.Colors.PRIMARY}>Close</Button>
            </ModalFooter>
        </ModalRoot>
    );
}

export function openViewScheduledModal(): void {
    const key = openModal(props => <ViewScheduledModal rootProps={props} close={() => closeModal(key)} />);
}

function updatePhantomReactions(messageId: string, channelId: string, reactions: ScheduledReaction[]): void {
    const discordReactions = reactions.map(r => ({
        emoji: r.emoji,
        count: r.count,
        count_details: { burst: 0, normal: r.count },
        me: true,
        me_burst: false,
        burst_count: 0,
        burst_colors: [],
        burst_me: false
    }));

    FluxDispatcher.dispatch({
        type: "MESSAGE_UPDATE",
        message: {
            id: messageId,
            channel_id: channelId,
            reactions: discordReactions
        }
    });
}

function createReactionInterceptor() {
    return (event: any) => {
        if (event.type === "MESSAGE_REACTION_ADD" && event.optimistic) {
            const { messageId, channelId, emoji } = event;
            const phantomData = phantomMessageMap.get(messageId);

            if (phantomData) {
                const scheduledMsgId = phantomData.messageId;
                const msg = scheduledMessages.find(m => m.id === scheduledMsgId);
                if (msg) {
                    const reactions = pendingReactions.get(scheduledMsgId) || [];
                    const existingIdx = reactions.findIndex(r =>
                        r.emoji.name === emoji.name && r.emoji.id === emoji.id
                    );

                    if (existingIdx >= 0) {
                        reactions[existingIdx].count++;
                    } else {
                        reactions.push({
                            emoji: {
                                id: emoji.id,
                                name: emoji.name,
                                animated: emoji.animated
                            },
                            count: 1
                        });
                    }

                    pendingReactions.set(scheduledMsgId, reactions);
                    msg.reactions = reactions;
                    saveScheduledMessages();
                    updatePhantomReactions(messageId, channelId, reactions);
                }

                return false;
            }
        }

        if (event.type === "MESSAGE_REACTION_REMOVE" && event.optimistic) {
            const { messageId, channelId, emoji } = event;
            const phantomData = phantomMessageMap.get(messageId);

            if (phantomData) {
                const scheduledMsgId = phantomData.messageId;
                const msg = scheduledMessages.find(m => m.id === scheduledMsgId);
                if (msg) {
                    const reactions = pendingReactions.get(scheduledMsgId) || [];
                    const existingIdx = reactions.findIndex(r =>
                        r.emoji.name === emoji.name && r.emoji.id === emoji.id
                    );

                    if (existingIdx >= 0) {
                        reactions[existingIdx].count--;
                        if (reactions[existingIdx].count <= 0) {
                            reactions.splice(existingIdx, 1);
                        }
                    }

                    pendingReactions.set(scheduledMsgId, reactions);
                    msg.reactions = reactions;
                    saveScheduledMessages();
                    updatePhantomReactions(messageId, channelId, reactions);
                }

                return false;
            }
        }
    };
}

export default definePlugin({
    name: "ScheduledMessages",
    description: "Schedule messages to be sent at a specific time or after a delay",
    authors: [EquicordDevs.mmeta],
    dependencies: ["MessageAccessoriesAPI", "MessageEventsAPI"],
    settings,

    chatBarButton: {
        icon: CalendarIcon,
        render: ScheduledMessagesButton
    },

    toolboxActions: {
        "View Scheduled Messages": openViewScheduledModal
    },

    renderMessageAccessory({ message }) {
        const data = phantomMessageMap.get(message?.id) || message?.scheduledMessageData;
        if (!data) return null;

        const { scheduledTime } = data;
        const scheduledDate = new Date(scheduledTime).toLocaleString();
        const now = Date.now();
        const timeLeft = scheduledTime - now;

        let timeLeftStr = "";
        if (timeLeft > 0) {
            const minutes = Math.floor(timeLeft / 60000);
            const hours = Math.floor(minutes / 60);
            if (hours > 0) timeLeftStr = ` (${hours}h ${minutes % 60}m remaining)`;
            else timeLeftStr = ` (${minutes}m remaining)`;
        }

        return (
            <div className="vc-scheduled-msg-accessory">
                <TimerIcon width={14} height={14} />
                <span>Scheduled for {scheduledDate}{timeLeftStr}</span>
            </div>
        );
    },
    async onBeforeMessageSend(channelId, messageObj, options) {
        if (isScheduleModeEnabled && (messageObj.content.trim() || options.uploads?.length)) {
            setScheduleModeEnabled(false);

            let attachments: ScheduledAttachment[] | undefined;

            if (options.uploads?.length) {
                attachments = [];
                for (const upload of options.uploads) {
                    try {
                        const file = upload.item?.file;
                        if (file) {
                            const base64 = await new Promise<string>((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                    const result = reader.result as string;
                                    // Remove the data URL prefix (e.g., "data:image/png;base64,")
                                    const base64Data = result.split(",")[1] || result;
                                    resolve(base64Data);
                                };
                                reader.onerror = () => reject(reader.error);
                                reader.readAsDataURL(file);
                            });
                            attachments.push({
                                filename: upload.filename,
                                data: base64,
                                type: file.type
                            });
                        }
                    } catch (e) {
                        logger.error("Failed to read attachment:", e);
                    }
                }
            }

            openScheduleTimeModal(channelId, messageObj.content, attachments);
            return { cancel: true };
        }
    },

    async start() {
        await loadScheduledMessages();
        startScheduler();
        recreatePhantomMessages();

        reactionInterceptor = createReactionInterceptor();
        FluxDispatcher.addInterceptor(reactionInterceptor);

        originalRestAPIPut = RestAPI.put.bind(RestAPI);
        RestAPI.put = (options: any) => {
            const url = options?.url || "";
            const reactionMatch = url.match(/\/channels\/(\d+)\/messages\/([^/]+)\/reactions\//);
            if (reactionMatch && phantomMessageMap.has(reactionMatch[2])) {
                return Promise.resolve({ ok: true, body: {} });
            }
            return originalRestAPIPut!(options);
        };

        originalRestAPIGet = RestAPI.get.bind(RestAPI);
        RestAPI.get = (options: any) => {
            const url = options?.url || "";
            const reactionMatch = url.match(/\/channels\/(\d+)\/messages\/([^/]+)\/reactions\//);
            if (reactionMatch && phantomMessageMap.has(reactionMatch[2])) {
                return Promise.resolve({ ok: true, body: [] });
            }
            return originalRestAPIGet!(options);
        };
    },

    stop() {
        stopScheduler();
        for (const msg of scheduledMessages) {
            removePhantomMessage(msg);
        }

        if (reactionInterceptor) {
            const index = (FluxDispatcher as any)._interceptors?.indexOf(reactionInterceptor);
            if (index > -1) {
                (FluxDispatcher as any)._interceptors.splice(index, 1);
            }
            reactionInterceptor = null;
        }

        if (originalRestAPIPut) {
            RestAPI.put = originalRestAPIPut;
            originalRestAPIPut = null;
        }

        if (originalRestAPIGet) {
            RestAPI.get = originalRestAPIGet;
            originalRestAPIGet = null;
        }
    }
});
