// Builds site/*.html from galleries.json and copies src/ assets into site/.

import fs from 'node:fs/promises';
import path from 'node:path';
import { SITE_DIR, SRC_DIR, GALLERIES_JSON, site, categories } from './lib/config.js';
import { page, picture, placeholder, largestWebp, esc, icons, instagramUrl } from './lib/html.js';

const FULL_WIDTH_EVERY = 9;
const BIO = [
  "I'm a Melbourne-based photographer and videographer. I love portraits that feel personal, graduation photos that capture the milestone, and creative shoots where I get to play with light and colour. Travel is one of my favourite ways to shoot — I love capturing the people and places I meet on the road.",
  "I also make videos, bringing the same eye for light, colour and people to moving images.",];
const GEAR = ['Sony A6400', 'Tamron 17–70mm f/2.8', 'Sigma 56mm f/1.4', 'RGB video light'];

async function loadData() {
  let data;
  try {
    data = JSON.parse(await fs.readFile(GALLERIES_JSON, 'utf8'));
  } catch {
    console.warn('galleries.json not found; run `npm run images` first. Building with placeholders.');
    data = { galleries: [] };
  }
  const bySlug = new Map((data.galleries ?? []).map((g) => [g.slug, g]));
  // Always follow the brief's order, filling gaps for galleries without data.
  const galleries = categories.map((c) => {
    const g = bySlug.get(c.slug) ?? {};
    return { ...c, title: g.title ?? c.title, description: g.description ?? c.description, cover: g.cover ?? null, images: g.images ?? [] };
  });
  return { galleries, about: data.about ?? null, og: data.og ?? null };
}

/* ---------- Home ---------- */

function homePage({ galleries, about, og }) {
  const cards = galleries.map((g, i) => {
    const media = g.cover
      ? picture(g.cover, { sizes: '(min-width: 900px) 22vw, 46vw', className: 'cover-img' })
      : placeholder(g.hint);
    return `<li>
          <a class="card" href="${g.slug}.html">
            <div class="card-media${g.accent ? ' card-media--accent' : ''}${i % 2 ? ' ph-alt' : ''}">${media}</div>
            <div class="card-meta">
              <div>
                <h3 class="card-title">${esc(g.title)}</h3>
                <p class="card-desc">${esc(g.description)}</p>
              </div>
              ${icons.arrowUpRight}
            </div>
          </a>
        </li>`;
  }).join('\n        ');

  const aboutMedia = about
    ? picture(about, { sizes: '(min-width: 900px) 480px, 100vw', className: 'cover-img' })
    : placeholder('Photo of Razan');

  const body = `
    <section class="hero" aria-labelledby="hero-title">
      <video class="hero-video" autoplay muted loop playsinline preload="auto" poster="video/banner-poster.jpg" aria-hidden="true" tabindex="-1"></video>
      <script>
        // Pick one video for this screen (phones get the lighter 720p file); with
        // reduced motion, load none and keep showing the poster.
        (function (v) {
          if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
            v.removeAttribute('autoplay');
            return;
          }
          v.src = matchMedia('(max-width: 900px)').matches ? 'video/banner-720.mp4' : 'video/banner.mp4';
        })(document.currentScript.previousElementSibling);
      </script>
      <div class="hero-scrim"></div>
      <div class="hero-content">
        <p class="label hero-label">Melbourne · Portrait, graduation &amp; event photographer</p>
        <h1 class="hero-title" id="hero-title">Light, colour<br> &amp; the people in it.</h1>
        <div class="btn-row">
          <a class="btn btn-primary btn-lg" href="#galleries">See the work</a>
          <a class="btn btn-outline-light btn-lg" href="about.html#contact">Book a session</a>
        </div>
      </div>
      <button class="video-toggle" type="button" aria-pressed="false" hidden>
        <span class="visually-hidden">Pause background video</span>
        <svg class="i-pause" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
        <svg class="i-play" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>
      </button>
    </section>

    <section class="section" id="galleries" aria-labelledby="work-title">
      <div class="section-head">
        <h2 class="h-section" id="work-title">Selected work</h2>
      </div>
      <ul class="card-grid" role="list">
        ${cards}
      </ul>
    </section>

    <section class="band" aria-labelledby="grad-title">
      <div class="band-inner">
        <div class="band-text">
          <p class="label label-dot">Graduation season</p>
          <h2 class="h-band" id="grad-title">Graduating this December?</h2>
          <p class="lede">Campus and city sessions around Melbourne — solo, with family or with friends.</p>
        </div>
        <a class="btn btn-primary btn-xl" href="about.html#contact">Check availability</a>
      </div>
    </section>

    <section class="section teaser" aria-labelledby="teaser-title">
      <div class="teaser-media">${aboutMedia}</div>
      <div class="teaser-text">
        <p class="label">About</p>
        <h2 class="h-teaser" id="teaser-title">Hi, I'm Razan.</h2>
        <p class="lede">${esc(BIO[0])}</p>
        <a class="text-link" href="about.html">More about me <span aria-hidden="true">→</span></a>
      </div>
    </section>
`;

  return page({
    title: `${site.name} | Melbourne Portrait & Graduation Photographer`,
    description: 'Razan Ahmad is a Melbourne photographer for portraits, graduations, events and creative concept shoots. See the galleries and book a session.',
    current: null,
    head: '<link rel="preload" as="image" href="video/banner-poster.jpg" fetchpriority="high">',
    og,
    body,
    scripts: ['js/home.js'],
  });
}

/* ---------- Gallery ---------- */

// Stand-in layout (mirrors the mockup) for galleries that have no photos yet.
const PLACEHOLDER_SET = [
  [3, 4, 'Portrait'], [3, 2, 'Landscape'], [3, 4, 'Portrait'],
  [3, 2, 'Detail'], [3, 4, 'Portrait'], [3, 4, 'Portrait'],
  [3, 4, 'Portrait'], [3, 4, 'Portrait'], [3, 2, 'Detail'],
  [2, 1, 'Full-width break'],
  [4, 5, 'Portrait'], [4, 5, 'Portrait'], [4, 5, 'Portrait'],
].map(([width, height, label]) => ({ width, height, label, placeholder: true }));

const isLandscape = (img) => img.width > img.height * 1.15;

// Splits images into masonry blocks, promoting a landscape image to full width
// after every ~9 photos.
function segment(images) {
  const out = [];
  let block = [];
  for (const img of images) {
    if (block.length >= FULL_WIDTH_EVERY && isLandscape(img)) {
      out.push({ type: 'masonry', items: block }, { type: 'full', item: img });
      block = [];
    } else {
      block.push(img);
    }
  }
  if (block.length) out.push({ type: 'masonry', items: block });
  return out;
}

function galleryItem(img, index, { full = false } = {}) {
  if (img.placeholder) {
    return placeholder(img.label, { ratio: `${img.width} / ${img.height}`, className: index % 2 ? 'ph-alt' : '' });
  }
  const sizes = full ? '(min-width: 1440px) 1280px, 100vw' : '(min-width: 1025px) 30vw, (min-width: 641px) 46vw, 100vw';
  return `<a class="m-link" href="${largestWebp(img)}" data-index="${index}">${picture(img, { sizes })}</a>`;
}

function galleryPage(g, next, og) {
  const hasPhotos = g.images.length > 0;
  const items = (hasPhotos ? g.images : PLACEHOLDER_SET).map((img, index) => ({ ...img, index }));

  const blocks = segment(items).map((s) => {
    if (s.type === 'full') {
      return `<figure class="m-full">${galleryItem(s.item, s.item.index, { full: true })}</figure>`;
    }
    const figs = s.items.map((img) =>
      `<figure class="m-item" data-ar="${(img.height / img.width).toFixed(4)}">${galleryItem(img, img.index)}</figure>`).join('\n        ');
    return `<div class="masonry" data-masonry>
        ${figs}
      </div>`;
  }).join('\n      ');

  const lightbox = hasPhotos ? `
    <dialog class="lightbox" aria-label="Photo viewer">
      <div class="lb-stage">
        <img class="lb-img" alt="">
      </div>
      <p class="lb-count" aria-live="polite"></p>
      <button class="lb-btn lb-close" type="button" aria-label="Close"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
      <button class="lb-btn lb-prev" type="button" aria-label="Previous photo"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 5 8 12 15 19"/></svg></button>
      <button class="lb-btn lb-next" type="button" aria-label="Next photo"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 5 16 12 9 19"/></svg></button>
    </dialog>` : '';

  const body = `
    <section class="gallery-head" aria-labelledby="gallery-title">
      <div class="gallery-head-main">
        <a class="back-link label" href="index.html#galleries"><span aria-hidden="true">←</span> All work</a>
        <h1 class="h-gallery" id="gallery-title">${esc(g.title)}</h1>
      </div>
      <p class="lede">${esc(g.description)}</p>
    </section>

    <section class="gallery" aria-label="${esc(g.title)} photos">
      ${blocks}
    </section>
    <script>
    (function () {
      var blocks = [].slice.call(document.querySelectorAll('[data-masonry]'));
      function layout() {
        blocks.forEach(function (b) {
          var n = parseInt(getComputedStyle(b).getPropertyValue('--cols'), 10) || 1;
          if (b._cols === n) return;
          b._cols = n;
          b._items = b._items || [].slice.call(b.querySelectorAll('.m-item'));
          var cols = [], heights = [];
          for (var i = 0; i < n; i++) {
            cols.push(document.createElement('div'));
            cols[i].className = 'm-col';
            heights.push(0);
          }
          b._items.forEach(function (it) {
            var k = heights.indexOf(Math.min.apply(null, heights));
            cols[k].appendChild(it);
            heights[k] += parseFloat(it.getAttribute('data-ar')) + 0.06;
          });
          b.replaceChildren.apply(b, cols);
          b.classList.add('is-js');
        });
      }
      layout();
      var t;
      addEventListener('resize', function () { clearTimeout(t); t = setTimeout(layout, 120); });
    })();
    </script>

    <nav class="next-row" aria-label="More">
      <a class="next-link" href="${next.slug}.html">
        <span class="label">Next gallery</span>
        <span class="next-title">${esc(next.title)} <span aria-hidden="true">→</span></span>
      </a>
      <a class="btn btn-primary btn-xl" href="about.html#contact">Book a session</a>
    </nav>
${lightbox}
`;

  return page({
    title: `${g.title} Photography | ${site.name}, Melbourne`,
    description: `${g.title} photography by ${site.name}, Melbourne: ${g.description.charAt(0).toLowerCase()}${g.description.slice(1)}.`,
    current: g.slug,
    og,
    body,
    scripts: hasPhotos ? ['js/gallery.js'] : [],
  });
}

/* ---------- About & Contact ---------- */

function aboutPage({ galleries, about, og }) {
  const media = about
    ? picture(about, { sizes: '(min-width: 900px) 520px, 100vw', eager: true, className: 'cover-img' })
    : placeholder('Photo of Razan');
  const shoots = galleries.map((g) => `<li>${esc(g.title)}</li>`).join('');
  const gear = GEAR.map((x) => `<li>${esc(x)}</li>`).join('');
  const options = galleries.map((g) => `<option>${esc(g.title)}</option>`).join('\n              ');
  const endpoint = site.formspreeEndpoint;

  const body = `
    <section class="section about" aria-labelledby="about-title">
      <div class="about-media">${media}</div>
      <div class="about-text">
        <p class="label">About</p>
        <h1 class="h-about" id="about-title">Hi, I'm Razan.</h1>
        ${BIO.map((p) => `<p class="lede">${esc(p)}</p>`).join('\n        ')}
        <div class="about-lists">
          <div>
            <h2 class="label">What I shoot</h2>
            <ul class="plain-list" role="list">${shoots}</ul>
          </div>
          <div>
            <h2 class="label">Gear</h2>
            <ul class="plain-list" role="list">${gear}</ul>
          </div>
        </div>
      </div>
    </section>

    <section class="contact" id="contact" aria-labelledby="contact-title">
      <div class="contact-inner">
        <div class="contact-intro">
          <p class="label">Book a session</p>
          <h2 class="h-contact" id="contact-title">Let's make something great.</h2>
          <p class="lede">Graduating soon, planning an event or have an idea for a shoot? Tell me a little about it and I'll get back to you.</p>
          <ul class="contact-links" role="list">
            <li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>
            <li><a href="${instagramUrl}" rel="me">Instagram @${esc(site.instagram)}</a></li>
          </ul>
        </div>
        <form class="contact-form" data-contact-form${endpoint ? ` action="${esc(endpoint)}" method="POST"` : ''} data-email="${esc(site.email)}" novalidate>
          <div class="field">
            <label for="c-name">Name</label>
            <input id="c-name" name="name" type="text" autocomplete="name" required>
          </div>
          <div class="field">
            <label for="c-email">Email</label>
            <input id="c-email" name="email" type="email" autocomplete="email" required>
          </div>
          <div class="field">
            <label for="c-type">Type of shoot</label>
            <select id="c-type" name="shoot_type">
              ${options}
            </select>
          </div>
          <div class="field">
            <label for="c-date">Preferred date</label>
            <input id="c-date" name="preferred_date" type="date">
          </div>
          <div class="field field-wide">
            <label for="c-msg">Message</label>
            <textarea id="c-msg" name="message" rows="6" required></textarea>
          </div>
          <div class="hp" aria-hidden="true">
            <label for="c-gotcha">Leave this empty</label>
            <input id="c-gotcha" name="_gotcha" type="text" tabindex="-1" autocomplete="off">
          </div>
          <input type="hidden" name="_subject" value="New enquiry from the portfolio site">
          <div class="field-wide form-actions">
            <button class="btn btn-primary btn-xl" type="submit">Send enquiry</button>
            <p class="form-status" role="status" aria-live="polite"></p>
          </div>
        </form>
      </div>
    </section>
`;

  return page({
    title: `About & Contact | ${site.name}, Melbourne Photographer`,
    description: 'Meet Razan Ahmad, a Melbourne photographer and videographer. Get in touch to book a graduation, portrait, event, travel or concept shoot.',
    current: 'about',
    og,
    body,
    scripts: ['js/contact.js'],
  });
}

/* ---------- Build ---------- */

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) await copyDir(src, dest);
    else await fs.copyFile(src, dest);
  }
}

async function main() {
  const data = await loadData();
  await fs.mkdir(SITE_DIR, { recursive: true });

  // Remove previously generated pages so renamed/removed galleries don't linger.
  for (const name of await fs.readdir(SITE_DIR)) {
    if (name.endsWith('.html')) await fs.rm(path.join(SITE_DIR, name));
  }

  const pages = new Map();
  pages.set('index.html', homePage(data));
  pages.set('about.html', aboutPage(data));
  data.galleries.forEach((g, i) => {
    pages.set(`${g.slug}.html`, galleryPage(g, data.galleries[(i + 1) % data.galleries.length], data.og));
  });

  for (const [name, html] of pages) await fs.writeFile(path.join(SITE_DIR, name), html);
  await copyDir(SRC_DIR, SITE_DIR);
  // GitHub Pages: serve files as-is (no Jekyll processing).
  await fs.writeFile(path.join(SITE_DIR, '.nojekyll'), '');

  console.log(`Site: wrote ${pages.size} pages to site/.`);
  if (!site.formspreeEndpoint) console.log('  formspreeEndpoint is empty in site.config.json: the contact form will show a "not connected yet" message.');
  if (!site.siteUrl) console.log('  siteUrl is empty in site.config.json: Open Graph image uses a relative URL until the site has a public address.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
