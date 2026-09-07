// background.js

var AP_WS_URL = 'ws://127.0.0.1:8787';
var AP_RECONNECT_MS = 4000;

var apSocket = null;
var apConnected = false;
var apTabs = {};
var apHistory = [];
var apHistoryCap = 300;
var apStorageDebounce = null;

function apHistoryAdd(p) {
  if (!p || p.paused || p.progress == null || p.progress < 0.85 || p.episode == null || !p.title) return;
  var key = p.site + '|' + p.title + '|' + p.episode;
  for (var i = 0; i < apHistory.length; i++) { if (apHistory[i].key === key) return; }
  apHistory.push({ key: key, site: p.site, title: p.title, episode: p.episode, ts: Date.now(), sent: false });
  if (apHistory.length > apHistoryCap) apHistory.splice(0, apHistory.length - apHistoryCap);
  apHistorySave();
}

function apHistorySave() {
  if (apStorageDebounce) clearTimeout(apStorageDebounce);
  apStorageDebounce = setTimeout(function () {
    try { chrome.storage.local.set({ apHistory: apHistory.slice() }); } catch (e) {}
  }, 300);
}

function apHistoryRestore() {
  try {
    chrome.storage.local.get('apHistory', function (r) {
      if (r && Array.isArray(r.apHistory)) apHistory = r.apHistory;
    });
  } catch (e) {}
}

// envia lo que quedo pendiente mientras la app estaba cerrada. no lo marca
// como enviado hasta recibir el ack de la app, asi no se pierde nada si la
// app todavia no estaba lista para recibirlo.
function apFlushHistory() {
  var pending = apHistory.filter(function (h) { return !h.sent; });
  if (!pending.length) return;
  var items = pending.map(function (h) { return { t: h.title + ' Episodio ' + h.episode, n: 'ext:' + h.site, ts: h.ts }; });
  apSend({ type: 'history', items: items });
}

function apConnect() {
  try {
    apSocket = new WebSocket(AP_WS_URL);
  } catch (e) {
    setTimeout(apConnect, AP_RECONNECT_MS);
    return;
  }

  apSocket.onopen = function () {
    apConnected = true;
    console.log('[AnimePulse ext] conectado a la app');
    apFlushHistory();
  };

  apSocket.onmessage = function (ev) {
    var m = null;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m && m.type === 'history-ack') {
      for (var i = 0; i < apHistory.length; i++) apHistory[i].sent = true;
      apHistorySave();
    }
  };

  apSocket.onclose = function () {
    apConnected = false;
    apSocket = null;
    setTimeout(apConnect, AP_RECONNECT_MS);
  };

  apSocket.onerror = function () {};
}
apConnect();

function apSend(obj) {
  if (!apConnected || !apSocket || apSocket.readyState !== 1) return false;
  try {
    apSocket.send(JSON.stringify(obj));
    return true;
  } catch (e) {
    return false;
  }
}

// arma el objeto que espera onBrowserTitles en el renderer: { t: titulo, n: origen }.
// t incluye el episodio porque episodeFromTitle() lo parsea de ahi.
function apBuildFakeTitle(p) {
  if (!p.title) return null;
  var t = p.episode != null ? p.title + ' Episodio ' + p.episode : p.title;
  return { t: t, n: 'ext:' + (p.site || 'browser') };
}

function apBroadcastToApp() {
  var titles = [];
  var detail = [];
  var now = Date.now();
  for (var id in apTabs) {
    var p = apTabs[id];
    if (!p) continue;
    if (now - p.ts > 20000) continue;
    if (p.paused) continue;
    var ft = apBuildFakeTitle(p);
    if (ft) titles.push(ft);
    detail.push(p);
  }
  apSend({ type: 'titles', titles: titles });
  apSend({ type: 'ap-detail', tabs: detail });
}

chrome.runtime.onMessage.addListener(function (msg, sender) {
  if (!msg || msg.type !== 'ap-detect') return;
  var tabId = sender.tab && sender.tab.id;
  if (tabId == null) return;
  apTabs[tabId] = msg.payload;
  apHistoryAdd(msg.payload);
});

apHistoryRestore();

chrome.tabs.onRemoved.addListener(function (tabId) {
  delete apTabs[tabId];
});

setInterval(apBroadcastToApp, 4000);
setInterval(apFlushHistory, 60000);

// esto lo agregue despues para el popup, separado del listener de arriba
// porque son cosas distintas (uno recibe datos, este otro responde a pedido)
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== 'ap-get-status') return;
  sendResponse({ connected: apConnected, tabs: apTabs });
  return true;
});
