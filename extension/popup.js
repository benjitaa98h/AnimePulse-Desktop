// popup.js
function render(status) {
  var dot = document.getElementById('dot');
  var txt = document.getElementById('statusTxt');
  var list = document.getElementById('list');

  if (status.connected) {
    dot.classList.add('on');
    txt.textContent = 'Conectado a AnimePulse';
  } else {
    dot.classList.remove('on');
    txt.textContent = 'Sin conexión — ¿está abierta la app?';
  }

  var tabs = status.tabs || {};
  var keys = Object.keys(tabs);
  if (!keys.length) {
    list.innerHTML = '<div class="empty">No hay nada detectado ahora mismo.</div>';
    return;
  }

  var html = '';
  keys.forEach(function (k) {
    var p = tabs[k];
    if (!p || !p.title) return;
    var icon = p.paused ? '⏸' : '▶';
    var pct = (typeof p.progress === 'number' && p.progress >= 0) ? Math.round(p.progress * 100) + '%' : '--';
    html += '<div class="tab-item">' +
      '<div class="tab-title">' + icon + ' ' + escapeHtml(p.title) + (p.episode != null ? ' · Ep ' + p.episode : '') + '</div>' +
      '<div class="tab-meta">' + escapeHtml(p.site || '') + (p.hasVideo ? ' · ' + pct : ' · sin video detectado') + '</div>' +
      '</div>';
  });
  list.innerHTML = html || '<div class="empty">No hay nada detectado ahora mismo.</div>';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function refresh() {
  chrome.runtime.sendMessage({ type: 'ap-get-status' }, function (res) {
    if (chrome.runtime.lastError || !res) return;
    render(res);
  });
}

refresh();
setInterval(refresh, 2000);
