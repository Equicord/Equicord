
import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { copyWithToast } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, Message } from "@vencord/discord-types";
import { findStoreLazy } from "@webpack";
import { ChannelStore, FluxDispatcher, GuildStore, Menu, MessageStore, React, Toasts, UserStore } from "@webpack/common";
interface VoiceChannelContextProps {
    channel: Channel;
}
const pluginName = "Extra Voice Channel Utilities";
const VoiceStateStore = findStoreLazy("VoiceStateStore");
const ChannelStatusStore = findStoreLazy("ChannelStatusStore");
const statuses: Record<string, string> = {};
// Helper function to show error toasts
function showToast(message: string, error?: any | undefined) {
    if (error) console.error(`[${pluginName}] ${message}:`, error);
    else console.log(`[${pluginName}] ${message}`);
    Toasts.show({
        message,
        id: Toasts.genId(),
        type: error ? Toasts.Type.FAILURE : Toasts.Type.MESSAGE
    });
}
function requestVoiceChannelStatus(channelId: string) {
    try {
        const channel = ChannelStore.getChannel(channelId);
        if (channel?.guild_id) {
            // Dispatch event to request channel statuses for the guild
            const dispatchPayload = {
                type: "VOICE_CHANNEL_STATUS_REQUEST",
                guildId: channel.guild_id
            };
            FluxDispatcher.dispatch(dispatchPayload);
        } else {
        }
    } catch (error) {
        showToast("Error requesting voice channel status", error);
    }
}
// Extract status text from UI element
function getVoiceChannelStatusFromUI(channelId: string): string | null {
    try {
        // Find all voice channel elements
        const voiceChannelElements = document.querySelectorAll('li[class*="voiceChannel"]');
        for (const element of voiceChannelElements) {
            // Get the React fiber to access channel props
            const fiberKey = Object.keys(element).find(key =>
                key.startsWith("__reactInternalInstance$") || key.startsWith("__reactFiber$")
            );
            if (fiberKey) {
                const fiber = (element as any)[fiberKey];
                let current = fiber;
                // Traverse up the React tree to find the component with channel prop
                while (current) {
                    if (current.memoizedProps && current.memoizedProps.channel) {
                        const { channel } = current.memoizedProps;
                        // Check if this is the channel we're looking for
                        if (channel.id === channelId) {
                            // Try to find the status span element within this channel
                            // Look for span that contains the status text (typically after the "Invite to Voice" number spans)
                            const spans = element.querySelectorAll("span");
                            for (const span of spans) {
                                const text = span.textContent?.trim();
                                if (text && text.length > 3 && !text.match(/^(Voice|Open Chat|Invite to Voice|\d{1,2}|Playing|WZDE|snus)$/)) {
                                    return text;
                                }
                            }
                            // Fallback: extract from full text using patterns
                            const text = element.textContent || "";
                            const statusMatch = text.match(/Invite to Voice\d+(.+?)(?=@[A-Za-z0-9_]+|\d{1,2}:\d{2}:\d{2})/);
                            if (statusMatch) {
                                const status = statusMatch[1].trim();
                                return status;
                            }
                            const fallbackMatch = text.match(/Open Chat(.+?)(?=@[A-Za-z0-9_]+|\d{1,2}:\d{2}:\d{2})/);
                            if (fallbackMatch) {
                                const status = fallbackMatch[1].trim();
                                return status;
                            }
                            return null;
                        }
                        break;
                    }
                    current = current.return;
                }
            }
        }
        return null;
    } catch (error) {
        console.error(`[${pluginName}] Error getting status from UI:`, error);
        return null;
    }
}
// Voice Channel Status Functions
function getVoiceChannelStatus(channelId: string): string | null {
    try {
        // Get channel info for guild_id and type
        const channel = ChannelStore.getChannel(channelId);
        if (!channel) {
            return null;
        }
        // Request fresh status data first
        requestVoiceChannelStatus(channelId);
        // Get status from ChannelStatusStore with correct parameters
        let status = ChannelStatusStore.getChannelStatus(channelId, channel.guild_id, channel.type);
        if (status !== undefined && status !== null && status.trim() !== "") {
            return status;
        }
        status = statuses[channelId];
        if (status !== undefined && status !== null && status.trim() !== "") {
            return status;
        }
        // Try to get status from UI element as fallback
        const uiStatus = getVoiceChannelStatusFromUI(channelId);
        if (uiStatus !== undefined && uiStatus !== null && uiStatus.trim() !== "") {
            return uiStatus;
        }
        return null;
    } catch (error) {
        showToast("Error getting voice channel status", error);
        return null;
    }
}
// Helper function to extract code while ignoring specified words
function extractCodeWithIgnore(text: string, regex: RegExp, ignoredWords: string[]): string | null {
    if (!text) return null;
    const matches = text.match(regex);
    if (!matches) return null;
    // Parse ignored words from settings string
    const ignoredSet = new Set(ignoredWords.map(word => word.toLowerCase().trim()));
    // Filter out ignored words and return first valid match
    for (const match of matches) {
        if (!ignoredSet.has(match.toLowerCase())) {
            return match;
        }
    }
    return null; // All matches were ignored
}
async function extractCode(channel: Channel): Promise<string | null> {
    const regex = new RegExp(settings.store.codeRegex);
    const ignoredWords = settings.store.ignoredWords.split(",").filter(w => w.trim());
    // Try to extract from channel status
    const status = getVoiceChannelStatus(channel.id);
    if (status) {
        const statusMatch = extractCodeWithIgnore(status, regex, ignoredWords);
        if (statusMatch) {
            return statusMatch;
        }
    }
    // Try to extract from channel topic
    const topicMatch = extractCodeWithIgnore(channel.topic || "", regex, ignoredWords);
    if (topicMatch) {
        return topicMatch;
    }
    // Try to extract from channel name
    const nameMatch = extractCodeWithIgnore(channel.name || "", regex, ignoredWords);
    if (nameMatch) {
        return nameMatch;
    }
    // Try to extract from messages in the channel
    try {
        const messages = MessageStore.getMessages(channel.id);
        if (messages && messages.toArray) {
            const messageArray = messages.toArray();
            for (const message of messageArray) {
                if (message.content) {
                    const messageMatch = extractCodeWithIgnore(message.content, regex, ignoredWords);
                    if (messageMatch) {
                        return messageMatch;
                    }
                }
            }
        } else {
        }
    } catch (error) {
        console.error(`[${pluginName}] Error extracting code from messages:`, error);
    }
    return null;
}
// Voice Channel Context Menu
const VoiceChannelContext: NavContextMenuPatchCallback = (children, { channel }: VoiceChannelContextProps) => {
    // only for voice and stage channels
    if (channel.type !== 2 && channel.type !== 13) return children;
    children.splice(
        -1,
        0,
        <Menu.MenuItem
            label="Voice Utilities"
            key="voice-tools2"
            id="voice-tools2"
        >
            <Menu.MenuItem
                key="voice-tools-copy-info"
                id="voice-tools-copy-info"
                label="Copy Info"
                action={() => {
                    try {
                        let guild;
                        try {
                            guild = GuildStore.getGuild(channel.guild_id);
                        } catch (error) {
                            console.error(`[${pluginName}] Error getting guild:`, error);
                        }
                        let status;
                        try {
                            status = getVoiceChannelStatus(channel.id);
                        } catch (error) {
                            console.error(`[${pluginName}] Error getting status:`, error);
                        }
                        let users = "";
                        try {
                            const voiceStates = VoiceStateStore.getVoiceStatesForChannel(channel.id) as Record<string, any>;
                            users = Object.values(voiceStates || {}).map(state => {
                                const user = UserStore.getUser(state.userId);
                                return user ? `\\@${user.username}` : null;
                            }).filter(Boolean).join(", ");
                        } catch (error) {
                            console.error(`[${pluginName}] Error getting voice states:`, error);
                        }
                        let messageCount = 0;
                        let lastMessage: Message | null = null;
                        try {
                            const messages = MessageStore.getMessages(channel.id);
                            messageCount = messages && messages.toArray ? messages.toArray().length : 0;
                            lastMessage = messages && messages.toArray ? messages.toArray()[0] : null;
                        } catch (error) {
                            console.error(`[${pluginName}] Error getting messages:`, error);
                        }
                        let info = `https://discord.com/channels/${channel.guild_id}/${channel.id}`;
                        if (lastMessage)
                            info += `/${lastMessage.id}`;
                        if (guild)
                            info += `\nGuild: \`${guild.name}\``;
                        if (channel?.name)
                            info += `\nName: \`${channel.name}\``;
                        if (channel?.topic)
                            info += `\nTopic: \`${channel.topic}\``;
                        if (status)
                            info += `\nStatus: \`${status}\``;
                        if (users)
                            info += `\nUsers: ${users}`;
                        if (messageCount > 0)
                            info += `\nMessages: ${messageCount}`;
                        copyWithToast(info.trim());
                    } catch (error) {
                        console.error(`[${pluginName}] Critical error in copy info:`, error);
                        showToast("Error copying info", error);
                    }
                }}
            />
            <Menu.MenuItem
                key="voice-tools-copy-name"
                id="voice-tools-copy-name"
                label="Copy Name"
                action={() => {
                    try {
                        if (channel?.name) {
                            copyWithToast(channel.name, `Channel name "${channel.name}" copied`);
                        } else {
                            showToast("No channel name found");
                        }
                    } catch (error) {
                        showToast("Error copying channel name", error);
                    }
                }}
            />
            <Menu.MenuItem
                key="voice-tools-copy-status"
                id="voice-tools-copy-status"
                label="Copy Status"
                action={() => {
                    try {
                        const status = getVoiceChannelStatus(channel.id);
                        if (status) {
                            copyWithToast(status, `Channel status "${status}" copied`);
                        } else {
                            showToast("No channel status found");
                        }
                    } catch (error) {
                        showToast("Error copying channel status", error);
                    }
                }}
            />
            <Menu.MenuItem
                key="voice-tools-copy-code"
                id="voice-tools-copy-code"
                label="Copy Code"
                action={async () => {
                    try {
                        const code = await extractCode(channel);
                        if (code) {
                            copyWithToast(code, `Code ${code} copied`);
                        } else {
                            showToast("No code found");
                        }
                    } catch (error) {
                        showToast("Error extracting code", error);
                    }
                }}
            />
        </Menu.MenuItem>
    );
    return children;
};
const settings = definePluginSettings({
    fallbackDict: {
        type: OptionType.BOOLEAN,
        description: "Use fallback dictionary for channel statuses",
        default: true
    },
    codeRegex: {
        type: OptionType.STRING,
        description: "Regex pattern to match codes",
        default: "\\b([a-z0-9]{5}|[A-Z0-9]{5})\\b"
    },
    ignoredWords: {
        type: OptionType.STRING,
        description: "Whitelisted words to ignore in status extraction",
        default: "camos,grind"
    },
    autoExtractServers: {
        type: OptionType.STRING,
        description: "Comma seperated list of guild IDs to auto extract codes from when joining a voice channel",
        default: ""
    }
});
// Auto extract code when joining voice channels in specified servers
async function handleVoiceStateUpdate(voiceState: any) {
    try {
        // Only proceed when user is joining a voice channel
        if (!voiceState.channelId) {
            return;
        }
        if (voiceState.userId !== UserStore.getCurrentUser().id) {
            return;
        }
        const channel = ChannelStore.getChannel(voiceState.channelId);
        if (!channel) {
            return;
        }
        if (channel.type !== 2 && channel.type !== 13) {
            return; // Not a voice/stage channel
        }
        // Check if this server is in the auto-extract list
        const autoExtractServers = settings.store.autoExtractServers.split(",").map(id => id.trim()).filter(Boolean);
        const serverInList = autoExtractServers.includes(channel.guild_id);
        if (!serverInList) {
            return;
        }
        // Extract and copy the code
        const code = await extractCode(channel);
        if (code) {
            copyWithToast(code, `Auto-extracted code ${code} copied`);
        } else {
        }
    } catch (error) {
        console.error(`[${pluginName}] ❌ Error in auto-extract:`, error);
    }
}
// Handle auto-extraction when voice channel status updates
async function handleVoiceChannelStatusUpdate(channelId: string, guildId: string) {
    try {
        // Check if current user is in this voice channel
        const currentVoiceState = VoiceStateStore.getVoiceStateForUser(UserStore.getCurrentUser().id);
        if (!currentVoiceState || currentVoiceState.channelId !== channelId) {
            return;
        }
        const channel = ChannelStore.getChannel(channelId);
        if (!channel) {
            return;
        }
        // Check if this server is in the auto-extract list
        const autoExtractServers = settings.store.autoExtractServers.split(",").map(id => id.trim()).filter(Boolean);
        const serverInList = autoExtractServers.includes(guildId);
        if (!serverInList) {
            return;
        }
        // Extract and copy the code
        const code = await extractCode(channel);
        if (code) {
            copyWithToast(code, `Auto-extracted code ${code} copied`);
        } else {
        }
    } catch (error) {
        console.error(`[${pluginName}] ❌ Error in status update auto-extract:`, error);
    }
}
export default definePlugin({
    name: pluginName,
    description: "Voice channel copy utilities (name, status, code)",
    authors: [
        { name: "Bluscream", id: 467777925790564352n },
        { name: "Cursor.AI", id: 0n }],
    contextMenus: {
        "channel-context": VoiceChannelContext
    },
    settings,
    flux: {
        VOICE_CHANNEL_STATUS_UPDATE({
            type,
            id,
            guildId,
            status,
        }: {
            type: string;
            id: string;
            guildId: string;
            status: string;
        }) {
            if (settings.store.fallbackDict) {
                statuses[id] = status;
            }
        },
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: any[]; }) {
            const myId = UserStore.getCurrentUser().id;
            for (const voiceState of voiceStates) {
                if (voiceState.userId === myId) {
                    handleVoiceStateUpdate(voiceState);
                    break; // Only process our own voice state
                }
            }
        },
        VOICE_STATE_CONNECT(voiceState: any) {
            handleVoiceStateUpdate(voiceState);
        },
        VOICE_STATE_DISCONNECT(voiceState: any) {
        }
    },
    start() {
    }
});
