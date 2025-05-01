import { addMessagePreSendListener, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { getCurrentChannel, sendMessage } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { ComponentDispatch } from "@webpack/common";
import { ChannelStore, PermissionsBits, UserStore } from "@webpack/common";
import { Settings } from "Vencord";

let maxLength: number = 0;

const canSplit: () => boolean = () => {
    const slowmode = getCurrentChannel()?.rateLimitPerUser ?? 0;
    const settings = Settings.plugins.SplitLargeMessages;
    return (settings.splitInSlowmode ? slowmode < settings.slowmodeMax : slowmode <= 0) && settings.disableFileConversion;
};

const autoMaxLength = () => {
    const hasNitro = UserStore.getCurrentUser().premiumType === 2;
    return hasNitro ? 4000 : 2000;
};

const split = async (channelId: string, chunks: string[], delayInMs: number) => {
    const sendChunk = async (chunk: string) => {
        await sendMessage(channelId, { content: chunk }, true);
    };

    // Send the chunks
    for (let i = 0; i < chunks.length; i++) {
        await sendChunk(chunks[i]);
        if (i < chunks.length - 1) // Not the last chunk
            await new Promise(resolve => setTimeout(resolve, delayInMs)); // Wait for `delayInMs`
    }
};

const listener: MessageSendListener = async (channelId, msg) => {
    if (msg.content.trim().length < maxLength || !canSplit()) return; // Nothing to split

    const channel = ChannelStore.getChannel(channelId);

    // Check for slowmode
    let isSlowmode = channel.rateLimitPerUser > 0;
    if ((channel.accessPermissions & PermissionsBits.MANAGE_MESSAGES) == PermissionsBits.MANAGE_MESSAGES
        || (channel.accessPermissions & PermissionsBits.MANAGE_CHANNELS) == PermissionsBits.MANAGE_CHANNELS)
        isSlowmode = false;

    // Not slowmode or splitInSlowmode is on and less than slowmodeMax
    if (!isSlowmode || (Settings.plugins.SplitLargeMessages.splitInSlowmode && channel.rateLimitPerUser < Settings.plugins.SplitLargeMessages.slowmodeMax)) {
        const chunks: string[] = [];
        const hardSplit: boolean = Settings.plugins.SplitLargeMessages.hardSplit;
        while (msg.content.length > maxLength) {
            msg.content = msg.content.trim();

            // Get last space or newline
            const splitIndex = Math.max(msg.content.lastIndexOf(' ', maxLength), msg.content.lastIndexOf('\n', maxLength));

            // If hard split is on or neither newline or space found, split at maxLength
            if (hardSplit || splitIndex === -1) {
                chunks.push(msg.content.slice(0, maxLength));
                msg.content = msg.content.slice(maxLength);
            }
            else {
                chunks.push(msg.content.slice(0, splitIndex));
                msg.content = msg.content.slice(splitIndex);
            }
        }

        ComponentDispatch.dispatchToLastSubscribed('CLEAR_TEXT');
        await split(channelId, [...chunks, msg.content], Settings.plugins.SplitLargeMessages.sendDelay * 1000);
    }
    return { cancel: true };
};

export default definePlugin({
    name: 'SplitLargeMessages',
    description: 'Splits large messages into multiple to fit Discord\'s message limit.',
    authors: [EquicordDevs.Reycko],
    dependencies: ['MessageEventsAPI'],
    settings: definePluginSettings({
        maxLength: {
            type: OptionType.NUMBER,
            description: 'Maximum length of a message before it is split. Set to 0 to automatically detect.',
            default: 0,
            max: 4000,
            onChange(newValue) {
                if (newValue === 0)
                    maxLength = autoMaxLength();
            },
        },

        disableFileConversion: {
            type: OptionType.BOOLEAN,
            description: 'If true, disables file conversion for large messages.',
            default: true,
        },

        sendDelay: {
            type: OptionType.SLIDER,
            description: 'Delay between each chunk in seconds.',
            default: 1,
            markers: [1, 2, 3, 5, 10],
        },

        hardSplit: {
            type: OptionType.BOOLEAN,
            description: 'If true, splits on the last character instead of the last space/newline.',
            default: false,
        },

        splitInSlowmode: {
            type: OptionType.BOOLEAN,
            description: 'Should messages be split if the channel has slowmode enabled?',
        },

        slowmodeMax: {
            type: OptionType.NUMBER,
            description: 'Maximum slowmode time if splitting in slowmode.',
            default: 5,
            min: 1,
            max: 30,
        }
    }),

    start() {
        if (Settings.plugins.SplitLargeMessages.maxLength === 0)
            maxLength = autoMaxLength();
        addMessagePreSendListener(listener);
    },

    stop() {
        removeMessagePreSendListener(listener);
    },

    patches: [
        {
            find: 'type:"MESSAGE_LENGTH_UPSELL"', // bypass message length check
            replacement: {
                match: /if\(\i.length>\i/,
                replace: 'if(false',
            }
        },

        {
            find: '(this,"hideAutocomplete"', // disable file conversion
            replacement: {
                match: /if\(\i.length>\i\)/,
                replace: 'if(false)',
            },
        }
    ]
});
