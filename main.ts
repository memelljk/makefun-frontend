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

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's gate: text_max_bytes shapes the dossier text,
// the rest refuse an entry the scorer would refuse anyway (over 3 screenshots,
// one screenshot over 256 KiB, or an app/ past 993 entries / 16 MiB).
const dossier = buildDossier(outputDir, { text_max_bytes: 163840, screenshots: { max: 3, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 16777216 });
writeFileSync(join(outputDir, 'dossier.json'), dossier);
