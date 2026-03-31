import definePlugin from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { getCurrentChannel } from "@utils/discord";
import { sendBotMessage, ApplicationCommandOptionType, ApplicationCommandInputType } from "@api/Commands";

interface ConstcalState {
    isActive: boolean;
    currentCallId?: string;
    startTime: number;
    currentTargetId: string;
    timeoutId?: number;
    voiceStateListener?: () => void;
    initialParticipantCount: number;
    monitorInterval?: ReturnType<typeof setInterval>;
}

// Try multiple module finding strategies
const callModule = findByPropsLazy("call", "startCall");
const voiceModule = findByPropsLazy("selectVoiceChannel");
const alternativeCallModule = findByPropsLazy("selectVoiceChannel", "getVoiceChannelId");

// Better approach - find actual Discord stores
const VoiceStateStore = findByPropsLazy("getVoiceState", "getVoiceStates") ?? findByPropsLazy("getVoiceStateForChannel");
const CallStore = findByPropsLazy("getCalls", "getCall") ?? findByPropsLazy("getCurrentCall");

let state: ConstcalState = {
    isActive: false,
    startTime: 0,
    currentTargetId: "",
    timeoutId: undefined,
    voiceStateListener: undefined,
    initialParticipantCount: 0,
    monitorInterval: undefined
};

const settings = definePluginSettings({
    callDuration: {
        type: OptionType.NUMBER,
        description: "Duration of each call (seconds)",
        default: 30
    },
    totalDuration: {
        type: OptionType.NUMBER,
        description: "Total time to keep calling (seconds, 0 = unlimited)",
        default: 3600
    }
});

function detectCallState() {
    // Multiple methods to detect call state
    const methods = {
        // Method 1: Look for call UI elements
        uiElements: () => {
            const callContainer = document.querySelector('[class*="callContainer"]');
            const voicePanel = document.querySelector('[class*="voicePanel"]');
            const callControls = document.querySelector('[class*="callControls"]');
            const disconnectBtn = document.querySelector('[aria-label*="disconnect" i], [aria-label*="hang up" i]');

            return {
                inCall: !!(callContainer || voicePanel || callControls || disconnectBtn),
                hasDisconnectButton: !!disconnectBtn
            };
        },

        // Method 2: Count participant avatars/indicators
        participants: () => {
            const participantSelectors = [
                '[class*="participant"]',
                '[class*="avatar"][class*="speaking"]',
                '[class*="avatar"][class*="voice"]',
                '[class*="voiceState"]',
                '[data-testid*="participant"]'
            ];

            let maxCount = 0;
            let containers = 0;
            let avatars = 0;
            let speaking = 0;

            participantSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                maxCount = Math.max(maxCount, elements.length);

                if (selector.includes('participant')) containers = elements.length;
                if (selector.includes('avatar')) avatars = elements.length;
                if (selector.includes('speaking')) speaking = elements.length;
            });

            return { count: maxCount, containers, avatars, speaking };
        },

        // Method 3: Check Discord stores if available
        stores: () => {
            try {
                if (VoiceStateStore && CallStore) {
                    const currentChannel = getCurrentChannel();
                    if (currentChannel) {
                        const voiceStates = VoiceStateStore.getVoiceStates?.(currentChannel.id) || {};
                        const call = CallStore.getCall?.(currentChannel.id);

                        return {
                            storeVoiceStates: Object.keys(voiceStates).length,
                            hasActiveCall: !!call,
                            callParticipants: call?.participants?.length || 0
                        };
                    }
                }
            } catch (error) {
                console.log("Store method failed:", error);
            }
            return { storeVoiceStates: 0, hasActiveCall: false, callParticipants: 0 };
        }
    };

    const ui = methods.uiElements();
    const participants = methods.participants();
    const stores = methods.stores();

    // Create DOM debug info
    const domDebug: any[] = [];
    const allElements = document.querySelectorAll('[class*="participant"], [class*="avatar"], [class*="voice"]');
    allElements.forEach((el, idx) => {
        if (idx < 10) { // Limit to first 10 elements
            domDebug.push({
                tag: el.tagName,
                classes: el.className,
                text: el.textContent?.slice(0, 20) || ''
            });
        }
    });

    return {
        inCall: ui.inCall || stores.hasActiveCall,
        participantCount: Math.max(participants.count, stores.callParticipants, stores.storeVoiceStates),
        hasDisconnectButton: ui.hasDisconnectButton,
        storeData: stores,
        debug: { ui, participants, stores },
        domDebug
    };
}

function startCallJoinMonitoring() {
    if (!state.isActive) return;

    let lastState = detectCallState();
    state.initialParticipantCount = Math.max(lastState.participantCount, 1);

    // Monitor call state changes
    const monitorInterval = setInterval(() => {
        if (!state.isActive) {
            clearInterval(monitorInterval);
            return;
        }

        const currentState = detectCallState();

        // Check if user left the call (no longer in call but was before)
        if (lastState.inCall && !currentState.inCall) {
            sendBotMessage(state.currentTargetId, {
                content: "You left the call. Stopping Constcal automatically."
            });
            stopCalling();
            clearInterval(monitorInterval);
            return;
        }

        // Check if someone joined the call (more than just us)
        if (currentState.participantCount > state.initialParticipantCount && currentState.participantCount > 1) {
            // Show detailed debug info to understand what's happening
            sendBotMessage(state.currentTargetId, {
                content: `**Potential participant detected!**\n` +
                        `Count: ${currentState.participantCount} (initial: ${state.initialParticipantCount})\n` +
                        `Store participants: ${currentState.storeData.callParticipants}\n` +
                        `Participant methods: containers=${currentState.debug.participants.containers}, avatars=${currentState.debug.participants.avatars}, speaking=${currentState.debug.participants.speaking}\n\n` +
                        `**DOM Debug (first 5):**\n\`\`\`json\n${JSON.stringify(currentState.domDebug.slice(0, 5), null, 2).slice(0, 1000)}\n\`\`\``
            });

            // For now, don't stop automatically - let's see what the DOM shows first
            console.log("Full DOM debug:", currentState.domDebug);
            console.log("Full debug state:", currentState);
        }

        // Update last known state
        lastState = currentState;
    }, 1500); // Check every 1.5 seconds

    // Store the interval ID so we can clean it up
    state.monitorInterval = monitorInterval;

    console.log("Enhanced call monitoring started. Initial state:", lastState);
}

function stopCalling() {
    state.isActive = false;
    if (state.timeoutId) {
        clearTimeout(state.timeoutId);
        state.timeoutId = undefined;
    }

    // Clean up voice state listener
    if (state.voiceStateListener) {
        state.voiceStateListener();
        state.voiceStateListener = undefined;
    }

    // Clean up monitoring interval
    if (state.monitorInterval) {
        clearInterval(state.monitorInterval);
        state.monitorInterval = undefined;
    }

    // Reset participant count
    state.initialParticipantCount = 0;

    // Updated disconnect button selectors focusing on call termination
    const disconnectSelectors = [
        // Primary Discord call disconnect buttons
        '[aria-label*="disconnect" i]',
        '[aria-label*="hang up" i]',
        '[aria-label*="leave call" i]',
        '[aria-label*="end call" i]',

        // Title-based selectors
        '[title*="disconnect" i]',
        '[title*="hang up" i]',
        '[title*="leave call" i]',
        '[title*="end call" i]',

        // Red/danger themed disconnect buttons
        'button[class*="colorDanger"]',
        'button[class*="danger"]',

        // Call UI specific areas
        '[class*="callContainer"] button[class*="danger"]',
        '[class*="callContainer"] button[class*="red"]',
        '[class*="wrapper"][class*="call"] button[class*="danger"]',
        '[class*="toolbar"] button[class*="danger"]',
        '[class*="controls"] button[class*="danger"]',

        // RTC and call control buttons
        '[class*="rtcConnection"] button[class*="danger"]',
        '[class*="callControls"] button[class*="danger"]',

        // Test IDs for disconnect
        '[data-testid*="disconnect"]',
        '[data-testid*="hangup"]',
        '[data-testid*="end-call"]'
    ];

    let buttonFound = false;
    let lastError: any = null;
    let attemptsLog: string[] = [];

    for (const selector of disconnectSelectors) {
        try {
            const elements = document.querySelectorAll(selector);
            attemptsLog.push(`"${selector}": ${elements.length} elements`);

            if (elements.length > 0) {
                for (let i = 0; i < elements.length; i++) {
                    const element = elements[i] as HTMLElement;

                    const elementText = element.textContent?.toLowerCase().trim() || '';
                    const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
                    const title = element.getAttribute('title')?.toLowerCase() || '';
                    const role = element.getAttribute('role') || '';
                    const className = element.className || '';

                    // Simple disconnect button check
                    const isDisconnectRelated = ariaLabel.includes('disconnect');

                    const isClickable = element.tagName.toLowerCase() === 'button' ||
                                       role === 'button' ||
                                       element.onclick !== null;

                    attemptsLog.push(`Element ${i}: text="${elementText}" | aria-label="${ariaLabel}" | clickable=${isClickable} | disconnectRelated=${isDisconnectRelated}`);

                    if (isDisconnectRelated && isClickable) {
                        try {
                            element.click();

                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window,
                                button: 0
                            });
                            element.dispatchEvent(clickEvent);

                            buttonFound = true;
                            if (state.currentTargetId) {
                                sendBotMessage(state.currentTargetId, {
                                    content: `Call ended using disconnect button - Used selector: \`${selector}\`\nElement: ${ariaLabel || elementText || 'unlabeled'}`
                                });
                            }
                            return;
                        } catch (clickError: any) {
                            lastError = clickError;
                            attemptsLog.push(`Click failed: ${clickError.message}`);
                            continue;
                        }
                    }
                }
            }
        } catch (selectorError: any) {
            attemptsLog.push(`Selector error: ${selectorError.message}`);
            lastError = selectorError;
            continue;
        }
    }

    // If no disconnect button found, log the failure
    if (!buttonFound && state.currentTargetId) {
        sendBotMessage(state.currentTargetId, {
            content: `Could not find disconnect button\n\n` +
                    `Searched ${disconnectSelectors.length} selectors for disconnect buttons.\n\n` +
                    `**Recent attempts:**\n\`\`\`\n${attemptsLog.slice(-5).join('\n')}\n\`\`\``
        });
    }
}

async function tryCall(channelId: string) {
    // Focused call button selectors
    const callButtonSelectors = [
        // Primary Discord call button selectors
        '[aria-label*="call" i]:not([aria-label*="end" i]):not([aria-label*="hang" i])',
        '[aria-label*="start call" i]',
        '[aria-label*="voice call" i]',

        // Toolbar and header call buttons
        '[class*="toolbar"] [aria-label*="call" i]',
        '[class*="toolbar"] [aria-label*="start" i]',
        '[class*="header"] [aria-label*="call" i]',
        '[class*="header"] [aria-label*="start" i]',

        // Role-based call buttons
        'header [role="button"][aria-label*="call" i]',
        'header [role="button"][aria-label*="start" i]',

        // SVG icon-based call buttons
        'button:has(svg[class*="call"])',
        'button:has(svg[class*="phone"])',
        '[role="button"]:has(svg[class*="call"])',
        '[role="button"]:has(svg[class*="phone"])',

        // Generic call-related buttons
        'button[aria-label*="Start"]',
        'button[aria-label*="Call"]',
        '[role="button"][aria-label*="Start"]',
        '[role="button"][aria-label*="Call"]',

        // Title-based selectors
        '[title*="call" i]:not([title*="end" i]):not([title*="hang" i])',
        '[title*="start call" i]',

        // Test ID selectors
        '[data-testid*="call"]:not([data-testid*="end"]):not([data-testid*="hang"])',
        '[data-testid*="start-call"]',

        // Fallback broader searches
        '[class*="toolbar"] button',
        '[class*="toolbar"] [role="button"]',
        'header button',
        'header [role="button"]'
    ];

    let buttonFound = false;
    let lastError: any = null;
    let attemptsLog: string[] = [];
    let allFoundButtons: any[] = [];

    for (const selector of callButtonSelectors) {
        try {
            const elements = document.querySelectorAll(selector);
            attemptsLog.push(`"${selector}": ${elements.length} elements`);

            if (elements.length > 0) {
                for (let i = 0; i < elements.length; i++) {
                    const element = elements[i] as HTMLElement;

                    const tagName = element.tagName.toLowerCase();
                    const elementText = element.textContent?.toLowerCase().trim() || '';
                    const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
                    const title = element.getAttribute('title')?.toLowerCase() || '';
                    const role = element.getAttribute('role') || '';
                    const className = element.className || '';

                    // Check if this looks like a call start button (not end/disconnect)
                    const isCallStartRelated = (elementText.includes('call') ||
                                              ariaLabel.includes('call') ||
                                              title.includes('call') ||
                                              ariaLabel.includes('start') ||
                                              elementText.includes('start') ||
                                              ariaLabel.includes('voice')) &&
                                              // Exclude disconnect/end buttons
                                              !ariaLabel.includes('disconnect') &&
                                              !ariaLabel.includes('hang up') &&
                                              !ariaLabel.includes('end call') &&
                                              !ariaLabel.includes('leave call') &&
                                              !elementText.includes('disconnect') &&
                                              !elementText.includes('hang up') &&
                                              !elementText.includes('end call') &&
                                              !elementText.includes('leave call');

                    const isClickable = tagName === 'button' ||
                                       role === 'button' ||
                                       element.onclick !== null ||
                                       element.hasAttribute('onclick');

                    const elementInfo = {
                        selector,
                        index: i,
                        tag: tagName,
                        text: elementText.slice(0, 30),
                        ariaLabel: ariaLabel.slice(0, 50),
                        title: title.slice(0, 30),
                        role,
                        isCallStartRelated,
                        isClickable,
                        className: className.slice(0, 50)
                    };

                    allFoundButtons.push(elementInfo);
                    attemptsLog.push(`Element ${i}: ${JSON.stringify(elementInfo)}`);

                    if (isCallStartRelated && isClickable) {
                        try {
                            element.click();

                            const mouseEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window,
                                button: 0
                            });
                            element.dispatchEvent(mouseEvent);

                            if (element.focus) {
                                element.focus();
                                const keyEvent = new KeyboardEvent('keydown', {
                                    bubbles: true,
                                    cancelable: true,
                                    key: 'Enter',
                                    code: 'Enter'
                                });
                                element.dispatchEvent(keyEvent);
                            }

                            buttonFound = true;
                            sendBotMessage(channelId, {
                                content: `Call button clicked!\n` +
                                        `Selector: \`${selector}\`\n` +
                                        `Element: ${tagName} with label "${ariaLabel || elementText || 'unlabeled'}"`
                            });
                            return true;
                        } catch (clickError: any) {
                            lastError = clickError;
                            attemptsLog.push(`Click failed: ${clickError.message}`);
                            continue;
                        }
                    }
                }
            }
        } catch (selectorError: any) {
            attemptsLog.push(`Selector error: ${selectorError.message}`);
            lastError = selectorError;
            continue;
        }
    }

    const debugInfo = {
        totalAttempts: callButtonSelectors.length,
        elementsFound: allFoundButtons.length,
        callRelatedElements: allFoundButtons.filter(b => b.isCallStartRelated).length,
        clickableElements: allFoundButtons.filter(b => b.isClickable).length,
        lastError: lastError?.message || 'None',
        sampleButtons: allFoundButtons.slice(0, 5),
        recentAttempts: attemptsLog.slice(-8)
    };

    sendBotMessage(channelId, {
        content: `No call button found this time\n\n` +
                `Searched ${callButtonSelectors.length} selectors and found ${allFoundButtons.length} total elements.\n` +
                `${debugInfo.callRelatedElements} seemed call-related, ${debugInfo.clickableElements} were clickable.\n\n` +
                `**Debug info:**\n\`\`\`json\n${JSON.stringify(debugInfo, null, 2).slice(0, 1200)}\n\`\`\``
    });

    throw new Error('No call button found this time - UI may have changed');
}

async function startCallingLoop(channelId: string) {
    if (!state.isActive) return;

    const elapsed = (Date.now() - state.startTime) / 1000;

    if (settings.store?.totalDuration > 0 && elapsed >= settings.store.totalDuration) {
        stopCalling();
        sendBotMessage(channelId, {
            content: "Total duration reached. Stopping Constcal"
        });
        return;
    }

    try {
        await tryCall(channelId);

        // After making the call, wait for the call duration, then disconnect
        setTimeout(() => {
            if (state.isActive) {
                // Use the existing stopCalling disconnect logic but don't stop the loop
                const disconnectElement = document.querySelector('[aria-label*="disconnect" i]');
                if (disconnectElement) {
                    (disconnectElement as HTMLElement).click();
                    sendBotMessage(channelId, {
                        content: "Call ended after duration timeout"
                    });
                }

                // Continue the calling loop
                state.timeoutId = window.setTimeout(() => {
                    startCallingLoop(channelId);
                }, 1000); // Small delay before next call
            }
        }, settings.store?.callDuration * 1000);

    } catch (error: any) {
        sendBotMessage(channelId, {
            content: `An Error occurred while executing command "constcal":\n\`\`\`ts\n${error?.stack ?? error}\n\`\`\``
        });
        stopCalling();
        return;
    }
}

export default definePlugin({
    name: "Constcal",
    description: "Automatically calls someone until they respond",
    authors: [Devs.rz30],
    settings,
    commands: [{
        name: "constcal",
        description: "Start or stop automatic calling",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [{
            name: "action",
            description: "Action to perform (start/stop)",
            type: ApplicationCommandOptionType.STRING,
            required: true,
            choices: [{
                name: "start",
                value: "start",
                label: "start"
            }, {
                name: "stop",
                value: "stop",
                label: "stop"
            }]
        }],
        execute(args, ctx) {
            const action = args[0]?.value || args[0];
            const channel = getCurrentChannel();

            if (!channel) {
                return sendBotMessage(ctx.channel.id, {
                    content: "No active channel found"
                });
            }

            switch (action) {
                case "start":
                    if (channel.type !== 1) {
                        return sendBotMessage(ctx.channel.id, {
                            content: "This command only works in DM channels"
                        });
                    }

                    if (state.isActive) {
                        return sendBotMessage(ctx.channel.id, {
                            content: "Constcal is already running ! Use `/constcal stop` to stop it"
                        });
                    }

                    state.isActive = true;
                    state.startTime = Date.now();
                    state.currentTargetId = channel.id;
                    state.initialParticipantCount = 1; // Start with just us in the call

                    sendBotMessage(ctx.channel.id, {
                        content: `Starting Constcal. Will call for ${settings.store?.totalDuration === 0 ? "unlimited time" : settings.store.totalDuration + "s"} with ${settings.store?.callDuration}s intervals`
                    });

                    setTimeout(() => startCallingLoop(channel.id), 1000);

                    // Start monitoring for someone joining the call
                    startCallJoinMonitoring();
                    break;

                case "stop":
                    if (!state.isActive) {
                        return sendBotMessage(ctx.channel.id, {
                            content: "Constcal is not currently running"
                        });
                    }

                    stopCalling();

                    // Force disconnect any active call when stopping
                    try {
                        const disconnectElement = document.querySelector('[aria-label*="disconnect" i]');
                        if (disconnectElement) {
                            (disconnectElement as HTMLElement).click();
                            sendBotMessage(ctx.channel.id, {
                                content: "Constcal stopped and call disconnected successfully"
                            });
                        } else {
                            sendBotMessage(ctx.channel.id, {
                                content: "Constcal stopped successfully (no active call found to disconnect)"
                            });
                        }
                    } catch (error) {
                        sendBotMessage(ctx.channel.id, {
                            content: "Constcal stopped successfully (could not auto-disconnect call)"
                        });
                    }
                    return;

                default:
                    return sendBotMessage(ctx.channel.id, {
                        content: "Invalid action. Use `start` or `stop`"
                    });
            }
        }
    }],
    start() {},
    stop() {
        stopCalling();
    }
});
