/* app.js — Estante do PC (JavaScript puro, sem bibliotecas).
   Carrega dados/lista_NN.js um depois do outro (cada um chama LISTA_CHEGOU) e desenha a grade aos poucos,
   60 cards por vez. A ficha de cada jogo vem de dados/ficha_NN.js, só quando alguém abre um jogo daquele arquivo.
   Marcações (interesse, instalar, plano) ficam no localStorage, na chave "estante-pc-v1". */
(function () {
  'use strict';

  var CONF = window.CONF || {};
  var BASE = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/';
  var CHAVE = 'estante-pc-v1';
  var CHAVE_AJ = 'estante-pc-v1-ajustes';
  var POR_VEZ = 60;
  var TOTAL_STEAM = 110000; // total aproximado de jogos da Steam (meta "todos")
  var PCS = CONF.pcs || { pai: { nome: 'PC do pai' }, meu: { nome: 'Meu notebook' } };
  var CURTO = { pai: 'Pai', meu: 'Note' };
  var NIVEL = {
    4: { nome: 'Roda liso', sim: '✓' },
    3: { nome: 'Roda', sim: '✓' },
    2: { nome: 'No limite', sim: '~' },
    1: { nome: 'Não roda', sim: '✕' },
    0: { nome: 'Sem dados', sim: '?' }
  };
  var COR_GEN = {
    vn: '#a8406f', metroid: '#6a48b0', rogue: '#b05a28', luta: '#a83636', corrida: '#a78a1f', esporte: '#378a42',
    terror: '#6e1d27', sobrev: '#6e5230', tiro: '#475b6e', rpg: '#3852b0', estrategia: '#267a75', gestao: '#25719a',
    plataforma: '#5f8a1b', puzzle: '#9a6b1a', aventura: '#2a78b0', acao: '#a33a34', casual: '#904296', outro: '#46525f'
  };
  var ABAS = [
    ['todos', 'Todos'], ['para', '✨ Para você'], ['marc', 'Minhas marcações'], ['int', '☆ Interesse'],
    ['quero', '✓ Quero jogar'], ['joguei', 'Já joguei'], ['inst', 'Instalar'], ['nao', 'Dispensados']
  ];

  var fmtN = new Intl.NumberFormat('pt-BR');
  var fmtGB = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  var fmtPct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  var fmtPct2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  function pctMeta(t) { var p = 100 * t / TOTAL_STEAM; return p < 1 ? fmtPct2.format(p) : fmtPct.format(p); }
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
  function lerJSON(k, p) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? p : v; } catch (e) { return p; } }
  function noPC(k) { var n = (PCS[k] && PCS[k].nome) || k; return /^Meu /.test(n) ? 'no m' + n.slice(1) : 'no ' + n; }

  // ---------------- marcações e ajustes ----------------
  var M = lerJSON(CHAVE, {});
  function arrumarM() { M.int = M.int || {}; M.inst = M.inst || {}; M.plano = M.plano || {}; }
  arrumarM();
  var AJ = lerJSON(CHAVE_AJ, {});
  var podeSalvar = true;
  try { localStorage.setItem(CHAVE + '-teste', '1'); localStorage.removeItem(CHAVE + '-teste'); } catch (e) { podeSalvar = false; }
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify({ int: M.int, inst: M.inst, plano: M.plano })); }
    catch (e) { podeSalvar = false; $('aviso-salvar').hidden = false; }
  }
  function salvarAj() { try { localStorage.setItem(CHAVE_AJ, JSON.stringify(AJ)); } catch (e) {} }

  // ---------------- estado dos filtros ----------------
  function filtrosPadrao() {
    return { q: [], gen: '', idioma: '', ordem: 'pop', nivel: null, rom: false, esc18: true, escVet: true, escOn: false, naoRoda: false, ctrl: false };
  }
  var F = filtrosPadrao();
  F.pc = AJ.pc === 'pai' || AJ.pc === 'meu' ? AJ.pc : 'dois';
  F.aba = 'todos';

  // ---------------- dados ----------------
  var JOGOS = [];
  var POR_ID = Object.create(null);
  var FICHAS = Object.create(null);
  var ARQS = CONF.arqs || [];
  var ARQ_N = {};
  ARQS.forEach(function (a) { ARQ_N[a.n] = a; });
  var proxLista = 0, listasOk = 0, listasErro = [];
  var fichaEstado = {}, fichaEspera = {};
  var TAG_PT = {};
  (CONF.tags || []).forEach(function (t, i) { TAG_PT[t] = (CONF.tags_pt || [])[i] || t; });

  function tagPt(i) { return (CONF.tags_pt || [])[i] || (CONF.tags || [])[i] || ''; }

  function prep(g) {
    g._vet = g.x === 'ot' || g.x === 'ms';
    g._tp = (g.t || []).map(tagPt).filter(Boolean);
    g._b = norm(g.n + ' | ' + g._tp.join(' | '));
  }

  function injetar(src, erro) {
    var s = document.createElement('script');
    s.src = src; s.async = true;
    s.onerror = function () { s.remove(); erro(); };
    document.head.appendChild(s);
  }

  function pedirLista(tentativa) {
    var a = ARQS[proxLista];
    if (!a) { terminou(); return; }
    tentativa = tentativa || 0;
    // se falhar (rede ruim), tenta de novo até 2 vezes antes de desistir dessa parte
    injetar('dados/lista_' + dois(a.n) + '.js?v=' + a.v + (tentativa ? '&t=' + tentativa : ''), function () {
      if (tentativa < 2) { setTimeout(function () { pedirLista(tentativa + 1); }, 700 * (tentativa + 1)); return; }
      listasErro.push(a.n); proxLista++; agendar(); pedirLista();
    });
  }

  window.LISTA_CHEGOU = function (n, lista) {
    (lista || []).forEach(function (g) {
      if (POR_ID[g.i]) return;
      if (!g.f) g.f = n;
      prep(g); JOGOS.push(g); POR_ID[g.i] = g;
    });
    proxLista++; listasOk++;
    agendar();
    setTimeout(pedirLista, 0); // deixa a página desenhar antes do próximo arquivo
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
    injetar('dados/ficha_' + dois(n) + '.js?v=' + a.vf, function () {
      fichaEstado[n] = 'erro';
      var cbs = fichaEspera[n] || []; fichaEspera[n] = [];
      cbs.forEach(function (c) { c(); });
    });
  }

  var timerDesenho = 0;
  function agendar() {
    if (timerDesenho) return;
    timerDesenho = setTimeout(function () { timerDesenho = 0; desenhar(true); atualizarResumo(); montarGeneros(); atualizarDisco(); }, 120);
  }
  function terminou() { agendar(); }

  // ---------------- nível, filtros e ordem ----------------
  function nv(g) {
    var v = g.v || [0, 0];
    if (F.pc === 'pai') return v[0] || 0;
    if (F.pc === 'meu') return v[1] || 0;
    return Math.max(v[0] || 0, v[1] || 0);
  }

  function passaAba(g) {
    var id = g.i, pl = M.plano[id];
    switch (F.aba) {
      case 'todos': return pl !== 'nao';
      case 'para': return !pl && !g._vet && nv(g) >= 3 && g.pt >= 1 && (g.r || 0) >= 85;
      case 'marc': return !!(M.int[id] || M.inst[id] || pl === 'quero' || pl === 'joguei');
      case 'int': return !!M.int[id];
      case 'inst': return !!M.inst[id];
      default: return pl === F.aba; // quero, joguei, nao
    }
  }

  function passaBase(g, semEsconder) {
    for (var k = 0; k < F.q.length; k++) if (g._b.indexOf(F.q[k]) < 0) return false;
    if (F.gen && g.g !== F.gen) return false;
    if (F.idioma === 'com' && !(g.pt >= 1)) return false;
    if (F.idioma === 'dub' && g.pt !== 2) return false;
    if (F.idioma === 'sem' && g.pt) return false;
    if (F.rom && !g.rom) return false;
    if (F.ctrl && !g.ct) return false;
    if (!semEsconder) {
      if (F.esc18 && g.ad) return false;
      if (F.escVet && g._vet) return false;
      if (F.escOn && g.on) return false;
    }
    return true;
  }

  function notaP(g) { // nota com peso pelo número de avaliações
    if (g.r == null) return -1;
    var rv = g.rv || 0;
    return (g.r * rv + 70 * 200) / (rv + 200);
  }

  function ordenar(lista) {
    var o = F.ordem, cmp;
    if (F.aba === 'para') {
      cmp = function (a, b) {
        var pa = (a.rom ? 2 : 0) + (a.g === 'rpg' ? 1 : 0), pb = (b.rom ? 2 : 0) + (b.g === 'rpg' ? 1 : 0);
        return pb - pa || notaP(b) - notaP(a) || a.o - b.o;
      };
    } else if (o === 'nota') cmp = function (a, b) { return notaP(b) - notaP(a) || a.o - b.o; };
    else if (o === 'novos') cmp = function (a, b) { return (b.a || 0) - (a.a || 0) || a.o - b.o; };
    else if (o === 'nome') cmp = function (a, b) { return colar.compare(a.n, b.n); };
    else if (o === 'disco') cmp = function (a, b) { return (a.s == null ? 1e9 : a.s) - (b.s == null ? 1e9 : b.s) || a.o - b.o; };
    else cmp = function (a, b) { return a.o - b.o; };
    lista.sort(cmp);
  }

  function calcular() {
    var semEsconder = F.aba !== 'todos' && F.aba !== 'para';
    var cont = [0, 0, 0, 0, 0], lista = [];
    for (var i = 0; i < JOGOS.length; i++) {
      var g = JOGOS[i];
      if (!passaAba(g) || !passaBase(g, semEsconder)) continue;
      var n = nv(g);
      cont[n]++;
      if (F.nivel != null) { if (n !== F.nivel) continue; }
      else if (n === 1 && !F.naoRoda && !semEsconder) continue;
      lista.push(g);
    }
    ordenar(lista);
    return { lista: lista, cont: cont, escondidos: (F.nivel == null && !F.naoRoda && !semEsconder) ? cont[1] : 0 };
  }

  // ---------------- cards ----------------
  var grid = $('grid');
  var ATUAL = [], MOSTRADOS = 0;
  var CARDS = new Map();

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
  function selosTodos(g) {
    return selosNivel(g) + seloPT(g) + seloNota(g) + seloDeck(g) +
      (g.rom ? '<span class="selo rom">Romance</span>' : '') +
      (g._vet ? '<span class="selo veto" title="' + (g.x === 'ot' ? 'Otome' : 'Romance só do mesmo sexo') + '">Vetado</span>' : '') +
      (g.ad ? '<span class="selo ad">+18</span>' : '') +
      (g.on ? '<span class="selo">Só on-line</span>' : '') +
      (g.nw ? '<span class="selo">Sem Windows</span>' : '') + seloPlano(g);
  }
  function metaTxt(g) {
    var p = [];
    if (g.s != null) p.push('<span title="Espaço em disco">' + gb(g.s) + '</span>');
    if (g.a) p.push('<span>' + g.a + '</span>');
    if (g.em_breve) p.push('<span>Ainda não lançado</span>');
    return p.join('');
  }
  function capaHTML(g, classe) {
    return g.c ? '<img class="' + classe + '" loading="lazy" decoding="async" width="460" height="215" alt="Capa de ' + esc(g.n) + '" src="' + BASE + esc(g.c) + '">' : '';
  }

  function criarCard(g) {
    var el = document.createElement('article');
    var id = g.i, nome = esc(g.n);
    el.className = 'card' + (M.inst[id] ? ' sel' : '') + (M.plano[id] === 'nao' ? ' dispensado' : '');
    el.dataset.id = id;
    el.innerHTML =
      '<div class="capa-box" style="--gc:' + (COR_GEN[g.g] || COR_GEN.outro) + '">' +
        '<button type="button" class="capa-hit" data-acao="inst" aria-pressed="' + !!M.inst[id] + '" aria-label="Quero instalar: ' + nome + '">' +
          '<span class="capa-sem" aria-hidden="true">' + nome + '</span>' + capaHTML(g, 'capa') +
          '<span class="capa-check" aria-hidden="true">✓</span>' +
        '</button>' +
        '<button type="button" class="fav" data-acao="int" aria-pressed="' + !!M.int[id] + '" aria-label="Tenho interesse: ' + nome + '" title="Tenho interesse"><span aria-hidden="true">' + (M.int[id] ? '★' : '☆') + '</span></button>' +
        (g.em_breve ? '<span class="capa-flag">Em breve</span>' : '') +
      '</div>' +
      '<div class="card-corpo">' +
        '<h3 class="nome">' + nome + '</h3>' +
        '<div class="selos">' + selosTodos(g) + '</div>' +
        '<div class="meta">' + metaTxt(g) + '</div>' +
        '<button type="button" class="ver" data-acao="ver">Ver o jogo</button>' +
      '</div>';
    return el;
  }
  function card(g) {
    var el = CARDS.get(g.i);
    if (!el) { el = criarCard(g); CARDS.set(g.i, el); }
    return el;
  }
  function refazerCard(id) {
    var velho = CARDS.get(+id) || CARDS.get(id);
    CARDS.delete(+id);
    var g = POR_ID[id];
    if (velho && g && velho.parentNode) { var novo = card(g); velho.parentNode.replaceChild(novo, velho); }
  }

  function desenhar(manter) {
    var r = calcular();
    ATUAL = r.lista;
    atualizarTiles(r.cont);
    var qtd = Math.min(ATUAL.length, manter ? Math.max(MOSTRADOS, POR_VEZ) : POR_VEZ);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < qtd; i++) frag.appendChild(card(ATUAL[i]));
    grid.textContent = '';
    grid.appendChild(frag);
    MOSTRADOS = qtd;
    atualizarMais();
    $('vazio').hidden = ATUAL.length > 0 || !JOGOS.length;
    var t = 'Mostrando <strong>' + fmtN.format(ATUAL.length) + '</strong> de ' + fmtN.format(JOGOS.length) + ' jogos';
    if (r.escondidos) t += ' <span>· ' + fmtN.format(r.escondidos) + ' que não rodam estão escondidos</span>';
    if (F.aba === 'para') t += ' <span>· rodam, têm PT-BR e nota 85+; romance e RPG primeiro</span>';
    if (proxLista < ARQS.length) t += ' <span>· carregando a lista (' + (proxLista + 1) + ' de ' + ARQS.length + ')…</span>';
    if (listasErro.length) t += ' <span class="falta">· ' + (listasErro.length === 1 ? 'a parte ' : 'as partes ') + listasErro.join(', ') + ' da lista não carregaram; recarregue a página</span>';
    if (F.aba !== 'todos' || F.nivel != null || F.q.length) t += ' <button type="button" class="limpar" data-limpar="1">Limpar filtros</button>';
    $('mostrando').innerHTML = t;
    $('filtros-n').textContent = contarFiltros() || '';
    atualizarAbas();
  }
  function atualizarMais() {
    var falta = ATUAL.length - MOSTRADOS, b = $('mais');
    b.hidden = falta <= 0;
    b.textContent = 'Mostrar mais ' + Math.min(falta, POR_VEZ) + ' (faltam ' + fmtN.format(falta) + ')';
  }
  function mostrarMais() {
    var fim = Math.min(ATUAL.length, MOSTRADOS + POR_VEZ);
    var frag = document.createDocumentFragment();
    for (var i = MOSTRADOS; i < fim; i++) frag.appendChild(card(ATUAL[i]));
    grid.appendChild(frag);
    MOSTRADOS = fim;
    atualizarMais();
  }
  function contarFiltros() {
    var n = 0;
    if (F.gen) n++; if (F.idioma) n++; if (F.ordem !== 'pop') n++;
    if (F.rom) n++; if (!F.esc18) n++; if (!F.escVet) n++; if (F.escOn) n++; if (F.naoRoda) n++; if (F.ctrl) n++;
    return n;
  }

  // ---------------- tiles, abas, gêneros ----------------
  function atualizarTiles(cont) {
    Array.prototype.forEach.call(document.querySelectorAll('.tile'), function (b) {
      var n = +b.dataset.nv;
      b.querySelector('.num').textContent = fmtN.format(cont[n]);
      b.setAttribute('aria-pressed', String(F.nivel === n));
      if (n === 1) {
        var esc1 = F.nivel !== 1 && !F.naoRoda;
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
      var tem = ['marc', 'int', 'quero', 'joguei', 'inst', 'nao'].indexOf(a[0]) >= 0;
      return '<button type="button" class="chip" data-aba="' + a[0] + '" aria-pressed="false">' + esc(a[1]) + (tem ? ' <span class="n"></span>' : '') + '</button>';
    }).join('');
  }
  function atualizarAbas() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-aba]'), function (b) {
      b.setAttribute('aria-pressed', String(F.aba === b.dataset.aba));
      var n = b.querySelector('.n');
      if (n) n.textContent = fmtN.format(contaAba(b.dataset.aba));
    });
    var r = 'Interesse <b>' + contaAba('int') + '</b> · Instalar <b>' + contaAba('inst') + '</b> · Quero jogar <b>' + contaAba('quero') +
      '</b> · Já joguei <b>' + contaAba('joguei') + '</b> · Dispensados <b>' + contaAba('nao') + '</b>';
    $('marc-resumo').innerHTML = r;
  }
  var gensMontados = -1;
  function montarGeneros() {
    if (gensMontados === JOGOS.length) return;
    gensMontados = JOGOS.length;
    var cont = {};
    JOGOS.forEach(function (g) { cont[g.g] = (cont[g.g] || 0) + 1; });
    var gen = CONF.gen || {};
    var chaves = Object.keys(gen).sort(function (a, b) { return colar.compare(gen[a], gen[b]); });
    var sel = $('f-gen');
    sel.innerHTML = '<option value="">Todos os gêneros (' + fmtN.format(JOGOS.length) + ')</option>' + chaves.filter(function (k) { return cont[k] || k === F.gen; }).map(function (k) {
      return '<option value="' + esc(k) + '">' + esc(gen[k]) + ' (' + fmtN.format(cont[k] || 0) + ')</option>';
    }).join('');
    sel.value = F.gen;
  }

  // ---------------- cabeçalho, PCs e disco ----------------
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
      var ativo = F.pc === k || (F.pc === 'dois');
      return '<div class="pc' + (ativo ? ' ativo' : '') + '"><b>' + esc(p.nome) + '</b>' +
        '<span>' + esc(p.cpu_n || '') + '</span><span>' + esc(p.gpu_n || '') + '</span>' +
        '<span>' + (p.ram ? p.ram + ' GB de RAM' : '') + (p.livre ? ' · ' + p.livre + ' GB livres' : '') + '</span></div>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('#seg-pc button'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.pc === F.pc));
    });
    $('pc-expl').textContent = F.pc === 'dois'
      ? '"Nos dois" vale o melhor dos dois PCs: o jogo conta se roda em pelo menos um. Os cards mostram os dois selos.'
      : 'Os filtros, os tiles e os selos usam só o ' + PCS[F.pc].nome + '.';
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

  // ---------------- camadas (ficha e Tinder) e o botão voltar ----------------
  var pilha = [];
  function empurrar(nome) { pilha.push(nome); try { history.pushState({ camada: nome }, ''); } catch (e) {} }
  function fecharCamada(nome) {
    if (pilha[pilha.length - 1] === nome) { history.back(); return; }
    fecharDom(nome);
  }
  function fecharDom(nome) { if (nome === 'ficha') fecharFichaDom(); else if (nome === 'tinder') fecharTinderDom(); }
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
    h += '<div class="f-heroi" style="--gc:' + cor + '">' + (g.c ? '<img class="f-fundo" alt="" aria-hidden="true" src="' + BASE + esc(g.c) + '">' : '') +
      '<div class="f-capa-box"><span class="capa-sem" aria-hidden="true">' + esc(g.n) + '</span>' + capaHTML(g, 'f-capa') + '</div></div>';
    h += '<div class="f-tit"><h2 id="f-nome">' + esc(g.n) + '</h2><p class="f-gen">' + esc([gen, g.a, g.em_breve ? 'ainda não lançado' : ''].filter(Boolean).join(' · ')) + '</p>' +
      '<div class="selos">' + selosTodos(g) + '</div></div>';
    h += planosHTML(g);
    h += '<div class="links"><a class="btn btn-forte" href="https://store.steampowered.com/app/' + g.i + '/" target="_blank" rel="noopener">Abrir na Steam</a>' +
      '<a class="btn" href="steam://store/' + g.i + '">Abrir no app da Steam</a></div>';
    if (estado === 'carregando') h += '<p class="f-carregando">Carregando os detalhes…</p>';
    else if (estado === 'erro') h += '<p class="aviso">Não deu para carregar os detalhes deste jogo. Confira a internet e abra de novo.</p>';
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
    var k = b.dataset.f;
    if (k === 'fechar') { fecharCamada('ficha'); return; }
    marcar(fichaId, k);
    var g = POR_ID[fichaId];
    var velho = dlg.querySelector('.planos');
    if (velho) velho.outerHTML = planosHTML(g);
    var sel = dlg.querySelector('.f-tit .selos');
    if (sel) sel.innerHTML = selosTodos(g);
  });

  // ---------------- marcar ----------------
  function marcar(id, k) {
    if (id == null) return;
    if (k === 'int') { if (M.int[id]) delete M.int[id]; else M.int[id] = 1; }
    else if (k === 'inst') { if (M.inst[id]) delete M.inst[id]; else M.inst[id] = 1; }
    else { if (M.plano[id] === k) delete M.plano[id]; else M.plano[id] = k; }
    salvar();
    refazerCard(id);
    atualizarDisco();
    if (k === 'quero' || k === 'joguei' || k === 'nao' || F.aba !== 'todos') desenhar(true); else atualizarAbas();
  }

  // ---------------- modo Tinder ----------------
  var TT = $('tinder');
  var T = { fila: [], pos: 0, hist: [], cont: { quero: 0, int: 0, nao: 0 } };

  function abrirTinder() {
    T.fila = ATUAL.filter(function (g) { return !M.plano[g.i] && !M.int[g.i]; });
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
        '<p class="t-dica">Arraste para a direita (quero jogar), esquerda (não quero) ou para cima (interesse). Usa os filtros atuais.</p>' +
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
    desenhar(true);
  }
  function cartaT(g, classe) {
    var f = FICHAS[g.i], v = g.v || [0, 0];
    function pc(k, i) {
      var mo = f && f.mo ? (f.mo[i] || [])[0] : '';
      return '<div class="t-pc nv' + (v[i] || 0) + '"><b>' + esc(PCS[k].nome) + ': ' + NIVEL[v[i] || 0].nome + '</b>' + (mo ? '<span>' + esc(mo) + '</span>' : '') + '</div>';
    }
    return '<div class="t-card ' + classe + '" data-id="' + g.i + '" style="--gc:' + (COR_GEN[g.g] || COR_GEN.outro) + '">' +
      '<div class="t-capa">' + (g.c ? '<img class="t-fundo" alt="" aria-hidden="true" src="' + BASE + esc(g.c) + '">' : '') +
        '<div class="t-capa-box"><span class="capa-sem" aria-hidden="true">' + esc(g.n) + '</span>' + capaHTML(g, 't-img') + '</div>' +
        '<span class="t-carimbo t-c-sim">QUERO</span><span class="t-carimbo t-c-nao">NÃO</span><span class="t-carimbo t-c-int">☆ INTERESSE</span>' +
      '</div>' +
      '<div class="t-corpo"><h3 class="t-tit">' + esc(g.n) + '</h3><div class="selos">' + selosTodos(g) + '</div>' +
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
        '</p><p>Mude os filtros ou veja suas marcações.</p><button type="button" class="btn" data-t="fechar">Voltar para a lista</button></div>';
      return;
    }
    palco.innerHTML = (prox ? cartaT(prox, 't-baixo') : '') + cartaT(g, 't-cima');
    var el = palco.querySelector('.t-cima');
    arrastar(el);
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
    salvar(); refazerCard(g.i);
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
    salvar(); refazerCard(h.id);
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
        salvar(); CARDS.clear(); desenhar(true); atualizarDisco();
        $('marc-msg').textContent = 'Cópia carregada: ' + n + ' marcações juntadas às que já estavam aqui.';
      } catch (e) { $('marc-msg').textContent = 'Esse arquivo não é uma cópia da Estante do PC.'; }
    };
    r.readAsText(arq);
  }

  // ---------------- eventos ----------------
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('[data-acao]');
    if (!b) return;
    var c = b.closest('.card'), id = c && c.dataset.id;
    if (!id) return;
    var k = b.dataset.acao;
    if (k === 'ver') abrirFicha(id); else marcar(id, k);
  });
  // capa que não carregou: some a imagem e fica o bloco com a cor do gênero e o nome
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG') {
      if (t.classList.contains('f-fundo') || t.classList.contains('t-fundo')) t.remove();
      else if (t.classList.contains('capa') || t.classList.contains('f-capa') || t.classList.contains('t-img')) t.remove();
    }
  }, true);

  var timerBusca = 0;
  $('q').addEventListener('input', function () {
    clearTimeout(timerBusca);
    var v = this.value;
    timerBusca = setTimeout(function () { F.q = norm(v).split(/\s+/).filter(Boolean); desenhar(false); }, 160);
  });
  $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { this.blur(); irPara('filtros'); } });

  function irPara(k) {
    var alvo = k === 'topo' ? $('topo') : $(k);
    if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function mudarAba(a, rolar) {
    F.aba = F.aba === a && a !== 'todos' ? 'todos' : a;
    desenhar(false);
    if (rolar) irPara('filtros');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-aba],[data-ir],[data-limpar]');
    if (!b || TT.contains(b) || dlg.contains(b)) return;
    if (b.dataset.aba) mudarAba(b.dataset.aba, !!b.closest('#barra-topo'));
    else if (b.dataset.limpar) limpar();
    else if (b.dataset.ir === 'tinder') abrirTinder();
    else irPara(b.dataset.ir);
  });

  $('seg-pc').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pc]');
    if (!b || b.dataset.pc === F.pc) return;
    F.pc = b.dataset.pc; AJ.pc = F.pc; salvarAj();
    CARDS.clear();
    montarPCs(); desenhar(true); atualizarDisco();
  });
  $('tiles').addEventListener('click', function (e) {
    var b = e.target.closest('.tile');
    if (!b) return;
    var n = +b.dataset.nv;
    F.nivel = F.nivel === n ? null : n;
    desenhar(false);
  });
  function ligarSelect(id, campo) {
    $(id).addEventListener('change', function () { F[campo] = this.value; this.classList.toggle('ativo', !!this.value && this.value !== 'pop'); desenhar(false); });
  }
  ligarSelect('f-gen', 'gen'); ligarSelect('f-idioma', 'idioma'); ligarSelect('f-ordem', 'ordem');
  [['c-rom', 'rom'], ['c-18', 'esc18'], ['c-vet', 'escVet'], ['c-on', 'escOn'], ['c-nao', 'naoRoda'], ['c-ctrl', 'ctrl']].forEach(function (p) {
    $(p[0]).addEventListener('change', function () { F[p[1]] = this.checked; desenhar(false); });
  });
  function limpar() {
    var pc = F.pc;
    F = filtrosPadrao(); F.pc = pc; F.aba = 'todos';
    $('q').value = '';
    ['f-gen', 'f-idioma'].forEach(function (id) { $(id).value = ''; $(id).classList.remove('ativo'); });
    $('f-ordem').value = 'pop'; $('f-ordem').classList.remove('ativo');
    $('c-rom').checked = false; $('c-18').checked = true; $('c-vet').checked = true;
    $('c-on').checked = false; $('c-nao').checked = false; $('c-ctrl').checked = false;
    desenhar(false);
  }
  $('b-limpar').addEventListener('click', limpar);
  $('mais').addEventListener('click', mostrarMais);
  $('b-filtros').addEventListener('click', function () {
    var f = $('filtros'), ab = !f.classList.contains('aberto');
    f.classList.toggle('aberto', ab);
    this.setAttribute('aria-expanded', String(ab));
  });
  $('b-tinder').addEventListener('click', abrirTinder);
  $('b-desmarcar').addEventListener('click', function () {
    var ids = Object.keys(M.inst);
    if (!ids.length) return;
    M.inst = {}; salvar();
    ids.forEach(refazerCard);
    atualizarDisco(); desenhar(true);
  });
  $('barra-disco').addEventListener('click', function () { irPara('painel-pc'); });
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
    if (e.key === '/' && !dlg.open && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) {
      e.preventDefault(); $('q').focus();
    }
  });

  // ---------------- início ----------------
  if (!podeSalvar) $('aviso-salvar').hidden = false;
  aplicarTema();
  montarMeta();
  montarPCs();
  montarAbas();
  atualizarDisco();
  desenhar(false);
  if (!ARQS.length) $('mostrando').textContent = 'Nenhum arquivo de dados encontrado.';
  pedirLista();
})();
