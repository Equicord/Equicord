# vc-allChannels

A [Vencord](https://github.com/Vendicated/Vencord) userplugin that adds a live message feed aggregating messages from all (or selected) channels across your servers, DMs, and group chats.

## Features

- **Live Message Feed** — Real-time messages from all your servers and DMs in a single view
- **Channel Selector** — Filter which channels and servers appear in the feed (DMs always show in the feed but can't be filtered yet)
- **Full Markdown Rendering** — Bold, italic, strikethrough, code blocks, headers, lists, block quotes, and spoilers
- **Rich Content Support** — Embeds, attachments, image previews (click to expand/collapse between thumbnail and full size)
- **Mentions & Emojis** — User mentions, role mentions, channel mentions, and custom/animated emojis
- **Click to Navigate** — Click any message to jump directly to it in Discord
- **Unread Badge** — Server list button shows unread message count
- **Select/Deselect All** — Quickly toggle channels per category or globally

## Installation

> Requires [Vencord](https://github.com/Vendicated/Vencord) to be installed.

```sh
cd path/to/Vencord/src/userplugins
git clone https://github.com/PawiX25/vc-allChannels.git allChannels
```

Then rebuild Vencord:

```sh
cd path/to/Vencord
pnpm build
```

## Usage

After enabling the plugin, a button appears in your server list. Click it to open the live message feed modal.

Use the channel selector (toggle via the button in the modal header) to pick which channels you want to monitor.

