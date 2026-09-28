// Banner video pause/play button (WCAG 2.2.2). With reduced motion the video never
// starts, so the button is only shown when the video is actually playing.
(function () {
  var video = document.querySelector('.hero-video');
  var button = document.querySelector('.video-toggle');
  if (!video || !button) return;

  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) return;

  var label = button.querySelector('.visually-hidden');

  function sync() {
    var paused = video.paused;
    button.setAttribute('aria-pressed', String(paused));
    label.textContent = paused ? 'Play background video' : 'Pause background video';
  }

  button.hidden = false;
  sync();
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);

  button.addEventListener('click', function () {
    if (video.paused) video.play();
    else video.pause();
  });
})();
