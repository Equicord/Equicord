# VoiceNarratorNatural

A TTS (Text-to-Speech) plugin for [Vencord](https://vencord.dev/) / [Equicord](https://github.com/Equicord/Equicord) that announces voice channel events using Windows Natural Voices via SAPI5.

## Features

- 🎙️ **Voice Channel Announcements** - Announces when users join, leave, or move between voice channels
- 🔇 **Mute/Deafen Detection** - Announces when any user in your channel mutes/unmutes or deafens/undeafens
- 🗣️ **Windows Natural Voices** - Support for high-quality Microsoft Natural Voices via SAPI5
- 💬 **Speak Message** - Right-click any message to have it read aloud
- ⚙️ **Customizable Messages** - Fully customizable announcement messages with variables

## Installation

### As a Userplugin

1. Clone this repository into your Vencord/Equicord userplugins folder:
   ```bash
   cd src/userplugins
   git clone https://github.com/srmooon/VoiceNarratorNatural.git
   ```

2. Build and inject:
   ```bash
   pnpm build
   pnpm inject
   ```

3. Restart Discord and enable the plugin in settings.

## SAPI5 Natural Voices Setup

To use Windows Natural Voices (like Microsoft Antonio, Francisca, etc.), you need to install [NaturalVoiceSAPIAdapter](https://github.com/gexgd0419/NaturalVoiceSAPIAdapter).

### ⚠️ Important Requirements

- **You MUST install BOTH 32-bit (x86) and 64-bit (x64) versions** of NaturalVoiceSAPIAdapter for the plugin to work correctly
- **Recommended**: Install voices in "Local" mode for better performance and reliability (online voices may have latency issues)

### Installation Steps

1. Download NaturalVoiceSAPIAdapter from the link above
2. **Install both x86 and x64 versions** (this is required!)
3. Open NaturalVoiceSAPIAdapter and select the voices you want to use
4. **Recommended**: Choose "Local" installation mode for each voice
5. In the plugin settings, select "SAPI5" as the TTS Provider
6. Click "Install SAPI5" to download the required Python components (~20MB)
7. Select your preferred voice from the dropdown

## Message Variables

You can customize the announcement messages using these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `{nickname}` | User's server nickname | Moon |
| `{display_name}` | User's global display name | SrMoon |
| `{username}` | User's username | srmoon |
| `{channel}` | Voice channel name | General |
| `{server}` | Server name | My Server |

### Default Messages

- **Join**: `{nickname} entered the voice`
- **Leave**: `{nickname} left the voice`
- **Move**: `{nickname} moved to {channel}`
- **Mute**: `{nickname} muted`
- **Unmute**: `{nickname} unmuted`
- **Deafen**: `{nickname} deafened`
- **Undeafen**: `{nickname} undeafened`

## Settings

- **TTS Provider** - Choose between System (browser voices) or SAPI5 (Windows Natural Voices)
- **System Voice** - Select a voice from your system's available voices
- **SAPI5 Voice** - Select a natural voice (requires SAPI5 setup)
- **Volume** - Adjust the narrator volume (0-100%)
- **Speed** - Adjust the speech rate
- **Announce yourself** - Toggle whether to announce your own actions
- **Strip non-latin characters** - Remove special characters from names

## Author

**SrMoon** - [GitHub](https://github.com/srmooon)

## License

GPL-3.0-or-later
