import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';

// GitHub's branch-publishing mode supports /docs. Keep the human-written guides;
// replace only generated entries so old hashed chunks don't accumulate.
const directories = new Set(['assets', 'vendor', 'art']);
const files = new Set([
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'sample.pdf',
  'icon-192.png',
  'icon-512.png',
  'mark.svg',
  'QPDF-NOTICE.txt',
]);
const entries = await readdir('dist', { withFileTypes: true });
for (const entry of entries) {
  if (!(entry.isDirectory() ? directories : files).has(entry.name)) {
    throw Error(`Unrecognized build output: ${entry.name}. Review it before publishing.`);
  }
}
await mkdir('docs', { recursive: true });
for (const name of [...directories, ...files])
  await rm(`docs/${name}`, { recursive: true, force: true });
for (const { name } of entries) await cp(`dist/${name}`, `docs/${name}`, { recursive: true });
await writeFile('docs/.nojekyll', '');
console.log('GitHub Pages site ready in docs/. Publish main → /docs in Settings → Pages.');
