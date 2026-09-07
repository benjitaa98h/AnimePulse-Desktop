// crunchyroll.js
(function () {
  var SITE = 'crunchyroll';

  function scrapeTitleAndEp() {
    var showEl = document.querySelector('h4[class*="title"], [data-t="series-title"], .show-title-link, .heading--m');
    var epEl = document.querySelector('[data-t="episode-title"], .episode-title, h1[class*="title"]');

    var show = showEl ? showEl.textContent : null;
    var epTitleText = epEl ? epEl.textContent : null;
    var docTitle = document.title || '';
    var ep = apGuessEpisode(epTitleText) || apGuessEpisode(docTitle);

    if (!show) {
      var t = docTitle.replace(/\s*\|\s*Crunchyroll\s*$/i, '');
      t = t.replace(/^(Watch|Ver)\s+/i, '');
      t = t.replace(/\s*[-–]?\s*(Episodio|Episode)\s*\d+.*$/i, '');
      show = t;
    }

    return { show: apCleanTitle(show), ep: ep };
  }

  var lastVideo = null;

  function tick() {
    var data = scrapeTitleAndEp();
    if (!data.show) return;

    var video = apFindMainVideo();
    if (video && video !== lastVideo) {
      lastVideo = video;
      apWatchVideo(video, function (vstate) {
        var d2 = scrapeTitleAndEp();
        apReport({ site: SITE, title: d2.show, episode: d2.ep, paused: vstate.paused, hasVideo: true, progress: vstate.progress });
      });
    }

    if (!video) {
      apReport({ site: SITE, title: data.show, episode: data.ep, paused: true, hasVideo: false, progress: null });
    }
  }

  setInterval(tick, 3000);
  tick();
})();
