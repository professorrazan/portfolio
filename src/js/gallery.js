// Lightbox: opens from any gallery photo. Arrow keys navigate, Escape closes,
// swipe on touch, focus stays inside while open and returns to the photo on close.
(function () {
  var dialog = document.querySelector('.lightbox');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  var links = [].slice.call(document.querySelectorAll('.m-link'))
    .sort(function (a, b) { return a.dataset.index - b.dataset.index; });
  if (!links.length) return;

  var img = dialog.querySelector('.lb-img');
  var count = dialog.querySelector('.lb-count');
  var prevBtn = dialog.querySelector('.lb-prev');
  var nextBtn = dialog.querySelector('.lb-next');
  var closeBtn = dialog.querySelector('.lb-close');
  var current = 0;
  var opener = null;

  function sourceFor(link) {
    var source = link.querySelector('source');
    var thumb = link.querySelector('img');
    return {
      srcset: source ? source.getAttribute('srcset') : '',
      src: link.getAttribute('href'),
      alt: thumb ? thumb.getAttribute('alt') : '',
    };
  }

  function preload(i) {
    var s = sourceFor(links[(i + links.length) % links.length]);
    var pre = new Image();
    pre.sizes = '100vw';
    if (s.srcset) pre.srcset = s.srcset;
    pre.src = s.src;
  }

  function show(i) {
    current = (i + links.length) % links.length;
    var s = sourceFor(links[current]);
    img.removeAttribute('srcset');
    img.sizes = '100vw';
    if (s.srcset) img.srcset = s.srcset;
    img.src = s.src;
    img.alt = s.alt;
    count.textContent = (current + 1) + ' / ' + links.length;
    preload(current + 1);
    preload(current - 1);
  }

  function open(i, from) {
    opener = from;
    show(i);
    dialog.showModal();
    closeBtn.focus();
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener('close', function () {
    img.removeAttribute('src');
    img.removeAttribute('srcset');
    if (opener) opener.focus();
  });

  links.forEach(function (link, i) {
    link.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      open(i, link);
    });
  });

  prevBtn.addEventListener('click', function () { show(current - 1); });
  nextBtn.addEventListener('click', function () { show(current + 1); });
  closeBtn.addEventListener('click', close);

  // Clicking the dark area around the photo closes the viewer.
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog || e.target.classList.contains('lb-stage')) close();
  });

  var focusables = [closeBtn, prevBtn, nextBtn];
  dialog.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
    else if (e.key === 'Tab') {
      // Keep focus cycling through the viewer's own controls.
      var idx = focusables.indexOf(document.activeElement);
      e.preventDefault();
      var next = e.shiftKey ? idx - 1 : idx + 1;
      focusables[(next + focusables.length) % focusables.length].focus();
    }
  });

  // Swipe left/right on touch screens.
  var startX = null;
  var startY = null;
  dialog.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') return;
    startX = e.clientX;
    startY = e.clientY;
  });
  dialog.addEventListener('pointerup', function (e) {
    if (startX === null) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    startX = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
  });
  dialog.addEventListener('pointercancel', function () { startX = null; });
})();
