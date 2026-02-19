import { Logger } from "@utils/Logger";
import { findByProps } from "@webpack";

const logger = new Logger("MemoryOptimizer");

interface MessageActions {
    truncateMessages: (channelId: string, count: number, isBefore: boolean) => void;
}

interface SelectedChannelStore {
    getChannelId: () => string;
}

interface Dispatcher {
    subscribe: (event: string, callback: any) => void;
    unsubscribe: (event: string, callback: any) => void;
}

export default {
    name: "MemoryOptimizer",
    description: "Reduces Discord's RAM footprint by truncating inactive channel message caches instead of clearing them entirely, preventing re-fetch delays on revisit.",
    authors: [
        {
            name: "Awizz",
            id: 1267951485585461288n
        }
    ],

    dispatcher: null as Dispatcher | null,
    messageActions: null as MessageActions | null,
    selectedChannelStore: null as SelectedChannelStore | null,

    visitedChannels: [] as string[],
    // Number of channels to keep fully cached before truncating older ones
    MAX_CACHED_CHANNELS: 10,
    // Messages to keep per truncated channel — enough to render instantly without a network re-fetch
    MESSAGES_TO_KEEP: 30,
    // Delay before truncating a channel after the user left it (ms)
    PRUNE_DELAY: 30000,

    start() {
        logger.info("Initializing MemoryOptimizer...");

        this.messageActions = findByProps("truncateMessages", "clearChannel") as MessageActions;
        this.dispatcher = findByProps("dispatch", "subscribe") as Dispatcher;
        this.selectedChannelStore = findByProps("getChannelId", "getVoiceChannelId") as SelectedChannelStore;

        if (!this.dispatcher || !this.messageActions || !this.selectedChannelStore) {
            logger.error("Failed to hook into Discord's Webpack modules. Plugin aborting.");
            return;
        }

        this.onChannelSelect = this.onChannelSelect.bind(this);
        this.dispatcher.subscribe("CHANNEL_SELECT", this.onChannelSelect);
        logger.info("Successfully hooked into the Flux Dispatcher.");
    },

    stop() {
        if (this.dispatcher) {
            this.dispatcher.unsubscribe("CHANNEL_SELECT", this.onChannelSelect);
        }
        this.visitedChannels = [];
        logger.info("MemoryOptimizer disabled and hooks removed.");
    },

    onChannelSelect(payload: { channelId: string }) {
        if (!payload.channelId) return;

        const channelId = payload.channelId;

        // Update visited history, most recent channel at the end
        this.visitedChannels = this.visitedChannels.filter((id: string) => id !== channelId);
        this.visitedChannels.push(channelId);

        if (this.visitedChannels.length > this.MAX_CACHED_CHANNELS) {
            const oldestChannelId = this.visitedChannels.shift();

            if (oldestChannelId) {
                setTimeout(() => {
                    try {
                        // Safety check: never truncate the currently active channel
                        const currentChannelId = this.selectedChannelStore?.getChannelId();
                        if (oldestChannelId === currentChannelId) {
                            logger.debug(`Skipping prune: ${oldestChannelId} is currently active.`);
                            // Re-queue it so it gets pruned next time
                            this.visitedChannels.push(oldestChannelId);
                            return;
                        }

                        if (this.messageActions) {
                            // Truncate instead of clear: the channel stays instantly renderable on revisit,
                            // only old history (above MESSAGES_TO_KEEP) is freed from RAM
                            logger.debug(`RAM Prune: Truncating channel ${oldestChannelId} to ${this.MESSAGES_TO_KEEP} messages.`);
                            this.messageActions.truncateMessages(oldestChannelId, this.MESSAGES_TO_KEEP, false);
                        }
                    } catch (err) {
                        logger.error("Error during memory pruning:", err);
                    }
                }, this.PRUNE_DELAY);
            }
        }
    }
};