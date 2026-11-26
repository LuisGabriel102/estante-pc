/* app.js — Estante do PC (JavaScript puro, sem bibliotecas).
   Tela inicial: CATÁLOGO em seções empilhadas (Para você, Joias escondidas, Roda liso, Dublados, Romance, Steam Deck
   e uma por gênero), cada uma com 2 linhas de cards e "Ver todos (N) →", que abre a GRADE completa.
   Os dados vêm de dados/lista_NN.js (LISTA_CHEGOU), um arquivo depois do outro; a ficha de cada jogo vem de
   dados/ficha_NN.js só quando alguém abre um jogo daquele arquivo.
   Marcações ficam no localStorage ("estante-pc-v1"). Entre visitas só ficam guardados o PC escolhido e o tema:
   filtros, busca e aba SEMPRE começam do zero (o app nunca abre mostrando só uma parte).
   As capas são as originais da Steam (460x215); o '📦 Guardar capas' baixa pacotes de WebP e o sw.js guarda toda imagem vista. */
(function () {
  'use strict';

  var CONF = window.CONF || {};
  var BASE = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/';
  var CHAVE = 'estante-pc-v1';
  var CHAVE_AJ = 'estante-pc-v1-ajustes';
  var CACHE_IMG = 'epc-img-v1'; // o mesmo nome do sw.js
  var POR_VEZ = 60;
  var POR_SECAO = 8; // 2 linhas de 4 no computador; o CSS esconde o que passa de 2 linhas no celular
  var TOTAL_STEAM = 110000;
  var PCS = CONF.pcs || { pai: { nome: 'PC do pai' }, meu: { nome: 'Meu notebook' } };
  var CURTO = { pai: 'Pai', meu: 'Note' };
  var NIVEL = {
    4: { nome: 'Roda liso', sim: '✓' }, 3: { nome: 'Roda', sim: '✓' }, 2: { nome: 'No limite', sim: '~' },
    1: { nome: 'Não roda', sim: '✕' }, 0: { nome: 'Sem dados', sim: '?' }
  };
  var COR_GEN = {
    vn: '#a8406f', metroid: '#6a48b0', rogue: '#b05a28', luta: '#a83636', corrida: '#a78a1f', esporte: '#378a42',
    terror: '#6e1d27', sobrev: '#6e5230', tiro: '#475b6e', rpg: '#3852b0', estrategia: '#267a75', gestao: '#25719a',
    plataforma: '#5f8a1b', puzzle: '#9a6b1a', aventura: '#2a78b0', acao: '#a33a34', casual: '#904296', outro: '#46525f'
  };
  var ABAS = [['marc', 'Todas as marcações'], ['int', '☆ Interesse'], ['quero', '✓ Quero jogar'], ['joguei', 'Já joguei'], ['inst', '💾 Instalar'], ['nao', 'Dispensados']];

  var fmtN = new Intl.NumberFormat('pt-BR');
  var fmtGB = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  var fmtPct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  var fmtPct2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  var colar = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function dois(n) { return (n < 10 ? '0' : '') + n; }
  function gb(v) { return fmtGB.format(v) + ' GB'; }
  function mb(b) { return b >= 1073741824 ? fmtGB.format(b / 1073741824) + ' GB' : fmtGB.format(b / 1048576) + ' MB'; }
  function lerJSON(k, p) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? p : v; } catch (e) { return p; } }
  function noPC(k) { var n = (PCS[k] && PCS[k].nome) || k; return /^Meu /.test(n) ? 'no m' + n.slice(1) : 'no ' + n; }
  function pctMeta(t) { var p = 100 * t / TOTAL_STEAM; return p < 1 ? fmtPct2.format(p) : fmtPct.format(p); }
  function cada(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  // a capa original da Steam: é também a chave da WebP guardada pelos pacotes de capas (o sw.js entrega a guardada)
  function urlCapa(c) { return BASE + c; }

  // ---------------- marcações e ajustes ----------------
  var M = lerJSON(CHAVE, {});
  M.int = M.int || {}; M.inst = M.inst || {}; M.plano = M.plano || {};
  var AJ = lerJSON(CHAVE_AJ, {}); // só o PC escolhido e o tema
  var podeSalvar = true;
  try { localStorage.setItem(CHAVE + '-teste', '1'); localStorage.removeItem(CHAVE + '-teste'); } catch (e) { podeSalvar = false; }
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify({ int: M.int, inst: M.inst, plano: M.plano })); }
    catch (e) { podeSalvar = false; $('aviso-salvar').hidden = false; }
    // avisa a sincronização (sync.js) que as marcações mudaram
    try { if (window.SYNC_PC) window.SYNC_PC.mudou(); } catch (e) {}
  }
  function salvarAj() { try { localStorage.setItem(CHAVE_AJ, JSON.stringify({ pc: AJ.pc, tema: AJ.tema })); } catch (e) {} }

  // ---------------- filtros (não ficam guardados entre visitas) ----------------
  var ORDEM_PADRAO = 'pop'; // vira "pv" (Mais a sua cara) quando a lista traz o pv
  function filtrosPadrao() { return { q: [], qTxt: '', idioma: '', ordem: ORDEM_PADRAO, rom: false, esc18: true, escVet: true, naoRoda: false, ctrl: false }; }
  var F = filtrosPadrao();
  F.pc = AJ.pc === 'pai' || AJ.pc === 'meu' ? AJ.pc : 'dois';
  // V: o que está na tela. modo "catalogo" ou "grade"; fonte da grade: {t:'sec'|'gen'|'nivel'|'aba'|'busca', k}
  var V = { modo: 'catalogo', fonte: null, fonteAntes: null, scrollCat: 0, irDepois: null };

  // ---------------- dados ----------------
  var JOGOS = [];
  var POR_ID = Object.create(null);
  var FICHAS = Object.create(null);
  var ARQS = CONF.arqs || [];
  var ARQ_N = {};
  ARQS.forEach(function (a) { ARQ_N[a.n] = a; });
  var fila = ARQS.map(function (a) { return a.n; }); // partes da lista que faltam
  var falhou = [];
  var fichaEstado = {}, fichaEspera = {};
  var TAG_PT = {};
  (CONF.tags || []).forEach(function (t, i) { TAG_PT[t] = (CONF.tags_pt || [])[i] || t; });
  function tagPt(i) { return (CONF.tags_pt || [])[i] || (CONF.tags || [])[i] || ''; }

  function prep(g) {
    g._vet = g.x === 'ot' || g.x === 'ms';
    g._tp = (g.t || []).map(tagPt).filter(Boolean);
    g._b = norm(g.n + ' | ' + g._tp.join(' | ') + (g.et ? ' | ' + g.et : ''));
  }
  function injetar(src, erro) {
    var s = document.createElement('script');
    s.src = src; s.async = true;
    s.onerror = function () { s.remove(); erro(); };
    document.head.appendChild(s);
  }
  function pedirLista(tentativa) {
    if (!fila.length) { agendar(); return; }
    var a = ARQ_N[fila[0]];
    tentativa = tentativa || 0;
    injetar('dados/lista_' + dois(a.n) + '.js?v=' + a.v + (tentativa ? '&t=' + tentativa : ''), function () {
      if (tentativa < 2) { setTimeout(function () { pedirLista(tentativa + 1); }, 700 * (tentativa + 1)); return; }
      if (falhou.indexOf(a.n) < 0) falhou.push(a.n);
      fila = fila.filter(function (x) { return x !== a.n; });
      avisoDados(); agendar(); pedirLista();
    });
  }
  window.LISTA_CHEGOU = function (n, lista) {
    (lista || []).forEach(function (g) {
      if (POR_ID[g.i]) return;
      if (!g.f) g.f = n;
      if (g.jo != null) TEM_JO = true;
      if (g.pv != null) TEM_PV = true;
      prep(g); JOGOS.push(g); POR_ID[g.i] = g;
    });
    // com o perfil de gostos na lista, a ordem padrão passa a ser "Mais a sua cara" (se ninguém mudou a ordem)
    if (TEM_PV && ORDEM_PADRAO !== 'pv') {
      if (F.ordem === ORDEM_PADRAO) F.ordem = 'pv';
      ORDEM_PADRAO = 'pv';
      sincronizarCampos();
    }
    fila = fila.filter(function (x) { return x !== n; });
    falhou = falhou.filter(function (x) { return x !== n; });
    avisoDados(); agendar();
    setTimeout(pedirLista, 0);
  };
  window.FICHA_CHEGOU = function (n, obj) {
    Object.keys(obj || {}).forEach(function (id) {
      var f = obj[id]; FICHAS[id] = f;
      var g = POR_ID[id];
      if (g) g._b += ' | ' + norm((f.dv || []).join(' ') + ' ' + (f.pb || []).join(' '));
    });
    fichaEstado[n] = 'ok';
    var cbs = fichaEspera[n] || []; fichaEspera[n] = [];
    cbs.forEach(function (cb) { cb(); });
    if (F.q.length) agendar();
  };
  function pedirFicha(n, cb) {
    if (fichaEstado[n] === 'ok') { cb(); return; }
    (fichaEspera[n] = fichaEspera[n] || []).push(cb);
    if (fichaEstado[n] === 'carregando') return;
    var a = ARQ_N[n];
    if (!a) { fichaEstado[n] = 'erro'; cb(); return; }
    fichaEstado[n] = 'carregando';
    injetar('dados/ficha_' + dois(n) + '.js?v=' + a.vf + (fichaEstado['t' + n] ? '&t=' + fichaEstado['t' + n] : ''), function () {
      fichaEstado[n] = 'erro'; fichaEstado['t' + n] = (fichaEstado['t' + n] || 0) + 1;
      var cbs = fichaEspera[n] || []; fichaEspera[n] = [];
      cbs.forEach(function (c) { c(); });
    });
  }
  function avisoDados() {
    var av = $('aviso-dados');
    av.hidden = !falhou.length;
    if (falhou.length) $('aviso-dados-txt').textContent = (falhou.length === 1 ? 'A parte ' : 'As partes ') + falhou.join(', ') + ' da lista não carregaram (internet fraca?). Faltam jogos.';
  }
  $('b-tentar').addEventListener('click', function () {
    falhou.forEach(function (n) { if (fila.indexOf(n) < 0) fila.push(n); });
    falhou = []; avisoDados(); pedirLista();
  });

  var timerDesenho = 0, primeiro = true;
  function agendar() {
    if (timerDesenho) return;
    timerDesenho = setTimeout(function () {
      timerDesenho = 0;
      if (V.modo === 'catalogo') comAncora(function () { desenhar(true); }); else desenhar(true);
      atualizarResumo(); atualizarDisco();
    }, primeiro ? 60 : 600);
    primeiro = false;
  }

  // ---------------- nível, filtros e ordem ----------------
  function nv(g) {
    var v = g.v || [0, 0];
    if (F.pc === 'pai') return v[0] || 0;
    if (F.pc === 'meu') return v[1] || 0;
    return Math.max(v[0] || 0, v[1] || 0);
  }
  function notaP(g) { if (g.r == null) return -1; var rv = g.rv || 0; return (g.r * rv + 70 * 200) / (rv + 200); }
  // "Para você": quando o jogo traz pv (0 a 100, o quanto combina com o usuário), vale o pv;
  // sem pv, cai no critério antigo (romance e RPG primeiro, depois a nota)
  var PV_MIN = 74; // faixa verde (🟢) da Estante do Switch: 74 a 100
  function ordPara(a, b) {
    var va = a.pv != null ? a.pv : -1, vb = b.pv != null ? b.pv : -1;
    if (va !== vb) return vb - va;
    var pa = (a.rom ? 2 : 0) + (a.g === 'rpg' ? 1 : 0), pb = (b.rom ? 2 : 0) + (b.g === 'rpg' ? 1 : 0);
    return pb - pa || notaP(b) - notaP(a) || a.o - b.o;
  }
  function paraVoce(g) {
    if (M.plano[g.i] || g._vet || nv(g) < 3) return false;
    if (g.nv) return g.nv === 'sim';            // 🟢 do perfil de gostos
    if (g.pv != null) return g.pv >= PV_MIN;
    return g.pt >= 1 && (g.r || 0) >= 85;       // sem perfil: critério antigo
  }
  // joia: usa o campo jo quando a lista traz esse campo; se não, a regra da nota e das poucas avaliações
  var TEM_JO = false, TEM_PV = false;
  function ehJoia(g) {
    if (nv(g) < 3) return false;
    if (TEM_JO) return g.jo === 1;
    return (g.r || 0) >= 90 && ((g.rv >= 500 && g.rv <= 20000) || (g['do'] || 0) <= 500000);
  }
  function ordNota(a, b) { return notaP(b) - notaP(a) || a.o - b.o; }
  var ORDENS = {
    pv: function (a, b) { return (b.pv != null ? b.pv : -1) - (a.pv != null ? a.pv : -1) || a.o - b.o; },
    pop: function (a, b) { return a.o - b.o; },
    nota: ordNota,
    novos: function (a, b) { return (b.a || 0) - (a.a || 0) || a.o - b.o; },
    nome: function (a, b) { return colar.compare(a.n, b.n); },
    disco: function (a, b) { return (a.s == null ? 1e9 : a.s) - (b.s == null ? 1e9 : b.s) || a.o - b.o; }
  };
  var NOMES_ORDEM = { pv: 'Mais a sua cara', pop: 'Mais jogados', nota: 'Melhor avaliados', novos: 'Mais novos', nome: 'Nome (A a Z)', disco: 'Menor no disco' };

  var SECOES = [
    { k: 'para', tit: '✨ Para você', dsc: 'Rodam no PC escolhido e combinam com você. Some quando você decide.',
      f: paraVoce, ord: ordPara, pq: true },
    { k: 'joias', tit: '💎 Joias escondidas', dsc: 'Nota altíssima, pouca gente conhece, e roda no PC escolhido.',
      f: ehJoia, ord: ordNota },
    { k: 'liso', tit: 'Roda liso nos seus PCs', dsc: 'Passam dos requisitos recomendados.', f: function (g) { return nv(g) === 4; } },
    { k: 'dub', tit: 'Dublados em PT-BR', dsc: 'Com vozes em português do Brasil.', f: function (g) { return g.pt === 2; } },
    { k: 'rom', tit: '💗 Romance', dsc: '', f: function (g) { return !!g.rom; } },
    { k: 'deck', tit: 'Verificados no Steam Deck', dsc: 'Rodam bem num aparelho fraco: boa dica para os seus PCs.', f: function (g) { return g.dk === 3; } }
  ];
  var SEC_K = {};
  SECOES.forEach(function (s) { SEC_K[s.k] = s; });
  function titSecao(s) {
    if (s.k === 'liso' && F.pc !== 'dois') return 'Roda liso ' + noPC(F.pc);
    return s.tit;
  }

  function abaOk(g, k) {
    var id = g.i, pl = M.plano[id];
    if (k === 'marc') return !!(M.int[id] || M.inst[id] || pl === 'quero' || pl === 'joguei');
    if (k === 'int') return !!M.int[id];
    if (k === 'inst') return !!M.inst[id];
    return pl === k;
  }
  function passaGlobal(g, semEsconder) {
    if (F.idioma === 'com' && !(g.pt >= 1)) return false;
    if (F.idioma === 'dub' && g.pt !== 2) return false;
    if (F.idioma === 'sem' && g.pt) return false;
    if (F.rom && !g.rom) return false;
    if (F.ctrl && !g.ct) return false;
    if (!semEsconder) {
      if (F.esc18 && g.ad) return false;
      if (F.escVet && g._vet) return false;
    }
    return true;
  }
  function passaFonte(g, fo) {
    if (fo.t === 'sec') return SEC_K[fo.k].f(g);
    if (fo.t === 'gen') return g.g === fo.k;
    if (fo.t === 'aba') return abaOk(g, fo.k);
    if (fo.t === 'busca') { for (var k = 0; k < F.q.length; k++) if (g._b.indexOf(F.q[k]) < 0) return false; }
    return true;
  }
  // percorre todos os jogos uma vez: lista que passa, contagem por nível e quantos "não roda" ficaram escondidos
  function filtrar(fo) {
    var semEsc = !!fo && fo.t === 'aba';
    var cont = [0, 0, 0, 0, 0], lista = [], escondidos = 0;
    for (var i = 0; i < JOGOS.length; i++) {
      var g = JOGOS[i];
      if (!semEsc && M.plano[g.i] === 'nao') continue;
      if (!passaGlobal(g, semEsc)) continue;
      if (fo && !passaFonte(g, fo)) continue;
      var n = nv(g);
      cont[n]++;
      if (fo && fo.t === 'nivel') { if (n !== fo.k) continue; }
      else if (n === 1 && !F.naoRoda && !semEsc) { escondidos++; continue; }
      lista.push(g);
    }
    return { lista: lista, cont: cont, escondidos: escondidos };
  }
  function ordenar(lista, fo) {
    var cmp = ORDENS[F.ordem] || ORDENS.pop;
    if (F.ordem === ORDEM_PADRAO && fo && fo.t === 'sec' && SEC_K[fo.k].ord) cmp = SEC_K[fo.k].ord;
    return lista.sort(cmp);
  }

  // ---------------- cards ----------------
  var grid = $('grid');
  var ATUAL = [], MOSTRADOS = 0, BASE_ATUAL = { lista: [], cont: [0, 0, 0, 0, 0], escondidos: 0 };

  function seloNivel(n, rot) {
    return '<span class="selo nv nv' + n + '" title="' + esc((rot ? rot + ': ' : '') + NIVEL[n].nome) + '">' + esc(rot ? rot + ' ' + NIVEL[n].sim : NIVEL[n].nome) + '</span>';
  }
  function selosNivel(g) {
    var v = g.v || [0, 0];
    if (F.pc === 'dois') return seloNivel(v[0] || 0, CURTO.pai) + seloNivel(v[1] || 0, CURTO.meu);
    return seloNivel(nv(g));
  }
  function seloPT(g) {
    if (g.pt === 2) return '<span class="selo dub">Dublado PT-BR</span>';
    if (g.pt === 1) return '<span class="selo pt">PT-BR</span>';
    if (g.pp) return '<span class="selo" title="Tem português de Portugal">PT-PT</span>';
    return '';
  }
  function seloNota(g) {
    if (g.r == null) return '';
    var c = g.r >= 80 ? 'nota-a' : g.r >= 60 ? 'nota-m' : 'nota-b';
    return '<span class="selo ' + c + '" title="' + g.r + '% de avaliações positivas' + (g.rv ? ' (' + fmtN.format(g.rv) + ')' : '') + '">' + g.r + '%</span>';
  }
  function seloDeck(g) {
    if (g.dk === 3) return '<span class="selo dk" title="Verificado no Steam Deck: boa dica de que roda em máquina fraca"><b>Deck</b> verificado</span>';
    if (g.dk === 2) return '<span class="selo dk" title="Jogável no Steam Deck"><b>Deck</b> jogável</span>';
    return '';
  }
  function seloPlano(g) {
    var pl = M.plano[g.i];
    if (pl === 'quero') return '<span class="selo plano">Quero jogar</span>';
    if (pl === 'joguei') return '<span class="selo plano">Já joguei</span>';
    if (pl === 'nao') return '<span class="selo veto">Dispensado</span>';
    return '';
  }
  // romance em níveis (rk), como na Estante do Switch; sem rk, vale o rom antigo
  var ROM_NIVEL = {
    sim: ['rom', '♥ Romance central'], opc: ['rom', '♥ Dá pra namorar'],
    leve: ['rom leve', '♡ Romance de fundo'], nc: ['rom-nc', '? romance']
  };
  function seloRom(g) {
    var r = ROM_NIVEL[g.rk];
    if (r) return '<span class="selo ' + r[0] + '"' + (g.rk === 'nc' ? ' title="Romance não conferido"' : '') + '>' + r[1] + '</span>';
    return g.rom ? '<span class="selo rom">♥ Romance</span>' : '';
  }
  function textoRom(g) {
    var r = ROM_NIVEL[g.rk];
    if (g.rk === 'nc') return 'Não conferido';
    return r ? r[1].slice(2) : g.rom ? 'Tem romance' : '';
  }
  // 🟢🟡🔴 do perfil de gostos (nv) com a nota pv
  var GOSTO = { sim: ['🟢', 'Acho que você vai gostar'], talvez: ['🟡', 'Talvez'], nao: ['🔴', 'Acho que não'] };
  function seloGosto(g) {
    var x = GOSTO[g.nv];
    if (!x && g.pv == null) return '';
    return '<span class="selo gosto" title="' + esc(x ? x[1] : 'Combina com você') + '">' + (x ? x[0] + ' ' : '🎯 ') + (g.pv != null ? g.pv : '') + '</span>';
  }
  function selosTodos(g, comGosto) {
    return (comGosto ? seloGosto(g) : '') + selosNivel(g) + seloPT(g) + seloNota(g) + seloDeck(g) + seloRom(g) +
      (g.sw === 'fav' ? '<span class="selo plano" title="Você deu estrela a este jogo na Estante do Switch">★ no Switch</span>' : '') +
      (g._vet ? '<span class="selo veto" title="' + (g.x === 'ot' ? 'Otome' : 'Romance só do mesmo sexo') + '">Vetado</span>' : '') +
      (g.ad ? '<span class="selo ad">+18</span>' : '') +
      (g.on ? '<span class="selo">Só on-line</span>' : '') +
      (g.nw ? '<span class="selo">Sem Windows</span>' : '') + seloPlano(g);
  }
  function metaTxt(g) {
    var p = [];
    if (g.s != null) p.push('<span title="Espaço em disco">' + gb(g.s) + '</span>');
    if (g.a) p.push('<span>' + g.a + '</span>');
    return p.join('');
  }
  function imgCapa(g, classe, pequena) {
    if (!g.c) return '';
    var o = BASE + esc(g.c);
    return '<img class="' + classe + '" loading="lazy" decoding="async" width="460" height="215" alt="Capa de ' + esc(g.n) + '" src="' +
      o + '">';
  }
  // a frase "por que é a sua cara" vem na ficha (pq); aceita também no jogo, se um dia vier
  function pqDe(g) { return g.pq || (FICHAS[g.i] && FICHAS[g.i].pq) || ''; }
  function cardHTML(g, comPq) {
    var id = g.i, nome = esc(g.n);
    return '<article class="card' + (M.inst[id] ? ' sel' : '') + (M.plano[id] === 'nao' ? ' dispensado' : '') + '" data-id="' + id + '">' +
      '<div class="capa-box" style="--gc:' + (COR_GEN[g.g] || COR_GEN.outro) + '">' +
        '<button type="button" class="capa-hit" data-acao="inst" aria-pressed="' + !!M.inst[id] + '" aria-label="Quero instalar: ' + nome + '">' +
          '<span class="capa-sem" aria-hidden="true">' + nome + '</span>' + imgCapa(g, 'capa', true) +
          '<span class="capa-check" aria-hidden="true">✓</span>' +
        '</button>' +
        '<button type="button" class="fav" data-acao="int" aria-pressed="' + !!M.int[id] + '" aria-label="Tenho interesse: ' + nome + '" title="Tenho interesse"><span aria-hidden="true">' + (M.int[id] ? '★' : '☆') + '</span></button>' +
        (g.em_breve ? '<span class="capa-flag">Em breve</span>' : '') +
      '</div>' +
      '<div class="card-corpo">' +
        '<h3 class="nome">' + nome + '</h3>' +
        '<div class="selos">' + selosTodos(g, comPq) + '</div>' +
        (comPq && pqDe(g) ? '<p class="pq">' + esc(pqDe(g)) + '</p>' : '') +
        '<div class="meta">' + metaTxt(g) + '</div>' +
        '<button type="button" class="ver" data-acao="ver">Ver o jogo</button>' +
      '</div></article>';
  }
  function atualizarCardsDom(id) {
    var g = POR_ID[id];
    if (!g) return;
    cada('#conteudo .card[data-id="' + g.i + '"]', function (el) { el.outerHTML = cardHTML(g, !!el.querySelector('.pq')); });
  }

  // ---------------- desenho: catálogo ou grade ----------------
  function desenhar(manter) {
    BASE_ATUAL = filtrar(null);
    ordenar(BASE_ATUAL.lista, null);
    atualizarTiles(BASE_ATUAL.cont);
    montarGens();
    var cat = V.modo === 'catalogo';
    $('catalogo').hidden = !cat;
    $('grade-sec').hidden = cat;
    var r = cat ? BASE_ATUAL : desenharGrade(manter);
    if (cat) desenharCatalogo();
    var t = 'Mostrando <strong>' + fmtN.format(r.lista.length) + '</strong> de ' + fmtN.format(JOGOS.length) + ' jogos';
    if (r.escondidos) t += ' · ' + fmtN.format(r.escondidos) + ' que não rodam escondidos';
    if (fila.length) t += ' · carregando…';
    $('mostrando').innerHTML = t;
    montarAtivos();
    atualizarAbas();
  }
  function secaoHTML(id, tit, dsc, lista, fonteTxt, comPq) {
    return '<section class="sec-cat" id="' + id + '" aria-labelledby="' + id + '-t">' +
      '<div class="sec-cab"><h2 id="' + id + '-t">' + esc(tit) + '</h2><span class="count">' + fmtN.format(lista.length) + '</span>' + (dsc ? '<p>' + esc(dsc) + '</p>' : '') + '</div>' +
      '<div class="grid">' + lista.slice(0, POR_SECAO).map(function (g) { return cardHTML(g, comPq); }).join('') + '</div>' +
      '<button type="button" class="ver-todos" data-ver="' + fonteTxt + '">Ver todos (' + fmtN.format(lista.length) + ') →</button>' +
      '</section>';
  }
  function desenharCatalogo() {
    var base = BASE_ATUAL.lista, h = [];
    if (!JOGOS.length) { $('catalogo').innerHTML = '<p class="empty">Abrindo o catálogo…</p>'; return; }
    SECOES.forEach(function (s) {
      var l = base.filter(s.f);
      if (F.ordem === ORDEM_PADRAO && s.ord) l.sort(s.ord);
      if (l.length) h.push(secaoHTML('sec-' + s.k, titSecao(s), s.dsc, l, 'sec:' + s.k, !!s.pq));
    });
    porGenero(base).forEach(function (x) {
      h.push(secaoHTML('gen-' + x.k, (CONF.gen || {})[x.k] || x.k, '', x.lista, 'gen:' + x.k));
    });
    $('catalogo').innerHTML = h.length ? h.join('') : '<div class="empty"><p>Nenhum jogo com esses filtros.</p><button type="button" class="limpar" data-limpar="1">Limpar filtros</button></div>';
  }
  function porGenero(base) {
    var b = {};
    base.forEach(function (g) { (b[g.g] = b[g.g] || []).push(g); });
    return Object.keys(b).map(function (k) { return { k: k, lista: b[k] }; }).sort(function (x, y) { return y.lista.length - x.lista.length || colar.compare(x.k, y.k); });
  }
  function titFonte(fo) {
    if (fo.t === 'sec') return titSecao(SEC_K[fo.k]);
    if (fo.t === 'gen') return (CONF.gen || {})[fo.k] || fo.k;
    if (fo.t === 'nivel') return NIVEL[fo.k].nome + (F.pc === 'dois' ? ' (no melhor dos dois PCs)' : ' ' + noPC(F.pc));
    if (fo.t === 'aba') { var a = ABAS.filter(function (x) { return x[0] === fo.k; })[0]; return a ? a[1].replace(/^[^\wÀ-ú]+ /, '') : 'Marcações'; }
    if (fo.t === 'busca') return 'Busca: “' + F.qTxt + '”';
    return '';
  }
  function desenharGrade(manter) {
    var r = filtrar(V.fonte);
    ordenar(r.lista, V.fonte);
    ATUAL = r.lista;
    var qtd = Math.min(ATUAL.length, manter ? Math.max(MOSTRADOS, POR_VEZ) : POR_VEZ);
    grid.innerHTML = ATUAL.slice(0, qtd).map(cardGrade).join('');
    MOSTRADOS = qtd;
    atualizarMais();
    $('grade-tit').textContent = titFonte(V.fonte);
    $('grade-n').textContent = fmtN.format(ATUAL.length) + (ATUAL.length === 1 ? ' jogo' : ' jogos');
    var d = V.fonte.t === 'sec' ? SEC_K[V.fonte.k].dsc : '';
    if (r.escondidos && V.fonte.t !== 'nivel') d += (d ? ' ' : '') + fmtN.format(r.escondidos) + ' que não rodam estão escondidos (tile "Não roda" ou "Mais filtros" para ver).';
    $('grade-dsc').textContent = d;
    $('vazio').hidden = ATUAL.length > 0 || !JOGOS.length;
    return r;
  }
  function cardGrade(g) { return cardHTML(g, V.fonte && V.fonte.t === 'sec' && SEC_K[V.fonte.k].pq); }
  function atualizarMais() {
    var falta = ATUAL.length - MOSTRADOS, b = $('mais');
    b.hidden = falta <= 0;
    b.textContent = 'Mostrar mais ' + Math.min(falta, POR_VEZ) + ' (faltam ' + fmtN.format(falta) + ')';
  }
  function mostrarMais() {
    var fim = Math.min(ATUAL.length, MOSTRADOS + POR_VEZ);
    grid.insertAdjacentHTML('beforeend', ATUAL.slice(MOSTRADOS, fim).map(cardGrade).join(''));
    MOSTRADOS = fim;
    atualizarMais();
  }
  // redesenha o catálogo sem a tela pular: mantém a seção que estava no alto no mesmo lugar
  function comAncora(fn) {
    var topo = topoH(), anc = null, off = 0;
    if (window.scrollY > 0) {
      var secs = document.querySelectorAll('#catalogo .sec-cat');
      for (var i = 0; i < secs.length; i++) {
        var r = secs[i].getBoundingClientRect();
        if (r.bottom > topo) { anc = secs[i].id; off = r.top; break; }
      }
    }
    fn();
    if (anc && $(anc)) window.scrollBy(0, $(anc).getBoundingClientRect().top - off);
  }

  // ---------------- navegação: grade, catálogo e gêneros ----------------
  // 26/11: a barra do topo não acompanha mais a rolagem (pedido do usuário); só conta a altura dela se voltar a ser fixa
  function topoH() { var b = $('barra-topo'), p = getComputedStyle(b).position; return p === 'sticky' || p === 'fixed' ? b.getBoundingClientRect().height : 0; }
  function rolarPara(el) {
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    // as seções de cima podem mudar de altura ao aparecer: confere de novo
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.scrollIntoView({ block: 'start' }); }); });
  }
  function abrirGrade(fo) {
    if (V.modo === 'catalogo') { V.scrollCat = window.scrollY; V.modo = 'grade'; empurrar('grade'); }
    V.fonte = fo; V.fonteAntes = null;
    desenhar(false);
    rolarPara($('grade-cab'));
  }
  function voltarCatalogoDom() {
    V.modo = 'catalogo'; V.fonte = null; V.fonteAntes = null;
    if (F.q.length) { F.q = []; F.qTxt = ''; $('q').value = ''; }
    desenhar(false);
    if (V.irDepois) { var id = V.irDepois; V.irDepois = null; rolarPara($(id)); }
    else window.scrollTo(0, V.scrollCat || 0);
  }
  function irGenero(k) {
    if (V.modo === 'grade') { V.irDepois = 'gen-' + k; fecharCamada('grade'); return; }
    rolarPara($('gen-' + k));
  }
  function montarGens() {
    var gs = porGenero(BASE_ATUAL.lista);
    var h = '<button type="button" class="chip" data-gen="" aria-pressed="' + (V.modo === 'catalogo') + '">📚 Catálogo</button>';
    h += gs.map(function (x) {
      var on = V.modo === 'grade' && V.fonte && V.fonte.t === 'gen' && V.fonte.k === x.k;
      return '<button type="button" class="chip" data-gen="' + esc(x.k) + '" aria-pressed="' + on + '">' + esc((CONF.gen || {})[x.k] || x.k) + ' <span class="n">' + fmtN.format(x.lista.length) + '</span></button>';
    }).join('');
    var box = $('gens'), sl = box.scrollLeft;
    box.innerHTML = h;
    box.scrollLeft = sl;
  }

  // ---------------- filtros ativos ----------------
  function ativosLista() {
    var a = [];
    if (F.q.length) a.push(['q', 'Busca: “' + F.qTxt + '”']);
    if (F.idioma) a.push(['idioma', { com: 'Com PT-BR', dub: 'Dublado em PT-BR', sem: 'Sem PT-BR' }[F.idioma]]);
    if (F.ordem !== ORDEM_PADRAO) a.push(['ordem', 'Ordem: ' + NOMES_ORDEM[F.ordem]]);
    if (F.rom) a.push(['rom', 'Só com romance']);
    if (F.ctrl) a.push(['ctrl', 'Só com controle']);
    if (F.naoRoda) a.push(['naoRoda', 'Mostrando os que não rodam']);
    if (!F.esc18) a.push(['esc18', 'Mostrando +18']);
    if (!F.escVet) a.push(['escVet', 'Mostrando vetados']);
    return a;
  }
  function montarAtivos() {
    var a = ativosLista(), box = $('ativos');
    box.hidden = !a.length;
    box.innerHTML = a.map(function (x) {
      return '<button type="button" class="at-chip" data-tirar="' + x[0] + '" aria-label="Tirar o filtro: ' + esc(x[1]) + '">' + esc(x[1]) + ' <b aria-hidden="true">✕</b></button>';
    }).join('') + (a.length ? '<button type="button" class="at-limpar" data-limpar="1">Limpar tudo</button>' : '');
    var n = a.filter(function (x) { return x[0] !== 'q'; }).length;
    $('filtros-n').textContent = n || '';
  }
  function sincronizarCampos() {
    $('f-idioma').value = F.idioma; $('f-ordem').value = F.ordem;
    $('f-idioma').classList.toggle('ativo', !!F.idioma); $('f-ordem').classList.toggle('ativo', F.ordem !== ORDEM_PADRAO);
    $('c-rom').checked = F.rom; $('c-ctrl').checked = F.ctrl;
    $('c-nao').checked = F.naoRoda; $('c-18').checked = F.esc18; $('c-vet').checked = F.escVet;
  }
  function tirarFiltro(k) {
    if (k === 'q') { $('q').value = ''; aplicarBusca(''); return; }
    var p = filtrosPadrao();
    F[k] = p[k];
    sincronizarCampos();
    redesenharFiltros();
  }
  function limpar() {
    var p = filtrosPadrao();
    ['idioma', 'ordem', 'rom', 'esc18', 'escVet', 'naoRoda', 'ctrl'].forEach(function (k) { F[k] = p[k]; });
    sincronizarCampos();
    if (F.q.length) { $('q').value = ''; aplicarBusca(''); } else redesenharFiltros();
  }
  function redesenharFiltros() {
    if (V.modo === 'catalogo') comAncora(function () { desenhar(false); }); else desenhar(false);
  }

  // ---------------- busca ----------------
  function aplicarBusca(txt) {
    F.qTxt = txt.trim();
    F.q = norm(txt).split(/\s+/).filter(Boolean);
    if (F.q.length) {
      if (V.modo === 'catalogo') { abrirGrade({ t: 'busca' }); return; }
      if (V.fonte.t !== 'busca') { V.fonteAntes = V.fonte; V.fonte = { t: 'busca' }; desenhar(false); rolarPara($('grade-cab')); return; }
      desenhar(false);
      return;
    }
    if (V.modo === 'grade' && V.fonte.t === 'busca') {
      if (V.fonteAntes) { V.fonte = V.fonteAntes; V.fonteAntes = null; desenhar(false); }
      else fecharCamada('grade');
      return;
    }
    desenhar(false);
  }
  var timerBusca = 0;
  $('q').addEventListener('input', function () {
    clearTimeout(timerBusca);
    var v = this.value;
    timerBusca = setTimeout(function () { aplicarBusca(v); }, 200);
  });
  $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(timerBusca); aplicarBusca(this.value); this.blur(); } });

  // ---------------- tiles, marcações, cabeçalho ----------------
  function atualizarTiles(cont) {
    cada('.tile', function (b) {
      var n = +b.dataset.nv;
      b.querySelector('.num').textContent = fmtN.format(cont[n]);
      b.setAttribute('aria-pressed', String(V.modo === 'grade' && V.fonte && V.fonte.t === 'nivel' && V.fonte.k === n));
      if (n === 1) {
        var esc1 = !F.naoRoda;
        b.classList.toggle('escondido', esc1);
        b.querySelector('.dsc').textContent = esc1 ? 'Escondidos: toque para ver' : 'Aparecendo na lista';
      }
    });
  }
  function contaAba(k) {
    var n = 0, id;
    if (k === 'int') for (id in M.int) n++;
    else if (k === 'inst') for (id in M.inst) n++;
    else if (k === 'marc') { var s = {}; for (id in M.int) s[id] = 1; for (id in M.inst) s[id] = 1; for (id in M.plano) if (M.plano[id] !== 'nao') s[id] = 1; for (id in s) n++; }
    else for (id in M.plano) if (M.plano[id] === k) n++;
    return n;
  }
  function montarAbas() {
    $('abas').innerHTML = ABAS.map(function (a) {
      return '<button type="button" class="chip" data-aba="' + a[0] + '" aria-pressed="false">' + esc(a[1]) + ' <span class="n"></span></button>';
    }).join('');
  }
  function atualizarAbas() {
    cada('[data-aba]', function (b) {
      b.setAttribute('aria-pressed', String(V.modo === 'grade' && V.fonte && V.fonte.t === 'aba' && V.fonte.k === b.dataset.aba));
      var n = b.querySelector('.n');
      if (n) n.textContent = fmtN.format(contaAba(b.dataset.aba));
    });
  }
  function montarMeta() {
    var t = CONF.total || JOGOS.length;
    var marcos = [1000, 5000, 20000, TOTAL_STEAM], pct = 0, ant = 0;
    for (var k = 0; k < marcos.length; k++) {
      if (t >= marcos[k]) { pct += 25; ant = marcos[k]; continue; }
      pct += 25 * (t - ant) / (marcos[k] - ant); break;
    }
    var etapa = CONF.etapa || 1;
    $('etapa').textContent = etapa;
    var rot = ['1.000', '5.000', '20.000', 'Todos'];
    $('meta-steam').innerHTML =
      '<div class="meta-rot"><span>Meta: todos os jogos da Steam</span><b>' + fmtN.format(t) + ' de ~' + fmtN.format(TOTAL_STEAM) + ' (' + pctMeta(t) + '%)</b></div>' +
      '<div class="meta-barra" role="progressbar" aria-label="Progresso da meta de todos os jogos da Steam" aria-valuemin="0" aria-valuemax="' + TOTAL_STEAM + '" aria-valuenow="' + t + '" aria-valuetext="etapa ' + etapa + ' de 4">' +
      '<div class="meta-fill" style="width:' + pct.toFixed(1) + '%"></div><i style="left:25%"></i><i style="left:50%"></i><i style="left:75%"></i></div>' +
      '<div class="meta-etapas">' + rot.map(function (r, i) {
        return '<span class="' + (i + 1 < etapa ? 'feita' : i + 1 === etapa ? 'atual' : '') + '">' + r + '</span>';
      }).join('') + '</div>';
  }
  function montarPCs() {
    ['pai', 'meu'].forEach(function (k) {
      var b = document.querySelector('#seg-pc [data-pc="' + k + '"]');
      if (b && PCS[k]) b.textContent = PCS[k].nome;
    });
    $('pcs').innerHTML = ['pai', 'meu'].map(function (k) {
      var p = PCS[k] || {};
      return '<div class="pc' + (F.pc === k || F.pc === 'dois' ? ' ativo' : '') + '"><b>' + esc(p.nome) + '</b>' +
        '<span>' + esc(p.cpu_n || '') + '</span><span>' + esc(p.gpu_n || '') + '</span>' +
        '<span>' + (p.ram ? p.ram + ' GB de RAM' : '') + (p.livre ? ' · ' + p.livre + ' GB livres' : '') + '</span></div>';
    }).join('');
    cada('#seg-pc button', function (b) { b.setAttribute('aria-pressed', String(b.dataset.pc === F.pc)); });
    $('pc-expl').textContent = F.pc === 'dois'
      ? '"Nos dois": vale o melhor dos dois PCs. Os cards mostram um selo de cada PC.'
      : 'Os selos, os tiles e as seções usam só o ' + PCS[F.pc].nome + '.';
  }
  function atualizarDisco() {
    var k = F.pc === 'meu' ? 'meu' : 'pai';
    var livre = (PCS[k] && PCS[k].livre) || 0;
    var soma = 0, n = 0, sem = 0;
    for (var id in M.inst) {
      n++;
      var g = POR_ID[id];
      if (g && g.s != null) soma += g.s; else sem++;
    }
    var pct = livre ? Math.min(100, 100 * soma / livre) : 0;
    var classe = soma > livre ? 'over' : pct > 85 ? 'warn' : '';
    var m = $('meter');
    m.className = 'meter ' + classe;
    m.querySelector('.fill').style.width = pct.toFixed(1) + '%';
    m.setAttribute('aria-valuenow', Math.round(pct));
    var sobra = livre - soma;
    var t = '<strong>' + gb(soma) + '</strong> de ' + gb(livre) + ' livres ' + noPC(k) + ' · ' + n + (n === 1 ? ' jogo' : ' jogos') + ' para instalar · ' +
      (sobra >= 0 ? 'sobram <strong>' + gb(sobra) + '</strong>' : '<span class="falta">faltam ' + gb(-sobra) + '</span>');
    if (sem) t += ' · ' + sem + ' sem tamanho informado';
    if (F.pc === 'dois') t += ' <span class="fine">("Nos dois" usa o disco do ' + PCS.pai.nome + ')</span>';
    $('leitura').innerHTML = n ? t : 'Nenhum jogo marcado para instalar. Toque na capa de um jogo para marcar.';
    var bar = $('barra-disco');
    bar.hidden = !n;
    document.body.classList.toggle('com-barra', !!n);
    bar.className = 'barra-disco ' + classe;
    bar.querySelector('.bd-fill').style.width = pct.toFixed(1) + '%';
    bar.querySelector('.bd-txt').innerHTML = '💾 ' + n + ' para instalar · ' + gb(soma) + ' de ' + gb(livre) + ' ' + noPC(k) +
      (sobra < 0 ? ' · <span class="falta">não cabe</span>' : '');
  }
  function atualizarResumo() {
    if (!JOGOS.length) return;
    var pai = 0, meu = 0, pt = 0;
    JOGOS.forEach(function (g) { var v = g.v || [0, 0]; if (v[0] >= 3) pai++; if (v[1] >= 3) meu++; if (g.pt) pt++; });
    $('resumo').textContent = 'Rodam ' + fmtN.format(pai) + ' jogos ' + noPC('pai') + ' e ' + fmtN.format(meu) + ' ' + noPC('meu') +
      '. Com português do Brasil: ' + fmtN.format(pt) + '.';
  }

  // ---------------- camadas (grade, ficha, Tinder, capas) e o botão voltar do celular ----------------
  var pilha = [];
  function empurrar(nome) { pilha.push(nome); try { history.pushState({ camada: nome }, ''); } catch (e) {} }
  function fecharCamada(nome) {
    if (pilha[pilha.length - 1] === nome) { history.back(); return; }
    pilha = pilha.filter(function (x) { return x !== nome; });
    fecharDom(nome);
  }
  function fecharDom(nome) {
    if (nome === 'ficha') fecharFichaDom();
    else if (nome === 'tinder') fecharTinderDom();
    else if (nome === 'grade') voltarCatalogoDom();
    else if (nome === 'capas') { if (dlgC.open) dlgC.close(); }
  }
  window.addEventListener('popstate', function () { var nome = pilha.pop(); if (nome) fecharDom(nome); });

  // ---------------- ficha ----------------
  var dlg = $('ficha');
  var fichaId = null;

  function planosHTML(g) {
    var id = g.i, pl = M.plano[id];
    function b(k, txt, on, extra) { return '<button type="button" class="pl-btn ' + (extra || '') + '" data-f="' + k + '" aria-pressed="' + !!on + '">' + txt + '</button>'; }
    return '<div class="planos" role="group" aria-label="Suas marcações">' +
      b('quero', '✓ Quero jogar', pl === 'quero') + b('joguei', 'Já joguei', pl === 'joguei') +
      b('nao', '✕ Não quero', pl === 'nao', 'pl-nao') + b('int', '☆ Tenho interesse', M.int[id]) +
      b('inst', '💾 Quero instalar', M.inst[id]) + '</div>';
  }
  function blocoPC(g, f, k, idx) {
    var n = (g.v || [0, 0])[idx] || 0, p = PCS[k] || {};
    var mo = f && f.mo ? (f.mo[idx] || []) : null;
    return '<div class="f-pc nv' + n + '"><h3>Roda ' + esc(noPC(k)) + '?</h3>' + seloNivel(n).replace('class="selo', 'style="justify-self:start" class="selo') +
      '<span class="hw">' + esc([p.cpu_n, p.gpu_n, p.ram ? p.ram + ' GB de RAM' : ''].filter(Boolean).join(' · ')) + '</span>' +
      (mo ? (mo.length ? '<ul>' + mo.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>' : '') : '<span class="f-carregando">Carregando os motivos…</span>') +
      '</div>';
  }
  function classif(ci) {
    if (ci == null || ci === '') return '';
    ci = String(ci);
    if (/^l$/i.test(ci)) return 'Livre';
    return /^\d+$/.test(ci) ? ci + ' anos' : ci;
  }
  function montarFicha(g) {
    var f = FICHAS[g.i];
    var estado = f ? 'ok' : fichaEstado[g.f] === 'erro' ? 'erro' : 'carregando';
    var cor = COR_GEN[g.g] || COR_GEN.outro;
    var gen = (CONF.gen || {})[g.g] || '';
    var h = '<div class="f-in">';
    h += '<button type="button" class="f-x" data-f="fechar" aria-label="Fechar a ficha">✕</button>';
    h += '<div class="f-heroi" style="--gc:' + cor + '">' + (g.c ? '<img class="f-fundo" alt="" aria-hidden="true" src="' + esc(urlCapa(g.c)) + '">' : '') +
      '<div class="f-capa-box"><span class="capa-sem" aria-hidden="true">' + esc(g.n) + '</span>' + imgCapa(g, 'f-capa', false) + '</div></div>';
    h += '<div class="f-tit"><h2 id="f-nome">' + esc(g.n) + '</h2><p class="f-gen">' + esc([gen, g.a, g.em_breve ? 'ainda não lançado' : ''].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="selos">' + selosTodos(g, true) + '</div></div>';
    h += planosHTML(g);
    h += '<div class="links"><a class="btn btn-forte" href="https://store.steampowered.com/app/' + g.i + '/" target="_blank" rel="noopener">Abrir na Steam</a>' +
      '<a class="btn" href="steam://store/' + g.i + '">Abrir no app da Steam</a></div>';
    if (estado === 'carregando') h += '<p class="f-carregando">Carregando os detalhes…</p>';
    else if (estado === 'erro') h += '<p class="aviso">Não deu para carregar os detalhes deste jogo. <button type="button" class="btn" data-f="recarregar">Tentar de novo</button></p>';
    var gosto = GOSTO[g.nv], pq = pqDe(g);
    if (gosto || pq) {
      h += '<p class="f-pq"><b>' + (gosto ? gosto[0] + ' ' + gosto[1] : '🎯 Pra você') + (g.pv != null ? ' (' + g.pv + ' de 100)' : '') + '</b>' +
        (pq ? '<br>Por que é a sua cara: ' + esc(pq) : '') + (g.sw === 'fav' ? '<br>Você deu estrela a ele na Estante do Switch.' : '') + '</p>';
    }
    if (f && f.ds) h += '<p class="f-desc">' + esc(f.ds) + '</p>';
    h += '<div class="f-pcs">' + blocoPC(g, f, 'pai', 0) + blocoPC(g, f, 'meu', 1) + '</div>';
    var etqs = f && f.tg && f.tg.length ? f.tg.map(function (t) { return TAG_PT[t] || t; }) : g._tp;
    if (etqs.length) h += '<div class="f-sec"><h3>Etiquetas</h3><div class="etqs">' + etqs.map(function (t) { return '<span class="etq">' + esc(t) + '</span>'; }).join('') + '</div></div>';
    if (f && (f.mn || f.rc)) {
      h += '<div class="f-sec"><h3>Requisitos</h3>';
      if (f.mn) h += '<details class="req"><summary>Mínimos</summary><pre>' + esc(f.mn) + '</pre></details>';
      if (f.rc) h += '<details class="req"><summary>Recomendados</summary><pre>' + esc(f.rc) + '</pre></details>';
      h += '</div>';
    }
    if (f && f.sc && f.sc.length) {
      h += '<div class="f-sec"><h3>Capturas</h3><div class="fotos">' + f.sc.map(function (s, i) {
        var u = BASE + esc(s);
        return '<a href="' + u + '" target="_blank" rel="noopener"><img loading="lazy" decoding="async" width="600" height="338" src="' + u + '" alt="Captura ' + (i + 1) + ' de ' + esc(g.n) + '"></a>';
      }).join('') + '</div></div>';
    }
    var d = [];
    function linha(k, v) { if (v) d.push('<dt>' + k + '</dt><dd>' + v + '</dd>'); }
    if (f) {
      linha('Desenvolvedora', esc((f.dv || []).join(', ')));
      linha('Editora', esc((f.pb || []).join(', ')));
      linha('Lançamento', esc(f.dt));
    }
    if (g.r != null) linha('Avaliações', g.r + '% positivas' + (g.rv ? ' de ' + fmtN.format(g.rv) : ''));
    if (f && f.mc) linha('Metacritic', esc(f.mc));
    if (f && f.ci) linha('Classificação', esc(classif(f.ci)));
    if (f && f.dk) linha('Steam Deck', esc(f.dk));
    if (g['do']) linha('Donos', 'a partir de ' + fmtN.format(g['do']) + ' (SteamSpy)');
    if (g.s != null) linha('No disco', gb(g.s));
    linha('Controle', g.ct === 2 ? 'Suporte total' : g.ct === 1 ? 'Suporte parcial' : '');
    linha('Romance', esc(textoRom(g)) || (g.rk === undefined && TEM_PV ? 'Sem romance' : ''));
    linha('Português', g.pt === 2 ? 'Dublado em PT-BR' : g.pt === 1 ? 'Interface e legendas em PT-BR' : g.pp ? 'Só português de Portugal' : 'Sem português');
    if (f) {
      linha('Idiomas', esc(f.lg));
      linha('Categorias', esc((f.cat || []).join(', ')));
      if (f.w) linha('Site', '<a href="' + esc(f.w) + '" target="_blank" rel="noopener">' + esc(f.w.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</a>');
    }
    if (d.length) h += '<div class="f-sec"><h3>Dados</h3><dl class="dados">' + d.join('') + '</dl></div>';
    h += '</div>';
    dlg.innerHTML = h;
  }
  function abrirFicha(id) {
    var g = POR_ID[id];
    if (!g) return;
    fichaId = g.i;
    montarFicha(g);
    if (!dlg.open) {
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      empurrar('ficha');
    }
    dlg.scrollTop = 0;
    pedirFicha(g.f, function () { if (fichaId === g.i && dlg.open) { var top = dlg.scrollTop; montarFicha(g); dlg.scrollTop = top; } });
  }
  function fecharFichaDom() {
    if (dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
    fichaId = null;
  }
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); fecharCamada('ficha'); });
  dlg.addEventListener('click', function (e) {
    if (e.target === dlg) { fecharCamada('ficha'); return; }
    var b = e.target.closest('[data-f]');
    if (!b) return;
    var k = b.dataset.f, g = POR_ID[fichaId];
    if (k === 'fechar') { fecharCamada('ficha'); return; }
    if (k === 'recarregar') { fichaEstado[g.f] = ''; abrirFicha(g.i); return; }
    marcar(fichaId, k);
    var velho = dlg.querySelector('.planos');
    if (velho) velho.outerHTML = planosHTML(g);
    var sel = dlg.querySelector('.f-tit .selos');
    if (sel) sel.innerHTML = selosTodos(g, true);
  });

  // ---------------- marcar ----------------
  function marcar(id, k) {
    if (id == null) return;
    if (k === 'int') { if (M.int[id]) delete M.int[id]; else M.int[id] = 1; }
    else if (k === 'inst') { if (M.inst[id]) delete M.inst[id]; else M.inst[id] = 1; }
    else { if (M.plano[id] === k) delete M.plano[id]; else M.plano[id] = k; }
    salvar();
    atualizarCardsDom(id);
    atualizarDisco();
    atualizarAbas();
    if (V.modo === 'grade' && V.fonte.t === 'aba') desenhar(true);
  }

  // ---------------- modo Tinder ----------------
  var TT = $('tinder');
  var T = { fila: [], pos: 0, hist: [], cont: { quero: 0, int: 0, nao: 0 } };

  function abrirTinder() {
    var base = V.modo === 'grade' ? ATUAL : BASE_ATUAL.lista;
    T.fila = base.filter(function (g) { return !M.plano[g.i] && !M.int[g.i]; });
    T.pos = 0; T.hist = []; T.cont = { quero: 0, int: 0, nao: 0 };
    TT.innerHTML =
      '<div class="t-col">' +
        '<div class="t-topo"><h2>🃏 Modo Tinder</h2><p class="t-conta" id="t-conta"></p><button type="button" class="t-x" data-t="fechar" aria-label="Sair do modo Tinder">✕</button></div>' +
        '<div class="t-palco" id="t-palco"></div>' +
        '<div class="t-bts">' +
          '<button type="button" class="t-desf" data-t="desfazer" aria-label="Desfazer" title="Desfazer">↶</button>' +
          '<button type="button" class="t-b-nao" data-t="nao" aria-label="Não quero" title="Não quero (←)">✕</button>' +
          '<button type="button" class="t-b-int" data-t="int" aria-label="Tenho interesse" title="Interesse (↑)">☆</button>' +
          '<button type="button" class="t-b-sim" data-t="quero" aria-label="Quero jogar" title="Quero jogar (→)">✓</button>' +
        '</div>' +
        '<p class="t-dica">Arraste para a direita (quero jogar), esquerda (não quero) ou para cima (interesse). ' +
          (V.modo === 'grade' ? 'Usa a lista aberta: ' + esc(titFonte(V.fonte)) + '.' : 'Usa o catálogo com os filtros atuais.') + '</p>' +
      '</div>';
    TT.hidden = false;
    document.documentElement.classList.add('t-aberto');
    empurrar('tinder');
    mostrarT();
    var b = TT.querySelector('.t-b-sim'); if (b) b.focus();
  }
  function fecharTinderDom() {
    TT.hidden = true; TT.innerHTML = '';
    document.documentElement.classList.remove('t-aberto');
    if (V.modo === 'catalogo') comAncora(function () { desenhar(true); }); else desenhar(true);
  }
  function cartaT(g, classe) {
    var f = FICHAS[g.i], v = g.v || [0, 0];
    function pc(k, i) {
      var mo = f && f.mo ? (f.mo[i] || [])[0] : '';
      return '<div class="t-pc nv' + (v[i] || 0) + '"><b>' + esc(PCS[k].nome) + ': ' + NIVEL[v[i] || 0].nome + '</b>' + (mo ? '<span>' + esc(mo) + '</span>' : '') + '</div>';
    }
    return '<div class="t-card ' + classe + '" data-id="' + g.i + '" style="--gc:' + (COR_GEN[g.g] || COR_GEN.outro) + '">' +
      '<div class="t-capa">' + (g.c ? '<img class="t-fundo" alt="" aria-hidden="true" src="' + esc(urlCapa(g.c)) + '">' : '') +
        '<div class="t-capa-box"><span class="capa-sem" aria-hidden="true">' + esc(g.n) + '</span>' + imgCapa(g, 't-img', false) + '</div>' +
        '<span class="t-carimbo t-c-sim">QUERO</span><span class="t-carimbo t-c-nao">NÃO</span><span class="t-carimbo t-c-int">☆ INTERESSE</span>' +
      '</div>' +
      '<div class="t-corpo"><h3 class="t-tit">' + esc(g.n) + '</h3><div class="selos">' + selosTodos(g, true) + '</div>' +
        '<div class="t-vered">' + pc('pai', 0) + pc('meu', 1) + '</div>' +
        (f && f.ds ? '<p class="t-desc">' + esc(f.ds) + '</p>' : '') +
        '<button type="button" class="ver" data-t="ficha">Ver a ficha completa</button>' +
      '</div></div>';
  }
  function mostrarT() {
    var palco = $('t-palco');
    if (!palco) return;
    var g = T.fila[T.pos], prox = T.fila[T.pos + 1];
    $('t-conta').innerHTML = (g ? '<b>' + fmtN.format(T.pos + 1) + '</b> de ' + fmtN.format(T.fila.length) : 'Fim da fila') +
      ' · ✓ ' + T.cont.quero + ' · ☆ ' + T.cont.int + ' · ✕ ' + T.cont.nao;
    TT.querySelector('.t-desf').disabled = !T.hist.length;
    Array.prototype.forEach.call(TT.querySelectorAll('.t-b-nao,.t-b-int,.t-b-sim'), function (b) { b.disabled = !g; });
    if (!g) {
      palco.innerHTML = '<div class="t-vazio"><p>' + (T.fila.length ? 'Acabaram os jogos desta fila.' : 'Nenhum jogo novo com os filtros atuais.') +
        '</p><p>Mude os filtros ou veja suas marcações.</p><button type="button" class="btn" data-t="fechar">Voltar</button></div>';
      return;
    }
    palco.innerHTML = (prox ? cartaT(prox, 't-baixo') : '') + cartaT(g, 't-cima');
    arrastar(palco.querySelector('.t-cima'));
    [g, prox].forEach(function (j) {
      if (j && !FICHAS[j.i]) pedirFicha(j.f, function () { if (T.fila[T.pos] === g && !TT.hidden) mostrarT(); });
    });
  }
  function decidirT(k, el) {
    var g = T.fila[T.pos];
    if (!g) return;
    T.hist.push({ id: g.i, plano: M.plano[g.i], int: M.int[g.i], k: k });
    if (k === 'int') M.int[g.i] = 1; else M.plano[g.i] = k;
    T.cont[k]++;
    salvar();
    el = el || $('t-palco').querySelector('.t-cima');
    if (el) {
      var x = k === 'quero' ? 1 : k === 'nao' ? -1 : 0;
      el.style.transform = x ? 'translateX(' + (x * 130) + '%) rotate(' + (x * 18) + 'deg)' : 'translateY(-120%)';
      el.style.opacity = '0';
    }
    T.pos++;
    setTimeout(mostrarT, el ? 200 : 0);
  }
  function desfazerT() {
    var h = T.hist.pop();
    if (!h) return;
    if (h.plano) M.plano[h.id] = h.plano; else delete M.plano[h.id];
    if (h.int) M.int[h.id] = 1; else delete M.int[h.id];
    T.cont[h.k]--;
    salvar();
    T.pos = Math.max(0, T.pos - 1);
    mostrarT();
  }
  function arrastar(el) {
    if (!el) return;
    var ativo = false, id = null, x0 = 0, y0 = 0, dx = 0, dy = 0;
    var sim = el.querySelector('.t-c-sim'), nao = el.querySelector('.t-c-nao'), int = el.querySelector('.t-c-int');
    el.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button,a')) return;
      ativo = true; id = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = dy = 0;
      el.classList.add('t-arr');
      try { el.setPointerCapture(id); } catch (er) {}
    });
    el.addEventListener('pointermove', function (e) {
      if (!ativo || e.pointerId !== id) return;
      dx = e.clientX - x0; dy = e.clientY - y0;
      el.style.transform = 'translate(' + dx + 'px,' + Math.min(0, dy) + 'px) rotate(' + (dx / 18) + 'deg)';
      sim.style.opacity = Math.max(0, Math.min(1, dx / 100));
      nao.style.opacity = Math.max(0, Math.min(1, -dx / 100));
      int.style.opacity = Math.abs(dx) < 60 ? Math.max(0, Math.min(1, -dy / 110)) : 0;
    });
    function solta(e) {
      if (!ativo || (e && e.pointerId !== id)) return;
      ativo = false;
      el.classList.remove('t-arr');
      var lim = Math.min(110, el.offsetWidth * 0.28);
      if (dx > lim) decidirT('quero', el);
      else if (dx < -lim) decidirT('nao', el);
      else if (dy < -120 && Math.abs(dx) < 80) decidirT('int', el);
      else { el.style.transform = ''; sim.style.opacity = nao.style.opacity = int.style.opacity = 0; }
    }
    el.addEventListener('pointerup', solta);
    el.addEventListener('pointercancel', solta);
  }
  TT.addEventListener('click', function (e) {
    var b = e.target.closest('[data-t]');
    if (!b) return;
    var k = b.dataset.t;
    if (k === 'fechar') fecharCamada('tinder');
    else if (k === 'desfazer') desfazerT();
    else if (k === 'ficha') { var g = T.fila[T.pos]; if (g) abrirFicha(g.i); }
    else decidirT(k);
  });

  // ---------------- guardar capas no aparelho (pacotes) ----------------
  // As capas vêm em PACOTES (um por lista_NN.js) do repositório estante-pc-capas: capas.json + capas_NN.bin.
  // Cada .bin = uint32 LE com o tamanho L do cabeçalho + L bytes de JSON {"itens": [[appid, "c", início, tamanho], ...]}
  // + as imagens WebP (o início conta a partir de 4 + L). Cada capa é guardada no cache "epc-img-v1" com a chave
  // BASE + c (a mesma URL da Steam que o card pede): o sw.js entrega a WebP guardada (cache primeiro).
  var dlgC = $('dlg-capas');
  var K_PAC = CHAVE + '-capas-pacotes';           // {n: {h: hash, cheio: true/false}} dos pacotes já guardados
  var CAPAS_URL = 'https://luisgabriel102.github.io/estante-pc-capas/';
  try { var cbT = localStorage.getItem(CHAVE + '-capas-base'); if (cbT && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/$/.test(cbT)) CAPAS_URL = cbT; } catch (e) {} // só teste
  var GC = { rodando: false, pausado: false, ctl: null, fila: [], i: 0, escopo: null, total: 0, feito: 0, capas: 0, msg: '', quadro: 0, indice: null };
  var temCache = typeof caches !== 'undefined' && window.isSecureContext;

  function lerPac() { var o = lerJSON(K_PAC, {}); return o && typeof o === 'object' ? o : {}; }
  function gravarPac(o) { try { localStorage.setItem(K_PAC, JSON.stringify(o)); } catch (e) {} }
  function escopoJogos(k) {
    return JOGOS.filter(function (g) {
      if (!g.c) return false;
      if (k === 'rodam') return nv(g) >= 3;
      if (k && k.indexOf('gen:') === 0) return g.g === k.slice(4);
      return true;
    });
  }
  function montarEscopos() {
    var sel = $('dc-escopo'), atual = sel.value || GC.escopo || 'tudo';
    var gs = porGenero(JOGOS);
    var rodam = JOGOS.filter(function (g) { return g.c && nv(g) >= 3; }).length;
    var mbTudo = GC.indice ? GC.indice.pacotes.reduce(function (s, p) { return s + (p.mb || 0); }, 0) : 0;
    sel.innerHTML = '<option value="tudo">Todas as capas (' + fmtN.format(JOGOS.length) + (mbTudo ? ' · ~' + fmtGB.format(mbTudo) + ' MB' : '') + ')</option>' +
      '<option value="rodam">Só as que rodam ' + (F.pc === 'dois' ? 'em algum PC' : noPC(F.pc)) + ' (' + fmtN.format(rodam) + ')</option>' +
      gs.map(function (x) { return '<option value="gen:' + esc(x.k) + '">' + esc((CONF.gen || {})[x.k] || x.k) + ' (' + fmtN.format(x.lista.length) + ')</option>'; }).join('');
    sel.value = atual;
    if (sel.value !== atual) sel.value = 'tudo';
  }
  function buscarIndice() {
    if (GC.indice) return Promise.resolve(GC.indice);
    return fetch(CAPAS_URL + 'capas.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (o) {
      if (!o || !Array.isArray(o.pacotes)) throw new Error('formato');
      GC.indice = o; return o;
    });
  }
  // quais pacotes baixar para este escopo: os que têm algum jogo do escopo que ainda não está no cache
  // (pacote já guardado inteiro com o mesmo hash é pulado; se o hash mudou, baixa de novo)
  function planejar(k) {
    var jogos = escopoJogos(k), porPac = {};
    jogos.forEach(function (g) { (porPac[g.f] = porPac[g.f] || []).push(g); });
    return Promise.all([buscarIndice(), caches.open(CACHE_IMG).then(function (c) { return c.keys(); })]).then(function (r) {
      var ind = r[0], tem = new Set(r[1].map(function (q) { return q.url; })), reg = lerPac(), plano = [], guardadas = 0;
      jogos.forEach(function (g) { if (tem.has(BASE + g.c)) guardadas++; });
      ind.pacotes.forEach(function (p) {
        var meus = porPac[p.n] || [];
        if (!meus.length) return;
        var rp = reg[p.n], faltam = meus.filter(function (g) { return !tem.has(BASE + g.c); }).length;
        var hashNovo = rp && rp.h && rp.h !== p.h;
        if (rp && rp.h === p.h && rp.cheio) return;          // já guardado inteiro, mesmo hash
        if (!faltam && !hashNovo) return;
        plano.push({ p: p, ids: k === 'tudo' ? null : new Set(meus.map(function (g) { return g.i; })), faltam: faltam });
      });
      return { plano: plano, jogos: jogos.length, guardadas: guardadas };
    });
  }
  function pintarGC(pct, txt) {
    var m = $('dc-meter');
    m.querySelector('.fill').style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + '%';
    m.setAttribute('aria-valuenow', Math.round(pct));
    $('dc-txt').textContent = txt;
    var b = $('b-capas');
    b.classList.toggle('baixando', GC.rodando);
    b.textContent = GC.rodando ? '📦 ' + Math.floor(pct) + '%' : '📦 Guardar capas';
    $('dc-baixar').hidden = GC.rodando;
    $('dc-pausar').hidden = !GC.rodando;
    $('dc-baixar').textContent = !GC.rodando && GC.i > 0 && GC.i < GC.fila.length ? 'Continuar' : 'Baixar';
  }
  function uiGC() {
    if (GC.quadro) return;
    GC.quadro = setTimeout(function () {
      GC.quadro = 0;
      var pct = GC.total ? 100 * GC.feito / GC.total : 0, atual = GC.fila[GC.i];
      var txt = GC.msg || (GC.rodando && atual
        ? 'Pacote ' + (GC.i + 1) + ' de ' + GC.fila.length + ': ' + fmtGB.format(GC.feito / 1048576) + ' de ' + fmtGB.format(GC.total / 1048576) + ' MB · ' + fmtN.format(GC.capas) + ' capas guardadas'
        : '');
      pintarGC(pct, txt);
    }, 120);
  }
  function contarGuardadas() {
    if (!temCache || GC.rodando) return;
    var k = $('dc-escopo').value;
    $('dc-txt').textContent = 'Conferindo o que já está guardado…';
    planejar(k).then(function (r) {
      if (GC.rodando) return;
      var mbs = r.plano.reduce(function (s, x) { return s + (x.p.mb || 0); }, 0);
      montarEscopos();
      pintarGC(r.jogos ? 100 * r.guardadas / r.jogos : 0, !r.plano.length
        ? 'Todas as ' + fmtN.format(r.jogos) + ' capas já estão guardadas neste aparelho.'
        : fmtN.format(r.guardadas) + ' de ' + fmtN.format(r.jogos) + ' já estão guardadas. Falta baixar ' + r.plano.length + (r.plano.length === 1 ? ' pacote' : ' pacotes') + ' (~' + fmtGB.format(mbs) + ' MB).');
    }).catch(function () {
      if (!GC.rodando) pintarGC(0, 'Não deu para buscar a lista de pacotes de capas. Confira a internet e abra de novo.');
    });
  }
  function atualizarEspaco() {
    var el = $('dc-espaco');
    if (!temCache) { el.textContent = 'Para guardar as capas, abra pelo endereço do site (https).'; return; }
    if (!navigator.storage || !navigator.storage.estimate) { el.textContent = ''; return; }
    Promise.all([navigator.storage.estimate(), navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false)]).then(function (r) {
      var e = r[0];
      el.textContent = 'Este site usa ' + mb(e.usage || 0) + ' neste aparelho' + (e.quota ? ' (o navegador deixa usar até ' + mb(e.quota) + ')' : '') + '. ' +
        (r[1] ? 'Guardado de forma permanente: o navegador não apaga sozinho.' : 'O navegador pode apagar se faltar espaço' + (instaladoApp() ? '.' : ' (instalar o app ajuda a guardar de vez).'));
    }).catch(function () {});
  }
  // baixa um pacote inteiro com progresso por bytes; devolve um Blob (sem copiar: os pedaços são fatiados depois)
  function baixarPacote(p, aoProgredir) {
    GC.ctl = window.AbortController ? new AbortController() : null;
    return fetch(CAPAS_URL + p.arq + '?h=' + encodeURIComponent(p.h), { cache: 'no-store', signal: GC.ctl ? GC.ctl.signal : undefined }).then(function (r) {
      if (!r.ok) throw new Error('o servidor das capas respondeu ' + r.status);
      if (!r.body || !r.body.getReader) return r.blob().then(function (b) { aoProgredir(b.size); return b; });
      var leitor = r.body.getReader(), pedacos = [], n = 0;
      return (function ler() {
        return leitor.read().then(function (x) {
          if (x.done) return new Blob(pedacos);
          pedacos.push(x.value); n += x.value.length; aoProgredir(n);
          return ler();
        });
      })();
    });
  }
  // corta o pacote e guarda cada capa no cache, com a URL da Steam como chave
  function guardarPacote(blob, ids, cache) {
    return blob.slice(0, 4).arrayBuffer().then(function (b4) {
      var L = new DataView(b4).getUint32(0, true);
      return blob.slice(4, 4 + L).text().then(function (t) { return { L: L, cab: JSON.parse(t) }; });
    }).then(function (x) {
      var itens = (x.cab.itens || []).filter(function (it) { return !ids || ids.has(it[0]); }), ini = 4 + x.L, k = 0;
      function proximo() { // 12 de cada vez
        var lote = itens.slice(k, k + 12); k += 12;
        if (!lote.length) return Promise.resolve();
        return Promise.all(lote.map(function (it) {
          var img = blob.slice(ini + it[2], ini + it[2] + it[3], 'image/webp');
          return cache.put(BASE + it[1], new Response(img, { headers: { 'Content-Type': 'image/webp', 'Content-Length': String(it[3]) } }))
            .then(function () { GC.capas++; });
        })).then(function () { uiGC(); return proximo(); });
      }
      return proximo();
    });
  }
  function rodarFila() {
    if (GC.pausado || GC.i >= GC.fila.length) {
      GC.rodando = false; GC.ctl = null;
      var terminou = GC.i >= GC.fila.length;
      GC.msg = terminou ? 'Pronto: ' + fmtN.format(GC.capas) + ' capas guardadas neste aparelho.' : 'Pausado no pacote ' + (GC.i + 1) + ' de ' + GC.fila.length + '. Toque em Continuar.';
      if (terminou && navigator.storage && navigator.storage.persist) navigator.storage.persist().then(atualizarEspaco).catch(function () {});
      uiGC(); atualizarEspaco();
      return;
    }
    var x = GC.fila[GC.i], antes = GC.feito;
    GC.msg = '';
    baixarPacote(x.p, function (n) { GC.feito = antes + n; uiGC(); }).then(function (blob) {
      GC.feito = antes + blob.size;
      GC.msg = 'Guardando as capas do pacote ' + (GC.i + 1) + ' de ' + GC.fila.length + '…'; uiGC();
      return caches.open(CACHE_IMG).then(function (c) { return guardarPacote(blob, x.ids, c); });
    }).then(function () {
      var reg = lerPac();
      var cheio = !x.ids || (reg[x.p.n] && reg[x.p.n].h === x.p.h && reg[x.p.n].cheio);
      reg[x.p.n] = { h: x.p.h, cheio: !!cheio };
      gravarPac(reg);
      GC.i++;
      rodarFila();
    }).catch(function (e) {
      GC.feito = antes;
      if (GC.pausado) { rodarFila(); return; } // pausa no meio: o pacote recomeça ao continuar
      GC.rodando = false; GC.ctl = null;
      GC.msg = 'Parou no pacote ' + (GC.i + 1) + ' de ' + GC.fila.length + ' (' + (e && e.message ? e.message : 'sem internet?') + '). Toque em Continuar.';
      uiGC();
    });
  }
  function baixarCapas() {
    if (!temCache) { atualizarEspaco(); return; }
    if (GC.rodando) return;
    var k = $('dc-escopo').value;
    GC.rodando = true; GC.pausado = false; GC.msg = 'Conferindo o que falta…'; uiGC();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    var continuar = GC.escopo === k && GC.i > 0 && GC.i < GC.fila.length;
    (continuar ? Promise.resolve(null) : planejar(k)).then(function (r) {
      if (r) {
        GC.fila = r.plano; GC.i = 0; GC.escopo = k; GC.capas = 0; GC.feito = 0;
        GC.total = r.plano.reduce(function (s, x) { return s + Math.round((x.p.mb || 0) * 1048576); }, 0);
        if (!r.plano.length) { GC.rodando = false; GC.msg = 'Todas as capas escolhidas já estão guardadas.'; uiGC(); return; }
      } else {
        GC.feito = GC.fila.slice(0, GC.i).reduce(function (s, x) { return s + Math.round((x.p.mb || 0) * 1048576); }, 0);
      }
      rodarFila();
    }).catch(function () {
      GC.rodando = false; GC.msg = 'Não deu para buscar a lista de pacotes de capas. Confira a internet.'; uiGC();
    });
  }
  function abrirCapas() {
    montarEscopos();
    if (!dlgC.open) { dlgC.showModal(); empurrar('capas'); }
    atualizarEspaco();
    if (GC.rodando || GC.fila.length) uiGC(); else contarGuardadas();
  }
  $('b-capas').addEventListener('click', abrirCapas);
  $('dc-baixar').addEventListener('click', baixarCapas);
  $('dc-pausar').addEventListener('click', function () { GC.pausado = true; GC.msg = 'Pausando…'; if (GC.ctl) GC.ctl.abort(); uiGC(); });
  $('dc-escopo').addEventListener('change', function () { if (!GC.rodando) { GC.fila = []; GC.i = 0; GC.msg = ''; contarGuardadas(); } });
  dlgC.addEventListener('cancel', function (e) { e.preventDefault(); fecharCamada('capas'); });
  dlgC.addEventListener('click', function (e) {
    if (e.target === dlgC || e.target.closest('[data-dc="fechar"]')) fecharCamada('capas');
  });

  // ---------------- 📲 instalar o app (PWA) ----------------
  var pedidoInstalar = null;
  var ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  function instaladoApp() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function guardarDeVez() { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(atualizarEspaco).catch(function () {}); }
  var bInst = $('b-instalar');
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); pedidoInstalar = e;
    if (bInst) bInst.hidden = false;
  });
  window.addEventListener('appinstalled', function () {
    pedidoInstalar = null;
    if (bInst) bInst.hidden = true;
    guardarDeVez();
  });
  if (bInst) {
    if (ehIOS && !instaladoApp()) bInst.hidden = false; // no iPhone não há o pedido: o botão mostra a dica
    bInst.addEventListener('click', function () {
      if (pedidoInstalar) {
        pedidoInstalar.prompt();
        pedidoInstalar.userChoice.then(function (c) { if (c && c.outcome === 'accepted') { bInst.hidden = true; guardarDeVez(); } pedidoInstalar = null; }).catch(function () {});
        return;
      }
      var d = $('dica-instalar');
      if (d) d.hidden = !d.hidden;
    });
  }
  if (instaladoApp()) guardarDeVez();

  // ---------------- cópia das marcações ----------------
  function exportar() {
    var dados = { app: 'estante-pc', versao: 1, data: new Date().toISOString(), int: M.int, inst: M.inst, plano: M.plano };
    var blob = new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'estante-pc-marcacoes-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    $('marc-msg').textContent = 'Cópia baixada.';
  }
  function importar(arq) {
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (!d || typeof d !== 'object' || (!d.int && !d.inst && !d.plano)) throw new Error('formato');
        var n = 0, id;
        for (id in d.int || {}) { M.int[id] = 1; n++; }
        for (id in d.inst || {}) { M.inst[id] = 1; n++; }
        for (id in d.plano || {}) { if (['quero', 'joguei', 'nao'].indexOf(d.plano[id]) >= 0) { M.plano[id] = d.plano[id]; n++; } }
        salvar(); desenhar(true); atualizarDisco();
        $('marc-msg').textContent = 'Cópia carregada: ' + n + ' marcações juntadas às que já estavam aqui.';
      } catch (e) { $('marc-msg').textContent = 'Esse arquivo não é uma cópia da Estante do PC.'; }
    };
    r.readAsText(arq);
  }

  // ---------------- eventos ----------------
  $('conteudo').addEventListener('click', function (e) {
    var v = e.target.closest('[data-ver]');
    if (v) { var p = v.dataset.ver.split(':'); abrirGrade({ t: p[0], k: p[1] }); return; }
    var b = e.target.closest('[data-acao]');
    if (!b) return;
    var c = b.closest('.card'), id = c && c.dataset.id;
    if (!id) return;
    if (b.dataset.acao === 'ver') abrirFicha(id); else marcar(id, b.dataset.acao);
  });
  // capa que não carregou: tenta a original; se também falhar, fica o bloco com a cor do gênero e o nome
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    if (/(^| )(capa|f-capa|t-img|f-fundo|t-fundo)( |$)/.test(t.className)) t.remove();
  }, true);

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-gen],[data-aba],[data-limpar],[data-tirar]');
    if (!b || TT.contains(b) || dlg.contains(b)) return;
    if (b.dataset.gen != null && b.hasAttribute('data-gen')) {
      if (b.dataset.gen === '') { if (V.modo === 'grade') fecharCamada('grade'); else rolarPara($('conteudo')); }
      else irGenero(b.dataset.gen);
    } else if (b.dataset.aba) abrirGrade({ t: 'aba', k: b.dataset.aba });
    else if (b.dataset.tirar) tirarFiltro(b.dataset.tirar);
    else if (b.dataset.limpar) limpar();
  });
  $('b-voltar').addEventListener('click', function () { fecharCamada('grade'); });
  $('seg-pc').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pc]');
    if (!b || b.dataset.pc === F.pc) return;
    F.pc = b.dataset.pc; AJ.pc = F.pc; salvarAj();
    montarPCs(); redesenharFiltros(); atualizarDisco();
  });
  $('tiles').addEventListener('click', function (e) {
    var b = e.target.closest('.tile');
    if (!b) return;
    var n = +b.dataset.nv;
    if (V.modo === 'grade' && V.fonte.t === 'nivel' && V.fonte.k === n) fecharCamada('grade');
    else abrirGrade({ t: 'nivel', k: n });
  });
  $('f-idioma').addEventListener('change', function () { F.idioma = this.value; sincronizarCampos(); redesenharFiltros(); });
  $('f-ordem').addEventListener('change', function () { F.ordem = this.value; sincronizarCampos(); redesenharFiltros(); });
  [['c-rom', 'rom'], ['c-18', 'esc18'], ['c-vet', 'escVet'], ['c-nao', 'naoRoda'], ['c-ctrl', 'ctrl']].forEach(function (p) {
    $(p[0]).addEventListener('change', function () { F[p[1]] = this.checked; redesenharFiltros(); });
  });
  function abrirFiltros(ab) {
    $('painel-filtros').hidden = !ab;
    $('b-filtros').setAttribute('aria-expanded', String(ab));
  }
  $('b-filtros').addEventListener('click', function () { abrirFiltros($('painel-filtros').hidden); });
  $('b-pronto').addEventListener('click', function () { abrirFiltros(false); });
  $('mais').addEventListener('click', mostrarMais);
  $('b-tinder').addEventListener('click', abrirTinder);
  $('b-marc').addEventListener('click', function () { rolarPara($('marcacoes')); });
  $('b-desmarcar').addEventListener('click', function () {
    var ids = Object.keys(M.inst);
    if (!ids.length) return;
    M.inst = {}; salvar();
    ids.forEach(atualizarCardsDom);
    atualizarDisco(); atualizarAbas();
  });
  $('barra-disco').addEventListener('click', function () { rolarPara($('painel-pc')); });
  $('b-exportar').addEventListener('click', exportar);
  $('f-importar').addEventListener('change', function () { if (this.files[0]) importar(this.files[0]); this.value = ''; });

  function aplicarTema() {
    var claro = AJ.tema === 'claro';
    document.documentElement.dataset.theme = claro ? 'light' : 'dark';
    var b = $('b-tema');
    b.setAttribute('aria-pressed', String(claro));
    b.textContent = claro ? '🌙 Tema escuro' : '☀ Tema claro';
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = claro ? '#e6ecf2' : '#171a21';
  }
  $('b-tema').addEventListener('click', function () { AJ.tema = AJ.tema === 'claro' ? 'escuro' : 'claro'; salvarAj(); aplicarTema(); });

  document.addEventListener('keydown', function (e) {
    if (!TT.hidden && !dlg.open) {
      if (e.key === 'ArrowRight') { e.preventDefault(); decidirT('quero'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); decidirT('nao'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); decidirT('int'); }
      else if (e.key === 'Backspace') { e.preventDefault(); desfazerT(); }
      else if (e.key === 'Escape') { e.preventDefault(); fecharCamada('tinder'); }
      return;
    }
    if (e.key === '/' && !dlg.open && !dlgC.open && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) {
      e.preventDefault(); $('q').focus();
    }
  });

  // altura real da barra fixa (para as seções pararem logo abaixo dela)
  function medirTopo() { document.documentElement.style.setProperty('--topo-h', Math.round(topoH()) + 'px'); }
  if (window.ResizeObserver) new ResizeObserver(medirTopo).observe($('barra-topo'));
  window.addEventListener('resize', medirTopo);

  // "↑ Topo": aparece depois de rolar um pouco e leva de volta à busca e aos gêneros
  var bSubir = $('b-subir'), subirPend = false;
  window.addEventListener('scroll', function () {
    if (subirPend) return;
    subirPend = true;
    setTimeout(function () { subirPend = false; bSubir.hidden = window.scrollY < 700; }, 150);
  }, { passive: true });
  bSubir.addEventListener('click', function () { $('barra-topo').scrollIntoView({ block: 'start' }); $('q').focus({ preventScroll: true }); });

  // ---------------- início ----------------
  // o app sempre abre no catálogo completo: busca e filtros começam vazios (o navegador às vezes devolve o texto da busca)
  $('q').value = '';
  sincronizarCampos();
  if (!podeSalvar) $('aviso-salvar').hidden = false;
  aplicarTema();
  montarMeta();
  montarPCs();
  montarAbas();
  atualizarDisco();
  desenhar(false);
  medirTopo();
  if (!ARQS.length) $('mostrando').textContent = 'Nenhum arquivo de dados encontrado.';
  pedirLista();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  // ---------------- ganchos para a sincronização (sync.js) ----------------
  window.ESTANTE_PC = {
    // a nuvem mudou as marcações: relê do localStorage e redesenha, sem recarregar a página
    recarregarMarcas: function () {
      var n = lerJSON(CHAVE, {});
      M.int = n.int || {}; M.inst = n.inst || {}; M.plano = n.plano || {};
      if (V.modo === 'catalogo') comAncora(function () { desenhar(true); }); else desenhar(true);
      atualizarDisco(); atualizarAbas();
      if (dlg.open && fichaId != null && POR_ID[fichaId]) {
        var g = POR_ID[fichaId], p = dlg.querySelector('.planos'), s = dlg.querySelector('.f-tit .selos');
        if (p) p.outerHTML = planosHTML(g);
        if (s) s.innerHTML = selosTodos(g, true);
      }
    },
    marcar: function (id, k) { marcar(String(id), k); }, // o mesmo caminho dos botões (usado nos testes)
    marcas: function () { return JSON.parse(JSON.stringify(M)); }
  };
})();

/* 1.7.5 (26/11): no celular os chips de gênero ficam em 2 linhas; o botão abre e fecha o resto */
(function () {
  var g = document.getElementById('gens');
  if (!g || !window.matchMedia) return;
  var mq = window.matchMedia('(max-width: 699px)');
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'gens-mais'; b.setAttribute('aria-controls', 'gens');
  g.parentNode.insertBefore(b, g.nextSibling);
  var aberto = false;
  function pintar() {
    var cel = mq.matches;
    g.classList.toggle('fechado', cel && !aberto);
    b.hidden = !cel || (!aberto && g.scrollHeight <= 80);
    b.textContent = aberto ? 'Menos gêneros ▴' : 'Todos os gêneros (' + g.children.length + ') ▾';
    b.setAttribute('aria-expanded', String(aberto));
  }
  b.addEventListener('click', function () { aberto = !aberto; pintar(); });
  // ao tocar num gênero, fecha de novo (a página já desce até ele)
  g.addEventListener('click', function (e) { if (aberto && e.target.closest('button')) { aberto = false; setTimeout(pintar, 0); } });
  if (mq.addEventListener) mq.addEventListener('change', pintar);
  if (window.MutationObserver) new MutationObserver(pintar).observe(g, { childList: true });
  pintar();
})();

/* 1.7.6 (26/11): o site não fica preso numa versão velha.
   - confere ao abrir e ao voltar para a aba se o site publicado tem outra versão; se tiver, mostra "toque para atualizar"
   - quando o service worker novo assume, recarrega uma vez sozinho (só se já havia um antes) */
(function () {
  var minha = (window.CONF && CONF.versao) || '';
  var aviso = null, ultima = 0;
  function mostrar(v) {
    if (aviso) return;
    aviso = document.createElement('button');
    aviso.type = 'button'; aviso.className = 'aviso-versao';
    aviso.textContent = '✨ Saiu a versão ' + v + ': toque para atualizar';
    aviso.addEventListener('click', function () { location.reload(); });
    document.body.appendChild(aviso);
  }
  function conferir() {
    if (!minha || !/^https?:$/.test(location.protocol) || Date.now() - ultima < 60000) return;
    ultima = Date.now();
    fetch('./?nova=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var m = /"versao":"([^"]+)"/.exec(t);
      if (m && m[1] !== minha) mostrar(m[1]);
    }).catch(function () {});
  }
  setTimeout(conferir, 4000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') conferir(); });
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    var recarregou = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (recarregou || document.querySelector('dialog[open]')) return;
      recarregou = true; location.reload();
    });
  }
})();

/* 1.8 (26/11): sincroniza as marcações entre o PC e o celular, do mesmo jeito da Estante do Switch (mod_G_sync.js).
   - a "nuvem" é um gist SECRETO na conta do dono; o arquivo daqui é "estante-pc-sync.json"
   - usa o MESMO token e o MESMO gist da Estante do Switch (mesma origem, mesmo localStorage): grava só o próprio arquivo
     (PATCH só de "estante-pc-sync.json"), sem mexer no do Switch
   - cada marcação (interesse, instalar, plano) guarda a data da última mudança; tirar uma marcação vira "lápide" com data;
     a junção é item a item e fica a mais nova (no empate, a marcação ganha da lápide)
   - sincroniza ao abrir, ao voltar para a aba, 4 s depois de cada mudança e quando a internet volta; sem internet, envia depois
   - o PC escolhido e o tema ficam só neste aparelho
   - só para teste: a chave "estante-pc-v1-sync-api" troca o api.github.com por um servidor falso (só aceita 127.0.0.1/localhost) */
(function () {
  'use strict';
  var CHAVE = 'estante-pc-v1';
  var ARQ = 'estante-pc-sync.json', ARQ_SW = 'estante-switch-sync.json';
  var SW = 'estante-switch-v1';
  var K_TOK = SW + '-sync-token', K_GIST = SW + '-sync-gist', K_LOGIN = SW + '-sync-login'; // compartilhados com a Estante do Switch
  var K_META = CHAVE + '-sync-meta', K_OFF = CHAVE + '-sync-off', K_API = CHAVE + '-sync-api';  // só desta estante
  var LINK_TOKEN = 'https://github.com/settings/tokens/new?scopes=gist&description=Estante%20do%20Switch%20e%20do%20PC';
  var API = 'https://api.github.com';
  try { var apiT = localStorage.getItem(K_API); if (apiT && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(apiT)) API = apiT; } catch (e) {}
  var PLANOS = { quero: 1, joguei: 1, nao: 1 };

  function $(id) { return document.getElementById(id); }
  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravar(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function parse(t) { try { return JSON.parse(t); } catch (e) { return undefined; } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lerMeta() {
    var m = parse(ler(K_META) || 'null');
    if (!m || typeof m !== 'object' || !m.itens || typeof m.itens !== 'object') m = { itens: {}, ini: false, seq: 0, pend: false, ult: 0 };
    return m;
  }
  function gravarMeta(m) { gravar(K_META, JSON.stringify(m)); }

  // ---------- as marcações viram itens: "int|570", "inst|570", "pl|570" (valor: quero/joguei/nao) ----------
  function achatar(txt) {
    var o = parse(txt || 'null'), r = {};
    if (!o || typeof o !== 'object') return r;
    Object.keys(o.int || {}).forEach(function (id) { if (o.int[id]) r['int|' + id] = 1; });
    Object.keys(o.inst || {}).forEach(function (id) { if (o.inst[id]) r['inst|' + id] = 1; });
    Object.keys(o.plano || {}).forEach(function (id) { if (PLANOS[o.plano[id]]) r['pl|' + id] = o.plano[id]; });
    return r;
  }
  function montar(vivos) {
    var o = { int: {}, inst: {}, plano: {} };
    Object.keys(vivos).forEach(function (s) {
      var i = s.indexOf('|'), tipo = s.slice(0, i), id = s.slice(i + 1);
      if (tipo === 'int') o.int[id] = 1;
      else if (tipo === 'inst') o.inst[id] = 1;
      else if (tipo === 'pl' && PLANOS[vivos[s]]) o.plano[id] = vivos[s];
    });
    return JSON.stringify(o);
  }
  // compara o que está salvo com o que estava anotado e data o que mudou
  // (na primeira vez neste aparelho, o que já existia entra com data 0: não apaga nada que esteja na nuvem)
  function registrar(m, txt) {
    var F = achatar(txt), agora = Date.now(), base = m.ini ? agora : 0, mudou = false;
    Object.keys(F).forEach(function (s) {
      var cur = m.itens[s];
      if (!cur || cur.d || String(cur.v) !== String(F[s])) { m.itens[s] = { t: base, v: F[s] }; mudou = true; }
    });
    Object.keys(m.itens).forEach(function (s) {
      if (!m.itens[s].d && !(s in F)) { m.itens[s] = { t: base, d: 1 }; mudou = true; }
    });
    if (mudou && m.ini) { m.seq = (m.seq || 0) + 1; m.pend = true; }
    return mudou;
  }
  function conferirTudo() {
    var m = lerMeta(), mudou = registrar(m, ler(CHAVE));
    if (!m.ini) { m.ini = true; mudou = true; }
    if (mudou) gravarMeta(m);
    return m;
  }

  // ---------- junção item a item ----------
  function vence(a, b) { // a = deste aparelho, b = da nuvem
    if (!a) return b;
    if (!b) return a;
    if (a.t !== b.t) return a.t > b.t ? a : b;
    if (!!a.d !== !!b.d) return a.d ? b : a; // empate: a marcação ganha da lápide
    return b;
  }
  function igual(a, b) { return !!a && !!b && a.t === b.t && !!a.d === !!b.d && String(a.v) === String(b.v); }
  function juntar(L, R) {
    var out = {}, mudLocal = false, difRemoto = false;
    Object.keys(L).concat(Object.keys(R)).forEach(function (id) {
      if (id in out) return;
      var w = vence(L[id], R[id]);
      if (!w || typeof w !== 'object' || typeof w.t !== 'number') return;
      out[id] = w;
      if (!igual(w, L[id])) mudLocal = true;
      if (!igual(w, R[id])) difRemoto = true;
    });
    return { itens: out, mudLocal: mudLocal, difRemoto: difRemoto };
  }
  function aplicarLocal(res) {
    var m = lerMeta();
    m.itens = res.itens;
    gravarMeta(m);
    if (!res.mudLocal) return;
    var vivos = {};
    Object.keys(res.itens).forEach(function (s) { if (!res.itens[s].d) vivos[s] = res.itens[s].v; });
    var novo = montar(vivos);
    if (JSON.stringify(achatar(novo)) === JSON.stringify(achatar(ler(CHAVE)))) return;
    gravar(CHAVE, novo); // direto no localStorage: não passa pelo salvar() do app (não vira "mudança" deste aparelho)
    try { if (window.ESTANTE_PC) window.ESTANTE_PC.recarregarMarcas(); } catch (e) { console.warn('sync:', e); }
  }

  // ---------- conversa com o GitHub ----------
  function Erro(tipo, msg) { var e = new Error(msg); e.tipo = tipo; return e; }
  function token() { var t = ler(K_TOK); return t && t.length > 10 ? t : null; }
  function desligado() { return ler(K_OFF) === '1'; }
  function conectado() { return !!token() && !desligado(); }
  function pedir(metodo, caminho, corpo, leve) {
    var op = { method: metodo, cache: 'no-store', headers: { 'Authorization': 'token ' + token(), 'Accept': 'application/vnd.github+json' } };
    if (corpo !== undefined) { op.body = JSON.stringify(corpo); op.headers['Content-Type'] = 'application/json'; if (leve && op.body.length < 60000) op.keepalive = true; }
    return fetch(API + caminho, op).catch(function () { throw Erro('rede', 'sem internet'); }).then(function (r) {
      if (r.ok) return r.status === 204 ? null : r.json();
      if (r.status === 401) throw Erro('token', 'o GitHub recusou o código (errado, apagado ou vencido)');
      if (r.status === 403 && r.headers.get('x-ratelimit-remaining') === '0') throw Erro('limite', 'o GitHub pediu uma pausa; tento de novo em uma hora');
      if (r.status === 403 || (r.status === 404 && (metodo === 'POST' || caminho.indexOf('/gists?') === 0))) throw Erro('permissao', 'o código não tem a permissão "gist"');
      if (r.status === 404) throw Erro('sumiu', 'gist não encontrado');
      throw Erro('erro', 'o GitHub respondeu com erro ' + r.status);
    });
  }
  // o gist: o mesmo da Estante do Switch (se já houver); senão procura um com o arquivo de uma das duas estantes
  function acharGist() {
    var id = ler(K_GIST);
    if (id) return Promise.resolve(id);
    var achado = null, nota = -1;
    function pagina(n) {
      return pedir('GET', '/gists?per_page=100&page=' + n).then(function (lista) {
        (lista || []).forEach(function (g) {
          if (!g || !g.files) return;
          var p = (g.files[ARQ_SW] ? 2 : 0) + (g.files[ARQ] ? 1 : 0); // o que tem os dois arquivos, depois o do Switch
          if (p > 0 && (p > nota || (p === nota && String(g.updated_at) > String(achado.updated_at)))) { achado = g; nota = p; }
        });
        if (lista && lista.length === 100 && n < 30) return pagina(n + 1);
      });
    }
    return pagina(1).then(function () {
      if (achado) { gravar(K_GIST, achado.id); return achado.id; }
      return null;
    });
  }
  function baixar(id) {
    return pedir('GET', '/gists/' + encodeURIComponent(id)).then(function (g) {
      var f = g && g.files && g.files[ARQ];
      if (!f) return { itens: {} }; // o gist existe (do Switch) mas ainda não tem o arquivo do PC
      var conteudo = f.truncated && f.raw_url
        ? fetch(f.raw_url, { cache: 'no-store' }).catch(function () { throw Erro('rede', 'sem internet'); }).then(function (r) { if (!r.ok) throw Erro('erro', 'não deu para ler o arquivo da nuvem'); return r.text(); })
        : Promise.resolve(f.content || '');
      return conteudo.then(function (txt) {
        if (!txt.trim()) return { itens: {} };
        var o = parse(txt);
        if (!o || typeof o !== 'object' || !o.itens || typeof o.itens !== 'object') throw Erro('estragado', 'o arquivo da nuvem não está no formato da Estante; nada foi mudado');
        return o;
      });
    });
  }
  function docDe(itens) {
    var limite = Date.now() - 400 * 864e5, it = {};
    Object.keys(itens).forEach(function (id) { var x = itens[id]; if (!(x.d && x.t && x.t < limite)) it[id] = x; }); // lápides com mais de 400 dias saem
    return JSON.stringify({ app: 'Estante do PC', v: 1, upd: Date.now(), itens: it });
  }
  function arquivo(conteudo) { var f = {}; f[ARQ] = { content: conteudo }; return f; }
  function criar(conteudo) {
    return pedir('POST', '/gists', { description: 'Estante do Switch e do PC: marcações (sincronização entre aparelhos; não apague)', public: false, files: arquivo(conteudo) })
      .then(function (g) { gravar(K_GIST, g.id); return g.id; });
  }
  function enviar(id, conteudo, leve) { return pedir('PATCH', '/gists/' + encodeURIComponent(id), { files: arquivo(conteudo) }, leve); } // só o arquivo do PC

  // ---------- o ciclo: confere, baixa, junta, aplica, envia ----------
  var estado = { fase: 'off', msg: '' }, andando = false, deNovo = false, timer = 0, ultTent = 0;
  function agendar(ms) { clearTimeout(timer); timer = setTimeout(function () { sincronizar('mudança'); }, ms); }
  function sincronizar(motivo, leve) {
    if (!conectado()) { estado.fase = 'off'; mostrar(); return Promise.resolve(); }
    if (andando) { deNovo = true; return Promise.resolve(); }
    andando = true; ultTent = Date.now(); clearTimeout(timer);
    var m0 = conferirTudo(), seq = m0.seq || 0, id = null;
    estado.fase = m0.pend ? 'enviando' : 'conferindo'; mostrar();
    return acharGist().then(function (gid) {
      if (!gid) { estado.fase = 'enviando'; mostrar(); return criar(docDe(lerMeta().itens)).then(function (nid) { id = nid; return { criou: true }; }); }
      id = gid;
      return baixar(gid).catch(function (e) {
        if (e.tipo !== 'sumiu') throw e;
        gravar(K_GIST, null); // o gist foi apagado: procura outro ou cria de novo
        return acharGist().then(function (g2) {
          if (g2) { id = g2; return baixar(g2); }
          return criar(docDe(lerMeta().itens)).then(function (nid) { id = nid; return { criou: true }; });
        });
      });
    }).then(function (remoto) {
      if (remoto.criou) return;
      var m = lerMeta(), res = juntar(m.itens, remoto.itens || {});
      aplicarLocal(res);
      seq = lerMeta().seq || 0;
      if (!res.difRemoto && !lerMeta().pend) return;
      estado.fase = 'enviando'; mostrar();
      return enviar(id, docDe(res.itens), leve);
    }).then(function () {
      var m = lerMeta();
      if ((m.seq || 0) === seq) m.pend = false;
      m.ult = Date.now();
      gravarMeta(m);
      estado.fase = 'ok'; estado.msg = '';
      andando = false;
      if (m.pend || deNovo) { deNovo = false; agendar(800); }
      mostrar();
    }).catch(function (e) {
      andando = false;
      estado.fase = e.tipo === 'rede' ? 'offline' : (e.tipo === 'token' || e.tipo === 'permissao') ? 'token' : 'erro';
      estado.msg = e.tipo === 'rede' ? '' : e.message;
      if (!e.tipo) console.warn('sync:', e);
      mostrar();
      if (e.tipo === 'rede' || e.tipo === 'erro' || e.tipo === 'limite') agendar(e.tipo === 'limite' ? 3600e3 : 60000);
    });
  }

  // ---------- interface: bloco em "Minhas marcações" + selinho no topo quando der erro ----------
  function hora(t) { return new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function textoEstado() {
    var m = lerMeta();
    if (!token()) return 'Desligado: ainda não está ligado em nenhum aparelho deste navegador.';
    if (desligado()) return 'Desligado neste aparelho.';
    switch (estado.fase) {
      case 'conferindo': return 'Conferindo…';
      case 'enviando': return 'Enviando…';
      case 'offline': return m.pend ? 'Sem internet: envia depois.' : 'Sem internet agora.';
      case 'token': return 'Erro: ' + (estado.msg || 'o GitHub recusou o código') + '.';
      case 'erro': return 'Erro: ' + (estado.msg || 'não deu para sincronizar') + '.';
      case 'ok': return m.pend ? 'Falta enviar…' : (m.ult ? 'Sincronizado às ' + hora(m.ult) + '.' : 'Ligado.');
      default: return 'Ligado.';
    }
  }
  function mascarar(t) { return t.length > 12 ? t.slice(0, 4) + '••••••••' + t.slice(-4) : '••••••••'; }
  var desenhado = '';
  function mostrar() {
    var st = $('sync-st'), corpo = $('sync-corpo'), selo = $('sync-selo');
    if (!st || !corpo) return;
    var fase = !token() ? 'off' : desligado() ? 'desligado' : estado.fase;
    st.textContent = textoEstado();
    st.dataset.fase = fase;
    if (selo) {
      var ruim = fase === 'token' || fase === 'erro';
      selo.hidden = !ruim;
      selo.title = ruim ? textoEstado() : '';
    }
    // o corpo só é refeito quando muda de "tipo" (para não apagar o que a pessoa está digitando)
    var tipo = !token() || fase === 'token' ? 'form' : desligado() ? 'ligar' : 'ligado';
    if (tipo === desenhado && tipo !== 'ligado') return;
    desenhado = tipo;
    var t = token(), login = ler(K_LOGIN), h = '';
    if (tipo === 'form') {
      h = (fase === 'token' ? '<p>O código guardado não vale mais. Crie outro e cole aqui (a Estante do Switch passa a usar o novo também).</p>'
        : '<p>As suas marcações (interesse, instalar, quero jogar, já joguei, não quero) ficam iguais no PC e no celular. Elas ficam num arquivo secreto na sua conta do GitHub, o mesmo da Estante do Switch. Se você já ligou a sincronização na Estante do Switch neste navegador, ela liga aqui sozinha.</p>') +
        '<ol class="sync-passos">' +
        '<li>Abra o link e entre na sua conta do GitHub: <a href="' + LINK_TOKEN + '" target="_blank" rel="noopener">criar o código de acesso</a>.</li>' +
        '<li>Em <b>Expiration</b>, escolha <b>No expiration</b>. A caixinha <b>gist</b> já vem marcada: não marque mais nada.</li>' +
        '<li>Toque no botão verde <b>Generate token</b> e copie o código (começa com <b>ghp_</b>).</li>' +
        '<li>Cole aqui embaixo e toque em <b>Ligar</b>. No outro aparelho, faça o mesmo com o mesmo código.</li></ol>' +
        '<form class="sync-form" id="sync-form"><label for="sync-tok">Código de acesso</label>' +
        '<input id="sync-tok" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ghp_..." required>' +
        '<button type="submit" class="btn btn-forte">Ligar</button></form>' +
        '<p class="fine">O código fica só neste aparelho (nunca vai para o site) e só serve para esse arquivo secreto.</p>';
    } else if (tipo === 'ligar') {
      h = '<p>A sincronização está desligada neste aparelho. O código continua guardado (a Estante do Switch usa o mesmo).</p>' +
        '<div class="actions"><button type="button" class="btn btn-forte" data-sync="ligar">Ligar neste aparelho</button></div>';
    } else {
      h = '<p class="fine">' + (login ? 'Conta <b>' + esc(login) + '</b>, ' : '') + 'código <code class="sync-mask">' + esc(mascarar(t)) + '</code>. ' +
        'O que você marca aqui vai sozinho para a nuvem em poucos segundos; ao abrir, a Estante pega o que mudou no outro aparelho. Se os dois mudaram o mesmo jogo, fica a mudança mais nova.</p>' +
        '<div class="actions"><button type="button" class="btn btn-forte" data-sync="agora">Sincronizar agora</button>' +
        '<button type="button" class="btn sync-sair" data-sync="desligar">Desligar neste aparelho</button></div>';
    }
    corpo.innerHTML = h;
  }
  function ligarComCodigo(t) {
    t = String(t || '').replace(/\s+/g, '');
    if (t.length < 20) { estado.fase = 'off'; $('sync-st').textContent = 'Esse código está curto demais: copie ele inteiro (começa com ghp_ ou github_pat_).'; return; }
    var antigo = ler(K_TOK);
    gravar(K_TOK, t); gravar(K_OFF, null);
    if (antigo !== t) { gravar(K_GIST, null); gravar(K_LOGIN, null); }
    estado.fase = 'conferindo'; estado.msg = ''; desenhado = ''; mostrar();
    pedir('GET', '/user').then(function (u) { if (u && u.login) gravar(K_LOGIN, String(u.login)); }).then(function () {
      desenhado = ''; return sincronizar('ligar');
    }).catch(function (e) {
      if (e.tipo === 'token') { gravar(K_TOK, antigo); estado.fase = antigo ? 'token' : 'off'; desenhado = ''; mostrar(); $('sync-st').textContent = 'O GitHub não aceitou esse código. Confira se copiou ele inteiro, ou crie outro pelo link.'; return; }
      if (e.tipo === 'rede') { estado.fase = 'offline'; agendar(30000); } else { estado.fase = 'erro'; estado.msg = e.message; }
      desenhado = ''; mostrar();
    });
  }
  document.addEventListener('submit', function (e) {
    if (!e.target || e.target.id !== 'sync-form') return;
    e.preventDefault();
    ligarComCodigo($('sync-tok').value);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-sync]');
    if (b) {
      var k = b.dataset.sync;
      if (k === 'agora') { estado.msg = ''; sincronizar('botão'); }
      else if (k === 'desligar') { gravar(K_OFF, '1'); clearTimeout(timer); estado.fase = 'off'; desenhado = ''; mostrar(); }
      else if (k === 'ligar') { gravar(K_OFF, null); desenhado = ''; estado.fase = 'conferindo'; mostrar(); sincronizar('ligar'); }
      return;
    }
    if (e.target.closest && e.target.closest('#sync-selo')) { var s = $('sync'); if (s) s.scrollIntoView({ block: 'center' }); }
  });

  // ---------- quando sincronizar ----------
  window.SYNC_PC = {
    // o app gravou as marcações (salvar()): anota o que mudou e envia daqui a 4 s
    mudou: function () {
      var m = lerMeta();
      if (!m.ini) { conferirTudo(); return conectado() && agendar(4000); }
      if (registrar(m, ler(CHAVE))) { gravarMeta(m); if (conectado()) { mostrar(); agendar(4000); } }
    },
    sincronizar: sincronizar,
    estado: function () { return { fase: estado.fase, msg: estado.msg, texto: textoEstado(), meta: lerMeta() }; }
  };
  document.addEventListener('visibilitychange', function () {
    if (!conectado()) return;
    if (document.visibilityState === 'visible') { if (Date.now() - ultTent > 5000) sincronizar('voltou'); }
    else if (lerMeta().pend) sincronizar('saiu', true);
  });
  window.addEventListener('pagehide', function () { if (conectado() && lerMeta().pend && !andando) sincronizar('saiu', true); });
  window.addEventListener('focus', function () { if (conectado() && Date.now() - ultTent > 20000) sincronizar('foco'); });
  window.addEventListener('online', function () { if (conectado()) sincronizar('voltou a internet'); });
  setInterval(function () {
    if (!conectado() || document.visibilityState !== 'visible') return;
    if (Date.now() - ultTent > 180000) sincronizar('de tempos em tempos'); else mostrar();
  }, 30000);
  // a Estante do Switch (outra aba) ligou ou trocou o código
  window.addEventListener('storage', function (e) { if (e.key === K_TOK || e.key === K_OFF) { desenhado = ''; estado.fase = conectado() ? 'ok' : 'off'; mostrar(); if (conectado()) sincronizar('outra aba'); } });

  // ---------- começa ----------
  conferirTudo();
  estado.fase = conectado() ? 'ok' : 'off';
  mostrar();
  if (conectado()) sincronizar('abriu');
})();
