/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

//
import { addProfileBadge, ProfileBadge, BadgePosition } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { Forms, Toasts, UserStore } from "@webpack/common";

function isCurrentUser(userId: string) {
    const u = UserStore.getCurrentUser().id;
    return u === userId;
}

export default definePlugin({
    name: "ClientSideBadges",
    description: "Adds client-side badges to your profile. Other users can't see them!",
    authors: [Devs.rz30,],
    settingsAboutComponent: () => <>
        <Forms.FormTitle style={{ color: "red", fontSize: "2rem", fontWeight: "bold" }}>Only you can view the badges. No, this can't and won't be changed.</Forms.FormTitle>
        <Forms.FormText>You may need to reload Discord after editing your settings for them to apply.</Forms.FormText>
    </>,
    settings: definePluginSettings({
        discordStaff: {
            type: OptionType.BOOLEAN,
            description: "Show Discord Staff badge",
            restartNeeded: true,
        },
        partneredServerOwner: {
            type: OptionType.BOOLEAN,
            description: "Show Partnered Server Owner badge",
            restartNeeded: true,
        },
        earlySupporter: {
            type: OptionType.BOOLEAN,
            description: "Show Early Supporter badge",
            restartNeeded: true,
        },
        activeDeveloper: {
            type: OptionType.BOOLEAN,
            description: "Show Active Developer badge",
            restartNeeded: true,
        },
        earlyVerifiedBotDeveloper: {
            type: OptionType.BOOLEAN,
            description: "Show Early Verified Bot Developer badge",
            restartNeeded: true,
        },
        moderatorProgramsAlumni: {
            type: OptionType.BOOLEAN,
            description: "Show Moderator Programs Alumni badge",
            restartNeeded: true,
        },
        bugHunter: {
            type: OptionType.BOOLEAN,
            description: "Show Bug Hunter badge",
            restartNeeded: true,
        },
        goldenBugHunter: {
            type: OptionType.BOOLEAN,
            description: "Show Golden Bug Hunter badge",
            restartNeeded: true,
        },

        // shout out krystalskullofficial
        // Nino missed some badges
        hypesquadEvents: {
            type: OptionType.BOOLEAN,
            description: "Show HypeSquad Events badge",
            restartNeeded: true,
        },
        houseOfBravery: {
            type: OptionType.BOOLEAN,
            description: "Show House of Bravery badge",
            restartNeeded: true,
        },
        houseOfBrilliance: {
            type: OptionType.BOOLEAN,
            description: "Show House of Brilliance badge",
            restartNeeded: true,
        },
        houseOfBalance: {
            type: OptionType.BOOLEAN,
            description: "Show House of Balance badge",
            restartNeeded: true,
        },
        discordQuests: {
            type: OptionType.BOOLEAN,
            description: "Show Discord Quests badge",
            restartNeeded: true,
        },
        nitro: {
            type: OptionType.BOOLEAN,
            description: "Show Nitro badge",
            restartNeeded: true,
        },
        serverBooster: {
            type: OptionType.BOOLEAN,
            description: "Show Server Booster badge",
            restartNeeded: true,
        },
        legacyUsername: {
            type: OptionType.BOOLEAN,
            description: "Show Legacy Username badge",
            restartNeeded: true,
        },

        // These are badges meant for bots so idk why you would want but might as well add them
        supportsCommands: {
            type: OptionType.BOOLEAN,
            description: "Show Supports Commands badge",
            restartNeeded: true,
        },
        premiumApp: {
            type: OptionType.BOOLEAN,
            description: "Show Premium App badge",
            restartNeeded: true,
        },
        usesAutomod: {
            type: OptionType.BOOLEAN,
            description: "Show Uses Automod badge",
            restartNeeded: true,
        },

        // These is a badge discord made for april fools 2024, again idk why you would want it but might as well add it
        aClownForATime: {
            type: OptionType.BOOLEAN,
            description: "Show A Clown For A Time badge",
            restartNeeded: true,
        },
    }),
    async start() {
        const NativeBadges: ProfileBadge[] = [
            {
                description: "Discord Staff",
                iconSrc: "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.discordStaff),
                link: "https://discord.com/company"
            },
            {
                description: "Partnered Server Owner",
                iconSrc: "https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.partneredServerOwner),
                link: "https://discord.com/partners"
            },
            {
                description: "Early Supporter",
                iconSrc: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.earlySupporter),
                link: "https://discord.com/settings/premium"
            },
            {
                description: "Active Developer",
                iconSrc: "https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.activeDeveloper),
                link: "https://support-dev.discord.com/hc/en-us/articles/10113997751447"
            },
            {
                description: "Early Verified Bot Developer",
                iconSrc: "https://cdn.discordapp.com/badge-icons/6df5892e0f35b051f8b61eace34f4967.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.earlyVerifiedBotDeveloper),
                link: "https://discord.com/settings/premium"
            },
            {
                description: "Moderator Programs Alumni",
                iconSrc: "https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.moderatorProgramsAlumni),
                link: "https://discord.com/settings/premium"
            },
            {
                description: "Discord Bug Hunter",
                iconSrc: "https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.bugHunter),
                link: "https://discord.com/settings/premium"
            },
            {
                description: "Discord Bug Hunter",
                iconSrc: "https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.goldenBugHunter),
                link: "https://discord.com/settings/premium"
            },

            // shout out krystalskullofficial
            // Nino missed some badges
            {
                description: "HypeSquad Events",
                iconSrc: "https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.hypesquadEvents),
                link: "https://support.discord.com/hc/en-us/articles/360035962891-Profile-Badges-101#h_01GM67K5EJ16ZHYZQ5MPRW3JT3"
            },
            {
                description: "HypeSquad Bravery",
                iconSrc: "https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.houseOfBravery),
                link: "https://discord.com/settings/hypesquad-online"
            },
            {
                description: "HypeSquad Briliance",
                iconSrc: "https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.houseOfBrilliance),
                link: "https://discord.com/settings/hypesquad-online"
            },
            {
                description: "HypeSquad Balance",
                iconSrc: "https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.houseOfBalance),
                link: "https://discord.com/settings/hypesquad-online"
            },
            {
                description: "Discord Quests",
                iconSrc: "https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.discordQuests),
                link: "https://discord.com/discovery/quests"
            },
            {
                description: "Discord Nitro",
                iconSrc: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.nitro),
                link: "https://discord.com/settings/premium"
            },
            {
                description: "Server Booster",
                iconSrc: "https://cdn.discordapp.com/badge-icons/ec92202290b48d0879b7413d2dde3bab.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.serverBooster),
                link: "https://discord.com/settings/premium"
            },
            {
                description: "Supports Commands",
                iconSrc: "https://cdn.discordapp.com/badge-icons/6f9e37f9029ff57aef81db857890005e.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.supportsCommands),
                link: "https://discord.com/blog/welcome-to-the-new-era-of-discord-apps?ref=badge"
            },

            // these badges dont have a link because they literally dont link anywhere
            {
                description: "Premium App",
                iconSrc: "https://cdn.discordapp.com/badge-icons/d2010c413a8da2208b7e4f35bd8cd4ac.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.premiumApp),
                link: ""
            },
            {
                description: "Uses Automod",
                iconSrc: "https://cdn.discordapp.com/badge-icons/f2459b691ac7453ed6039bbcfaccbfcd.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.usesAutomod),
                link: ""
            },
            {
                description: "Legacy Username",
                iconSrc: "https://cdn.discordapp.com/badge-icons/6de6d34650760ba5551a79732e98ed60.png",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.legacyUsername),
                link: ""
            },

            // Im linking to a dicord video about lootboxs incase someone doesnt know the context behind this badge
            {
                description: "A clown, for a limited time",
                iconSrc: "https://discord.com/assets/971cfe4aa5c0582000ea.svg",
                position: BadgePosition.END,
                shouldShow: ({ userId }) => !!(isCurrentUser(userId) && this.settings.store.aClownForATime),
                link: "https://youtu.be/cc2-4ci4G84"
            },
        ];
        NativeBadges.forEach(b => addProfileBadge(b));
    },
    async stop() {
        Toasts.show({
            id: Toasts.genId(),
            message: "To clear out your client-side badges, reload Discord.",
            type: Toasts.Type.MESSAGE,
            options: {
                position: Toasts.Position.BOTTOM, // NOBODY LIKES TOASTS AT THE TOP
            },
        });
    }
});
