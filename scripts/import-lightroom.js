// Imports photos from Lightroom (cloud) into photos/<folder>/.
//
// Looks for an album folder named "Portfolio" whose albums match the gallery titles
// (plus an "About" album), downloads the 2048px rendition of each photo in album
// order, saves each album's cover as cover.jpg and the About photo as
// photos/about/me.jpg, and writes Lightroom captions to photos/<folder>/captions.json
// so they become alt text. Only new or changed photos are downloaded, and photos
// removed from an album are deleted locally.
//
//   npm run import              interactive; opens an Adobe login when needed
//   node ... --optional         used by `npm run build`: never prompts, and any
//                               failure is a warning so the site still builds
//
// Credentials live in .env (git-ignored) and are never printed.

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { spawn, spawnSync } from 'node:child_process';
import { ROOT, PHOTOS_DIR, categories, ABOUT_SLUG } from './lib/config.js';

const OPTIONAL = process.argv.includes('--optional');
const ENV_FILE = path.join(ROOT, '.env');
const CERT_DIR = path.join(ROOT, '.certs');
const MANIFEST = path.join(PHOTOS_DIR, '.lightroom.json');

const IMS = 'https://ims-na1.adobelogin.com/ims';
const LR = 'https://lr.adobe.io';
const REDIRECT_URI = 'https://localhost:8000/callback';
const SCOPES = 'openid,AdobeID,lr_partner_apis,lr_partner_rendition_apis,offline_access';
const PORTFOLIO_FOLDER = 'Portfolio';
const ABOUT_ALBUM = 'About';
const RENDITION = '2048';

class SkipImport extends Error {}

/* ---------- .env ---------- */

function loadEnv() {
  if (!fsSync.existsSync(ENV_FILE)) throw new SkipImport('No .env file with Adobe credentials.');
  process.loadEnvFile(ENV_FILE);
  const env = {
    clientId: process.env.ADOBE_CLIENT_ID?.trim(),
    clientSecret: process.env.ADOBE_CLIENT_SECRET?.trim(),
    refreshToken: process.env.ADOBE_REFRESH_TOKEN?.trim(),
  };
  if (!env.clientId || !env.clientSecret) throw new SkipImport('ADOBE_CLIENT_ID / ADOBE_CLIENT_SECRET are empty in .env.');
  return env;
}

async function saveRefreshToken(token) {
  const text = await fs.readFile(ENV_FILE, 'utf8');
  const line = `ADOBE_REFRESH_TOKEN=${token}`;
  const next = /^ADOBE_REFRESH_TOKEN=.*$/m.test(text)
    ? text.replace(/^ADOBE_REFRESH_TOKEN=.*$/m, line)
    : `${text.replace(/\n?$/, '\n')}${line}\n`;
  await fs.writeFile(ENV_FILE, next);
}

/* ---------- HTTP with retry ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retries 429 and 5xx responses (and network errors) with exponential backoff,
// honouring Retry-After when Adobe sends it.
async function fetchRetry(url, options = {}, attempts = 6) {
  for (let i = 0; ; i++) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      if (i >= attempts - 1) throw err;
      await sleep(backoff(i));
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && i < attempts - 1) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await res.body?.cancel();
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(i));
      continue;
    }
    return res;
  }
}

const backoff = (i) => Math.min(30000, 1000 * 2 ** i) + Math.random() * 500;

/* ---------- Adobe IMS (OAuth 2.0) ---------- */

async function tokenRequest(env, params) {
  const res = await fetchRetry(`${IMS}/token/v3`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.clientId, client_secret: env.clientSecret, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Adobe login failed (${res.status}${data.error ? `: ${data.error}` : ''}).`);
    err.code = data.error;
    throw err;
  }
  return data;
}

function findOpenssl() {
  const candidates = [
    'openssl',
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\msys64\\usr\\bin\\openssl.exe',
    'C:\\msys64\\mingw64\\bin\\openssl.exe',
  ];
  return candidates.find((c) => spawnSync(c, ['version'], { stdio: 'ignore' }).status === 0);
}

// Self-signed certificate for https://localhost:8000 (Adobe requires an HTTPS redirect).
async function localhostCert() {
  const key = path.join(CERT_DIR, 'localhost-key.pem');
  const cert = path.join(CERT_DIR, 'localhost.pem');
  if (!fsSync.existsSync(key) || !fsSync.existsSync(cert)) {
    const openssl = findOpenssl();
    if (!openssl) return null;
    await fs.mkdir(CERT_DIR, { recursive: true });
    const r = spawnSync(openssl, [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '825',
      '-keyout', key, '-out', cert, '-subj', '/CN=localhost',
      '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ], { stdio: 'ignore' });
    if (r.status !== 0) return null;
  }
  return { key: fsSync.readFileSync(key), cert: fsSync.readFileSync(cert) };
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

// One-time login: opens Adobe's sign-in page and waits for the redirect back to
// https://localhost:8000/callback. If the local page can't load, the address can be
// pasted into the terminal instead.
async function interactiveLogin(env) {
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = `${IMS}/authorize/v2?${new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    response_type: 'code',
    state,
  })}`;

  const tls = await localhostCert();
  let server = null;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const code = await new Promise((resolve, reject) => {
    const handle = (rawUrl) => {
      let u;
      try {
        u = new URL(rawUrl, REDIRECT_URI);
      } catch {
        return 'That doesn\u2019t look like the callback address.';
      }
      if (u.searchParams.get('error')) {
        reject(new Error(`Adobe login was not completed: ${u.searchParams.get('error')}.`));
        return 'Login was not completed. You can close this tab.';
      }
      if (u.searchParams.get('state') !== state) return 'Login state did not match. Please try again.';
      const c = u.searchParams.get('code');
      if (!c) return 'No login code found in that address.';
      resolve(c);
      return 'Logged in to Lightroom. You can close this tab and return to the terminal.';
    };

    if (tls) {
      server = https.createServer(tls, (req, res) => {
        if (!req.url.startsWith('/callback')) {
          res.writeHead(404).end();
          return;
        }
        const message = handle(req.url);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><meta charset="utf-8"><title>Lightroom login</title><body style="font:18px system-ui;background:#121110;color:#EDE8E0;padding:48px">${message}</body>`);
      });
      server.on('error', (err) => {
        console.log(`  (Local login page unavailable: ${err.code ?? err.message}. Use the paste option below.)`);
        server = null;
      });
      server.listen(8000, '127.0.0.1');
    }

    console.log('\nOpening the Adobe sign-in page in your browser...');
    if (tls) {
      console.log('After signing in, your browser will warn that https://localhost:8000 is "not private".');
      console.log('That is the local certificate this script just made: choose Advanced > Continue to localhost.');
    }
    console.log('\nIf the browser does not open, visit:\n' + authUrl);
    console.log('\nIf the page after login shows an error, copy the full address from the address bar and paste it here.');
    rl.on('line', (line) => {
      if (!line.trim()) return;
      const msg = handle(line.trim());
      if (!msg.startsWith('Logged in')) console.log(msg);
    });
    openBrowser(authUrl);
  });

  rl.close();
  server?.close();
  return tokenRequest(env, { grant_type: 'authorization_code', code });
}

async function getAccessToken(env) {
  if (env.refreshToken) {
    try {
      const t = await tokenRequest(env, { grant_type: 'refresh_token', refresh_token: env.refreshToken });
      if (t.refresh_token && t.refresh_token !== env.refreshToken) {
        env.refreshToken = t.refresh_token;
        await saveRefreshToken(t.refresh_token);
      }
      return t.access_token;
    } catch (err) {
      if (OPTIONAL) throw new SkipImport('Your saved Lightroom login has expired. Run `npm run import` to sign in again.');
      console.log('Your saved Lightroom login has expired; signing in again.');
    }
  } else if (OPTIONAL) {
    throw new SkipImport('Not logged in to Lightroom yet. Run `npm run import` once to sign in.');
  }

  const t = await interactiveLogin(env);
  if (t.refresh_token) {
    env.refreshToken = t.refresh_token;
    await saveRefreshToken(t.refresh_token);
    console.log('Login saved to .env; later runs won\u2019t need to sign in until it expires.');
  } else {
    console.log('Note: Adobe did not return a refresh token, so you will need to sign in on each import.');
  }
  return t.access_token;
}

/* ---------- Lightroom API ---------- */

function lrClient(env, accessToken) {
  const headers = () => ({ 'X-API-Key': env.clientId, Authorization: `Bearer ${accessToken}` });

  async function request(url) {
    const res = await fetchRetry(url, { headers: headers() });
    if (res.status === 401 || res.status === 403) {
      const body = await res.text();
      throw new Error(`Lightroom refused access (${res.status}). ${body.replace(/^while\s*\(\s*1\s*\)\s*{\s*}\s*/, '').slice(0, 200)}`);
    }
    return res;
  }

  async function json(url) {
    const res = await request(url);
    const text = await res.text();
    if (!res.ok) throw new Error(`Lightroom API ${res.status} for ${new URL(url).pathname}: ${text.slice(0, 200)}`);
    // Lightroom prefixes JSON with while(1){} which must be removed.
    return JSON.parse(text.replace(/^while\s*\(\s*1\s*\)\s*{\s*}\s*/, ''));
  }

  async function paged(url) {
    const out = [];
    let next = url;
    while (next) {
      const page = await json(next);
      out.push(...(page.resources ?? []));
      next = page.links?.next?.href ? new URL(page.links.next.href, page.base ?? next).href : null;
    }
    return out;
  }

  async function download(url, dest) {
    const res = await request(url);
    if (!res.ok) throw new Error(`Download failed (${res.status}) for ${path.basename(dest)}.`);
    const tmp = `${dest}.part`;
    await fs.writeFile(tmp, Buffer.from(await res.arrayBuffer()));
    await fs.rename(tmp, dest);
  }

  return { json, paged, download };
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

function slugify(name) {
  return String(name ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Lightroom stores text either as a plain string or as a language map.
function text(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') return text(value['x-default'] ?? Object.values(value)[0]);
  return '';
}

function captionOf(asset) {
  const p = asset?.payload ?? {};
  return text(p.xmp?.dc?.description) || text(p.xmp?.dc?.title) || text(p.caption) || text(p.title);
}

// Album order: custom `order` key, then capture date, then upload date.
function albumSort(a, b) {
  const oa = a.payload?.order;
  const ob = b.payload?.order;
  if (oa && ob && oa !== ob) return oa < ob ? -1 : 1;
  if (oa && !ob) return -1;
  if (!oa && ob) return 1;
  const ca = a.asset?.payload?.captureDate ?? '';
  const cb = b.asset?.payload?.captureDate ?? '';
  if (ca !== cb) return ca < cb ? -1 : 1;
  return (a.asset?.created ?? '') < (b.asset?.created ?? '') ? -1 : 1;
}

/* ---------- Sync ---------- */

async function readManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  } catch {
    return { albums: {} };
  }
}

const exists = (p) => fs.stat(p).then(() => true, () => false);

// Syncs one album into photos/<slug>/. `plan` maps each wanted file name to its
// Lightroom asset; files this script created earlier but no longer wants are removed.
async function syncFolder(lr, catalogBase, slug, plan, previous, stats) {
  const dir = path.join(PHOTOS_DIR, slug);
  await fs.mkdir(dir, { recursive: true });
  const prevFiles = previous?.files ?? {};
  const prevByAsset = new Map(Object.entries(prevFiles).map(([file, v]) => [`${v.assetId}|${v.role}`, { file, ...v }]));
  const files = {};

  for (const { file, asset, role } of plan) {
    const dest = path.join(dir, file);
    const updated = asset.updated ?? asset.payload?.develop?.userUpdated ?? '';
    const prev = prevByAsset.get(`${asset.id}|${role}`);

    if (prev && prev.updated === updated && prev.file !== file && (await exists(path.join(dir, prev.file))) && !(await exists(dest))) {
      await fs.rename(path.join(dir, prev.file), dest); // album re-ordered: rename instead of re-downloading
      stats.renamed++;
    } else if (!prev || prev.updated !== updated || prev.file !== file || !(await exists(dest))) {
      await lr.download(new URL(`assets/${asset.id}/renditions/${RENDITION}`, catalogBase).href, dest);
      stats.downloaded++;
    } else {
      stats.unchanged++;
    }
    files[file] = { assetId: asset.id, updated, role };
  }

  for (const file of Object.keys(prevFiles)) {
    if (!files[file] && (await exists(path.join(dir, file)))) {
      await fs.rm(path.join(dir, file));
      stats.removed++;
    }
  }
  return files;
}

async function main() {
  const env = loadEnv();
  const accessToken = await getAccessToken(env);
  const lr = lrClient(env, accessToken);

  const health = await fetchRetry(`${LR}/v2/health`, { headers: { 'X-API-Key': env.clientId } });
  if (!health.ok) throw new Error(`Lightroom services are unavailable right now (${health.status}).`);

  const catalog = await lr.json(`${LR}/v2/catalog`);
  const catalogBase = new URL(`catalogs/${catalog.id}/`, `${LR}/v2/`).href;

  const albums = await lr.paged(new URL('albums?subtype=collection%3Bcollection_set', catalogBase).href);
  const folder = albums.find((a) => a.subtype === 'collection_set' && norm(a.payload?.name) === norm(PORTFOLIO_FOLDER));
  if (!folder) {
    const sets = albums.filter((a) => a.subtype === 'collection_set').map((a) => a.payload?.name);
    throw new Error(`No album folder named "${PORTFOLIO_FOLDER}" found in Lightroom.${sets.length ? ` Folders found: ${sets.join(', ')}.` : ''}`);
  }
  const children = albums.filter((a) => a.subtype === 'collection' && a.payload?.parent?.id === folder.id);

  const manifest = await readManifest();
  const stats = { downloaded: 0, renamed: 0, unchanged: 0, removed: 0 };
  const targets = [
    ...categories.map((c) => ({ slug: c.slug, name: c.title })),
    { slug: ABOUT_SLUG, name: ABOUT_ALBUM },
  ];
  const missing = [];
  const nextManifest = { albums: {} };

  for (const target of targets) {
    const album = children.find((a) => norm(a.payload?.name) === norm(target.name));
    if (!album) {
      missing.push(target.name);
      if (manifest.albums[target.slug]) nextManifest.albums[target.slug] = manifest.albums[target.slug];
      continue;
    }

    const items = (await lr.paged(new URL(`albums/${album.id}/assets?embed=asset&subtype=image`, catalogBase).href))
      .filter((it) => it.asset && (it.asset.subtype ?? 'image') === 'image')
      .sort(albumSort);

    const coverItem = items.find((it) => it.payload?.cover)
      ?? items.find((it) => it.asset.id === album.payload?.cover?.id)
      ?? items[0];

    let plan;
    if (target.slug === ABOUT_SLUG) {
      plan = coverItem ? [{ file: 'me.jpg', asset: coverItem.asset, role: 'about' }] : [];
    } else {
      const width = String(items.length).length < 3 ? 3 : String(items.length).length;
      plan = items.map((it, i) => {
        const original = it.asset.payload?.importSource?.fileName;
        const name = slugify(original) || it.asset.id.slice(0, 8);
        return { file: `${String(i + 1).padStart(width, '0')}-${name}.jpg`, asset: it.asset, role: 'photo' };
      });
      if (coverItem) plan.push({ file: 'cover.jpg', asset: coverItem.asset, role: 'cover' });
    }

    const files = await syncFolder(lr, catalogBase, target.slug, plan, manifest.albums[target.slug], stats);
    nextManifest.albums[target.slug] = { albumId: album.id, files };

    // The About page uses whichever photos/about/me.* sorts first, so keep only ours.
    if (target.slug === ABOUT_SLUG && plan.length) {
      for (const name of await fs.readdir(path.join(PHOTOS_DIR, ABOUT_SLUG))) {
        if (/^me\./i.test(name) && name !== 'me.jpg') await fs.rm(path.join(PHOTOS_DIR, ABOUT_SLUG, name));
      }
    }

    const captions = {};
    for (const p of plan) {
      const c = captionOf(p.asset);
      if (c) captions[p.file] = c;
    }
    await fs.writeFile(path.join(PHOTOS_DIR, target.slug, 'captions.json'), JSON.stringify(captions, null, 2) + '\n');
  }

  await fs.mkdir(PHOTOS_DIR, { recursive: true });
  await fs.writeFile(MANIFEST, JSON.stringify(nextManifest, null, 2) + '\n');

  console.log(`Lightroom: ${stats.downloaded} downloaded, ${stats.renamed} re-ordered, ${stats.unchanged} unchanged, ${stats.removed} removed.`);
  if (missing.length) {
    const found = children.map((a) => a.payload?.name).join(', ') || 'none';
    console.log(`  Albums not found in "${PORTFOLIO_FOLDER}": ${missing.join(', ')}. (Albums found: ${found}.)`);
  }
}

main().catch((err) => {
  const message = err instanceof SkipImport ? err.message : `Lightroom import failed: ${err.message}`;
  if (OPTIONAL) {
    console.warn(`Lightroom: skipped. ${message} Building with the photos already downloaded.`);
    process.exit(0);
  }
  console.error(message);
  process.exit(1);
});
