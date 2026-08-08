<div align="center">

<img src="https://vencord.dev/assets/logo.png" alt="Vencord logo" width="90" />

# Custom Badges

[![Equicord Plugin](https://img.shields.io/badge/Equicord-Plugin-FFB6D9?style=for-the-badge&logo=discord&logoColor=6B2C5F&labelColor=FFD6EC)](https://github.com/Equicord/Equicord)
[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-A9C9FF?style=for-the-badge&labelColor=D6E4FF&logoColor=2B3A67)](https://www.gnu.org/licenses/gpl-3.0.html)
[![Cloudflare Workers](https://img.shields.io/badge/Backend-Cloudflare%20Workers-FFCBA4?style=for-the-badge&logo=cloudflare&logoColor=8A4B00&labelColor=FFE3C7)](https://workers.cloudflare.com/)
[![Discord Server](https://img.shields.io/badge/Discord-Join%20Server-C9A7FF?style=for-the-badge&logo=discord&logoColor=4B2E83&labelColor=E5D4FF)](https://discord.gg/PUYaka9Hy8)

![TypeScript](https://img.shields.io/badge/TypeScript-A7C7FF?style=flat&logo=typescript&logoColor=1B3A6B&labelColor=D6E8FF)
![Third-Party](https://img.shields.io/badge/Third--Party-Not%20affiliated%20with%20Discord-E8E8E8?style=flat&labelColor=F5F5F5&color=D8D8D8)
![Status](https://img.shields.io/badge/Status-Active-B8E6B8?style=flat&labelColor=E0F5E0&logoColor=1F5C1F)

</div>

Custom Badges gives you a custom profile badge, name, and hover tooltip, rendered natively through the built-in BadgeAPI using React. No DOM hacks, no MutationObservers, no injected HTML. Badge data is synced through a small Cloudflare Worker backend, and writes are protected behind account verification so nobody but you can change your own badge.

<img src="https://raw.githubusercontent.com/ItzMeShadow999/My-assets/main/features-header.svg" alt="Features" width="100%" />

- Custom profile badge with image URL, name/description, and shape/size/hover styling
- Account verification: writes to your badge require a session token proving you own the Discord account you're publishing as
- Multiple saved badge slots (up to 12) with one active at a time
- Presets and importable/exportable badge packs
- Badge hover tooltip rendered via the native React tooltip system
- All settings managed through the standard plugin settings tab, no separate dashboard
- Badge data synced server side (keyed to your Discord user ID) so it follows you across devices

<img src="https://raw.githubusercontent.com/ItzMeShadow999/My-assets/main/usage-header.svg" alt="Usage" width="100%" />

Open **Settings -> Plugins -> CustomBadges -> Settings** to configure your badge:

- **Image URL**: link to your badge image. Must be hosted on one of `i.imgur.com`, `i.ibb.co`, `i.pinimg.com`, `files.catbox.moe`, `cdn.discordapp.com`, or `media.discordapp.net`. Discord silently blocks other hosts, so your badge just won't load.
- **Description / Name**: the text shown in the hover tooltip
- **Shape**: circle, rounded square, or square
- **Size**: how large the badge renders in the badge row
- **Hover effect**: none, scale, or glow (with a custom glow color)

Hit **Publish Badge** to push your badge to the server. Anyone else running the plugin will see it the next time they view your profile.

### Account Verification

Publishing, switching, or deleting a badge requires proving you own the Discord account you're doing it as:

1. Click **Verify Discord Account** in settings. This opens your browser to the verification page.
2. Confirm you're signed in as the right account and follow the prompt there.
3. Copy the code it gives you back and paste it into the **Session Token** field in settings.

That token is what authorizes every write from then on, sent as a `Bearer` header. Reading badges (yours or anyone else's) never required it and still doesn't. The token doesn't expire on its own; if a publish, switch, or delete ever fails with an auth error, re-verify and paste a fresh code. The token field itself is masked once you click away, so it isn't left sitting in plain text in your settings.

If you ever lose track of your token, or think someone else got hold of it, hit **Revoke Your Token**. This immediately kills that token server side, on every device using it, and you'll need to verify again to get a new one.

### Badge Slots ("My Badges")

You can save up to **12 different badges** as slots and switch between them at any time. The currently active slot is what gets published and shown to others.

### Presets

Built-in presets are available (Minecraft, cat, a verified-user style, and others). Selecting one and clicking **Apply Preset** overwrites your active badge with that preset's image, name, and style, then publishes it. This still requires a verified session token.

### Badge Packs

- **Import a pack**: paste a `raw.githubusercontent.com` URL pointing to a pack JSON file. Valid badges from the pack are added as new slots (up to the 12-slot cap).
- **Export a pack**: bundles all your saved slots into a JSON pack string, copied to clipboard, ready to share or host.

### Revert

Every time you publish, the previous badge is saved locally. **Revert to Previous Badge** restores it.

### Mutual-Guild Filter

An optional toggle limits badge rendering to users you share a server with, instead of showing badges from everyone running the plugin.

<img src="https://raw.githubusercontent.com/ItzMeShadow999/My-assets/main/license-header.svg" alt="License" width="100%" />

This plugin is built for and depends on [Equicord](https://github.com/Equicord/Equicord), licensed under the **GNU General Public License v3.0 (or later)**. This plugin is also distributed under **GPL-3.0-or-later**.

You're free to use, study, modify, and share this plugin, but if you distribute a modified version, you must make its source available under the same license. See [the full license text](https://www.gnu.org/licenses/gpl-3.0.html) or the `LICENSE` file in this project.

This is a third party plugin, not affiliated with, endorsed by, or supported by Discord Inc. Use of client modifications is against Discord's Terms of Service, use at your own risk.

<img src="https://raw.githubusercontent.com/ItzMeShadow999/My-assets/main/community-header.svg" alt="Community & Support" width="100%" />

- **Found someone using this plugin to display NSFW, hateful, or abusive badge content?** Please report it, don't just block and move on.
- **Something broken or not working as expected?**
  1. Check the [FAQs](https://discord.com/channels/1533400308074549340/1533404426562179103) first, your issue may already be answered there.
  2. If it's not covered, ask in the [issues help chat](https://discord.com/channels/1533400308074549340/1533400758769287198).
  3. To report a bug, abuse, or a badge that violates the rules, use the [Reports chat](https://discord.com/channels/1533400308074549340/1533400476505215106).
- Join the server: https://discord.gg/PUYaka9Hy8
- You can optionally tag [Shadow](https://discord.com/users/1065604516399026176) in the relevant channel, please don't send DMs, they're most likely filtered and won't be seen.
