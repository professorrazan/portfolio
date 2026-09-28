// Shared HTML pieces: page shell, header, footer, image markup.

import { site } from './config.js';

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Loaded without blocking the first paint; text shows in the fallback font until it arrives.
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600&amp;family=Instrument+Serif&amp;display=swap';

export const instagramUrl =`https://www.instagram.com/${site.instagram}/`;

// Absolute URL when siteUrl is configured (needed for Open Graph), relative otherwise.
export const absUrl = (p) => (site.siteUrl ? new URL(p, site.siteUrl.replace(/\/?$/, '/')).href : p);

const icons = {
  arrowUpRight: '<svg class="icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="8 7 17 7 17 16"/></svg>',
  menu: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line class="menu-line-1" x1="4" y1="8" x2="20" y2="8"/><line class="menu-line-2" x1="4" y1="16" x2="20" y2="16"/></svg>',
};
export { icons };

/**
 * <picture> with WebP srcset and a JPG fallback.
 * @param {object} img  record from galleries.json
 * @param {object} opts sizes, eager, className
 */
export function picture(img, { sizes, eager = false, className = '' } = {}) {
  const srcset = img.widths.map((w) => `${img.path}-${w}.webp ${w}w`).join(', ');
  const loading = eager ? ' fetchpriority="high"' : ' loading="lazy"';
  const cls = className ? ` class="${className}"` : '';
  return `<picture><source type="image/webp" srcset="${srcset}" sizes="${sizes}"><img${cls} src="${img.path}-${img.jpgWidth}.jpg" width="${img.width}" height="${img.height}" alt="${esc(img.alt)}"${loading} decoding="async"></picture>`;
}

export const largestWebp = (img) => `${img.path}-${img.widths[img.widths.length - 1]}.webp`;

// Grey box shown until real photos exist. Decorative, so hidden from assistive tech.
export function placeholder(label, { ratio, className = '' } = {}) {
  const style = ratio ? ` style="aspect-ratio: ${ratio}"` : '';
  return `<div class="ph ${className}"${style} aria-hidden="true"><span>${esc(label)}</span></div>`;
}

const navItems = [
  { key: 'work', label: 'Work', href: 'index.html#galleries' },
  { key: 'about', label: 'About', href: 'about.html' },
];

function header(current) {
  const links = navItems.map((n) =>
    `<li><a class="nav-link" href="${n.href}"${n.key === current ? ' aria-current="page"' : ''}>${n.label}</a></li>`).join('\n        ');
  return `<header class="site-header">
    <div class="header-inner">
      <a class="brand" href="index.html">${esc(site.name)}</a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">${icons.menu}</button>
      <nav class="site-nav" id="site-nav" aria-label="Main">
        <ul class="nav-list">
        ${links}
        <li class="nav-book"><a class="btn btn-primary btn-sm" href="about.html#contact">Book</a></li>
        </ul>
      </nav>
    </div>
  </header>`;
}

function footer() {
  return `<footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-id">
        <p class="footer-name">${esc(site.name)}</p>
        <p class="muted">Melbourne, Australia</p>
      </div>
      <ul class="footer-links">
        <li><a href="${instagramUrl}" rel="me">Instagram @${esc(site.instagram)}</a></li>
        <li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>
      </ul>
      <p class="footer-copy muted">© ${new Date().getFullYear()} ${esc(site.name)}</p>
    </div>
  </footer>`;
}

/**
 * Full HTML document.
 * @param {object} p title, description, current (nav key), body, og (image record), head (extra), scripts
 */
export function page({ title, description, current, body, og, head = '', scripts = [] }) {
  const ogTags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(site.name)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    og ? `<meta property="og:image" content="${esc(absUrl(og.path))}">\n  <meta property="og:image:width" content="${og.width}">\n  <meta property="og:image:height" content="${og.height}">\n  <meta name="twitter:card" content="summary_large_image">` : '',
  ].filter(Boolean).join('\n  ');

  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#121110">
  ${ogTags}
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="${FONTS_URL}" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="${FONTS_URL}"></noscript>
  <link rel="stylesheet" href="css/styles.css">
  ${head}
  <script>document.documentElement.classList.add('js')</script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  ${header(current)}
  <main id="main">
${body}
  </main>
  ${footer()}
  <script src="js/site.js" defer></script>
${scripts.map((s) => `  <script src="${s}" defer></script>`).join('\n')}
</body>
</html>
`;
}
