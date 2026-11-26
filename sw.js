/* sw.js — Estante do PC (service worker).
   - Imagens (capas pequenas do wsrv.nl, capas e capturas da Steam): cache primeiro. Abriu uma vez, nunca mais baixa.
     Busca em modo CORS (os dois servidores mandam Access-Control-Allow-Origin: *), para o navegador contar o
     tamanho real e não uns 7 MB por imagem.
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
  }).then(function () { return self.clients.claim(); }));
});

function ehImagem(req, url) {
  if (req.destination === 'image') return true;
  if (url.hostname === 'wsrv.nl') return true;
  return /steamstatic\.com$/.test(url.hostname) && /\.(jpg|jpeg|png|webp|gif)$/i.test(url.pathname);
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  if (ehImagem(req, url) && url.origin !== self.location.origin) { e.respondWith(imagem(req)); return; }
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') { e.respondWith(paginaRede(e)); return; }
    e.respondWith(swr(e, /\/dados\//.test(url.pathname) ? DADOS : CASCA));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') e.respondWith(swr(e, CASCA));
});

// capa pequena do wsrv.nl -> endereço da original na Steam (o parâmetro url)
function origDeMini(u) {
  try { var x = new URL(u); if (x.hostname !== 'wsrv.nl') return ''; var o = x.searchParams.get('url'); return o ? 'https://' + o.replace(/^https?:\/\//, '') : ''; }
  catch (e) { return ''; }
}
// se o wsrv.nl recusar (fora do ar ou limite por IP, erro 403/1106), usa a original da Steam por 10 minutos
var wsrvForaAte = 0;
function buscar(u) { return fetch(u, { mode: 'cors', credentials: 'omit' }); }
function imagem(req) {
  return caches.open(IMG).then(function (c) {
    return c.match(req.url).then(function (r) {
      if (r) return r;
      var orig = origDeMini(req.url);
      var pegaOrig = function () {
        return buscar(orig).then(function (r2) {
          if (r2.ok) c.put(req.url, r2.clone()).catch(function () {}); // guarda a original no lugar da pequena
          return r2;
        });
      };
      if (orig && Date.now() < wsrvForaAte) return pegaOrig();
      return buscar(req.url).then(function (resp) {
        if (resp.ok) { c.put(req.url, resp.clone()).catch(function () {}); return resp; }
        if (orig) { wsrvForaAte = Date.now() + 600000; return pegaOrig(); }
        return resp;
      }).catch(function () {
        if (orig) { wsrvForaAte = Date.now() + 600000; return pegaOrig(); }
        return fetch(req); // sem CORS: entrega sem guardar
      });
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
    var rede = fetch(req).then(function (resp) {
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
