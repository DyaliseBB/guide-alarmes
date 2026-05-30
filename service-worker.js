const CACHE = 'guide-nxstage-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './alarmes.json',
  './procedures.json',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './photos/affichage-123.jpg',
  './photos/affichage-888.jpg',
  './photos/barres.jpg',
  './photos/capteur-arteriel.jpg',
  './photos/cassette-cycler.jpg',
  './photos/clamp-1.jpg',
  './photos/clamp-2.jpg',
  './photos/clamp-3.jpg',
  './photos/clamp-4.jpg',
  './photos/clamp-rein.jpg',
  './photos/cycler-sous-tension.jpg',
  './photos/debuller-rein.jpg',
  './photos/mise-en-place-seringue-rein.jpg',
  './photos/noeud.jpg',
  './photos/parametres.jpg',
  './photos/pieuvre.jpg',
  './photos/poche-dialysat.jpg',
  './photos/preparer-cassette.jpg',
  './photos/raccord.jpg',
  './photos/remplissage.jpg',
  './photos/seringue-rein.jpg',
  './photos/serum.jpg',
  './photos/touche-silence.jpg',
  './photos/touche-stop.jpg',
  './photos/traitement.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(ASSETS.map(a => c.add(a).catch(err => console.warn('SW cache miss', a, err))))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // network-first pour les fichiers JSON (donnees toujours fraiches), cache-first pour tout le reste
  if (req.url.endsWith('alarmes.json') || req.url.endsWith('procedures.json')) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req))
    );
  } else {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return resp;
      }))
    );
  }
});
