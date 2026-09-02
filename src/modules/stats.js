
function recomputeStats() {
  const by = { watching:0, plan:0, completed:0, onhold:0, dropped:0 };
  let eps = 0; const rated = []; const genres = {};
  state.animeList.forEach(a => {
    by[a.status] = (by[a.status] || 0) + 1;
    eps += a.watched || 0;
    if (a.rating != null && a.rating > 0) rated.push(a.rating);
    (a.genres || []).forEach(g => { genres[g] = (genres[g] || 0) + 1; });
  });
  const total = state.animeList.length;
  const avg = rated.length ? (rated.reduce((x, y) => x + y, 0) / rated.length).toFixed(1) : '—';
  const days = (eps * 24) / 60 / 24;
  const dStr = days < 1 ? '<1' : (Math.round(days * 10) / 10);
  document.getElementById('navCount').textContent = total;
  document.getElementById('jqTotal').textContent = total;
  document.getElementById('jqEps').textContent = eps;
  document.getElementById('jqDays').textContent = dStr;
  document.getElementById('statAnime').textContent = total;
  document.getElementById('statEps').textContent = eps;
  document.getElementById('statDays').textContent = dStr;
  document.getElementById('statAvg').textContent = avg;
  document.getElementById('distWatching').textContent = by.watching;
  document.getElementById('distCompleted').textContent = by.completed;
  document.getElementById('distPlan').textContent = by.plan;
  const col = { watching:'#34d399', plan:'#38bdf8', completed:'#a78bfa', onhold:'#fbbf24', dropped:'#fb7185' };
  const totalCount = Math.max(1, total);
  const db = document.getElementById('distBar');
  if (db) {
    db.innerHTML = STATUS_ORDER.map(s => by[s] ? '<div style="width:' + (by[s] / totalCount * 100) + '%;background:' + col[s] + '" title="' + STATUS_META[s].label + ': ' + by[s] + '" class="h-full"></div>' : '').join('');
  }
  const deck = document.getElementById('genreDeck');
  if (deck) {
    const sorted = Object.entries(genres).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...sorted.map(g => g[1]));
    deck.innerHTML = sorted.length ? sorted.map(g => {
      const hue = hashHue(g[0]);
      return '<div class="flex items-center gap-3 p-2.5 rounded-xl bg-white/[.03] hover:bg-white/[.06] transition">' +
        '<span class="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-[11px] text-white shrink-0" style="background:hsla(' + hue + ',70%,55%,.22);color:hsl(' + hue + ',80%,70%)">' + initials(g[0]) + '</span>' +
        '<div class="flex-1 min-w-0"><div class="flex justify-between text-[12px] mb-1"><span class="text-slate-300 truncate">' + esc(g[0]) + '</span><span class="font-semibold text-white ml-2">' + g[1] + '</span></div>' +
        '<div class="h-1.5 rounded-full bg-white/10 overflow-hidden"><div style="width:' + Math.round(g[1] / max * 100) + '%;background:linear-gradient(90deg,hsl(' + hue + ',80%,60%),hsl(' + ((hue + 60) % 360) + ',80%,60%))" class="h-full rounded-full"></div></div></div></div>';
    }).join('') : '<div class="text-[12px] text-slate-500 py-4 text-center col-span-full">Sin datos de géneros todavía.</div>';
  }
  drawActivity();
  renderFilterBar();
}

const DAY_LABELS = { monday:'LUN', tuesday:'MAR', wednesday:'MIÉ', thursday:'JUE', friday:'VIE', saturday:'SÁB', sunday:'DOM' };

function drawActivity() {
  const c = document.getElementById('activityChart');
  if (!c || !c.getContext) return;
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = c.parentElement.clientWidth || 640, H = 220;
  c.width = W * dpr; c.height = H * dpr; c.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const padL = 34, padR = 12, padT = 16, padB = 30;
  const data = state.activity;
  const max = Math.max(1, ...data);
  const bw = (W - padL - padR) / data.length;
  const block = Math.min(bw * 0.55, 44);
  const now = new Date();
  const total = data.reduce((a, b) => a + b, 0);
  document.getElementById('activityTotal').textContent = total + ' episodios esta semana';
  const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
  grad.addColorStop(0, 'rgba(236,72,153,.9)');
  grad.addColorStop(1, 'rgba(139,92,246,.55)');
  ctx.textAlign = 'right'; ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.35)';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = Math.round(max / steps * i);
    const y = H - padB - (val / max) * (H - padB - padT);
    ctx.fillText(val, padL - 8, y + 3);
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
  }
  data.forEach((v, i) => {
    const x = padL + i * bw + (bw - block) / 2;
    const h = (v / max) * (H - padB - padT);
    const y = H - padB - h;
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, block, h, [6, 6, 0, 0]); else ctx.rect(x, y, block, h);
    ctx.fill();
    const d = new Date(now); d.setDate(now.getDate() - (6 - i));
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillText(d.toLocaleDateString('es', { weekday:'short' }), x + block / 2, H - padB + 16);
    if (i === data.length - 1) {
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = 'bold 10px Inter, sans-serif';
      ctx.fillText(v, x + block / 2, y - 6); ctx.font = '10px Inter, sans-serif';
    }
  });
}
