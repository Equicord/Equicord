# Constcal (WIP)
Automatically calls someone until they respond

## Warning
⚠️ Modifying the Discord client and using scripts is against Discord's ToS, use at your own risk ⚠️

## Features
- Configurable call duration and total duration limits
- Built-in `/constcal` command (maybe a button in the future)

## Installation
1. Clone this repository into your Vencord plugins directory
   ```bash
   git clone https://github.com/Matoumatio/Constcal.git ~/vencord/src/userplugins/Constcal
   ```
2. Rebuild your Vencord client (check <https://docs.vencord.dev/installing/#building-vencord>)

## Usage
1. Open a DM
2. Type `/constcal start` to begin automatic calling
3. Type `/constcal stop` to stop the process

## Settings
- **Call Duration** : Time to wait between calls (in seconds, default : 30)
- **Total Duration** : Maximum time to keep calling (in seconds, default : 3600 (0 : unlimited))

## File Structure
```plaintext
src/userplugins/constcal/
├── index.ts          # Main plugin
└── README.md         # Documentation
```
