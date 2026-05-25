const SERVER_URL = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'ws://localhost:3000' : 'wss://your-app.onrender.com';
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const lobby = document.getElementById('screen-lobby');
const death = document.getElementById('screen-death');
const nameInput = document.getElementById('player-name');
const playButton = document.getElementById('play-button');
const againButton = document.getElementById('again-button');
const highscoreText = document.getElementById('lobby-highscore');
const finalScoreText = document.getElementById('final-score');
const killedByText = document.getElementById('killed-by');
const newHighscoreText = document.getElementById('new-highscore');
const themeButtons = document.querySelectorAll('.theme-card');

class Renderer {
  constructor(context) {
    this.ctx = context;
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.centerX = Math.round(this.width / 2);
    this.centerY = Math.round(this.height / 2);
    canvas.width = this.width;
    canvas.height = this.height;
  }

  draw(state) {
    const context = this.ctx;
    const player = state.snakes[state.selfId];
    let cameraX = this.centerX;
    let cameraY = this.centerY;
    if (player && player.segments.length) {
      cameraX = lerp(player.renderX, player.segments[0].x, 0.35);
      cameraY = lerp(player.renderY, player.segments[0].y, 0.35);
      player.renderX = cameraX;
      player.renderY = cameraY;
    }
    const camLeft = cameraX - this.centerX;
    const camRight = cameraX + this.centerX;
    const camTop = cameraY - this.centerY;
    const camBottom = cameraY + this.centerY;
    context.clearRect(0, 0, this.width, this.height);
    context.save();
    context.translate(Math.round(-cameraX + this.centerX), Math.round(-cameraY + this.centerY));
    this.drawGrid(context, state, camLeft, camRight, camTop, camBottom);
    this.drawFood(context, state, camLeft, camRight, camTop, camBottom);
    this.drawSnakes(context, state, camLeft, camRight, camTop, camBottom);
    context.restore();
    this.drawHud(context, state);
  }

  drawGrid(context, state, left, right, top, bottom) {
    context.fillStyle = state.theme.background;
    context.fillRect(Math.round(left), Math.round(top), this.width, this.height);
    context.strokeStyle = state.theme.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = Math.floor(left / 50) * 50; x < right; x += 50) {
      context.moveTo(Math.round(x), Math.round(top));
      context.lineTo(Math.round(x), Math.round(bottom));
    }
    for (let y = Math.floor(top / 50) * 50; y < bottom; y += 50) {
      context.moveTo(Math.round(left), Math.round(y));
      context.lineTo(Math.round(right), Math.round(y));
    }
    context.stroke();
  }

  drawFood(context, state, left, right, top, bottom) {
    for (const color in state.foodByColor) {
      context.fillStyle = color;
      context.beginPath();
      const items = state.foodByColor[color];
      for (let i = 0; i < items.length; i++) {
        const food = items[i];
        if (food.x < left - 20 || food.x > right + 20 || food.y < top - 20 || food.y > bottom + 20) continue;
        context.moveTo(Math.round(food.x + food.radius), Math.round(food.y));
        context.arc(Math.round(food.x), Math.round(food.y), food.radius, 0, Math.PI * 2);
      }
      context.fill();
    }
  }

  drawSnakes(context, state, left, right, top, bottom) {
    for (const id in state.snakes) {
      const snake = state.snakes[id];
      if (!snake.alive) continue;
      const radius = 6 + Math.min(snake.segments.length / 30, 1) * 10;
      context.fillStyle = snake.color;
      for (let i = snake.segments.length - 1; i >= 0; i--) {
        const segment = snake.segments[i];
        const x = lerp(segment.renderX, segment.x, 0.35);
        const y = lerp(segment.renderY, segment.y, 0.35);
        segment.renderX = x;
        segment.renderY = y;
        if (x < left - 20 || x > right + 20 || y < top - 20 || y > bottom + 20) continue;
        context.beginPath();
        context.arc(Math.round(x), Math.round(y), radius, 0, Math.PI * 2);
        context.fill();
      }
      if (snake.segments.length) this.drawHead(context, snake, radius * 1.2);
    }
  }

  drawHead(context, snake, radius) {
    const head = snake.segments[0];
    const x = Math.round(head.renderX);
    const y = Math.round(head.renderY);
    context.fillStyle = snake.color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    const eyeX = Math.cos(snake.angle + Math.PI / 2) * radius * 0.38;
    const eyeY = Math.sin(snake.angle + Math.PI / 2) * radius * 0.38;
    const frontX = Math.cos(snake.angle) * radius * 0.45;
    const frontY = Math.sin(snake.angle) * radius * 0.45;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(Math.round(x + frontX + eyeX), Math.round(y + frontY + eyeY), 3, 0, Math.PI * 2);
    context.arc(Math.round(x + frontX - eyeX), Math.round(y + frontY - eyeY), 3, 0, Math.PI * 2);
    context.fill();
  }

  drawHud(context, state) {
    const player = state.snakes[state.selfId];
    context.fillStyle = '#ffffff';
    context.font = '18px Arial';
    context.fillText('Length: ' + (player ? player.segments.length : 0), 20, this.height - 24);
    context.fillText('Map', 20, 28);
    context.strokeStyle = '#ffffff';
    context.strokeRect(20, 38, 100, 100);
    for (const id in state.snakes) {
      const snake = state.snakes[id];
      if (!snake.alive || !snake.segments.length) continue;
      context.fillStyle = id === state.selfId ? '#ffffff' : snake.color;
      context.fillRect(20 + snake.segments[0].x / state.mapSize * 100 - 2, 38 + snake.segments[0].y / state.mapSize * 100 - 2, 4, 4);
    }
    context.textAlign = 'right';
    context.fillStyle = '#ffffff';
    context.fillText('Leaderboard', this.width - 20, 28);
    for (let i = 0; i < state.leaderboard.length && i < 10; i++) {
      const row = state.leaderboard[i];
      context.fillStyle = row.id === state.selfId ? '#facc15' : '#ffffff';
      context.fillText((i + 1) + '. ' + row.name + ' ' + row.length, this.width - 20, 54 + i * 22);
    }
    context.textAlign = 'left';
  }
}

const THEMES = {
  classic: { background: '#07111f', grid: 'rgba(255,255,255,0.07)', snake: '#34d399', food: ['#f87171', '#facc15', '#60a5fa'] },
  neon: { background: '#080014', grid: 'rgba(236,72,153,0.16)', snake: '#22d3ee', food: ['#f0abfc', '#a3e635', '#fb7185'] },
  pastel: { background: '#1f2937', grid: 'rgba(255,255,255,0.08)', snake: '#f9a8d4', food: ['#bfdbfe', '#bbf7d0', '#fde68a'] },
  ocean: { background: '#082f49', grid: 'rgba(125,211,252,0.14)', snake: '#38bdf8', food: ['#99f6e4', '#fef08a', '#c4b5fd'] },
  desert: { background: '#3b2306', grid: 'rgba(251,191,36,0.12)', snake: '#fb923c', food: ['#fef3c7', '#fdba74', '#bef264'] }
};

const renderer = new Renderer(ctx);
const state = { selfId: null, mapSize: 3000, snakes: {}, food: [], foodByColor: {}, leaderboard: [], theme: THEMES.classic };
let socket = null;
let selectedTheme = localStorage.getItem('slither_theme') || 'classic';
let lastInputAt = 0;
let localMode = false;
let localSnake = null;
let animationStarted = false;

function lerp(a, b, t) {
  return a == null ? b : a + (b - a) * t;
}

function showScreen(name) {
  lobby.classList.toggle('hidden', name !== 'lobby');
  death.classList.toggle('hidden', name !== 'death');
  canvas.style.display = name === 'game' ? 'block' : 'none';
  if (name === 'lobby') highscoreText.textContent = 'High score: ' + (localStorage.getItem('slither_highscore') || '0');
}

function rebuildFoodGroups() {
  state.foodByColor = {};
  for (let i = 0; i < state.food.length; i++) {
    const food = state.food[i];
    if (!state.foodByColor[food.color]) state.foodByColor[food.color] = [];
    state.foodByColor[food.color].push(food);
  }
}

function startLocalFallback() {
  localMode = true;
  const color = state.theme.snake;
  localSnake = { id: 'local', name: nameInput.value || 'Player', angle: 0, speed: 4, color, alive: true, score: 10, segments: [] };
  for (let i = 0; i < 12; i++) localSnake.segments.push({ x: 1500 - i * 8, y: 1500, renderX: 1500 - i * 8, renderY: 1500 });
  localSnake.renderX = localSnake.segments[0].x;
  localSnake.renderY = localSnake.segments[0].y;
  state.selfId = 'local';
  state.snakes = { local: localSnake };
  state.food = [];
  for (let i = 0; i < 250; i++) state.food.push({ id: 'f' + i, x: Math.random() * state.mapSize, y: Math.random() * state.mapSize, color: state.theme.food[i % state.theme.food.length], value: 1, radius: 5 });
  rebuildFoodGroups();
  showScreen('game');
}

function connect() {
  localMode = false;
  socket = new WebSocket(SERVER_URL);
  socket.onopen = function () {
    socket.send(JSON.stringify({ type: 'join', name: nameInput.value.slice(0, 16) || 'Player', theme: selectedTheme }));
  };
  socket.onmessage = function (event) {
    const message = JSON.parse(event.data);
    if (message.type === 'init') {
      state.selfId = message.selfId;
      state.mapSize = message.mapSize;
      state.snakes = {};
      for (let i = 0; i < message.snakes.length; i++) prepareSnake(message.snakes[i]);
      state.food = message.food;
      state.theme = THEMES[selectedTheme] || THEMES.classic;
      rebuildFoodGroups();
      showScreen('game');
    }
    if (message.type === 'delta') applyDelta(message);
    if (message.type === 'scores') state.leaderboard = message.leaderboard;
    if (message.type === 'killed') endGame(message.by || 'Unknown');
  };
  socket.onerror = startLocalFallback;
}

function prepareSnake(snake) {
  for (let i = 0; i < snake.segments.length; i++) {
    snake.segments[i].renderX = snake.segments[i].x;
    snake.segments[i].renderY = snake.segments[i].y;
  }
  snake.renderX = snake.segments[0] ? snake.segments[0].x : 0;
  snake.renderY = snake.segments[0] ? snake.segments[0].y : 0;
  state.snakes[snake.id] = snake;
}

function applyDelta(message) {
  for (let i = 0; i < message.moved.length; i++) {
    const item = message.moved[i];
    const snake = state.snakes[item.id];
    if (!snake) continue;
    snake.angle = item.angle;
    const oldHead = snake.segments[0] || item.head;
    item.head.renderX = oldHead.renderX == null ? oldHead.x : oldHead.renderX;
    item.head.renderY = oldHead.renderY == null ? oldHead.y : oldHead.renderY;
    snake.segments.unshift(item.head);
    if (!item.grow) snake.segments.pop();
  }
  for (let i = 0; i < message.died.length; i++) {
    if (state.snakes[message.died[i]]) state.snakes[message.died[i]].alive = false;
  }
  for (let i = 0; i < message.ate.length; i++) {
    const foodId = message.ate[i].foodId;
    for (let j = state.food.length - 1; j >= 0; j--) {
      if (state.food[j].id === foodId) state.food.splice(j, 1);
    }
  }
  for (let i = 0; i < message.spawned.length; i++) state.food.push(message.spawned[i]);
  rebuildFoodGroups();
}

function updateLocal() {
  if (!localSnake || !localSnake.alive) return;
  const head = localSnake.segments[0];
  const next = { x: head.x + Math.cos(localSnake.angle) * localSnake.speed, y: head.y + Math.sin(localSnake.angle) * localSnake.speed, renderX: head.renderX, renderY: head.renderY };
  localSnake.segments.unshift(next);
  localSnake.segments.pop();
  if (next.x < 0 || next.y < 0 || next.x > state.mapSize || next.y > state.mapSize) endGame('Wall');
  for (let i = 15; i < localSnake.segments.length; i++) {
    const part = localSnake.segments[i];
    if (Math.hypot(next.x - part.x, next.y - part.y) < 12) endGame('Yourself');
  }
  for (let i = state.food.length - 1; i >= 0; i--) {
    const food = state.food[i];
    if (Math.hypot(next.x - food.x, next.y - food.y) < 16) {
      state.food.splice(i, 1);
      const tail = localSnake.segments[localSnake.segments.length - 1];
      localSnake.segments.push({ x: tail.x, y: tail.y, renderX: tail.renderX, renderY: tail.renderY });
      state.food.push({ id: 'f' + Date.now(), x: Math.random() * state.mapSize, y: Math.random() * state.mapSize, color: state.theme.food[Math.floor(Math.random() * state.theme.food.length)], value: 1, radius: 5 });
      rebuildFoodGroups();
      break;
    }
  }
}

function endGame(by) {
  const player = state.snakes[state.selfId];
  const score = player ? player.segments.length : 0;
  const best = Number(localStorage.getItem('slither_highscore') || '0');
  finalScoreText.textContent = 'Final length: ' + score;
  killedByText.textContent = 'Killed by: ' + by;
  newHighscoreText.classList.toggle('hidden', score <= best);
  if (score > best) localStorage.setItem('slither_highscore', String(score));
  showScreen('death');
}

function loop() {
  if (localMode) updateLocal();
  renderer.draw(state);
  requestAnimationFrame(loop);
}

window.addEventListener('resize', renderer.resize.bind(renderer));
window.addEventListener('mousemove', function (event) {
  const now = performance.now();
  const angle = Math.atan2(event.clientY - renderer.centerY, event.clientX - renderer.centerX);
  if (localSnake) localSnake.angle = angle;
  if (socket && socket.readyState === WebSocket.OPEN && now - lastInputAt >= 16) {
    socket.send(JSON.stringify({ type: 'input', angle: angle }));
    lastInputAt = now;
  }
});
themeButtons.forEach(function (button) {
  button.classList.toggle('selected', button.dataset.theme === selectedTheme);
  button.addEventListener('click', function () {
    selectedTheme = button.dataset.theme;
    localStorage.setItem('slither_theme', selectedTheme);
    state.theme = THEMES[selectedTheme] || THEMES.classic;
    themeButtons.forEach(function (item) { item.classList.toggle('selected', item === button); });
  });
});
playButton.addEventListener('click', function () {
  state.theme = THEMES[selectedTheme] || THEMES.classic;
  connect();
  if (!animationStarted) {
    animationStarted = true;
    requestAnimationFrame(loop);
  }
});
againButton.addEventListener('click', function () {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'respawn' }));
    showScreen('game');
  } else {
    startLocalFallback();
  }
});
renderer.resize();
showScreen('lobby');
