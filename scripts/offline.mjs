import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

async function list(dir) {
  const out = [];
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const path = dir + '/' + f.name;
    if (f.isDirectory()) out.push(...(await list(path)));
    else if (f.name !== 'sw.js') out.push(path);
  }
  return out;
}
const files = (await list('dist')).sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(await readFile(f));
const relative = files.map((f) => f.slice('dist/'.length));
// A Pages account can host several projects on one origin. Never claim another
// project's navigation or delete its cache. Cache only assets from this build.
await writeFile(
  'dist/sw.js',
  `
const ROOT = self.registration.scope;
const PREFIX = 'pdf-studio:' + new URL(ROOT).pathname + ':';
const CACHE = PREFIX + '${hash.digest('hex').slice(0, 16)}';
const ASSETS = new Set(${JSON.stringify(relative)}.map(name => new URL(name, ROOT).href));
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll([...ASSETS]);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) {
    if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
  }
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(ROOT)) return;
  const url = new URL(request.url);
  url.search = ''; url.hash = '';
  const href = url.href === ROOT ? new URL('index.html', ROOT).href : url.href;
  if (!ASSETS.has(href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(href)) || fetch(request)));
});
`,
);
console.log(`Offline bundle: ${relative.length} project-scoped assets.`);
