/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const blurOptions = {
    blurNames: { label: "People's names", description: "Usernames, display names, nicknames, and recipients." },
    blurAvatars: { label: "People's avatars", description: "User pictures and avatar stacks." },
    blurMessages: { label: "Message text", description: "Messages, replies, link preview text, biographies, and activity details." },
    blurPhotos: { label: "Photos and stickers", description: "Chat images, GIF images, stickers, and opened image attachments." },
    blurVideos: { label: "Videos", description: "Chat videos, animated video previews, and opened video attachments." },
    blurFiles: { label: "Files", description: "File names and download cards." },
    blurReactions: { label: "Reactions", description: "Reaction emoji and counts below messages." },
    blurServerNames: { label: "Server names", description: "Server and server folder names." },
    blurServerIcons: { label: "Server icons", description: "Server icons, monograms, and folder previews." },
    blurChannels: { label: "Channel names and topics", description: "Channel titles, topics, thread names, and voice player origins." },
    blurFriends: { label: "Friends list", description: "Apply the selected blur types in the Friends list. Turn off to keep this area clear." },
    blurDMs: { label: "DM list", description: "Apply the selected blur types in the direct message sidebar. Turn off to keep this area clear." },
    blurDMPreviews: { label: "DM message previews", description: "Blur the sender name and last-message text together in MessagePeek previews." },
    blurMembers: { label: "Member list", description: "Apply the selected blur types in server member lists. Turn off to keep this area clear." },
    blurProfiles: { label: "Profiles", description: "Apply the selected blur types in user profiles and profile popouts." },
    blurActivity: { label: "Active Now", description: "Apply the selected blur types in the Home activity panel." },
    blurVoice: { label: "Voice participants", description: "Apply the selected blur types to voice participant names and avatars." },
    blurEmbeds: { label: "Link previews", description: "Apply the selected text and media blur types inside link previews." },
    blurSearch: { label: "Search and suggestions", description: "Apply the selected blur types in search results and autocomplete suggestions." },
    blurNotifications: { label: "Notifications", description: "Apply the selected blur types in notification previews." },
    blurComposer: { label: "Unsent messages", description: "Blur the message editor and draft text." },
    blurTooltips: { label: "Tooltips", description: "Blur tooltips and suppress native hover titles while masking." },
    hideWindowTitle: { label: "Window title", description: "Blur the visible top-bar title and replace the system window title while masking." }
};

export type BlurOptions = Partial<Record<keyof typeof blurOptions, boolean>> & { blurOwnAccount?: boolean; };
