const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const playerNameEl = document.getElementById("playerName");
const playerNameInput = document.getElementById("playerNameInput");
const difficultyButtons = Array.from(document.querySelectorAll(".difficulty-btn"));
const aiMessageEl = document.getElementById("aiMessage");
const aiTipBtn = document.getElementById("aiTipBtn");

const road = {
  x: canvas.width / 2 - 140,
  y: 0,
  width: 280,
  height: canvas.height,
};

const lanePositions = [road.x + 44, road.x + 120, road.x + 196];
const player = {
  width: 44,
  height: 76,
  x: lanePositions[1],
  y: canvas.height - 120,
  targetX: lanePositions[1],
  lane: 1,
  vx: 0,
  speed: 0,
};

const difficultySettings = {
  easy: { label: "Easy", speedMultiplier: 1.0, spawnTimer: 0.8, speedBonus: 0.8, maxSpeed: 8.5 },
  medium: { label: "Medium", speedMultiplier: 1.25, spawnTimer: 0.6, speedBonus: 1.2, maxSpeed: 9.6 },
  hard: { label: "Hard", speedMultiplier: 1.55, spawnTimer: 0.42, speedBonus: 1.6, maxSpeed: 10.4 },
};

let state = "idle";
let score = 0;
let best = 0;
let traffic = [];
let spawnTimer = 0.8;
let roadOffset = 0;
let lastTime = 0;
let shake = 0;
let difficulty = "easy";
let playerName = localStorage.getItem("night-drive-player-name") || "Player";
const MESH_API_KEY = "rsk_01KX02VF3BV88S6QH6W6HWRZ3F";
const MESH_MODEL = "ai21/jamba-1-5-large-v1";

function formatDistance(value) {
  return `${Math.floor(value)}m`;
}

function sanitizeName(value) {
  const name = (value || "Player").trim();
  return name || "Player";
}

function getDifficultyConfig() {
  return difficultySettings[difficulty] || difficultySettings.easy;
}

function getBestStorageKey() {
  const safeName = sanitizeName(playerName).toLowerCase().replace(/[^a-z0-9]+/g, "_");
  return `night-drive-best-${difficulty}-${safeName}`;
}

function updateHud() {
  scoreEl.textContent = formatDistance(score);
  bestEl.textContent = formatDistance(best);
  playerNameEl.textContent = sanitizeName(playerName);
}

async function askAiCoach(prompt) {
  aiMessageEl.textContent = "Thinking...";
  try {
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MESH_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a helpful racing game coach. Give concise, encouraging tips for a browser lane-switching car game.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 60,
      }),
    });

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content || "Your coach is ready to help.";
    aiMessageEl.textContent = message.trim();
  } catch (error) {
    aiMessageEl.textContent = "AI coach is currently unavailable. Keep driving!";
  }
}

function updateDifficultyButtons() {
  difficultyButtons.forEach((button) => {
    const isActive = button.dataset.difficulty === difficulty;
    button.classList.toggle("active", isActive);
  });
}

function setDifficulty(nextDifficulty) {
  difficulty = nextDifficulty;
  updateDifficultyButtons();
  resetGame();
}

function resetGame() {
  score = 0;
  traffic = [];
  spawnTimer = getDifficultyConfig().spawnTimer;
  roadOffset = 0;
  shake = 0;
  player.lane = 1;
  player.x = lanePositions[1];
  player.targetX = lanePositions[1];
  player.vx = 0;
  player.speed = 0;
  state = "playing";
  updateHud();
}

function beginRun() {
  const defaultName = sanitizeName(playerNameInput.value || playerName);
  const enteredName = window.prompt("Enter your player name to track your score:", defaultName);
  if (enteredName === null) {
    return;
  }

  playerName = sanitizeName(enteredName);
  playerNameInput.value = playerName;
  localStorage.setItem("night-drive-player-name", playerName);
  startGame();
}

function startGame() {
  resetGame();
  overlay.classList.add("hidden");
  overlay.querySelector("h1").textContent = "Night Drive";
  overlay.querySelector("p").textContent = `Difficulty: ${getDifficultyConfig().label}. Steer through traffic with precise lane changes and see how far you can go.`;
  startBtn.textContent = "Restart Drive";
}

function endGame() {
  state = "over";
  const storageKey = getBestStorageKey();
  const previousBest = Number(localStorage.getItem(storageKey) || 0);
  if (score > previousBest) {
    localStorage.setItem(storageKey, String(Math.floor(score)));
  }
  best = Math.max(previousBest, score);
  updateHud();
  overlay.classList.remove("hidden");
  overlay.querySelector("h1").textContent = "Crash";
  overlay.querySelector("p").textContent = `${sanitizeName(playerName)} reached ${Math.floor(score)}m on ${getDifficultyConfig().label} before the impact. Start again and beat your best run.`;
  startBtn.textContent = "Try Again";
}

function spawnTraffic() {
  const lane = Math.floor(Math.random() * lanePositions.length);
  const chosenLane = lane === player.lane ? (lane + 1) % lanePositions.length : lane;
  const cfg = getDifficultyConfig();

  traffic.push({
    x: lanePositions[chosenLane],
    y: -90,
    width: 42,
    height: 74,
    speed: (220 + Math.random() * 160) * cfg.speedMultiplier,
    color: ["#ff5c7a", "#71d2ff", "#ffd46b", "#95ff9c"][Math.floor(Math.random() * 4)],
  });
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function update(dt) {
  if (state !== "playing") {
    return;
  }

  const cfg = getDifficultyConfig();
  roadOffset = (roadOffset + dt * (320 + cfg.speedBonus * 80)) % 60;
  score += dt * (80 + cfg.speedBonus * 18);
  updateHud();

  player.speed = Math.min(cfg.maxSpeed, player.speed + dt * (1.1 + cfg.speedBonus * 0.25));
  player.vx += (player.targetX - player.x) * dt * 7;
  player.vx *= 0.8;
  player.x += player.vx * dt * 8;

  if (Math.abs(player.targetX - player.x) < 1.5) {
    player.x = player.targetX;
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTraffic();
    spawnTimer = Math.max(0.24, cfg.spawnTimer - score / (1400 + cfg.speedBonus * 200));
  }

  traffic.forEach((car) => {
    car.y += (car.speed + player.speed * (20 + cfg.speedBonus * 12)) * dt;
  });

  traffic = traffic.filter((car) => car.y < canvas.height + 120);

  const playerBox = {
    x: player.x - player.width / 2 + 2,
    y: player.y - player.height / 2 + 2,
    width: player.width - 4,
    height: player.height - 4,
  };

  for (const car of traffic) {
    const carBox = {
      x: car.x - car.width / 2,
      y: car.y - car.height / 2,
      width: car.width,
      height: car.height,
    };

    if (rectsOverlap(playerBox, carBox)) {
      shake = 0.35;
      endGame();
      break;
    }
  }

  shake = Math.max(0, shake - dt * 0.8);
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#0b1830");
  sky.addColorStop(1, "#1f2740");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#49526d";
  for (let i = 0; i < 11; i += 1) {
    const y = (i * 120 + roadOffset * 0.8) % (canvas.height + 120) - 120;
    ctx.fillRect(0, y, canvas.width, 40);
  }

  ctx.fillStyle = "#121826";
  ctx.fillRect(road.x - 24, 0, road.width + 48, canvas.height);
  ctx.fillStyle = "#2b3348";
  ctx.fillRect(road.x - 6, 0, 12, canvas.height);
  ctx.fillRect(road.x + road.width - 6, 0, 12, canvas.height);

  ctx.fillStyle = "#576075";
  ctx.fillRect(road.x + 20, 0, 12, canvas.height);
  ctx.fillRect(road.x + road.width - 32, 0, 12, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 4;
  ctx.setLineDash([24, 28]);
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, -20);
  ctx.lineTo(canvas.width / 2, canvas.height + 20);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < 9; i += 1) {
    const y = i * 120 + roadOffset;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillRect(canvas.width / 2 - 4, y, 8, 44);
  }

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(road.x + 36, 0, road.width - 72, canvas.height);
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = "#6be7ff";
  ctx.beginPath();
  ctx.roundRect(-player.width / 2, -player.height / 2, player.width, player.height, 14);
  ctx.fill();

  ctx.fillStyle = "#0b1323";
  ctx.fillRect(-14, -10, 28, 18);
  ctx.fillStyle = "#f8fbff";
  ctx.fillRect(-12, -24, 8, 22);
  ctx.fillRect(4, -24, 8, 22);
  ctx.fillStyle = "#f6c75f";
  ctx.fillRect(-19, 8, 8, 18);
  ctx.fillRect(11, 8, 8, 18);
  ctx.fillStyle = "#101827";
  ctx.fillRect(-20, 18, 8, 16);
  ctx.fillRect(12, 18, 8, 16);
  ctx.restore();
}

function drawTraffic() {
  traffic.forEach((car) => {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-car.width / 2, -car.height / 2, car.width, car.height, 14);
    ctx.fill();
    ctx.fillStyle = "#0b1323";
    ctx.fillRect(-14, -8, 28, 16);
    ctx.fillStyle = "#ffd28a";
    ctx.fillRect(-18, 10, 8, 16);
    ctx.fillRect(10, 10, 8, 16);
    ctx.restore();
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * 6 * shake, (Math.random() - 0.5) * 6 * shake);
  }
  drawBackground();
  drawTraffic();
  drawPlayer();
  ctx.restore();
}

function frame(timestamp) {
  if (!lastTime) {
    lastTime = timestamp;
  }
  const dt = Math.min((timestamp - lastTime) / 1000, 0.035);
  lastTime = timestamp;

  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    event.preventDefault();
    if (state === "playing" && player.lane > 0) {
      player.lane -= 1;
      player.targetX = lanePositions[player.lane];
    }
  }

  if (key === "arrowright" || key === "d") {
    event.preventDefault();
    if (state === "playing" && player.lane < lanePositions.length - 1) {
      player.lane += 1;
      player.targetX = lanePositions[player.lane];
    }
  }
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setDifficulty(button.dataset.difficulty);
  });
});

playerNameInput.value = playerName;
playerNameInput.addEventListener("input", (event) => {
  playerName = sanitizeName(event.target.value);
  updateHud();
});

startBtn.addEventListener("click", () => {
  beginRun();
});

aiTipBtn.addEventListener("click", () => {
  const context = `The current difficulty is ${getDifficultyConfig().label}. Give one short coaching tip for this driver.`;
  askAiCoach(context);
});

updateDifficultyButtons();
updateHud();
askAiCoach("Welcome to Night Drive. Give one short coaching tip.");
requestAnimationFrame(frame);
