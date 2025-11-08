/**
 * Client-side game logic using p5.js
 * Handles rendering, input, and communication with server
 */

// Socket connection
let socket;

// Game state
let myPlayerId = null;
let myNickname = '';
let players = {};
let bot = null;
let projectiles = [];
let powerups = [];
let obstacles = [];

// Camera
let cameraX = 0;
let cameraY = 0;

// Input state
let keys = {};
let mouseAngle = 0;

// Sound effects
let shootSound;
let hitSound;
let powerupSound;

// Sound loaded flag
let soundsLoaded = false;

// Game started flag
let gameStarted = false;

/**
 * Join the game with nickname
 */
function joinGame() {
  const nicknameInput = document.getElementById('nicknameInput');
  myNickname = nicknameInput.value.trim() || 'Player';
  
  // Hide modal
  document.getElementById('nicknameModal').classList.add('hidden');
  
  // Send nickname to server
  if (socket && socket.connected) {
    socket.emit('setNickname', myNickname);
    gameStarted = true;
  }
}

// Make joinGame available globally
window.joinGame = joinGame;

/**
 * p5.js preload - load sounds before setup
 */
function preload() {
  // Create simple synthetic sounds using p5.sound
  // These will be generated in setup since we can't load external files
}

/**
 * p5.js setup - runs once at start
 */
function setup() {
  // Create canvas and attach to container
  let canvas = createCanvas(GameConfig.MAP_WIDTH, GameConfig.MAP_HEIGHT);
  canvas.parent('sketch-holder');
  
  // Set canvas to viewport size for better viewing
  resizeCanvas(min(windowWidth - 40, 1600), min(windowHeight - 300, 900));
  
  // Initialize synthetic sounds
  try {
    // Create oscillators for sound effects
    shootSound = new p5.Oscillator('sine');
    hitSound = new p5.Oscillator('square');
    powerupSound = new p5.Oscillator('triangle');
    soundsLoaded = true;
  } catch (e) {
    console.log('Sound initialization failed:', e);
    soundsLoaded = false;
  }
  
  // Add enter key listener for nickname input
  const nicknameInput = document.getElementById('nicknameInput');
  nicknameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      joinGame();
    }
  });
  
  // Connect to server
  socket = io();
  
  // Update status indicator
  updateStatus('Connecting...', false);
  
  // Handle socket events
  socket.on('connect', () => {
    console.log('Connected to server');
    updateStatus('Connected', true);
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateStatus('Disconnected', false);
    gameStarted = false;
  });
  
  // Receive initial game state
  socket.on('init', (data) => {
    myPlayerId = data.playerId;
    players = data.gameState.players;
    bot = data.gameState.bot;
    projectiles = data.gameState.projectiles;
    powerups = data.gameState.powerups;
    obstacles = data.gameState.obstacles;
  });
  
  // Receive game state updates
  socket.on('gameState', (data) => {
    players = data.players;
    bot = data.bot;
    projectiles = data.projectiles;
    powerups = data.powerups;
    obstacles = data.obstacles;
    updateScoreboard();
  });
}

/**
 * p5.js draw - runs every frame
 */
function draw() {
  // Show waiting screen if game hasn't started
  if (!gameStarted) {
    background(34, 47, 62);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(24);
    text('Enter your nickname to start...', width / 2, height / 2);
    return;
  }
  
  // Update camera to follow player
  if (myPlayerId && players[myPlayerId] && players[myPlayerId].alive) {
    const player = players[myPlayerId];
    cameraX = player.x - width / 2;
    cameraY = player.y - height / 2;
    
    // Keep camera within bounds
    cameraX = Math.max(0, Math.min(GameConfig.MAP_WIDTH - width, cameraX));
    cameraY = Math.max(0, Math.min(GameConfig.MAP_HEIGHT - height, cameraY));
  }
  
  // Apply camera translation
  push();
  translate(-cameraX, -cameraY);
  
  // Background
  background(34, 47, 62);
  
  // Draw grid
  drawGrid();
  
  // Draw obstacles
  drawObstacles();
  
  // Draw power-ups
  drawPowerups();
  
  // Draw projectiles
  drawProjectiles();
  
  // Draw bot
  if (bot) {
    drawCharacter(bot, GameConfig.COLORS.BOT, 'BOT');
  }
  
  // Draw players
  for (let id in players) {
    const isMe = id === myPlayerId;
    const nickname = players[id].nickname || (isMe ? 'YOU' : 'Player');
    drawCharacter(players[id], isMe ? '#2ECC71' : GameConfig.COLORS.PLAYER, nickname);
  }
  
  pop();
  
  // Handle input
  handleInput();
  
  // Draw UI elements (not affected by camera)
  drawUI();
}

/**
 * Draw grid background
 */
function drawGrid() {
  stroke(52, 73, 94);
  strokeWeight(1);
  
  // Calculate visible grid range
  const startX = Math.floor(cameraX / 50) * 50;
  const endX = Math.ceil((cameraX + width) / 50) * 50;
  const startY = Math.floor(cameraY / 50) * 50;
  const endY = Math.ceil((cameraY + height) / 50) * 50;
  
  // Vertical lines
  for (let x = startX; x <= endX; x += 50) {
    line(x, 0, x, GameConfig.MAP_HEIGHT);
  }
  
  // Horizontal lines
  for (let y = startY; y <= endY; y += 50) {
    line(0, y, GameConfig.MAP_WIDTH, y);
  }
  
  // Draw map border
  noFill();
  stroke(255, 255, 255, 100);
  strokeWeight(4);
  rect(0, 0, GameConfig.MAP_WIDTH, GameConfig.MAP_HEIGHT);
}

/**
 * Draw all obstacles
 */
function drawObstacles() {
  for (let obstacle of obstacles) {
    push();
    
    // Shadow effect
    fill(0, 0, 0, 50);
    noStroke();
    rect(obstacle.x + 5, obstacle.y + 5, obstacle.width, obstacle.height, 5);
    
    // Main obstacle
    fill(GameConfig.COLORS.OBSTACLE_FILL);
    stroke(GameConfig.COLORS.OBSTACLE_STROKE);
    strokeWeight(3);
    rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height, 5);
    
    // Add texture lines
    stroke(GameConfig.COLORS.OBSTACLE_STROKE);
    strokeWeight(1);
    const lineCount = 3;
    for (let i = 1; i <= lineCount; i++) {
      const offset = (obstacle.width / (lineCount + 1)) * i;
      line(obstacle.x + offset, obstacle.y, obstacle.x + offset, obstacle.y + obstacle.height);
    }
    
    pop();
  }
}

/**
 * Draw a character (player or bot)
 */
function drawCharacter(character, color, label) {
  if (!character.alive) {
    // Draw death animation
    push();
    translate(character.x, character.y);
    fill(255, 0, 0, 100);
    noStroke();
    ellipse(0, 0, GameConfig.PLAYER_SIZE * 1.5, GameConfig.PLAYER_SIZE * 1.5);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(12);
    text('DEAD', 0, 0);
    pop();
    return;
  }
  
  push();
  translate(character.x, character.y);
  
  // Draw body
  fill(color);
  stroke(255);
  strokeWeight(2);
  ellipse(0, 0, GameConfig.PLAYER_SIZE, GameConfig.PLAYER_SIZE);
  
  // Draw direction indicator (gun)
  rotate(character.angle);
  fill(100);
  rect(0, -3, 20, 6);
  
  pop();
  
  // Draw health bar
  drawHealthBar(character);
  
  // Draw label
  push();
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(10);
  text(label, character.x, character.y - GameConfig.PLAYER_SIZE / 2 - 25);
  pop();
}

/**
 * Draw health bar above character
 */
function drawHealthBar(character) {
  const barWidth = 40;
  const barHeight = 6;
  const barX = character.x - barWidth / 2;
  const barY = character.y - GameConfig.PLAYER_SIZE / 2 - 15;
  
  // Background
  fill(GameConfig.COLORS.HEALTH_BAR_BG);
  noStroke();
  rect(barX, barY, barWidth, barHeight, 3);
  
  // Health
  const healthPercent = character.health / character.maxHealth;
  fill(GameConfig.COLORS.HEALTH_BAR_HEALTH);
  rect(barX, barY, barWidth * healthPercent, barHeight, 3);
  
  // Border
  noFill();
  stroke(255);
  strokeWeight(1);
  rect(barX, barY, barWidth, barHeight, 3);
}

/**
 * Draw all projectiles
 */
function drawProjectiles() {
  fill(GameConfig.COLORS.PROJECTILE);
  stroke(255, 200, 0);
  strokeWeight(2);
  
  for (let projectile of projectiles) {
    ellipse(projectile.x, projectile.y, GameConfig.PROJECTILE_SIZE, GameConfig.PROJECTILE_SIZE);
  }
}

/**
 * Draw all power-ups
 */
function drawPowerups() {
  for (let powerup of powerups) {
    push();
    translate(powerup.x, powerup.y);
    
    // Pulsing animation
    let pulseSize = GameConfig.POWERUP_SIZE + sin(frameCount * 0.1) * 5;
    
    // Outer glow
    fill(GameConfig.COLORS.POWERUP_HEALTH + '44');
    noStroke();
    ellipse(0, 0, pulseSize + 10, pulseSize + 10);
    
    // Main power-up
    fill(GameConfig.COLORS.POWERUP_HEALTH);
    stroke(255);
    strokeWeight(2);
    ellipse(0, 0, pulseSize, pulseSize);
    
    // Plus symbol for health
    stroke(255);
    strokeWeight(3);
    line(-5, 0, 5, 0);
    line(0, -5, 0, 5);
    
    pop();
  }
}

/**
 * Draw UI elements (crosshair, minimap, etc.)
 */
function drawUI() {
  // Draw crosshair at mouse position
  if (myPlayerId && players[myPlayerId] && players[myPlayerId].alive) {
    push();
    stroke(255, 100, 100);
    strokeWeight(2);
    noFill();
    
    const size = 15;
    line(mouseX - size, mouseY, mouseX + size, mouseY);
    line(mouseX, mouseY - size, mouseX, mouseY + size);
    ellipse(mouseX, mouseY, size * 2, size * 2);
    
    pop();
  }
  
  // Draw minimap
  drawMinimap();
}

/**
 * Draw minimap in corner
 */
function drawMinimap() {
  const minimapSize = 200;
  const minimapPadding = 10;
  const minimapX = width - minimapSize - minimapPadding;
  const minimapY = minimapPadding;
  const scaleX = minimapSize / GameConfig.MAP_WIDTH;
  const scaleY = minimapSize / GameConfig.MAP_HEIGHT;
  
  push();
  
  // Background
  fill(0, 0, 0, 150);
  stroke(255, 255, 255, 200);
  strokeWeight(2);
  rect(minimapX, minimapY, minimapSize, minimapSize);
  
  // Draw obstacles on minimap
  noStroke();
  fill(100, 100, 100, 200);
  for (let obstacle of obstacles) {
    rect(
      minimapX + obstacle.x * scaleX,
      minimapY + obstacle.y * scaleY,
      obstacle.width * scaleX,
      obstacle.height * scaleY
    );
  }
  
  // Draw players
  for (let id in players) {
    if (!players[id].alive) continue;
    const isMe = id === myPlayerId;
    fill(isMe ? '#2ECC71' : GameConfig.COLORS.PLAYER);
    noStroke();
    ellipse(
      minimapX + players[id].x * scaleX,
      minimapY + players[id].y * scaleY,
      isMe ? 8 : 5,
      isMe ? 8 : 5
    );
  }
  
  // Draw bot
  if (bot && bot.alive) {
    fill(GameConfig.COLORS.BOT);
    ellipse(
      minimapX + bot.x * scaleX,
      minimapY + bot.y * scaleY,
      6, 6
    );
  }
  
  // Draw powerups
  fill(GameConfig.COLORS.POWERUP_HEALTH);
  for (let powerup of powerups) {
    ellipse(
      minimapX + powerup.x * scaleX,
      minimapY + powerup.y * scaleY,
      4, 4
    );
  }
  
  pop();
}

/**
 * Draw crosshair at mouse position
 */
function drawCrosshair() {
  // Moved to drawUI function
}

/**
 * Handle player input
 */
function handleInput() {
  if (!myPlayerId || !players[myPlayerId] || !players[myPlayerId].alive) return;
  
  const player = players[myPlayerId];
  
  // Calculate movement direction
  let dx = 0;
  let dy = 0;
  
  // WASD or Arrow keys
  if (keys['w'] || keys['W'] || keys['ArrowUp']) dy -= 1;
  if (keys['s'] || keys['S'] || keys['ArrowDown']) dy += 1;
  if (keys['a'] || keys['A'] || keys['ArrowLeft']) dx -= 1;
  if (keys['d'] || keys['D'] || keys['ArrowRight']) dx += 1;
  
  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    dx /= magnitude;
    dy /= magnitude;
  }
  
  // Calculate angle to mouse
  const worldMouseX = mouseX + cameraX;
  const worldMouseY = mouseY + cameraY;
  const angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
  
  // Send movement to server
  if (dx !== 0 || dy !== 0 || angle !== mouseAngle) {
    socket.emit('playerMove', { dx, dy, angle });
    mouseAngle = angle;
  }
}

/**
 * Handle key press
 */
function keyPressed() {
  keys[key] = true;
  
  // Space bar to shoot
  if (key === ' ') {
    shoot();
    return false; // Prevent page scroll
  }
}

/**
 * Handle key release
 */
function keyReleased() {
  keys[key] = false;
}

/**
 * Handle mouse press
 */
function mousePressed() {
  // Only shoot if clicking on canvas
  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
    shoot();
  }
}

/**
 * Shoot a projectile
 */
function shoot() {
  if (!myPlayerId || !players[myPlayerId] || !players[myPlayerId].alive) return;
  
  const player = players[myPlayerId];
  // Convert mouse position to world coordinates
  const worldMouseX = mouseX + cameraX;
  const worldMouseY = mouseY + cameraY;
  const angle = Math.atan2(worldMouseY - player.y, worldMouseX - player.x);
  
  socket.emit('playerShoot', { angle });
  
  // Play shoot sound
  playSound(shootSound, 200, 0.1, 0.05);
}

/**
 * Play a simple sound effect
 */
function playSound(oscillator, frequency, duration, volume = 0.1) {
  if (!soundsLoaded || !oscillator) return;
  
  try {
    oscillator.freq(frequency);
    oscillator.amp(volume);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
    }, duration * 1000);
  } catch (e) {
    // Ignore sound errors
  }
}

/**
 * Update connection status display
 */
function updateStatus(message, connected) {
  const statusEl = document.getElementById('status');
  statusEl.innerHTML = `<span class="${connected ? 'connected' : 'disconnected'}">● ${message}</span>`;
}

/**
 * Update scoreboard display
 */
function updateScoreboard() {
  const scoreList = document.getElementById('scoreList');
  
  // Collect all scores
  const scores = [];
  
  for (let id in players) {
    scores.push({
      name: players[id].nickname || 'Player',
      kills: players[id].kills || 0,
      alive: players[id].alive,
      isMe: id === myPlayerId
    });
  }
  
  // Sort by kills
  scores.sort((a, b) => b.kills - a.kills);
  
  // Display
  scoreList.innerHTML = scores.map(score => `
    <div class="score-item">
      <span>${score.isMe ? '👑 ' : ''}${score.name}${!score.alive ? ' 💀' : ''}</span>
      <span>${score.kills} kills</span>
    </div>
  `).join('');
}
