/**
 * Game Configuration and Constants
 * Shared between server and client for consistency
 */

const GameConfig = {
  // Map settings
  MAP_WIDTH: 2000,
  MAP_HEIGHT: 1400,
  
  // Obstacle settings
  OBSTACLE_COUNT: 20,
  OBSTACLE_MIN_SIZE: 40,
  OBSTACLE_MAX_SIZE: 150,
  
  // Player settings
  PLAYER_SIZE: 30,
  PLAYER_SPEED: 5,
  PLAYER_MAX_HEALTH: 100,
  PLAYER_RESPAWN_TIME: 3000, // milliseconds
  
  // Projectile settings
  PROJECTILE_SIZE: 8,
  PROJECTILE_SPEED: 10,
  PROJECTILE_DAMAGE: 20,
  PROJECTILE_LIFETIME: 2000, // milliseconds
  FIRE_COOLDOWN: 300, // milliseconds between shots
  
  // Bot settings
  BOT_SIZE: 30,
  BOT_SPEED: 3,
  BOT_MAX_HEALTH: 150,
  BOT_FIRE_COOLDOWN: 800,
  BOT_DETECTION_RANGE: 400,
  BOT_WANDER_INTERVAL: 2000, // Change direction every 2 seconds
  
  // Power-up settings
  POWERUP_SIZE: 20,
  POWERUP_SPAWN_INTERVAL: 10000, // 10 seconds
  POWERUP_MAX_COUNT: 3,
  POWERUP_HEALTH_RESTORE: 50,
  
  // Game settings
  SERVER_TICK_RATE: 60, // Updates per second
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
