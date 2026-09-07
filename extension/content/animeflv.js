// animeflv.js
// arranque de esto copiando crunchyroll.js y le fui sacando lo que no aplicaba,
// por eso la forma es parecida pero los selectores obvio que cambian
(function () {
  var SITE = 'animeflv';

  function scrape() {
    var docTitle = document.title || '';

    var showEl = document.querySelector('.Ficha_title, .Title, h1.Title, .anime_info_body h1');
    var showTitle = showEl ? showEl.textContent : null;

    if (!showTitle) {
      showTitle = docTitle
        .replace(/^\s*ver\s+/i, '')
        .replace(/\s*epis?odio.*$/i, '')
        .replace(/\s*-\s*animeflv.*$/i, '')
        .trim();
    }

    var epNum = apGuessEpisode(docTitle);
    if (epNum == null) {
      var m = location.pathname.match(/-(\d{1,4})\/?$/);
      if (m) epNum = parseInt(m[1], 10);
    }

    return { show: apCleanTitle(showTitle), ep: epNum };
  }

  var lastVideo = null;

  function tick() {
    var data = scrape();
    if (!data.show || data.show.length < 2) return;

    // el player de animeflv a veces esta en un iframe de otro dominio (server
    // externo), ahi no llegamos al <video>. mandamos igual titulo/episodio,
    // se pierde nomas el estado de pausa
    var video = apFindMainVideo();

    if (video && video !== lastVideo) {
      lastVideo = video;
      apWatchVideo(video, function (vstate) {
        var d2 = scrape();
        apReport({ site: SITE, title: d2.show, episode: d2.ep, paused: vstate.paused, hasVideo: true, progress: vstate.progress });
      });
    } else if (!video) {
      apReport({ site: SITE, title: data.show, episode: data.ep, paused: false, hasVideo: false, progress: null });
    }
  }

  setInterval(tick, 3000);
  tick();
})();
