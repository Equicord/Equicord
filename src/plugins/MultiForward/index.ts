import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { findByProps } from "@webpack";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

declare global {
    interface Window {
        __multiForwardSelection?: {
            channelId: string;
            startId: string;
            endId: string;
        } | null;
    }
}

const settings = definePluginSettings({
    baseDelay: {
        type: OptionType.NUMBER,
        description: "Base Delay (ms): The default delay between sending each message.",
        default: 2500
    },
    randomizeDelay: {
        type: OptionType.NUMBER,
        description: "Randomizer Jitter (ms): Adds or subtracts a random amount up to this value.",
        default: 500
    },
    cooldownCount: {
        type: OptionType.NUMBER,
        description: "Messages Before Cooldown: Trigger an extra delay after sending this many messages. Set to 0 to disable.",
        default: 5
    },
    cooldownDelay: {
        type: OptionType.NUMBER,
        description: "Cooldown Delay (ms): The additional time to wait during a cooldown pause.",
        default: 5000
    }
});

let MessageActions: any;
let MessageStore: any;
let origSendMessage: any;
let selectionHandler: () => void;

export default definePlugin({
    name: "MultiForward",
    description: "Forwards multiple selected messages. Note: it's not recommended to send more than 6-10 messages at once or you will need to increase the delays",
    authors: [EquicordDevs.ELJoOker],
    settings,

    start() {
        console.log("[MultiForward] Plugin started! Operating in Strict React/Store mode.");
        window.__multiForwardSelection = null;

        selectionHandler = () => {
            const selection = window.getSelection();
            
            // If the user un-highlighted the text...
            if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
                // Check if they lost the highlight because they clicked into the Forward Modal
                const activeEl = document.activeElement;
                if (activeEl && (activeEl.closest('[role="dialog"]') || activeEl.closest('[class*="modal"]'))) {
                    return; // They are in the modal, KEEP the selection alive!
                }
                
                // Otherwise, they just clicked the chat background. Clear the multi-forward cache.
                window.__multiForwardSelection = null;
                return;
            }

            let anchorNode = selection.anchorNode;
            let focusNode = selection.focusNode;

            if (anchorNode?.nodeType === Node.TEXT_NODE) anchorNode = anchorNode.parentNode;
            if (focusNode?.nodeType === Node.TEXT_NODE) focusNode = focusNode.parentNode;

            const anchorEl = (anchorNode as Element)?.closest?.('[id^="chat-messages-"]');
            const focusEl = (focusNode as Element)?.closest?.('[id^="chat-messages-"]');

            if (anchorEl && focusEl) {
                const anchorParts = anchorEl.id.split('-');
                const focusParts = focusEl.id.split('-');
                
                if (anchorParts.length >= 4 && focusParts.length >= 4) {
                    const channelId = anchorParts[2];
                    const id1 = BigInt(anchorParts[3]);
                    const id2 = BigInt(focusParts[3]);

                    // If they only highlighted text inside ONE single message, don't trigger multi-forward
                    if (id1 === id2) {
                        window.__multiForwardSelection = null;
                        return;
                    }

                    const startId = id1 < id2 ? id1 : id2;
                    const endId = id1 > id2 ? id1 : id2;

                    window.__multiForwardSelection = {
                        channelId,
                        startId: startId.toString(),
                        endId: endId.toString()
                    };
                } else {
                    window.__multiForwardSelection = null;
                }
            } else {
                window.__multiForwardSelection = null;
            }
        };

        // Listen to native browser selection changes
        document.addEventListener("selectionchange", selectionHandler);

        MessageActions = findByProps("sendMessage", "receiveMessage");
        MessageStore = findByProps("getMessage", "getMessages");
        const Toasts = findByProps("showToast", "createToast");
        
        if (MessageActions && MessageActions.sendMessage && MessageStore) {
            origSendMessage = MessageActions.sendMessage;
            
            MessageActions.sendMessage = function(channelId: string, message: any, promise: any, options: any, ...rest: any[]) {
                try {
                    if (options && options.messageReference && options.messageReference.type === 1) {
                        const sel = window.__multiForwardSelection;
                        const forwardedMsgId = options.messageReference.message_id;
                        
                        if (sel) {
                            // Check if the message the user clicked "Forward" on falls inside their highlighted block
                            if (BigInt(forwardedMsgId) >= BigInt(sel.startId) && BigInt(forwardedMsgId) <= BigInt(sel.endId)) {
                                
                                const messagesObj = MessageStore.getMessages(sel.channelId);
                                let msgArray: any[] = [];
                                
                                if (messagesObj) {
                                    if (typeof messagesObj.toArray === "function") msgArray = messagesObj.toArray();
                                    else if (Array.isArray(messagesObj)) msgArray = messagesObj;
                                    else if (messagesObj._array) msgArray = messagesObj._array;
                                }

                                const idsToSend = msgArray
                                    .filter(m => BigInt(m.id) >= BigInt(sel.startId) && BigInt(m.id) <= BigInt(sel.endId))
                                    .map(m => m.id)
                                    .sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
                                
                                if (idsToSend.length > 1) {
                                    // Clear selection immediately so it doesn't accidentally loop
                                    window.__multiForwardSelection = null;

                                    if (Toasts && Toasts.showToast && Toasts.createToast) {
                                        Toasts.showToast(Toasts.createToast(`Queuing ${idsToSend.length} messages...`, 0));
                                    }

                                    (async () => {
                                        for (let i = 0; i < idsToSend.length; i++) {
                                            const msgId = idsToSend[i];
                                            
                                            const newOptions = {
                                                ...options,
                                                messageReference: {
                                                    ...options.messageReference,
                                                    message_id: msgId,
                                                    channel_id: sel.channelId
                                                }
                                            };
                                            
                                            const newMessage = { ...message };
                                            delete newMessage.nonce; 
                                            
                                            if (i > 0 && newMessage.content) {
                                                newMessage.content = ""; 
                                            }

                                            origSendMessage.call(this, channelId, newMessage, promise, newOptions, ...rest);
                                            
                                            if (i < idsToSend.length - 1) {
                                                const base = Number(settings.store.baseDelay) || 2500;
                                                const jitter = Number(settings.store.randomizeDelay) || 0;
                                                const coolCount = Number(settings.store.cooldownCount) || 0;
                                                const coolDelay = Number(settings.store.cooldownDelay) || 0;

                                                const randomOffset = jitter > 0 ? Math.floor(Math.random() * (jitter * 2 + 1)) - jitter : 0;
                                                let currentWaitTime = Math.max(0, base + randomOffset);

                                                if (coolCount > 0 && (i + 1) % coolCount === 0) {
                                                    currentWaitTime += coolDelay;
                                                    
                                                    if (Toasts && Toasts.showToast && Toasts.createToast) {
                                                        Toasts.showToast(Toasts.createToast(`MultiForward: Rate Limit Pause for ${Math.round(currentWaitTime / 1000)}s...`, 2));
                                                    }
                                                }

                                                await sleep(currentWaitTime); 
                                            }
                                        }
                                        
                                        if (Toasts && Toasts.showToast && Toasts.createToast) {
                                            Toasts.showToast(Toasts.createToast(`Successfully forwarded ${idsToSend.length} messages!`, 1));
                                        }
                                    })();

                                    return Promise.resolve();
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("[MultiForward] Error in sendMessage interceptor:", e);
                }
                
                return origSendMessage.apply(this, arguments);
            };
        } else {
            console.error("[MultiForward] CRITICAL: Could not find MessageActions or MessageStore!");
        }
    },

    stop() {
        if (selectionHandler) {
            document.removeEventListener("selectionchange", selectionHandler);
        }
        if (MessageActions && origSendMessage) {
            MessageActions.sendMessage = origSendMessage;
        }
        window.__multiForwardSelection = null;
    }
});