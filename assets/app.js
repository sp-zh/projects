const modes = {
  pid: {
    title: "PID",
    note: "A practical baseline: moderate overshoot, simple tuning, and visible sensitivity to saturation and noise.",
    kp: 8.5,
    ki: 2.2,
    kd: 1.3,
    ff: 0,
    damping: 0.55,
    saturation: 6,
    noise: 0.012,
  },
  ffpid: {
    title: "Feedforward + PID",
    note: "Feedforward reduces tracking burden, so the feedback loop works mainly on modeling error and disturbances.",
    kp: 6.2,
    ki: 1.4,
    kd: 1.0,
    ff: 2.4,
    damping: 0.64,
    saturation: 7,
    noise: 0.01,
  },
  notch: {
    title: "Notch / Lead-Lag",
    note: "Frequency shaping suppresses resonance and improves phase margin, but works best near the modeled frequency.",
    kp: 6.8,
    ki: 0.7,
    kd: 1.7,
    ff: 0,
    damping: 0.82,
    saturation: 6,
    noise: 0.006,
    notch: true,
  },
  lqr: {
    title: "LQR / LQI",
    note: "State-space feedback gives a clean effort-versus-error trade-off; integral action removes steady-state error.",
    kp: 9.4,
    ki: 1.6,
    kd: 2.4,
    ff: 0,
    damping: 0.9,
    saturation: 7,
    noise: 0.006,
  },
  kalman: {
    title: "Kalman Filter + LQR",
    note: "State estimation smooths sensor noise before optimal feedback, improving control effort without hiding delay risk.",
    kp: 9.0,
    ki: 1.1,
    kd: 2.0,
    ff: 0,
    damping: 0.88,
    saturation: 7,
    noise: 0.002,
    estimator: true,
  },
  mpc: {
    title: "MPC",
    note: "Constraint-aware planning limits actuator demand and avoids overshoot, at the cost of online optimization.",
    kp: 7.4,
    ki: 0.6,
    kd: 1.8,
    ff: 0.8,
    damping: 1.0,
    saturation: 3.6,
    noise: 0.004,
    constraint: true,
  },
  robust: {
    title: "H∞ / μ",
    note: "Robust designs sacrifice some speed for worst-case disturbance rejection and uncertainty tolerance.",
    kp: 6.0,
    ki: 0.8,
    kd: 2.1,
    ff: 0,
    damping: 1.12,
    saturation: 5,
    noise: 0.004,
  },
  rl: {
    title: "RL",
    note: "A learned policy can adapt nonlinear behavior, but early exploration and weak guarantees make validation central.",
    kp: 8.0,
    ki: 0.8,
    kd: 1.2,
    ff: 0.5,
    damping: 0.78,
    saturation: 6,
    noise: 0.015,
    adaptive: true,
  },
};

let currentMode = "pid";
let loopPhase = 0;

function simulate(config) {
  const dt = 0.01;
  const total = 8;
  const omega = 3.0;
  const zeta = config.damping;
  const reference = 1;
  let x = 0;
  let v = 0;
  let integral = 0;
  let previousError = 0;
  let filteredY = 0;
  const result = [];
  let effortIntegral = 0;

  for (let i = 0; i <= total / dt; i += 1) {
    const t = i * dt;
    const disturbance = t > 3.2 && t < 3.75 ? -0.8 : 0;
    const rawMeasurement = x + Math.sin(t * 31.0) * config.noise;
    filteredY = config.estimator ? filteredY * 0.88 + rawMeasurement * 0.12 : rawMeasurement;
    const measurement = config.estimator ? filteredY : rawMeasurement;
    const error = reference - measurement;
    integral += error * dt;
    integral = Math.max(-1.2, Math.min(1.2, integral));
    const derivative = (error - previousError) / dt;
    previousError = error;

    let gainScale = config.adaptive ? 0.78 + 0.22 * Math.min(1, t / 5) : 1;
    let u =
      gainScale * (config.kp * error + config.ki * integral + config.kd * derivative) +
      config.ff * reference;

    if (config.notch) {
      u -= 0.42 * Math.sin(t * 18) * Math.exp(-0.35 * t);
    }
    if (config.constraint) {
      const predicted = x + 0.42 * v;
      if (predicted > 0.96) u -= 1.8 * (predicted - 0.96);
    }

    u = Math.max(-config.saturation, Math.min(config.saturation, u));
    const acceleration = omega * omega * (u / 5 + disturbance - x) - 2 * zeta * omega * v;
    v += acceleration * dt;
    x += v * dt;
    effortIntegral += Math.abs(u) * dt;
    result.push({ t, y: x, u, r: reference });
  }

  return {
    points: result,
    metrics: calculateMetrics(result, effortIntegral),
  };
}

function calculateMetrics(points, effortIntegral) {
  const reference = 1;
  const entered10 = points.find((p) => p.y >= 0.1 * reference);
  const entered90 = points.find((p) => p.y >= 0.9 * reference);
  const peak = points.reduce((max, p) => Math.max(max, p.y), -Infinity);
  let settling = points[points.length - 1].t;
  for (let i = 0; i < points.length; i += 1) {
    const tail = points.slice(i);
    if (tail.every((p) => Math.abs(p.y - reference) <= 0.03)) {
      settling = points[i].t;
      break;
    }
  }

  return {
    rise: entered10 && entered90 ? Math.max(0, entered90.t - entered10.t) : null,
    overshoot: Math.max(0, (peak - reference) * 100),
    settling,
    effort: effortIntegral / points[points.length - 1].t,
  };
}

function drawResponse() {
  const canvas = document.getElementById("responseCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const pad = { left: 58, right: 28, top: 30, bottom: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const { points, metrics } = simulate(modes[currentMode]);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, pad, plotW, plotH);

  const xScale = (t) => pad.left + (t / 8) * plotW;
  const yScale = (y) => pad.top + (1.35 - y) / 1.75 * plotH;
  const uScale = (u) => pad.top + (1.35 - (u / 7) * 0.8) / 1.75 * plotH;

  drawLine(ctx, points, xScale, (p) => yScale(p.r), "#9aa8b4", 2, [8, 8]);
  drawLine(ctx, points, xScale, (p) => yScale(p.y), "#007c89", 4);
  drawLine(ctx, points, xScale, (p) => uScale(p.u), "#c65345", 2);

  ctx.fillStyle = "#17202a";
  ctx.font = "700 20px system-ui, sans-serif";
  ctx.fillText("Step response and control effort", pad.left, 26);
  ctx.font = "600 15px system-ui, sans-serif";
  drawLegend(ctx, width - 330, 24, "#9aa8b4", "Reference", true);
  drawLegend(ctx, width - 220, 24, "#007c89", "Output");
  drawLegend(ctx, width - 130, 24, "#c65345", "Control");

  ctx.fillStyle = "#64707d";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillText("time (s)", pad.left + plotW / 2 - 22, height - 16);
  ctx.save();
  ctx.translate(18, pad.top + plotH / 2 + 40);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("normalized output / effort", 0, 0);
  ctx.restore();

  updateMetrics(modes[currentMode], metrics);
}

function drawGrid(ctx, pad, plotW, plotH) {
  ctx.strokeStyle = "#e8eef2";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i += 1) {
    const x = pad.left + (i / 8) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
  }
  for (let i = 0; i <= 7; i += 1) {
    const y = pad.top + (i / 7) * plotH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#b8c5cf";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);
}

function drawLine(ctx, points, xScale, yScale, color, width, dash = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xScale(p.t);
    const y = yScale(p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawLegend(ctx, x, y, color, label, dashed = false) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash(dashed ? [6, 5] : []);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 28, y);
  ctx.stroke();
  ctx.fillStyle = "#465564";
  ctx.font = "700 13px system-ui, sans-serif";
  ctx.fillText(label, x + 36, y + 4);
  ctx.restore();
}

function updateMetrics(config, metrics) {
  document.getElementById("simTitle").textContent = config.title;
  document.getElementById("riseTime").textContent =
    metrics.rise === null ? "n/a" : `${metrics.rise.toFixed(2)} s`;
  document.getElementById("overshoot").textContent = `${metrics.overshoot.toFixed(1)}%`;
  document.getElementById("settling").textContent = `${metrics.settling.toFixed(2)} s`;
  document.getElementById("effort").textContent = metrics.effort.toFixed(2);
  document.getElementById("simNote").textContent = config.note;
}

function drawLoop() {
  const canvas = document.getElementById("loopCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  loopPhase += 0.018;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const blocks = [
    { x: 70, y: 145, w: 138, h: 78, label: "Reference" },
    { x: 265, y: 145, w: 138, h: 78, label: "Controller" },
    { x: 462, y: 145, w: 138, h: 78, label: "Plant" },
    { x: 462, y: 275, w: 138, h: 62, label: "Sensor" },
  ];

  ctx.strokeStyle = "#d9e1e8";
  ctx.lineWidth = 1;
  for (let i = 0; i < width; i += 36) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
  for (let i = 0; i < height; i += 36) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(width, i);
    ctx.stroke();
  }

  blocks.forEach((block) => {
    ctx.fillStyle = "#f7f9fb";
    ctx.strokeStyle = "#b8c5cf";
    ctx.lineWidth = 2;
    roundedRect(ctx, block.x, block.y, block.w, block.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#12355b";
    ctx.font = "800 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(block.label, block.x + block.w / 2, block.y + block.h / 2 + 6);
  });

  arrow(ctx, 208, 184, 265, 184, "#007c89");
  arrow(ctx, 403, 184, 462, 184, "#007c89");
  arrow(ctx, 600, 184, 650, 184, "#007c89");
  arrow(ctx, 532, 223, 532, 275, "#c65345");
  arrow(ctx, 462, 306, 334, 306, "#c65345");
  arrow(ctx, 334, 306, 334, 223, "#c65345");

  const pulseX = 220 + ((Math.sin(loopPhase) + 1) / 2) * 360;
  ctx.fillStyle = "#348f6c";
  ctx.beginPath();
  ctx.arc(pulseX, 184, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#64707d";
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("error", 224, 170);
  ctx.fillText("input", 416, 170);
  ctx.fillText("output", 620, 170);
  ctx.fillText("feedback", 345, 292);

  requestAnimationFrame(drawLoop);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
}

function arrow(ctx, x1, y1, x2, y2, color) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 11 * Math.cos(angle - Math.PI / 6), y2 - 11 * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - 11 * Math.cos(angle + Math.PI / 6), y2 - 11 * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function initButtons() {
  document.querySelectorAll(".mode").forEach((button) => {
    button.addEventListener("click", () => {
      currentMode = button.dataset.mode;
      document.querySelectorAll(".mode").forEach((b) => b.classList.remove("is-active"));
      button.classList.add("is-active");
      drawResponse();
    });
  });
}

function initNav() {
  const links = [...document.querySelectorAll(".nav-links a")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
        });
      });
    },
    { rootMargin: "-35% 0px -55% 0px", threshold: 0 },
  );
  sections.forEach((section) => observer.observe(section));
}

initButtons();
initNav();
drawResponse();
drawLoop();
