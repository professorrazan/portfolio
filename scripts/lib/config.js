import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PHOTOS_DIR = path.join(ROOT, 'photos');
export const VIDEO_DIR = path.join(ROOT, 'video');
export const SRC_DIR = path.join(ROOT, 'src');
export const SITE_DIR = path.join(ROOT, 'site');
export const IMG_OUT = path.join(SITE_DIR, 'img');
export const GALLERIES_JSON = path.join(ROOT, 'galleries.json');

export const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

// Gallery order, folder names, titles and descriptions from the brief.
// `hint` is only used for the grey placeholder boxes until real photos exist.
export const categories = [
  { slug: 'travel-portraits', title: 'Travel/Portraits', description: 'People and places on the road', hint: 'Cover · travel portrait' },
  { slug: 'graduation', title: 'Graduation', description: 'Individual, family & group sessions', hint: 'Cover · cap toss or gown portrait' },
  { slug: 'events', title: 'Events', description: 'Celebrations, launches & parties', hint: 'Cover · event moment' },
  { slug: 'couple-group', title: 'Couple/Group', description: 'Couples, friends & families', hint: 'Cover · couple or group' },
  { slug: 'fashion-concept', title: 'Fashion/Concept Shoots', description: 'RGB, gel & creative concepts', hint: 'Cover · RGB-lit portrait', accent: true },
  { slug: 'cars', title: 'Cars', description: 'Automotive & detail shots', hint: 'Cover · hero car shot' },
  { slug: 'architecture', title: 'Architecture', description: 'Buildings, lines & light', hint: 'Cover · building or interior' },
  { slug: 'sports-events', title: 'Sports Events', description: 'Action on game day', hint: 'Cover · peak action' },
];

export const ABOUT_SLUG = 'about';
