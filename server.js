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
  bots: [],    // AI bots
  projectiles: [], // Active projectiles
  powerups: [],    // Active power-ups
  obstacles: [],   // Destructible walls
  explosions: [],
  round: {
    number: 1,
    mode: 'freeForAll',
    weapon: 'dualPistols',
    startedAt: Date.now(),
    kothTime: 0
  }
};

let nextProjectileId = 0;
let nextPowerupId = 0;
let activeMapId = 'quarry';
let simulationTick = 0;
const mapVotes = {};
const modeVotes = {};
const weaponVotes = {};

/**
 * Generate random obstacles on the map
 */
function generateObstacles(mapId = activeMapId) {
  gameState.obstacles = [];
  const map = GameConfig.MAPS[mapId] || GameConfig.MAPS.quarry;
  
  const obstacleCount = Math.max(4, Math.round(map.obstacleCount * (0.65 + Math.random() * 0.7)));
  for (let i = 0; i < obstacleCount; i++) {
    const width = map.minObstacleSize +
                  Math.random() * (map.maxObstacleSize - map.minObstacleSize);
    const height = map.minObstacleSize +
                   Math.random() * (map.maxObstacleSize - map.minObstacleSize);
    
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
      health: 100,
      destructible: true,
      type: Math.random() > 0.5 ? 'rect' : 'rect' // Can add more types later
    });
  }
}

function isValidSpawn(x, y, radius, ignoreId = null) {
  if (checkObstacleCollision(x, y, radius)) return false;

  const entities = Object.values(gameState.players).filter(player => player.id !== ignoreId && player.alive);
  gameState.bots.filter(bot => bot.alive && bot.id !== ignoreId).forEach(bot => entities.push(bot));
  return entities.every(entity => {
    const dx = entity.x - x;
    const dy = entity.y - y;
    const entityRadius = entity.isBot ? (entity.size || GameConfig.BOT_SIZE) / 2 : GameConfig.PLAYER_SIZE / 2;
    return dx * dx + dy * dy >= (radius + entityRadius) ** 2;
  });
}

function findSafeSpawn(radius, ignoreId = null) {
  const min = radius;
  const maxX = GameConfig.MAP_WIDTH - radius;
  const maxY = GameConfig.MAP_HEIGHT - radius;

  for (let attempt = 0; attempt < 100; attempt++) {
    const x = min + Math.random() * (maxX - min);
    const y = min + Math.random() * (maxY - min);
    if (isValidSpawn(x, y, radius, ignoreId)) return { x, y };
  }

  for (let y = min; y <= maxY; y += 40) {
    for (let x = min; x <= maxX; x += 40) {
      if (isValidSpawn(x, y, radius, ignoreId)) return { x, y };
    }
  }

  // When every open spot is occupied, keep the spawn clear of walls and let
  // the normal separation check resolve on the next respawn.
  for (let y = min; y <= maxY; y += 40) {
    for (let x = min; x <= maxX; x += 40) {
      if (!checkObstacleCollision(x, y, radius)) return { x, y };
    }
  }

  return { x: min, y: min };
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

function getRandomBotProfile() {
  const profiles = GameConfig.BOT_PROFILES || [];
  return profiles[Math.floor(Math.random() * profiles.length)] || {
    id: 'default',
    name: 'BOT',
    image: null,
    buff: {}
  };
}

function getRandomMapId() {
  const mapIds = Object.keys(GameConfig.MAPS);
  return mapIds[Math.floor(Math.random() * mapIds.length)] || 'quarry';
}

function createBot(profile, index) {
  const spawn = findSafeSpawn(GameConfig.BOT_SIZE / 2);
  const buff = profile.buff || {};
  return {
    id: `bot-${profile.id}-${index}`,
    isBot: true,
    profileId: profile.id,
    name: profile.name,
    image: profile.image,
    imageFallback: profile.imageFallback || null,
    x: spawn.x,
    y: spawn.y,
    angle: 0,
    speed: Math.min(GameConfig.BOT_SPEED * (buff.speedMultiplier || 1), GameConfig.BOT_MAX_SPEED),
    projectileSpeed: GameConfig.PROJECTILE_SPEED * (buff.projectileSpeedMultiplier || 1),
    projectileDamage: GameConfig.PROJECTILE_DAMAGE * (buff.damageMultiplier || 1),
    fireCooldown: GameConfig.BOT_FIRE_COOLDOWN / (buff.fireRateMultiplier || 1),
    detectionRange: GameConfig.BOT_DETECTION_RANGE * (buff.detectionRangeMultiplier || 1),
    health: GameConfig.BOT_MAX_HEALTH * (buff.healthMultiplier || 1),
    maxHealth: GameConfig.BOT_MAX_HEALTH * (buff.healthMultiplier || 1),
    lastFired: 0,
    alive: true,
    targetX: Math.random() * GameConfig.MAP_WIDTH,
    targetY: Math.random() * GameConfig.MAP_HEIGHT,
    lastWander: Date.now()
  };
}

function createBoss() {
  const boss = GameConfig.BOSS;
  const spawn = findSafeSpawn(boss.size / 2, 'boss');
  gameState.bots.push({
    id: 'boss-round-' + gameState.round.number,
    isBot: true,
    isBoss: true,
    profileId: 'boss',
    name: boss.name,
    image: boss.image,
    x: spawn.x,
    y: spawn.y,
    angle: 0,
    size: boss.size,
    speed: boss.speed,
    projectileSpeed: GameConfig.PROJECTILE_SPEED,
    projectileDamage: boss.damage,
    fireCooldown: boss.fireCooldown,
    detectionRange: boss.detectionRange,
    health: boss.health,
    maxHealth: boss.health,
    lastFired: 0,
    alive: true,
    targetX: Math.random() * GameConfig.MAP_WIDTH,
    targetY: Math.random() * GameConfig.MAP_HEIGHT,
    lastWander: Date.now()
  });
}

/**
 * Initialize a randomized group of AI bots.
 */
function initializeBots() {
  const profiles = [...(GameConfig.BOT_PROFILES || [])].sort(() => Math.random() - 0.5);
  const minimum = Math.max(1, Math.min(GameConfig.BOT_MIN_COUNT, profiles.length));
  const maximum = Math.max(minimum, Math.min(GameConfig.BOT_MAX_COUNT, profiles.length));
  const count = minimum + Math.floor(Math.random() * (maximum - minimum + 1));

  gameState.bots = [];
  for (let index = 0; index < count; index++) {
    gameState.bots.push(createBot(profiles[index], index));
  }
}

function winningVote(votes, fallback) {
  const entries = Object.entries(votes);
  if (!entries.length) return fallback;
  entries.sort((left, right) => right[1] - left[1]);
  return entries[0][0];
}

function startRound() {
  activeMapId = getRandomMapId();
  gameState.round.mode = winningVote(modeVotes, gameState.round.mode);
  gameState.round.weapon = winningVote(weaponVotes, gameState.round.weapon || 'dualPistols');
  gameState.round.number++;
  gameState.round.startedAt = Date.now();
  gameState.round.kothTime = 0;
  gameState.round.koth = {
    x: Math.random() * GameConfig.MAP_WIDTH,
    y: Math.random() * GameConfig.MAP_HEIGHT,
    radius: 180
  };
  gameState.projectiles = [];
  gameState.powerups = [];
  gameState.explosions = [];
  generateObstacles(activeMapId);
  initializeBots();
  if (gameState.round.mode === 'bossFight') createBoss();
  Object.values(gameState.players).forEach((player, index) => {
    player.team = gameState.round.mode === 'teamDeathmatch' ? (index % 2 === 0 ? 'red' : 'blue') : null;
    const spawn = findSafeSpawn(GameConfig.PLAYER_SIZE / 2, player.id);
    player.x = spawn.x;
    player.y = spawn.y;
    player.health = player.maxHealth;
    player.weapon = gameState.round.weapon;
    player.alive = true;
  });
  Object.keys(modeVotes).forEach(key => delete modeVotes[key]);
  Object.keys(weaponVotes).forEach(key => delete weaponVotes[key]);
  io.emit('roundStarted', { round: gameState.round, mapId: activeMapId });
}

function findNearestBotTarget(bot) {
  const targets = [
    ...Object.values(gameState.players).filter(player => player.alive),
    ...gameState.bots.filter(candidate => candidate.alive && candidate.id !== bot.id)
  ];
  let nearestTarget = null;
  let nearestDistance = Infinity;

  for (const target of targets) {
    const distance = Math.hypot(target.x - bot.x, target.y - bot.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestTarget = target;
    }
  }

  return { target: nearestTarget, distance: nearestDistance };
}

function separateBot(bot) {
  const nearbyEntities = [
    ...Object.values(gameState.players).filter(player => player.alive),
    ...gameState.bots.filter(candidate => candidate.alive && candidate.id !== bot.id)
  ];
  const separationDistance = GameConfig.BOT_SEPARATION_DISTANCE;

  for (const entity of nearbyEntities) {
    const dx = bot.x - entity.x;
    const dy = bot.y - entity.y;
    const distance = Math.hypot(dx, dy);
    if (!distance || distance >= separationDistance) continue;

    const push = (separationDistance - distance) / distance;
    bot.x += dx * push * 0.35;
    bot.y += dy * push * 0.35;
  }
}

/**
 * Bot AI logic - fights the nearest living player or bot.
 */
function updateBot(bot) {
  if (!bot || !bot.alive) return;
  const now = Date.now();

  const { target: nearestTarget, distance: nearestDistance } = findNearestBotTarget(bot);

  // If an opponent is in range, move towards and shoot at them.
  if (nearestTarget && nearestDistance < bot.detectionRange) {
    const dx = nearestTarget.x - bot.x;
    const dy = nearestTarget.y - bot.y;
    const angle = Math.atan2(dy, dx);

    // Move towards player
    bot.x += Math.cos(angle) * bot.speed;
    bot.y += Math.sin(angle) * bot.speed;
    bot.angle = angle;
    
    // Check obstacle collision and revert if needed
    if (checkObstacleCollision(bot.x, bot.y, (bot.size || GameConfig.BOT_SIZE) / 2)) {
      bot.x -= Math.cos(angle) * bot.speed;
      bot.y -= Math.sin(angle) * bot.speed;
      // Pick new random target
      bot.targetX = Math.random() * GameConfig.MAP_WIDTH;
      bot.targetY = Math.random() * GameConfig.MAP_HEIGHT;
      bot.lastWander = now;
    }

    // Shoot at player
    if (now - bot.lastFired > bot.fireCooldown) {
      createProjectile(bot.x, bot.y, angle, bot.id);
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
      bot.x += Math.cos(angle) * bot.speed;
      bot.y += Math.sin(angle) * bot.speed;
      bot.angle = angle;
      
      // Check obstacle collision and revert if needed
      if (checkObstacleCollision(bot.x, bot.y, (bot.size || GameConfig.BOT_SIZE) / 2)) {
        bot.x -= Math.cos(angle) * bot.speed;
        bot.y -= Math.sin(angle) * bot.speed;
        // Pick new target
        bot.targetX = Math.random() * GameConfig.MAP_WIDTH;
        bot.targetY = Math.random() * GameConfig.MAP_HEIGHT;
        bot.lastWander = now;
      }
    }
  }

  separateBot(bot);

  // Keep bot within bounds
  const botRadius = (bot.size || GameConfig.BOT_SIZE) / 2;
  bot.x = Math.max(botRadius, Math.min(GameConfig.MAP_WIDTH - botRadius, bot.x));
  bot.y = Math.max(botRadius, Math.min(GameConfig.MAP_HEIGHT - botRadius, bot.y));
}

/**
 * Create a new projectile
 */
function createProjectile(x, y, angle, ownerId) {
  const botOwner = (ownerId.startsWith('bot-') || ownerId.startsWith('boss-'))
    ? gameState.bots.find(bot => bot.id === ownerId)
    : null;
  const owner = botOwner || gameState.players[ownerId];
  const weapon = GameConfig.WEAPONS[owner && owner.weapon] || {
    cooldown: GameConfig.FIRE_COOLDOWN,
    speed: GameConfig.PROJECTILE_SPEED,
    damage: GameConfig.PROJECTILE_DAMAGE,
    lifetime: GameConfig.PROJECTILE_LIFETIME,
    spread: 0,
    count: 1,
    size: GameConfig.PROJECTILE_SIZE
  };
  const damageMultiplier = (owner && owner.damageMultiplier || 1) * (owner && owner.doubleDamageUntil > Date.now() ? 2 : 1);
  const projectileCount = weapon.count || 1;
  for (let index = 0; index < projectileCount; index++) {
    const spread = projectileCount === 1 ? 0 : (index - (projectileCount - 1) / 2) * weapon.spread;
    const projectileAngle = angle + spread;
    gameState.projectiles.push({
    id: nextProjectileId++,
    x: x,
    y: y,
    vx: Math.cos(projectileAngle) * (botOwner ? botOwner.projectileSpeed : weapon.speed),
    vy: Math.sin(projectileAngle) * (botOwner ? botOwner.projectileSpeed : weapon.speed),
    damage: (botOwner ? botOwner.projectileDamage : weapon.damage) * damageMultiplier,
    size: weapon.size || GameConfig.PROJECTILE_SIZE,
    explosionRadius: weapon.explosionRadius || 0,
    freeze: weapon.freeze || 0,
    returning: Boolean(weapon.returning),
    ownerId: ownerId,
    createdAt: Date.now(),
    lifetime: weapon.lifetime || GameConfig.PROJECTILE_LIFETIME
    });
  }
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
        now - projectile.createdAt > projectile.lifetime) {
      return false;
    }
    
    // Remove if hits obstacle
    const obstacle = checkObstacleCollision(projectile.x, projectile.y, projectile.size / 2);
    if (obstacle) {
      if (projectile.explosionRadius) createExplosion(projectile.x, projectile.y, projectile.explosionRadius, projectile.damage, projectile.ownerId);
      if (obstacle.destructible) obstacle.health -= projectile.damage;
      if (obstacle.health <= 0) gameState.obstacles = gameState.obstacles.filter(candidate => candidate.id !== obstacle.id);
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
      const shooter = gameState.players[projectile.ownerId];
      if (gameState.round.mode === 'teamDeathmatch' && shooter && shooter.team && shooter.team === player.team) continue;

      const dx = player.x - projectile.x;
      const dy = player.y - projectile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < GameConfig.PLAYER_SIZE / 2) {
        if (!player.shieldUntil || player.shieldUntil <= Date.now()) player.health -= projectile.damage;
        if (projectile.freeze) player.frozenUntil = Math.max(player.frozenUntil || 0, Date.now() + projectile.freeze);
        if (projectile.explosionRadius) createExplosion(projectile.x, projectile.y, projectile.explosionRadius, projectile.damage, projectile.ownerId);
        
        if (player.health <= 0) {
          player.health = 0;
          player.alive = false;
          
          // Award kill to shooter
          if (projectile.ownerId.startsWith('bot-') || projectile.ownerId.startsWith('boss-')) {
            // Bot got a kill
          } else if (gameState.players[projectile.ownerId]) {
            gameState.players[projectile.ownerId].kills = (gameState.players[projectile.ownerId].kills || 0) + 1;
          }
          
          // Respawn after delay
          if (gameState.round.mode !== 'lastManStanding') {
            setTimeout(() => {
              if (gameState.players[playerId]) respawnPlayer(gameState.players[playerId]);
            }, GameConfig.PLAYER_RESPAWN_TIME);
          }
        }
        
        return false; // Remove projectile
      }
    }

    // Check collision with bots
    const targetBot = gameState.bots.find(bot => bot.alive && projectile.ownerId !== bot.id &&
      Math.hypot(bot.x - projectile.x, bot.y - projectile.y) < (bot.size || GameConfig.BOT_SIZE) / 2);

    if (targetBot) {
      const dx = targetBot.x - projectile.x;
      const dy = targetBot.y - projectile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < (targetBot.size || GameConfig.BOT_SIZE) / 2) {
        targetBot.health -= projectile.damage;
        
        if (targetBot.health <= 0) {
          targetBot.health = 0;
          targetBot.alive = false;
          
          // Award kill to shooter
          if (gameState.players[projectile.ownerId]) {
            gameState.players[projectile.ownerId].kills = (gameState.players[projectile.ownerId].kills || 0) + 1;
          }
          
          // Respawn this bot after the normal delay.
          if (!targetBot.isBoss) {
            setTimeout(() => {
              respawnBot(targetBot.id);
            }, GameConfig.PLAYER_RESPAWN_TIME);
          }
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
  applyRandomPlayerProfile(player);
  const spawn = findSafeSpawn(GameConfig.PLAYER_SIZE / 2, player.id);
  player.x = spawn.x;
  player.y = spawn.y;
  player.health = player.maxHealth;
  player.alive = true;
}

function applyRandomPlayerProfile(player) {
  const profiles = GameConfig.BOT_PROFILES || [];
  if (!profiles.length) return;
  const profile = profiles[Math.floor(Math.random() * profiles.length)];
  const buff = profile.buff || {};
  player.profileId = profile.id;
  player.image = profile.image;
  player.maxHealth = GameConfig.PLAYER_MAX_HEALTH * (buff.healthMultiplier || 1);
  player.damageMultiplier = buff.damageMultiplier || 1;
  player.speed = GameConfig.PLAYER_SPEED * (buff.speedMultiplier || 1);
}

/**
 * Respawn one bot
 */
function respawnBot(botId) {
  const bot = gameState.bots.find(candidate => candidate.id === botId);
  if (bot) {
    const spawn = findSafeSpawn((bot.size || GameConfig.BOT_SIZE) / 2, bot.id);
    bot.x = spawn.x;
    bot.y = spawn.y;
    bot.health = bot.maxHealth;
    bot.alive = true;
  }
}

/**
 * Spawn a random power-up
 */
function spawnPowerup() {
  if (gameState.powerups.length >= GameConfig.POWERUP_SPAWN_LIMIT) return;

  gameState.powerups.push({
    id: nextPowerupId++,
    x: Math.random() * (GameConfig.MAP_WIDTH - 100) + 50,
    y: Math.random() * (GameConfig.MAP_HEIGHT - 100) + 50,
    type: ['health', 'shield', 'doubleDamage'][Math.floor(Math.random() * 3)]
  });
}

function createExplosion(x, y, radius, damage, ownerId = null) {
  gameState.explosions.push({ id: nextPowerupId++, x, y, radius, createdAt: Date.now() });
  Object.values(gameState.players).forEach(player => {
    if (!player.alive || player.id === ownerId) return;
    if (Math.hypot(player.x - x, player.y - y) <= radius && !player.shieldUntil) player.health -= damage;
  });
  gameState.bots.forEach(bot => {
    if (!bot.alive || bot.id === ownerId) return;
    if (Math.hypot(bot.x - x, bot.y - y) <= radius) bot.health -= damage;
  });
}

function updateGameMode() {
  const mode = gameState.round.mode;
  const players = Object.values(gameState.players);
  if (mode === 'lastManStanding' && players.length > 1 && players.filter(player => player.alive).length <= 1) {
    startRound();
    return;
  }
  if (mode === 'bossFight' && !gameState.bots.some(bot => bot.isBoss && bot.alive)) {
    startRound();
    return;
  }
  if (mode === 'kingOfTheHill' && gameState.round.koth) {
    const inZone = players.some(player => player.alive &&
      Math.hypot(player.x - gameState.round.koth.x, player.y - gameState.round.koth.y) <= gameState.round.koth.radius);
    if (inZone) gameState.round.kothTime += 1000 / GameConfig.SERVER_TICK_RATE;
    if (gameState.round.kothTime >= GameConfig.KOTH_TARGET_TIME) startRound();
  }
}

function updateEnvironment() {
  const now = Date.now();
  gameState.explosions = gameState.explosions.filter(explosion => now - explosion.createdAt < 500);
  if (Math.random() < 1 / (GameConfig.EXPLOSION_INTERVAL / (1000 / GameConfig.SERVER_TICK_RATE))) {
    createExplosion(Math.random() * GameConfig.MAP_WIDTH, Math.random() * GameConfig.MAP_HEIGHT, 70, 20);
  }
  Object.values(gameState.players).forEach(player => {
    if (player.shieldUntil && player.shieldUntil < now) player.shieldUntil = 0;
    if (player.doubleDamageUntil && player.doubleDamageUntil < now) player.doubleDamageUntil = 0;
    if (player.frozenUntil && player.frozenUntil < now) player.frozenUntil = 0;
    const map = GameConfig.MAPS[activeMapId];
    if (map.lava && !checkObstacleCollision(player.x, player.y, GameConfig.PLAYER_SIZE / 2)) player.health -= GameConfig.LAVA_DAMAGE;
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
        if (powerup.type === 'shield') player.shieldUntil = Date.now() + GameConfig.POWERUP_DURATION;
        if (powerup.type === 'doubleDamage') player.doubleDamageUntil = Date.now() + GameConfig.POWERUP_DURATION;
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
  gameState.bots.forEach(updateBot);
  updateProjectiles();
  updatePowerups();
  updateEnvironment();
  updateGameMode();

  if (Object.keys(gameState.players).length && Date.now() - gameState.round.startedAt >= GameConfig.ROUND_DURATION) {
    startRound();
  }

  simulationTick++;
  if (simulationTick % Math.max(1, Math.round(GameConfig.SERVER_TICK_RATE / GameConfig.STATE_BROADCAST_RATE)) !== 0) return;

  // Physics remains responsive at 60 Hz while network snapshots are capped.
  io.emit('gameState', getPublicGameState());
}

function getPublicGameState() {
  return {
    mapId: activeMapId,
    players: gameState.players,
    bots: gameState.bots,
    projectiles: gameState.projectiles,
    powerups: gameState.powerups,
    obstacles: gameState.obstacles,
    explosions: gameState.explosions
    ,round: gameState.round
    ,map: GameConfig.MAPS[activeMapId]
  };
}

// Initialize game
generateObstacles();
initializeBots();

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
  socket.on('setNickname', (data) => {
    const options = typeof data === 'string' ? { nickname: data } : data;
    const nickname = options.nickname;
    const requestedMode = options.mode || gameState.round.mode;
    const selectedWeapon = GameConfig.WEAPONS[options.weapon] ? options.weapon : 'dualPistols';
    const selectedProfile = getRandomBotProfile();
    if (!GameConfig.GAME_MODES[requestedMode]) {
      socket.emit('joinRejected', 'That game mode is unavailable.');
      return;
    }
    if (Object.keys(gameState.players).length === 0) {
      activeMapId = getRandomMapId();
      gameState.round.mode = requestedMode;
      gameState.round.weapon = selectedWeapon;
      gameState.round.startedAt = Date.now();
      generateObstacles(activeMapId);
      initializeBots();
      if (requestedMode === 'bossFight') createBoss();
      if (requestedMode === 'kingOfTheHill') {
        gameState.round.koth = { x: Math.random() * GameConfig.MAP_WIDTH, y: Math.random() * GameConfig.MAP_HEIGHT, radius: 180 };
      }
    }
    modeVotes[requestedMode] = (modeVotes[requestedMode] || 0) + 1;
    weaponVotes[selectedWeapon] = (weaponVotes[selectedWeapon] || 0) + 1;
    // Sanitize nickname
    const sanitizedNickname = (nickname || 'Player').substring(0, 20).trim() || 'Player';
    
    // Create new player
    const spawn = findSafeSpawn(GameConfig.PLAYER_SIZE / 2);
    gameState.players[socket.id] = {
      id: socket.id,
      nickname: sanitizedNickname,
      x: spawn.x,
      y: spawn.y,
      angle: 0,
      health: GameConfig.PLAYER_MAX_HEALTH * (selectedProfile && selectedProfile.buff.healthMultiplier || 1),
      maxHealth: GameConfig.PLAYER_MAX_HEALTH * (selectedProfile && selectedProfile.buff.healthMultiplier || 1),
      weapon: selectedWeapon,
      profileId: selectedProfile ? selectedProfile.id : null,
      image: selectedProfile ? selectedProfile.image : null,
      damageMultiplier: selectedProfile && selectedProfile.buff.damageMultiplier || 1,
      speed: GameConfig.PLAYER_SPEED * (selectedProfile && selectedProfile.buff.speedMultiplier || 1),
      shieldUntil: 0,
      doubleDamageUntil: 0,
      frozenUntil: 0,
      team: gameState.round.mode === 'teamDeathmatch' ? (Object.keys(gameState.players).length % 2 === 0 ? 'red' : 'blue') : null,
      alive: true,
      kills: 0,
      lastFired: 0
    };

    console.log(`Player ${socket.id} joined as "${sanitizedNickname}"`);

    // Send initial game state to new player
    socket.emit('init', {
      playerId: socket.id,
      gameState: getPublicGameState()
    });
  });

  // Handle player movement
  socket.on('playerMove', (data) => {
    const player = gameState.players[socket.id];
    if (!player || !player.alive) return;

    // Update position
    const movementMultiplier = player.frozenUntil > Date.now() ? 0.25 : 1;
    let newX = player.x + data.dx * player.speed * movementMultiplier;
    let newY = player.y + data.dy * player.speed * movementMultiplier;

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
    const weapon = GameConfig.WEAPONS[player.weapon] || GameConfig.WEAPONS.dualPistols;
    if (now - player.lastFired < weapon.cooldown) return;

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

// For Vercel serverless, we need to export the http server with Socket.IO
// Vercel needs the server to handle requests
if (process.env.VERCEL) {
  module.exports = http;
} else {
  // Local development
  http.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Open the URL in multiple browser windows to play multiplayer!');
  });
  module.exports = http;
}
