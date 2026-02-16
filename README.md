<div align="center">

# 🎮 discord-quest-completer

**Auto-complete Discord game-play quests without playing.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Discord](https://img.shields.io/badge/Platform-Discord%20Desktop-5865F2?logo=discord&logoColor=white)](https://discord.com)
[![JavaScript](https://img.shields.io/badge/Language-JavaScript-F7DF1E?logo=javascript&logoColor=black)](quest-completer.js)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

Claim free Discord rewards without installing or playing anything.

</div>

---

## 🎁 Why?

Discord regularly drops **limited-time quests** that reward free cosmetics — avatar decorations, profile effects, collectibles, and more. The catch? You need to play specific games for hours. This script handles that for you automatically, so you never miss a reward drop.

---

## ⚡ Quick Start

```
1. Open Discord Desktop
2. Ctrl+Shift+I → Console tab
3. Paste quest-completer.js → Enter
```

The script auto-detects all enrolled, uncompleted quests and processes them sequentially with real-time progress logging.

## 📋 Supported Quest Types

| Type | Method |
|---|---|
| `PLAY_ON_DESKTOP` | Spoofs a running game process via `RunningGameStore` |
| `PLAY_ACTIVITY` | Sends heartbeat requests to the quest progress API |

## 🔍 How It Works

The script hooks into Discord's internal webpack modules to access stores and APIs that aren't publicly exposed.

- **Desktop quests** → Patches `RunningGameStore` to inject a fake game process. Discord's heartbeat system naturally ticks up progress.
- **Activity quests** → Posts heartbeat requests to the quest API on a 20s interval until the target is met.

All quests are queued and processed one at a time. Once a quest hits its target duration, the spoofed state is cleaned up and the next quest begins.

## 📌 Requirements

- Discord **Desktop** app (browser is not supported)
- At least one enrolled, uncompleted game-play quest

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## ⚠️ Disclaimer

This project is for **educational purposes only**. Use at your own risk. Not affiliated with or endorsed by Discord.

## 📄 License

[MIT](LICENSE)
