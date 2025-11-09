/**
 * Node.js Server for Multiplayer Shooter Game
 * Handles WebSocket connections, game state, and server-side logic
 */

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const GameConfig = require('./public/gameConfig');

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Explicit root route handler
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game state
const gameState = {
  players: {}, // Connected players
  bot: null,   // AI bot
  projectiles: [], // Active projectiles
  powerups: [],    // Active power-ups
  obstacles: []    // Static obstacles
};

let nextProjectileId = 0;
let nextPowerupId = 0;

/**
 * Generate random obstacles on the map
 */
function generateObstacles() {
  gameState.obstacles = [];
  
  for (let i = 0; i < GameConfig.OBSTACLE_COUNT; i++) {
    const width = GameConfig.OBSTACLE_MIN_SIZE + 
                  Math.random() * (GameConfig.OBSTACLE_MAX_SIZE - GameConfig.OBSTACLE_MIN_SIZE);
    const height = GameConfig.OBSTACLE_MIN_SIZE + 
                   Math.random() * (GameConfig.OBSTACLE_MAX_SIZE - GameConfig.OBSTACLE_MIN_SIZE);
    
    let x, y;
    let attempts = 0;
    const maxAttempts = 50;
    
    // Try to place obstacle without overlapping spawn areas
    do {
      x = Math.random() * (GameConfig.MAP_WIDTH - width);
      y = Math.random() * (GameConfig.MAP_HEIGHT - height);
      attempts++;
      
      // Avoid center spawn area
      const distFromCenter = Math.sqrt(
        Math.pow(x + width/2 - GameConfig.MAP_WIDTH/2, 2) + 
        Math.pow(y + height/2 - GameConfig.MAP_HEIGHT/2, 2)
      );
      
      if (distFromCenter > 200 || attempts >= maxAttempts) {
        break;
      }
    } while (attempts < maxAttempts);
    
    gameState.obstacles.push({
      id: i,
      x: x,
      y: y,
      width: width,
      height: height,
      type: Math.random() > 0.5 ? 'rect' : 'rect' // Can add more types later
    });
  }
}

/**
 * Check if a circle collides with any obstacle
 */
function checkObstacleCollision(x, y, radius) {
  for (let obstacle of gameState.obstacles) {
    // Circle-rectangle collision
    const closestX = Math.max(obstacle.x, Math.min(x, obstacle.x + obstacle.width));
    const closestY = Math.max(obstacle.y, Math.min(y, obstacle.y + obstacle.height));
    
    const distanceX = x - closestX;
    const distanceY = y - closestY;
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    
    if (distanceSquared < (radius * radius)) {
      return obstacle;
    }
  }
  return null;
}

/**
 * Initialize the AI bot
 */
function initializeBot() {
  gameState.bot = {
    id: 'bot',
    x: GameConfig.MAP_WIDTH / 2,
    y: GameConfig.MAP_HEIGHT / 2,
    angle: 0,
    health: GameConfig.BOT_MAX_HEALTH,
    maxHealth: GameConfig.BOT_MAX_HEALTH,
    lastFired: 0,
    alive: true,
    targetX: Math.random() * GameConfig.MAP_WIDTH,
    targetY: Math.random() * GameConfig.MAP_HEIGHT,
    lastWander: Date.now()
  };
}

/**
 * Bot AI logic - moves and shoots at nearest player
 */
function updateBot() {
  if (!gameState.bot || !gameState.bot.alive) return;

  const bot = gameState.bot;
  const now = Date.now();

  // Find nearest player
  let nearestPlayer = null;
  let nearestDistance = Infinity;

  Object.values(gameState.players).forEach(player => {
    if (!player.alive) return;
    const dx = player.x - bot.x;
    const dy = player.y - bot.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPlayer = player;
    }
  });

  // If player is in range, move towards and shoot at them
  if (nearestPlayer && nearestDistance < GameConfig.BOT_DETECTION_RANGE) {
    const dx = nearestPlayer.x - bot.x;
    const dy = nearestPlayer.y - bot.y;
    const angle = Math.atan2(dy, dx);

    // Move towards player
    bot.x += Math.cos(angle) * GameConfig.BOT_SPEED;
    bot.y += Math.sin(angle) * GameConfig.BOT_SPEED;
    bot.angle = angle;
    
    // Check obstacle collision and revert if needed
    if (checkObstacleCollision(bot.x, bot.y, GameConfig.BOT_SIZE / 2)) {
      bot.x -= Math.cos(angle) * GameConfig.BOT_SPEED;
      bot.y -= Math.sin(angle) * GameConfig.BOT_SPEED;
      // Pick new random target
      bot.targetX = Math.random() * GameConfig.MAP_WIDTH;
      bot.targetY = Math.random() * GameConfig.MAP_HEIGHT;
      bot.lastWander = now;
    }

    // Shoot at player
    if (now - bot.lastFired > GameConfig.BOT_FIRE_COOLDOWN) {
      createProjectile(bot.x, bot.y, angle, 'bot');
      bot.lastFired = now;
    }
  } else {
    // Wander randomly
    if (now - bot.lastWander > GameConfig.BOT_WANDER_INTERVAL) {
      bot.targetX = Math.random() * GameConfig.MAP_WIDTH;
      bot.targetY = Math.random() * GameConfig.MAP_HEIGHT;
      bot.lastWander = now;
    }

    const dx = bot.targetX - bot.x;
    const dy = bot.targetY - bot.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 5) {
      const angle = Math.atan2(dy, dx);
      bot.x += Math.cos(angle) * GameConfig.BOT_SPEED;
      bot.y += Math.sin(angle) * GameConfig.BOT_SPEED;
      bot.angle = angle;
      
      // Check obstacle collision and revert if needed
      if (checkObstacleCollision(bot.x, bot.y, GameConfig.BOT_SIZE / 2)) {
        bot.x -= Math.cos(angle) * GameConfig.BOT_SPEED;
        bot.y -= Math.sin(angle) * GameConfig.BOT_SPEED;
        // Pick new target
        bot.targetX = Math.random() * GameConfig.MAP_WIDTH;
        bot.targetY = Math.random() * GameConfig.MAP_HEIGHT;
        bot.lastWander = now;
      }
    }
  }

  // Keep bot within bounds
  bot.x = Math.max(GameConfig.BOT_SIZE / 2, Math.min(GameConfig.MAP_WIDTH - GameConfig.BOT_SIZE / 2, bot.x));
  bot.y = Math.max(GameConfig.BOT_SIZE / 2, Math.min(GameConfig.MAP_HEIGHT - GameConfig.BOT_SIZE / 2, bot.y));
}

/**
 * Create a new projectile
 */
function createProjectile(x, y, angle, ownerId) {
  gameState.projectiles.push({
    id: nextProjectileId++,
    x: x,
    y: y,
    vx: Math.cos(angle) * GameConfig.PROJECTILE_SPEED,
    vy: Math.sin(angle) * GameConfig.PROJECTILE_SPEED,
    ownerId: ownerId,
    createdAt: Date.now()
  });
}

/**
 * Update all projectiles
 */
function updateProjectiles() {
  const now = Date.now();

  // Update positions and remove old projectiles
  gameState.projectiles = gameState.projectiles.filter(projectile => {
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;

    // Remove if out of bounds or too old
    if (projectile.x < 0 || projectile.x > GameConfig.MAP_WIDTH ||
        projectile.y < 0 || projectile.y > GameConfig.MAP_HEIGHT ||
        now - projectile.createdAt > GameConfig.PROJECTILE_LIFETIME) {
      return false;
    }
    
    // Remove if hits obstacle
    if (checkObstacleCollision(projectile.x, projectile.y, GameConfig.PROJECTILE_SIZE / 2)) {
      return false;
    }

    return true;
  });

  // Check collisions with players
  gameState.projectiles = gameState.projectiles.filter(projectile => {
    // Check collision with players
    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive || playerId === projectile.ownerId) continue;

      const dx = player.x - projectile.x;
      const dy = player.y - projectile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < GameConfig.PLAYER_SIZE / 2) {
        player.health -= GameConfig.PROJECTILE_DAMAGE;
        
        if (player.health <= 0) {
          player.health = 0;
          player.alive = false;
          
          // Award kill to shooter
          if (projectile.ownerId === 'bot') {
            // Bot got a kill
          } else if (gameState.players[projectile.ownerId]) {
            gameState.players[projectile.ownerId].kills = (gameState.players[projectile.ownerId].kills || 0) + 1;
          }
          
          // Respawn after delay
          setTimeout(() => {
            if (gameState.players[playerId]) {
              respawnPlayer(gameState.players[playerId]);
            }
          }, GameConfig.PLAYER_RESPAWN_TIME);
        }
        
        return false; // Remove projectile
      }
    }

    // Check collision with bot
    if (gameState.bot && gameState.bot.alive && projectile.ownerId !== 'bot') {
      const dx = gameState.bot.x - projectile.x;
      const dy = gameState.bot.y - projectile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < GameConfig.BOT_SIZE / 2) {
        gameState.bot.health -= GameConfig.PROJECTILE_DAMAGE;
        
        if (gameState.bot.health <= 0) {
          gameState.bot.health = 0;
          gameState.bot.alive = false;
          
          // Award kill to shooter
          if (gameState.players[projectile.ownerId]) {
            gameState.players[projectile.ownerId].kills = (gameState.players[projectile.ownerId].kills || 0) + 1;
          }
          
          // Respawn bot after delay
          setTimeout(() => {
            respawnBot();
          }, GameConfig.PLAYER_RESPAWN_TIME);
        }
        
        return false; // Remove projectile
      }
    }

    return true; // Keep projectile
  });
}

/**
 * Respawn a player at a random position
 */
function respawnPlayer(player) {
  player.x = Math.random() * (GameConfig.MAP_WIDTH - 100) + 50;
  player.y = Math.random() * (GameConfig.MAP_HEIGHT - 100) + 50;
  player.health = GameConfig.PLAYER_MAX_HEALTH;
  player.alive = true;
}

/**
 * Respawn the bot
 */
function respawnBot() {
  if (gameState.bot) {
    gameState.bot.x = Math.random() * (GameConfig.MAP_WIDTH - 100) + 50;
    gameState.bot.y = Math.random() * (GameConfig.MAP_HEIGHT - 100) + 50;
    gameState.bot.health = GameConfig.BOT_MAX_HEALTH;
    gameState.bot.alive = true;
  }
}

/**
 * Spawn a random power-up
 */
function spawnPowerup() {
  if (gameState.powerups.length >= GameConfig.POWERUP_MAX_COUNT) return;

  gameState.powerups.push({
    id: nextPowerupId++,
    x: Math.random() * (GameConfig.MAP_WIDTH - 100) + 50,
    y: Math.random() * (GameConfig.MAP_HEIGHT - 100) + 50,
    type: 'health' // Only health power-ups for now
  });
}

/**
 * Check power-up collisions
 */
function updatePowerups() {
  gameState.powerups = gameState.powerups.filter(powerup => {
    for (let playerId in gameState.players) {
      const player = gameState.players[playerId];
      if (!player.alive) continue;

      const dx = player.x - powerup.x;
      const dy = player.y - powerup.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < (GameConfig.PLAYER_SIZE / 2 + GameConfig.POWERUP_SIZE / 2)) {
        // Player collected power-up
        if (powerup.type === 'health') {
          player.health = Math.min(player.health + GameConfig.POWERUP_HEALTH_RESTORE, GameConfig.PLAYER_MAX_HEALTH);
        }
        return false; // Remove power-up
      }
    }
    return true; // Keep power-up
  });
}

/**
 * Main game loop
 */
function gameLoop() {
  updateBot();
  updateProjectiles();
  updatePowerups();

  // Broadcast game state to all clients
  io.emit('gameState', {
    players: gameState.players,
    bot: gameState.bot,
    projectiles: gameState.projectiles,
    powerups: gameState.powerups,
    obstacles: gameState.obstacles
  });
}

// Initialize game
generateObstacles();
initializeBot();

// Start power-up spawner
setInterval(spawnPowerup, GameConfig.POWERUP_SPAWN_INTERVAL);

// Start game loop
const tickInterval = 1000 / GameConfig.SERVER_TICK_RATE;
setInterval(gameLoop, tickInterval);

/**
 * Socket.IO connection handling
 */
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Wait for player to send their nickname
  socket.on('setNickname', (nickname) => {
    // Sanitize nickname
    const sanitizedNickname = (nickname || 'Player').substring(0, 20).trim() || 'Player';
    
    // Create new player
    gameState.players[socket.id] = {
      id: socket.id,
      nickname: sanitizedNickname,
      x: Math.random() * (GameConfig.MAP_WIDTH - 100) + 50,
      y: Math.random() * (GameConfig.MAP_HEIGHT - 100) + 50,
      angle: 0,
      health: GameConfig.PLAYER_MAX_HEALTH,
      maxHealth: GameConfig.PLAYER_MAX_HEALTH,
      alive: true,
      kills: 0,
      lastFired: 0
    };

    console.log(`Player ${socket.id} joined as "${sanitizedNickname}"`);

    // Send initial game state to new player
    socket.emit('init', {
      playerId: socket.id,
      gameState: {
        players: gameState.players,
        bot: gameState.bot,
        projectiles: gameState.projectiles,
        powerups: gameState.powerups,
        obstacles: gameState.obstacles
      }
    });
  });

  // Handle player movement
  socket.on('playerMove', (data) => {
    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;

    // Update position
    let newX = player.x + data.dx * GameConfig.PLAYER_SPEED;
    let newY = player.y + data.dy * GameConfig.PLAYER_SPEED;

    // Keep player within bounds
    newX = Math.max(GameConfig.PLAYER_SIZE / 2, Math.min(GameConfig.MAP_WIDTH - GameConfig.PLAYER_SIZE / 2, newX));
    newY = Math.max(GameConfig.PLAYER_SIZE / 2, Math.min(GameConfig.MAP_HEIGHT - GameConfig.PLAYER_SIZE / 2, newY));

    // Check obstacle collision
    if (!checkObstacleCollision(newX, newY, GameConfig.PLAYER_SIZE / 2)) {
      player.x = newX;
      player.y = newY;
    }
    
    player.angle = data.angle;
  });

  // Handle player shooting
  socket.on('playerShoot', (data) => {
    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;

    const now = Date.now();
    if (now - player.lastFired < GameConfig.FIRE_COOLDOWN) return;

    createProjectile(player.x, player.y, data.angle, socket.id);
    player.lastFired = now;
  });

  // Handle player disconnect
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete gameState.players[socket.id];
  });
});

// Start server
const PORT = process.env.PORT || 3000;

// Export for Vercel (exports the Express app)
module.exports = app;

// Only listen locally if not in serverless environment
if (!process.env.VERCEL && require.main === module) {
  http.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Open the URL in multiple browser windows to play multiplayer!');
  });
}
