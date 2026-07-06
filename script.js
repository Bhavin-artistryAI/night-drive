const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");

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

let state = "idle";
let score = 0;
let best = Number(localStorage.getItem("night-drive-best") || 0);
let traffic = [];
let spawnTimer = 0.8;
let roadOffset = 0;
let lastTime = 0;
let shake = 0;

function formatDistance(value) {
  return `${Math.floor(value)}m`;
}

function updateHud() {
  scoreEl.textContent = formatDistance(score);
  bestEl.textContent = formatDistance(best);
}

function resetGame() {
  score = 0;
  traffic = [];
  spawnTimer = 0.7;
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

function startGame() {
  resetGame();
  overlay.classList.add("hidden");
  overlay.querySelector("h1").textContent = "Night Drive";
  overlay.querySelector("p").textContent = "Steer through traffic with precise lane changes. Keep your speed up, avoid collisions, and see how far you can push the car.";
  startBtn.textContent = "Restart Drive";
}

function endGame() {
  state = "over";
  best = Math.max(best, score);
  localStorage.setItem("night-drive-best", String(Math.floor(best)));
  updateHud();
  overlay.classList.remove("hidden");
  overlay.querySelector("h1").textContent = "Crash";
  overlay.querySelector("p").textContent = `You covered ${Math.floor(score)}m before the impact. Start again and beat your best run.`;
  startBtn.textContent = "Try Again";
}

function spawnTraffic() {
  const lane = Math.floor(Math.random() * lanePositions.length);
  const chosenLane = lane === player.lane ? (lane + 1) % lanePositions.length : lane;
  traffic.push({
    x: lanePositions[chosenLane],
    y: -90,
    width: 42,
    height: 74,
    speed: 220 + Math.random() * 160,
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

  roadOffset = (roadOffset + dt * 340) % 60;
  score += dt * 90;
  updateHud();

  player.speed = Math.min(10, player.speed + dt * 1.2);
  player.vx += (player.targetX - player.x) * dt * 7;
  player.vx *= 0.8;
  player.x += player.vx * dt * 8;

  if (Math.abs(player.targetX - player.x) < 1.5) {
    player.x = player.targetX;
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnTraffic();
    spawnTimer = Math.max(0.32, 0.78 - score / 1400);
  }

  traffic.forEach((car) => {
    car.y += (car.speed + player.speed * 32) * dt;
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

startBtn.addEventListener("click", () => {
  startGame();
});

updateHud();
requestAnimationFrame(frame);
