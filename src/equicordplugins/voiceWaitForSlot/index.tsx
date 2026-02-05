
import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { currentNotice, noticesQueue, popNotice, showNotice } from "@api/Notices";
import { definePluginSettings } from "@api/Settings";
import {
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalProps,
    ModalRoot,
    ModalSize,
    openModal,
} from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import type { Channel, CommandArgument, CommandContext } from "@vencord/discord-types";
import { ChannelType } from "@vencord/discord-types/enums";
import { findByPropsLazy } from "@webpack";
import {
    ChannelStore,
    GuildStore,
    Menu,
    React,
    SelectedChannelStore,
    VoiceStateStore,
} from "@webpack/common";
import { BaseText } from "@components/BaseText";
import { Button, TextButton } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { Span } from "@components/Span";

interface VoiceStateChangeEvent {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    selfVideo: boolean;
    selfStream: boolean;
}

const { selectVoiceChannel } = findByPropsLazy(
    "selectVoiceChannel",
    "selectChannel"
);

// Global variables to track waiting channels
const waitingChannels: Set<Channel> = new Set();
const WAITING_NOTICE_BUTTON_TEXT = "Stop Waiting";
let lastKnownVoiceChannelId: string | null = null;

// Helper function to remove our waiting notice from queue and dismiss if currently shown
function removeWaitingNotice() {
    console.log("[WaitForSlot] removeWaitingNotice called", {
        queueLength: noticesQueue.length,
        currentNotice: currentNotice ? { buttonText: currentNotice[2] } : null,
        queueHasWaitingNotice: noticesQueue.some(notice => notice[2] === WAITING_NOTICE_BUTTON_TEXT)
    });

    // Remove from queue first
    const queueIndex = noticesQueue.findIndex(notice => notice[2] === WAITING_NOTICE_BUTTON_TEXT);
    if (queueIndex !== -1) {
        console.log("[WaitForSlot] Removing waiting notice from queue at index", queueIndex);
        noticesQueue.splice(queueIndex, 1);
    }

    // If currently shown, dismiss it (this will automatically show next notice from queue)
    if (currentNotice?.[2] === WAITING_NOTICE_BUTTON_TEXT) {
        console.log("[WaitForSlot] Dismissing current waiting notice");
        popNotice();
    }
}

interface VoiceChannelContextProps {
    channel: Channel;
}

interface WaitForSlotModalProps {
    modalProps: ModalProps;
    channel: Channel;
    onConfirm: () => void;
}

function WaitForSlotModal({
    modalProps,
    channel,
    onConfirm,
}: WaitForSlotModalProps) {
    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <BaseText size="lg" weight="semibold">Join Voice Channel</BaseText>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Paragraph size="md">
                    A slot is now available in <strong>{channel.name}</strong>.
                    Do you want to join?
                    {channel.userLimit && (
                        <>
                            <br />
                            <br />
                            This channel has a limit of {channel.userLimit}{" "}
                            users.
                        </>
                    )}
                </Paragraph>
            </ModalContent>
            <ModalFooter>
                <TextButton
                    onClick={modalProps.onClose}
                    variant="primary"
                >
                    Cancel
                </TextButton>
                <Button
                    onClick={() => {
                        onConfirm();
                        modalProps.onClose();
                    }}
                    variant="primary"
                >
                    Join Channel
                </Button>
            </ModalFooter>
        </ModalRoot>
    );
}

function getVoiceChannelUserCount(channelId: string): number {
    try {
        const voiceStates = VoiceStateStore.getVoiceStatesForChannel(channelId);
        return voiceStates ? Object.keys(voiceStates).length : 0;
    } catch (error) {
        console.warn("Error getting voice channel user count:", error);
        return 0;
    }
}

function isChannelFull(channel: Channel): boolean {
    if (!channel || !channel.userLimit) return false;
    const currentUsers = getVoiceChannelUserCount(channel.id);
    return currentUsers >= channel.userLimit;
}

function playNotificationSound() {
    try {
        // Create a simple notification sound using Web Audio API
        const audioContext = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(
            1000,
            audioContext.currentTime + 0.1
        );
        oscillator.frequency.setValueAtTime(
            800,
            audioContext.currentTime + 0.2
        );

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.3
        );

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);

        // Clean up audio context after sound finishes
        oscillator.addEventListener("ended", () => {
            audioContext.close().catch(() => {});
        });
    } catch (error) {
        console.warn("Could not play notification sound:", error);
    }
}

function getWaitingChannelsByGuild(): Map<string, string[]> {
    const channelsByGuild = new Map<string, string[]>();

    for (const channel of waitingChannels) {
        const guildId = channel.guild_id;
        if (!channelsByGuild.has(guildId)) {
            channelsByGuild.set(guildId, []);
        }
        channelsByGuild.get(guildId)!.push(channel.name);
    }

    return channelsByGuild;
}

function createWaitingNoticeContent() {
    const channelsByGuild = getWaitingChannelsByGuild();
    const channelCount = waitingChannels.size;
    const serverCount = channelsByGuild.size;

    return (
        <div style={{ padding: "8px 0" }}>
            <div style={{ marginBottom: "8px" }}>
                <BaseText size="md" weight="semibold">
                    Waiting for slot in {channelCount} channel{channelCount === 1 ? "" : "s"} in {serverCount} server{serverCount === 1 ? "" : "s"}...
                </BaseText>
            </div>
            {Array.from(channelsByGuild.entries()).map(([guildId, channelNames]) => {
                const guild = GuildStore.getGuild(guildId);
                const guildName = guild?.name || "Unknown Server";
                return (
                    <div key={guildId} style={{ marginBottom: "4px" }}>
                        <Span size="sm" color="text-muted">
                            {guildName}: {channelNames.join(", ")}
                        </Span>
                    </div>
                );
            })}
        </div>
    );
}

function findAssociatedTextChannel(voiceChannelId: string): string | null {
    const voiceChannel = ChannelStore.getChannel(voiceChannelId);
    if (!voiceChannel || !voiceChannel.guild_id) return null;

    // In Discord, voice channels and text channels are separate entities
    // Try to find a text channel in the same guild with the same name or parent
    // For now, we'll just use the voice channel ID as a fallback since Discord
    // allows mentioning voice channels in text channels
    // This function could be enhanced to find the actual associated text channel
    // by searching guild channels, but for now returning the voice channel ID
    // works since Discord handles voice channel mentions in any text channel
    return voiceChannelId;
}

function addChannelToWaiting(channel: Channel) {
    console.log("[WaitForSlot] addChannelToWaiting", {
        channelId: channel.id,
        channelName: channel.name,
        currentWaitingCount: waitingChannels.size,
        userLimit: channel.userLimit
    });

    waitingChannels.add(channel);
    console.log("[WaitForSlot] Channel added, new waiting count:", waitingChannels.size);

    updateWaitingNotice();

    // Send local message
    const targetTextChannelId = findAssociatedTextChannel(channel.id);
    if (targetTextChannelId) {
        sendBotMessage(targetTextChannelId, {
            content: `Started waiting for a free slot in <#${channel.id}>`,
        });
    }
}

function removeChannelFromWaiting(
    channel: Channel,
    sendMessage: boolean = true
) {
    console.log("[WaitForSlot] removeChannelFromWaiting", {
        channelId: channel.id,
        channelName: channel.name,
        currentWaitingCount: waitingChannels.size,
        sendMessage
    });

    waitingChannels.delete(channel);
    console.log("[WaitForSlot] Channel removed, new waiting count:", waitingChannels.size);

    // Send local message
    if (sendMessage) {
        const targetTextChannelId = findAssociatedTextChannel(channel.id);
        if (targetTextChannelId) {
            sendBotMessage(targetTextChannelId, {
                content: `Stopped waiting for a free slot in <#${channel.id}>`,
            });
        }
    }

    if (waitingChannels.size === 0) {
        console.log("[WaitForSlot] No more waiting channels, stopping");
        stopWaiting();
    } else {
        updateWaitingNotice();
    }
}

function stopWaiting() {
    console.log("[WaitForSlot] stopWaiting called, clearing", waitingChannels.size, "channels");
    waitingChannels.clear();
    dismissWaitingNotice();
}

function showWaitingNotice() {
    console.log("[WaitForSlot] showWaitingNotice called", {
        waitingChannelsCount: waitingChannels.size,
        queueLength: noticesQueue.length,
        currentNotice: currentNotice ? { buttonText: currentNotice[2] } : null
    });

    // Remove any existing waiting notice to prevent stacking
    removeWaitingNotice();

    console.log("[WaitForSlot] Calling showNotice");
    showNotice(
        createWaitingNoticeContent(),
        WAITING_NOTICE_BUTTON_TEXT,
        () => {
            console.log("[WaitForSlot] Notice button clicked (Stop Waiting)");
            stopWaiting();
        }
    );

    console.log("[WaitForSlot] showNotice called, checking state after", {
        queueLength: noticesQueue.length,
        currentNotice: currentNotice ? { buttonText: currentNotice[2] } : null
    });
}

function updateWaitingNotice() {
    console.log("[WaitForSlot] updateWaitingNotice called", {
        waitingChannelsCount: waitingChannels.size,
        queueLength: noticesQueue.length,
        currentNotice: currentNotice ? { buttonText: currentNotice[2] } : null
    });

    if (waitingChannels.size === 0) {
        console.log("[WaitForSlot] No waiting channels, dismissing notice");
        dismissWaitingNotice();
    } else {
        // Remove existing notice and show updated one
        // This ensures we don't stack notices
        console.log("[WaitForSlot] Has waiting channels, showing/updating notice");
        showWaitingNotice();
    }
}

function dismissWaitingNotice() {
    console.log("[WaitForSlot] dismissWaitingNotice called");
    // Remove our waiting notice from queue and dismiss if currently shown
    removeWaitingNotice();
}

// Helper function to attempt joining a voice channel with error handling
function attemptJoinChannel(channelId: string, channelName: string) {
    try {
        selectVoiceChannel(channelId);
    } catch (error) {
        console.error("Error calling selectVoiceChannel:", error);
        showNotice(
            <Paragraph size="md">Failed to join voice channel</Paragraph>,
            "Close",
            () => {}
        );
    }
}

function joinAvailableChannel(channel: Channel) {
    console.log("[WaitForSlot] joinAvailableChannel - Slot available!", {
        channelId: channel.id,
        channelName: channel.name,
        waitingChannelsCount: waitingChannels.size
    });

    // Clear all waiting channels and dismiss notice
    waitingChannels.clear();
    dismissWaitingNotice();

    // Play notification sound if enabled
    if (settings.store.playSound) {
        console.log("[WaitForSlot] Playing notification sound");
        playNotificationSound();
    }

    // Show confirmation modal if setting is enabled, otherwise join immediately
    if (settings.store.showConfirmation) {
        openModal(modalProps => (
            <WaitForSlotModal
                modalProps={modalProps}
                channel={channel}
                onConfirm={() => {
                    attemptJoinChannel(channel.id, channel.name);
                }}
            />
        ));
    } else {
        showNotice(
            <div style={{ padding: "8px 0" }}>
                <BaseText size="md" weight="semibold">Slot available!</BaseText>
                <Paragraph size="sm" style={{ marginTop: "4px" }}>
                    Joining {channel.name}...
                </Paragraph>
            </div>,
            "Close",
            () => {}
        );
        attemptJoinChannel(channel.id, channel.name);
    }
}

function handleVoiceStateUpdate(voiceStates: VoiceStateChangeEvent[]) {
    if (waitingChannels.size === 0) return;

    console.log("[WaitForSlot] handleVoiceStateUpdate", {
        waitingChannelsCount: waitingChannels.size,
        voiceStatesCount: voiceStates.length
    });

    for (const voiceState of voiceStates) {
        // Check if someone left one of our waiting channels
        if (voiceState.oldChannelId) {
            // Use Set.has() for O(1) lookup instead of Array.find() O(n)
            // Find the channel object if it exists in our waiting set
            let waitingChannel: Channel | undefined;
            for (const channel of waitingChannels) {
                if (channel.id === voiceState.oldChannelId) {
                    waitingChannel = channel;
                    break;
                }
            }

            if (waitingChannel) {
                const isFull = isChannelFull(waitingChannel);
                console.log("[WaitForSlot] Voice state update for waiting channel", {
                    channelId: waitingChannel.id,
                    channelName: waitingChannel.name,
                    isFull,
                    oldChannelId: voiceState.oldChannelId,
                    newChannelId: voiceState.channelId
                });

                if (!isFull) {
                    // Found an available slot!
                    console.log("[WaitForSlot] Channel is no longer full, joining!");
                    joinAvailableChannel(waitingChannel);
                    return; // Only join the first available channel
                }
            }
        }
    }
}

function waitForSlot(channel: Channel) {
    // Add channel to waiting list
    addChannelToWaiting(channel);

    // Check immediately in case the channel is already available
    if (!isChannelFull(channel)) {
        joinAvailableChannel(channel);
    }
}

const VoiceChannelContext: NavContextMenuPatchCallback = (
    children,
    { channel }: VoiceChannelContextProps
) => {
    // Only for voice and stage channels
    // 2 = GUILD_VOICE, 13 = GUILD_STAGE_VOICE
    if (!channel || (channel.type !== ChannelType.GUILD_VOICE && channel.type !== 13)) return;

    // Don't show if user is currently in this channel
    const currentVoiceChannelId = SelectedChannelStore.getVoiceChannelId();
    if (currentVoiceChannelId === channel.id) return;

    const isWaitingForChannel = waitingChannels.has(channel);

    // Show "Stop waiting for slot" if currently waiting for this channel
    if (isWaitingForChannel) {
        const handleStopWaiting = () => {
            removeChannelFromWaiting(channel);
        };

        children.splice(
            -1,
            0,
            <Menu.MenuItem
                key="stop-waiting-for-slot"
                id="stop-waiting-for-slot"
                label="Stop waiting for slot"
                action={handleStopWaiting}
            />
        );
        return;
    }

    // Relaxed check: Show "Wait for slot" (Auto Join) on any valid channel where we aren't present
    // Removed checks for isFull and currentUsers === 0 to make the option always visible
    const handleWaitForSlot = () => {
        waitForSlot(channel);
    };

    children.splice(
        -1,
        0,
        <Menu.MenuItem
            key="wait-for-slot"
            id="wait-for-slot"
            label="Wait for slot"
            action={handleWaitForSlot}
        />
    );
};

const settings = definePluginSettings({
    showConfirmation: {
        type: OptionType.BOOLEAN,
        description: "Show confirmation modal when a slot becomes available",
        default: true,
        restartNeeded: false,
    },
    playSound: {
        type: OptionType.BOOLEAN,
        description: "Play notification sound when a slot becomes available",
        default: true,
        restartNeeded: false,
    },
    stopOnDisconnect: {
        type: OptionType.BOOLEAN,
        description: "Stop waiting when you disconnect from voice",
        default: true,
        restartNeeded: false,
    },
    toastInterval: {
        type: OptionType.SLIDER,
        description:
            "Legacy setting - notices are now shown continuously while waiting (0 = off)",
        markers: [0, 10, 20, 30, 60, 120, 300],
        stickToMarkers: false,
        default: 0,
        restartNeeded: false,
    },
});

export default definePlugin({
    name: "WaitForSlot",
    description:
        "Adds a 'Wait for Slot' button to voice channel context menus that waits until a slot becomes available. Supports multiple channels across multiple servers.",
    authors: [
        { name: "Bluscream", id: 331103316650393611n },
        { name: "Antigravity AI", id: 0n },
    ],

    settings,

    contextMenus: {
        "channel-context": VoiceChannelContext,
    },

    commands: [
        {
            name: "stopwaiting",
            description: "Stop waiting for voice channel slots",
            inputType: ApplicationCommandInputType.BOT,
            execute: async (args: CommandArgument[], ctx: CommandContext) => {
                if (waitingChannels.size > 0) {
                    stopWaiting();
                    sendBotMessage(ctx.channel.id, {
                        content: "Stopped waiting for voice channel slots",
                    });
                } else {
                    sendBotMessage(ctx.channel.id, {
                        content:
                            "Not currently waiting for any voice channel slots",
                    });
                }
            },
        },
        {
            name: "waiting",
            description: "List all voice channels you're currently waiting for",
            inputType: ApplicationCommandInputType.BOT,
            execute: async (args: CommandArgument[], ctx: CommandContext) => {
                if (waitingChannels.size === 0) {
                    sendBotMessage(ctx.channel.id, {
                        content:
                            "Not currently waiting for any voice channel slots",
                    });
                    return;
                }

                // Group channels by guild
                const channelsByGuild = new Map<string, Channel[]>();
                for (const channel of waitingChannels) {
                    const guildId = channel.guild_id;
                    if (!channelsByGuild.has(guildId)) {
                        channelsByGuild.set(guildId, []);
                    }
                    channelsByGuild.get(guildId)!.push(channel);
                }

                // Build the response message with slot and server counts
                const totalChannels = waitingChannels.size;
                const totalServers = channelsByGuild.size;
                const parts: string[] = [];
                parts.push(
                    "**Currently waiting for slots in:**\n" +
                        `> **${totalChannels} channel${
                            totalChannels === 1 ? "" : "s"
                        }** in **${totalServers} server${
                            totalServers === 1 ? "" : "s"
                        }**\n`
                );
                for (const [guildId, channels] of channelsByGuild) {
                    const guild = GuildStore.getGuild(guildId);
                    const guildName = guild?.name || "Unknown Server";
                    parts.push(`**\`${guildName}\`**`);

                    for (const channel of channels) {
                        const currentUsers = getVoiceChannelUserCount(
                            channel.id
                        );
                        const userLimit = channel.userLimit || "∞";
                        parts.push(
                            `• <#${channel.id}> \`${currentUsers}/${userLimit} users\``
                        );
                    }
                    parts.push(""); // Empty line between guilds
                }

                const message = parts.join("\n").trim();
                sendBotMessage(ctx.channel.id, {
                    content: message,
                });
            },
        },
    ],

    start() {
        // Plugin initialized
    },

    flux: {
        VOICE_STATE_UPDATES({
            voiceStates,
        }: {
            voiceStates: VoiceStateChangeEvent[];
        }) {
            handleVoiceStateUpdate(voiceStates);

            // Implement stopOnDisconnect
            if (settings.store.stopOnDisconnect) {
                const currentVoiceChannelId =
                    SelectedChannelStore.getVoiceChannelId();

                // Track the current voice channel ID
                // Only stop waiting if user WAS in a channel and then disconnected
                if (currentVoiceChannelId) {
                    lastKnownVoiceChannelId = currentVoiceChannelId;
                } else if (lastKnownVoiceChannelId && waitingChannels.size > 0) {
                    // User was in a channel (lastKnownVoiceChannelId is set) and now disconnected
                    console.log("[WaitForSlot] User disconnected from voice channel, stopping wait", {
                        lastKnownVoiceChannelId,
                        waitingChannelsCount: waitingChannels.size
                    });
                    stopWaiting();
                    lastKnownVoiceChannelId = null;
                }
            }
        },
        CHANNEL_DELETE({ channel }: { channel: Channel }) {
            // Check if the deleted channel is one we're waiting for
            // Use Set iteration instead of Array.from().find() for better performance
            let waitingChannel: Channel | undefined;
            for (const ch of waitingChannels) {
                if (ch.id === channel.id) {
                    waitingChannel = ch;
                    break;
                }
            }

            if (waitingChannel) {
                // Remove from waiting list without sending a message (channel no longer exists)
                removeChannelFromWaiting(waitingChannel, false);

                // Show notice notification
                showNotice(
                    <div style={{ padding: "8px 0" }}>
                        <BaseText size="md" weight="semibold">Channel Deleted</BaseText>
                        <Paragraph size="sm" style={{ marginTop: "4px" }}>
                            Channel {waitingChannel.name} was deleted and removed from waiting list
                        </Paragraph>
                    </div>,
                    "Close",
                    () => {}
                );
            }
        },
    },

    stop() {
        // Clean up
        stopWaiting();
    },
});
