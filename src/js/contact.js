// Contact form: validates, submits to Formspree with fetch, and shows the result inline.
(function () {
  var form = document.querySelector('[data-contact-form]');
  if (!form) return;

  var status = form.querySelector('.form-status');
  var button = form.querySelector('button[type="submit"]');
  var email = form.dataset.email;
  var required = [].slice.call(form.querySelectorAll('[required]'));

  // Links like about.html?shoot=graduation#contact (from the home page banner)
  // pre-select that type of shoot.
  var shoot = new URLSearchParams(location.search).get('shoot');
  if (shoot) {
    var option = form.querySelector('option[data-shoot="' + shoot.replace(/[^a-z0-9-]/gi, '') + '"]');
    if (option) option.selected = true;
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.classList.toggle('is-success', kind === 'success');
    status.classList.toggle('is-error', kind === 'error');
  }

  function validate() {
    var firstInvalid = null;
    required.forEach(function (field) {
      var ok = field.checkValidity();
      field.setAttribute('aria-invalid', String(!ok));
      if (!ok && !firstInvalid) firstInvalid = field;
    });
    return firstInvalid;
  }

  required.forEach(function (field) {
    field.addEventListener('input', function () {
      if (field.getAttribute('aria-invalid') === 'true' && field.checkValidity()) {
        field.setAttribute('aria-invalid', 'false');
      }
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var invalid = validate();
    if (invalid) {
      var name = form.querySelector('label[for="' + invalid.id + '"]').textContent;
      setStatus('Please check the ' + name.toLowerCase() + ' field.', 'error');
      invalid.focus();
      return;
    }

    var endpoint = form.getAttribute('action');
    if (!endpoint) {
      setStatus('The form isn’t connected yet. Please email me at ' + email + '.', 'error');
      return;
    }

    button.disabled = true;
    setStatus('Sending…', null);

    fetch(endpoint, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          required.forEach(function (f) { f.removeAttribute('aria-invalid'); });
          setStatus('Thanks! Your enquiry has been sent. I’ll get back to you soon.', 'success');
          return;
        }
        return res.json().catch(function () { return {}; }).then(function (data) {
          var detail = data && data.errors && data.errors.length
            ? data.errors.map(function (x) { return x.message; }).join(' ')
            : '';
          setStatus('Sorry, that didn’t send. ' + (detail ? detail + ' ' : '') + 'Please try again or email me at ' + email + '.', 'error');
        });
      })
      .catch(function () {
        setStatus('Sorry, that didn’t send. Check your connection and try again, or email me at ' + email + '.', 'error');
      })
      .then(function () {
        button.disabled = false;
      });
  });
})();
