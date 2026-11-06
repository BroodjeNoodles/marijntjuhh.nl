# 🎮 Multiplayer Shooter Game

A real-time browser-based multiplayer shooting game built with **Node.js**, **Socket.IO**, and **p5.js**.

![Game Preview](https://img.shields.io/badge/Status-Ready%20to%20Play-success)
![Node.js](https://img.shields.io/badge/Node.js-Required-green)
![Multiplayer](https://img.shields.io/badge/Multiplayer-2%2B%20Players-blue)

## ✨ Features

### Gameplay
- **Top-down 2D shooter** with smooth controls
- **Real-time multiplayer** for 2+ players using WebSockets
- **AI Bot** that moves intelligently and shoots at players
- **Health system** with respawning mechanics
- **Projectile physics** with collision detection
- **Power-ups** that restore health
- **Kill tracking scoreboard**
- **Three selectable maps** (Quarry, Outpost, and Ruins)
- **Wall-safe spawning** for players and the bot

### Technical Features
- **Server-side game state** management
- **Client-side rendering** using p5.js
- **WebSocket synchronization** with Socket.IO
- **Responsive controls** (WASD/Arrow keys + Mouse)
- **Sound effects** for shooting and interactions
- **Smooth 60 FPS** game loop

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v14 or higher)
- **npm** (comes with Node.js)
- A modern web browser (Chrome, Firefox, Edge, Safari)

### Installation

1. **Navigate to the project directory:**
   ```bash
   cd "z:\main page 2"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open your browser:**
   - Navigate to `http://localhost:3000`
   - Open the same URL in multiple browser windows/tabs to test multiplayer!

### Development Mode
For auto-restart on file changes:
```bash
npm run dev
```

## 🎮 How to Play

### Controls
- **WASD** or **Arrow Keys** - Move your player
- **Mouse** - Aim your weapon
- **Left Click** or **Space** - Shoot
- **Mouse hover** - Target enemies

### Objective
- **Shoot other players and the bot** to earn kills
- **Avoid getting hit** to stay alive
- **Collect pink power-ups** to restore health
- **Compete for the highest kill count** on the scoreboard

### Game Mechanics
- Each hit deals **20 damage**
- Players and bots **respawn after 3 seconds**
- Players have **100 health**
- The bot has **150 health** and is more challenging
- Power-ups spawn every **10 seconds** (max 3 on map)
- Projectiles last **2 seconds** before disappearing
- Choose a map before joining. A round uses one map until all players leave.

## 📁 Project Structure

```
multiplayer-shooter-game/
├── server.js              # Node.js server with game logic
├── package.json           # Project dependencies
├── public/
│   ├── index.html         # Game client HTML
│   ├── game.js            # p5.js client-side rendering
│   └── gameConfig.js      # Shared game configuration
└── README.md              # This file
```

## 🔧 Configuration

You can modify game settings in `public/gameConfig.js`:

```javascript
// Example settings you can adjust
PLAYER_SPEED: 5,           // Player movement speed
PROJECTILE_SPEED: 10,      // Bullet speed
PLAYER_MAX_HEALTH: 100,    // Starting health
BOT_MAX_HEALTH: 150,       // Bot health
FIRE_COOLDOWN: 300,        // Time between shots (ms)
```

## 🌐 Multiplayer Setup

### Local Network (LAN) Play
1. Find your computer's local IP address:
   - **Windows**: Run `ipconfig` in Command Prompt, look for IPv4 Address
   - **Mac/Linux**: Run `ifconfig` or `ip addr`
2. Other players connect to: `http://YOUR_IP:3000`

### Port Configuration
Change the port in `server.js` if needed:
```javascript
const PORT = process.env.PORT || 3000;
```

Or set via environment variable:
```bash
PORT=8080 npm start
```

## 🎨 Game Elements

| Element | Color | Description |
|---------|-------|-------------|
| **Your Player** | Green | You control this character |
| **Other Players** | Blue | Other connected players |
| **Bot** | Red | AI-controlled enemy |
| **Projectiles** | Orange | Bullets fired by players/bot |
| **Health Power-ups** | Pink | Restores 50 health points |

## 🐛 Troubleshooting

### Server won't start
- Make sure port 3000 isn't already in use
- Check that Node.js is installed: `node --version`
- Delete `node_modules` and run `npm install` again

### Players can't connect
- Ensure the server is running
- Check firewall settings
- Verify the correct IP address and port

### Game is laggy
- Close unnecessary browser tabs
- Reduce the number of connected players
- Check your internet connection (for non-local play)

### No sound effects
- Check browser audio permissions
- Ensure your browser supports Web Audio API
- Try refreshing the page

## 🎯 Future Enhancements

Ideas for extending the game:
- [ ] Multiple weapon types
- [ ] Larger maps with obstacles
- [ ] Team-based gameplay
- [ ] Different game modes (Deathmatch, Capture the Flag)
- [ ] Player customization (colors, skins)
- [ ] Chat system
- [ ] Leaderboards with persistent storage
- [ ] Mobile touch controls
- [ ] More power-up types (speed boost, shield, etc.)

## 📝 Technical Details

### Server (Node.js + Socket.IO)
- Runs simulation at **60 ticks per second** and sends network snapshots at **20 per second**
- Handles collision detection server-side
- Manages game state for all clients
- Implements bot AI logic
- Broadcasts updates to all connected clients

### Client (p5.js)
- Renders at **60 FPS**
- Handles user input
- Displays game state received from server
- Predicts local player movement for smoothness
- Draws all game elements (players, projectiles, UI)

### Communication Protocol
- **playerMove**: Client → Server (position updates)
- **playerShoot**: Client → Server (shooting action)
- **gameState**: Server → All Clients (full game state)
- **init**: Server → Client (initial connection data)

## 📄 License

MIT License - Feel free to modify and use for your own projects!

## 🙏 Credits

Built with:
- [Node.js](https://nodejs.org/) - Server runtime
- [Express](https://expressjs.com/) - Web framework
- [Socket.IO](https://socket.io/) - Real-time communication
- [p5.js](https://p5js.org/) - Graphics and rendering

---

**Enjoy the game!** 🎮🔫

For questions or issues, feel free to open an issue or contribute to the project.
