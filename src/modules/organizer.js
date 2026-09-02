
function renderFilterBar() {
  const bar = document.getElementById('filterBar');
  const counts = {};
  state.animeList.forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });
  bar.innerHTML = STATUS_ORDER.map(s => {
    const active = state.filter === s;
    return '<button data-filter="' + s + '" class="filter-btn px-3.5 py-2 rounded-full text-[12px] font-semibold transition border ' +
      (active ? 'tab-active' : 'bg-white/[.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[.07]') + '">' +
      STATUS_META[s].label + ' <span class="ml-1 opacity-70">' + (counts[s] || 0) + '</span></button>';
  }).join('');
}

function renderDashboard() {
  renderFilterBar();
  const list = state.animeList.filter(a => a.status === state.filter);
  const wrap = document.getElementById('animeContainer');
  if (!list.length) {
    wrap.innerHTML = '<div class="glass edge rounded-2xl py-16 flex flex-col items-center justify-center gap-3">' +
      '<div class="w-16 h-16 rounded-2xl bg-white/[.04] flex items-center justify-center"><i data-lucide="package-open" class="w-7 h-7 text-slate-600"></i></div>' +
      '<div class="font-display font-semibold text-sm text-slate-300">No hay animes en ' + STATUS_META[state.filter].label.toLowerCase() + '</div>' +
      '<div class="text-[12px] text-slate-500 max-w-sm text-center">Busca en Explorar o usa el buscador superior para añadir tu primer anime.</div></div>';
    document.getElementById('listCount').textContent = '0 animes';
    icons();
    return;
  }
  document.getElementById('listCount').textContent = list.length + ' anime' + (list.length === 1 ? '' : 's');
  wrap.innerHTML = state.view === 'grid' ? renderGrid(list) : renderList(list);
  icons();
}

function renderGrid(list) {
  return '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">' + list.map(gridCard).join('') + '</div>';
}

function gridCard(a) {
  const pct = progressPct(a);
  const hue = hashHue(a.title);
  return '<div class="group card-hover relative rounded-2xl overflow-hidden edge bg-ink-800 shadow-lg shadow-black/30 anim-in" data-card="' + esc(a.id) + '">' +
    '<button data-action="open-detail" data-id="' + esc(a.id) + '" class="absolute inset-0 w-full h-full z-[2]" title="Ver ficha"><span class="sr-only">Detalle</span></button>' +
    '<div class="relative aspect-[2/3]" style="background:linear-gradient(150deg,hsl(' + hue + ',65%,26%),hsl(' + ((hue + 120) % 360) + ',60%,16%))">' +
      posterHtml(a).replace('poster-wrap w-full h-full rounded-xl', 'poster-wrap w-full h-full rounded-none') + airBadge(a) +
      (a.malScore ? '<span class="absolute top-2 right-2 z-[2] text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-900/80 backdrop-blur text-amber-300 no-select">★ ' + a.malScore.toFixed(1) + '</span>' : '') +
      '<div class="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/95 via-black/60 to-transparent"></div>' +
      '<div class="absolute z-[2] bottom-0 inset-x-0 p-3">' +
        '<div class="font-display font-semibold text-[13px] text-white leading-tight mb-0.5 truncate">' + esc(a.title) + '</div>' +
        '<div class="text-[10px] text-slate-400 mb-1.5 truncate">' + (a.studio ? esc(a.studio) : 'Poster') + '</div>' +
        '<div class="flex items-center gap-1.5 mb-1.5"><div class="flex-1 h-1 rounded-full bg-white/15 overflow-hidden"><div class="h-full rounded-full accent-gradient transition-[width] duration-300" style="width:' + pct + '%"></div></div>' +
        '<span class="text-[10px] text-slate-300 font-semibold no-select whitespace-nowrap">' + epText(a) + '</span></div>' +
        '<div class="mt-2 flex items-center gap-1.5 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition duration-200">' +
          '<button data-action="inc" data-id="' + esc(a.id) + '" title="+1 Episodio" class="w-8 h-8 rounded-lg bg-white/10 hover:bg-emerald-400/80 text-white backdrop-blur flex items-center justify-center transition shrink-0"><i data-lucide="plus" class="w-4 h-4"></i></button>' +
          '<button data-action="dec" data-id="' + esc(a.id) + '" title="-1 Episodio" class="w-8 h-8 rounded-lg bg-white/10 hover:bg-amber-400/80 text-white backdrop-blur flex items-center justify-center transition shrink-0"><i data-lucide="minus" class="w-4 h-4"></i></button>' +
          statusSelect(a) +
          ratingSelect(a, '0★') +
          '<button data-action="delete" data-id="' + esc(a.id) + '" title="Eliminar" class="w-8 h-8 rounded-lg bg-white/10 hover:bg-rose-500/80 text-white flex items-center justify-center transition shrink-0"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>' +
        '</div>' +
      '</div>' +
    '</div>' + statusChip(a) + '</div>';
}

function renderList(list) {
  return '<div class="glass edge rounded-2xl overflow-hidden">' +
    '<div class="overflow-x-auto"><table class="w-full text-left border-collapse min-w-[760px]">' +
    '<thead><tr class="text-[10px] uppercase tracking-wider text-slate-500 border-b border-white/5 bg-white/[.02]">' +
    '<th class="py-3 px-4 font-semibold">Anime</th><th class="py-3 px-3 font-semibold">Estado</th>' +
    '<th class="py-3 px-3 font-semibold text-center">Progreso</th><th class="py-3 px-3 font-semibold text-center">Episodios</th>' +
    '<th class="py-3 px-3 font-semibold text-center">Nota</th><th class="py-3 px-3 font-semibold text-right">Acciones</th></tr></thead><tbody>' +
    list.map(listRow).join('') + '</tbody></table></div></div>' +
    '<div class="mt-3 text-[11px] text-slate-600 text-center no-select">Tip: usa + y − para registrar episodios al instante, como en Taiga.</div>';
}

function listRow(a) {
  const pct = progressPct(a);
  const t = totalEps(a);
  return '<tr class="row-hover border-b border-white/[.04] transition">' +
    '<td class="py-2.5 px-4"><div class="flex items-center gap-3">' +
      '<button data-action="open-detail" data-id="' + esc(a.id) + '" class="relative w-11 h-[62px] rounded-lg overflow-hidden shrink-0 edge"><span class="sr-only">Detalle</span>' + posterHtml(a).replace('poster-wrap w-full h-full rounded-xl', 'poster-wrap absolute inset-0 rounded-lg') + '</button>' +
      '<div class="min-w-0"><div class="font-display font-semibold text-[13px] text-white truncate max-w-[240px]">' + esc(a.title) + '</div>' +
      '<div class="text-[11px] text-slate-500 truncate max-w-[240px]">' + (a.studio ? esc(a.studio) : '—') + (a.year ? ' · ' + a.year : '') + '</div>' +
      '<div class="flex gap-1 mt-0.5 flex-wrap">' + (a.genres || []).slice(0, 3).map(g => '<span class="text-[9px] px-1.5 py-0.5 rounded bg-white/[.06] text-slate-400">' + esc(g) + '</span>').join('') + '</div></div></div></td>' +
    '<td class="py-2.5 px-3">' + statusSelect(a) + '</td>' +
    '<td class="py-2.5 px-3"><div class="flex items-center gap-1.5 min-w-[130px]">' +
      '<button data-action="dec" data-id="' + esc(a.id) + '" ' + (a.watched > 0 ? '' : 'disabled') + ' class="w-7 h-7 rounded-lg bg-white/5 hover:bg-amber-400/80 text-slate-300 flex items-center justify-center transition shrink-0 ' + (a.watched > 0 ? '' : 'opacity-30 cursor-not-allowed') + '"><i data-lucide="minus" class="w-3.5 h-3.5"></i></button>' +
      '<button data-action="inc" data-id="' + esc(a.id) + '" class="w-7 h-7 rounded-lg bg-emerald-400/15 hover:bg-emerald-400 text-emerald-300 hover:text-white flex items-center justify-center transition shrink-0"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button>' +
      '<div class="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden"><div class="h-full rounded-full accent-gradient transition-[width] duration-300" style="width:' + pct + '%"></div></div></div></td>' +
    '<td class="py-2.5 px-3 text-center no-select"><span class="font-mono text-[13px] font-semibold text-white">' + epText(a) + '</span>' +
      (t > 0 && a.watched >= t ? '<div class="text-[9px] text-emerald-400 font-semibold">COMPLETADO</div>' : '') + '</td>' +
    '<td class="py-2.5 px-3">' + ratingSelect(a) + '</td>' +
    '<td class="py-2.5 px-3"><div class="flex items-center justify-end gap-1">' +
      '<button data-action="open-detail" data-id="' + esc(a.id) + '" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 flex items-center justify-center transition" title="Editar / notas"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>' +
      '<button data-action="delete" data-id="' + esc(a.id) + '" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-rose-500/80 text-slate-300 hover:text-white flex items-center justify-center transition" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>' +
    '</div></td></tr>';

}
