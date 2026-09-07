// generic.js
// para jkanime/tioanime, hecho rapido para que no queden afuera. si suman
// otro sitio raro probablemente entre por aca tambien, ver si vale la pena
// escribir uno especifico o dejarlo asi
(function () {
  var SITE = location.hostname.replace(/^www\./, '').split('.')[0];

  function scrape() {
    var docTitle = document.title || '';
    if (!docTitle) return { show: null, ep: null };
    var ep = apGuessEpisode(docTitle);
    var show = docTitle
      .replace(/[-–|]\s*(jkanime|tioanime).*/i, '')
      .replace(/epis?odio.*$/i, '')
      .trim();
    return { show: apCleanTitle(show), ep: ep };
  }

  var lastVideo = null;

  function tick() {
    var video = apFindMainVideo();
    if (!video) return; // sin <video> en pantalla asumimos que no estan viendo nada, listado/busqueda etc

    var data = scrape();
    if (!data.show) return;

    if (video !== lastVideo) {
      lastVideo = video;
      apWatchVideo(video, function (vstate) {
        var d2 = scrape();
        apReport({ site: SITE, title: d2.show, episode: d2.ep, paused: vstate.paused, hasVideo: true, progress: vstate.progress });
      });
    }
  }

  setInterval(tick, 3000);
  tick();
})();
