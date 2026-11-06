/**
 * Game Configuration and Constants
 * Shared between server and client for consistency
 */

const GameConfig = {
  // Map settings
  MAP_WIDTH: 3000,
  MAP_HEIGHT: 2000,

  // Available map presets. Obstacles are generated from these settings on the server.
  MAPS: {
    quarry: {
      name: 'Quarry',
      obstacleCount: 20,
      minObstacleSize: 40,
      maxObstacleSize: 150
    },
    outpost: {
      name: 'Outpost',
      obstacleCount: 28,
      minObstacleSize: 35,
      maxObstacleSize: 110
    },
    ruins: {
      name: 'Ruins',
      obstacleCount: 14,
      minObstacleSize: 80,
      maxObstacleSize: 220
    },
    lava: {
      name: 'Lava Fields',
      obstacleCount: 12,
      minObstacleSize: 50,
      maxObstacleSize: 140,
      lava: true
    },
    darkness: {
      name: 'Darkness',
      obstacleCount: 18,
      minObstacleSize: 45,
      maxObstacleSize: 130,
      darkness: true
    }
  },
  
  // Obstacle settings
  OBSTACLE_COUNT: 20,
  OBSTACLE_MIN_SIZE: 40,
  OBSTACLE_MAX_SIZE: 150,
  
  // Player settings
  PLAYER_SIZE: 30,
  PLAYER_SPEED: 9,
  PLAYER_MAX_HEALTH: 100,
  PLAYER_RESPAWN_TIME: 3000, // milliseconds
  
  // Projectile settings
  PROJECTILE_SIZE: 8,
  PROJECTILE_SPEED: 18,
  PROJECTILE_DAMAGE: 15,
  PROJECTILE_LIFETIME: 1000, // milliseconds
  FIRE_COOLDOWN: 300, // milliseconds between shots
  WEAPONS: {
    flamethrower: { name: 'Flamethrower', cooldown: 120, speed: 10, damage: 8, lifetime: 350, spread: 0.18, count: 3, size: 12 },
    minigun: { name: 'Minigun', cooldown: 90, speed: 22, damage: 8, lifetime: 900, spread: 0.08, count: 1, size: 6 },
    boomerang: { name: 'Boomerang', cooldown: 650, speed: 13, damage: 35, lifetime: 1800, spread: 0, count: 1, size: 12, returning: true },
    freezeGun: { name: 'Freeze Gun', cooldown: 700, speed: 15, damage: 12, lifetime: 1200, spread: 0, count: 1, size: 10, freeze: 1800 },
    grenadeLauncher: { name: 'Grenade Launcher', cooldown: 1000, speed: 9, damage: 45, lifetime: 1800, spread: 0, count: 1, size: 14, explosionRadius: 90 },
    dualPistols: { name: 'Dual Pistols', cooldown: 220, speed: 20, damage: 18, lifetime: 1000, spread: 0.04, count: 2, size: 7 }
  },
  GAME_MODES: {
    teamDeathmatch: 'Team Deathmatch',
    freeForAll: 'Free for All',
    kingOfTheHill: 'King of the Hill',
    lastManStanding: 'Last Man Standing',
    bossFight: 'Boss Fight'
  },
  ROUND_DURATION: 300000,
  KOTH_TARGET_TIME: 90000,
  POWERUP_DURATION: 10000,
  POWERUP_SPAWN_LIMIT: 6,
  LAVA_DAMAGE: 0.35,
  EXPLOSION_INTERVAL: 12000,
  DARKNESS_RADIUS: 280,
  BOSS: {
    name: 'The Furnace',
    image: 'boss.jpg',
    size: 110,
    health: 1200,
    speed: 2.2,
    damage: 30,
    fireCooldown: 650,
    detectionRange: 900
  },
  
  // Bot settings
  BOT_SIZE: 50,
  BOT_SPEED: 3,
  BOT_MAX_SPEED: 5,
  BOT_MAX_HEALTH: 50,
  BOT_FIRE_COOLDOWN: 800,
  BOT_DETECTION_RANGE: 400,
  BOT_SEPARATION_DISTANCE: 110,
  BOT_WANDER_INTERVAL: 2000, // Change direction every 2 seconds
  BOT_MIN_COUNT: 2,
  BOT_MAX_COUNT: 10,
  // Tune each bot by changing these multipliers. A fireRateMultiplier above 1 fires more often.
  BOT_PROFILES: [
    {
      id: 'laurens',
      name: 'Laurens',
      image: 'Laurens.jpg',
      imageFallback: 'Laurens.jpg',
      buff: { speedMultiplier: 4.15, healthMultiplier: 1, damageMultiplier: 0.5, fireRateMultiplier: 1.1 }
    },
    {
      id: 'nicolette',
      name: 'Nicolette',
      image: 'Nicolette.png',
      buff: { speedMultiplier: 2, healthMultiplier: 1.2, damageMultiplier: 3, fireRateMultiplier: 0.9 }
    },
    {
      id: 'gea',
      name: 'Gea',
      image: 'Gea.jpg',
      buff: { speedMultiplier: 1, healthMultiplier: 1, damageMultiplier: 1.25, fireRateMultiplier: 1 }
    },
    {
      id: 'hanckmann',
      name: 'Hanckmann',
      image: 'Hanckmann.jpg',
      buff: { speedMultiplier: 1.2, healthMultiplier: 0.1, damageMultiplier: 0.5, fireRateMultiplier: 1 }
    },
    {
      id: 'warmelink',
      name: 'Warmelink',
      image: 'Warmelink.jpg',
      buff: { speedMultiplier: 0.9, healthMultiplier: 1.4, damageMultiplier: 4, fireRateMultiplier: 0.8 }
    },
    {
      id: 'rinus',
      name: 'Rinus',
      image: 'Rinus.jpg',
      buff: { speedMultiplier: 0.3, healthMultiplier: 0.9, damageMultiplier: 3, fireRateMultiplier: 1.2 }
    },
    {
      id: 'tim',
      name: 'Tim',
      image: 'Tim.jpg',
      buff: { speedMultiplier: 0.8, healthMultiplier: 0.4, damageMultiplier: 1.15, fireRateMultiplier: 1.3 }
    },
    {
      id: 'wobbes',
      name: 'Wobbes',
      image: 'Larissa.jpg',
      buff: { speedMultiplier: 1, healthMultiplier: 40, damageMultiplier: 0.01, fireRateMultiplier: 0.05 }
    },
    {
      id: 'andrea',
      name: 'Andrea',
      image: 'Andrea.jpg',
      buff: { speedMultiplier: 0.3, healthMultiplier: 40, damageMultiplier: 1.15, fireRateMultiplier: 1 }
    },
    {
      id: 'grubeltak',
      name: 'Grubeltak',
      image: 'Grubeltak.jpg',
      buff: { speedMultiplier: 0.3, healthMultiplier: 40, damageMultiplier: 1.15, fireRateMultiplier: 1.3 }
    }
  ],
  
  // Power-up settings
  POWERUP_SIZE: 20,
  POWERUP_SPAWN_INTERVAL: 10000, // 10 seconds
  POWERUP_MAX_COUNT: 3,
  POWERUP_HEALTH_RESTORE: 50,
  
  // Game settings
  SERVER_TICK_RATE: 60, // Updates per second
  STATE_BROADCAST_RATE: 20, // Network snapshots per second
  COLORS: {
    PLAYER: '#4A90E2',
    BOT: '#E74C3C',
    PROJECTILE: '#F39C12',
    HEALTH_BAR_BG: '#2C3E50',
    HEALTH_BAR_HEALTH: '#27AE60',
    POWERUP_HEALTH: '#E91E63',
    OBSTACLE_FILL: '#34495E',
    OBSTACLE_STROKE: '#2C3E50'
  }
};

// Export for Node.js (server) or browser (client)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameConfig;
}
