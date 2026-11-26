/* sw.js — Estante do PC (service worker).
   - Imagens (capas e capturas da Steam): cache primeiro. Abriu uma vez, nunca mais baixa. Busca em modo CORS
     (a Steam manda Access-Control-Allow-Origin: *), para o navegador contar o tamanho real e não uns 7 MB por imagem.
     Os pacotes de capas (estante-pc-capas, fora do escopo deste site) não passam por aqui: o app guarda cada capa.
   - Dados (dados/lista_NN.js e ficha_NN.js) e arquivos do app (app.js, estilo.css...): mostra o guardado na hora
     e atualiza por trás (stale-while-revalidate). Guarda só a versão mais nova de cada arquivo.
   - A página (index.html): rede primeiro, com 3 s de espera; sem internet, abre a última guardada.
   O nome do cache de imagens ("epc-img-v1") é o mesmo que o app.js usa no "Guardar capas". */
var CASCA = 'epc-casca-v1';
var DADOS = 'epc-dados-v1';
var IMG = 'epc-img-v1';
var TODOS = [CASCA, DADOS, IMG];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CASCA).then(function (c) {
    return c.addAll(['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']);
  }).catch(function () {}));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('epc-') === 0 && TODOS.indexOf(k) < 0; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () {
    // as capas pequenas do wsrv.nl (versão antiga) não servem mais: sai do cache
    return caches.open(IMG).then(function (c) {
      return c.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.url.indexOf('https://wsrv.nl/') === 0; }).map(function (k) { return c.delete(k); })); });
    }).catch(function () {});
  }).then(function () { return self.clients.claim(); }));
});

function ehImagem(req, url) {
  if (req.destination === 'image') return true;
  return /steamstatic\.com$/.test(url.hostname) && /\.(jpg|jpeg|png|webp|gif)$/i.test(url.pathname);
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  if (ehImagem(req, url) && url.origin !== self.location.origin) { e.respondWith(imagem(req)); return; }
  if (url.origin === self.location.origin) {
    if (url.href.indexOf(self.registration.scope) !== 0) return; // fora do site (ex.: /estante-pc-capas/): direto na rede
    if (req.mode === 'navigate') { e.respondWith(paginaRede(e)); return; }
    e.respondWith(swr(e, /\/dados\//.test(url.pathname) ? DADOS : CASCA));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(swr(e, CASCA));
});

// capas e capturas da Steam: cache primeiro. As capas dos pacotes (WebP) já entram no cache com a URL da Steam
// como chave (o app.js faz isso no "Guardar capas"), então o card recebe a WebP guardada sem ir à internet.
function imagem(req) {
  return caches.open(IMG).then(function (c) {
    return c.match(req.url).then(function (r) {
      if (r) return r;
      return fetch(req.url, { mode: 'cors', credentials: 'omit' }).then(function (resp) {
        if (resp.ok) c.put(req.url, resp.clone()).catch(function () {});
        return resp;
      }).catch(function () { return fetch(req); }); // sem CORS: entrega sem guardar
    });
  });
}

// guarda a resposta e apaga as versões antigas do mesmo arquivo (mesmo caminho, outro ?v=)
function guardar(c, req, resp) {
  var u = new URL(req.url);
  return c.put(req, resp).then(function () {
    return c.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) {
        var x = new URL(k.url);
        return x.origin === u.origin && x.pathname === u.pathname && x.search !== u.search;
      }).map(function (k) { return c.delete(k); }));
    });
  }).catch(function () {});
}

function swr(e, nome) {
  var req = e.request;
  return caches.open(nome).then(function (c) {
    return c.match(req).then(function (r) {
      var rede = fetch(req).then(function (resp) {
        if (resp.ok) e.waitUntil(guardar(c, req, resp.clone()));
        return resp;
      });
      if (r) { e.waitUntil(rede.catch(function () {})); return r; }
      return rede;
    });
  });
}

function paginaRede(e) {
  var req = e.request;
  return caches.open(CASCA).then(function (c) {
    // 1.7.6: pede a página sem o cache do navegador (o GitHub manda guardar por 10 min e o celular via a versão velha)
    var rede = fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }).then(function (resp) {
      if (resp.ok) e.waitUntil(c.put(req, resp.clone()).catch(function () {}));
      return resp;
    });
    var reserva = function () {
      return c.match(req, { ignoreSearch: true }).then(function (r) { return r || c.match(new URL('./', self.registration.scope).href); });
    };
    var espera = new Promise(function (ok) { setTimeout(ok, 3000); }).then(reserva);
    // o que chegar primeiro com resposta: a rede, ou o guardado depois de 3 s
    return Promise.race([rede.catch(reserva), espera.then(function (r) { return r || rede; })]).then(function (r) {
      return r || rede;
    }).catch(function () { return reserva(); });
  });
}
