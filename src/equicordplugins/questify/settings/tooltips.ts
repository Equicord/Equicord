/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const settingTooltips = {
    questButtonDisplay: "Always shows the Quest Button whenever this feature is enabled."
        + "\n\nUnclaimed only shows it while you have relevant unclaimed Quest rewards."
        + "\n\nNever hides the Quest Button.",
    questButtonIndicator: "Pill shows Discord's unread-style marker beside the Quest Button."
        + "\n\nBadge shows the number of relevant unclaimed Quest rewards."
        + "\n\nBoth shows the pill and badge together."
        + "\n\nNone hides unclaimed indicators.",
    includedRewardTypes: "Only count Quests with these reward types as unclaimed when determining button visibility, badge count, and alert behavior.",
    includedTaskTypes: "Only count Quests with these task types as unclaimed when determining button visibility, badge count, and alert behavior.",
    disableQuestsEverything: "This will disable all plugin enhancements, hide the Quests page and Quest elements across Discord, and prevent Discord from fetching Quest data. This will not affect the shop as Orbs are too intrinsically tied to it as a secondary currency.",
    disabledFeatures: "Sponsored Banner is a paid-for Quest banner at the top of the Quests page."
        + "\n\nRelocation Notices are indicators such as in the Discovery page about Quests moving to DMs."
        + "\n\nFriends List Promo is a card that displays on the \"Active Now\" section of your Friends List while a user you share a server with is playing a game with an active Quest."
        + "\n\nMembers List Promo is an icon that displays on members in a server's Members List while they are playing a game with an active Quest."
        + "\n\nAccount Panel Promo is a paid-for Quest promotion that appears above your user account panel."
        + "\n\nAccount Panel Progress is the active or completed Quest progress shown above your user account panel."
        + "\n\nQuest & Orbs Badges are badges on user profiles for when someone has completed at least one Quest or bought the Orbs badge respectively.",
    completeVideoQuestsQuicker: "Discord allows Video Quests to be completed once 24 seconds less than the duration of the video has passed since you enrolled into the Quest."
        + "\n\nThis means that if a Video Quest is 24 seconds or less, or if you enroll in a Video Quest and return later to complete it, it can be completed immediately."
        + "\n\nThis setting will only apply to auto-completing Video Quests and relies on the auto-complete setting below. Manually completing Video Quests will still require waiting the full duration and is not dependent on enrollment time.",
    preventVideoQuestsPausing: "Discord forces you to be tabbed into the client for Video Quests to play their video."
        + "\n\nThis setting prevents the video from pausing and allows completion to progress as normal."
        + "\n\nThis setting applies only to manually completing Video Quests.",
    makeMobileVideoQuestsDesktopCompatible: "Some mobile-only Video Quests can be enrolled in on desktop, but still must be completed on mobile. This setting will allow those to be completed on desktop."
        + "\n\nSome mobile-only Video Quests are only enrollable on mobile. For this setting to affect those, you must enroll in those Quests on your mobile device before returning to desktop and refreshing your Quests."
        + "\n\nThis setting, when enabled independently, applies only to manually completing Video Quests. Auto-completing mobile Video Quests from desktop relies on the auto-complete setting below, and will implicitly enable this setting as well.",
    autoCompleteQuestsSimultaneously: "By default, attempting to auto-complete multiple Quests will queue them to be completed in order."
        + "\n\nThis setting will alternatively allow all auto-complete Quests to run at the same time."
        + "\n\nThis setting will only apply to auto-completing Quests and relies on the auto-complete setting below.",
    resumeInterruptedQuests: "This setting will automatically resume any interrupted auto-completions caused by reloads or restarts, including requeuing Quests which had yet to start auto-completing but had been queued.",
    autoCompleteQuestTypes: "Watch Video on Mobile Quests will only work on mobile Quests which are enrollable on desktop. If a Quest is locked to enrollment on mobile, you must first enroll in it on your mobile device before returning to desktop and refreshing your Quests."
        + "\n\nAll video related Quests usually send a stack trace with the progress reports. This means Discord would know exactly which functions were called, and can therefore verify that their own functions initiated the progress. Questify erases this stack trace, but the absence of it will be just as telling as its presence."
        + "\n\nPlay on Desktop, Play on PlayStation, Play on Xbox, and Play Activity Quests are only available on official desktop clients due to a limitation imposed by Discord. 3rd party clients such as web extensions, Vesktop, Equibop, and others, do not support auto-completing these Quest types."
        + "\n\nAll game related Quests usually send a game fingerprint with the heartbeat reports. This means Discord can use data from tens of thousands of users to determine whether other users are likely using a real game or are emulating the executable. There is no reasonable method to spoof this value, so Questify leaves it blank, but the absence of it will be just as telling as poorly spoofing the value."
        + "\n\nAchievement in Activity Quests can only be auto-completed by completing them immediately. This method may be patched at any time."
        + "\n\nAuto-completing Quests is done by clicking their respective buttons on the Quests page. Quests will be auto-completed in the order they were queued, unless the simultaneous completion setting is enabled above."
        + "\n\nAuto-completing Quests is the riskiest dangerous setting available. Enable it at your own risk.",
    notifyOnNewExcludedQuests: "Some Quests are excluded from your available Quests list due to region or platform restrictions."
        + "\n\nWhen enabled, Questify will fetch their Quest configs, apply your included Quest and reward type filters, print the resolved excluded Quest data to console, and show a separate notification for matching excluded Quests.",
    questFetchInterval: "Discord only fetches Quests on load and when you visit the Quests page."
        + "\n\nThis interval periodically fetches Quests for you while the client stays open, so Quest Button indicators and new Quest alerts can stay up to date throughout the day."
        + "\n\nThis only runs if enabled and if the Quest Button or Quest Notifications settings are configured in a way which makes fetching periodically meaningful.",
    questTileGradient: "Intense and Default use the selected tile color in the asset gradient."
        + "\n\nSubtle Black keeps a darker neutral gradient for contrast."
        + "\n\nNo Gradient removes the asset gradient, which can make some Quest artwork harder to read.",
    questTilePreload: "Loading all assets when the Quests page opens reduces layout shifting while scrolling."
        + "\n\nLoading during page scroll is closer to Discord's default behavior and may use less work up front.",
    unclaimedSubsort: "Completed but unclaimed Quests stay below incomplete unclaimed Quests, then this subsort is applied within those groups.",
    claimedSubsort: "Claimed Quests can be sorted by claim time or by when the Quest was added.",
    ignoredSubsort: "Ignored Quests still keep their ignored group position, then this subsort controls their order inside that group.",
    expiredSubsort: "Expired Quests can be sorted by expiration time or by when the Quest was added.",
    rememberQuestPageSort: "When disabled, the Quests page opens with the Questify sort option each time.",
    rememberQuestPageFilters: "When disabled, the Quests page opens without task or reward filters each time.",
} as const;
