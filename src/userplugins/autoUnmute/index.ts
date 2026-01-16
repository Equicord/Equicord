import definePlugin from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import {
    UserStore,
    PermissionStore,
    PermissionsBits,
    ChannelStore,
} from "@webpack/common";
import { RestAPI, Constants } from "@webpack/common";
import { SelectedGuildStore } from "@webpack/common";
import { TestcordDevs } from "@utils/constants";

// Retrieval of necessary stores and actions
const VoiceStateStore = findStoreLazy("VoiceStateStore");
const VoiceActions = findByPropsLazy("toggleSelfMute");

interface VoiceState {
    userId: string;
    channelId?: string;
    oldChannelId?: string;
    guildId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
    selfStream: boolean;
    selfVideo: boolean;
    sessionId: string;
    suppress: boolean;
    requestToSpeakTimestamp: string | null;
}

// Function to unmute a user via Discord API
async function unmuteUserViaAPI(
    userId: string,
    guildId: string
): Promise<void> {
    try {
        console.log(
            `[AutoUnmute] Attempting to unmute via API for user ${userId} in server ${guildId}`
        );

        await RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: {
                mute: false,
            },
        });

        console.log(`[AutoUnmute] Unmute via API successful for user ${userId}`);
    } catch (error) {
        console.error(`[AutoUnmute] Error during unmute via API:`, error);
        throw error;
    }
}

// Function to undeafen a user via Discord API
async function undeafenUserViaAPI(
    userId: string,
    guildId: string
): Promise<void> {
    try {
        console.log(
            `[AutoUnmute] Attempting to undeafen via API for user ${userId} in server ${guildId}`
        );

        await RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: {
                deaf: false,
            },
        });

        console.log(`[AutoUnmute] Undeafen via API successful for user ${userId}`);
    } catch (error) {
        console.error(`[AutoUnmute] Error during undeafen via API:`, error);
        throw error;
    }
}

export default definePlugin({
    name: "AutoUnmute",
    description:
        "Automatically unmutes and undeafens when server mute/deafen occurs if you have permissions (no notifications)",
    authors: [
        {
            name: "Bash",
            id: 1327483363518582784n,
        },
        TestcordDevs.x2b
    ],

    // Using the flux system to listen to voice events
    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            // Security check for current user
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser) {
                console.warn("[AutoUnmute] Current user not available");
                return;
            }

            const currentUserId = currentUser.id;

            // Process each voice state change
            for (const state of voiceStates) {
                const { userId, channelId, guildId, mute, selfMute, deaf, selfDeaf } =
                    state;

                // Only interested in events for the current user
                if (userId !== currentUserId) continue;

                // Check if we're in a voice channel
                if (!channelId || !guildId) continue;

                // Check permissions
                const channel = ChannelStore.getChannel(channelId);
                if (!channel) {
                    console.warn("[AutoUnmute] Channel not found");
                    continue;
                }

                // Check if we were muted by the server (not by ourselves)
                if (mute && !selfMute) {
                    console.log(
                        `[AutoUnmute] Server mute detected for user ${currentUserId} in channel ${channelId}`
                    );

                    // Check if we have MUTE_MEMBERS permission
                    const hasMutePermission = PermissionStore.can(
                        PermissionsBits.MUTE_MEMBERS,
                        channel
                    );

                    if (hasMutePermission) {
                        console.log(
                            `[AutoUnmute] MUTE_MEMBERS permission detected, automatic unmute via API in progress...`
                        );

                        // Automatically unmute via Discord API
                        setTimeout(async () => {
                            try {
                                // Use Discord API to unmute via server
                                await unmuteUserViaAPI(currentUserId, guildId);
                                console.log(
                                    `[AutoUnmute] Automatic unmute via API completed successfully`
                                );
                            } catch (error) {
                                console.error(
                                    "[AutoUnmute] Error during automatic unmute via API:",
                                    error
                                );

                                // Fallback: try with toggleSelfMute if API fails
                                try {
                                    console.log(
                                        `[AutoUnmute] Attempting fallback with toggleSelfMute...`
                                    );
                                    VoiceActions.toggleSelfMute();
                                    console.log(
                                        `[AutoUnmute] Automatic unmute via fallback completed successfully`
                                    );
                                } catch (fallbackError) {
                                    console.error(
                                        "[AutoUnmute] Error during fallback:",
                                        fallbackError
                                    );
                                }
                            }
                        }, 100); // Small delay to avoid conflicts
                    } else {
                        console.log(
                            `[AutoUnmute] No MUTE_MEMBERS permission, no automatic unmute`
                        );
                    }
                }

                // Check if we were deafened by the server (not by ourselves)
                if (deaf && !selfDeaf) {
                    console.log(
                        `[AutoUnmute] Server deafen detected for user ${currentUserId} in channel ${channelId}`
                    );

                    // Check if we have DEAFEN_MEMBERS permission
                    const hasDeafenPermission = PermissionStore.can(
                        PermissionsBits.DEAFEN_MEMBERS,
                        channel
                    );

                    if (hasDeafenPermission) {
                        console.log(
                            `[AutoUnmute] DEAFEN_MEMBERS permission detected, automatic undeafen via API in progress...`
                        );

                        // Automatically undeafen via Discord API
                        setTimeout(async () => {
                            try {
                                // Use Discord API to undeafen via server
                                await undeafenUserViaAPI(currentUserId, guildId);
                                console.log(
                                    `[AutoUnmute] Automatic undeafen via API completed successfully`
                                );
                            } catch (error) {
                                console.error(
                                    "[AutoUnmute] Error during automatic undeafen via API:",
                                    error
                                );

                                // Fallback: try with toggleSelfDeaf if API fails
                                try {
                                    console.log(
                                        `[AutoUnmute] Attempting fallback with toggleSelfDeaf...`
                                    );
                                    VoiceActions.toggleSelfDeaf();
                                    console.log(
                                        `[AutoUnmute] Automatic undeafen via fallback completed successfully`
                                    );
                                } catch (fallbackError) {
                                    console.error(
                                        "[AutoUnmute] Error during fallback:",
                                        fallbackError
                                    );
                                }
                            }
                        }, 100); // Small delay to avoid conflicts
                    } else {
                        console.log(
                            `[AutoUnmute] No DEAFEN_MEMBERS permission, no automatic undeafen`
                        );
                    }
                }
            }
        },
    },

    start() {
        console.log("[AutoUnmute] AutoUnmute plugin initialized");

        // Check that stores are available
        if (!VoiceStateStore || !VoiceActions || !UserStore || !PermissionStore) {
            console.error("[AutoUnmute] Error: Discord stores not available");
            return;
        }
    },

    stop() {
        console.log("[AutoUnmute] AutoUnmute plugin stopped");
    },
});




