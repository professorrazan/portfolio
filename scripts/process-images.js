// Generates responsive WebP (800/1600/2400px long edge) + a JPG fallback for every
// photo in photos/<folder>/ into site/img/<folder>/, and writes galleries.json.
// Originals are never modified. Alt text and titles you edit in galleries.json are
// kept on the next run.

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PHOTOS_DIR, IMG_OUT, SITE_DIR, GALLERIES_JSON, categories, ABOUT_SLUG } from './lib/config.js';

const LONG_EDGES = [800, 1600, 2400];
const JPG_LONG_EDGE = 1600;
const OG_SIZE = { width: 1200, height: 630 };
const IMAGE_EXT = /\.(jpe?g|png|webp|avif|tiff?)$/i;

const exists = (p) => fs.stat(p).then(() => true, () => false);
const mtime = (p) => fs.stat(p).then((s) => s.mtimeMs, () => 0);

async function listImages(dir) {
  if (!(await exists(dir))) return [];
  const names = await fs.readdir(dir);
  return names
    .filter((n) => IMAGE_EXT.test(n) && !n.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function slugify(name) {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'photo';
}

// "grad-cap-toss_02.jpg" -> "Grad cap toss". Camera-style names (IMG_1234, DSC01234,
// RAZ02465-Enhanced-NR) fall back to "<Gallery> photo N" so every image still has
// meaningful alt text.
function altFromFilename(file, galleryTitle, n) {
  const words = path.parse(file).name
    .replace(/^\d+-/, '') // order prefix added by the Lightroom import
    .replace(/frame[\s_\-]at[\s_\-]\d+m\d+s/gi, ' ') // video frame grabs
    .replace(/(^|[\s_\-.])[a-z]{1,5}[\s_\-]?\d{3,}/gi, ' ')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\b(enhanced|nr|edit|edited|copy|final|export|jpe?g|png|heic|dng|arw|tiff?)\b/gi, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/[a-z]{3,}/i.test(words)) return `${galleryTitle} photo ${n}`;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Pixel size after applying EXIF orientation.
async function orientedSize(file) {
  const m = await sharp(file).metadata();
  return (m.orientation ?? 1) >= 5 ? { width: m.height, height: m.width } : { width: m.width, height: m.height };
}

function variantSizes({ width, height }) {
  const long = Math.max(width, height);
  const seen = new Map();
  for (const target of LONG_EDGES) {
    const scale = Math.min(1, target / long);
    const w = Math.round(width * scale);
    seen.set(w, { width: w, height: Math.round(height * scale), target });
  }
  return [...seen.values()];
}

async function processImage(srcFile, outDir, base) {
  const size = await orientedSize(srcFile);
  const variants = variantSizes(size);
  const jpg = variants.reduce((best, v) =>
    Math.abs(v.target - JPG_LONG_EDGE) < Math.abs(best.target - JPG_LONG_EDGE) ? v : best);

  const outputs = [
    ...variants.map((v) => ({ ...v, file: path.join(outDir, `${base}-${v.width}.webp`), format: 'webp' })),
    { ...jpg, file: path.join(outDir, `${base}-${jpg.width}.jpg`), format: 'jpg' },
  ];

  const srcTime = await mtime(srcFile);
  let wrote = 0;
  for (const o of outputs) {
    if ((await mtime(o.file)) >= srcTime) continue;
    const pipeline = sharp(srcFile).rotate().resize(o.width, o.height);
    if (o.format === 'webp') await pipeline.webp({ quality: 78, effort: 5 }).toFile(o.file);
    else await pipeline.jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(o.file);
    wrote++;
  }

  return {
    record: {
      width: size.width,
      height: size.height,
      path: path.relative(SITE_DIR, path.join(outDir, base)).split(path.sep).join('/'),
      widths: variants.map((v) => v.width),
      jpgWidth: jpg.width,
    },
    files: outputs.map((o) => path.basename(o.file)),
    wrote,
  };
}

// Removes generated files whose source photo is gone.
async function pruneDir(dir, keep) {
  if (!(await exists(dir))) return 0;
  let removed = 0;
  for (const name of await fs.readdir(dir)) {
    if (!keep.has(name)) {
      await fs.rm(path.join(dir, name), { recursive: true, force: true });
      removed++;
    }
  }
  return removed;
}

// Captions pulled from Lightroom by `npm run import` ({ "file.jpg": "caption" }).
async function readCaptions(dir) {
  try {
    return new Map(Object.entries(JSON.parse(await fs.readFile(path.join(dir, 'captions.json'), 'utf8'))));
  } catch {
    return new Map();
  }
}

async function readPrevious() {
  try {
    return JSON.parse(await fs.readFile(GALLERIES_JSON, 'utf8'));
  } catch {
    return { galleries: [] };
  }
}

async function main() {
  await fs.mkdir(IMG_OUT, { recursive: true });
  const previous = await readPrevious();
  const prevGallery = new Map((previous.galleries ?? []).map((g) => [g.slug, g]));
  const stats = { photos: 0, written: 0, removed: 0 };

  const galleries = [];
  for (const cat of categories) {
    const srcDir = path.join(PHOTOS_DIR, cat.slug);
    const outDir = path.join(IMG_OUT, cat.slug);
    await fs.mkdir(outDir, { recursive: true });

    const prev = prevGallery.get(cat.slug) ?? {};
    // Only keep alt text a person wrote (it differs from the generated `autoAlt`);
    // generated text is regenerated each run.
    const prevAlt = new Map([...(prev.images ?? []), ...(prev.cover ? [prev.cover] : [])]
      .filter((i) => i.alt && i.alt !== i.autoAlt)
      .map((i) => [i.file, i.alt]));
    // Alt text priority: Lightroom caption, then your edit in galleries.json, then the filename.
    const captions = await readCaptions(srcDir);
    for (const [file, caption] of captions) prevAlt.set(file, caption);
    const title = prev.title ?? cat.title;

    const files = await listImages(srcDir);
    const coverFile = files.find((f) => /^cover\./i.test(f));
    const keep = new Set();
    const usedBases = new Set();

    let cover = null;
    if (coverFile) {
      const r = await processImage(path.join(srcDir, coverFile), outDir, 'cover');
      r.files.forEach((f) => keep.add(f));
      stats.written += r.wrote;
      stats.photos++;
      usedBases.add('cover');
      const autoAlt = `${title} gallery cover`;
      cover = { file: coverFile, alt: prevAlt.get(coverFile) ?? autoAlt, autoAlt, ...r.record };
    }

    const images = [];
    for (const file of files) {
      if (file === coverFile) continue;
      let base = slugify(path.parse(file).name);
      if (usedBases.has(base)) base = `${base}-${slugify(path.extname(file))}`;
      usedBases.add(base);

      const r = await processImage(path.join(srcDir, file), outDir, base);
      r.files.forEach((f) => keep.add(f));
      stats.written += r.wrote;
      stats.photos++;
      const autoAlt = altFromFilename(file, title, images.length + 1);
      images.push({ file, alt: prevAlt.get(file) ?? autoAlt, autoAlt, ...r.record });
    }

    stats.removed += await pruneDir(outDir, keep);
    galleries.push({
      slug: cat.slug,
      title,
      description: prev.description ?? cat.description,
      cover,
      images,
    });
  }

  // About photo: photos/about/me.jpg (any image extension works).
  let about = null;
  {
    const srcDir = path.join(PHOTOS_DIR, ABOUT_SLUG);
    const outDir = path.join(IMG_OUT, ABOUT_SLUG);
    await fs.mkdir(outDir, { recursive: true });
    const me = (await listImages(srcDir)).find((f) => /^me\./i.test(f));
    const keep = new Set();
    if (me) {
      const r = await processImage(path.join(srcDir, me), outDir, 'me');
      r.files.forEach((f) => keep.add(f));
      stats.written += r.wrote;
      stats.photos++;
      const caption = (await readCaptions(srcDir)).get(me);
      const alt = caption ?? (previous.about?.file === me ? previous.about.alt : 'Portrait of Razan Ahmad');
      about = { file: me, alt, ...r.record };
    }
    stats.removed += await pruneDir(outDir, keep);
  }

  // Open Graph image: 1200x630 crop of the Travel/Portraits cover.
  const ogFile = path.join(IMG_OUT, 'og.jpg');
  const ogSource = galleries.find((g) => g.slug === 'travel-portraits')?.cover;
  let og = null;
  if (ogSource) {
    const src = path.join(PHOTOS_DIR, 'travel-portraits', ogSource.file);
    if ((await mtime(ogFile)) < (await mtime(src))) {
      await sharp(src).rotate()
        .resize(OG_SIZE.width, OG_SIZE.height, { fit: 'cover', position: sharp.strategy.attention })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(ogFile);
    }
    og = { path: 'img/og.jpg', ...OG_SIZE };
  } else {
    await fs.rm(ogFile, { force: true });
  }

  const data = {
    _note: 'Generated by `npm run images` from the photos/ folders. You can edit alt text, titles and descriptions here; your edits are kept on the next run (autoAlt is the generated fallback, leave it as is). Captions set in Lightroom take priority.',
    og,
    about,
    galleries,
  };
  await fs.writeFile(GALLERIES_JSON, JSON.stringify(data, null, 2) + '\n');

  const empty = galleries.filter((g) => !g.cover && g.images.length === 0).map((g) => g.slug);
  console.log(`Images: ${stats.photos} photos, ${stats.written} files written, ${stats.removed} stale files removed.`);
  if (!about) console.log('  No photos/about/me.* yet: About photo will show a placeholder.');
  if (empty.length) console.log(`  No photos yet for: ${empty.join(', ')} (placeholders will be shown).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
