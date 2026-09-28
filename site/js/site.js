// Mobile menu: toggles the slide-down nav, closes on Escape, outside click or link click.
(function () {
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  function setOpen(open, returnFocus) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
    nav.classList.toggle('is-open', open);
    if (open) {
      var first = nav.querySelector('a');
      if (first) first.focus();
    } else if (returnFocus) {
      toggle.focus();
    }
  }

  function isOpen() {
    return toggle.getAttribute('aria-expanded') === 'true';
  }

  toggle.addEventListener('click', function () {
    setOpen(!isOpen(), false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) setOpen(false, true);
  });

  document.addEventListener('click', function (e) {
    if (isOpen() && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false, false);
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false, false);
  });

  // Reset when resizing up to the desktop layout.
  matchMedia('(min-width: 640px)').addEventListener('change', function (mq) {
    if (mq.matches) setOpen(false, false);
  });
})();
