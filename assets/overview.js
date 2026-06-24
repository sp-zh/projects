function scoreColor(score) {
  return ['#eef7f8', '#d9eff1', '#bfe2e6', '#8ccdd4', '#5bb2bc'][score - 1];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  return ctx;
}

function drawOverviewHeader(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const x0 = 82;
  const y0 = 60;
  const rowH = 27;
  const labelW = 170;
  const colW = 128;
  const metaW = 142;
  const cols = ['Model', 'Constraints', 'Robustness', 'Compute'];

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#12355b';
  ctx.font = '800 16px system-ui, sans-serif';
  ctx.fillText('Overview heatmap', 22, 28);
  ctx.font = '800 12px system-ui, sans-serif';
  ctx.fillStyle = '#64707d';
  cols.forEach((col, i) => ctx.fillText(col, x0 + labelW + i * colW + 26, y0 - 12));

  ALGORITHMS.forEach(function (item, row) {
    const s = OVERVIEW_SCORES[item.slug];
    const y = y0 + row * rowH;
    ctx.fillStyle = row % 2 ? '#f8fbfc' : '#ffffff';
    ctx.fillRect(x0, y, labelW + colW * 4 + metaW, rowH - 2);
    ctx.strokeStyle = '#d9e1e8';
    ctx.strokeRect(x0, y, labelW + colW * 4 + metaW, rowH - 2);

    ctx.fillStyle = '#12355b';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText(item.title.replace(' Control', ''), x0 + 10, y + 18);

    [s.model, s.constraints, s.robustness, s.computation].forEach(function (score, i) {
      const x = x0 + labelW + i * colW;
      ctx.fillStyle = scoreColor(score);
      roundRect(ctx, x + 4, y + 4, colW - 8, rowH - 10, 6);
      ctx.fill();
      ctx.fillStyle = score >= 4 ? '#ffffff' : '#102033';
      ctx.font = '900 12px system-ui, sans-serif';
      ctx.fillText(String(score), x + 56, y + 18);
    });

    ctx.fillStyle = '#64707d';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillText(s.note, x0 + labelW + colW * 4 + 10, y + 18);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  const canvas = document.getElementById('overviewCanvas');
  if (canvas) drawOverviewHeader(canvas);

  const chart = document.getElementById('overviewChart');
  if (!chart) return;
  let html = '<div class="overview-axis"><div></div><div>Model</div><div>Constraints</div><div>Robustness</div><div>Compute</div><div></div></div>';
  ALGORITHMS.forEach(function (item) {
    const s = OVERVIEW_SCORES[item.slug];
    html += '<div class="overview-row">' +
      '<div class="overview-label"><a href="pages/' + item.slug + '.html">' + item.title + '</a><span>' + s.note + '</span></div>' +
      '<div class="overview-score score-' + s.model + '">' + s.model + '</div>' +
      '<div class="overview-score score-' + s.constraints + '">' + s.constraints + '</div>' +
      '<div class="overview-score score-' + s.robustness + '">' + s.robustness + '</div>' +
      '<div class="overview-score score-' + s.computation + '">' + s.computation + '</div>' +
      '<div class="overview-meta">' + item.family + '</div>' +
    '</div>';
  });
  chart.innerHTML = html;
});
