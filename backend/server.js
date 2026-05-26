const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const TICK_MS = 50;
const MAP_SIZE = 10000; // Increased battleground play area size to 10000x10000!
const CELL_SIZE = 50;
const FOOD_RADIUS = 5;
const THEMES = {
  classic: { snake: '#34d399', food: ['#f87171', '#facc15', '#60a5fa'] },
  neon: { snake: '#22d3ee', food: ['#f0abfc', '#a3e635', '#fb7185'] },
  pastel: { snake: '#f9a8d4', food: ['#bfdbfe', '#bbf7d0', '#fde68a'] },
  ocean: { snake: '#38bdf8', food: ['#99f6e4', '#fef08a', '#c4b5fd'] },
  desert: { snake: '#fb923c', food: ['#fef3c7', '#fdba74', '#bef264'] }
};

class Snake {
  constructor(id, name, x, y, color) {
    this.id = id;
    this.name = name;
    this.segments = [];
    this.angle = Math.random() * Math.PI * 2;
    this.speed = 3.0;
    this.color = color;
    this.alive = true;
    this.score = 12;
    this.grow = 0;
    this.boost = false;
    this.boostCounter = 0;
    for (let i = 0; i < 12; i++) this.segments.push({ x: x - i * 8, y });
  }

  radius() {
    return 6 + Math.min(this.segments.length / 30, 1) * 10;
  }

  move() {
    if (!this.alive) return null;
    
    // Set speed based on boost
    const canBoost = this.boost && this.segments.length > 12;
    if (canBoost) {
      this.speed = 6.0;
    } else {
      this.speed = 3.0;
    }

    const head = this.segments[0];
    const next = { x: head.x + Math.cos(this.angle) * this.speed, y: head.y + Math.sin(this.angle) * this.speed };
    this.segments.unshift(next);
    const grew = this.grow > 0;
    if (this.grow > 0) this.grow--;
    else this.segments.pop();

    if (canBoost) {
      this.boostCounter++;
      // Consume segment every 8 ticks (400ms) of boosting
      if (this.boostCounter >= 8) {
        this.boostCounter = 0;
        this.segments.pop(); // Pop tail segment
      }
    } else {
      this.boostCounter = 0;
    }

    this.score = this.segments.length;
    return { id: this.id, head: next, angle: this.angle, grow: grew };
  }
}

class Bot extends Snake {
  constructor(id, name, x, y, color) {
    super(id, name, x, y, color);
    this.state = 'ROAM';
    this.target = { x, y };
    this.targetUntil = 0;
  }

  updateAI(room) {
    const head = this.segments[0];
    let threat = null;
    let food = null;
    for (const id in room.snakes) {
      const snake = room.snakes[id];
      if (snake === this || !snake.alive || snake.segments.length <= this.segments.length) continue;
      const other = snake.segments[0];
      const dx = head.x - other.x;
      const dy = head.y - other.y;
      if (dx * dx + dy * dy < 32400) threat = other; // 180 * 180 = 32400
    }
    
    // Find closest food within 250px using spatial grid
    food = room.findNearbyFood(head.x, head.y, 250);

    if (threat) this.state = 'EVADE';
    else if (food) this.state = 'EAT';
    else this.state = 'ROAM';
    this.boost = (this.state === 'EVADE') && this.segments.length > 12;
    let targetAngle = this.angle;
    if (this.state === 'EVADE') targetAngle = Math.atan2(head.y - threat.y, head.x - threat.x) + Math.PI / 4;
    if (this.state === 'EAT') targetAngle = Math.atan2(food.y - head.y, food.x - head.x);
    if (this.state === 'ROAM') {
      const dx = head.x - this.target.x;
      const dy = head.y - this.target.y;
      if (Date.now() > this.targetUntil || dx * dx + dy * dy < 1600) { // 40 * 40 = 1600
        const range = 400 + Math.random() * 400;
        const angle = Math.random() * Math.PI * 2;
        this.target.x = clamp(head.x + Math.cos(angle) * range, 150, MAP_SIZE - 150);
        this.target.y = clamp(head.y + Math.sin(angle) * range, 150, MAP_SIZE - 150);
        this.targetUntil = Date.now() + 6000;
      }
      targetAngle = Math.atan2(this.target.y - head.y, this.target.x - head.x);
    }
    this.angle = rotateToward(this.angle, targetAngle, Math.PI / 60) + (Math.random() - 0.5) * Math.PI / 180;
  }
}

const BOT_NAMES = [
  'ProPlayer', 'Alpha', 'Nexus', 'Swift', 'Swarm', 'Viper', 'Shadow', 'Ghost', 'Blaze', 
  'Quantum', 'Phoenix', 'Cobart', 'Nebula', 'Apex', 'Raptor', 'Stinger', 'Zenith', 'Hydra', 
  'Striker', 'Titan', 'Fury', 'Goliath', 'Specter', 'Vortex', 'Pulse', 'Crimson'
];

class GameRoom {
  constructor() {
    this.snakes = {};
    this.clients = new Map();
    this.nextId = 1;
    this.lastScores = 0;
    // Spawn 25 bots to keep the giant battleground alive and populated
    for (let i = 0; i < 25; i++) this.addBot();
  }

  addClient(ws, name, theme) {
    const snake = new Snake(String(this.nextId++), cleanName(name), rand(200, MAP_SIZE - 200), rand(200, MAP_SIZE - 200), (THEMES[theme] || THEMES.classic).snake);
    this.snakes[snake.id] = snake;
    this.clients.set(ws, snake.id);
    ws.send(JSON.stringify({ type: 'init', selfId: snake.id, mapSize: MAP_SIZE, snakes: Object.values(this.snakes), food: [], config: { tickMs: TICK_MS } }));
  }

  addBot() {
    const colors = ['#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];
    const nameIndex = Math.floor(Math.random() * BOT_NAMES.length);
    const botName = BOT_NAMES[nameIndex] + ' (bot)';
    const bot = new Bot('bot-' + this.nextId++, botName, rand(200, MAP_SIZE - 200), rand(200, MAP_SIZE - 200), colors[this.nextId % colors.length]);
    this.snakes[bot.id] = bot;
  }

  respawn(ws) {
    const id = this.clients.get(ws);
    const old = this.snakes[id];
    if (!old) return;
    const snake = new Snake(id, old.name, rand(200, MAP_SIZE - 200), rand(200, MAP_SIZE - 200), old.color);
    this.snakes[id] = snake;
    ws.send(JSON.stringify({ type: 'init', selfId: id, mapSize: MAP_SIZE, snakes: Object.values(this.snakes), food: [], config: { tickMs: TICK_MS } }));
  }

  tick() {
    const moved = [];
    const died = [];
    for (const id in this.snakes) if (this.snakes[id] instanceof Bot) this.snakes[id].updateAI(this);
    for (const id in this.snakes) {
      const snake = this.snakes[id];
      const move = snake.move();
      if (move) {
        moved.push({ id: move.id, head: move.head, angle: move.angle, grow: move.grow, boost: snake.boost });
      }
    }
    this.collide(died);
    this.broadcast({ type: 'delta', moved, died });
    if (Date.now() - this.lastScores > 2000) {
      this.lastScores = Date.now();
      this.broadcast({ type: 'scores', leaderboard: this.leaderboard() });
    }
  }

  findNearbyFood(x, y, maxDistance) {
    // Return null since food is client-side. Bots roam naturally.
    return null;
  }

  collide(died) {
    const grid = new Map();
    for (const id in this.snakes) {
      const snake = this.snakes[id];
      if (!snake.alive) continue;
      for (let i = 0; i < snake.segments.length; i++) {
        const segment = snake.segments[i];
        const key = cellKey(segment.x, segment.y);
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push({ id, index: i, segment });
      }
    }
    for (const id in this.snakes) {
      const snake = this.snakes[id];
      if (!snake.alive) continue;
      const head = snake.segments[0];
      if (head.x < 0 || head.y < 0 || head.x > MAP_SIZE || head.y > MAP_SIZE) {
        this.kill(id, died, 'Wall');
        continue;
      }
      const cx = Math.floor(head.x / CELL_SIZE);
      const cy = Math.floor(head.y / CELL_SIZE);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const items = grid.get(gx + ',' + gy) || [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.id === id) continue;
            const other = this.snakes[item.id];
            if (!other || !other.alive) continue;
            const dx = head.x - item.segment.x;
            const dy = head.y - item.segment.y;
            const r = snake.radius() * 2;
            if (dx * dx + dy * dy < r * r) {
              this.kill(id, died, other.name);
              if (item.index === 0 && item.id !== id) this.kill(item.id, died, snake.name);
            }
          }
        }
      }
    }
  }

  kill(id, died, by) {
    const snake = this.snakes[id];
    if (!snake || !snake.alive) return;
    snake.alive = false;
    died.push(id);
    for (const pair of this.clients.entries()) {
      if (pair[1] === id) pair[0].send(JSON.stringify({ type: 'killed', by }));
    }
  }

  leaderboard() {
    return Object.values(this.snakes).filter(s => s.alive).sort((a, b) => b.segments.length - a.segments.length).slice(0, 10).map(s => ({ id: s.id, name: s.name, length: s.segments.length }));
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const ws of this.clients.keys()) if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cellKey(x, y) {
  return Math.floor(x / CELL_SIZE) + ',' + Math.floor(y / CELL_SIZE);
}

function rotateToward(current, target, maxStep) {
  let diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  if (diff > maxStep) diff = maxStep;
  if (diff < -maxStep) diff = -maxStep;
  return current + diff;
}

function cleanName(name) {
  return String(name || 'Player').replace(/[<>]/g, '').slice(0, 16) || 'Player';
}

const room = new GameRoom();
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Swarm IO backend');
});
const wss = new WebSocket.Server({ server, origin: '*' });
wss.on('connection', ws => {
  ws.on('message', data => {
    let message;
    try {
      message = JSON.parse(data);
    } catch (error) {
      return;
    }
    if (message.type === 'join') room.addClient(ws, message.name, message.theme);
    if (message.type === 'input') {
      const snake = room.snakes[room.clients.get(ws)];
      if (snake) {
        if (Number.isFinite(message.angle)) snake.angle = message.angle;
        if (typeof message.boost === 'boolean') snake.boost = message.boost;
      }
    }
    if (message.type === 'eat') {
      const snake = room.snakes[message.snakeId];
      if (snake && Number.isFinite(message.value)) {
        snake.grow += message.value;
      }
    }
    if (message.type === 'respawn') room.respawn(ws);
  });
  ws.on('close', () => {
    const id = room.clients.get(ws);
    room.clients.delete(ws);
    if (id && room.snakes[id]) delete room.snakes[id];
  });
});
setInterval(() => room.tick(), TICK_MS);
server.listen(PORT, () => console.log('Swarm IO server listening on ' + PORT));
