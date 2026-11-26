/* app.js — Estante do PC (JavaScript puro, sem bibliotecas).
   1.9 (26/11): layout e funções copiados da Estante do Switch (mod_L_navegar, mod_W_porque, mod_Q_etiquetas):
   - tela inicial que só rola para baixo: seções em grade de capas (2 linhas) com "Ver tudo ›" — Seus interesses,
     Quero jogar, 🟢 Mais a sua cara, RPG nichado, 💗 Dá pra namorar, 👾 RPG retrô, 💎 Joias, Gêneros (quadradinhos),
     Desempenho nos seus PCs (quadradinhos), Roda liso, Dublados, Steam Deck;
   - card de capa grande: ☆ interesse no canto esquerdo, 💾 instalar no direito, tocar abre a ficha; embaixo os selos
     com a BOLINHA 🟢🟡🔴 primeiro (o mesmo "Pra você" do Switch: 🟢 vai gostar, 🟡 talvez, 🔴 acho que não), e o nome;
   - "Ver tudo" abre a grade completa com título, contagem, ordem em pílulas e "Mostrar mais" (sozinho ao rolar);
   - filtros numa folha (de baixo no celular, do lado no PC): Pra você (as bolinhas, dá pra escolher mais de uma),
     português, romance, gênero, etiquetas, roda no PC, nota, tamanho, só os meus — com a contagem em cada opção;
   - ficha do jeito do Switch: capa grande com setas de anterior/próximo, gênero clicável, bloco "Pra você" com os
     motivos, chips, etiquetas que filtram, fotos, planos, requisitos, dados e "Parecidos com este".
   Os dados vêm de dados/lista_NN.js (LISTA_CHEGOU); a ficha de cada jogo vem de dados/ficha_NN.js quando alguém abre.
   Marcações no localStorage ("estante-pc-v1"); entre visitas só ficam guardados o PC escolhido e o tema.
   Nada acompanha a rolagem no topo; só os botões flutuantes de baixo (↑ e a barra do disco). */
(function () {
  'use strict';

  var CONF = window.CONF || {};
  var BASE = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/';
  var CHAVE = 'estante-pc-v1';
  var CHAVE_AJ = 'estante-pc-v1-ajustes';
  var CACHE_IMG = 'epc-img-v1'; // o mesmo nome do sw.js
  var POR_VEZ = 48;
  var POR_SECAO = 12; // 2 linhas de 5 no PC; o CSS mostra 2 linhas de 2 no celular e de 3 no tablet
  var TOTAL_STEAM = 110000;
  var PCS = CONF.pcs || { pai: { nome: 'PC do pai' }, meu: { nome: 'Meu notebook' } };
  var CURTO = { pai: 'Pai', meu: 'Note' };
  var NIVEL = {
    4: { nome: 'Roda liso', sim: '✓', dsc: 'Passa dos recomendados' }, 3: { nome: 'Roda', sim: '✓', dsc: 'Atende o mínimo' },
    2: { nome: 'No limite', sim: '~', dsc: 'Pode engasgar' }, 1: { nome: 'Não roda', sim: '✕', dsc: 'Escondidos: toque para ver' },
    0: { nome: 'Sem dados', sim: '?', dsc: 'A loja não informa' }
  };
  // ---- gêneros: os MESMOS da Estante do Switch (chaves, nomes, ícones e ordem); "rpgnicho" aqui é "RPG nichado" ----
  var SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var GENRES = {
    rpg: { label: 'RPG', svg: SVG + '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>' },
    rpgnicho: { label: 'RPG nichado', svg: SVG + '<polygon points="12 2 21 7 21 17 12 22 3 17 3 7"/><polygon points="12 7 17 15 7 15"/><path d="M3 7l4 8M21 7l-4 8M12 22v-7"/></svg>' },
    roguelike: { label: 'Roguelike', svg: SVG + '<path d="M12 3a8 8 0 0 0-8 8c0 3 1.6 5.2 4 6.3V21h8v-3.7c2.4-1.1 4-3.3 4-6.3a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.6"/><circle cx="15" cy="11" r="1.6"/><path d="M11 21v-2M13 21v-2"/></svg>' },
    tatica: { label: 'Tática', svg: SVG + '<path d="M7 20h10M8 20v-2h8v2M9 18l1-7h4l1 7M8 11h8M8 11V7h2v2h1V7h2v2h1V7h2v4"/></svg>' },
    vn: { label: 'Novela visual', svg: SVG + '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>' },
    investigacao: { label: 'Investigação', svg: SVG + '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' },
    historia: { label: 'Aventura e história', svg: SVG + '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
    souls: { label: 'Estilo Souls', svg: SVG + '<path d="M12 3c1 3-1.5 4.5-2.5 6.5S8 13 8 14.5a4 4 0 0 0 8 0c0-2-1-3.5-2-5 0 1.5-.7 2.3-1.5 2.6.4-2.6-.3-5.7-.5-9.1z"/><path d="M5 21h14M7 21l2-3M17 21l-2-3"/></svg>' },
    metroidvania: { label: 'Metroidvania', svg: SVG + '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h6v6h6v6M15 3v6h6"/><circle cx="18" cy="15" r="1"/></svg>' },
    acao: { label: 'Ação', svg: SVG + '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
    luta: { label: 'Luta', svg: SVG + '<path d="M7 12V8a3 3 0 0 1 3-3h4a4 4 0 0 1 4 4v3a5 5 0 0 1-5 5h-2l-4-3z"/><path d="M8 17v4h7v-4"/><path d="M11 9h4"/></svg>' },
    tiro: { label: 'Tiro', svg: SVG + '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>' },
    plataforma: { label: 'Plataforma', svg: SVG + '<path d="M3 20h5v-5h5v-5h5V5h3"/></svg>' },
    terror: { label: 'Terror', svg: SVG + '<path d="M5 21V10a7 7 0 0 1 14 0v11l-2.3-1.8-2.4 1.8-2.3-1.8-2.3 1.8-2.4-1.8z"/><circle cx="9.5" cy="10" r="1"/><circle cx="14.5" cy="10" r="1"/></svg>' },
    sobrevivencia: { label: 'Sobrevivência e construção', svg: SVG + '<path d="M3 20L12 4l9 16z"/><path d="M9.5 20l2.5-5 2.5 5"/></svg>' },
    vida: { label: 'Fazenda e vida tranquila', svg: SVG + '<path d="M12 21v-9"/><path d="M12 12C12 7.5 8.5 4 3 4c0 5 3.5 8 9 8z"/><path d="M12 15c0-4.5 3-8 9-8 0 4.5-3 8-9 8z"/><path d="M7 21h10"/></svg>' },
    gestao: { label: 'Gestão e simulação', svg: SVG + '<path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>' },
    estrategia: { label: 'Estratégia', svg: SVG + '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/></svg>' },
    puzzle: { label: 'Puzzle e raciocínio', svg: SVG + '<path d="M4 7h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H4z"/></svg>' },
    casual: { label: 'Casual e passatempo', svg: SVG + '<path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h2a2 2 0 0 1 0 4h-2"/><path d="M8 3v3M12 3v3"/></svg>' },
    corrida: { label: 'Corrida', svg: SVG + '<path d="M3 18a9 9 0 1 1 18 0"/><path d="M12 18l4.5-6"/><circle cx="12" cy="18" r="1.2"/><path d="M6 14l1 .6M18 14l-1 .6M12 9v1.2"/></svg>' },
    esporte: { label: 'Esporte', svg: SVG + '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>' },
    festa: { label: 'Festa', svg: SVG + '<rect x="2" y="6" width="20" height="12" rx="6"/><path d="M6 12h4M8 10v4"/><circle cx="15.5" cy="11" r="1"/><circle cx="18" cy="13" r="1"/></svg>' },
    musica: { label: 'Música e ritmo', svg: SVG + '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>' }
  };
  var GEN_ORDER = ['rpg', 'rpgnicho', 'roguelike', 'tatica', 'vn', 'investigacao', 'historia', 'souls', 'metroidvania', 'acao', 'luta', 'tiro', 'plataforma', 'terror', 'sobrevivencia', 'vida', 'gestao', 'estrategia', 'puzzle', 'casual', 'corrida', 'esporte', 'festa', 'musica'];
  var GEN_DESC = {
    rpg: 'Os RPGs grandes e conhecidos: histórias longas, com personagem que evolui.',
    rpgnicho: 'RPGs pequenos e pouco conhecidos: retrô, masmorras, por turnos, de estúdio pequeno. Como Dragon Ruins e DecaDungeons.',
    roguelike: 'Cada partida é diferente: morreu, recomeça mais forte. Inclui deckbuilders de corrida.',
    tatica: 'Batalhas em grade ou por turnos, pensando cada movimento.',
    vn: 'Muita leitura, escolhas e rotas diferentes.',
    investigacao: 'Pistas, deduções, interrogatórios e tribunais.',
    historia: 'Aventuras guiadas pela história.',
    souls: 'Ação difícil, de aprender com cada morte.',
    metroidvania: 'Mapa grande e interligado que se abre conforme você ganha poderes.',
    acao: 'Ação em tempo real.',
    luta: 'Jogos de luta e beat \'em up.',
    tiro: 'Tiroteio em primeira pessoa, navinhas e bullet hell.',
    plataforma: 'Pulo, precisão e fases em 2D ou 3D.',
    terror: 'Sustos, sobrevivência e clima pesado.',
    sobrevivencia: 'Sobreviver, juntar recursos, criar ferramentas e construir a base.',
    vida: 'Fazenda, amizades e vida tranquila no campo.',
    gestao: 'Administrar, construir e simular.',
    estrategia: 'Cartas, guerra, defesa de torres e decisões de longo prazo.',
    puzzle: 'Quebra-cabeças de lógica e raciocínio.',
    casual: 'Passatempos: clicar, esperar, achar objetos, combinar peças.',
    corrida: 'Corrida de carro, moto e kart.',
    esporte: 'Futebol, basquete, golfe, pesca e outros esportes.',
    festa: 'Minigames e partidas rápidas pra jogar junto.',
    musica: 'Ritmo, dança e música.'
  };
  // cor de fundo da capa enquanto a imagem não chega (por gênero)
  var COR_GEN = {
    rpg: '#3852b0', rpgnicho: '#5a3fb0', roguelike: '#b05a28', tatica: '#2f6f8f', vn: '#a8406f', investigacao: '#4a5a7a', historia: '#2a78b0',
    souls: '#5a4a3a', metroidvania: '#6a48b0', acao: '#a33a34', luta: '#a83636', tiro: '#475b6e', plataforma: '#5f8a1b', terror: '#6e1d27',
    sobrevivencia: '#6e5230', vida: '#4f8a3a', gestao: '#25719a', estrategia: '#267a75', puzzle: '#9a6b1a', casual: '#904296',
    corrida: '#a78a1f', esporte: '#378a42', festa: '#a0458a', musica: '#7a3fa0'
  };
  function genNome(k) { return (CONF.gen && CONF.gen[k]) || (GENRES[k] && GENRES[k].label) || k || ''; }
  function genSvg(k) { return (GENRES[k] && GENRES[k].svg) || ''; }
  // ---- etiquetas no jeito da estante (g.et = "px tb jr"), as do etiquetas_def.js do Switch + "cr" (CRPG), só do PC ----
  var ETIQ_GRUPOS = { jeito: 'Jeito de jogar', combate: 'Combate', historia: 'História', estilo: 'Estilo', duracao: 'Duração', jogar: 'Com quem' };
  var ETIQ = {
    jr: ['JRPG', 'jeito'], cr: ['CRPG', 'jeito'], mz: ['Masmorra', 'jeito'], lj: ['Livro-jogo', 'jeito'], mo: ['Pega monstros', 'jeito'], ow: ['Mundo aberto', 'jeito'],
    pc: ['Point-and-click', 'jeito'], tb: ['Por turnos', 'combate'], tr: ['Tempo real', 'combate'], cb: ['Cartas', 'combate'], sh: ['Navinha (shmup)', 'combate'],
    be: ['Beat \'em up', 'combate'], rm: ['Com romance', 'historia'], hi: ['História forte', 'historia'], pp: ['Crie seu herói', 'historia'],
    px: ['Pixel art', 'estilo'], an: ['Anime', 'estilo'], cz: ['Tranquilo', 'estilo'], tl: ['Clima de terror', 'estilo'], cu: ['Curto', 'duracao'],
    lg: ['Longo', 'duracao'], co: ['Cooperativo', 'jogar'], on: ['Só online', 'jogar'], f2: ['Grátis (F2P)', 'jogar']
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
  function jogosTxt(n) { return fmtN.format(n) + (n === 1 ? ' jogo' : ' jogos'); }
  function lerJSON(k, p) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? p : v; } catch (e) { return p; } }
  function noPC(k) { var n = (PCS[k] && PCS[k].nome) || k; return /^Meu /.test(n) ? 'no m' + n.slice(1) : 'no ' + n; }
  function pctMeta(t) { var p = 100 * t / TOTAL_STEAM; return p < 1 ? fmtPct2.format(p) : fmtPct.format(p); }
  function cada(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  // a capa original da Steam: é também a chave da WebP guardada pelos pacotes de capas (o sw.js entrega a guardada)
  function urlCapa(c) { return /^https?:/.test(c || '') ? c : BASE + c; }

  // ---------------- marcações e ajustes ----------------
  var M = lerJSON(CHAVE, {});
  M.int = M.int || {}; M.inst = M.inst || {}; M.plano = M.plano || {}; M.voto = M.voto || {}; M.gosto = M.gosto || {};
  var AJ = lerJSON(CHAVE_AJ, {}); // só o PC escolhido e o tema
  var podeSalvar = true;
  try { localStorage.setItem(CHAVE + '-teste', '1'); localStorage.removeItem(CHAVE + '-teste'); } catch (e) { podeSalvar = false; }
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify({ int: M.int, inst: M.inst, plano: M.plano, voto: M.voto, gosto: M.gosto })); }
    catch (e) { podeSalvar = false; $('aviso-salvar').hidden = false; }
    // avisa a sincronização (bloco 1.8) que as marcações mudaram
    try { if (window.SYNC_PC) window.SYNC_PC.mudou(); } catch (e) {}
  }
  function salvarAj() { try { localStorage.setItem(CHAVE_AJ, JSON.stringify({ pc: AJ.pc, tema: AJ.tema, mao: !!AJ.mao, capas: AJ.capas || 'm' })); } catch (e) {} }

  // ---------------- filtros (não ficam guardados entre visitas) ----------------
  var ORDEM_PADRAO = 'pop'; // vira "pv" (Mais a sua cara) quando a lista traz o pv
  function filtrosPadrao() {
    return { q: [], qTxt: '', idioma: '', ordem: ORDEM_PADRAO, rom: '', esc18: false, escVet: true, roda: '', ctrl: false,
      cor: [], gen: '', et: [], nota: 0, tam: '', meus: '', facil: false };
  }
  var F = filtrosPadrao();
  F.pc = AJ.pc === 'pai' || AJ.pc === 'meu' ? AJ.pc : 'dois';
  // V: o que está na tela. modo "catalogo" ou "grade"; fonte da grade: {t:'sec'|'gen'|'nivel'|'aba'|'busca'|'todos', k}
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
    g._et = g.et ? g.et.split(' ') : [];
    g._px = g.px ? g.px.split(' ').map(function (t) { var m = /^([a-zA-Z_]+)(-?[\d.]+)$/.exec(t); return m ? [m[1], +m[2]] : null; }).filter(Boolean) : null;
    if (g.o == null) g.o = 999999;
    g._ext = /^https?:/.test(g.c || '');
    if (g.loja && !FICHAS[g.i]) FICHAS[g.i] = g.fi || g.ficha || { ds: g.ds || '' };
    if (g.ef != null) TEM_EF = true;
    calcGosto(g);
    g._b = norm(g.n + ' | ' + g._tp.join(' | ') + ' | ' + genNome(g.g) + (g._et.length ? ' | ' + g._et.map(function (c) { return ETIQ[c] ? ETIQ[c][0] : ''; }).join(' ') : ''));
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
    if (M.voto && Object.keys(M.voto).length) recalcGosto();
    // com o perfil de gostos na lista, a ordem padrão passa a ser "Mais a sua cara" (se ninguém mudou a ordem)
    if (TEM_PV && ORDEM_PADRAO !== 'pv') {
      if (F.ordem === ORDEM_PADRAO) F.ordem = 'pv';
      ORDEM_PADRAO = 'pv';
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
      if (folha.open) pintarFolha();
    }, primeiro ? 60 : 600);
    primeiro = false;
  }

  // ---------------- nível, gosto, filtros e ordem ----------------
  function nv(g) {
    var v = g.v || [0, 0];
    if (F.pc === 'pai') return v[0] || 0;
    if (F.pc === 'meu') return v[1] || 0;
    return Math.max(v[0] || 0, v[1] || 0);
  }
  function notaP(g) { if (g.r == null) return -1; var rv = g.rv || 0; return (g.r * rv + 70 * 200) / (rv + 200); }
  function pvDe(g) { var v = g._pv !== undefined ? g._pv : g.pv; return v != null ? v : -1; }
  // a bolinha (cor) do "Pra você": o nv do perfil_pc.py; sem nv, a faixa do pv (74-100 verde, 51-73 amarelo, 0-50 vermelho)
  function corDe(g) {
    var c = g._nv !== undefined ? g._nv : g.nv, pv = g._pv !== undefined ? g._pv : g.pv;
    if (c === 'sim' || c === 'talvez' || c === 'nao') return c;
    if (pv == null) return '';
    return pv >= 74 ? 'sim' : pv >= 51 ? 'talvez' : 'nao';
  }
  var COR = { sim: ['🟢', 'Acho que você vai gostar', 'Vai gostar', 'w-sim'], talvez: ['🟡', 'Talvez', 'Talvez', 'w-talvez'], nao: ['🔴', 'Acho que não', 'Acho que não', 'w-nao'] };
  var CORES = ['sim', 'talvez', 'nao'];
  function ordPv(a, b) { return pvDe(b) - pvDe(a) || notaP(b) - notaP(a) || a.o - b.o; }
  function paraVoce(g) { return corDe(g) === 'sim' && !M.plano[g.i] && !M.int[g.i] && nv(g) >= 3; }
  // joia: usa o campo jo quando a lista traz esse campo; se não, a regra da nota e das poucas avaliações
  var TEM_JO = false, TEM_PV = false, TEM_EF = false;
  function ehJoia(g) {
    if (TEM_JO) return g.jo === 1;
    return (g.r || 0) >= 90 && ((g.rv >= 500 && g.rv <= 20000) || (g['do'] || 0) <= 500000);
  }
  function romOk(g, k) {
    var r = g.rk || (g.rom ? 'opc' : 'nao');
    if (k === 'namorar') return r === 'sim' || r === 'opc';
    if (k === 'qualquer') return r === 'sim' || r === 'opc' || r === 'leve';
    if (k === 'sem') return r === 'nao' || r === 'nc';
    return r === k;
  }
  function ordNota(a, b) { return notaP(b) - notaP(a) || a.o - b.o; }
  var ORDENS = {
    pv: ordPv,
    nota: ordNota,
    pop: function (a, b) { return a.o - b.o; },
    novos: function (a, b) { return (b.a || 0) - (a.a || 0) || a.o - b.o; },
    nome: function (a, b) { return colar.compare(a.n, b.n); },
    disco: function (a, b) { return (a.s == null ? 1e9 : a.s) - (b.s == null ? 1e9 : b.s) || a.o - b.o; },
    trad: function (a, b) { return (a.pt ? 1e9 : a.ef == null ? 1e8 : a.ef) - (b.pt ? 1e9 : b.ef == null ? 1e8 : b.ef) || ordPv(a, b); }
  };
  var NOMES_ORDEM = { pv: '🎯 Mais a sua cara', nota: '★ Nota', pop: 'Mais jogados', novos: '✨ Mais novos', nome: 'A–Z Nome', disco: 'Menor no disco', trad: '✍️ Mais rápido de traduzir' };

  function ehRetro(g) { return (g.g === 'rpg' || g.g === 'rpgnicho' || g.g === 'tatica') && (g._et.indexOf('px') >= 0 || g._et.indexOf('mz') >= 0 || g._et.indexOf('lj') >= 0); }
  var SECOES = [
    { k: 'int', tit: '★ Seus interesses', dsc: 'Os jogos em que você tocou na estrela.', f: function (g) { return !!M.int[g.i]; }, meus: 1 },
    { k: 'quero', tit: '▶ Quero jogar', dsc: '', f: function (g) { return M.plano[g.i] === 'quero'; }, meus: 1 },
    { k: 'cara', tit: 'Mais a sua cara', ico: '🟢', dsc: 'A bolinha verde: os que eu acho que você vai gostar, do mais parecido com o seu gosto.', f: function (g) { return corDe(g) === 'sim'; } },
    { k: 'nicho', tit: 'RPG nichado', gen: 'rpgnicho', dsc: GEN_DESC.rpgnicho, f: function (g) { return g.g === 'rpgnicho'; } },
    { k: 'namorar', tit: '💗 Dá pra namorar', dsc: 'Romance central ou opcional, com os que dá pra namorar primeiro no seu gosto.', f: function (g) { return romOk(g, 'namorar'); } },
    { k: 'MROM' },
    { k: 'retro', tit: '👾 RPG retrô', dsc: 'RPG e tática em pixel, de masmorra ou livro-jogo.', f: ehRetro },
    { k: 'fora', tit: '🌐 Fora da Steam', dsc: 'itch.io, DLsite e jogos grátis de fora da loja.', f: function (g) { return !!g.loja; } },
    { k: 'LISTAS' },
    { k: 'joias', tit: '💎 Joias escondidas', dsc: 'Nota altíssima e pouca gente conhece.', f: ehJoia },
    { k: 'GENEROS' },
    { k: 'NIVEIS' },
    { k: 'liso', tit: 'Roda liso nos seus PCs', dsc: 'Passam dos requisitos recomendados.', f: function (g) { return nv(g) === 4; } },
    { k: 'dub', tit: '🎙 Dublados em PT-BR', dsc: 'Com vozes em português do Brasil.', f: function (g) { return g.pt === 2; } },
    { k: 'deck', tit: 'Verificados no Steam Deck', dsc: 'Rodam bem num aparelho fraco: boa dica para os seus PCs.', f: function (g) { return g.dk === 3; } },
    { k: 'para', tit: '💡 Para você', dsc: 'Bolinha verde, rodam no PC escolhido e você ainda não marcou: some quando você decide.', f: paraVoce, so: 1 }
  ];
  var SEC_K = {};
  SECOES.forEach(function (s) { SEC_K[s.k] = s; });
  function titSecao(s) {
    if (s.k === 'liso' && F.pc !== 'dois') return 'Roda liso ' + noPC(F.pc);
    return s.gen ? genNome(s.gen) : s.tit;
  }

  function abaOk(g, k) {
    var id = g.i, pl = M.plano[id];
    if (k === 'marc') return !!(M.int[id] || M.inst[id] || pl === 'quero' || pl === 'joguei');
    if (k === 'int') return !!M.int[id];
    if (k === 'inst') return !!M.inst[id];
    return pl === k;
  }
  function tamOk(g, t) {
    var s = g.s;
    if (!t) return true;
    if (s == null) return false;
    if (t === 'ate2') return s <= 2;
    if (t === '2a5') return s > 2 && s <= 5;
    if (t === '5a10') return s > 5 && s <= 10;
    if (t === '10a20') return s > 10 && s <= 20;
    if (t === 'mais20') return s > 20;
    if (t === 'cabe') { var k = F.pc === 'meu' ? 'meu' : 'pai'; return s <= ((PCS[k] && PCS[k].livre) || 0); }
    return true;
  }
  // os filtros da folha; "ign" deixa um grupo de fora (para contar as opções dele, como no Switch)
  function passaGlobal(g, semEsconder, ign) {
    if (ign !== 'idioma' && F.idioma) {
      if (F.idioma === 'com' && !(g.pt >= 1)) return false;
      if (F.idioma === 'dub' && g.pt !== 2) return false;
      if (F.idioma === 'sem' && g.pt) return false;
    }
    if (ign !== 'rom' && F.rom && !romOk(g, F.rom)) return false;
    if (ign !== 'cor' && F.cor.length && F.cor.length < 3 && F.cor.indexOf(corDe(g)) < 0) return false;
    if (ign !== 'gen' && F.gen && g.g !== F.gen) return false;
    if (ign !== 'et' && F.et.length) { for (var i = 0; i < F.et.length; i++) if (g._et.indexOf(F.et[i]) < 0) return false; }
    if (ign !== 'nota' && F.nota && !((g.r || 0) >= F.nota)) return false;
    if (ign !== 'tam' && F.tam && !tamOk(g, F.tam)) return false;
    if (ign !== 'meus' && F.meus) {
      if (F.meus === 'int' && !M.int[g.i]) return false;
      if (F.meus === 'inst' && !M.inst[g.i]) return false;
      if (F.meus === 'quero' && M.plano[g.i] !== 'quero') return false;
      if (F.meus === 'joia' && !ehJoia(g)) return false;
    }
    if (ign !== 'mais' && F.ctrl && !g.ct) return false;
    if (ign !== 'idioma' && F.facil && !(!g.pt && g.efd === 'facil')) return false;
    if (!semEsconder && ign !== 'mais') {
      if (F.esc18 && g.ad) return false;
      if (F.escVet && g._vet) return false;
    }
    return true;
  }
  function passaFonte(g, fo) {
    if (fo.t === 'sec') return SEC_K[fo.k].f(g);
    if (fo.t === 'gen') return g.g === fo.k;
    if (fo.t === 'aba') return abaOk(g, fo.k);
    if (fo.t === 'lista') return !!(LISTA_POS[fo.k] && LISTA_POS[fo.k][g.i]);
    if (fo.t === 'mrom') return !!(MROM_POS[fo.k] && MROM_POS[fo.k][g.i]);
    if (fo.t === 'busca') { for (var k = 0; k < F.q.length; k++) if (g._b.indexOf(F.q[k]) < 0) return false; }
    return true;
  }
  function rodaOk(n, r) {
    if (!r) return n !== 1;
    if (r === 'todos') return true;
    if (r === 'liso') return n === 4;
    if (r === 'roda') return n >= 3;
    if (r === 'limite') return n === 2;
    if (r === 'nao') return n === 1;
    if (r === 'sem') return n === 0;
    return true;
  }
  // percorre todos os jogos uma vez: lista que passa, contagem por nível e quantos "não roda" ficaram escondidos
  function filtrar(fo, ign) {
    var semEsc = !!fo && (fo.t === 'aba' || fo.t === 'lista');
    var cont = [0, 0, 0, 0, 0], lista = [], escondidos = 0;
    for (var i = 0; i < JOGOS.length; i++) {
      var g = JOGOS[i];
      if (!semEsc && M.plano[g.i] === 'nao' && !(fo && fo.t === 'busca')) continue;
      if (!passaGlobal(g, semEsc, ign)) continue;
      if (fo && !passaFonte(g, fo)) continue;
      var n = nv(g);
      cont[n]++;
      if (fo && fo.t === 'nivel') { if (n !== fo.k) continue; }
      else if (!semEsc && ign !== 'roda' && !rodaOk(n, F.roda)) { if (n === 1 && !F.roda) escondidos++; continue; }
      lista.push(g);
    }
    return { lista: lista, cont: cont, escondidos: escondidos };
  }
  function ordenar(lista, fo) {
    var cmp = ORDENS[F.ordem] || ORDENS.pop;
    if (F.ordem === ORDEM_PADRAO && fo && fo.t === 'sec' && SEC_K[fo.k].ord) cmp = SEC_K[fo.k].ord;
    if (F.ordem === ORDEM_PADRAO && fo && (fo.t === 'lista' || fo.t === 'mrom')) {
      var ps = fo.t === 'lista' ? LISTA_POS[fo.k] : MROM_POS[fo.k];
      cmp = function (a, b) { return (ps[a.i] || 999) - (ps[b.i] || 999); };
    }
    return lista.sort(cmp);
  }

  // ---------------- cards ----------------
  var grid = $('grid');
  var ATUAL = [], MOSTRADOS = 0, BASE_ATUAL = { lista: [], cont: [0, 0, 0, 0, 0], escondidos: 0 };
  var LISTAS = {}; // listas das seções da tela (para as setas da ficha)

  function seloNivel(n, rot) {
    return '<span class="selo nv' + n + '" title="' + esc((rot ? (rot === CURTO.pai ? PCS.pai.nome : PCS.meu.nome) + ': ' : '') + NIVEL[n].nome) + '">' + esc(rot ? rot + ' ' + NIVEL[n].sim : NIVEL[n].nome) + '</span>';
  }
  function selosNivel(g) {
    var v = g.v || [0, 0];
    if (F.pc === 'dois') return seloNivel(v[0] || 0, CURTO.pai) + seloNivel(v[1] || 0, CURTO.meu);
    return seloNivel(nv(g));
  }
  // a bolinha do "Pra você", igual à do Switch (mod_W_porque.js: selo "w-selo" no começo dos selos)
  function seloGosto(g) {
    var c = COR[corDe(g)];
    if (!c) return '';
    return '<button type="button" class="selo w-selo" data-acao="pq" title="Pra você: ' + esc(c[1]) + ' (' + pvDe(g) + ' de 100). Toque para ver o porquê" aria-label="Pra você: ' + esc(c[1]) + '. Ver o porquê">' + c[0] + '</button>';
  }
  function seloPT(g) {
    if (g.pt === 2) return '<span class="selo dub" title="Dublado em português do Brasil">🎙 PT-BR</span>';
    if (g.pt === 1) return '<span class="selo pt" title="Interface e legendas em português do Brasil">💬 PT-BR</span>';
    if (g.pp) return '<span class="selo pp" title="Só português de Portugal">PT-PT</span>';
    return '';
  }
  function seloNota(g) {
    if (g.r == null) return '';
    var t = g.r + '% de análises positivas' + (g.rv ? ' (' + fmtN.format(g.rv) + ')' : '');
    return g.r < 60 ? '<span class="selo nota baixa" title="' + t + '">👎 ' + g.r + '</span>' : '<span class="selo nota" title="' + t + '">★ ' + g.r + '</span>';
  }
  // romance em níveis (rk), como na Estante do Switch: na capa só ♥ (central ou dá pra namorar) e "? romance"
  var ROM_TXT = { sim: 'Romance central', opc: 'Dá pra namorar', leve: 'Romance de fundo', nc: 'Romance não conferido' };
  function seloRom(g) {
    var r = g.rk || (g.rom ? 'opc' : '');
    if (r === 'sim' || r === 'opc') return '<span class="selo rom" title="' + ROM_TXT[r] + '">♥</span>';
    if (r === 'nc') return '<span class="selo nc" title="Romance não conferido">? romance</span>';
    return '';
  }
  function seloPlano(g) {
    var pl = M.plano[g.i];
    if (pl === 'quero') return '<span class="selo plano">▶ Quero jogar</span>';
    if (pl === 'joguei') return '<span class="selo plano">✓ Já joguei</span>';
    if (pl === 'nao') return '<span class="selo veto">Dispensado</span>';
    return '';
  }
  function selosCard(g) {
    return (g.ad ? '<span class="selo ad" title="Conteúdo adulto (+18)">🔞 +18</span>' : '') + (ehJoia(g) ? '<span class="selo joia" title="Joia escondida: nota altíssima e pouca gente conhece">💎 Joia</span>' : '') +
      seloGosto(g) + seloLoja(g) + seloPT(g) + seloEsforco(g) + seloNota(g) + seloRom(g) + selosNivel(g) +
      (g.sw === 'fav' ? '<span class="selo sw" title="Você deu estrela a este jogo na Estante do Switch">★ Switch</span>' : '') +
      (g._vet ? '<span class="selo veto" title="' + (g.x === 'ot' ? 'Protagonista mulher que namora homens (otome)' : 'Romance só do mesmo sexo') + '">Vetado</span>' : '') +
      seloPlano(g);
  }
  function imgCapa(g, classe) {
    if (!g.c) return '';
    return '<img class="' + classe + '" loading="lazy" decoding="async" width="460" height="215" alt="" src="' + esc(urlCapa(g.c)) + '"' + (g._ext ? ' referrerpolicy="no-referrer"' : '') + '>';
  }
  // a frase "por que é a sua cara" vem na ficha (pq)
  function pqDe(g) { return g.pq || (FICHAS[g.i] && FICHAS[g.i].pq) || ''; }
  function cardHTML(g, comPq) {
    var id = g.i, nome = esc(g.n);
    return '<article class="card' + (M.inst[id] ? ' sel' : '') + (M.plano[id] === 'nao' ? ' dispensado' : '') + '" data-id="' + id + '">' +
      '<div class="capa" style="--gc:' + (COR_GEN[g.g] || '#3a4a6b') + '">' + (g.ad ? '<span class="capa-18" title="Conteúdo adulto">🔞 +18</span>' : '') +
        '<button type="button" class="capa-hit" data-acao="ver" aria-label="Ver o jogo: ' + nome + '"><span class="capa-sem" aria-hidden="true">' + nome + '</span>' + imgCapa(g, 'ci') + '</button>' +
        '<button type="button" class="fav" data-acao="int" aria-pressed="' + !!M.int[id] + '" aria-label="Tenho interesse: ' + nome + '" title="Tenho interesse">' + (M.int[id] ? '★' : '☆') + '</button>' +
        '<button type="button" class="inst" data-acao="inst" aria-pressed="' + !!M.inst[id] + '" aria-label="Quero instalar: ' + nome + '" title="Quero instalar (entra na conta do disco)">💾</button>' +
      '</div>' +
      '<div class="selos">' + selosCard(g) + '</div>' +
      '<h3 class="nome" data-acao="ver">' + nome + '</h3>' +
      (comPq && pqDe(g) ? '<p class="pq">' + esc(pqDe(g)) + '</p>' : '') +
      '</article>';
  }
  function atualizarCardsDom(id) {
    var g = POR_ID[id];
    if (!g) return;
    cada('#conteudo .card[data-id="' + g.i + '"], #ficha .card[data-id="' + g.i + '"]', function (el) { el.outerHTML = cardHTML(g, !!el.querySelector('.pq')); });
  }

  // ---------------- desenho: catálogo ou grade ----------------
  function desenhar(manter) {
    BASE_ATUAL = filtrar(null);
    ordenar(BASE_ATUAL.lista, null);
    var cat = V.modo === 'catalogo';
    $('catalogo').hidden = !cat;
    $('grade-sec').hidden = cat;
    $('b-voltar').hidden = cat;
    $('b-todos').hidden = !cat;
    $('atalhos').hidden = !cat; $('pc-expl').hidden = !cat; $('mostrando').hidden = !cat;
    var r = cat ? BASE_ATUAL : desenharGrade(manter);
    if (cat) desenharCatalogo();
    var t = cat ? '<strong>' + jogosTxt(r.lista.length) + '</strong> com os filtros de agora' : 'Mostrando <strong>' + fmtN.format(r.lista.length) + '</strong> de ' + fmtN.format(JOGOS.length) + ' jogos';
    if (r.escondidos) t += ' · ' + fmtN.format(r.escondidos) + ' que não rodam ficam escondidos';
    if (fila.length) t += ' · carregando…';
    $('mostrando').innerHTML = t;
    $('b-todos').innerHTML = 'Ver todos os ' + jogosTxt(BASE_ATUAL.lista.length) + ' <span aria-hidden="true">›</span>';
    montarAtivos();
    atualizarAbas();
  }
  function cabSecao(id, tit, n, fonteTxt, svg, ico) {
    return '<div class="sec-cab"><h2 id="' + id + '-t"><button type="button" data-ver="' + fonteTxt + '">' + (svg || (ico ? '<span aria-hidden="true">' + ico + '</span>' : '')) + esc(tit) + '</button>' +
      (n != null ? ' <span class="n">' + jogosTxt(n) + '</span>' : '') + '</h2>' +
      (fonteTxt ? '<button type="button" class="vt" data-ver="' + fonteTxt + '">Ver tudo ›</button>' : '') + '</div>';
  }
  function secaoHTML(s, lista) {
    var id = 'sec-' + s.k, fonte = s.gen ? 'gen:' + s.gen : 'sec:' + s.k;
    LISTAS[id] = lista;
    return '<section class="sec" id="' + id + '" data-lista="' + id + '" aria-labelledby="' + id + '-t">' +
      cabSecao(id, titSecao(s), lista.length, fonte, s.gen ? genSvg(s.gen) : '', s.ico) +
      (s.dsc ? '<p class="sec-dsc">' + esc(s.dsc) + '</p>' : '') +
      '<div class="grid">' + lista.slice(0, POR_SECAO).map(function (g) { return cardHTML(g, false); }).join('') + '</div></section>';
  }
  var gensAberto = false;
  function generosHTML(base) {
    var cont = {};
    base.forEach(function (g) { cont[g.g] = (cont[g.g] || 0) + 1; });
    var h = GEN_ORDER.map(function (k) {
      return '<button type="button" class="gen-t' + (k === 'rpgnicho' ? ' nicho' : '') + '" data-gen="' + k + '">' + genSvg(k) + '<b>' + esc(genNome(k)) + '</b><small>' + jogosTxt(cont[k] || 0) + '</small></button>';
    }).join('');
    return '<section class="sec" id="sec-generos" aria-labelledby="sec-generos-t"><div class="sec-cab"><h2 id="sec-generos-t"><span aria-hidden="true">🎮</span>Gêneros <span class="n">' + GEN_ORDER.length + ' gêneros</span></h2></div>' +
      '<div class="gens' + (gensAberto ? '' : ' fechado') + '" id="gens">' + h + '</div>' +
      '<button type="button" class="gens-mais" id="gens-mais" aria-controls="gens" aria-expanded="' + gensAberto + '">' + (gensAberto ? 'Menos gêneros ▴' : 'Ver os ' + GEN_ORDER.length + ' gêneros ▾') + '</button></section>';
  }
  function niveisHTML(cont) {
    var h = [4, 3, 2, 1, 0].map(function (n) {
      var dsc = n === 1 ? (F.roda ? 'Aparecendo na lista' : NIVEL[1].dsc) : NIVEL[n].dsc;
      return '<button type="button" class="nv-t n' + n + '" data-nv="' + n + '" aria-pressed="false"><span class="num">' + fmtN.format(cont[n]) + '</span><span class="lbl">' + NIVEL[n].nome + '</span><span class="dsc">' + dsc + '</span></button>';
    }).join('');
    return '<section class="sec" id="sec-niveis" aria-labelledby="sec-niveis-t"><div class="sec-cab"><h2 id="sec-niveis-t"><span aria-hidden="true">💻</span>' +
      (F.pc === 'dois' ? 'Desempenho nos seus PCs' : 'Desempenho ' + esc(noPC(F.pc))) + '</h2></div>' +
      '<p class="sec-dsc">' + (F.pc === 'dois' ? 'Vale o melhor dos dois PCs.' : 'Só o ' + esc(PCS[F.pc].nome) + '.') + ' Toque para ver a lista.</p><div class="niveis">' + h + '</div></section>';
  }
  function desenharCatalogo() {
    var base = BASE_ATUAL.lista, h = [];
    LISTAS = {};
    if (!JOGOS.length) { $('catalogo').innerHTML = '<p class="empty">Abrindo o catálogo…</p>'; return; }
    SECOES.forEach(function (s) {
      if (s.k === 'GENEROS') { h.push(generosHTML(base)); return; }
      if (s.k === 'NIVEIS') { h.push(niveisHTML(BASE_ATUAL.cont)); return; }
      if (s.k === 'MROM') { h.push(mromHTML(base)); return; }
      if (s.k === 'LISTAS') { h.push(listasHTML()); return; }
      if (s.so) return;
      var l = base.filter(s.f);
      if (F.ordem === ORDEM_PADRAO && s.ord) l.sort(s.ord);
      if (l.length) h.push(secaoHTML(s, l));
    });
    $('catalogo').innerHTML = h.join('') || '<div class="empty"><p>Nenhum jogo com esses filtros.</p><button type="button" class="btn btn-forte" data-limpar="1">Limpar filtros</button></div>';
  }
  function porGenero(base) {
    var b = {};
    base.forEach(function (g) { (b[g.g] = b[g.g] || []).push(g); });
    return GEN_ORDER.filter(function (k) { return b[k]; }).map(function (k) { return { k: k, lista: b[k] }; });
  }
  function titFonte(fo) {
    if (fo.t === 'sec') return titSecao(SEC_K[fo.k]);
    if (fo.t === 'gen') return genNome(fo.k);
    if (fo.t === 'nivel') return NIVEL[fo.k].nome + (F.pc === 'dois' ? ' (no melhor dos dois PCs)' : ' ' + noPC(F.pc));
    if (fo.t === 'aba') { var a = ABAS.filter(function (x) { return x[0] === fo.k; })[0]; return a ? a[1].replace(/^[^\wÀ-ú]+ /, '') : 'Marcações'; }
    if (fo.t === 'busca') return 'Busca: “' + F.qTxt + '”';
    if (fo.t === 'todos') return 'Todos os jogos';
    if (fo.t === 'lista') { var l = listaPorId(fo.k); return l ? l.nome : 'Lista'; }
    if (fo.t === 'mrom') { var pr = MROM_PARTES.filter(function (x) { return x[0] === fo.k; })[0]; return 'Melhores romances: ' + (pr ? pr[1].slice(2) : ''); }
    return '';
  }
  function icoFonte(fo) {
    if (fo.t === 'gen') return genSvg(fo.k);
    if (fo.t === 'sec' && SEC_K[fo.k].ico) return '<span aria-hidden="true">' + SEC_K[fo.k].ico + '</span>';
    return '';
  }
  function dscFonte(fo) {
    if (fo.t === 'sec') return SEC_K[fo.k].dsc || '';
    if (fo.t === 'gen') return GEN_DESC[fo.k] || '';
    if (fo.t === 'nivel') return NIVEL[fo.k].dsc.replace(/^Escondidos.*/, 'Pelos requisitos, não roda.');
    return '';
  }
  function montarOrdem() {
    $('ordem').innerHTML = '<span class="rot">Ordem:</span>' + ['pv', 'nota', 'pop', 'novos', 'nome', 'disco', 'trad'].filter(function (k) { return (k !== 'pv' || TEM_PV) && (k !== 'trad' || TEM_EF); }).map(function (k) {
      var rot = k === ORDEM_PADRAO && V.fonte && (V.fonte.t === 'lista' || V.fonte.t === 'mrom') ? '# Ordem da lista' : NOMES_ORDEM[k];
      return '<button type="button" data-ordem="' + k + '" aria-pressed="' + (F.ordem === k) + '">' + rot + '</button>';
    }).join('');
  }
  function desenharGrade(manter) {
    var r = filtrar(V.fonte);
    ordenar(r.lista, V.fonte);
    ATUAL = r.lista;
    var qtd = Math.min(ATUAL.length, manter ? Math.max(MOSTRADOS, POR_VEZ) : POR_VEZ);
    grid.innerHTML = ATUAL.slice(0, qtd).map(cardGrade).join('');
    MOSTRADOS = qtd;
    atualizarMais();
    $('grade-tit').innerHTML = icoFonte(V.fonte) + esc(titFonte(V.fonte));
    $('grade-n').textContent = jogosTxt(ATUAL.length);
    var d = dscFonte(V.fonte);
    if (r.escondidos && V.fonte.t !== 'nivel') d += (d ? ' ' : '') + fmtN.format(r.escondidos) + ' que não rodam estão escondidos (Filtros → Roda no PC).';
    $('grade-dsc').textContent = d ? '· ' + d : '';
    montarOrdem();
    $('vazio').hidden = ATUAL.length > 0 || !JOGOS.length;
    var lf = V.fonte.t === 'lista' && listaPorId(V.fonte.k);
    $('grade-extra').innerHTML = lf ? extraLista(lf) : '';
    return r;
  }
  function cardGrade(g) { return cardHTML(g, V.fonte && V.fonte.t === 'sec' && V.fonte.k === 'para'); }
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
  // "carregar mais" sozinho ao chegar perto do fim (como no catálogo do Switch); o botão continua para quem preferir
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting && V.modo === 'grade' && !$('mais').hidden) mostrarMais(); });
    }, { rootMargin: '600px 0px' }).observe($('mais'));
  }
  // redesenha o catálogo sem a tela pular: mantém a seção que estava no alto no mesmo lugar
  function comAncora(fn) {
    var anc = null, off = 0;
    if (window.scrollY > 0) {
      var secs = document.querySelectorAll('#catalogo .sec');
      for (var i = 0; i < secs.length; i++) {
        var r = secs[i].getBoundingClientRect();
        if (r.bottom > 0) { anc = secs[i].id; off = r.top; break; }
      }
    }
    fn();
    if (anc && $(anc)) window.scrollBy(0, $(anc).getBoundingClientRect().top - off);
  }

  // ---------------- navegação: grade, catálogo e gêneros ----------------
  function rolarPara(el) {
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.scrollIntoView({ block: 'start' }); }); });
  }
  function abrirGrade(fo) {
    if (V.modo === 'catalogo') { V.scrollCat = window.scrollY; V.modo = 'grade'; empurrar('grade'); }
    V.fonte = fo; V.fonteAntes = null;
    desenhar(false);
    rolarPara($('barra-topo'));
  }
  function voltarCatalogoDom() {
    V.modo = 'catalogo'; V.fonte = null; V.fonteAntes = null;
    if (F.q.length) { F.q = []; F.qTxt = ''; $('q').value = ''; }
    desenhar(false);
    if (V.irDepois) { var id = V.irDepois; V.irDepois = null; rolarPara($(id)); }
    else window.scrollTo(0, V.scrollCat || 0);
  }

  // ---------------- filtros ativos (chips; tocar tira) ----------------
  var ROM_FILTRO = { namorar: '♥ Com romance', opc: '♥ Dá pra namorar', sim: '♥ Romance central', qualquer: '♡ Qualquer romance', sem: 'Sem romance' };
  var RODA_FILTRO = { todos: 'Mostrando os que não rodam', liso: 'Só os que rodam liso', roda: 'Só os que rodam', limite: 'Só no limite', nao: 'Só os que não rodam', sem: 'Só sem dados' };
  var TAM_FILTRO = { ate2: 'Até 2 GB', '2a5': '2 a 5 GB', '5a10': '5 a 10 GB', '10a20': '10 a 20 GB', mais20: 'Mais de 20 GB', cabe: 'Cabe no disco livre' };
  var MEUS_FILTRO = { int: '★ Com interesse', inst: '💾 Para instalar', quero: '▶ Quero jogar', joia: '💎 Só joias escondidas' };
  function ativosLista() {
    var a = [];
    if (F.q.length) a.push(['q', 'Busca: “' + F.qTxt + '”']);
    if (F.cor.length && F.cor.length < 3) a.push(['cor', F.cor.map(function (c) { return COR[c][0] + ' ' + COR[c][2]; }).join(' + ')]);
    if (F.idioma) a.push(['idioma', { com: 'Com PT-BR', dub: 'Dublado em PT-BR', sem: 'Sem PT-BR' }[F.idioma]]);
    if (F.rom) a.push(['rom', ROM_FILTRO[F.rom]]);
    if (F.gen) a.push(['gen', genNome(F.gen)]);
    F.et.forEach(function (c) { a.push(['et:' + c, ETIQ[c] ? ETIQ[c][0] : c]); });
    if (F.roda) a.push(['roda', RODA_FILTRO[F.roda]]);
    if (F.nota) a.push(['nota', 'Nota ' + F.nota + '% ou mais']);
    if (F.tam) a.push(['tam', TAM_FILTRO[F.tam]]);
    if (F.meus) a.push(['meus', MEUS_FILTRO[F.meus]]);
    if (F.ordem !== ORDEM_PADRAO && V.modo === 'catalogo') a.push(['ordem', 'Ordem: ' + NOMES_ORDEM[F.ordem]]);
    if (F.ctrl) a.push(['ctrl', 'Só com controle']);
    if (F.facil) a.push(['facil', '✍️ Fácil de traduzir']);
    if (F.esc18) a.push(['esc18', 'Escondendo +18']);
    if (!F.escVet) a.push(['escVet', 'Mostrando vetados']);
    return a;
  }
  function montarAtivos() {
    var a = ativosLista(), box = $('ativos');
    box.hidden = !a.length;
    box.innerHTML = a.map(function (x) {
      return '<button type="button" class="at-chip" data-tirar="' + esc(x[0]) + '" aria-label="Tirar o filtro: ' + esc(x[1]) + '">' + esc(x[1]) + ' <b aria-hidden="true">✕</b></button>';
    }).join('') + (a.length > 1 ? '<button type="button" class="at-limpar" data-limpar="1">Limpar tudo</button>' : '');
    var n = a.filter(function (x) { return x[0] !== 'q' && x[0] !== 'ordem'; }).length;
    $('filtros-n').textContent = n || '';
  }
  function tirarFiltro(k) {
    if (k === 'q') { $('q').value = ''; aplicarBusca(''); return; }
    if (k.indexOf('et:') === 0) { var c = k.slice(3); F.et = F.et.filter(function (x) { return x !== c; }); redesenharFiltros(); return; }
    var p = filtrosPadrao();
    F[k] = p[k];
    redesenharFiltros();
  }
  function limpar() {
    var p = filtrosPadrao();
    ['idioma', 'ordem', 'rom', 'esc18', 'escVet', 'roda', 'ctrl', 'cor', 'gen', 'et', 'nota', 'tam', 'meus', 'facil'].forEach(function (k) { F[k] = p[k]; });
    if (F.q.length) { $('q').value = ''; aplicarBusca(''); } else redesenharFiltros();
  }
  function redesenharFiltros() {
    if (V.modo === 'catalogo') comAncora(function () { desenhar(false); }); else desenhar(false);
    if (folha.open) pintarFolha();
  }

  // ---------------- busca ----------------
  function aplicarBusca(txt) {
    F.qTxt = txt.trim();
    F.q = norm(txt).split(/\s+/).filter(Boolean);
    if (F.q.length) {
      if (V.modo === 'catalogo') { abrirGrade({ t: 'busca' }); return; }
      if (V.fonte.t !== 'busca') { V.fonteAntes = V.fonte; V.fonte = { t: 'busca' }; desenhar(false); return; }
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
    timerBusca = setTimeout(function () { aplicarBusca(v); }, 250);
  });
  $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(timerBusca); aplicarBusca(this.value); this.blur(); } });

  // ---------------- folha de filtros (copiada do mod_L_navegar do Switch) ----------------
  var folha = $('folha');
  function contagem(ign, chave) {
    var r = filtrar(V.modo === 'grade' ? V.fonte : null, ign), c = {};
    r.lista.forEach(function (g) { var ks = chave(g); (Array.isArray(ks) ? ks : [ks]).forEach(function (k) { c[k] = (c[k] || 0) + 1; }); });
    return { c: c, total: r.lista.length };
  }
  function pilula(grupo, val, txt, on, n) {
    return '<button type="button" data-fg="' + grupo + '" data-fv="' + esc(val) + '" aria-pressed="' + !!on + '"' + (n === 0 && !on ? ' class="zero"' : '') + '>' + txt +
      (n != null ? ' <span class="n">' + fmtN.format(n) + '</span>' : '') + '</button>';
  }
  function secFolha(tit, dica, corpo) {
    return '<div class="fo-sec"><h3>' + tit + (dica ? ' <small>(' + dica + ')</small>' : '') + '</h3>' + corpo + '</div>';
  }
  function pintarFolha() {
    var h = [], c;
    if (TEM_PV) {
      c = contagem('cor', corDe);
      h.push(secFolha('Pra você', 'as bolinhas das capas; dá pra escolher mais de uma', '<div class="pills">' + CORES.map(function (k) {
        return pilula('cor', k, COR[k][0] + ' ' + COR[k][2], F.cor.indexOf(k) >= 0, c.c[k] || 0);
      }).join('') + '</div>'));
    }
    c = contagem('idioma', function (g) { return g.pt === 2 ? ['com', 'dub'] : g.pt === 1 ? ['com'] : ['sem']; });
    h.push(secFolha('Português', '', '<div class="pills">' + pilula('idioma', '', 'Tanto faz', !F.idioma) +
      pilula('idioma', 'com', 'Com PT-BR', F.idioma === 'com', c.c.com || 0) + pilula('idioma', 'dub', '🎙 Dublado', F.idioma === 'dub', c.c.dub || 0) +
      pilula('idioma', 'sem', 'Sem português', F.idioma === 'sem', c.c.sem || 0) +
      (TEM_EF ? pilula('facil', '1', '✍️ Fácil de traduzir', F.facil, JOGOS.filter(function (g) { return !g.pt && g.efd === 'facil'; }).length) : '') + '</div>'));
    c = contagem('rom', function (g) { return ['namorar', 'opc', 'sim', 'qualquer', 'sem'].filter(function (k) { return romOk(g, k); }); });
    h.push(secFolha('Romance', '', '<div class="pills">' + pilula('rom', '', 'Tanto faz', !F.rom) + ['namorar', 'opc', 'sim', 'qualquer', 'sem'].map(function (k) {
      return pilula('rom', k, ROM_FILTRO[k], F.rom === k, c.c[k] || 0);
    }).join('') + '</div>'));
    c = contagem('gen', function (g) { return g.g; });
    h.push(secFolha('Gênero', '', '<div class="pills">' + pilula('gen', '', 'Todos', !F.gen, c.total) + GEN_ORDER.map(function (k) {
      return pilula('gen', k, esc(genNome(k)), F.gen === k, c.c[k] || 0);
    }).join('') + '</div>'));
    c = contagem('et', function (g) { return g._et; });
    var porG = {};
    Object.keys(ETIQ).forEach(function (k) { (porG[ETIQ[k][1]] = porG[ETIQ[k][1]] || []).push(k); });
    h.push(secFolha('Etiquetas', 'o jogo precisa ter todas as que você escolher', Object.keys(ETIQ_GRUPOS).map(function (gr) {
      return '<h4>' + ETIQ_GRUPOS[gr] + '</h4><div class="pills">' + (porG[gr] || []).map(function (k) {
        return pilula('et', k, esc(ETIQ[k][0]), F.et.indexOf(k) >= 0, c.c[k] || 0);
      }).join('') + '</div>';
    }).join('')));
    c = contagem('roda', function (g) { var n = nv(g); return [n === 4 ? 'liso' : '', n >= 3 ? 'roda' : '', n === 2 ? 'limite' : '', n === 1 ? 'nao' : '', n === 0 ? 'sem' : '', 'todos'].filter(Boolean); });
    h.push(secFolha('Roda no PC', F.pc === 'dois' ? 'no melhor dos dois' : esc(PCS[F.pc].nome), '<div class="pills">' + pilula('roda', '', 'Esconder os que não rodam', !F.roda) +
      ['roda', 'liso', 'limite', 'nao', 'sem', 'todos'].map(function (k) {
        return pilula('roda', k, { roda: 'Roda', liso: 'Roda liso', limite: 'No limite', nao: 'Não roda', sem: 'Sem dados', todos: 'Mostrar todos' }[k], F.roda === k, c.c[k] || 0);
      }).join('') + '</div>'));
    h.push(secFolha('Nota dos jogadores', '% de análises positivas na Steam', '<div class="pills">' + pilula('nota', '0', 'Tanto faz', !F.nota) +
      [70, 80, 90].map(function (k) { return pilula('nota', String(k), k + '% ou mais', F.nota === k); }).join('') + '</div>'));
    h.push(secFolha('Tamanho no disco', '', '<div class="pills">' + pilula('tam', '', 'Tanto faz', !F.tam) +
      Object.keys(TAM_FILTRO).map(function (k) { return pilula('tam', k, TAM_FILTRO[k], F.tam === k); }).join('') + '</div>'));
    h.push(secFolha('Só os meus', '', '<div class="pills">' + pilula('meus', '', 'Tanto faz', !F.meus) +
      Object.keys(MEUS_FILTRO).map(function (k) { return pilula('meus', k, MEUS_FILTRO[k], F.meus === k); }).join('') + '</div>'));
    h.push(secFolha('Mais', '', '<div class="pills">' + pilula('ctrl', '1', '🎮 Só com controle', F.ctrl) + pilula('esc18', '1', 'Esconder +18', F.esc18) +
      pilula('escVet', '1', 'Esconder vetados', F.escVet) + '</div><p class="fine" style="margin-top:6px">Vetados: otome (protagonista mulher que namora homens) e romance só do mesmo sexo, como na Estante do Switch.</p>'));
    var corpo = $('folha-corpo'), top = corpo.scrollTop;
    corpo.innerHTML = h.join('');
    corpo.scrollTop = top;
    var n = filtrar(V.modo === 'grade' ? V.fonte : { t: 'todos' }).lista.length;
    $('folha-ok').textContent = 'Mostrar ' + jogosTxt(n);
  }
  function abrirFolha() {
    pintarFolha();
    if (!folha.open) { folha.showModal(); empurrar('folha'); }
    $('folha-corpo').scrollTop = 0;
  }
  function fecharFolhaDom(ver) {
    if (folha.open) folha.close();
    redesenharFiltros();
    if (ver && V.modo === 'catalogo') abrirGrade({ t: 'todos' });
  }
  folha.addEventListener('cancel', function (e) { e.preventDefault(); fecharCamada('folha'); });
  folha.addEventListener('click', function (e) {
    if (e.target === folha) { fecharCamada('folha'); return; }
    var b = e.target.closest('[data-fo]');
    if (b) {
      var k = b.dataset.fo;
      if (k === 'fechar') fecharCamada('folha');
      else if (k === 'limpar') { limpar(); pintarFolha(); }
      else if (k === 'ok') { folhaVer = true; fecharCamada('folha'); }
      return;
    }
    var p = e.target.closest('[data-fg]');
    if (!p) return;
    var gr = p.dataset.fg, v = p.dataset.fv;
    if (gr === 'cor') { var i = F.cor.indexOf(v); if (i >= 0) F.cor.splice(i, 1); else F.cor.push(v); if (F.cor.length === 3) F.cor = []; }
    else if (gr === 'et') { var j = F.et.indexOf(v); if (j >= 0) F.et.splice(j, 1); else F.et.push(v); }
    else if (gr === 'nota') F.nota = +v || 0;
    else if (gr === 'ctrl' || gr === 'esc18' || gr === 'escVet' || gr === 'facil') F[gr] = !F[gr];
    else F[gr] = F[gr] === v ? (gr === 'idioma' || gr === 'rom' || gr === 'gen' || gr === 'roda' || gr === 'tam' || gr === 'meus' ? '' : v) : v;
    pintarFolha();
    montarAtivos();
  });
  var folhaVer = false;

  // ---------------- marcações, cabeçalho e painéis ----------------
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
      ? '"Nos dois": vale o melhor dos dois PCs; cada card mostra um selo de cada PC (Pai e Note).'
      : 'Os selos, as listas e o "Não roda" usam só o ' + PCS[F.pc].nome + '.';
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
    $('leitura').innerHTML = n ? t : 'Nenhum jogo marcado para instalar. Toque no 💾 de uma capa para marcar.';
    var bar = $('barra-disco');
    bar.hidden = !n;
    document.body.classList.toggle('com-barra', !!n);
    bar.className = 'barra-disco ' + classe;
    bar.querySelector('.bd-fill').style.width = pct.toFixed(1) + '%';
    bar.querySelector('.bd-txt').innerHTML = '💾 ' + n + ' para instalar · ' + gb(soma) + ' de ' + gb(livre) + ' ' + noPC(k) +
      (sobra < 0 ? ' · <span class="falta">não cabe</span>' : '') + ' · ★ ' + contaAba('int') + ' com interesse';
  }
  function atualizarResumo() {
    if (!JOGOS.length) return;
    var pai = 0, meu = 0, pt = 0;
    JOGOS.forEach(function (g) { var v = g.v || [0, 0]; if (v[0] >= 3) pai++; if (v[1] >= 3) meu++; if (g.pt) pt++; });
    $('resumo').textContent = 'Rodam ' + fmtN.format(pai) + ' jogos ' + noPC('pai') + ' e ' + fmtN.format(meu) + ' ' + noPC('meu') +
      '. Com português do Brasil: ' + fmtN.format(pt) + '.';
  }

  // ---------------- camadas (grade, ficha, folha, Tinder, capas) e o botão voltar do celular ----------------
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
    else if (nome === 'folha') { var ver = folhaVer; folhaVer = false; fecharFolhaDom(ver); }
    else if (nome === 'capas') { if (dlgC.open) dlgC.close(); }
    else if (nome === 'gosto') { if (gostoDlg && gostoDlg.open) gostoDlg.close(); }
    else if (nome === 'roleta') { if (rolDlg && rolDlg.open) rolDlg.close(); }
  }
  window.addEventListener('popstate', function () { var nome = pilha.pop(); if (nome) fecharDom(nome); });

  // ---------------- ficha (do jeito da ficha do Switch) ----------------
  var dlg = $('ficha');
  var fichaId = null, fichaLista = null;

  function planosHTML(g) {
    var id = g.i, pl = M.plano[id];
    function b(k, txt, on, extra) { return '<button type="button" class="pl-btn ' + (extra || '') + '" data-f="' + k + '" aria-pressed="' + !!on + '">' + txt + '</button>'; }
    return '<div class="planos" role="group" aria-label="Suas marcações">' +
      b('quero', (pl === 'quero' ? '▶' : '▷') + ' Quero jogar', pl === 'quero') + b('joguei', (pl === 'joguei' ? '●' : '○') + ' Já joguei', pl === 'joguei') +
      b('int', (M.int[id] ? '★' : '☆') + ' Tenho interesse', M.int[id]) + b('inst', '💾 Quero instalar', M.inst[id]) +
      b('nao', '✕ Não quero', pl === 'nao', 'pl-nao') + '</div>';
  }
  function blocoPC(g, f, k, idx) {
    var n = (g.v || [0, 0])[idx] || 0, p = PCS[k] || {};
    var mo = f && f.mo ? (f.mo[idx] || []) : g.loja ? [] : null;
    return '<div class="f-pc nv' + n + '"><h3>Roda ' + esc(noPC(k)) + '? <span class="selo nv' + n + '">' + NIVEL[n].nome + '</span></h3>' +
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
  // o bloco "Pra você" (mod_W do Switch): a frase pq do perfil_pc.py vira a lista de motivos
  function blocoPV(g) {
    var c = corDe(g), x = COR[c];
    if (!x) return '';
    var pq = pqDe(g), itens = pq ? pq.split(' · ').filter(Boolean) : [], pros = itens, contras = [];
    if (g._px) {
      var mo = motivos(g), cap = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
      pros = mo.pros.map(function (p) { return cap(p[0]); }); contras = mo.contras.map(function (p) { return cap(p[0]); });
      // a frase do perfil_pc.py diz QUAL jogo da série ou da editora: troca o texto genérico por ela
      var rico = itens.filter(function (t) { return /^(Da série|Da mesma editora|Você )/.test(t); })[0];
      if (rico) pros = pros.map(function (t) { return /^(Da série de um|Da editora de um|Você deu estrela|Você marcou)/.test(t) ? rico : t; });
    } else {
      if (c === 'nao' && itens.length) { contras = itens.slice(0, 1); pros = itens.slice(1); }
      if (g._vet) { contras = [g.x === 'ot' ? 'Vetado: protagonista mulher que namora homens (otome)' : 'Vetado: romance só do mesmo sexo']; pros = []; }
      if (g.sw === 'fav') pros = ['Você deu estrela a ele na Estante do Switch'].concat(pros);
      if (g.r != null && g.r < 60 && !contras.length) contras.push('Nota baixa: ' + g.r + '%');
    }
    var li = function (l, vazio) { return l.length ? l.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') : '<li class="w-nada">' + vazio + '</li>'; };
    return '<div class="w-pv ' + x[3] + '"><div class="w-cab"><span class="w-ico" aria-hidden="true">' + x[0] + '</span><div><span class="w-rot">Pra você · ' + pvDe(g) + ' de 100</span><span class="w-ver">' + x[1] + '</span></div></div>' +
      '<div class="w-cols"><div class="w-col w-a"><h3>Por que você gostaria</h3><ul>' + li(pros, pq || !FICHAS[g.i] ? 'Nada em especial que puxe pro seu gosto' : 'Carregando…') + '</ul></div>' +
      '<div class="w-col w-b"><h3>Por que talvez não gostaria</h3><ul>' + li(contras, 'Nada contra que eu tenha achado') + '</ul></div></div>' +
      '<div class="w-ensina"><span class="fine">Me ensina:</span>' + ensinaHTML(g).replace(/data-acao="voto" data-v="(-?1)"/g, 'data-f="voto:$1"') + '</div></div>';
  }
  // "Parecidos com este": mesmo gênero e as mesmas etiquetas, com o seu gosto (pv) desempatando
  function parecidos(g) {
    var et = g._et, tg = (g.t || []).slice(0, 6), r = [];
    for (var i = 0; i < JOGOS.length; i++) {
      var x = JOGOS[i];
      if (x === g || M.plano[x.i] === 'nao' || !passaGlobal(x, false) || nv(x) === 1) continue;
      var s = (x.g === g.g ? 3 : 0);
      for (var a = 0; a < et.length; a++) if (x._et.indexOf(et[a]) >= 0) s += 1;
      for (var b = 0; b < tg.length; b++) if ((x.t || []).indexOf(tg[b]) >= 0) s += 0.5;
      if (s < 4) continue;
      r.push([s + pvDe(x) / 50, x]);
    }
    r.sort(function (p, q) { return q[0] - p[0]; });
    return r.slice(0, 4).map(function (p) { return p[1]; });
  }
  function montarFicha(g) {
    var f = FICHAS[g.i];
    var estado = f ? 'ok' : fichaEstado[g.f] === 'erro' ? 'erro' : 'carregando';
    var cor = COR_GEN[g.g] || '#3a4a6b';
    var pos = fichaLista ? fichaLista.indexOf(g) : -1;
    var h = '<div class="f-in">';
    h += '<button type="button" class="f-x" data-f="fechar" aria-label="Fechar a ficha">✕</button>';
    h += '<div class="f-heroi" style="--gc:' + cor + '">' + (g.c ? '<img class="f-fundo" alt="" aria-hidden="true" src="' + esc(urlCapa(g.c)) + '">' : '') +
      (pos >= 0 ? '<button type="button" class="f-seta esq" data-f="ant" aria-label="Jogo anterior"' + (pos <= 0 ? ' disabled' : '') + '>‹</button>' : '') +
      '<div class="f-capa-box"><span class="capa-sem" aria-hidden="true">' + esc(g.n) + '</span>' + imgCapa(g, 'f-capa') + '</div>' +
      (pos >= 0 ? '<button type="button" class="f-seta dir" data-f="prox" aria-label="Próximo jogo"' + (pos >= fichaLista.length - 1 ? ' disabled' : '') + '>›</button>' +
        '<span class="f-pos">' + fmtN.format(pos + 1) + ' de ' + fmtN.format(fichaLista.length) + '</span>' : '') + '</div>';
    var chips = [];
    if (g.pt === 2) chips.push('<span class="f-chip pt">🎙 Dublado em PT-BR</span>');
    else if (g.pt === 1) chips.push('<span class="f-chip pt">PT-BR oficial</span>');
    else chips.push('<span class="f-chip cinza">' + (g.pp ? 'Só PT de Portugal' : 'Sem PT-BR') + '</span>');
    var rk = g.rk || (g.rom ? 'opc' : '');
    if (rk === 'sim' || rk === 'opc') chips.push('<span class="f-chip rom">♥ ' + ROM_TXT[rk] + '</span>');
    else if (rk === 'leve') chips.push('<span class="f-chip rom">♡ Romance de fundo</span>');
    else if (rk === 'nc') chips.push('<span class="f-chip cinza">? Romance não conferido</span>');
    if (ehJoia(g)) chips.push('<span class="f-chip joia">💎 Joia escondida</span>');
    if (g.sw === 'fav') chips.push('<span class="f-chip sw">★ Estrela no Switch</span>');
    if (g._vet) chips.push('<span class="f-chip veto">' + (g.x === 'ot' ? 'Protagonista mulher que namora homens' : 'Romance só do mesmo sexo') + '</span>');
    if (g.ad) chips.push('<span class="f-chip adulto">🔞 Conteúdo adulto (+18)</span>');
    if (g.loja) chips.push('<span class="f-chip cinza">🌐 ' + esc(lojaNome(g)) + '</span>');
    h += '<div class="f-tit"><button type="button" class="f-gen" data-f="gen">' + esc(genNome(g.g)) + ' ›</button><h2 id="f-nome">' + esc(g.n) + '</h2>' +
      '<div class="f-chips">' + chips.join('') + '</div></div>';
    h += blocoPV(g);
    h += blocoRf(f && f.rf);
    var info = [];
    if (g.r != null) info.push('★ Nota dos jogadores: ' + g.r + '%' + (g.rv ? ' de ' + fmtN.format(g.rv) : ''));
    if (g.s != null) info.push('💾 ' + gb(g.s) + ' no disco');
    if (g.a) info.push('📅 ' + g.a);
    if (g.ct) info.push('🎮 Controle ' + (g.ct === 2 ? 'total' : 'parcial'));
    if (g.dk === 3) info.push('Steam Deck: verificado'); else if (g.dk === 2) info.push('Steam Deck: jogável');
    if (info.length) h += '<div class="f-info">' + info.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>';
    if (g._et.length) h += '<div class="etqs" aria-label="Etiquetas (tocar filtra)">' + g._et.filter(function (c) { return ETIQ[c]; }).map(function (c) {
      return '<button type="button" class="etq" data-f="et:' + c + '" title="Ver os jogos com esta etiqueta">' + esc(ETIQ[c][0]) + '</button>';
    }).join('') + '</div>';
    h += planosHTML(g);
    h += g.loja ? '<div class="links">' + (g.url ? '<a class="btn btn-forte" href="' + esc(g.url) + '" target="_blank" rel="noopener">Abrir na loja (' + esc(lojaNome(g)) + ') ↗</a>' : '') + '</div>'
      : '<div class="links"><a class="btn btn-forte" href="https://store.steampowered.com/app/' + g.i + '/" target="_blank" rel="noopener">Abrir na Steam ↗</a>' +
      '<a class="btn" href="steam://store/' + g.i + '">Abrir no app da Steam</a></div>';
    h += blocoEf(g, f);
    if (estado === 'carregando') h += '<p class="f-carregando">Carregando os detalhes…</p>';
    else if (estado === 'erro') h += '<p class="aviso">Não deu para carregar os detalhes deste jogo. <button type="button" class="btn" data-f="recarregar">Tentar de novo</button></p>';
    h += '<div class="f-pcs">' + blocoPC(g, f, 'pai', 0) + blocoPC(g, f, 'meu', 1) + '</div>';
    if (f && f.sc && f.sc.length) {
      h += '<div class="f-sec"><h3>Fotos</h3><div class="fotos">' + f.sc.map(function (s, i) {
        var u = BASE + esc(s);
        return '<a href="' + u + '" target="_blank" rel="noopener"><img loading="lazy" decoding="async" width="600" height="338" src="' + u + '" alt="Foto ' + (i + 1) + ' de ' + esc(g.n) + '"></a>';
      }).join('') + '</div></div>';
    }
    if (f && f.ds) h += '<div class="f-sec"><h3>O que é</h3><p class="f-desc">' + esc(f.ds) + '</p></div>';
    var etqs = f && f.tg && f.tg.length ? f.tg.map(function (t) { return TAG_PT[t] || t; }) : g._tp;
    if (etqs.length) h += '<div class="f-sec"><h3>Etiquetas da Steam</h3><div class="etqs">' + etqs.map(function (t) { return '<span class="etq so">' + esc(t) + '</span>'; }).join('') + '</div></div>';
    if (f && (f.mn || f.rc)) {
      h += '<div class="f-sec"><h3>Requisitos</h3>';
      if (f.mn) h += '<details class="req"><summary>Mínimos</summary><pre>' + esc(f.mn) + '</pre></details>';
      if (f.rc) h += '<details class="req"><summary>Recomendados</summary><pre>' + esc(f.rc) + '</pre></details>';
      h += '</div>';
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
    linha('Romance', rk ? ROM_TXT[rk] : (TEM_PV ? 'Sem romance' : ''));
    linha('Português', g.pt === 2 ? 'Dublado em PT-BR' : g.pt === 1 ? 'Interface e legendas em PT-BR' : g.pp ? 'Só português de Portugal' : 'Sem português');
    if (f) {
      linha('Idiomas', esc(f.lg));
      linha('Categorias', esc((f.cat || []).join(', ')));
      if (f.w) linha('Site', '<a href="' + esc(f.w) + '" target="_blank" rel="noopener">' + esc(f.w.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + '</a>');
    }
    if (d.length) h += '<div class="f-sec"><h3>Dados</h3><dl class="dados">' + d.join('') + '</dl></div>';
    var par = parecidos(g);
    if (par.length) h += '<div class="f-sec f-par"><h3>Parecidos com este</h3><div class="grid">' + par.map(function (x) { return cardHTML(x, false); }).join('') + '</div></div>';
    h += '</div>';
    dlg.innerHTML = h;
  }
  function abrirFicha(id, lista) {
    var g = POR_ID[id];
    if (!g) return;
    if (lista !== undefined) fichaLista = lista && lista.indexOf(g) >= 0 ? lista : null;
    fichaId = g.i;
    montarFicha(g);
    if (!dlg.open) {
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      empurrar('ficha');
    }
    dlg.scrollTop = 0;
    if (!FICHAS[g.i]) pedirFicha(g.f, function () { if (fichaId === g.i && dlg.open) { var top = dlg.scrollTop; montarFicha(g); dlg.scrollTop = top; } });
  }
  function fecharFichaDom() {
    if (dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
    fichaId = null;
  }
  function andarFicha(d) {
    if (!fichaLista) return;
    var i = fichaLista.indexOf(POR_ID[fichaId]) + d;
    if (i >= 0 && i < fichaLista.length) abrirFicha(fichaLista[i].i);
  }
  dlg.addEventListener('cancel', function (e) { e.preventDefault(); fecharCamada('ficha'); });
  dlg.addEventListener('click', function (e) {
    if (e.target === dlg) { fecharCamada('ficha'); return; }
    var card = e.target.closest('.card [data-acao]');
    if (card) {
      var cid = card.closest('.card').dataset.id;
      if (card.dataset.acao === 'ver') abrirFicha(cid, null);
      else if (card.dataset.acao === 'pq') mostrarPq(card.closest('.card'));
      else if (card.dataset.acao === 'voto') votar(cid, +card.dataset.v);
      else marcar(cid, card.dataset.acao);
      return;
    }
    var b = e.target.closest('[data-f]');
    if (!b) return;
    var k = b.dataset.f, g = POR_ID[fichaId];
    if (k === 'fechar') { fecharCamada('ficha'); return; }
    if (k === 'recarregar') { fichaEstado[g.f] = ''; abrirFicha(g.i); return; }
    if (k === 'ant') { andarFicha(-1); return; }
    if (k === 'prox') { andarFicha(1); return; }
    if (k.indexOf('voto:') === 0) { votar(String(g.i), +k.slice(5)); return; }
    if (k === 'gen') { var gk = g.g; fecharCamada('ficha'); setTimeout(function () { abrirGrade({ t: 'gen', k: gk }); }, 30); return; }
    if (k.indexOf('et:') === 0) {
      var c = k.slice(3);
      if (F.et.indexOf(c) < 0) F.et.push(c);
      fecharCamada('ficha');
      setTimeout(function () { if (V.modo === 'catalogo') abrirGrade({ t: 'todos' }); else redesenharFiltros(); }, 30);
      return;
    }
    marcar(fichaId, k);
    var velho = dlg.querySelector('.planos');
    if (velho) velho.outerHTML = planosHTML(g);
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
        '<div class="t-topo"><h2>🃏 Avaliar jogos</h2><p class="t-conta" id="t-conta"></p><button type="button" class="t-x" data-t="fechar" aria-label="Sair">✕</button></div>' +
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
    return '<div class="t-card ' + classe + '" data-id="' + g.i + '" style="--gc:' + (COR_GEN[g.g] || '#3a4a6b') + '">' +
      '<div class="t-capa">' + (g.c ? '<img class="t-fundo" alt="" aria-hidden="true" src="' + esc(urlCapa(g.c)) + '">' : '') +
        '<div class="t-capa-box"><span class="capa-sem" aria-hidden="true">' + esc(g.n) + '</span>' + imgCapa(g, 't-img', false) + '</div>' +
        '<span class="t-carimbo t-c-sim">QUERO</span><span class="t-carimbo t-c-nao">NÃO</span><span class="t-carimbo t-c-int">☆ INTERESSE</span>' +
      '</div>' +
      '<div class="t-corpo"><h3 class="t-tit">' + esc(g.n) + '</h3><div class="selos">' + selosCard(g) + '</div>' +
        (pqDe(g) ? '<p class="t-pq">' + esc(pqDe(g)) + '</p>' : '') + '<div class="t-vered">' + pc('pai', 0) + pc('meu', 1) + '</div>' +
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
      if (!g.c || g._ext) return false;
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
    var dados = { app: 'estante-pc', versao: 1, data: new Date().toISOString(), int: M.int, inst: M.inst, plano: M.plano, voto: M.voto, gosto: M.gosto };
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
        for (id in d.voto || {}) { if (d.voto[id] === 1 || d.voto[id] === -1) { M.voto[id] = d.voto[id]; n++; } }
        if (d.gosto && typeof d.gosto === 'object') M.gosto = d.gosto;
        salvar(); recalcGosto(); desenhar(true); atualizarDisco();
        $('marc-msg').textContent = 'Cópia carregada: ' + n + ' marcações juntadas às que já estavam aqui.';
      } catch (e) { $('marc-msg').textContent = 'Esse arquivo não é uma cópia da Estante do PC.'; }
    };
    r.readAsText(arq);
  }

  // =====================================================================================================
  // 1.10 (26/11): o gosto refeito no navegador ("Ajustar o gosto" e "Me ensina"), o "por quê" da bolinha,
  // listas famosas, melhores romances, roleta, modo uma mão, gestos na grade e tamanho das capas.
  // =====================================================================================================
  function limitar(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function vir(n) { return String(Math.round(n * 10) / 10).replace('.', ','); }
  // ---- os ingredientes do pv (perfil_pc.py: campo px) em grupos que o usuário pode pesar ----
  var GRUPOS_GOSTO = [
    ['rom', '💗 Romance', 'Quanto pesa ter romance ("dá pra namorar", central, de fundo) e quanto pesa não ter.', ['rs', 'ro', 'rl', 'rn', 'rx']],
    ['nicho', '🎲 RPG nichado e retrô', 'RPG pequeno e pouco conhecido, pixel, masmorra, livro-jogo.', ['gN', 'gR']],
    ['rpg', '⚔ RPG em geral', 'RPG grande, CRPG e tática.', ['gP', 'gC', 'gT', 'gO']],
    ['nota', '★ Nota dos jogadores', 'Quanto a nota da Steam conta, para cima e para baixo.', ['nt']],
    ['pt', '💬 Português', '0 = aceito sem PT-BR (eu traduzo); 2 = faz muita diferença ter PT-BR.', ['id']],
    ['sw', '★ O que marquei no Switch', 'Mesmo jogo, mesma série ou editora, e as pistas que você curte.', ['sf', 'ss', 'se', 'ed', 'pi']],
    ['nao', '✕ Tipos que não curto', 'Esporte, corrida, tiro, festa, multijogador, gênero que você nunca marca.', ['nu', 'ad', 'du']]
  ];
  var GRUPO_COD = {};
  GRUPOS_GOSTO.forEach(function (gr) { gr[3].forEach(function (c) { GRUPO_COD[c] = gr[0]; }); });
  function grupoCod(c) { return GRUPO_COD[c] || (c.indexOf('n_') === 0 ? 'nao' : ''); }
  function multDe(c) { var k = grupoCod(c), v = k && M.gosto ? M.gosto[k] : null; return typeof v === 'number' ? v : 1; }
  var APR = { gen: {}, et: {}, n: 0 };
  // "Me ensina": cada voto puxa o gênero (0,6) e as etiquetas (0,25 cada) dos jogos parecidos, com limite
  function aprender() {
    var gen = {}, et = {}, n = 0;
    Object.keys(M.voto || {}).forEach(function (id) {
      var g = POR_ID[id], v = M.voto[id];
      if (!g || (v !== 1 && v !== -1)) return;
      n++;
      gen[g.g] = (gen[g.g] || 0) + 0.6 * v;
      g._et.forEach(function (c) { et[c] = (et[c] || 0) + 0.25 * v; });
    });
    Object.keys(gen).forEach(function (k) { gen[k] = limitar(gen[k], -2, 2); });
    Object.keys(et).forEach(function (k) { et[k] = limitar(et[k], -1.5, 1.5); });
    APR = { gen: gen, et: et, n: n };
  }
  function aprendido(g) {
    var s = APR.gen[g.g] || 0;
    for (var i = 0; i < g._et.length; i++) s += APR.et[g._et[i]] || 0;
    return limitar(s, -2.5, 2.5);
  }
  // a mesma conta do perfil_pc.py (e do notaGosto do Switch): 🟢 conta >= 3 (74 a 99), 🟡 entre (51 a 73), 🔴 <= 0 (0 a 50)
  function calcGosto(g) {
    if (!g._px) { g._pv = g.pv; g._nv = g.nv; g._ap = 0; return; }
    if (g.x) { g._pv = 0; g._nv = 'nao'; g._ap = 0; return; }
    var s = 0;
    for (var i = 0; i < g._px.length; i++) s += g._px[i][1] * multDe(g._px[i][0]);
    var ap = APR.n && !(M.voto && M.voto[g.i]) ? aprendido(g) : 0;
    s += ap; g._ap = ap;
    var v = M.voto && M.voto[g.i];
    if (v === 1) s = Math.max(s, 4); else if (v === -1) s = Math.min(s, -0.5);
    var c = s >= 3 ? 'sim' : s <= 0 ? 'nao' : 'talvez', n;
    if (c === 'sim') n = 74 + 26 * (1 - Math.exp(-(s - 3) / 4));
    else if (c === 'talvez') n = 51 + 22 * s / 3;
    else n = 50 * Math.exp(s / 2.5);
    g._pv = Math.round(Math.min(c === 'sim' ? 99 : 100, n)); g._nv = c; g._s = s;
  }
  function recalcGosto() { aprender(); for (var i = 0; i < JOGOS.length; i++) calcGosto(JOGOS[i]); }
  // ---- o "por quê" (uma linha, sem abrir a ficha) ----
  var TXT_COD = { rs: 'romance central', ro: 'dá pra namorar', rl: 'romance de fundo', rn: 'pode ter romance', rx: 'sem romance',
    sf: 'você deu estrela no Switch', ss: 'você marcou no Switch', se: 'da série de um jogo seu', ed: 'da editora de um jogo seu',
    gN: 'RPG nichado', gR: 'RPG retrô', gC: 'CRPG', gP: 'RPG', gT: 'tática', pi: 'tem coisas que você curte', nu: 'gênero que você quase não marca',
    ad: 'foco em conteúdo adulto', du: 'longo demais', n_es: 'esporte', n_co: 'corrida', n_fe: 'festa e minigames', n_mp: 'multijogador',
    n_lu: 'luta', n_ti: 'tiro', n_ca: 'casual', n_ed: 'nem é bem um jogo', n_ki: 'feito pra criança', n_ac: 'pede muito reflexo',
    n_hr: 'terror', n_pz: 'mais quebra-cabeça que história' };
  function txtCod(g, c, w) {
    if (c === 'nt') return g.r != null ? 'nota ' + g.r + '%' : 'sem nota';
    if (c === 'id') return w > 0 ? (g.pt === 2 ? 'dublado em PT-BR' : g.pt ? 'tem PT-BR' : 'curto, dá pra traduzir') : 'sem PT-BR';
    if (c === 'gO') return genNome(g.g);
    return TXT_COD[c] || c;
  }
  function motivos(g) {
    var pros = [], contras = [];
    (g._px || []).forEach(function (t) {
      var w = t[1] * multDe(t[0]);
      if (Math.abs(w) < 0.25) return;
      (w > 0 ? pros : contras).push([txtCod(g, t[0], w), w]);
    });
    if (g._ap && Math.abs(g._ap) >= 0.25) (g._ap > 0 ? pros : contras).push([g._ap > 0 ? 'parecido com os que você aprovou' : 'parecido com os que você reprovou', g._ap]);
    pros.sort(function (a, b) { return b[1] - a[1]; });
    contras.sort(function (a, b) { return a[1] - b[1]; });
    var v = M.voto && M.voto[g.i];
    if (v === 1) pros.unshift(['você me ensinou que gosta', 9]);
    if (v === -1) contras.unshift(['você me ensinou que não tem nada a ver', -9]);
    if (g._vet) contras.unshift([g.x === 'ot' ? 'vetado: otome' : 'vetado: romance só do mesmo sexo', -10]);
    return { pros: pros, contras: contras };
  }
  function linhaPq(g) {
    var c = corDe(g), m = motivos(g), x = COR[c];
    if (!x) return 'Sem a nota de gosto para este jogo.';
    function j(l) { return l.map(function (p) { return p[0]; }).join(' + '); }
    if (c === 'nao') return 'Por que não: ' + (j(m.contras.slice(0, 3)) || 'pouca coisa a favor') + (m.pros.length ? ' (a favor: ' + j(m.pros.slice(0, 1)) + ')' : '');
    if (c === 'sim') return 'Por que é a sua cara: ' + (j(m.pros.slice(0, 3)) || 'o conjunto') + (m.contras.length ? ' (contra: ' + j(m.contras.slice(0, 1)) + ')' : '');
    return 'Talvez: ' + (m.pros.length ? '+ ' + j(m.pros.slice(0, 2)) : '') + (m.contras.length ? ' · − ' + j(m.contras.slice(0, 2)) : '');
  }
  function ensinaHTML(g) {
    var v = M.voto && M.voto[g.i];
    return '<span class="ensina">' +
      '<button type="button" data-acao="voto" data-v="1" aria-pressed="' + (v === 1) + '">👍 Eu gostaria</button>' +
      '<button type="button" data-acao="voto" data-v="-1" aria-pressed="' + (v === -1) + '">👎 Nada a ver</button></span>';
  }
  function mostrarPq(card) {
    var g = POR_ID[card.dataset.id], velho = card.querySelector('.pq-linha');
    if (velho) { velho.remove(); return; }
    if (!g) return;
    var p = document.createElement('div');
    p.className = 'pq-linha pq-' + corDe(g);
    p.innerHTML = '<p>' + COR[corDe(g)][0] + ' ' + esc(linhaPq(g)) + '</p>' + ensinaHTML(g);
    card.querySelector('.selos').insertAdjacentElement('afterend', p);
  }
  function redesenharGosto() {
    recalcGosto();
    if (V.modo === 'catalogo') comAncora(function () { desenhar(true); }); else desenhar(true);
    if (dlg.open && fichaId != null && POR_ID[fichaId]) { var top = dlg.scrollTop; montarFicha(POR_ID[fichaId]); dlg.scrollTop = top; }
    if (gostoDlg && gostoDlg.open) pintarGosto();
  }
  function votar(id, v) {
    M.voto = M.voto || {};
    if (M.voto[id] === v) delete M.voto[id]; else M.voto[id] = v;
    salvar();
    redesenharGosto();
    var g = POR_ID[id];
    if (g) aviso((M.voto[id] ? (v === 1 ? '👍 Anotado: você gostaria de ' : '👎 Anotado: nada a ver com ') + g.n + '. Os parecidos mudaram de cor.' : 'Voto tirado.'), null);
  }
  // ---- aviso embaixo (some sozinho; com "Desfazer" quando dá) ----
  var avisoEl = null, avisoT = 0;
  function aviso(txt, desfazer) {
    if (!avisoEl) { avisoEl = document.createElement('div'); avisoEl.className = 'aviso-baixo'; avisoEl.setAttribute('role', 'status'); document.body.appendChild(avisoEl); }
    avisoEl.innerHTML = '<span>' + esc(txt) + '</span>' + (desfazer ? '<button type="button">Desfazer</button>' : '');
    avisoEl.hidden = false;
    if (desfazer) avisoEl.querySelector('button').onclick = function () { desfazer(); avisoEl.hidden = true; };
    clearTimeout(avisoT);
    avisoT = setTimeout(function () { avisoEl.hidden = true; }, 5000);
  }
  // ---- "🎚 Ajustar o gosto" ----
  var gostoDlg = null;
  function pintarGosto() {
    var cont = { sim: 0, talvez: 0, nao: 0 };
    JOGOS.forEach(function (g) { var c = corDe(g); if (cont[c] != null) cont[c]++; });
    var votos = Object.keys(M.voto || {}).filter(function (id) { return POR_ID[id]; });
    var h = '<p class="fine">Os controles mudam o peso de cada parte da conta da bolinha. As cores e a ordem "Mais a sua cara" se refazem na hora, e o ajuste sincroniza com o outro aparelho.</p>' +
      '<p class="gs-cont">🟢 ' + fmtN.format(cont.sim) + ' · 🟡 ' + fmtN.format(cont.talvez) + ' · 🔴 ' + fmtN.format(cont.nao) + '</p>';
    h += GRUPOS_GOSTO.map(function (gr) {
      var v = M.gosto && typeof M.gosto[gr[0]] === 'number' ? M.gosto[gr[0]] : 1;
      return '<label class="gs-item"><span class="gs-tit">' + gr[1] + ' <b>' + (v === 0 ? 'não conta' : '×' + vir(v)) + '</b></span><span class="fine">' + gr[2] + '</span>' +
        '<input type="range" min="0" max="2" step="0.25" value="' + v + '" data-gs="' + gr[0] + '"></label>';
    }).join('');
    h += '<div class="gs-votos"><h3>👍👎 O que você me ensinou</h3>' + (votos.length
      ? '<p class="fine">' + votos.length + (votos.length === 1 ? ' jogo' : ' jogos') + ': ' + votos.slice(0, 12).map(function (id) { return (M.voto[id] > 0 ? '👍 ' : '👎 ') + esc(POR_ID[id].n); }).join(' · ') + (votos.length > 12 ? '…' : '') + '</p>' +
        '<p class="fine">O que aprendi: ' + (Object.keys(APR.gen).filter(function (k) { return Math.abs(APR.gen[k]) >= 0.3; }).map(function (k) { return genNome(k) + ' ' + (APR.gen[k] > 0 ? '+' : '') + vir(APR.gen[k]); }).join(', ') || 'ainda pouco') + '.</p>' +
        '<button type="button" class="btn" data-gs-acao="esquecer">Esquecer o que ensinei</button>'
      : '<p class="fine">Toque na bolinha de um card e diga "👍 Eu gostaria" ou "👎 Nada a ver": os jogos parecidos (mesmo gênero e mesmas etiquetas) mudam de cor.</p>') + '</div>';
    $('gs-corpo').innerHTML = h;
  }
  function abrirGosto() {
    if (!gostoDlg) {
      gostoDlg = document.createElement('dialog');
      gostoDlg.id = 'dlg-gosto';
      gostoDlg.setAttribute('aria-labelledby', 'gs-t');
      gostoDlg.innerHTML = '<div class="dc-in"><div class="dc-topo"><h2 id="gs-t">🎚 Ajustar o gosto</h2><button type="button" class="dc-x" data-gs-acao="fechar" aria-label="Fechar">✕</button></div>' +
        '<div id="gs-corpo"></div><div class="actions"><button type="button" class="btn" data-gs-acao="padrao">Voltar ao padrão</button><button type="button" class="btn btn-forte" data-gs-acao="fechar">Pronto</button></div></div>';
      document.body.appendChild(gostoDlg);
      var t = 0;
      gostoDlg.addEventListener('input', function (e) {
        var r = e.target.closest('[data-gs]');
        if (!r) return;
        M.gosto = M.gosto || {};
        M.gosto[r.dataset.gs] = +r.value;
        var b = r.parentNode.querySelector('.gs-tit b'); if (b) b.textContent = +r.value === 0 ? 'não conta' : '×' + vir(+r.value);
        clearTimeout(t);
        t = setTimeout(function () { salvar(); redesenharGosto(); }, 200);
      });
      gostoDlg.addEventListener('cancel', function (e) { e.preventDefault(); fecharCamada('gosto'); });
      gostoDlg.addEventListener('click', function (e) {
        if (e.target === gostoDlg) { fecharCamada('gosto'); return; }
        var b = e.target.closest('[data-gs-acao]');
        if (!b) return;
        var k = b.dataset.gsAcao;
        if (k === 'fechar') fecharCamada('gosto');
        else if (k === 'padrao') { M.gosto = {}; salvar(); redesenharGosto(); }
        else if (k === 'esquecer') { M.voto = {}; salvar(); redesenharGosto(); }
      });
    }
    pintarGosto();
    if (!gostoDlg.open) { gostoDlg.showModal(); empurrar('gosto'); }
  }

  // ---- listas famosas (CONF.listas): o que está na estante, marcado, roda, falta ----
  var LISTAS_F = Array.isArray(CONF.listas) ? CONF.listas : [];
  var LISTA_POS = {};
  LISTAS_F.forEach(function (l) { var m = {}; (l.itens || []).forEach(function (it) { if (it.appid) m[it.appid] = it.pos; }); LISTA_POS[l.id] = m; });
  function listaPorId(id) { return LISTAS_F.filter(function (l) { return l.id === id; })[0]; }
  function statsLista(l) {
    var r = { total: (l.itens || []).length, tem: 0, marc: 0, roda: 0, naoRoda: 0, fora: [] };
    (l.itens || []).forEach(function (it) {
      var g = it.appid && POR_ID[it.appid];
      if (!g) { r.fora.push(it); return; }
      r.tem++;
      if (abaOk(g, 'marc') || M.plano[g.i] === 'joguei') r.marc++;
      if (nv(g) >= 3) r.roda++; else if (nv(g) === 1) r.naoRoda++;
    });
    return r;
  }
  function listasHTML() {
    if (!LISTAS_F.length) return '';
    return '<section class="sec" id="sec-listas" aria-labelledby="sec-listas-t"><div class="sec-cab"><h2 id="sec-listas-t"><span aria-hidden="true">📋</span>Listas famosas</h2></div>' +
      '<p class="sec-dsc">Os mais citados nas listas de melhores: o que você já marcou, o que roda e o que nem está na estante.</p><div class="gens listas">' +
      LISTAS_F.map(function (l) {
        var s = statsLista(l);
        return '<button type="button" class="gen-t lista-t" data-ver="lista:' + esc(l.id) + '"><span class="lt-n" aria-hidden="true">' + s.total + '</span><b>' + esc(l.nome) + '</b>' +
          '<small>' + s.marc + ' marcados · ' + s.roda + ' rodam · ' + s.fora.length + ' fora da estante</small></button>';
      }).join('') + '</div></section>';
  }
  function extraLista(l) {
    var s = statsLista(l);
    var h = '<div class="lista-res"><span><b>' + s.tem + '</b> de ' + s.total + ' na estante</span><span><b>' + s.marc + '</b> marcados</span><span class="ok"><b>' + s.roda + '</b> rodam</span><span class="ruim"><b>' + s.naoRoda + '</b> não rodam</span><span><b>' + s.fora.length + '</b> fora da estante</span></div>' +
      (l.fonte ? '<p class="fine">Fonte: ' + esc(l.fonte) + '</p>' : '');
    if (s.fora.length) h += '<details class="fora-lista"><summary>Fora da estante (' + s.fora.length + '): ainda não coletados, só on-line ou sem dados</summary><ol>' +
      s.fora.map(function (it) {
        return '<li value="' + it.pos + '">' + (it.appid ? '<a href="https://store.steampowered.com/app/' + it.appid + '/" target="_blank" rel="noopener">' + esc(it.nome) + ' ↗</a>' : esc(it.nome)) + '</li>';
      }).join('') + '</ol></details>';
    return h;
  }
  // ---- 💕 Os melhores romances do PC (CONF.melhores_rom: central, opcional, de fundo) ----
  var MROM = CONF.melhores_rom || null;
  var MROM_PARTES = [['central', '♥ Romance central'], ['opcional', '♥ Dá pra namorar'], ['de_fundo', '♡ Romance de fundo']];
  var MROM_POS = {};
  if (MROM) MROM_PARTES.forEach(function (p) { var m = {}; (MROM[p[0]] || []).forEach(function (id, i) { m[id] = i + 1; }); MROM_POS[p[0]] = m; });
  function mromHTML(base) {
    if (!MROM) return '';
    var em = {}; base.forEach(function (g) { em[g.i] = g; });
    var partes = MROM_PARTES.map(function (p) {
      var l = (MROM[p[0]] || []).map(function (id) { return em[id]; }).filter(Boolean);
      if (!l.length) return '';
      var id = 'sec-mrom-' + p[0];
      LISTAS[id] = l;
      return '<div class="mrom-parte" data-lista="' + id + '">' + cabSecao(id, p[1], l.length, 'mrom:' + p[0]) + '<div class="grid">' + l.slice(0, POR_SECAO).map(function (g) { return cardHTML(g, false); }).join('') + '</div></div>';
    }).join('');
    if (!partes) return '';
    return '<section class="sec sec-mrom" id="sec-mrom" aria-labelledby="sec-mrom-t"><div class="sec-cab"><h2 id="sec-mrom-t"><span aria-hidden="true">💕</span>Os melhores romances do PC</h2></div>' +
      '<p class="sec-dsc">Escolhidos a dedo, em três partes: o romance é o jogo, dá pra namorar, ou fica de fundo.</p>' + partes + '</section>';
  }
  // ---- ficha de romance (rf) e esforço da tradução (ef) ----
  var MS_TXT = { so: 'Só do mesmo sexo', opcional: 'Opcional (dá pra escolher)', opc: 'Opcional (dá pra escolher)', nao: 'Não', sim: 'Sim', tambem: 'Também tem' };
  function valRf(v) {
    if (v === true) return 'Sim';
    if (v === false) return 'Não';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'number') return String(v);
    return MS_TXT[v] || String(v);
  }
  function blocoRf(rf) {
    if (!rf || typeof rf !== 'object') return '';
    var L = [['pares', 'Quantos pares'], ['escolha', 'O par'], ['casar', 'Dá pra casar'], ['final', 'Final com o par'], ['mesmo_sexo', 'Romance do mesmo sexo'], ['nota', 'Resumo']];
    var ESC = { livre: 'Você escolhe', fixa: 'Fixo (o jogo decide)' };
    var d = L.filter(function (x) { return rf[x[0]] != null && rf[x[0]] !== ''; }).map(function (x) {
      var v = x[0] === 'escolha' ? (ESC[rf.escolha] || rf.escolha) : x[0] === 'mesmo_sexo' && rf.mesmo_sexo === 'nao' ? 'Não tem' : valRf(rf[x[0]]);
      return '<dt>' + x[1] + '</dt><dd>' + esc(v) + '</dd>';
    }).join('');
    return d ? '<div class="f-sec f-rom"><h3>💕 Ficha de romance (sem spoiler)</h3><dl class="dados">' + d + '</dl></div>' : '';
  }
  var DIF_TXT = { facil: 'fácil', medio: 'médio', dificil: 'difícil', '?': 'sem estimativa' };
  function diasTxt(d) {
    if (d == null) return '';
    if (d <= 1) return 'uns 1 dia';
    if (d < 30) return 'uns ' + Math.round(d) + ' dias';
    if (d < 60) return 'uns 1 mês';
    return 'uns ' + Math.round(d / 30) + ' meses';
  }
  function seloEsforco(g) {
    if (g.pt || g.ef == null) return '';
    return '<span class="selo ef ef-' + (g.efd === 'facil' || g.efd === 'medio' || g.efd === 'dificil' ? g.efd : 'nd') + '" title="Traduzir: ' + (DIF_TXT[g.efd] || '?') + '">✍️ ' + diasTxt(g.ef) + '</span>';
  }
  function blocoEf(g, f) {
    var e = f && f.ef && typeof f.ef === 'object' ? f.ef : null;
    if (g.pt || (!e && g.ef == null)) return '';
    var dif = (e && e.dif) || g.efd;
    var d = [];
    if (e && e.motor) d.push('<dt>Motor</dt><dd>' + esc(e.motor) + '</dd>');
    d.push('<dt>Dificuldade</dt><dd>' + esc(DIF_TXT[dif] || '?') + '</dd>');
    if (e && e.palavras) d.push('<dt>Palavras</dt><dd>' + fmtN.format(e.palavras) + '</dd>');
    d.push('<dt>Tempo</dt><dd>' + esc((e && e.txt) || diasTxt(g.ef)) + '</dd>');
    if (e && e.pq) d.push('<dt>Por quê</dt><dd>' + esc(e.pq) + '</dd>');
    return '<div class="f-sec f-ef ef-' + (dif || 'nd') + '"><h3>✍️ Esforço para traduzir</h3><dl class="dados">' + d.join('') + '</dl></div>';
  }
  // ---- jogos fora da Steam (itch.io, DLsite, freeware) ----
  function lojaNome(g) {
    var l = String(g.loja || '');
    if (/itch/i.test(l)) return 'itch.io';
    if (/dlsite/i.test(l)) return 'DLsite';
    return l && l.length <= 14 ? l : 'Fora da Steam';
  }
  function seloLoja(g) { return g.loja ? '<span class="selo loja" title="Jogo fora da Steam">🌐 ' + esc(lojaNome(g)) + '</span>' : ''; }

  // ---- 🎡 Roleta (como a do Switch: de 5 a 10 jogos numa roleta que desacelera) ----
  var rolDlg = null, rolJogos = [], rolAng = 0, rolGirando = false;
  var ROL_CORES = ['#3550e0', '#1d7f4f', '#b4245f', '#b26b00', '#6b3fd4', '#0a6e9a', '#a33a34', '#5b8a1e', '#904296', '#25719a'];
  function sortearRoleta() {
    var base = BASE_ATUAL.lista.filter(paraVoce).slice(0, 40);
    if (base.length < 5) base = BASE_ATUAL.lista.slice(0, 40);
    var n = Math.min(base.length, 5 + Math.floor(Math.random() * 4)), esc_ = base.slice(), r = [];
    while (r.length < n && esc_.length) r.push(esc_.splice(Math.floor(Math.random() * esc_.length), 1)[0]);
    return r;
  }
  function pintarRoleta(venc) {
    var n = rolJogos.length, fat = 360 / n;
    var grad = rolJogos.map(function (g, i) { return ROL_CORES[i % ROL_CORES.length] + ' ' + (i * fat) + 'deg ' + ((i + 1) * fat) + 'deg'; }).join(',');
    $('rol-corpo').innerHTML = '<div class="rol-palco"><div class="rol-seta" aria-hidden="true">▼</div><div class="rol-roda" id="rol-roda" style="background:conic-gradient(' + grad + ');transform:rotate(' + rolAng + 'deg)">' +
      rolJogos.map(function (g, i) { return '<span class="rol-num" style="transform:rotate(' + ((i + 0.5) * fat) + 'deg) translateY(-38%)"><b style="transform:rotate(' + (-(i + 0.5) * fat - rolAng) + 'deg)">' + (i + 1) + '</b></span>'; }).join('') + '</div></div>' +
      '<ol class="rol-lista">' + rolJogos.map(function (g, i) { return '<li' + (venc === i ? ' class="venc"' : '') + '><i style="background:' + ROL_CORES[i % ROL_CORES.length] + '"></i>' + esc(g.n) + '</li>'; }).join('') + '</ol>' +
      (venc != null ? '<div class="rol-venc"><h3>🎉 Saiu: ' + esc(rolJogos[venc].n) + '</h3><div class="grid">' + cardHTML(rolJogos[venc], false) + '</div></div>' : '') +
      '<div class="actions"><button type="button" class="btn btn-forte" data-rol="girar"' + (rolGirando ? ' disabled' : '') + '>🎡 Girar</button><button type="button" class="btn" data-rol="outros">Trocar os jogos</button></div>';
  }
  function girarRoleta() {
    if (rolGirando || !rolJogos.length) return;
    var n = rolJogos.length, fat = 360 / n, alvo = Math.floor(Math.random() * n);
    // a seta fica no alto: o meio da fatia "alvo" tem de parar em 0 grau
    var fim = rolAng - (rolAng % 360) + 360 * 5 + (360 - (alvo + 0.5) * fat);
    var reduz = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    rolGirando = true; pintarRoleta(null);
    var roda = $('rol-roda');
    requestAnimationFrame(function () {
      roda.style.transition = reduz ? 'none' : 'transform 4s cubic-bezier(.17,.67,.2,1)';
      roda.style.transform = 'rotate(' + fim + 'deg)';
      setTimeout(function () { rolAng = fim; rolGirando = false; pintarRoleta(alvo); }, reduz ? 50 : 4100);
    });
  }
  function abrirRoleta() {
    if (!rolDlg) {
      rolDlg = document.createElement('dialog');
      rolDlg.id = 'dlg-roleta';
      rolDlg.setAttribute('aria-labelledby', 'rol-t');
      rolDlg.innerHTML = '<div class="dc-in"><div class="dc-topo"><h2 id="rol-t">🎡 Roleta da indecisão</h2><button type="button" class="dc-x" data-rol="fechar" aria-label="Fechar">✕</button></div>' +
        '<p class="fine">De 5 a 8 jogos com a bolinha verde que rodam e você ainda não marcou.</p><div id="rol-corpo"></div></div>';
      document.body.appendChild(rolDlg);
      rolDlg.addEventListener('cancel', function (e) { e.preventDefault(); fecharCamada('roleta'); });
      rolDlg.addEventListener('click', function (e) {
        if (e.target === rolDlg) { fecharCamada('roleta'); return; }
        var c = e.target.closest('.card [data-acao]');
        if (c) { var id = c.closest('.card').dataset.id; if (c.dataset.acao === 'ver') abrirFicha(id, null); else if (c.dataset.acao !== 'pq') marcar(id, c.dataset.acao); return; }
        var b = e.target.closest('[data-rol]');
        if (!b) return;
        if (b.dataset.rol === 'fechar') fecharCamada('roleta');
        else if (b.dataset.rol === 'girar') girarRoleta();
        else if (b.dataset.rol === 'outros') { rolJogos = sortearRoleta(); pintarRoleta(null); }
      });
    }
    rolJogos = sortearRoleta();
    pintarRoleta(null);
    if (!rolDlg.open) { rolDlg.showModal(); empurrar('roleta'); }
  }

  // ---- 🤚 Modo uma mão (desligado por padrão): barra embaixo que só aparece ao rolar para cima ----
  var maoEl = null, maoY = 0;
  function montarMao() {
    if (maoEl) return;
    maoEl = document.createElement('nav');
    maoEl.className = 'barra-mao'; maoEl.hidden = true; maoEl.setAttribute('aria-label', 'Atalhos perto do polegar');
    maoEl.innerHTML = '<button type="button" data-mao="buscar">🔎<span>Buscar</span></button><button type="button" data-mao="filtros">⚙<span>Filtros</span></button>' +
      '<button type="button" data-mao="para">💡<span>Pra você</span></button><button type="button" data-mao="tinder">🃏<span>Avaliar</span></button><button type="button" data-mao="topo">↑<span>Topo</span></button>';
    document.body.appendChild(maoEl);
    maoEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mao]');
      if (!b) return;
      var k = b.dataset.mao;
      if (k === 'buscar') { window.scrollTo(0, 0); $('q').focus(); }
      else if (k === 'filtros') abrirFolha();
      else if (k === 'para') abrirGrade({ t: 'sec', k: 'para' });
      else if (k === 'tinder') abrirTinder();
      else window.scrollTo(0, 0);
    });
  }
  function pintarBotoesAj() {
    $('b-mao').textContent = '🤚 Uma mão: ' + (AJ.mao ? 'ligado' : 'desligado');
    $('b-mao').setAttribute('aria-pressed', String(!!AJ.mao));
    $('b-tamcapa').textContent = '🖼 Capas ' + ({ p: 'pequenas', m: 'médias', g: 'grandes' }[AJ.capas || 'm']);
    document.documentElement.dataset.capas = AJ.capas || 'm';
    if (!AJ.mao && maoEl) maoEl.hidden = true;
    document.body.classList.toggle('mao-on', !!AJ.mao);
  }
  window.addEventListener('scroll', function () {
    var y = window.scrollY, sobe = y < maoY - 4, desce = y > maoY + 4;
    if (AJ.mao) {
      montarMao();
      if (y < 300 || desce) maoEl.hidden = true; else if (sobe) maoEl.hidden = false;
      document.body.classList.toggle('mao-vis', !maoEl.hidden);
    }
    if (Math.abs(y - maoY) > 4) maoY = y;
  }, { passive: true });

  // ---- gestos na grade: arrastar a capa para a direita = estrela; para a esquerda = dispensa (com desfazer) ----
  var gesto = null, engolirClique = false;
  $('conteudo').addEventListener('pointerdown', function (e) {
    var capa = e.target.closest('.grid .capa');
    if (!capa || e.button > 0 || e.target.closest('.fav,.inst')) return;
    gesto = { el: capa.closest('.card'), x: e.clientX, y: e.clientY, dx: 0, ativo: false, id: e.pointerId };
  });
  $('conteudo').addEventListener('pointermove', function (e) {
    if (!gesto || e.pointerId !== gesto.id) return;
    var dx = e.clientX - gesto.x, dy = e.clientY - gesto.y;
    if (!gesto.ativo) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { gesto = null; return; }
      if (Math.abs(dx) < 14) return;
      gesto.ativo = true; gesto.el.classList.add('arrastando');
    }
    gesto.dx = dx;
    gesto.el.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 40) + 'deg)';
    gesto.el.dataset.gesto = dx > 60 ? 'estrela' : dx < -60 ? 'dispensa' : '';
  });
  function soltarGesto() {
    if (!gesto) return;
    var gs = gesto; gesto = null;
    if (!gs.ativo) return;
    engolirClique = true; setTimeout(function () { engolirClique = false; }, 300);
    gs.el.classList.remove('arrastando'); gs.el.style.transform = ''; delete gs.el.dataset.gesto;
    var id = gs.el.dataset.id, g = POR_ID[id];
    if (!g) return;
    if (gs.dx > 80) {
      var tinha = !!M.int[id];
      if (!tinha) marcar(id, 'int');
      aviso('★ Estrela em ' + g.n, tinha ? null : function () { if (M.int[id]) marcar(id, 'int'); });
    } else if (gs.dx < -80) {
      var antes = M.plano[id];
      if (antes !== 'nao') marcar(id, 'nao');
      aviso('✕ Dispensado: ' + g.n, function () { if (antes) M.plano[id] = antes; else delete M.plano[id]; salvar(); atualizarCardsDom(id); atualizarAbas(); });
    }
  }
  $('conteudo').addEventListener('pointerup', soltarGesto);
  $('conteudo').addEventListener('dragstart', function (e) { if (e.target.closest && e.target.closest('.capa')) e.preventDefault(); });
  $('conteudo').addEventListener('pointercancel', function () { if (gesto && gesto.el) { gesto.el.classList.remove('arrastando'); gesto.el.style.transform = ''; } gesto = null; });
  $('conteudo').addEventListener('click', function (e) { if (engolirClique) { e.stopPropagation(); e.preventDefault(); engolirClique = false; } }, true);

  // ---------------- eventos ----------------
  $('conteudo').addEventListener('click', function (e) {
    var v = e.target.closest('[data-ver]');
    if (v) { var p = v.dataset.ver.split(':'); abrirGrade({ t: p[0], k: p[1] }); return; }
    var b = e.target.closest('[data-acao]');
    if (!b) return;
    var c = b.closest('.card'), id = c && c.dataset.id;
    if (!id) return;
    if (b.dataset.acao === 'ver') {
      var sec = c.closest('[data-lista]');
      abrirFicha(id, V.modo === 'grade' ? ATUAL : sec ? LISTAS[sec.dataset.lista] || null : null);
    } else if (b.dataset.acao === 'pq') mostrarPq(c);
    else if (b.dataset.acao === 'voto') votar(id, +b.dataset.v);
    else marcar(id, b.dataset.acao);
  });
  // capa que não carregou: fica o bloco com a cor do gênero e o nome
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    if (/(^| )(ci|f-capa|t-img|f-fundo|t-fundo)( |$)/.test(t.className)) t.remove();
  }, true);

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-gen],[data-nv],[data-aba],[data-limpar],[data-tirar],[data-ordem],#gens-mais');
    if (!b || TT.contains(b) || dlg.contains(b) || folha.contains(b)) return;
    if (b.id === 'gens-mais') {
      gensAberto = !gensAberto;
      $('gens').classList.toggle('fechado', !gensAberto);
      b.setAttribute('aria-expanded', String(gensAberto));
      b.textContent = gensAberto ? 'Menos gêneros ▴' : 'Ver os ' + GEN_ORDER.length + ' gêneros ▾';
    } else if (b.hasAttribute('data-gen')) abrirGrade({ t: 'gen', k: b.dataset.gen });
    else if (b.hasAttribute('data-nv')) abrirGrade({ t: 'nivel', k: +b.dataset.nv });
    else if (b.dataset.aba) abrirGrade({ t: 'aba', k: b.dataset.aba });
    else if (b.dataset.tirar) tirarFiltro(b.dataset.tirar);
    else if (b.dataset.ordem) { F.ordem = b.dataset.ordem; desenhar(false); }
    else if (b.dataset.limpar) limpar();
  });
  $('b-voltar').addEventListener('click', function () { fecharCamada('grade'); });
  $('b-todos').addEventListener('click', function () { abrirGrade({ t: 'todos' }); });
  $('seg-pc').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pc]');
    if (!b || b.dataset.pc === F.pc) return;
    F.pc = b.dataset.pc; AJ.pc = F.pc; salvarAj();
    montarPCs(); redesenharFiltros(); atualizarDisco();
  });
  $('b-filtros').addEventListener('click', abrirFolha);
  $('mais').addEventListener('click', mostrarMais);
  $('b-tinder').addEventListener('click', abrirTinder);
  $('b-pravoce').addEventListener('click', function () { abrirGrade({ t: 'sec', k: 'para' }); });
  $('b-marc').addEventListener('click', function () { rolarPara($('marcacoes')); });
  $('b-pcs').addEventListener('click', function () { rolarPara($('painel-pc')); });
  $('b-sync').addEventListener('click', function () { rolarPara($('sync')); });
  $('b-capas2').addEventListener('click', abrirCapas);
  $('b-gosto').addEventListener('click', abrirGosto);
  $('b-roleta').addEventListener('click', abrirRoleta);
  $('b-mao').addEventListener('click', function () { AJ.mao = !AJ.mao; salvarAj(); pintarBotoesAj(); if (AJ.mao) aviso('🤚 Modo uma mão ligado: os botões aparecem embaixo quando você rola para cima.', null); });
  $('b-tamcapa').addEventListener('click', function () { AJ.capas = { p: 'm', m: 'g', g: 'p' }[AJ.capas || 'm']; salvarAj(); pintarBotoesAj(); });
  // atalhos: no celular os extras ficam atrás do "··· Mais" (como no Switch)
  function pintarAtalhos() {
    var nav = $('atalhos'), ab = nav.classList.contains('aberto');
    var n = nav.querySelectorAll('.at-extra:not([hidden])').length;
    $('b-at-mais').textContent = ab ? 'Menos ▴' : '··· Mais ' + n;
    $('b-at-mais').setAttribute('aria-expanded', String(ab));
  }
  $('b-at-mais').addEventListener('click', function () { $('atalhos').classList.toggle('aberto'); pintarAtalhos(); });
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

  // tema: segue o aparelho até alguém escolher; o botão alterna claro e escuro
  var mqEscuro = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function escuroAgora() { return AJ.tema === 'escuro' || (AJ.tema !== 'claro' && !!(mqEscuro && mqEscuro.matches)); }
  function aplicarTema() {
    var h = document.documentElement;
    if (AJ.tema === 'claro') h.dataset.theme = 'light'; else if (AJ.tema === 'escuro') h.dataset.theme = 'dark'; else delete h.dataset.theme;
    var esc_ = escuroAgora(), b = $('b-tema');
    b.setAttribute('aria-pressed', String(!esc_));
    b.textContent = esc_ ? '☀ Tema claro' : '🌙 Tema escuro';
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = esc_ ? '#0d1219' : '#eef1f5';
  }
  $('b-tema').addEventListener('click', function () { AJ.tema = escuroAgora() ? 'claro' : 'escuro'; salvarAj(); aplicarTema(); });
  if (mqEscuro && mqEscuro.addEventListener) mqEscuro.addEventListener('change', aplicarTema);

  document.addEventListener('keydown', function (e) {
    if (!TT.hidden && !dlg.open) {
      if (e.key === 'ArrowRight') { e.preventDefault(); decidirT('quero'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); decidirT('nao'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); decidirT('int'); }
      else if (e.key === 'Backspace') { e.preventDefault(); desfazerT(); }
      else if (e.key === 'Escape') { e.preventDefault(); fecharCamada('tinder'); }
      return;
    }
    if (dlg.open && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) {
      if (e.key === 'ArrowRight') { andarFicha(1); return; }
      if (e.key === 'ArrowLeft') { andarFicha(-1); return; }
    }
    if (e.key === '/' && !dlg.open && !dlgC.open && !folha.open && !/INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) {
      e.preventDefault(); $('q').focus();
    }
  });

  // "↑": aparece depois de rolar um pouco e leva de volta à busca (nada fica preso no topo)
  var bSubir = $('b-subir'), subirPend = false;
  window.addEventListener('scroll', function () {
    if (subirPend) return;
    subirPend = true;
    setTimeout(function () { subirPend = false; bSubir.hidden = window.scrollY < 700; }, 150);
  }, { passive: true });
  bSubir.addEventListener('click', function () { window.scrollTo(0, 0); });

  // ---------------- início ----------------
  // o app sempre abre no catálogo completo: busca e filtros começam vazios (o navegador às vezes devolve o texto da busca)
  $('q').value = '';
  if (!podeSalvar) $('aviso-salvar').hidden = false;
  $('n-gens').textContent = GEN_ORDER.length;
  aplicarTema();
  montarMeta();
  montarPCs();
  montarAbas();
  atualizarDisco();
  desenhar(false);
  pintarAtalhos();
  pintarBotoesAj();
  // atalhos do ícone do app (manifest: ?abrir=tinder | roleta | buscar)
  (function () {
    var m = /[?&]abrir=(\w+)/.exec(location.search), q = m && m[1];
    if (!q) return;
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    if (q === 'buscar') { setTimeout(function () { $('q').focus(); }, 300); return; }
    (function esperar() {
      if (fila.length || !JOGOS.length) { setTimeout(esperar, 300); return; }
      setTimeout(function () { if (q === 'tinder') abrirTinder(); else if (q === 'roleta') abrirRoleta(); }, 700);
    })();
  })();
  if (window.MutationObserver) new MutationObserver(pintarAtalhos).observe($('atalhos'), { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  if (!ARQS.length) $('mostrando').textContent = 'Nenhum arquivo de dados encontrado.';
  pedirLista();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  // ---------------- ganchos para a sincronização (bloco 1.8) e para os testes ----------------
  window.ESTANTE_PC = {
    // a nuvem mudou as marcações: relê do localStorage e redesenha, sem recarregar a página
    recarregarMarcas: function () {
      var n = lerJSON(CHAVE, {});
      M.int = n.int || {}; M.inst = n.inst || {}; M.plano = n.plano || {}; M.voto = n.voto || {}; M.gosto = n.gosto || {};
      recalcGosto();
      if (V.modo === 'catalogo') comAncora(function () { desenhar(true); }); else desenhar(true);
      atualizarDisco(); atualizarAbas();
      if (dlg.open && fichaId != null && POR_ID[fichaId]) {
        var p = dlg.querySelector('.planos');
        if (p) p.outerHTML = planosHTML(POR_ID[fichaId]);
      }
    },
    marcar: function (id, k) { marcar(String(id), k); }, // o mesmo caminho dos botões (usado nos testes)
    marcas: function () { return JSON.parse(JSON.stringify(M)); },
    // para os testes: estado e atalhos
    estado: function () { return { jogos: JOGOS.length, fila: fila.length, modo: V.modo, fonte: V.fonte, F: JSON.parse(JSON.stringify(F)), atual: ATUAL.length }; },
    abrirGrade: abrirGrade, abrirFicha: abrirFicha, abrirFolha: abrirFolha,
    filtro: function (k, v) { F[k] = v; redesenharFiltros(); },
    lista: function (fo) { var r = filtrar(fo || { t: 'todos' }); ordenar(r.lista, fo); return r.lista.map(function (g) { return [g.i, g.n, pvDe(g), corDe(g), g.g]; }); },
    gosto: function () { var d = 0, ex = []; JOGOS.forEach(function (g) { if (g._px && !g.x && g._pv !== g.pv) { d++; if (ex.length < 5) ex.push([g.n, g.pv, g._pv, g._s]); } }); return { diferentes: d, ex: ex }; },
    votar: votar, abrirGosto: abrirGosto, abrirRoleta: abrirRoleta, linhaPq: function (id) { return linhaPq(POR_ID[id]); }
  };
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
    // 1.10: "Me ensina" (vt|id = 1 ou -1) e "Ajustar o gosto" (gs|grupo = peso)
    Object.keys(o.voto || {}).forEach(function (id) { if (o.voto[id] === 1 || o.voto[id] === -1) r['vt|' + id] = o.voto[id]; });
    Object.keys(o.gosto || {}).forEach(function (k) { if (typeof o.gosto[k] === 'number') r['gs|' + k] = o.gosto[k]; });
    return r;
  }
  function montar(vivos) {
    var o = { int: {}, inst: {}, plano: {}, voto: {}, gosto: {} };
    Object.keys(vivos).forEach(function (s) {
      var i = s.indexOf('|'), tipo = s.slice(0, i), id = s.slice(i + 1);
      if (tipo === 'int') o.int[id] = 1;
      else if (tipo === 'inst') o.inst[id] = 1;
      else if (tipo === 'pl' && PLANOS[vivos[s]]) o.plano[id] = vivos[s];
      else if (tipo === 'vt' && (+vivos[s] === 1 || +vivos[s] === -1)) o.voto[id] = +vivos[s];
      else if (tipo === 'gs' && !isNaN(+vivos[s])) o.gosto[id] = +vivos[s];
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
