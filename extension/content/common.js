// funciones que se repiten en los content scripts
// esto lo escribi primero, antes de meter mano en cada sitio

var AP_SEND_EVERY_MS = 4000;
var _apLastSent = 0;
var _apLastPayloadStr = '';

function apGuessEpisode(str) {
  if (!str) return null;
  str = String(str);
  var m = str.match(/(?:epis?odio|episode|\bep\b|\be)\.?\s*[-:]?\s*(\d{1,4})/i);
  if (m) return parseInt(m[1], 10);
  m = str.match(/[-–]\s*(\d{1,4})\s*$/);
  if (m) return parseInt(m[1], 10);
  return null;
}

function apCleanTitle(t) {
  if (!t) return '';
  return t.replace(/\s+/g, ' ').replace(/^\s*ver\s+/i, '').trim();
}

function apFindMainVideo() {
  var vids = Array.prototype.slice.call(document.querySelectorAll('video'));
  if (!vids.length) return null;
  if (vids.length === 1) return vids[0];
  var best = null, bestArea = 0;
  for (var i = 0; i < vids.length; i++) {
    var r = vids[i].getBoundingClientRect();
    var area = r.width * r.height;
    if (area > bestArea) { bestArea = area; best = vids[i]; }
  }
  return best;
}

function apReport(data) {
  try {
    var payload = {
      site: data.site,
      title: data.title || null,
      episode: data.episode != null ? data.episode : null,
      paused: !!data.paused,
      hasVideo: !!data.hasVideo,
      progress: typeof data.progress === 'number' ? data.progress : null,
      url: location.href,
      ts: Date.now()
    };
    var str = payload.title + '|' + payload.episode + '|' + payload.paused + '|' + payload.hasVideo;
    var now = Date.now();
    if (str === _apLastPayloadStr && (now - _apLastSent) < AP_SEND_EVERY_MS) return;
    _apLastPayloadStr = str;
    _apLastSent = now;
    chrome.runtime.sendMessage({ type: 'ap-detect', payload: payload }, function () {
      if (chrome.runtime.lastError) { /* no hay listener del otro lado, no importa */ }
    });
  } catch (e) {
    // en teoria esto no deberia tirar nunca pero prefiero no romper la pagina del usuario
  }
}

function apWatchVideo(video, cb) {
  if (!video || video._apWatched) return;
  video._apWatched = true;
  var fire = function () {
    var dur = video.duration || 0;
    var prog = dur > 0 ? (video.currentTime / dur) : null;
    cb({ paused: video.paused, progress: prog, hasVideo: true });
  };
  video.addEventListener('play', fire);
  video.addEventListener('pause', fire);
  video.addEventListener('playing', fire);
  video.addEventListener('loadedmetadata', fire);
  video.addEventListener('timeupdate', fire);
  fire();
}
