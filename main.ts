// main.ts — the hand-in program for this make.fun frontend. Node 22,
// standard library only, no build step, no network.
// What it does: the app is the static site under app/, plain files a
// browser opens at app/index.html while reading make.fun's public API.
// This program copies app/ and screenshots/ from beside itself into the
// output directory (MAKEFUN_OUTPUT_DIR, or /output in the grader's
// container) and writes dossier.json there with buildDossier from the
// vendored make.fun library — byte for byte what the scorer's own copy
// writes from the same files, which is why vendor/makefun-frontend.ts is
// never edited.
// Then it checks its own hand-in before it ever reaches a gate: the
// scorer's caps, whole JPEG or PNG screenshots inside their bounds, the
// dossier text inside its cap, and the Totals line printed for the log.
// Running it twice must write the same bytes both times, so it proves the
// dossier is a pure function of the files handed in by building it a
// second time from the output as written.

import { existsSync, readFileSync, writeFileSync, cpSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { buildDossier as makeDossier } from './vendor/makefun-frontend.ts';
import { fileURLToPath as urlToPath } from 'node:url';
import { join as joinPath } from 'node:path';

// The scorer's limits, mirrored so a bad hand-in fails here first with a
// clear word.
const LIMITS = {
  screenshots: { max: 3, max_bytes: 262144 }, // at most 3 shots of 256 KiB each
  app_max_files: 993, // at most 993 files and directories under app/
  app_max_bytes: 16777216, // at most 16 MiB under app/
  text_max_bytes: 163840, // dossier text cap
}; // LIMITS

const REQUIRED_APP_FILES = ['index.html', 'main.js', 'api.js', 'format.js', 'views-leaderboard.js', 'views-profile.js', 'style.css'];

const die = (message) => { throw new Error(`self-check: ${message}`); };

const sameBytes = (a, b) => a.length === b.length && a.every((byte, i) => byte === b[i]);

// A PNG stores its dimensions in the IHDR chunk, big-endian at bytes 16..24.
const pngDimensions = (bytes) => {
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = header.getUint32(16);
  const height = header.getUint32(20);
  return { width, height };
}; // pngDimensions

// A JPEG stores its dimensions in a start-of-frame segment; scan the
// markers until one turns up (SOF0/SOF1/SOF2 carry the frame header).
const jpegDimensions = (bytes) => {
  let pos = 2;
  while (pos + 9 < bytes.length) {
    if (bytes[pos] !== 0xff) die('malformed JPEG');
    const code = bytes[pos + 1];
    const length = bytes[pos + 2] * 256 + bytes[pos + 3];
    if (code === 0xc0 || code === 0xc1 || code === 0xc2) {
      const height = bytes[pos + 5] * 256 + bytes[pos + 6];
      const width = bytes[pos + 7] * 256 + bytes[pos + 8];
      return { width, height };
    } // SOF marker
    pos += 2 + length;
  } // markers
  die('no frame header in JPEG');
}; // jpegDimensions

// The two screenshot formats, read off the first bytes: JPEG starts
// 0xff 0xd8, PNG starts with its 8-byte signature (checked on the first
// four bytes, which is enough to tell it from a JPEG).
const shotKind = (bytes) => {
  const head = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (head.getUint16(0) === 0xffd8) return 'jpeg';
  if (head.getUint32(0) === 0x89504e47) return 'png';
  return null;
}; // shotKind

const checkShots = (destDir) => {
  const shotsDir = joinPath(destDir, 'screenshots');
  const isShotName = (n) => !n.startsWith('.');
  const shotNames = readdirSync(shotsDir).filter(isShotName).sort();
  if (!shotNames.length) die('no screenshots handed in');
  if (shotNames.length > LIMITS.screenshots.max) die(`${shotNames.length} screenshots, the cap is ${LIMITS.screenshots.max}`);
  const report = [];
  for (let i = 0; i < shotNames.length; i++) {
    const shot = shotNames[i];
    const shotBytes = readFileSync(joinPath(shotsDir, shot));
    if (shotBytes.length > LIMITS.screenshots.max_bytes) die(`${shot} is ${shotBytes.length} bytes, over the 256 KiB cap`);
    const kind = shotKind(shotBytes);
    if (kind === null) die(`${shot} is neither a JPEG nor a PNG`);
    const { width, height } = kind === 'jpeg' ? jpegDimensions(shotBytes) : pngDimensions(shotBytes);
    const longest = Math.max(width, height);
    const shortest = Math.min(width, height);
    if (longest > 1280 || shortest < 360) die(`${shot} is ${width}x${height}, outside the screenshot bounds`);
    report.push(`${shot} ${width}x${height} ${shotBytes.length} B`);
  } // shots
  return report;
}; // checkShots

// Walk app/ with an explicit stack instead of recursion: count every file
// and directory, and add up the files' bytes.
const tallyApp = (root, total) => {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = joinPath(dir, item.name);
      total.entries += 1;
      if (item.isDirectory()) stack.push(path);
      else total.bytes += statSync(path).size;
    } // entries
  } // stack
  return total;
}; // tallyApp

const handIn = () => {
  const here = new URL('.', import.meta.url);
  const sourceRoot = urlToPath(here);
  const destDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  if (destDir === sourceRoot) die('output directory must differ from the repository root');
  console.log(`Handing in from ${sourceRoot} to ${destDir}`);
  const copyTree = (from, to) => cpSync(from, to, { recursive: true });
  mkdirSync(destDir, { recursive: true });
  copyTree(joinPath(sourceRoot, 'app'), joinPath(destDir, 'app'));
  const shotsSrc = joinPath(sourceRoot, 'screenshots');
  const shotsDst = joinPath(destDir, 'screenshots');
  mkdirSync(shotsDst, { recursive: true });
  if (existsSync(shotsSrc)) copyTree(shotsSrc, shotsDst);

  // The copy is the hand-in: if an entry file did not land, fail now with
  // its name instead of handing the scorer an app with a hole in it.
  let verified = 0;
  for (const needed of REQUIRED_APP_FILES) {
    if (!existsSync(joinPath(destDir, 'app', needed))) die(`app/${needed} missing from the output`);
    verified += 1;
  } // required files
  console.log(`Verified ${verified} entry files in the output`);

  const dossier = makeDossier(destDir, LIMITS);
  if (dossier.length === 0) die('buildDossier wrote an empty dossier');
  writeFileSync(joinPath(destDir, 'dossier.json'), dossier);

  // Read the file back: a dossier.json on disk that differs from the bytes
  // just built (a partial write, a stray process) must fail here, not at
  // the gate.
  if (!sameBytes(readFileSync(joinPath(destDir, 'dossier.json')), dossier)) {
    die('dossier.json on disk differs from the dossier just built');
  } // read-back

  // Prove the dossier is a pure function of the files handed in: build it
  // again from the output as written and compare. A mismatch is a failure
  // now, not a surprise at the gate.
  if (!sameBytes(makeDossier(destDir, LIMITS), dossier)) {
    die('rebuilding the dossier from the output gave different bytes');
  } // rebuild

  const shots = checkShots(destDir);
  const app = tallyApp(joinPath(destDir, 'app'), { entries: 0, bytes: 0 });
  if (app.entries > LIMITS.app_max_files) die(`app/ holds ${app.entries} entries, over the cap`);
  if (app.bytes > LIMITS.app_max_bytes) die(`app/ is ${app.bytes} bytes, over the cap`);

  // The dossier is a JSON document; its text field opens with the Load
  // block, whose first line is the Totals line this hand-in is judged by.
  // The text itself must also fit the scorer's cap, or the hand-in is too
  // big to grade.
  const dossierJson = JSON.parse(new TextDecoder().decode(dossier));
  const dossierText = dossierJson.text;
  if (typeof dossierText !== 'string' || dossierText.length === 0) {
    die('the dossier holds no text to grade');
  } // text present
  if (new TextEncoder().encode(dossierText).length > LIMITS.text_max_bytes) {
    die(`dossier text is over the ${LIMITS.text_max_bytes} byte cap`);
  } // text fits
  const dossierLines = String(dossierText).split('\n');
  const totals = dossierLines.find((line) => line.startsWith('Totals:'));
  if (totals === undefined) die('the dossier text holds no Totals line');
  console.log(`Handed in app/ (${app.entries} entries, ${app.bytes} bytes / ${(app.bytes / 1024).toFixed(1)} KiB) and ${shots.length} screenshots: ${shots.join('; ')}`);
  console.log(`dossier.json: ${dossier.length} bytes`);
  console.log(`Totals line: ${totals}`);
}; // handIn

handIn();
