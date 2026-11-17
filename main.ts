// Hand-in program for the makefun-frontend-01 entry (Node 22, standard library only).
//
// The product is the static frontend in app/ (index.html plus ES modules and one
// stylesheet, no build step) reading make.fun's public API at https://make.fun/api.
// This program delivers it: it copies app/ and screenshots/ from beside this file
// into the output directory and writes dossier.json there with the vendored
// make.fun library, byte for byte as the scorer's own copy would write it.
// vendor/makefun-frontend.ts is the kit's file and stays unchanged.
//
// Run locally (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the app itself with: node serve.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, DOSSIER_MAX_BYTES } from './vendor/makefun-frontend.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps mirror the scorer's gate: text_max_bytes shapes the dossier text,
// the rest refuse an entry the scorer would refuse anyway (over 3 screenshots,
// one screenshot over 256 KiB, or an app/ past 993 entries / 16 MiB).
const CAPS = { text_max_bytes: 163840, screenshots: { max: 3, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 16777216 };

/** Step 1: copy the deliverables (app/ and screenshots/) beside the output. */
function copyDeliverables() {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoDir, 'app'), join(outputDir, 'app'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  if (existsSync(join(repoDir, 'screenshots'))) {
    cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
  }
}

/** Step 2: build the dossier from the copied tree and write it out. */
function writeDossier() {
  const dossier = buildDossier(outputDir, CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

// Post-build self-check: re-read what was actually handed in and refuse to
// finish quietly if any of it sits outside the caps the scorer enforces, so
// a bad hand-in fails here — loudly, with the numbers — instead of at grading.
// The dossier's own Totals line is printed verbatim as the run's summary.
function selfCheck(dir) {
  const problems = [];
  const raw = readFileSync(join(dir, 'dossier.json'));
  if (raw.length > DOSSIER_MAX_BYTES) {
    problems.push(`dossier.json is ${raw.length} bytes, over the ${DOSSIER_MAX_BYTES} the dossier may hold`);
  }
  const parsed = JSON.parse(raw.toString('utf8'));
  const totals = String(parsed.text ?? '').split('\n').find((line) => line.startsWith('Totals:'));
  if (!totals) problems.push('dossier text holds no Totals line');
  const shotsDir = join(dir, 'screenshots');
  const shots = existsSync(shotsDir) ? readdirSync(shotsDir).sort() : [];
  if (shots.length > CAPS.screenshots.max) {
    problems.push(`${shots.length} screenshots, over the ${CAPS.screenshots.max} allowed`);
  }
  for (const name of shots) {
    const bytes = readFileSync(join(shotsDir, name));
    if (bytes.length > CAPS.screenshots.max_bytes) {
      problems.push(`screenshots/${name} is ${bytes.length} bytes, over the ${CAPS.screenshots.max_bytes} allowed`);
    }
    // A screenshot the scorer cannot decode is worse than a missing one:
    // check the magic bytes, not just the file name's extension.
    const isJpeg = bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
    const isPng = bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    if (!isJpeg && !isPng) {
      problems.push(`screenshots/${name} is neither JPEG nor PNG by its first bytes`);
    }
  }
  if (Array.isArray(parsed.images) && parsed.images.length !== shots.length) {
    problems.push(`dossier holds ${parsed.images.length} images but screenshots/ holds ${shots.length} files`);
  }
  if (problems.length > 0) {
    throw new Error(`hand-in self-check failed:\n - ${problems.join('\n - ')}`);
  }
  console.log(totals);
  console.log(`Self-check OK: dossier.json ${raw.length} bytes, ${shots.length} screenshot(s) within caps.`);
}

/** The hand-in, in order: copy the deliverables, write the dossier, verify it. */
function main() {
  copyDeliverables();
  writeDossier();
  selfCheck(outputDir);
}

main();
