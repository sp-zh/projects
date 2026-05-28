function renderHome() {
  const grid = document.getElementById("algorithmGrid");
  if (grid) {
    grid.innerHTML = ALGORITHMS.map((item, index) => `
      <a class="algo-card" href="pages/${item.slug}.html">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <h3>${item.title}</h3>
        <p>${item.short}</p>
        <small>${item.family}</small>
      </a>
    `).join("");
  }

  const rows = document.getElementById("comparisonRows");
  if (rows) {
    rows.innerHTML = ALGORITHMS.map((item) => `
      <tr>
        <td><a href="pages/${item.slug}.html">${item.title}</a></td>
        <td>${item.comparison[0]}</td>
        <td>${item.comparison[2]}</td>
        <td>${item.comparison[3]}</td>
        <td>${item.comparison[4]}</td>
      </tr>
    `).join("");
  }
}

function drawAtlas() {
  const canvas = document.getElementById("atlasCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  let phase = 0;

  const nodes = ALGORITHMS.map((item, i) => ({
    label: item.title.replace(" Control", "").replace("Reinforcement Learning", "RL"),
    x: 80 + (i % 4) * 190,
    y: 70 + Math.floor(i / 4) * 120,
  }));

  function frame() {
    phase += 0.016;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#d9e1e8";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < nodes.length - 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(nodes[i].x, nodes[i].y);
      ctx.lineTo(nodes[i + 1].x, nodes[i + 1].y);
      ctx.stroke();
    }

    nodes.forEach((node, i) => {
      const pulse = 1 + 0.08 * Math.sin(phase * 3 + i);
      ctx.fillStyle = i < 4 ? "#eef7f8" : i < 8 ? "#f4f0e7" : "#f6eeee";
      ctx.strokeStyle = i < 4 ? "#007c89" : i < 8 ? "#b77a1b" : "#c65345";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 34 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#12355b";
      ctx.font = "800 14px system-ui, sans-serif";
      ctx.textAlign = "center";
      wrapLabel(ctx, node.label, node.x, node.y + 4, 82);
    });

    ctx.textAlign = "left";
    ctx.fillStyle = "#465564";
    ctx.font = "700 15px system-ui, sans-serif";
    ctx.fillText("model need →", 40, h - 28);
    ctx.save();
    ctx.translate(w - 24, h - 45);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("guarantee / computation →", 0, 0);
    ctx.restore();

    requestAnimationFrame(frame);
  }
  frame();
}

function wrapLabel(ctx, text, x, y, maxWidth) {
  const words = text.split(" ");
  let line = "";
  const lines = [];
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  lines.push(line);
  lines.forEach((part, i) => ctx.fillText(part, x, y + (i - (lines.length - 1) / 2) * 16));
}

renderHome();
drawAtlas();
