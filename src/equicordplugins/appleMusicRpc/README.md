# AppleMusic Presence Plugin

<p align="center">
  <b>Turn your Apple Music session into a beautiful Discord Rich Presence.</b>
  <br />
  Real-time track detection, album art, clean timestamps, and full UTF-8 metadata support.
</p>

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-0078D4?style=for-the-badge" />
  <img alt="Client" src="https://img.shields.io/badge/Client-Equicord%20%7C%20Vencord-5865F2?style=for-the-badge" />
  <img alt="Music" src="https://img.shields.io/badge/Source-Apple%20Music-fa233b?style=for-the-badge" />
  <img alt="Status" src="https://img.shields.io/badge/Status-Working-success?style=for-the-badge" />
</p>

---

## Why this plugin?

Most music RPC setups are either fragile, outdated, or break with non-English characters.

**AppleMusic Presence Plugin** was built to feel reliable in real-world usage:
- Real-time detection from your desktop music session
- Continuous Discord Rich Presence updates
- Correct UTF-8 metadata handling (`á`, `é`, `ñ`, `ø`, etc.)
- Album artwork support for a premium profile card

---

## What you get

- Real-time **Now Playing** from Apple Music
- Rich Presence with song title, artist, album, and progress
- Album cover image in activity assets
- Custom text templates: `{name}`, `{artist}`, `{album}`
- Configurable refresh interval

---

## Requirements

- Windows / Linux / macOS
- Apple Music desktop app
- Equicord or Vencord
- Node.js + pnpm (if you build from source)

---

## Installation

1. Add this plugin folder to your client plugin source tree (commonly `src/userplugins/...`).
2. Build your client/plugin setup.
3. Inject/apply the build.
4. Restart Discord completely.
5. Enable the plugin in settings.

---

## Screenshots

```md
![Profile Preview](./assets/profile-preview.png)
![Plugin Settings](./assets/settings-preview.png)
```

---

## Support me on Ko-fi

If this plugin improved your Discord profile and you want to support future updates:

[![Support me on Ko-fi](https://img.shields.io/badge/Support%20me%20on-Ko--fi-ff5f5f?style=for-the-badge&logo=kofi&logoColor=white)](https://ko-fi.com/rolololodev007)

---

## Contributing

PRs are welcome.

## License

MIT

