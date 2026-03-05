import definePlugin from "@utils/types";

export default definePlugin({
    name: "ShowAllBadges",
    description: "Displays all obtainable badges.",
    authors: ["EquicordDevs.bratic"],
    start() {
        console.log("I love bread");
        const BADGE_IMG_SELECTOR = 'img[src*="/badge-icons/"]';
        function tryFix(img: HTMLElement) {
            try {
                const src = img.getAttribute("src") || "";
                if (src.includes("/badge-icons/https://") || src.includes("/badge-icons/http://") || src.includes("/badge-icons/data:")) { //AI slop fixed this part for me 👍
                    const m = src.match(/\/badge-icons\/(.+?)(?:\.(?:png|webp|jpg|jpeg|gif))(?:\?|$)/i) || src.match(/\/badge-icons\/(.+)$/i);
                    if (!m) return;
                    let raw = m[1];
                    try { raw = decodeURIComponent(raw); } catch {}
					
                    raw = raw.replace(/%2F/gi, "/");
                    if (/^(https?:|data:)/.test(raw)) {
                        img.setAttribute("referrerPolicy", "no-referrer");
                        img.setAttribute("loading", "eager");
                        img.setAttribute("decoding", "async");
                        img.setAttribute("src", raw);
                    }
                }
            } catch {}
        }

        document.querySelectorAll(BADGE_IMG_SELECTOR).forEach(tryFix);
        const mo = new MutationObserver(muts => {
            for (const mut of muts) {
                mut.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    if ((node as HTMLElement).matches?.(BADGE_IMG_SELECTOR)) tryFix(node as HTMLElement);
                    (node as HTMLElement).querySelectorAll?.(BADGE_IMG_SELECTOR).forEach(tryFix);
                });
            }
        });
		
        mo.observe(document.documentElement, { childList: true, subtree: true });
        const store = (window as any).Vencord?.Webpack?.findStore?.("UserProfileStore");
        if (!store) return console.warn("ProfileStore is nots found");
        const orig = store.getUserProfile;
        const currentUser = (window as any).Vencord?.Webpack?.Common?.UserStore?.getCurrentUser();

        store.getUserProfile = function (userId: string) {
            const profile = orig.apply(this, arguments);
            if (!profile || userId !== currentUser?.id) return profile;
            profile.badges = Array.isArray(profile.badges) ? profile.badges : [];
			// got most of this off of a discord server: https://discord.gg/epice thx for giving everything tho its not all
			const badges = [
			// Staff shit and me :3
			{ id: "bratic", description: "Thx for Supporting Bratics Plugin and Using it!", icon: "https://avatars.githubusercontent.com/u/195697851?v=4" },
			{ id: "staff", description: "Discord Staff", icon: "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png" },
			{ id: "partner", description: "Partnered Server Owner", icon: "https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png" },
			{ id: "mod_alumni", description: "Moderator Programs Alumni", icon: "https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png" },

			// this stuff costs MONEYY YEA MONEYY!!
			{ id: "nitro", description: "Subscriber since Jan 1, 2067", icon: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png" },
			{ id: "nitro_bronze", description: "Nitro Bronze", icon: "https://cdn.discordapp.com/badge-icons/4f33c4a9c64ce221936bd256c356f91f.png" },
			{ id: "nitro_silver", description: "Nitro Silver", icon: "https://cdn.discordapp.com/badge-icons/4514fab914bdbfb4ad2fa23df76121a6.png" },
			{ id: "nitro_gold", description: "Nitro Gold", icon: "https://cdn.discordapp.com/badge-icons/2895086c18d5531d499862e41d1155a6.png" },
			{ id: "nitro_diamond", description: "Nitro Diamond", icon: "https://cdn.discordapp.com/badge-icons/0d61871f72bb9a33a7ae568c1fb4f20a.png" },
			{ id: "nitro_emerald", description: "Nitro Emerald", icon: "https://cdn.discordapp.com/badge-icons/11e2d339068b55d3a506cff34d3780f3.png" },
			{ id: "nitro_ruby", description: "Nitro Ruby", icon: "https://cdn.discordapp.com/badge-icons/cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4.png" },
			{ id: "nitro_opal", description: "Nitro Opal", icon: "https://cdn.discordapp.com/badge-icons/5b154df19c53dce2af92c9b61e6be5e2.png" },
			{ id: "nitro_fire", description: "Nitro Fire", icon: "https://cdn.discordapp.com/badge-icons/cff7119d4417261c3f52fde8a94ba8e5.png" },
			{ id: "boost_1m", description: "Boost 1 Month", icon: "https://cdn.discordapp.com/badge-icons/51040c70d4f20a921ad6674ff86fc95c.png" },
			{ id: "boost_2m", description: "Boost 2 Months", icon: "https://cdn.discordapp.com/badge-icons/0e4080d1d333bc7ad29ef6528b6f2fb7.png" },
			{ id: "boost_3m", description: "Boost 3 Months", icon: "https://cdn.discordapp.com/badge-icons/72bed924410c304dbe3d00a6e593ff59.png" },
			{ id: "boost_6m", description: "Boost 6 Months", icon: "https://cdn.discordapp.com/badge-icons/df199d2050d3ed4ebf84d64ae83989f8.png" },
			{ id: "boost_12m", description: "Boost 12 Months", icon: "https://cdn.discordapp.com/badge-icons/991c9f39ee33d7537d9f408c3e53141e.png" },
			{ id: "new_boost_1m", description: "Boost 1 Month", icon: "https://i.ibb.co/1tFQ1c1d/0su0PqO.gif" },
			{ id: "new_boost_12m", description: "Boost 12 Months", icon: "https://i.ibb.co/ccxKmzd3/FCHg73e.gif" },

			// Collector yea very fun
			{ id: "early_verified_bot_dev", description: "Early Verified Bot Developer", icon: "https://cdn.discordapp.com/badge-icons/6df5892e0f35b051f8b61eace34f4967.png" },
			{ id: "early_supporter", description: "Early Supporter", icon: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png" },
			{ id: "clown", description: "A clown, for a limited time", icon: "https://i.ibb.co/9M1pDvJ/nnnzQos.png" },
			{ id: "supports_commands", description: "Supports Commands", icon: "https://cdn.discordapp.com/badge-icons/6f9e37f9029ff57aef81db857890005e.png" },
			{ id: "premium_app", description: "Premium App", icon: "https://i.ibb.co/0pfp0TD3/KYXZbLw.png" },
			{ id: "automod", description: "Uses AutoMod", icon: "https://cdn.discordapp.com/badge-icons/f2459b691ac7453ed6039bbcfaccbfcd.png" }
			];

            badges.forEach((b, index) => {
                if (!profile.badges.some(x => x.id === b.id)) {
                    profile.badges.splice(index, 0, {
                        id: b.id,
                        description: b.description,
                        icon: b.icon,
                        link: b.link || "#"
                    });
                }
            });
            return profile;
        };
    },
});