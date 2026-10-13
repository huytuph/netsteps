import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
const html = await readFile('dist/index.html', 'utf8');
const files = (await readdir('dist/assets')).filter((x) => /\.(js|css)$/.test(x));
const js = files.find((x) => x.endsWith('.js')),
  css = files.find((x) => x.endsWith('.css'));
if (!js || !css) throw new Error('Expected one bundled script and stylesheet.');
let script = await readFile(`dist/assets/${js}`, 'utf8');
// The inline bundle uses file: URLs directly; it does not need module preloading.
script = script.replace(/<\/script/gi, '<\\/script');
const style = await readFile(`dist/assets/${css}`, 'utf8');
const portable = html
  .replace(
    /<script\b[^>]*src="[^"]+"[^>]*><\/script>/,
    () => '<script type="module">' + script + '</script>',
  )
  .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/, () => '<style>' + style + '</style>')
  .replace(/<link\b[^>]*rel="(?:modulepreload|manifest|icon)"[^>]*>/g, '');
await writeFile('dist/offline.html', portable);
// Keep the served entry atomic too: no split bundle requests are needed on an offline visit.
await writeFile('dist/index.html', portable);
const assets = [
  './',
  './index.html',
  './offline.html',
  './favicon.svg',
  './manifest.webmanifest',
  ...files.map((x) => './assets/' + x),
];
const version = createHash('sha256')
  .update(script + style + 'cache-v2')
  .digest('hex')
  .slice(0, 16);
const worker = `const CACHE='network-study-${version}';
const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(asset=>new Request(asset,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('network-study-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(e.request);
    if (hit) return hit;
    return fetch(e.request).catch(() => e.request.mode === 'navigate' ? cache.match('./index.html') : Response.error());
  }));
});
`;
new Script(worker, { filename: 'sw.js' });
await writeFile('dist/sw.js', worker);
console.log('Built self-contained dist/offline.html and offline service-worker cache.');
