# discord-quest-completer

Auto-complete Discord game-play quests without actually playing. Runs entirely in the Discord Desktop DevTools console.

## Supported Quest Types

| Type | Method |
|---|---|
| `PLAY_ON_DESKTOP` | Spoofs a running game process via Discord's internal `RunningGameStore` |
| `PLAY_ACTIVITY` | Sends periodic heartbeat requests to the quest progress API |

## Usage

1. Open **Discord Desktop** app
2. Press `Ctrl+Shift+I` to open DevTools
3. Go to the **Console** tab
4. Paste the contents of [`quest-completer.js`](quest-completer.js) and press Enter

The script will automatically detect all enrolled, uncompleted quests and process them sequentially. Progress is logged in real-time.

## How It Works

The script hooks into Discord's internal webpack modules to access stores and APIs that aren't exposed publicly. For desktop quests, it patches `RunningGameStore` to make Discord believe a game is running by injecting a fake process entry — Discord's heartbeat system then naturally ticks up the quest progress. For activity quests, it directly posts heartbeat requests to the quest API endpoint on a 20-second interval until the target is met.

All quests are queued and processed one at a time. Once a quest hits its target duration, the spoofed state is cleaned up and the next quest begins.

## Requirements

- Discord Desktop app (browser is not supported)
- At least one enrolled, uncompleted game-play quest

## Disclaimer

This project is for educational purposes only. Use at your own risk. This is not affiliated with or endorsed by Discord.

## License

[MIT](LICENSE)
