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
const files = await list('dist'),
  hash = createHash('sha256');
for (const f of files) hash.update(await readFile(f));
const version = 'pdf-studio-' + hash.digest('hex').slice(0, 12);
const urls = files.map((f) => f.slice(4));
await writeFile(
  'dist/sw.js',
  `const VERSION=${JSON.stringify(version)}, ASSETS=${JSON.stringify(urls)};\nself.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(VERSION);await c.addAll(ASSETS);await self.skipWaiting()})()));\nself.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('pdf-studio-')&&k!==VERSION)await caches.delete(k);await self.clients.claim()})()));\nself.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const path=e.request.mode==='navigate'?'/index.html':u.pathname;if(ASSETS.includes(path))e.respondWith(caches.open(VERSION).then(async c=>(await c.match(path))||fetch(e.request)))})`,
);
console.log(`Offline bundle: ${urls.length} local assets.`);
