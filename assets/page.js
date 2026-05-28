function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function renderPage() {
  const item = getAlgorithm(window.PAGE_SLUG);
  const root = document.getElementById("algorithmPage");
  if (!item || !root) return;

  root.innerHTML = `
    <header class="site-header">
      <nav class="nav">
        <a class="brand" href="../index.html">Control Atlas</a>
        <div class="nav-links">
          <a href="#principle">Principle</a>
          <a href="#demo">Demo</a>
          <a href="#implementation">Code</a>
          <a href="#references">References</a>
        </div>
      </nav>
    </header>
    <main>
      <section class="detail-hero">
        <div>
          <p class="eyebrow">${item.family}</p>
          <h1>${item.title}</h1>
          <p>${item.short}</p>
          <div class="formula math">${item.formula}</div>
        </div>
        <div class="detail-card">
          <h2>Quick Read</h2>
          <dl>
            <div><dt>Model need</dt><dd>${item.comparison[2]}</dd></div>
            <div><dt>Constraint handling</dt><dd>${item.comparison[3]}</dd></div>
            <div><dt>Core risk</dt><dd>${item.comparison[4]}</dd></div>
          </dl>
        </div>
      </section>

      <section class="detail-layout" id="principle">
        <article class="content-panel">
          <p class="eyebrow">Principle</p>
          <h2>How It Works</h2>
          ${item.principle.map((paragraph) => `<p>${paragraph}</p>`).join("")}
          <h3>Design Procedure</h3>
          ${list(item.design)}
        </article>
        <aside class="content-panel compact-panel">
          <h3>Advantages</h3>
          ${list(item.advantages)}
          <h3>Limitations</h3>
          ${list(item.limitations)}
          <h3>Application Areas</h3>
          ${list(item.applications)}
        </aside>
      </section>

      <section class="section" id="demo">
        <div class="section-heading">
          <p class="eyebrow">Behavior animation</p>
          <h2>What This Controller Tends to Change</h2>
          <p id="demoCaption"></p>
        </div>
        <div class="demo-shell">
          <canvas id="detailCanvas" width="1120" height="560"></canvas>
        </div>
      </section>

      <section class="detail-layout" id="implementation">
        <article class="content-panel">
          <p class="eyebrow">Implementation</p>
          <h2>Code Sketch</h2>
          <pre><code>${escapeHtml(item.code)}</code></pre>
        </article>
        <aside class="content-panel compact-panel">
          <h3>Verification Checklist</h3>
          <ul>
            <li>Check units, signs, and sampling time.</li>
            <li>Simulate saturation, delay, noise, and sensor dropout.</li>
            <li>Validate stability margins before field testing.</li>
            <li>Log reference, output, control effort, and constraint activity.</li>
          </ul>
        </aside>
      </section>

      <section class="section" id="references">
        <div class="section-heading">
          <p class="eyebrow">Research and source references</p>
          <h2>Further Reading</h2>
        </div>
        <div class="reference-list">
          ${item.references.map((ref) => `<a href="${ref.url}" target="_blank" rel="noreferrer">${ref.text}</a>`).join("")}
        </div>
      </section>
    </main>
    <footer class="footer"><p><a href="../index.html">Back to Control Algorithms Atlas</a></p></footer>
  `;

  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise();
  }
  drawDetailDemo(item.slug);
}

function responseSeries(slug) {
  const profiles = {
    pid: { zeta: 0.43, wn: 3.0, delay: 0.0, ripple: 0.015, effort: 1.1 },
    "feedforward-pid": { zeta: 0.78, wn: 4.4, delay: -0.12, ripple: 0.006, effort: 0.82 },
    "notch-lead-lag": { zeta: 0.7, wn: 3.4, delay: 0.0, ripple: 0.035, effort: 0.9, filteredRipple: true },
    "gain-scheduling": { zeta: 0.62, wn: 2.4, delay: 0.0, ripple: 0.01, effort: 0.92, schedule: true },
    "pole-placement": { zeta: 0.72, wn: 3.8, delay: 0.0, ripple: 0.006, effort: 1.25 },
    lqr: { zeta: 0.82, wn: 3.5, delay: 0.0, ripple: 0.004, effort: 0.75 },
    lqi: { zeta: 0.76, wn: 2.7, delay: 0.0, ripple: 0.004, effort: 0.82, disturbanceReject: true },
    "kalman-lqr": { zeta: 0.82, wn: 3.3, delay: 0.0, ripple: 0.04, effort: 0.7, estimated: true },
    mpc: { zeta: 1.05, wn: 2.7, delay: 0.0, ripple: 0.002, effort: 0.55, constrained: true },
    hinf: { zeta: 0.95, wn: 2.6, delay: 0.0, ripple: 0.004, effort: 0.68, uncertainty: true },
    "mu-synthesis": { zeta: 0.9, wn: 2.5, delay: 0.0, ripple: 0.004, effort: 0.72, structured: true },
    "reinforcement-learning": { zeta: 0.55, wn: 2.2, delay: 0.0, ripple: 0.015, effort: 0.8, learning: true },
  };
  const p = profiles[slug] || profiles.pid;
  const series = [];
  const dt = 0.025;
  for (let i = 0; i <= 320; i += 1) {
    const t = i * dt;
    const tt = Math.max(0, t - Math.max(0, p.delay));
    const wd = p.wn * Math.sqrt(Math.max(0.01, 1 - p.zeta * p.zeta));
    let y = 1 - Math.exp(-p.zeta * p.wn * tt) * (Math.cos(wd * tt) + (p.zeta / Math.sqrt(Math.max(0.01, 1 - p.zeta * p.zeta))) * Math.sin(wd * tt));
    let baseline = y;

    if (p.schedule && t > 3.2) {
      y += 0.13 * Math.exp(-1.1 * (t - 3.2)) * Math.sin(7 * (t - 3.2));
    }
    if (p.disturbanceReject && t > 3.0) {
      y -= 0.18 * Math.exp(-1.25 * (t - 3.0));
    }
    if (p.constrained) {
      y = Math.min(1.015, y);
    }
    if (p.learning) {
      const improvement = 0.28 * Math.exp(-0.42 * t);
      y = 1 - (1 - y) * (1 + improvement) + 0.08 * Math.exp(-0.35 * t) * Math.sin(8 * t);
    }
    const ripple = p.filteredRipple ? p.ripple * Math.sin(20 * t) * Math.exp(-0.16 * t) : p.ripple * Math.sin(23 * t);
    const measured = y + ripple;
    const estimate = p.estimated ? y + 0.004 * Math.sin(4 * t) : null;
    const effort = p.effort * Math.exp(-0.55 * t) * Math.sin(2.6 * t + 1.1) + (p.constrained ? Math.min(0.55, 0.95 * Math.exp(-0.6 * t)) : 0);
    series.push({ t, y, baseline, measured, estimate, effort });
  }
  return series;
}

function drawDetailDemo(slug) {
  const canvas = document.getElementById("detailCanvas");
  if (!canvas) return;
  const caption = document.getElementById("demoCaption");
  const captions = {
    pid: "PID reaches the reference but shows overshoot and a relatively large initial control impulse.",
    "feedforward-pid": "Feedforward moves the response closer to the reference trajectory before feedback error builds up.",
    "notch-lead-lag": "The gray trace shows resonance-prone behavior; the teal trace shows how frequency shaping suppresses it.",
    "gain-scheduling": "The controller changes gains near an operating-point transition while keeping the output near reference.",
    "pole-placement": "Closed-loop pole choices move the response from slow modes to faster, damped modes.",
    lqr: "LQR trades tracking error against effort, producing a smooth response with moderate control activity.",
    lqi: "Integral augmentation rejects a constant disturbance and pulls the output back to reference.",
    "kalman-lqr": "Noisy measurements are filtered into a state estimate before feedback is applied.",
    mpc: "MPC approaches the reference while respecting an input constraint and avoiding overshoot.",
    hinf: "Robust control is less aggressive but keeps an uncertainty band close to the reference.",
    "mu-synthesis": "Structured uncertainty is treated explicitly; sampled plants remain bounded around the target.",
    "reinforcement-learning": "A learned policy improves over episodes, but early behavior can be uneven and needs safety limits."
  };
  caption.textContent = captions[slug] || captions.pid;

  const ctx = canvas.getContext("2d");
  const data = responseSeries(slug);
  let frame = 0;

  function draw() {
    frame = (frame + 1) % data.length;
    const w = canvas.width;
    const h = canvas.height;
    const pad = { l: 70, r: 36, t: 40, b: 62 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const x = (t) => pad.l + (t / 8) * plotW;
    const y = (v) => pad.t + (1.35 - v) / 1.75 * plotH;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    drawDemoGrid(ctx, pad, plotW, plotH);
    drawPath(ctx, data, x, (p) => y(1), "#9aa8b4", 2, [8, 8], data.length);

    if (slug === "notch-lead-lag") {
      drawPath(ctx, data, x, (p) => y(p.baseline + 0.09 * Math.sin(19 * p.t) * Math.exp(-0.1 * p.t)), "#c65345", 2, [], frame);
    }
    if (slug === "kalman-lqr") {
      drawPath(ctx, data, x, (p) => y(p.measured), "#c65345", 1.5, [], frame);
      drawPath(ctx, data, x, (p) => y(p.estimate), "#348f6c", 3, [], frame);
    } else if (slug === "hinf" || slug === "mu-synthesis") {
      drawBand(ctx, data, x, y, slug === "hinf" ? 0.065 : 0.045, frame);
      drawPath(ctx, data, x, (p) => y(p.y), "#007c89", 3.5, [], frame);
    } else {
      drawPath(ctx, data, x, (p) => y(p.y), "#007c89", 3.5, [], frame);
    }

    drawPath(ctx, data, x, (p) => y(0.18 + p.effort * 0.32), "#b77a1b", 2, [], frame);
    drawSpecialOverlay(ctx, slug, pad, plotW, plotH, frame, data);
    requestAnimationFrame(draw);
  }
  draw();
}

function drawDemoGrid(ctx, pad, plotW, plotH) {
  ctx.strokeStyle = "#e8eef2";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(pad.l + (i / 8) * plotW, pad.t);
    ctx.lineTo(pad.l + (i / 8) * plotW, pad.t + plotH);
    ctx.stroke();
  }
  for (let i = 0; i <= 7; i += 1) {
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + (i / 7) * plotH);
    ctx.lineTo(pad.l + plotW, pad.t + (i / 7) * plotH);
    ctx.stroke();
  }
  ctx.strokeStyle = "#b8c5cf";
  ctx.strokeRect(pad.l, pad.t, plotW, plotH);
  ctx.fillStyle = "#465564";
  ctx.font = "700 14px system-ui, sans-serif";
  ctx.fillText("reference / output", 18, 30);
  ctx.fillText("time", pad.l + plotW / 2, pad.t + plotH + 42);
}

function drawPath(ctx, data, xScale, yScale, color, width, dash, end) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  data.slice(0, Math.max(2, end)).forEach((p, i) => {
    const px = xScale(p.t);
    const py = yScale(p);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.restore();
}

function drawBand(ctx, data, xScale, yScale, band, end) {
  const shown = data.slice(0, Math.max(2, end));
  ctx.fillStyle = "rgba(0, 124, 137, 0.12)";
  ctx.beginPath();
  shown.forEach((p, i) => {
    const px = xScale(p.t);
    const py = yScale(p.y + band * Math.exp(-0.1 * p.t));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  shown.slice().reverse().forEach((p) => {
    ctx.lineTo(xScale(p.t), yScale(p.y - band * Math.exp(-0.1 * p.t)));
  });
  ctx.closePath();
  ctx.fill();
}

function drawSpecialOverlay(ctx, slug, pad, plotW, plotH, frame, data) {
  ctx.fillStyle = "#12355b";
  ctx.font = "800 16px system-ui, sans-serif";
  if (slug === "mpc") {
    ctx.fillText("input limit active", pad.l + plotW - 170, pad.t + 30);
    ctx.strokeStyle = "#c65345";
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + plotH * 0.19);
    ctx.lineTo(pad.l + plotW, pad.t + plotH * 0.19);
    ctx.stroke();
  }
  if (slug === "gain-scheduling") {
    const xSwitch = pad.l + (3.2 / 8) * plotW;
    ctx.fillText("gain schedule transition", xSwitch + 12, pad.t + 52);
    ctx.strokeStyle = "#c65345";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(xSwitch, pad.t);
    ctx.lineTo(xSwitch, pad.t + plotH);
    ctx.stroke();
  }
  if (slug === "reinforcement-learning") {
    const episode = 1 + Math.floor((frame / data.length) * 100);
    ctx.fillText(`policy rollout improving`, pad.l + plotW - 210, pad.t + 30);
    ctx.fillStyle = "#64707d";
    ctx.fillText(`episode signal: ${episode}`, pad.l + plotW - 210, pad.t + 55);
  }
}

renderPage();
