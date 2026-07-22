# Embetter

An [Equicord](https://github.com/Equicord/Equicord) plugin that rewrites social media links in your outgoing messages to embed fixing services (`x.com` → `fixupx.com` and friends), so they embed properly in Discord.

Inspired by [fixLinkEmbeds](https://github.com/kikkudayo/fixLinkEmbeds), with the platform list researched from [FixTweetBot](https://github.com/Kyrela/FixTweetBot).

## Features

- **22 supported platforms**, each with its own on/off toggle in the plugin settings.
- **Selectable fixer service** per platform where multiple good fixers exist (Twitter, Bluesky, TikTok, Instagram, Reddit, Facebook, Pixiv, Fur Affinity).
- **Works on both message send and message edit.**
- **Respects embed suppression**: links wrapped in `<...>` are left alone, as are links inside code blocks and inline code.
- **Bypass keyword**: include `fxignore` (configurable) anywhere in a message to send it untouched. The keyword itself is stripped from the message.
- **Precise matching**: URLs are parsed with the `URL` API and only rewritten when the hostname matches exactly (or with a `www.` prefix). Subdomains like `music.youtube.com` are never touched unless intentionally mapped (e.g. `vm.tiktok.com`, `old.reddit.com`, Tumblr blog subdomains). Paths, query parameters and fragments are preserved.
- **Safe**: a malformed URL can never block your message from sending.
- No external network calls, no dependencies beyond Equicord's own APIs.

## Supported platforms

| Platform | Rewrites | Default fixer | Alternatives |
| --- | --- | --- | --- |
| Twitter / X | `twitter.com`, `x.com` | `fxtwitter.com` / `fixupx.com` | `vxtwitter.com` / `fixvx.com` |
| Bluesky | `bsky.app` | `fxbsky.app` | `bskx.app`, `bskye.app`, `vxbsky.app` |
| TikTok | `tiktok.com`, `vm.tiktok.com`, `vt.tiktok.com` | `tnktok.com` | `vxtiktok.com`, `tiktxk.com` |
| Instagram | `instagram.com` | `kkinstagram.com` | `vxinstagram.com`, `eeinstagram.com` |
| Reddit | `reddit.com`, `old.reddit.com` | `rxddit.com` | `rxyddit.com`, `vxreddit.com` |
| Threads | `threads.net`, `threads.com` | `fixthreads.seria.moe` | |
| Snapchat | `snapchat.com` | `snapchatez.com` | |
| Facebook | `facebook.com` | `facebed.com` | `fxfb.seria.moe` |
| Pixiv | `pixiv.net` | `phixiv.net` | `ppxiv.net` |
| Twitch | `twitch.tv`, `twitch.com` | `fxtwitch.seria.moe` | |
| Spotify | `open.spotify.com`, `spotify.com` | `fxspotify.com` | |
| DeviantArt | `deviantart.com` | `fixdeviantart.com` | |
| Newgrounds | `newgrounds.com` | `fixnewgrounds.com` | |
| Mastodon | 10 popular instances (`mastodon.social`, `mstdn.jp`, `mas.to`, ...) | `fxmas.to/<instance>/...` | |
| Tumblr | `tumblr.com` and blog subdomains | `tpmblr.com` | |
| Bilibili | `bilibili.com`, `b23.tv` | `vxbilibili.com`, `vxb23.tv` | |
| Pinterest | `pinterest.com` | `pinterestez.com` | |
| iFunny | `ifunny.co` | `ifunnyez.co` | |
| Imgur | `imgur.com` | `imgurez.com` | |
| Weibo | `weibo.com`, `weibo.cn` | `weiboez.com` | |
| Fur Affinity | `furaffinity.net` | `fxfuraffinity.net` | `xfuraffinity.net` |
| YouTube | `youtube.com`, `youtu.be` | `koutube.com` | |

Everything is enabled by default except YouTube, since native YouTube embeds already work and Koutube is best treated as opt-in.

All fixer domains were verified reachable as of July 2026. Notably, `vxthreads.net` and `ddinstagram.com` are dead and were intentionally not included.

## Installation

Userplugins require building Equicord from source. Full guide: [docs.equicord.org/plugins](https://docs.equicord.org/plugins).

1. Set up the Equicord dev environment ([docs](https://docs.equicord.org/building-from-source)):

    ```
    git clone https://github.com/Equicord/Equicord
    cd Equicord
    pnpm install --no-frozen-lockfile
    ```

2. Create the userplugins folder if it doesn't exist and drop this plugin in:

    ```
    mkdir -p src/userplugins
    git clone https://github.com/lostf1sh/embetter src/userplugins/embetter
    ```

3. Build and inject:

    ```
    pnpm build
    pnpm inject
    ```

4. Restart Discord and enable **Embetter** in the plugins tab.

## Credits

All the heavy lifting is done by the embed fixing services this plugin points at:

| Service | Used for |
| --- | --- |
| [FxEmbed](https://github.com/FxEmbed/FxEmbed) | Twitter / X, Bluesky |
| [BetterTwitFix](https://github.com/dylanpdx/BetterTwitFix) | Twitter / X (alternative) |
| [VixBluesky](https://github.com/Lexedia/VixBluesky), [bskye](https://github.com/FerroEduardo/bskye), [vxBsky](https://github.com/dylanpdx/vxBsky) | Bluesky (alternatives) |
| [fxTikTok](https://github.com/okdargy/fxTikTok) | TikTok |
| [tiktxk](https://github.com/Britmoji/tiktxk) | TikTok (alternative) |
| [KKInstagram](https://kkscript.com) | Instagram |
| [vxInstagram](https://github.com/Lainmode/InstagramEmbed-vxinstagram) | Instagram (alternative) |
| [fxreddit](https://github.com/MinnDevelopment/fxreddit) | Reddit |
| [sexy-reddit](https://github.com/NurMarvin/sexy-reddit), [vxReddit](https://github.com/dylanpdx/vxReddit) | Reddit (alternatives) |
| [FixThreads](https://github.com/tonghongte/fixthreads) (instance by [seriaati](https://github.com/seriaati/fixthreads)) | Threads |
| [EmbedEZ](https://embedez.com) | Snapchat, Pinterest, iFunny, Imgur, Weibo |
| [facebed](https://github.com/4pii4/facebed) | Facebook |
| [fxfacebook](https://github.com/seriaati/fxfacebook) | Facebook (alternative) |
| [phixiv](https://github.com/thelaao/phixiv) | Pixiv |
| [fxtwitch](https://github.com/seriaati/fxtwitch) | Twitch |
| [fxspotify](https://github.com/dotconnexion/fxspotify) | Spotify |
| [fixDeviantArt](https://github.com/Tschrock/fixdeviantart) | DeviantArt |
| [FixNewgrounds](https://github.com/SauceyRed/fix-newgrounds) | Newgrounds |
| [fxmastodon](https://github.com/Someguy123/fxmastodon) | Mastodon |
| [fxtumblr](https://github.com/knuxify/fxtumblr) | Tumblr |
| [BiliFix](https://vxbilibili.com/) | Bilibili |
| [fxraffinity](https://fxraffinity.net/) | Fur Affinity |
| [xfuraffinity](https://github.com/FirraWoof/xfuraffinity) | Fur Affinity (alternative) |
| [Koutube](https://github.com/iGerman00/koutube) | YouTube |

## Author

[lostf1sh](https://github.com/lostf1sh)

## License

GPL-3.0-or-later, consistent with Equicord.
