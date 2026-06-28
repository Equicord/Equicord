# FrequentFriends

A Vencord / Equicord plugin that brings back the much-missed "Frequently Contacted" list directly to your DM sidebar.

## Features
<img width="593" height="669" alt="frequentfriendsscreenshot" src="https://github.com/user-attachments/assets/415e2c59-8d03-4b11-b6ec-8dad3d8a4015" />
<img width="590" height="674" alt="frequentscreenshot" src="https://github.com/user-attachments/assets/ade97080-ce7a-46b0-b3d8-80eb9ec41a41" />

- **Smart Ranking:** Tracks and ranks friends based on active DM interactions and voice chat duration.
- **Original UX Aesthetics:** Displays your most active friend as **"Most Frequent"** with a fire badge, and less active ones as **"Cooling off"** with a snowflake badge.
- **Customizable Size:** Choose exactly how many friends to display in the row, ranging from 3 to 10 avatars.
- **Custom Labels:** Rename the section title from "Frequent Friends" to any custom text you prefer.
- **Affinity Sync:** Option to pull data directly from Discord's internal affinity store or rely purely on the plugin's local tracking.
- **Privacy & Safety:** Data is fully localized per account, and tracking can be completely reset with a one-click undo option.

## Settings

| Setting | Default | Description |
|---|---|---|
| Custom Label | `Frequent Friends` | Title shown above the avatar row (max 30 chars) |
| Max Friends | `5` | How many avatars to show (3–10) |
| Show Offline | `off` | Include offline/invisible friends |
| Ignore Affinities | `off` | Skip Discord's affinity data, rely only on your own interactions |
| Reset All Data | — | Wipes all tracked scores (creates a safety backup) |
| Undo Reset | — | Restores your data from the latest backup |

## Installation & Usage

Once included in official releases, simply enable **FrequentFriends** under `Settings` → `Plugins`.

*(For manual / standalone installation: place this folder into `src/userplugins/FrequentFriends/` and run `pnpm build`)*

## Compatibility

Works identically on both Vencord and Equicord client modifications.

## Data Storage

Frequency data is stored per-account in Vencord's DataStore under the key `FrequentFriends_<userId>`.
The `FrequencyData` object uses abbreviated field names (`ds`, `vs`, `dl`, `vl`, `af`) to reduce storage size.
**Do not rename these fields** without adding a migration step — existing entries will silently lose their scores.

## License

GPL-3.0
