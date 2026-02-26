# Romi AFK Bot

Minecraft AFK Bot using Mineflayer with Discord integration.

## Features

- Auto-Reconnect
- Anti-AFK (jump & rotate)
- Chest Sorting (bones → destination, arrows → trash)
- Discord Chat Bridge (MC ↔ Discord)
- Repeat Message Command
- Professional Console UI

## Installation

```bash
npm install
```

## Configuration (.env)

```env
HOST=mc.cwresports.lk
PORT=25565
USERNAME=Romi
VERSION=1.20.1
INTERVAL=60000
CHEST_FROM_X=0
CHEST_FROM_Y=64
CHEST_FROM_Z=0
CHEST_TO_X=5
CHEST_TO_Y=64
CHEST_TO_Z=0
DISCORD_TOKEN=your_bot_token
DISCORD_CHANNEL_ID=your_channel_id
```

## Commands

### In-Game
- `!afk on` / `!afk off` - Toggle Anti-AFK
- `!sort on` / `!sort off` - Toggle Chest Sorting
- `!repeat on <message>` - Repeat message every 6s
- `!repeat off` - Stop repeat
- `!status` - Show health & food
- `!help` - Show commands
- `!setip <ip:port>` - Change server
- `!setname <name>` - Change username

### Console
- `setip <ip:port>` - Change server
- `setname <username>` - Change username
- `status` - Bot status
- `exit` - Exit

## Run

```bash
node romi-afk.js
```
