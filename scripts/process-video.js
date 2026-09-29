// Compresses video/banner.mp4 into site/video/: a 1080p H.264 MP4 for wide screens and a
// vertical 9:16 crop at full source height for phones (phones only show the middle slice
// of a wide video, so a dedicated crop keeps it sharp), each with a poster image from the
// first frame. No audio. Skips work that is already up to date.

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { VIDEO_DIR, SITE_DIR } from './lib/config.js';

const SRC = path.join(VIDEO_DIR, 'banner.mp4');
const OUT = path.join(SITE_DIR, 'video');

const mtime = (p) => fs.stat(p).then((s) => s.mtimeMs, () => 0);

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.error?.code === 'ENOENT') {
    throw new Error('ffmpeg was not found on PATH. Install it (winget install Gyan.FFmpeg) and open a new terminal.');
  }
  if (r.status !== 0) throw new Error(`ffmpeg exited with code ${r.status}`);
}

// Centre 9:16 slice at the source's full height: the same framing phones show today.
const PORTRAIT_CROP = 'crop=trunc(ih*9/16/2)*2:ih';

const h264 = (filter, crf, maxrate) => [
  '-map', '0:v:0', '-an', '-dn', '-sn', '-map_metadata', '-1',
  '-vf', filter,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
  '-maxrate', maxrate, '-bufsize', maxrate.replace(/\d+/, (n) => String(n * 2)),
  '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
];

const jobs = [
  { file: 'banner.mp4', args: (out) => ['-i', SRC, ...h264("scale=-2:'min(1080,ih)'", 23, '6M'), out] },
  { file: 'banner-portrait.mp4', args: (out) => ['-i', SRC, ...h264(PORTRAIT_CROP, 22, '5M'), out] },
  { file: 'banner-poster.jpg', args: (out) => ['-i', SRC, '-frames:v', '1', '-vf', "scale=-2:'min(1080,ih)'", '-q:v', '3', out] },
  { file: 'banner-poster-portrait.jpg', args: (out) => ['-i', SRC, '-frames:v', '1', '-vf', PORTRAIT_CROP, '-q:v', '3', out] },
];

// Outputs from earlier versions of this script that are no longer used.
const RETIRED = ['banner-720.mp4'];

async function main() {
  const srcTime = await mtime(SRC);
  if (!srcTime) {
    console.log('Video: no video/banner.mp4 found, skipping.');
    return;
  }
  await fs.mkdir(OUT, { recursive: true });

  for (const job of jobs) {
    const out = path.join(OUT, job.file);
    if ((await mtime(out)) >= srcTime) continue;
    console.log(`Video: writing ${job.file}...`);
    ffmpeg(job.args(out));
  }

  for (const file of RETIRED) await fs.rm(path.join(OUT, file), { force: true });

  for (const job of jobs) {
    const { size } = await fs.stat(path.join(OUT, job.file));
    console.log(`  ${job.file}: ${(size / 1024 / 1024).toFixed(2)} MB`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
