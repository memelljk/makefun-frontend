// main.ts — the hand-in program for this make.fun frontend (Node 22,
// standard library only, no build step, no network).
//
// The app itself is the static site under app/: plain files a browser opens
// at app/index.html, reading make.fun's public API. This program copies app/
// and screenshots/ from beside itself into the output directory
// (MAKEFUN_OUTPUT_DIR, or /output in the grader's container) and writes
// dossier.json there with buildDossier from the vendored make.fun library —
// byte for byte what the scorer's own copy writes from the same files, which
// is why vendor/makefun-frontend.ts is never edited.
//
// After the copy it self-checks what it handed in: the scorer's caps hold,
// every screenshot is a whole JPEG or PNG, and it prints the dossier's
// Totals line so a run's first-load size is visible in the log.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, mirrored so a bad hand-in fails here first with a clear
// word instead of at the gate: at most 3 screenshots of 256 KiB each, at
// most 993 files and directories and 16 MiB under app/, dossier text capped.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 3, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
};

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossier);

// The program runs twice in the grader and both runs must write the same
// bytes. Prove the dossier is a pure function of the files handed in by
// building it a second time from the output as written and comparing: a
// mismatch here is a failure now, not a surprise at the gate.
const rebuilt = buildDossier(out, CAPS);
const sameBytes = rebuilt.length === dossier.length && rebuilt.every((b, i) => b === dossier[i]);
if (!sameBytes) throw new Error('self-check: rebuilding the dossier from the output gave different bytes');

// --- post-build self-check -------------------------------------------------

function checkScreenshots() {
  const dir = join(out, 'screenshots');
  const names = readdirSync(dir).filter((n) => !n.startsWith('.')).sort();
  if (names.length > CAPS.screenshots.max) {
    throw new Error('self-check: ' + names.length + ' screenshots, the cap is ' + CAPS.screenshots.max);
  }
  for (const name of names) {
    const bytes = readFileSync(join(dir, name));
    if (bytes.length > CAPS.screenshots.max_bytes) {
      throw new Error('self-check: ' + name + ' is ' + bytes.length + ' bytes, over the 256 KiB cap');
    }
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (!jpeg && !png) throw new Error('self-check: ' + name + ' is neither a JPEG nor a PNG');
  }
  return names;
}

function countApp(dir, prefix, acc) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = prefix + entry.name;
    acc.entries += 1;
    if (entry.isDirectory()) countApp(join(dir, entry.name), path + '/', acc);
    else acc.bytes += statSync(join(dir, entry.name)).size;
  }
  return acc;
}

const shots = checkScreenshots();
const app = countApp(join(out, 'app'), '', { entries: 0, bytes: 0 });
if (app.entries > CAPS.app_max_files) throw new Error('self-check: app/ holds ' + app.entries + ' entries, over the cap');
if (app.bytes > CAPS.app_max_bytes) throw new Error('self-check: app/ is ' + app.bytes + ' bytes, over the cap');

const totalsLine = new TextDecoder().decode(dossier).split('\n').find((l) => l.startsWith('Totals:'));
console.log('Handed in app/ (' + app.entries + ' entries, ' + app.bytes + ' bytes) and ' + shots.length + ' screenshots: ' + shots.join(', '));
console.log(totalsLine ?? 'Totals line not found in the dossier');
