// Compresses video/banner.mp4 into site/video/: a 1080p and a 720p H.264 MP4 with no
// audio, plus a poster image from the first frame. Skips work that is already up to date.

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

const h264 = (height, crf, maxrate) => [
  '-map', '0:v:0', '-an', '-dn', '-sn', '-map_metadata', '-1',
  '-vf', `scale=-2:'min(${height},ih)'`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
  '-maxrate', maxrate, '-bufsize', maxrate.replace(/\d+/, (n) => String(n * 2)),
  '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
];

const jobs = [
  { file: 'banner.mp4', args: (out) => ['-i', SRC, ...h264(1080, 23, '6M'), out] },
  { file: 'banner-720.mp4', args: (out) => ['-i', SRC, ...h264(720, 25, '3M'), out] },
  { file: 'banner-poster.jpg', args: (out) => ['-i', SRC, '-frames:v', '1', '-vf', "scale=-2:'min(1080,ih)'", '-q:v', '3', out] },
];

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

  for (const job of jobs) {
    const { size } = await fs.stat(path.join(OUT, job.file));
    console.log(`  ${job.file}: ${(size / 1024 / 1024).toFixed(2)} MB`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
