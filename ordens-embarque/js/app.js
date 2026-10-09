/* Arauco · Ordens de Embarque — lista diária, ordem por transporte e impressão
   dos check-lists oficiais (veículo + carga) preenchidos.
   Lógica espelhada da planilha LOG-AGENDAMENTO (guias LOG, SEW, Controle OT,
   CKL e Check Vc). Dados ficam somente no navegador (localStorage). */
(function () {
  'use strict';
  const P = window.OEP;
  const TPL = window.ORDEM_TEMPLATES;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtNum = (n, d = 2) => (n == null || !isFinite(n)) ? '' : n.toLocaleString('pt-BR', { maximumFractionDigits: d });

  // ------------------------------------------------------------------ estado
  const STORE_KEY = 'arauco.ordensEmbarque.v1';
  const emptyState = () => ({ v: 1, items: {}, sew: [], fsc: {}, manual: {}, printed: {}, snap: {}, faturado: {}, ots: {}, pesos: {}, tickets: {} });
  let state = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && s.v === 1) return Object.assign(emptyState(), s); } catch (e) { /* sem storage */ }
    return emptyState();
  }
  let saveTimer = null;
  function save(now) {
    clearTimeout(saveTimer);
    const pr = document.getElementById('print-root'); if (pr && !printing) pr.dataset.key = ''; // dados mudaram
    const run = () => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { toast('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado).', 'err'); }
      if (sync) sync.changed(); // grava também no arquivo compartilhado
    };
    if (now) run(); else saveTimer = setTimeout(run, 250);
  }
  let printing = false;
  let sync = null;
  const ui = { date: '', janela: 'ALL', q: '', selected: new Set(), open: null, view: 'lista', agMode: 'auto' };

  // campos do transporte que podem ser corrigidos/preenchidos à mão
  const OVERRIDABLE = ['data', 'hora', 'cliente', 'entrega', 'incoterm', 'motorista', 'cpf', 'transportadora', 'placaL', 'placaM', 'tipoVeiculo', 'treinamento'];
  // campos da guia "Controle OT"
  const OT_FIELDS = [
    ['ot', 'OT'], ['doc', 'Doc'], ['nf', 'NF-e (fatura a ordem)'], ['tara', 'Tara container'], ['mwg', 'Peso máx. (MWG)'],
    ['exp', 'EXP'], ['container', 'Nº container'], ['lacre', 'Lacre'], ['ticket', 'Ticket balança (Nº seq.)'],
  ];
  const REQUIRED = [['data', 'Data'], ['motorista', 'Motorista'], ['cpf', 'CPF'], ['transportadora', 'Transportadora'], ['placaL', 'Placa (carreta/truck)']];

  // ------------------------------------------------------------------ regras (espelho das fórmulas da planilha)
  const isTruck = e => !e.placaM || e.placaM === '-';
  function sewMatch(e) {
    const p = P.plate7(e.placaL); if (!p) return null;
    const hits = state.sew.filter(s => P.plate7(s.carreta) === p);
    if (!hits.length) return null;
    // LOG!AI: placa da carreta na janela de containers => CONTAINER
    const sameDay = hits.filter(s => s.data === e.data);
    let pool = sameDay.length ? sameDay : hits;
    const ativos = pool.filter(s => !s.removed); if (ativos.length) pool = ativos;
    return pool.find(s => s.janela === 'CONTAINER') || pool[0];
  }
  // identidade de um agendamento na tela do SEW: janela + dia + senha
  const sewKey = e => e.carregamento ? `sol|${e.carregamento}` : [e.janela, e.data, e.senha || (e.hora + '|' + P.plate7(e.carreta))].join('|');
  const SEW_TRACK = [['hora', 'Hora'], ['carreta', 'Carreta'], ['cavalo', 'Cavalo'], ['cpf', 'CPF'], ['container', 'Container'], ['transportadora', 'Transportadora'], ['tipoVeiculo', 'Tipo de veículo'], ['cliente', 'Cliente']];
  // campos impressos que, se mudarem depois da impressão, deixam a ordem "com alterações"
  const SNAP_FIELDS = [['data', 'Data'], ['motorista', 'Motorista'], ['cpf', 'CPF'], ['transportadora', 'Transportadora'], ['truck', 'Placa truck'], ['carreta', 'Placa carreta'], ['cavalo', 'Placa cavalo'], ['janelaContainer', 'Janela container'], ['pallets', 'Pallets'], ['ot', 'OT'], ['fsc', 'FSC'], ['treinamento', 'Treinamento'], ['entregaTransporte', 'Entrega / transporte']];
  function snapshotOf(T) {
    const d = printData(T);
    const sw = T.sew && !T.sew.carregamento ? { key: sewKey(T.sew), hora: T.sew.hora, carreta: T.sew.carreta, cavalo: T.sew.cavalo, cpf: T.sew.cpf, container: T.sew.container } : null;
    return { campos: Object.fromEntries(SNAP_FIELDS.map(([k]) => [k, d[k] || ''])), sew: sw, hora: T.eff.hora };
  }
  function alteracoesDesdeImpressao(T) {
    const sn = state.snap[T.transporte]; if (!sn) return [];
    const out = []; const d = printData(T);
    SNAP_FIELDS.forEach(([k, l]) => { if (P.clean(sn.d.campos[k]) !== P.clean(d[k])) out.push({ campo: l, de: sn.d.campos[k], para: d[k] }); });
    if (P.clean(sn.d.hora) !== P.clean(T.eff.hora)) out.push({ campo: 'Hora do agendamento', de: sn.d.hora, para: T.eff.hora });
    if (sn.d.sew) {
      const cur = state.sew.find(e => sewKey(e) === sn.d.sew.key);
      if (!cur || cur.removed) out.push({ campo: 'Agendamento', de: `${sn.d.sew.hora} · ${sn.d.sew.carreta}`, para: 'removido do SEW' });
      else ['hora', 'carreta', 'cavalo', 'cpf', 'container'].forEach(k => {
        if (P.clean(cur[k]) !== P.clean(sn.d.sew[k]) && !out.some(o => o.campo === k)) out.push({ campo: { hora: 'Hora do agendamento', carreta: 'Carreta (agendamento)', cavalo: 'Cavalo (agendamento)', cpf: 'CPF (agendamento)', container: 'Container (agendamento)' }[k], de: sn.d.sew[k], para: cur[k] });
      });
    }
    // não repetir a mesma mudança vinda das duas fontes
    const seen = new Set(); return out.filter(o => { const k = o.campo.split(' ')[0] + '|' + P.clean(o.para); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  // Cliente FSC: relação pelo nome do cliente (a Solicitação não traz o código).
  // 1) nome igual  2) igual sem acentos/pontuação/LTDA/S.A.  3) nome cortado pelo SAP
  // (um começa com o outro, 12+ letras)  4) mesmas palavras (85%+ em comum).
  let fscIdx = null, fscIdxRef = null;
  function fscIndex() {
    if (fscIdxRef === state.fsc && fscIdx) return fscIdx;
    fscIdxRef = state.fsc;
    fscIdx = Object.entries(state.fsc).map(([k, v]) => ({ k, v, chave: P.nomeChave(v.nome || k), tok: new Set(P.nomeTokens(v.nome || k)) }));
    return fscIdx;
  }
  function fscOf(cliente) {
    const n = P.norm(cliente); if (!n) return null;
    const ok = v => (v && v.ativo !== false ? v : null);
    if (state.fsc[n]) return ok(state.fsc[n]);
    const idx = fscIndex(); const ch = P.nomeChave(cliente);
    let hit = idx.find(x => x.chave === ch);
    if (!hit && ch.length >= 12) hit = idx.find(x => x.chave.length >= 12 && (x.chave.startsWith(ch) || ch.startsWith(x.chave)));
    if (!hit) {
      const t = new Set(P.nomeTokens(cliente));
      if (t.size >= 2) {
        let best = null, bs = 0;
        idx.forEach(x => { const inter = [...t].filter(w => x.tok.has(w)).length; const sc = inter / Math.max(t.size, x.tok.size); if (sc > bs) { bs = sc; best = x; } });
        if (bs >= 0.85) hit = best;
      }
    }
    return hit ? ok(hit.v) : null;
  }
  function treino(e) {
    const s = P.norm(e.treinamento), y = P.norm(e.cpfStatus);
    if (s.includes('NUNCA')) return { k: 'err', label: 'Nunca treinado' };
    if (y.includes('EXPIRADO')) return { k: 'warn', label: 'Treinamento expirado' };
    if (s) return { k: 'ok', label: 'Treinado' };
    return { k: 'grey', label: 'Sem informação' };
  }
  function makeTransport(t, items) {
    items = items.slice().sort((a, b) => String(a.agItem || a.pedido).localeCompare(String(b.agItem || b.pedido), undefined, { numeric: true }));
    const f = items[0] || {};
    const man = state.manual[t] || {};
    const base = {};
    OVERRIDABLE.forEach(k => base[k] = f[k] == null ? '' : f[k]);
    base.cpfStatus = f.cpfStatus || '';
    base.obs = f.obs || '';
    const eff = Object.assign({}, base);
    OVERRIDABLE.forEach(k => { if (man[k] != null && man[k] !== '') eff[k] = man[k]; });
    let pallets = 0, palletsOk = true;
    const mats = items.map(it => {
      const mi = P.matInfo(it.descricao);
      const pal = (it.qtd != null && mi.pecasPallet) ? it.qtd / mi.pecasPallet : null;
      if (pal == null) palletsOk = false; else pallets += pal;
      return Object.assign({}, it, { mi, pallets: pal });
    });
    const sew = sewMatch(eff);
    const janelaAuto = f.janela || (sew ? sew.janela : 'MI'); // Origem da Solicitação de Embarque tem prioridade
    const janela = man.janela || janelaAuto;
    // FSC: automático pela lista de clientes, ou forçado no painel (Sim/Não)
    const fscAuto = fscOf(eff.cliente);
    const fsc = man.fscSel === 'NAO' ? null : (man.fscSel === 'SIM' ? (fscAuto || { fsc: 'FSC', claim: '', nome: eff.cliente }) : fscAuto);
    const ot = Object.fromEntries(OT_FIELDS.map(([k]) => [k, man[k] || '']));
    // OT da tela LT22 (pela entrega), como o PROCV da guia Controle OT
    const entregas = Array.from(new Set(items.map(i => i.entrega).concat(eff.entrega).filter(Boolean)));
    const otsMem = Array.from(new Set([].concat(...entregas.map(en => (state.ots[en] && state.ots[en].ots) || []))));
    let otSrc = man.ot ? 'manual' : '';
    if (!ot.ot && otsMem.length) { ot.ot = otsMem.join(' / '); otSrc = 'LT22'; }
    const otList = String(ot.ot || '').split(/[\/,;\s]+/).map(x => x.trim()).filter(Boolean);
    if (!ot.container && f.container) ot.container = f.container;
    if (!ot.container && sew && sew.container) ot.container = sew.container;
    const missing = REQUIRED.filter(([k]) => !P.clean(eff[k])).map(([, l]) => l);
    return {
      transporte: t, items: mats, base, eff, man, sew, janela, janelaSrc: man.janela ? 'manual' : (f.janela ? 'Solicitação de Embarque' : (sew ? 'SEW' : 'padrão')),
      solic: f.fonte === 'Solicitação de Embarque' ? f : null,
      fsc, fscAuto, ot, otSrc, otList, entregas, pallets: mats.length && palletsOk ? pallets : (pallets || null), missing, treino: treino(eff),
      printed: state.printed[t] || null, faturado: state.faturado[t] || null, manualOnly: items.every(i => i.manualOnly),
    };
  }
  function withAlt(T) { T.alteracoes = T.printed ? alteracoesDesdeImpressao(T) : []; return T; }
  function allTransports() {
    const g = new Map();
    Object.values(state.items).forEach(it => { if (!g.has(it.transporte)) g.set(it.transporte, []); g.get(it.transporte).push(it); });
    return Array.from(g, ([t, items]) => withAlt(makeTransport(t, items)));
  }
  const getTransport = t => { const items = Object.values(state.items).filter(i => i.transporte === t); return items.length ? withAlt(makeTransport(t, items)) : null; };

  // quantidade ÷ peças por lote dá número quebrado (moldura ou qualquer material), em algum item ou no total
  const quebrado = x => x != null && Math.abs(x - Math.round(x)) > 1e-6;
  const isFracionada = T => T.items.some(i => quebrado(i.pallets)) || quebrado(T.pallets);
  // dados que vão para as células dos check-lists (mesmas fórmulas de CKL / Check Vc)
  function printData(T) {
    const e = T.eff, truck = isTruck(e), cont = T.janela === 'CONTAINER';
    const pal = T.pallets;
    const palTxt = pal == null ? '' : fmtNum(pal, 2);
    return {
      data: P.fmtDateBR(e.data),
      motorista: e.motorista,
      cpf: P.fmtCPF(e.cpf),
      transportadora: e.transportadora,
      truck: truck ? e.placaL : '',
      carreta: truck ? '' : e.placaL,
      cavalo: truck ? '' : e.placaM,
      naContainer: cont || isCabotagem(T) ? 'N/A' : '', // cabotagem também é container
      pallets: palTxt,
      // ao lado da quantidade de lotes (C23): carga fracionada e/ou aviso de amostra
      fracionada: [isFracionada(T) ? 'carga fracionada' : '', isAmostra(T) ? 'Amostra-conferir cliente' : ''].filter(Boolean).join(' · '),
      fscClaim: T.fsc ? T.fsc.claim : '',
      otQr: T.otList[0] || '',
      ot: T.otList.join('\n'), // várias OTs: uma por linha no campo OT
      fsc: T.fsc ? T.fsc.fsc : '',
      janelaContainer: destaque(T, cont),
      treinamento: e.treinamento,
      cpfTreinamento: /EXPIRADO/i.test(e.cpfStatus) && !T.man.cpf ? e.cpfStatus : P.fmtCPF(e.cpf),
      entregaTransporte: [e.entrega, T.transporte].filter(Boolean).join(' / '),
    };
  }

  // Texto grande em "Disposição dos pallets" (célula A41 da carga):
  // ARAUCO MADERAS / MADERAS ARAUCO => EXPORTAÇÃO TERRESTRE; todos 30% transparentes (ficam sobre o desenho da carreta); material "EB/" => BREAKBULK;
  // container na janela de mercado interno => CABOTAGEM; janela de containers => CONTAINER.
  const isAraucoMaderas = T => /ARAUCO\s+MADERAS|MADERAS\s+ARAUCO/.test(P.norm(T.eff.cliente)); // inclui "MADERAS ARAUCO S.A."
  // "amostra" na carga: descrição / texto comercial do material ou observação
  const isAmostra = T => /\bAMOSTRAS?\b/.test(P.norm([T.eff.obs, ...T.items.map(i => [i.descricao, i.textoComercial, i.obs].join(' '))].join(' ')));
  const isBreakbulk = T => T.items.some(i => /EB\//i.test(i.descricao || ''));
  // Container agendado na janela de MERCADO INTERNO (PIÊN PAINÉIS): nº de container na
  // Solicitação / agendamento / Controle OT, ou tipo de veículo de container.
  const RE_CONT = /CONTAINER|CONTEINER|PORTA.?CONT/;
  const isCabotagem = T => T.janela !== 'CONTAINER' && (!!P.clean(T.ot.container) ||
    RE_CONT.test(P.norm(T.eff.tipoVeiculo)) || (!!T.sew && T.sew.janela === 'MI' && (!!P.clean(T.sew.container) || RE_CONT.test(P.norm(T.sew.tipoVeiculo)))));
  function destaque(T, cont) {
    if (isAraucoMaderas(T)) return 'EXPORTAÇÃO TERRESTRE';
    if (isBreakbulk(T)) return 'BREAKBULK';
    if (isCabotagem(T)) return 'CABOTAGEM';
    return cont ? 'CONTAINER' : '';
  }

  // ------------------------------------------------------------------ textos para copiar (guia Controle OT)
  const stripPlate = p => P.clean(p).toUpperCase().replace(/[\s()\-]/g, '');
  function placasTexto(e) {
    if (isTruck(e)) return stripPlate(e.placaL);
    return `${stripPlate(e.placaM)}/${P.plate7(e.placaL)}${P.plateUF(e.placaL)}`;
  }
  function copyText(kind, T) {
    const e = T.eff, o = T.ot;
    if (kind === 'texto') {
      // Controle OT!F1:F4 — texto da NF-e
      return { text: [`EXP ${o.exp}`, `TARA ${o.tara}`, `Container ${o.container}`, `Lacre ${o.lacre}`].join('\n'), need: [['exp', 'EXP'], ['tara', 'Tara'], ['container', 'Container'], ['lacre', 'Lacre']].filter(([k]) => !o[k]).map(x => x[1]) };
    }
    if (kind === 'balanca') {
      // Controle OT!I2:U2 — verificação de pesagem na balança
      const row = [P.fmtDateBR(P.todayISO()), P.plate7(e.placaL), o.ticket, o.tara, o.mwg, '', '', '', '', '', o.container, o.lacre, o.nf];
      return { text: row.join('\t'), need: [['ticket', 'Ticket'], ['tara', 'Tara'], ['mwg', 'Peso máx.'], ['nf', 'NF-e']].filter(([k]) => !o[k]).map(x => x[1]) };
    }
    if (kind === 'placa') {
      // Controle OT!T3:T4 — "0001" e a placa da carreta com UF (ex.: AAA1234PR)
      const pl = P.plate7(e.placaL);
      return { text: `0001\n${pl}${P.plateUF(e.placaL)}`, need: [!pl && 'Placa', pl && !P.plateUF(e.placaL) && 'UF da placa'].filter(Boolean) };
    }
    // Controle OT!J3:J4 — só os valores (CPF e placas), sem rótulos, para o SAP
    return { text: `${P.cpfDigits(e.cpf)}\n${placasTexto(e)}`, need: [['cpf', 'CPF'], ['placaL', 'Placa']].filter(([k]) => !e[k]).map(x => x[1]) };
  }
  async function toClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (er) { ok = false; }
      ta.remove(); return ok;
    }
  }

  // ------------------------------------------------------------------ páginas impressas
  const FONT = {
    'Arial': "Arial,'Liberation Sans',Helvetica,sans-serif",
    'Calibri': "Calibri,Carlito,'Segoe UI',Arial,sans-serif",
    'Times New Roman': "'Times New Roman','Liberation Serif',Times,serif",
  };
  const JUST = { left: 'flex-start', general: 'flex-start', center: 'center', centerContinuous: 'center', right: 'flex-end', justify: 'flex-start', distributed: 'center' };
  const VAL = { top: 'flex-start', center: 'center', bottom: 'flex-end', justify: 'center', distributed: 'center' };
  function qrSvg(text) {
    if (!window.qrcode || !text) return '';
    try { const q = window.qrcode(0, 'M'); q.addData(String(text)); q.make(); return q.createSvgTag({ cellSize: 2, margin: 0, scalable: true }); } catch (e) { return ''; }
  }
  function buildPage(formKey, data) {
    const tpl = TPL[formKey];
    const page = document.createElement('div');
    page.className = 'page'; page.dataset.form = formKey;
    const img = document.createElement('img'); img.className = 'bg'; img.alt = ''; img.src = tpl.background; img.decoding = 'sync';
    page.appendChild(img);
    tpl.fields.forEach(f => {
      const val = data[f.key];
      if (val == null || val === '') return;
      const el = document.createElement('div');
      el.className = 'fld';
      const [a, b] = f.cell.split(':');
      if (a !== b) el.classList.add('clip');
      Object.assign(el.style, {
        left: f.x + 'pt', top: f.y + 'pt', width: f.w + 'pt', height: f.h + 'pt',
        fontFamily: FONT[f.font] || FONT.Arial, fontSize: f.size + 'pt', fontWeight: f.bold ? '700' : '400', color: f.color,
        justifyContent: JUST[f.align] || 'flex-start', alignItems: VAL[f.valign] || 'flex-end',
        textAlign: f.align === 'center' || f.align === 'centerContinuous' ? 'center' : (f.align === 'right' ? 'right' : 'left'),
      });
      if (f.key === 'otQr') {
        el.classList.add('qr'); el.innerHTML = qrSvg(val);
        const s = el.querySelector('svg'); if (s) { s.removeAttribute('width'); s.removeAttribute('height'); }
      } else {
        if (f.wrap) el.classList.add('wrap');
        if (f.key === 'janelaContainer') el.style.opacity = '0.7'; // texto sobre o desenho da carreta: 30% transparente
        if (String(val).includes('\n')) { el.classList.add('wrap', 'clip'); el.style.whiteSpace = 'pre-line'; el.style.lineHeight = '1.05'; }
        const sp = document.createElement('span');
        if (f.key === 'fracionada') // "carga fracionada" em tarja preta com letras brancas
          String(val).split(' · ').forEach((t, i) => { if (i) sp.append(' · '); const x = document.createElement('span'); x.textContent = t; if (t === 'carga fracionada') x.className = 'tarja'; sp.appendChild(x); });
        else sp.textContent = val;
        el.appendChild(sp);
      }
      el.dataset.size = f.size;
      page.appendChild(el);
    });
    return page;
  }
  // dado maior que a célula mesclada: reduz a fonte (nunca o formulário)
  function fitFields(root) {
    const measuring = root.id === 'print-root';
    if (measuring) root.classList.add('measuring');
    $$('.fld.clip > span, .fld.wrap > span', root).forEach(sp => {
      const el = sp.parentElement; let size = parseFloat(el.dataset.size); let guard = 0;
      while (guard++ < 40 && size > 3.5 && (sp.scrollWidth > el.clientWidth + 0.5 || sp.offsetHeight > el.clientHeight + 0.5)) {
        size *= 0.94; el.style.fontSize = size.toFixed(2) + 'pt';
      }
    });
    fitBig(root);
    if (measuring) root.classList.remove('measuring');
  }
  // exportação terrestre (Arauco Maderas) e breakbulk não levam romaneio de separação
  const comSeparacao = T => !(isAraucoMaderas(T) || isBreakbulk(T));
  const comIdentificador = T => T.janela === 'CONTAINER';
  function pagesFor(T, opts) {
    const d = printData(T);
    // mesma ordem da macro impress2026ordens: Check do veículo, depois Check da carga
    const pages = [buildPage('veiculo', d), buildPage('carga', d)];
    // exportação: formulário de separação (exceto exportação terrestre/breakbulk) e identificador da carga
    if (!opts || opts.extras !== false) {
      if (isExport(T) && comSeparacao(T)) pages.push(buildSeparacao(T));
      if (comIdentificador(T)) pages.push(buildIdentificador(T)); // identificador só para container
    }
    return pages;
  }

  // ------------------------------------------------------------------ exportação: separação + identificador
  // exportação = janela de containers, Arauco Maderas (terrestre), breakbulk ou material de exportação (P/E…)
  const isExport = T => T.janela === 'CONTAINER' || isAraucoMaderas(T) || isBreakbulk(T) || T.items.some(i => i.mi && i.mi.mercado === 'Exportação');
  const fmtContainer = c => { const x = P.clean(c).toUpperCase().replace(/\s+/g, ''); const m = x.match(/^([A-Z]{4})(\d{6})(\d)$/); return m ? `${m[1]} ${m[2]}-${m[3]}` : x; };
  const logoSrc = () => { const i = document.querySelector('.brand-logo'); return i ? i.src : ''; };
  function linhasSeparacao(T) {
    // linhas da LT22 (OT · posição · qtd) das entregas do transporte; senão, os itens da ordem
    const lt = [].concat(...T.entregas.map(en => (state.ots[en] && state.ots[en].itens) || []));
    if (lt.length) return lt.map(r => ({ ot: r.ot, material: r.material, texto: r.texto || ((T.items.find(i => i.material === r.material) || {}).descricao || ''), tp: r.tpDep, pos: r.posicao, qtd: r.qtd }));
    return T.items.map(i => ({ ot: T.otList.join(' / '), material: i.material, texto: i.descricao, tp: '', pos: '', qtd: i.qtd, pallets: i.pallets }));
  }
  function buildSeparacao(T) {
    const e = T.eff, d = printData(T), sol = T.solic || {};
    const el = document.createElement('div'); el.className = 'sheet sheet-sep'; el.dataset.wpt = '595.3'; el.dataset.hpt = '841.9';
    const linhas = linhasSeparacao(T);
    const totQtd = linhas.reduce((a, l) => a + (l.qtd || 0), 0);
    const tipo = d.janelaContainer || (T.janela === 'CONTAINER' ? 'CONTAINER' : 'EXPORTAÇÃO');
    const cel = (l, v, big) => `<div class="sp-cel${big ? ' big' : ''}"><span>${esc(l)}</span><b>${esc(v || '—')}</b></div>`;
    el.innerHTML = `
      <div class="sp-head">
        <img src="${logoSrc()}" alt="Arauco">
        <div class="sp-title"><div>SEPARAÇÃO DE CARGA</div><small>EXPORTAÇÃO · ${esc(tipo)}</small></div>
        <div class="sp-tr"><span>DATA</span><b>${esc(P.fmtDateBR(e.data))}</b><small>${esc(e.hora || '--:--')}</small></div>
      </div>
      <div class="sp-key">
        <div class="sp-ot"><span>OT${T.otList.length > 1 ? 's' : ''}</span>${T.otList.length ? T.otList.slice(0, 3).map(o => `<div class="sp-otq"><i>${qrSvg(o)}</i><b>${esc(o)}</b></div>`).join('') + (T.otList.length > 3 ? `<small>+ ${esc(T.otList.slice(3).join(' / '))}</small>` : '') : '<b>—</b>'}</div>
        <div class="sp-big"><span>TRANSPORTE</span><b data-fit="30">${esc(T.transporte)}</b></div>
        <div class="sp-big"><span>CONTAINER</span><b data-fit="30">${esc(fmtContainer(T.ot.container) || '—')}</b></div>
      </div>
      <div class="sp-grid">
        ${cel('Cliente', e.cliente)}${cel('Destino', sol.cidade ? `${sol.cidade}/${sol.uf}` : '')}${cel('Entrega(s)', T.entregas.join(' / '))}${cel('Horário', e.hora)}
        ${cel('Lacre', T.ot.lacre, 1)}${cel('Tara', T.ot.tara)}${cel('Peso máx. (MWG)', T.ot.mwg)}${cel('Tipo de carga', tipo)}
        ${cel('Placa carreta', isTruck(e) ? e.placaL + ' (truck)' : e.placaL)}${cel('Placa cavalo', isTruck(e) ? '' : e.placaM)}${cel('Motorista', e.motorista)}${cel('Transportadora', e.transportadora)}
        ${cel('Pallets / lotes', d.pallets)}${cel('Peso da carga', sol.peso ? fmtNum(sol.peso, 0) + ' kg' : '')}${cel('Incoterm', e.incoterm)}${cel('FSC', T.fsc ? (T.fsc.fsc || 'FSC') : 'Não')}
      </div>
      ${isAmostra(T) ? '<div class="sp-alert">ATENÇÃO: AMOSTRA — CONFERIR CLIENTE</div>' : ''}
      <table class="sp-tab"><thead><tr><th>OT</th><th>Material</th><th>Descrição</th><th>Tp.</th><th>Posição</th><th class="n">Qtd</th><th class="ck">Separado</th><th class="ck">Conferido</th></tr></thead>
      <tbody>${linhas.map(l => `<tr><td>${esc(l.ot)}</td><td>${esc(l.material)}</td><td class="tx">${esc(l.texto)}</td><td>${esc(l.tp)}</td><td><b>${esc(l.pos)}</b></td><td class="n">${fmtNum(l.qtd, 0)}</td><td class="ck">☐</td><td class="ck">☐</td></tr>`).join('')}
        ${Array.from({ length: Math.max(0, 6 - linhas.length) }, () => '<tr class="vazia"><td></td><td></td><td></td><td></td><td></td><td></td><td class="ck">☐</td><td class="ck">☐</td></tr>').join('')}</tbody>
      <tfoot><tr><td colspan="5">Total${isFracionada(T) ? ' <span class="tarja">carga fracionada</span>' : ''}${isAmostra(T) ? ' · Amostra-conferir cliente' : ''}</td><td class="n">${fmtNum(totQtd, 0)}</td><td colspan="2"></td></tr></tfoot></table>
      <div class="sp-sign">
        <div><span>Separador</span><i></i><em>Início ___:___ &nbsp; Fim ___:___</em></div>
        <div><span>Operador de empilhadeira</span><i></i><em>Início ___:___ &nbsp; Fim ___:___</em></div>
        <div><span>Conferente</span><i></i><em>Data ___/___/______</em></div>
      </div>
      <div class="sp-obs"><span>Observações</span></div>
      <div class="sp-foot">Arauco · Expedição Piên · gerado em ${esc(new Date().toLocaleString('pt-BR'))}</div>`;
    return el;
  }
  function buildIdentificador(T) {
    const e = T.eff, d = printData(T);
    const el = document.createElement('div'); el.className = 'sheet sheet-id'; el.dataset.wpt = '841.9'; el.dataset.hpt = '595.3';
    const cont = fmtContainer(T.ot.container);
    const tipo = d.janelaContainer || (T.janela === 'CONTAINER' ? 'CONTAINER' : 'EXPORTAÇÃO');
    const box = (l, v, max) => `<div class="id-box"><span>${esc(l)}</span><b data-fit="${max}">${esc(v || '—')}</b></div>`;
    el.innerHTML = `
      <div class="id-top"><img src="${logoSrc()}" alt="Arauco"><div class="id-kind">${esc(tipo)}</div><div class="id-date">${esc(P.fmtDateBR(e.data))}</div></div>
      <div class="id-main"><span>${cont ? 'CONTAINER' : 'TIPO DE CARGA'}</span><b data-fit="175">${esc(cont || tipo)}</b></div>
      <div class="id-main id-tr"><span>TRANSPORTE</span><b data-fit="190">${esc(T.transporte)}</b></div>
      <div class="id-row">
        ${box('PLACA CARRETA', isTruck(e) ? e.placaL : P.plate7(e.placaL) + (P.plateUF(e.placaL) ? ' ' + P.plateUF(e.placaL) : ''), 46)}
        ${box('HORÁRIO', e.hora, 46)}
        ${box('OT', T.otList.join(' / '), 40)}
        ${box('LACRE', T.ot.lacre, 40)}
      </div>
      <div class="id-cli"><span>CLIENTE</span><b data-fit="26">${esc(e.cliente)}${T.solic && T.solic.cidade ? ` · ${esc(T.solic.cidade)}/${esc(T.solic.uf)}` : ''}</b></div>`;
    return el;
  }
  // textos grandes do identificador: maior fonte que cabe na largura
  function fitBig(root) {
    $$('[data-fit]', root).forEach(b => {
      let size = parseFloat(b.dataset.fit); b.style.fontSize = size + 'pt'; let g = 0;
      while (g++ < 60 && size > 8 && b.scrollWidth > b.clientWidth + 1) { size *= 0.94; b.style.fontSize = size.toFixed(1) + 'pt'; }
    });
  }
  const waitImages = root => Promise.all($$('img', root).map(img =>
    (img.complete && img.naturalWidth ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; }))
      .then(() => img.decode ? img.decode().catch(() => {}) : null)));

  async function printTransports(list) {
    if (!list.length) return;
    const incompletos = list.filter(T => T.missing.length);
    if (incompletos.length) {
      const ok = await confirmBox('Dados obrigatórios faltando',
        `<p>Preencha os campos abaixo antes de imprimir:</p><ul>${incompletos.map(T => `<li><b>${esc(T.transporte)}</b>: ${esc(T.missing.join(', '))}</li>`).join('')}</ul><p class="muted">Deseja imprimir mesmo assim?</p>`, 'Imprimir assim mesmo');
      if (!ok) { if (incompletos.length === 1) openDetail(incompletos[0].transporte); return; }
    }
    const root = $('#print-root');
    root.innerHTML = '';
    root.dataset.key = list.map(T => T.transporte).join(',');
    list.forEach(T => pagesFor(T).forEach(p => root.appendChild(p)));
    await waitImages(root);
    fitFields(root);
    printing = true;
    window.print();
    printing = false;
    const now = new Date().toISOString();
    list.forEach(T => { state.printed[T.transporte] = now; state.snap[T.transporte] = { at: now, d: snapshotOf(T) }; });
    save(true);
    renderAll();
    const nSep = list.filter(T => isExport(T) && comSeparacao(T)).length, nId = list.filter(comIdentificador).length;
    const ext = [nSep && `separação de ${nSep}`, nId && `identificador de ${nId} container(s)`].filter(Boolean).join(', ');
    toast(`${list.length} ordem(ns) enviada(s) para impressão — ${root.children.length} página(s)${ext ? ` (inclui ${ext})` : ''}.`, 'ok');
  }
  // imprime só a separação ou só o identificador (não marca a ordem como impressa)
  async function imprimirAvulso(pages) {
    const root = $('#print-root');
    root.innerHTML = ''; root.dataset.key = 'avulso';
    pages.forEach(p => root.appendChild(p));
    await waitImages(root); fitFields(root);
    printing = true; window.print(); printing = false;
  }
  window.addEventListener('beforeprint', () => {
    // Ctrl+P do navegador: imprime a ordem aberta (nunca uma página em branco)
    if (printing) return;
    const root = $('#print-root');
    const T = ui.open && getTransport(ui.open);
    if (!T || (root.dataset.key === T.transporte && root.children.length)) return;
    root.innerHTML = '';
    root.dataset.key = T.transporte;
    pagesFor(T).forEach(p => root.appendChild(p)); fitFields(root);
  });

  // ------------------------------------------------------------------ renderização
  function janelaChip(T) {
    const c = T.janela === 'CONTAINER';
    const amostra = isAmostra(T) ? ' <span class="chip warn">Amostra</span>' : '';
    const extra = amostra + (isAraucoMaderas(T) ? ' <span class="chip grey">Exp. terrestre</span>' : (isBreakbulk(T) ? ' <span class="chip grey">Breakbulk</span>' : (isCabotagem(T) ? ' <span class="chip ct">Cabotagem</span>' : '')));
    return extra + `<span class="chip ${c ? 'ct' : 'mi'}" title="Origem: ${esc(T.janelaSrc)}"><span class="dot"></span>${c ? 'Container' : 'Mercado interno'}</span>`;
  }
  function statusChip(T) {
    if (T.faturado) return `<span class="chip fat" title="Faturada em ${esc(new Date(T.faturado).toLocaleString('pt-BR'))}">Faturada</span>`;
    if (T.printed && T.alteracoes.length) return `<span class="chip alt" title="${esc(T.alteracoes.map(a => `${a.campo}: ${a.de || '—'} → ${a.para || '—'}`).join('\n'))}">Com alterações</span>`;
    if (T.printed) return `<span class="chip imp" title="Impressa em ${esc(new Date(T.printed).toLocaleString('pt-BR'))}"><svg viewBox="0 0 24 24"><path d="M5 12l4 4L19 6"/></svg>Impressa ${esc(new Date(T.printed).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}</span>`;
    if (T.missing.length) return `<span class="chip err" title="Falta: ${esc(T.missing.join(', '))}">Dados faltando</span>`;
    return `<span class="chip grey">Pronta p/ imprimir</span>`;
  }
  const treinoChip = T => `<span class="chip ${T.treino.k}">${esc(T.treino.label)}</span>`;
  function placasHTML(e) {
    if (isTruck(e)) return `<span class="mono">${esc(e.placaL)}</span><span class="sub">truck</span>`;
    return `<span class="mono">${esc(e.placaL)}</span><span class="sub">cavalo ${esc(e.placaM)}</span>`;
  }

  function visibleTransports() {
    const q = P.norm(ui.q);
    return allTransports()
      .filter(T => T.eff.data === ui.date)
      .filter(T => ui.janela === 'ALL' || T.janela === ui.janela)
      .filter(T => !q || P.norm([T.transporte, T.eff.cliente, T.eff.entrega, T.eff.motorista, T.eff.placaL, T.eff.placaM, T.eff.transportadora, T.ot.ot, T.items.map(i => i.descricao + ' ' + i.material).join(' ')].join(' ')).includes(q))
      // por horário; as já faturadas descem para o fim
      .sort((a, b) => (!!a.faturado - !!b.faturado) || (a.eff.hora || '99').localeCompare(b.eff.hora || '99') || a.transporte.localeCompare(b.transporte));
  }

  function renderKPIs(list) {
    const dayAll = allTransports().filter(T => T.eff.data === ui.date);
    const mi = dayAll.filter(T => T.janela !== 'CONTAINER').length, ct = dayAll.length - mi;
    const printed = dayAll.filter(T => T.printed).length;
    const pend = dayAll.filter(T => T.missing.length && !T.faturado).length;
    const tr = dayAll.filter(T => !T.faturado && (T.treino.k === 'err' || T.treino.k === 'warn')).length;
    const alt = dayAll.filter(T => T.printed && !T.faturado && T.alteracoes.length).length;
    const fat = dayAll.filter(T => T.faturado).length;
    $('#kpis').innerHTML = [
      ['Transportes', dayAll.length, P.fmtDateBR(ui.date), ''],
      ['Mercado interno', mi, 'janela PIÊN PAINÉIS', ''],
      ['Containers', ct, 'janela PIÊN CONTAINERS', 'lime'],
      ['Ordens impressas', `${printed}<span class="k-sub"> / ${dayAll.length}</span>`, `${dayAll.length - printed} a imprimir · ${fat} faturada(s)`, ''],
      ['Com alterações', alt, 'impressas com agendamento alterado', alt ? 'red' : 'grey'],
      ['Atenção', pend + tr, `${pend} com dados faltando · ${tr} treinamento`, 'lime'],
    ].map(([l, v, s, c]) => `<div class="card kpi ${c}" title="${esc(s)}"><div class="k-label">${l}</div><div class="k-val">${v}</div></div>`).join('');
  }

  // Agendamentos do dia (tela SEW) que ainda não têm ordem importada: viram linhas "fantasma".
  // Ligação pela placa da carreta no mesmo dia; com vários horários da mesma placa, a ordem
  // fica com o agendamento de horário mais próximo.
  const minutos = h => { const m = String(h || '').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
  function agendamentosSemOrdem() {
    const ags = state.sew.filter(e => !e.carregamento && !e.removed && e.data === ui.date);
    if (!ags.length) return [];
    const usados = new Set();
    allTransports().filter(T => T.eff.data === ui.date).forEach(T => {
      const p = P.plate7(T.eff.placaL); if (!p) return;
      const cands = ags.filter((e, i) => !usados.has(i) && P.plate7(e.carreta) === p).map(e => ags.indexOf(e));
      if (!cands.length) return;
      const mt = minutos(T.eff.hora);
      cands.sort((a, b) => Math.abs((minutos(ags[a].hora) ?? 0) - (mt ?? 0)) - Math.abs((minutos(ags[b].hora) ?? 0) - (mt ?? 0)));
      usados.add(cands[0]);
    });
    const q = P.norm(ui.q);
    return ags.filter((e, i) => !usados.has(i))
      .filter(e => ui.janela === 'ALL' || e.janela === ui.janela)
      .filter(e => !q || P.norm([e.carreta, e.cavalo, e.cpf, e.transportadora, e.cliente, e.container, e.senha, e.tipoVeiculo].join(' ')).includes(q));
  }
  function linhaAgendamento(e) {
    const ct = e.janela === 'CONTAINER';
    return `<tr class="ghost" data-ag="1" title="Agendamento sem ordem importada. Copie a Solicitação de Embarque no SEW e clique em Importar ordem.">
      <td class="c-check"></td>
      <td class="mono">${esc(e.hora)}</td>
      <td class="mono"><span class="muted">senha ${esc(e.senha || '—')}</span></td>
      <td><span class="chip ${ct ? 'ct' : 'mi'}"><span class="dot"></span>${ct ? 'Container' : 'Mercado interno'}</span></td>
      <td class="wrap" title="${esc(e.cliente)}">${esc(e.cliente)}</td>
      <td class="mono"></td>
      <td class="wrap" title="${esc(e.tipoVeiculo)}">${esc(e.tipoVeiculo)}</td>
      <td class="num">${e.volume ? fmtNum(e.volume, 3) : ''}</td>
      <td><span class="mono">${esc(e.carreta)}</span>${e.cavalo ? `<span class="sub">cavalo ${esc(e.cavalo)}</span>` : ''}</td>
      <td class="wrap"><span class="sub mono">${esc(e.cpf)}</span></td>
      <td></td>
      <td class="wrap" title="${esc(e.transportadora)}">${esc(e.transportadora)}</td>
      <td class="mono">${ct && e.container ? esc(e.container) : ''}</td>
      <td class="c-status"><span class="chip nimp">Não impressa</span></td>
      <td class="c-act"></td>
    </tr>`;
  }

  function renderList() {
    const list = visibleTransports();
    renderKPIs(list);
    const tb = $('#daily-table tbody');
    const fantasmas = agendamentosSemOrdem();
    const linhas = list.map(T => ({ hora: T.eff.hora, fat: !!T.faturado, html: null, T }))
      .concat(fantasmas.map(e => ({ hora: e.hora, fat: false, html: linhaAgendamento(e) })))
      // mesma regra da lista: por horário, faturadas no fim
      .sort((a, b) => (a.fat - b.fat) || (a.hora || '99').localeCompare(b.hora || '99'));
    tb.innerHTML = linhas.map(L => L.html || (T => {
      const e = T.eff; const first = T.items[0] || {};
      const more = T.items.length > 1 ? ` <span class="chip grey">+${T.items.length - 1}</span>` : '';
      return `<tr data-t="${esc(T.transporte)}" class="${ui.open === T.transporte ? 'active' : ''} ${T.printed && !T.faturado ? 'printed' : (!T.printed ? 'pendente' : '')} ${T.faturado ? 'faturada' : ''} ${T.printed && !T.faturado && T.alteracoes.length ? 'alterada' : ''}">
        <td class="c-check"><input type="checkbox" ${ui.selected.has(T.transporte) ? 'checked' : ''} aria-label="Selecionar ${esc(T.transporte)}"></td>
        <td class="mono">${esc(e.hora)}</td>
        <td class="mono"><b>${esc(T.transporte)}</b></td>
        <td>${janelaChip(T)}</td>
        <td class="wrap" title="${esc(e.cliente)}">${esc(e.cliente)}${T.fsc ? ` <span class="chip mi">FSC</span>` : ''}</td>
        <td class="mono">${esc(e.entrega)}</td>
        <td class="wrap" title="${esc(T.items.map(i => i.descricao).join('\n'))}">${esc(first.descricao || '')}${more}</td>
        <td class="num">${fmtNum(T.pallets, 2)}</td>
        <td>${placasHTML(e)}</td>
        <td class="wrap" title="${esc(e.motorista)}">${esc(e.motorista)}<span class="sub mono">${esc(P.fmtCPF(e.cpf))}</span></td>
        <td>${treinoChip(T)}</td>
        <td class="wrap" title="${esc(e.transportadora)}">${esc(e.transportadora)}</td>
        <td class="mono">${T.otList.map(esc).join('<br>')}${T.otList.length > 1 ? `<span class="sub">${T.otList.length} OTs</span>` : ''}</td>
        <td class="c-status">${statusChip(T)}</td>
        <td class="c-act"><button class="row-del" data-del="${esc(T.transporte)}" title="Excluir da lista"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></td>
      </tr>`;
    })(L.T)).join('');
    $('#empty-state').hidden = linhas.length > 0;
    $('#daily-table').style.display = linhas.length ? '' : 'none';
    $('#list-title').textContent = `Lista diária · ${P.fmtDateBR(ui.date)}`;
    const altN = list.filter(T => T.printed && !T.faturado && T.alteracoes.length).length;
    const ag = state.sew.filter(s => !s.carregamento && !s.removed && s.data === ui.date).length;
    $('#list-sub').textContent = `${list.length} ordem(ns)${fantasmas.length ? ` · ${fantasmas.length} agendamento(s) sem ordem importada` : ''}${ag ? ` · ${ag} agendamento(s) SEW` : ''}${altN ? ` · ${altN} impressa(s) com alterações` : ''} · faturadas ficam no fim da lista`;
    // seleção
    const vis = new Set(list.map(T => T.transporte));
    Array.from(ui.selected).forEach(t => { if (!vis.has(t)) ui.selected.delete(t); });
    $('#sel-count').textContent = ui.selected.size;
    $('#btn-print-selected').disabled = !ui.selected.size;
    $('#btn-fat-selected').disabled = !ui.selected.size;
    $('#btn-del-selected').disabled = !ui.selected.size;
    $('#check-all').checked = list.length > 0 && list.every(T => ui.selected.has(T.transporte));
    // datalist do campo Transporte
    const dl = $('#transporte-list');
    const ts = Array.from(new Set(Object.values(state.items).map(i => i.transporte))).sort().reverse().slice(0, 400);
    dl.innerHTML = ts.map(t => `<option value="${esc(t)}">`).join('');
  }

  // ------------------------------------------------------------------ relatório do dia (Excel / PDF / e-mail)
  const statusTexto = T => T.faturado ? 'Faturada' : (T.printed && T.alteracoes.length ? 'Com alterações' : (T.printed ? 'Ordem impressa' : (T.missing.length ? 'Dados faltando' : 'Aguardando impressão')));
  const REL_COLS = ['Hora', 'Transporte', 'Janela', 'Cliente', 'Entrega', 'Materiais', 'Qtd', 'Pallets', 'Placa carreta/truck', 'Placa cavalo', 'Motorista', 'Transportadora', 'OT', 'NF-e', 'Container', 'Lacre', 'Status'];
  function relatorio() {
    const list = allTransports().filter(T => T.eff.data === ui.date)
      .sort((a, b) => (a.eff.hora || '99').localeCompare(b.eff.hora || '99') || a.transporte.localeCompare(b.transporte));
    const rows = list.map(T => [T.eff.hora, T.transporte, T.janela === 'CONTAINER' ? 'Container' : (isCabotagem(T) ? 'Mercado interno (cabotagem)' : 'Mercado interno'), T.eff.cliente, T.entregas.join(' / '),
      T.items.map(i => i.descricao).filter(Boolean).join(' | '), T.items.reduce((a, i) => a + (i.qtd || 0), 0), T.pallets == null ? '' : Math.round(T.pallets * 100) / 100,
      T.eff.placaL, isTruck(T.eff) ? '' : T.eff.placaM, T.eff.motorista, T.eff.transportadora, T.otList.join(' / '), T.ot.nf, T.ot.container, T.ot.lacre, statusTexto(T)]);
    const c = f => list.filter(f).length;
    const resumo = [
      ['Transportes', list.length], ['Mercado interno', c(T => T.janela !== 'CONTAINER')], ['Containers', c(T => T.janela === 'CONTAINER')],
      ['Pallets', Math.round(list.reduce((a, T) => a + (T.pallets || 0), 0) * 10) / 10], ['Ordens impressas', c(T => T.printed)],
      ['Faturadas', c(T => T.faturado)], ['Com alterações', c(T => T.printed && !T.faturado && T.alteracoes.length)], ['Dados faltando', c(T => !T.faturado && T.missing.length)],
    ];
    return { list, rows, resumo, titulo: `Embarques do dia ${P.fmtDateBR(ui.date)} · Expedição Arauco Piên` };
  }
  // HTML com estilos embutidos: mantém a formatação ao colar no Outlook/Gmail
  function relatorioHTML(r) {
    const td = 'border:1px solid #D9D9D9;padding:4px 6px;font:12px Arial,sans-serif;color:#4A4A4A;vertical-align:top';
    const cor = st => ({ 'Faturada': '#7A7A7A', 'Com alterações': '#B4473B', 'Dados faltando': '#B4473B', 'Ordem impressa': '#3F8F6B' }[st] || '#4A4A4A');
    return `<div style="font:13px Arial,sans-serif;color:#4A4A4A">
      <div style="border-left:6px solid #B7D9D8;padding:6px 12px;margin-bottom:10px"><div style="font:bold 16px Arial,sans-serif;color:#4A4A4A">${esc(r.titulo)}</div>
      <div style="font:12px Arial,sans-serif;color:#7A7A7A">Gerado em ${esc(new Date().toLocaleString('pt-BR'))}</div></div>
      <table style="border-collapse:collapse;margin-bottom:12px"><tr>${r.resumo.map(([l, v]) => `<td style="${td};background:#F8F8F8;text-align:center;min-width:90px"><div style="font:bold 11px Arial,sans-serif;color:#7A7A7A;text-transform:uppercase">${esc(l)}</div><div style="font:bold 18px Arial,sans-serif;color:#4A4A4A">${esc(String(v).replace('.', ','))}</div></td>`).join('')}</tr></table>
      <table style="border-collapse:collapse"><thead><tr>${REL_COLS.map(h => `<th style="${td};background:#B7D9D8;color:#2f4f4e;font-weight:bold;text-align:left;white-space:nowrap">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${r.rows.map((row, i) => `<tr style="background:${i % 2 ? '#FAFAFA' : '#FFFFFF'}">${row.map((v, j) => `<td style="${td}${j === row.length - 1 ? `;font-weight:bold;color:${cor(v)}` : ''}${j === 6 || j === 7 ? ';text-align:right' : ''}">${esc(typeof v === 'number' ? fmtNum(v, 2) : v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function baixar(nome, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  function relatorioExcel(r) {
    const nome = `embarques-${ui.date}`;
    if (window.XLSX) {
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet([[r.titulo], []].concat(r.resumo));
      ws1['!cols'] = [{ wch: 22 }, { wch: 12 }];
      const ws2 = XLSX.utils.aoa_to_sheet([REL_COLS].concat(r.rows));
      ws2['!cols'] = REL_COLS.map((h, i) => ({ wch: [6, 11, 15, 32, 12, 45, 8, 8, 14, 14, 28, 28, 16, 10, 14, 13, 18][i] }));
      ws2['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r.rows.length, c: REL_COLS.length - 1 } }) };
      XLSX.utils.book_append_sheet(wb, ws2, 'Embarques'); XLSX.utils.book_append_sheet(wb, ws1, 'Resumo');
      XLSX.writeFile(wb, nome + '.xlsx');
      return 'xlsx';
    }
    // sem internet (biblioteca do Excel não carregou): CSV que o Excel abre direto
    const csv = [REL_COLS].concat(r.rows).map(row => row.map(v => { const t = typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(';')).join('\r\n');
    baixar(nome + '.csv', new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    return 'csv';
  }
  async function copiarHTML(html, texto) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([texto], { type: 'text/plain' }) })]);
      return true;
    } catch (e) {
      const div = document.createElement('div'); div.contentEditable = 'true'; div.innerHTML = html;
      Object.assign(div.style, { position: 'fixed', left: '-9999px', top: '0' }); document.body.appendChild(div);
      const rg = document.createRange(); rg.selectNodeContents(div); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rg);
      let ok = false; try { ok = document.execCommand('copy'); } catch (er) { ok = false; }
      sel.removeAllRanges(); div.remove(); return ok;
    }
  }
  const relatorioTexto = r => [r.titulo, '', ...r.resumo.map(([l, v]) => `${l}: ${String(v).replace('.', ',')}`)].join('\n');
  const EMAIL_KEY = 'arauco.ordensEmbarque.emailRelatorio';
  function abrirRelatorio() {
    const r = relatorio();
    $('#rel-title').textContent = r.titulo;
    try { $('#rel-to').value = localStorage.getItem(EMAIL_KEY) || ''; } catch (e) { /* sem storage */ }
    $('#rel-preview').innerHTML = r.rows.length ? relatorioHTML(r) : '<div class="alert warn">Nenhum transporte nesta data.</div>';
    $('#report-dialog').showModal();
  }
  function bindRelatorio() {
    $('#btn-report').addEventListener('click', abrirRelatorio);
    $('#rel-close').addEventListener('click', () => $('#report-dialog').close());
    $('#rel-to').addEventListener('change', e => { try { localStorage.setItem(EMAIL_KEY, e.target.value.trim()); } catch (er) { /* sem storage */ } });
    $('#rel-xlsx').addEventListener('click', () => { const t = relatorioExcel(relatorio()); toast(t === 'xlsx' ? 'Relatório baixado em Excel (.xlsx).' : 'Relatório baixado em .csv (abre no Excel). Sem internet, o .xlsx não está disponível.', 'ok'); });
    $('#rel-copy').addEventListener('click', async () => { const r = relatorio(); const ok = await copiarHTML(relatorioHTML(r), relatorioTexto(r)); toast(ok ? 'Relatório copiado — cole (Ctrl+V) no corpo do e-mail.' : 'Não foi possível copiar.', ok ? 'ok' : 'err'); });
    $('#rel-pdf').addEventListener('click', async () => {
      const r = relatorio(); const root = $('#print-root');
      root.innerHTML = `<div class="report-page">${relatorioHTML(r)}</div>`; root.dataset.key = 'relatorio';
      $('#report-dialog').close();
      printing = true; window.print(); printing = false;
    });
    $('#rel-mail').addEventListener('click', async () => {
      const r = relatorio();
      const ok = await copiarHTML(relatorioHTML(r), relatorioTexto(r));
      const to = $('#rel-to').value.trim();
      try { localStorage.setItem(EMAIL_KEY, to); } catch (e) { /* sem storage */ }
      const body = `${relatorioTexto(r)}\n\n${ok ? '(Cole aqui o relatório completo: Ctrl+V)' : ''}\n`;
      const para = to.split(/[;,\s]+/).filter(x => /^[^@\s]+@[^@\s]+$/.test(x)).join(',');
      window.location.href = `mailto:${para}?subject=${encodeURIComponent(r.titulo)}&body=${encodeURIComponent(body)}`;
      toast(ok ? 'E-mail aberto. O relatório completo já está copiado: clique no corpo do e-mail e pressione Ctrl+V. Para anexar a planilha, use "Baixar Excel".' : 'E-mail aberto (não foi possível copiar o relatório).', ok ? 'ok' : 'warn');
    });
  }

  // ------------------------------------------------------------------ faturamento / exclusão
  function setFat(ts, on, porNf) {
    const now = new Date().toISOString();
    state.fatNf = state.fatNf || {};
    ts.forEach(t => {
      if (!on) { delete state.faturado[t]; delete state.fatNf[t]; return; }
      if (state.faturado[t]) return;
      state.faturado[t] = now;
      if (porNf) state.fatNf[t] = true;
      // faturada: a OT some da tela do SAP. Ela fica gravada no transporte e a memória é liberada.
      const T = getTransport(t);
      if (T) {
        if (T.ot.ot && !(state.manual[t] || {}).ot) (state.manual[t] = state.manual[t] || {}).ot = T.ot.ot;
        T.entregas.forEach(en => { delete state.ots[en]; });
      }
    });
    save(true);
  }
  // NF-e informada => ordem faturada. Apagar a NF desfaz só o faturamento que veio dela.
  function aplicarNF(t, v) {
    const man = state.manual[t] || (state.manual[t] = {});
    v = P.clean(v);
    if (v) man.nf = v; else delete man.nf;
    if (v) setFat([t], true, true);
    else if ((state.fatNf || {})[t]) setFat([t], false);
    save(true);
  }
  async function excluirTransportes(ts) {
    if (!ts.length) return;
    const ok = await confirmBox('Excluir da lista diária', `<p>Excluir <b>${ts.length}</b> transporte(s) da lista?</p><p class="muted">${esc(ts.slice(0, 12).join(', '))}${ts.length > 12 ? '…' : ''}</p><p class="muted">Os dados digitados (Controle OT, correções) também são apagados. Para trazer de volta, cole a Solicitação de Embarque de novo.</p>`, 'Excluir');
    if (!ok) return;
    const set = new Set(ts);
    Object.values(state.items).forEach(i => { if (set.has(i.transporte)) delete state.items[i.key]; });
    ts.forEach(t => { delete state.manual[t]; delete state.printed[t]; delete state.snap[t]; delete state.faturado[t]; if (state.fatNf) delete state.fatNf[t]; ui.selected.delete(t); });
    if (ui.open && set.has(ui.open)) closeDetail();
    save(true); renderAll();
    toast(`${ts.length} transporte(s) excluído(s) da lista.`, 'ok');
  }

  // ------------------------------------------------------------------ guia Pesos (análise mensal de peso por item)
  // Dado mestre: a NF. Cada linha da base de pesos se liga à carga em que a NF foi lançada
  // (Controle OT → NF-e). Da carga vêm transporte, cliente, data, materiais e quantidades.
  const pesoUI = { mes: '', tol: 3, aberto: null };
  function nfParaTransporte() {
    const m = new Map();
    Object.entries(state.manual).forEach(([t, man]) => {
      String(man.nf || '').split(/[\/,;\s]+/).map(P.nfNorm).filter(Boolean).forEach(nf => m.set(nf, t));
    });
    return m;
  }
  function mergePesos(rows) {
    const nfs = new Set(rows.map(r => r.nf));
    Object.keys(state.pesos).forEach(k => { if (nfs.has(state.pesos[k].nf)) delete state.pesos[k]; }); // NF reimportada substitui
    const cont = {};
    rows.forEach(r => { const b = r.nf + '|' + (r.material || ''); cont[b] = (cont[b] || 0) + 1; state.pesos[b + '|' + cont[b]] = r; });
    return { linhas: rows.length, nfs: nfs.size };
  }
  // registros analisáveis do mês: uma linha por NF+material, com kg/peça
  function registrosPesos(mes) {
    const nf2t = nfParaTransporte(); const out = [];
    Object.values(state.pesos).forEach(r => {
      const t = nf2t.get(r.nf) || (r.transporte && getTransport(r.transporte) ? r.transporte : null);
      const T = t ? getTransport(t) : null;
      const data = r.data || (T ? T.eff.data : '');
      if (mes && (data || '').slice(0, 7) !== mes) return;
      let material = r.material, qtd = r.qtd, desc = r.descricao, misto = false;
      if (T) {
        const mats = Array.from(new Set(T.items.map(i => i.material).filter(Boolean)));
        if (!material && mats.length === 1) material = mats[0];
        else if (!material && mats.length > 1) misto = true;
        const its = T.items.filter(i => i.material === material);
        if (qtd == null && its.length) qtd = its.reduce((a, i) => a + (i.qtd || 0), 0);
        if (!desc && its.length) desc = its[0].descricao;
      }
      out.push({ nf: r.nf, data, transporte: t || r.transporte || '', cliente: (T && T.eff.cliente) || r.cliente || '', material: misto ? '(vários materiais)' : (material || '(sem material)'),
        desc: misto ? (T ? T.items.map(i => i.material).join(', ') : '') : (desc || ''), qtd, pl: r.pl, pb: r.pb, misto, vinculada: !!T,
        kgL: qtd && r.pl != null && !misto ? r.pl / qtd : null, kgB: qtd && r.pb != null && !misto ? r.pb / qtd : null });
    });
    return out;
  }
  function estat(vals) {
    const v = vals.filter(x => x != null && isFinite(x)); if (!v.length) return null;
    const m = v.reduce((a, x) => a + x, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / v.length);
    return { min: Math.min(...v), max: Math.max(...v), cv: m ? sd / m : 0 };
  }
  function analisePesos(mes) {
    const regs = registrosPesos(mes);
    const prevMes = (() => { const [y, m] = mes.split('-').map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${P.pad(d.getMonth() + 1)}`; })();
    const agrupa = rs => {
      const g = new Map();
      rs.forEach(r => { if (!g.has(r.material)) g.set(r.material, []); g.get(r.material).push(r); });
      return g;
    };
    const ant = agrupa(registrosPesos(prevMes));
    const mediaPond = (rs, k) => { const q = rs.filter(r => r[k === 'kgL' ? 'pl' : 'pb'] != null && r.qtd && !r.misto); const sq = q.reduce((a, r) => a + r.qtd, 0); return sq ? q.reduce((a, r) => a + r[k === 'kgL' ? 'pl' : 'pb'], 0) / sq : null; };
    const itens = Array.from(agrupa(regs), ([material, rs]) => {
      const mL = mediaPond(rs, 'kgL'), mB = mediaPond(rs, 'kgB');
      const eL = estat(rs.map(r => r.kgL));
      const pa = ant.get(material); const mAnt = pa ? mediaPond(pa, 'kgL') : null;
      const fora = rs.filter(r => r.kgL != null && mL && Math.abs(r.kgL - mL) / mL > pesoUI.tol / 100);
      rs.forEach(r => { r.desvio = r.kgL != null && mL ? (r.kgL - mL) / mL : null; r.fora = fora.includes(r); });
      return {
        material, desc: (rs.find(r => r.desc) || {}).desc || '', rs, nfs: new Set(rs.map(r => r.nf)).size,
        qtd: rs.reduce((a, r) => a + (r.qtd || 0), 0), pl: rs.reduce((a, r) => a + (r.pl || 0), 0), pb: rs.reduce((a, r) => a + (r.pb || 0), 0),
        mL, mB, e: eL, mAnt, varAnt: mL && mAnt ? (mL - mAnt) / mAnt : null, fora: fora.length,
        misto: rs.every(r => r.misto),
      };
    }).sort((a, b) => (a.misto - b.misto) || (b.fora - a.fora) || (Math.abs(b.varAnt || 0) - Math.abs(a.varAnt || 0)) || b.nfs - a.nfs);
    const nf2t = nfParaTransporte();
    const semCarga = Array.from(new Set(regs.filter(r => !r.vinculada).map(r => r.nf)));
    const nfsBase = new Set(Object.values(state.pesos).map(r => r.nf));
    const semPeso = allTransports().filter(T => (T.eff.data || '').slice(0, 7) === mes && T.ot.nf).filter(T => !String(T.ot.nf).split(/[\/,;\s]+/).map(P.nfNorm).some(n => nfsBase.has(n)));
    return { regs, itens, prevMes, semCarga, semPeso, vinculadas: new Set(regs.filter(r => r.vinculada).map(r => r.nf)).size, nfs: new Set(regs.map(r => r.nf)).size, nf2t };
  }
  const kg = (v, d = 1) => v == null ? '—' : fmtNum(v, d);
  const pct = v => v == null ? '—' : (v > 0 ? '+' : '') + fmtNum(v * 100, 1) + '%';
  const nomeMes = m => { const [y, mm] = m.split('-'); return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+mm - 1] + '/' + y; };
  function renderPesos() {
    if (!pesoUI.mes) pesoUI.mes = (ui.date || P.todayISO()).slice(0, 7);
    $('#ps-mes').value = pesoUI.mes; $('#ps-tol').value = pesoUI.tol;
    const A = analisePesos(pesoUI.mes);
    const total = Object.keys(state.pesos).length;
    $('#ps-resumo').innerHTML = [
      ['Linhas no mês', A.regs.length], ['NFs no mês', A.nfs], ['NFs ligadas a cargas', A.vinculadas],
      ['NFs sem carga', A.semCarga.length, A.semCarga.length ? 'lime' : 'grey'], ['Cargas com NF sem peso', A.semPeso.length, A.semPeso.length ? 'lime' : 'grey'],
      ['Itens fora da tolerância', A.itens.reduce((a, i) => a + (i.fora ? 1 : 0), 0), A.itens.some(i => i.fora) ? 'red' : 'grey'], ['Base total (linhas)', total, 'grey'],
    ].map(([l, v, c]) => `<div class="card kpi ${c || ''}"><div class="k-label">${l}</div><div class="k-val">${v}</div></div>`).join('');
    const tb = A.itens.map(it => {
      const aberto = pesoUI.aberto === it.material;
      const det = aberto ? `<tr class="ps-det"><td colspan="13"><table class="items"><thead><tr><th>Data</th><th>NF-e</th><th>Transporte</th><th>Cliente</th><th class="num">Qtd</th><th class="num">Peso líq. (kg)</th><th class="num">Peso bruto (kg)</th><th class="num">kg/pç líq.</th><th class="num">kg/pç bruto</th><th class="num">Desvio da média</th></tr></thead><tbody>${it.rs.sort((a, b) => (a.data || '').localeCompare(b.data || '')).map(r => `<tr class="${r.fora ? 'ps-fora' : ''}"><td>${esc(P.fmtDateBR(r.data))}</td><td class="mono">${esc(r.nf)}</td><td class="mono">${r.transporte ? `<a href="#" data-pt="${esc(r.transporte)}">${esc(r.transporte)}</a>` : '<span class="muted">sem carga</span>'}</td><td>${esc(r.cliente)}</td><td class="num">${kg(r.qtd, 0)}</td><td class="num">${kg(r.pl)}</td><td class="num">${kg(r.pb)}</td><td class="num">${kg(r.kgL, 3)}</td><td class="num">${kg(r.kgB, 3)}</td><td class="num">${pct(r.desvio)}</td></tr>`).join('')}</tbody></table></td></tr>` : '';
      const varCls = it.varAnt != null && Math.abs(it.varAnt) > pesoUI.tol / 100 ? 'ps-alerta' : '';
      return `<tr class="ps-item ${aberto ? 'active' : ''} ${it.misto ? 'ghost' : ''}" data-mat="${esc(it.material)}">
        <td class="mono"><b>${esc(it.material)}</b></td><td class="wrap" title="${esc(it.desc)}">${esc(it.desc)}</td><td class="num">${it.nfs}</td><td class="num">${kg(it.qtd, 0)}</td>
        <td class="num">${kg(it.pl, 0)}</td><td class="num">${kg(it.pb, 0)}</td><td class="num"><b>${kg(it.mL, 3)}</b></td><td class="num">${kg(it.mB, 3)}</td>
        <td class="num">${it.e ? `${kg(it.e.min, 3)} – ${kg(it.e.max, 3)}` : '—'}</td><td class="num">${it.e ? fmtNum(it.e.cv * 100, 1) + '%' : '—'}</td>
        <td class="num">${kg(it.mAnt, 3)}</td><td class="num ${varCls}">${pct(it.varAnt)}</td>
        <td class="num">${it.fora ? `<span class="chip alt">${it.fora}</span>` : '<span class="muted">0</span>'}</td></tr>${det}`;
    }).join('');
    $('#ps-tabela').innerHTML = A.itens.length ? `<table class="grid ps-grid"><thead><tr><th>Material</th><th>Descrição</th><th class="num">NFs</th><th class="num">Qtd (pç)</th><th class="num">Peso líq. total (kg)</th><th class="num">Peso bruto total (kg)</th><th class="num">kg/pç líq. (média)</th><th class="num">kg/pç bruto</th><th class="num">Faixa kg/pç líq.</th><th class="num">Dispersão</th><th class="num">${esc(nomeMes(A.prevMes))} kg/pç</th><th class="num">Variação</th><th class="num">Fora da tolerância</th></tr></thead><tbody>${tb}</tbody></table>`
      : `<div class="empty" style="padding:36px"><p>${total ? `Nenhuma linha da base em ${esc(nomeMes(pesoUI.mes))}.` : 'Nenhuma base de pesos importada.'} Copie a base (com a linha de títulos: NF, peso líquido, peso bruto…) e pressione <b>Ctrl+V</b> nesta guia, ou use <b>Importar arquivo</b>.</p></div>`;
    $('#ps-pend').innerHTML = (A.semCarga.length ? `<details><summary><b>${A.semCarga.length}</b> NF(s) da base sem carga com essa NF no app</summary><p class="mono small">${A.semCarga.map(esc).join(' · ')}</p><p class="muted small">Lance a NF-e no Controle OT da carga para ligar.</p></details>` : '')
      + (A.semPeso.length ? `<details><summary><b>${A.semPeso.length}</b> carga(s) do mês com NF-e lançada, mas sem peso na base</summary><p class="small">${A.semPeso.map(T => `<a href="#" data-pt="${esc(T.transporte)}">${esc(T.transporte)}</a> (NF ${esc(T.ot.nf)})`).join(' · ')}</p></details>` : '');
    return A;
  }
  function exportarPesos() {
    const A = analisePesos(pesoUI.mes);
    const resumo = [['Material', 'Descrição', 'NFs', 'Qtd (pç)', 'Peso líq. total (kg)', 'Peso bruto total (kg)', 'kg/pç líq. (média)', 'kg/pç bruto (média)', 'kg/pç líq. mín', 'kg/pç líq. máx', 'Dispersão (%)', `kg/pç líq. ${nomeMes(A.prevMes)}`, 'Variação vs mês anterior (%)', `Fora da tolerância (±${pesoUI.tol}%)`]]
      .concat(A.itens.map(i => [i.material, i.desc, i.nfs, i.qtd, round(i.pl, 1), round(i.pb, 1), round(i.mL, 4), round(i.mB, 4), i.e ? round(i.e.min, 4) : '', i.e ? round(i.e.max, 4) : '', i.e ? round(i.e.cv * 100, 2) : '', round(i.mAnt, 4), i.varAnt == null ? '' : round(i.varAnt * 100, 2), i.fora]));
    const det = [['Material', 'Data', 'NF-e', 'Transporte', 'Cliente', 'Qtd (pç)', 'Peso líq. (kg)', 'Peso bruto (kg)', 'kg/pç líq.', 'kg/pç bruto', 'Desvio da média (%)', 'Fora da tolerância']]
      .concat([].concat(...A.itens.map(i => i.rs.map(r => [r.material, P.fmtDateBR(r.data), r.nf, r.transporte, r.cliente, r.qtd, r.pl, r.pb, round(r.kgL, 4), round(r.kgB, 4), r.desvio == null ? '' : round(r.desvio * 100, 2), r.fora ? 'SIM' : '']))));
    const nome = `analise-pesos-${pesoUI.mes}`;
    if (window.XLSX) {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'Por item');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(det), 'Por NF');
      XLSX.writeFile(wb, nome + '.xlsx'); return 'xlsx';
    }
    const csv = resumo.map(r => r.map(v => typeof v === 'number' ? String(v).replace('.', ',') : `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    baixar(nome + '.csv', new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); return 'csv';
  }
  const round = (v, d) => v == null || !isFinite(v) ? '' : Math.round(v * 10 ** d) / 10 ** d;
  function importarPesosGrid(grid, origem) {
    const r = P.parsePesos(grid);
    if (!r.rows.length) { toast(r.erro || 'Nenhuma linha com NF e peso reconhecida na base.', 'err'); return false; }
    const res = mergePesos(r.rows); save(true);
    const cols = Object.keys(r.map).map(k => P.PESO_LABEL[k]).join(', ');
    const meses = Array.from(new Set(r.rows.map(x => (x.data || '').slice(0, 7)).filter(Boolean))).sort();
    if (meses.length && !meses.includes(pesoUI.mes)) pesoUI.mes = meses[meses.length - 1];
    if (ui.view !== 'pesos') setView('pesos'); else renderAll();
    const lig = r.rows.filter(x => nfParaTransporte().has(x.nf)).length;
    toast(`Base de pesos (${origem}): ${res.linhas} linha(s), ${res.nfs} NF(s) · ${lig} ligada(s) a cargas. Colunas reconhecidas: ${cols}.`, 'ok');
    return true;
  }

  // ------------------------------------------------------------------ balança: peso por lote pelo ticket de pesagem
  // Tabela diária da balança (colada) → ticket → ordem (Controle OT "Ticket balança") → itens da carga.
  // O peso líquido da balança é rateado entre os itens pelo peso de referência (base de pesos: NF da carga,
  // senão média do material; sem base, pelo volume das chapas; por último pela quantidade).
  // Cada carga de um item é um ponto: kg por lote = peso do item na carga ÷ lotes (qtd ÷ peças por lote).
  const blUI = { item: '', per: '180', met: 'lote' };
  function mergeTickets(rows) {
    const g = new Map();
    rows.forEach(r => { if (!g.has(r.ticket)) g.set(r.ticket, []); g.get(r.ticket).push(r); });
    let novos = 0;
    g.forEach((rs, tk) => {
      const f = rs[0];
      if (!state.tickets[tk]) novos++;
      const pick = k => (rs.find(r => r[k] != null && r[k] !== '') || {})[k];
      state.tickets[tk] = { ticket: tk, data: pick('data') || '', placa: pick('placa') || '', pe: pick('pe') ?? null, ps: pick('ps') ?? null,
        liq: pick('liq') ?? null, bruto: pick('bruto') ?? null, transporte: pick('transporte') || '', nf: pick('nf') || '', cliente: pick('cliente') || '',
        itens: rs.filter(r => r.material).map(r => ({ material: r.material, descricao: r.descricao, qtd: r.qtd })), em: new Date().toISOString() };
      if (f.liq == null && state.tickets[tk].liq == null && state.tickets[tk].bruto == null) delete state.tickets[tk];
    });
    return { tickets: g.size, novos };
  }
  function ticketParaTransporte() {
    const m = new Map();
    Object.entries(state.manual).forEach(([t, man]) => String(man.ticket || '').split(/[\/,;\s]+/).map(P.ticketNorm).filter(Boolean).forEach(k => m.set(k, t)));
    return m;
  }
  function transporteDoTicket(tk, idx) {
    const t = idx.tk.get(tk.ticket); if (t) return { t, via: 'ticket' };
    if (tk.transporte && idx.ts.has(tk.transporte)) return { t: tk.transporte, via: 'transporte' };
    if (tk.nf && idx.nf.has(tk.nf)) return { t: idx.nf.get(tk.nf), via: 'NF' };
    const p7 = P.plate7(tk.placa);
    if (p7 && tk.data) { const T = idx.all.find(T => T.eff.data === tk.data && P.plate7(T.eff.placaL) === p7); if (T) return { t: T.transporte, via: 'placa + data' }; }
    return null;
  }
  // kg/peça de referência do material: NF da carga (peso bruto ÷ qtd) → média da base → volume da chapa
  function refPesos() {
    const porNfMat = new Map(), porMat = new Map();
    Object.values(state.pesos).forEach(r => {
      const p = r.pb != null ? r.pb : r.pl; if (p == null || !r.qtd || !r.material) return;
      const k = r.nf + '|' + r.material; const a = porNfMat.get(k) || { p: 0, q: 0 }; a.p += p; a.q += r.qtd; porNfMat.set(k, a);
      const b = porMat.get(r.material) || { p: 0, q: 0 }; b.p += p; b.q += r.qtd; porMat.set(r.material, b);
    });
    return { porNfMat, porMat };
  }
  function registrosBalanca() {
    const all = allTransports();
    const idx = { tk: ticketParaTransporte(), ts: new Set(all.map(T => T.transporte)), nf: nfParaTransporte(), all };
    const ref = refPesos(); const recs = [], semOrdem = [], semLote = [];
    Object.values(state.tickets).forEach(tk => {
      const peso = tk.liq != null ? tk.liq : null; if (peso == null) return;
      const lig = transporteDoTicket(tk, idx); const T = lig ? all.find(x => x.transporte === lig.t) : null;
      // itens da carga: da própria tabela da balança (se tiver material) ou da ordem
      const fonte = tk.itens.length ? tk.itens.map(i => ({ material: i.material, descricao: i.descricao || ((T && T.items.find(x => x.material === i.material)) || {}).descricao || '', qtd: i.qtd }))
        : (T ? T.items.map(i => ({ material: i.material, descricao: i.descricao, qtd: i.qtd })) : []);
      if (!fonte.length) { semOrdem.push(tk); return; }
      const g = new Map();
      fonte.forEach(i => { const k = i.material || i.descricao; const a = g.get(k) || { material: i.material || '(sem material)', descricao: i.descricao, qtd: 0, lotes: 0, lotesOk: true }; a.qtd += i.qtd || 0;
        const mi = P.matInfo(i.descricao); if (i.qtd && mi.pecasPallet) a.lotes += i.qtd / mi.pecasPallet; else a.lotesOk = false; a.mi = mi; g.set(k, a); });
      const mats = Array.from(g.values()).filter(m => m.qtd > 0);
      if (!mats.length) { semLote.push(tk); return; }
      const nfs = T ? String(T.ot.nf || '').split(/[\/,;\s]+/).map(P.nfNorm).filter(Boolean) : [];
      if (tk.nf) nfs.push(tk.nf);
      const refNF = m => { for (const nf of nfs) { const a = ref.porNfMat.get(nf + '|' + m.material); if (a && a.q) return a.p / a.q; } return null; };
      const refBase = m => { const a = ref.porMat.get(m.material); return a && a.q ? a.p / a.q : null; };
      const refVol = m => m.mi && m.mi.comp && m.mi.larg && m.mi.esp ? m.mi.comp * m.mi.larg * m.mi.esp / 1e9 : null;
      // um único critério de rateio para todos os itens da carga
      let metodo, w;
      if (mats.length === 1) { metodo = 'item único'; w = () => 1; }
      else if (mats.every(m => refNF(m) != null)) { metodo = 'NF da carga'; w = m => refNF(m) * m.qtd; }
      else if (mats.every(m => (refNF(m) ?? refBase(m)) != null)) { metodo = 'base de pesos'; w = m => (refNF(m) ?? refBase(m)) * m.qtd; }
      else if (mats.every(m => refVol(m) != null)) { metodo = 'volume'; w = m => refVol(m) * m.qtd; }
      else { metodo = 'quantidade'; w = m => m.qtd; }
      const soma = mats.reduce((a, m) => a + w(m), 0);
      mats.forEach(m => {
        const pesoItem = soma ? peso * w(m) / soma : null;
        const nfRef = refNF(m);
        recs.push({ ticket: tk.ticket, data: tk.data || (T ? T.eff.data : ''), transporte: T ? T.transporte : (tk.transporte || ''), via: lig ? lig.via : 'tabela',
          cliente: (T && T.eff.cliente) || tk.cliente || '', placa: tk.placa || (T ? T.eff.placaL : ''), material: m.material, descricao: m.descricao,
          qtd: m.qtd, lotes: m.lotesOk ? m.lotes : null, pesoCarga: peso, pesoItem, metodo, itensCarga: mats.length,
          kgLote: pesoItem != null && m.lotesOk && m.lotes ? pesoItem / m.lotes : null, kgPc: pesoItem != null ? pesoItem / m.qtd : null,
          nfItem: nfRef != null ? nfRef * m.qtd : null });
      });
    });
    return { recs, semOrdem, semLote };
  }
  function analiseBalanca() {
    const B = registrosBalanca();
    const desde = blUI.per === 'todos' ? '' : (() => { const d = new Date(); d.setDate(d.getDate() - (+blUI.per)); return d.toISOString().slice(0, 10); })();
    const recs = B.recs.filter(r => !desde || !r.data || r.data >= desde);
    const k = blUI.met === 'pc' ? 'kgPc' : 'kgLote';
    const g = new Map();
    recs.forEach(r => { if (!g.has(r.material)) g.set(r.material, []); g.get(r.material).push(r); });
    const itens = Array.from(g, ([material, rs]) => {
      const v = rs.map(r => r[k]).filter(x => x != null);
      const media = v.length ? v.reduce((a, x) => a + x, 0) / v.length : null;
      const sd = v.length ? Math.sqrt(v.reduce((a, x) => a + (x - media) ** 2, 0) / v.length) : 0;
      rs.forEach(r => {
        r.desvio = r[k] != null && media ? r[k] - media : null;
        r.desvioPct = r.desvio != null ? r.desvio / media : null;
        // diferença na carga inteira: desvio por lote × lotes (ou por peça × peças)
        r.difCarga = r.desvio != null ? r.desvio * (k === 'kgPc' ? r.qtd : r.lotes) : null;
        r.fora = r.desvioPct != null && Math.abs(r.desvioPct) > pesoUI.tol / 100;
      });
      const difs = rs.map(r => r.difCarga).filter(x => x != null);
      return { material, desc: (rs.find(r => r.descricao) || {}).descricao || '', rs, n: v.length, cargas: new Set(rs.map(r => r.ticket)).size, media, cv: media ? sd / media : null,
        min: v.length ? Math.min(...v) : null, max: v.length ? Math.max(...v) : null, maiorDif: difs.length ? Math.max(...difs.map(Math.abs)) : null, fora: rs.filter(r => r.fora).length };
    }).sort((a, b) => (b.n >= 2) - (a.n >= 2) || (b.maiorDif || 0) - (a.maiorDif || 0));
    return Object.assign(B, { recsPer: recs, itens, k });
  }
  function svgBalanca(it, k, unidade) {
    const host = $('#bl-chart'); const W = Math.max(520, Math.min(1400, host.clientWidth || 900)), H = 300;
    const m = { l: 64, r: 18, t: 18, b: 34 };
    const pts = it.rs.filter(r => r[k] != null && r.data).sort((a, b) => a.data.localeCompare(b.data));
    if (!pts.length) return '<div class="empty" style="padding:30px"><p>Sem cargas com data e peso para este item.</p></div>';
    const tx = d => new Date(d + 'T12:00:00').getTime();
    let x0 = tx(pts[0].data), x1 = tx(pts[pts.length - 1].data); if (x1 - x0 < 864e5 * 2) { x0 -= 864e5 * 2; x1 += 864e5 * 2; }
    const tol = pesoUI.tol / 100, med = it.media;
    let y0 = Math.min(...pts.map(r => r[k]), med * (1 - tol)), y1 = Math.max(...pts.map(r => r[k]), med * (1 + tol));
    const pad = (y1 - y0) * 0.12 || med * 0.05; y0 -= pad; y1 += pad;
    const X = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r), Y = v => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
    const dec = unidade === 'kg/peça' ? 2 : 0;
    // grade e eixos (recessivos)
    const step = (() => { const raw = (y1 - y0) / 5, p = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 2.5, 5, 10].map(s => s * p).find(s => s >= raw); })();
    let grid = '';
    for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="${m.l - 8}" y="${Y(v) + 4}" class="ax" text-anchor="end">${fmtNum(v, step < 1 ? 2 : 0)}</text>`;
    const nT = Math.min(7, Math.max(2, Math.round((x1 - x0) / 864e5) + 1));
    for (let i = 0; i < nT; i++) { const v = x0 + (x1 - x0) * i / (nT - 1); const d = new Date(v); grid += `<text x="${X(v)}" y="${H - 10}" class="ax" text-anchor="middle">${P.pad(d.getDate())}/${P.pad(d.getMonth() + 1)}${(x1 - x0) > 300 * 864e5 ? '/' + String(d.getFullYear()).slice(2) : ''}</text>`; }
    const band = `<rect x="${m.l}" y="${Y(med * (1 + tol))}" width="${W - m.l - m.r}" height="${Y(med * (1 - tol)) - Y(med * (1 + tol))}" class="band"/>`;
    const mean = `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(med)}" y2="${Y(med)}" class="mean"/><text x="${W - m.r - 4}" y="${Y(med) - 6}" class="lbl" text-anchor="end">média ${fmtNum(med, dec)} ${unidade} · faixa ±${fmtNum(pesoUI.tol, 1)}%</text>`;
    const line = pts.length > 1 ? `<polyline class="ln" points="${pts.map(r => `${X(tx(r.data))},${Y(r[k])}`).join(' ')}"/>` : '';
    // rótulos só nos pontos fora da faixa (no máx. 8, os maiores desvios)
    const rot = new Set(pts.filter(r => r.fora).sort((a, b) => Math.abs(b.difCarga || 0) - Math.abs(a.difCarga || 0)).slice(0, 8));
    const dots = pts.map((r, i) => {
      const cx = X(tx(r.data)), cy = Y(r[k]);
      const lab = rot.has(r) && r.difCarga != null ? `<text x="${cx}" y="${cy + (r.desvio < 0 ? 18 : -10)}" class="lbl out" text-anchor="middle">${r.difCarga > 0 ? '+' : '−'}${fmtNum(Math.abs(r.difCarga), 0)} kg</text>` : '';
      return `<circle cx="${cx}" cy="${cy}" r="5" class="pt${r.fora ? ' fora' : ''}"/>${lab}<circle cx="${cx}" cy="${cy}" r="12" class="hit" data-i="${i}"/>`;
    }).join('');
    host._pts = pts; host._k = k; host._un = unidade; host._dec = dec;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Variação de ${esc(unidade)} do material ${esc(it.material)} por carga">${band}${grid}${mean}${line}${dots}</svg><div class="bl-tip" hidden></div>`;
  }
  function renderBalanca() {
    if (!$('#bl')) return;
    const A = analiseBalanca();
    const unidade = A.k === 'kgPc' ? 'kg/peça' : 'kg/lote', dec = A.k === 'kgPc' ? 3 : 0;
    $('#bl-per').value = blUI.per;
    $$('#bl-met button').forEach(b => b.classList.toggle('active', b.dataset.v === blUI.met));
    const sel = $('#bl-item');
    if (blUI.item && !A.itens.some(i => i.material === blUI.item)) blUI.item = '';
    sel.innerHTML = `<option value="">Todos os itens (resumo)</option>` + A.itens.map(i => `<option value="${esc(i.material)}">${esc(i.material)} · ${esc(i.desc.slice(0, 44))} (${i.cargas} carga${i.cargas > 1 ? 's' : ''})</option>`).join('');
    sel.value = blUI.item;
    const it = A.itens.find(i => i.material === blUI.item);
    const nT = Object.keys(state.tickets).length;
    $('#bl-kpis').innerHTML = (it ? [
      ['Cargas', it.cargas], [`Média ${unidade}`, kg(it.media, dec)], ['Mínimo', kg(it.min, dec)], ['Máximo', kg(it.max, dec)],
      ['Amplitude', kg(it.max - it.min, dec)], ['Maior diferença numa carga', it.maiorDif != null ? fmtNum(it.maiorDif, 0) + ' kg' : '—', it.maiorDif >= 1000 ? 'red' : ''],
      ['Fora da faixa', it.fora, it.fora ? 'red' : 'grey'],
    ] : [
      ['Tickets na memória', nT, 'grey'], ['Cargas no período', new Set(A.recsPer.map(r => r.ticket)).size], ['Itens', A.itens.length],
      ['Itens com carga fora da faixa', A.itens.filter(i => i.fora).length, A.itens.some(i => i.fora) ? 'red' : 'grey'],
      ['Tickets sem ordem', A.semOrdem.length, A.semOrdem.length ? 'lime' : 'grey'],
    ]).map(([l, v, c]) => `<div class="card kpi ${c || ''}"><div class="k-label">${l}</div><div class="k-val">${v}</div></div>`).join('');
    const ch = $('#bl-chart');
    if (it) ch.innerHTML = svgBalanca(it, A.k, unidade);
    else ch.innerHTML = nT ? '<div class="empty" style="padding:22px"><p>Escolha um <b>item</b> acima (ou clique numa linha do resumo) para ver o gráfico da variação de peso por carga.</p></div>'
      : '<div class="empty" style="padding:30px"><p>Nenhuma pesagem na memória. Copie a tabela diária da balança (com a linha de títulos: <b>Ticket</b>, peso de entrada/saída ou líquido, data, placa…) e use <b>Colar tickets</b> (ou Ctrl+V nesta guia).</p></div>';
    const ord = r => (r.data || '') + r.ticket;
    $('#bl-tab').innerHTML = it
      ? `<table class="grid ps-grid"><thead><tr><th>Data</th><th>Ticket</th><th>Transporte</th><th>Cliente</th><th class="num">Qtd (pç)</th><th class="num">Lotes</th><th class="num">Peso balança carga (kg)</th><th class="num">Peso do item (kg)</th><th>Rateio</th><th class="num">kg/lote</th><th class="num">kg/peça</th><th class="num">Desvio ${esc(unidade)}</th><th class="num">Diferença na carga (kg)</th><th class="num">Peso bruto NF (kg)</th></tr></thead>
        <tbody>${it.rs.slice().sort((a, b) => ord(b).localeCompare(ord(a))).map(r => `<tr class="${r.fora ? 'ps-fora' : ''}"><td>${esc(P.fmtDateBR(r.data))}</td><td class="mono">${esc(r.ticket)}</td><td class="mono">${r.transporte ? `<a href="#" data-pt="${esc(r.transporte)}">${esc(r.transporte)}</a>` : '—'}</td><td>${esc(r.cliente)}</td>
          <td class="num">${kg(r.qtd, 0)}</td><td class="num">${kg(r.lotes, 2)}</td><td class="num">${kg(r.pesoCarga, 0)}</td><td class="num">${kg(r.pesoItem, 0)}</td><td class="small muted">${esc(r.metodo)}</td>
          <td class="num"><b>${kg(r.kgLote, 0)}</b></td><td class="num">${kg(r.kgPc, 3)}</td><td class="num">${r.desvio == null ? '—' : (r.desvio > 0 ? '+' : '') + fmtNum(r.desvio, dec)} <span class="muted small">${pct(r.desvioPct)}</span></td>
          <td class="num"><b>${r.difCarga == null ? '—' : (r.difCarga > 0 ? '+' : '') + fmtNum(r.difCarga, 0)}</b></td><td class="num">${kg(r.nfItem, 0)}</td></tr>`).join('')}</tbody></table>`
      : (A.itens.length ? `<table class="grid ps-grid"><thead><tr><th>Material</th><th>Descrição</th><th class="num">Cargas</th><th class="num">Média ${esc(unidade)}</th><th class="num">Mín.</th><th class="num">Máx.</th><th class="num">Amplitude</th><th class="num">Dispersão</th><th class="num">Maior diferença numa carga (kg)</th><th class="num">Fora da faixa</th></tr></thead>
        <tbody>${A.itens.map(i => `<tr class="ps-item" data-blmat="${esc(i.material)}"><td class="mono"><b>${esc(i.material)}</b></td><td class="wrap">${esc(i.desc)}</td><td class="num">${i.cargas}</td><td class="num"><b>${kg(i.media, dec)}</b></td><td class="num">${kg(i.min, dec)}</td><td class="num">${kg(i.max, dec)}</td><td class="num">${i.min == null ? '—' : kg(i.max - i.min, dec)}</td><td class="num">${i.cv == null ? '—' : fmtNum(i.cv * 100, 1) + '%'}</td><td class="num ${i.maiorDif >= 1000 ? 'ps-alerta' : ''}">${i.maiorDif == null ? '—' : fmtNum(i.maiorDif, 0)}</td><td class="num">${i.fora ? `<span class="chip alt">${i.fora}</span>` : '<span class="muted">0</span>'}</td></tr>`).join('')}</tbody></table>` : '');
    const tkOrdem = ticketParaTransporte(), semPesagem = Array.from(tkOrdem).filter(([tk]) => !state.tickets[tk]);
    $('#bl-pend').innerHTML = (A.semOrdem.length ? `<details><summary><b>${A.semOrdem.length}</b> ticket(s) da balança sem ordem no app</summary><p class="mono small">${A.semOrdem.map(t => esc(t.ticket + (t.placa ? ' (' + t.placa + ')' : ''))).join(' · ')}</p><p class="muted small">Informe o ticket no campo "Ticket balança" do Controle OT da ordem para ligar.</p></details>` : '')
      + (semPesagem.length ? `<details><summary><b>${semPesagem.length}</b> ordem(ns) com ticket informado, mas ainda sem pesagem colada</summary><p class="small">${semPesagem.map(([tk, t]) => `<a href="#" data-pt="${esc(t)}">${esc(t)}</a> (ticket ${esc(tk)})`).join(' · ')}</p></details>` : '')
      + (A.recs.some(r => r.lotes == null) ? `<details><summary>Cargas sem o nº de peças por lote no texto do material</summary><p class="muted small">Nelas só o kg/peça é calculado (o texto do material precisa terminar com as peças por lote, ex.: P/EF/208).</p></details>` : '');
  }
  function bindBalanca() {
    $('#bl-item').addEventListener('change', e => { blUI.item = e.target.value; renderBalanca(); });
    $('#bl-per').addEventListener('change', e => { blUI.per = e.target.value; renderBalanca(); });
    $$('#bl-met button').forEach(b => b.addEventListener('click', () => { blUI.met = b.dataset.v; renderBalanca(); }));
    $('#bl-colar').addEventListener('click', () => colarPorBotao('tickets'));
    $('#bl-xlsx').addEventListener('click', () => { const t = exportarBalanca(); toast(t === 'xlsx' ? 'Pesagens exportadas (.xlsx).' : 'Exportado em .csv (sem internet, o .xlsx não está disponível).', 'ok'); });
    $('#bl').addEventListener('click', e => { const tr = e.target.closest('tr[data-blmat]'); if (tr) { blUI.item = tr.dataset.blmat; renderBalanca(); $('#bl').scrollIntoView({ block: 'start', behavior: 'smooth' }); } });
    const ch = $('#bl-chart');
    ch.addEventListener('mousemove', e => {
      const tip = $('.bl-tip', ch); if (!tip) return;
      const h = e.target.closest('circle.hit'); if (!h) { tip.hidden = true; return; }
      const r = ch._pts[+h.dataset.i], dec = ch._dec;
      tip.innerHTML = `<b>${esc(P.fmtDateBR(r.data))}</b> · ticket ${esc(r.ticket)}<br>Transporte ${esc(r.transporte || '—')} · ${esc(r.cliente)}<br><b>${fmtNum(r[ch._k], dec)} ${esc(ch._un)}</b> (${pct(r.desvioPct)} da média)<br>${kg(r.lotes, 2)} lote(s) · ${kg(r.qtd, 0)} pç · item ${kg(r.pesoItem, 0)} kg<br>Diferença na carga: <b>${r.difCarga == null ? '—' : (r.difCarga > 0 ? '+' : '') + fmtNum(r.difCarga, 0) + ' kg'}</b>${r.itensCarga > 1 ? `<br><span class="muted">carga mista: rateio por ${esc(r.metodo)}</span>` : ''}`;
      const b = ch.getBoundingClientRect(); tip.hidden = false;
      const x = e.clientX - b.left, y = e.clientY - b.top;
      tip.style.left = Math.min(x + 14, b.width - tip.offsetWidth - 4) + 'px'; tip.style.top = Math.max(4, y - tip.offsetHeight - 10) + 'px';
    });
    ch.addEventListener('mouseleave', () => { const tip = $('.bl-tip', ch); if (tip) tip.hidden = true; });
    ch.addEventListener('click', e => { const h = e.target.closest('circle.hit'); if (h) { const r = ch._pts[+h.dataset.i]; if (r.transporte && getTransport(r.transporte)) openDetail(r.transporte); } });
  }
  function exportarBalanca() {
    const B = registrosBalanca();
    const cab = ['Material', 'Descrição', 'Data', 'Ticket', 'Transporte', 'Ligação', 'Cliente', 'Placa', 'Qtd (pç)', 'Lotes', 'Peso balança carga (kg)', 'Itens na carga', 'Rateio', 'Peso do item (kg)', 'kg/lote', 'kg/peça', 'Peso bruto NF (kg)'];
    const rows = [cab].concat(B.recs.sort((a, b) => a.material.localeCompare(b.material) || (a.data || '').localeCompare(b.data || '')).map(r => [r.material, r.descricao, P.fmtDateBR(r.data), r.ticket, r.transporte, r.via, r.cliente, r.placa, r.qtd, round(r.lotes, 3), r.pesoCarga, r.itensCarga, r.metodo, round(r.pesoItem, 1), round(r.kgLote, 1), round(r.kgPc, 4), round(r.nfItem, 1)]));
    const nome = `pesagens-balanca-${P.todayISO()}`;
    if (window.XLSX) { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Cargas por item'); XLSX.writeFile(wb, nome + '.xlsx'); return 'xlsx'; }
    const csv = rows.map(r => r.map(v => typeof v === 'number' ? String(v).replace('.', ',') : `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    baixar(nome + '.csv', new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); return 'csv';
  }
  function importarTicketsGrid(grid, origem) {
    const r = P.parseTickets(grid);
    if (!r.rows.length) return false;
    const res = mergeTickets(r.rows); save(true);
    if (ui.view !== 'pesos') setView('pesos'); else renderAll();
    const idx = ticketParaTransporte(); const lig = Object.values(state.tickets).filter(t => r.rows.some(x => x.ticket === t.ticket) && idx.has(t.ticket)).length;
    const cols = Object.keys(r.map).map(k => P.TK_LABEL[k]).join(', ');
    toast(`Balança (${origem}): ${res.tickets} ticket(s), ${res.novos} novo(s) · ${lig} ligado(s) a ordem pelo ticket. Colunas reconhecidas: ${cols}.`, 'ok');
    setTimeout(() => $('#bl') && $('#bl').scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
    return true;
  }

  // ------------------------------------------------------------------ guia Agendamentos
  function setView(v) {
    ui.view = v;
    $$('#views button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    $$('[data-view-of]').forEach(el => { el.hidden = el.dataset.viewOf !== v; });
    $('#janela-filter').style.display = v === 'lista' ? '' : 'none';
    $('.toolbar').style.display = v === 'pesos' ? 'none' : '';
    renderAll();
  }
  function renderAgenda() {
    const day = allTransports().filter(T => T.eff.data === ui.date);
    const byPlate = new Map(); day.forEach(T => { const p = P.plate7(T.eff.placaL); if (p) byPlate.set(p, T); });
    const q = P.norm(ui.q);
    let nAlt = 0, nTot = 0;
    ['MI', 'CONTAINER'].forEach(j => {
      const box = $('#ag-' + j);
      const rows = state.sew.filter(e => !e.carregamento && e.janela === j && e.data === ui.date)
        .filter(e => !q || P.norm([e.carreta, e.cavalo, e.cpf, e.transportadora, e.cliente, e.container, e.senha].join(' ')).includes(q))
        .sort((a, b) => (!!a.removed - !!b.removed) || (a.hora || '99').localeCompare(b.hora || '99'));
      nTot += rows.filter(e => !e.removed).length;
      const last = rows.reduce((m, e) => (e.updatedAt > m ? e.updatedAt : m), '');
      const ct = j === 'CONTAINER';
      const body = rows.map(e => {
        const T = byPlate.get(P.plate7(e.carreta));
        const alt = T && T.printed && !T.faturado && T.alteracoes.length;
        if (alt) nAlt++;
        const chg = (e.changes || []).slice(-3).map(c => `<span class="chg">${esc(c.campo)}: ${esc(c.de || '—')} → ${esc(c.para || '—')} <span class="muted">(${esc(new Date(c.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))})</span></span>`).join('');
        return `<tr ${T ? `data-t="${esc(T.transporte)}"` : ''} class="${e.removed ? 'ag-removed' : ''} ${alt ? 'alterada' : ''} ${!alt && (e.changes || []).length ? 'ag-changed' : ''}">
          <td class="mono">${esc(e.hora)}${chg}</td><td class="mono">${esc(e.senha)}</td><td class="wrap">${esc(e.removed ? 'Removido do agendamento' : e.status)}</td>
          <td class="wrap">${esc(e.tipoVeiculo)}</td><td class="mono">${esc(e.carreta)}</td><td class="mono">${esc(e.cavalo)}</td><td class="mono">${esc(e.cpf)}</td>
          ${ct ? `<td class="mono">${esc(e.container)}</td>` : ''}
          <td class="wrap">${esc(e.transportadora)}</td><td class="wrap">${esc(e.cliente)}</td><td class="num">${fmtNum(e.volume, 3)}</td>
          <td class="mono">${T ? `<b>${esc(T.transporte)}</b>` : '<span class="muted">—</span>'}</td>
          <td>${T ? statusChip(T) : '<span class="chip grey">Sem ordem</span>'}</td></tr>`;
      }).join('');
      box.innerHTML = `<div class="ag-head"><span class="chip ${ct ? 'ct' : 'mi'}"><span class="dot"></span>${ct ? 'PIÊN CONTAINERS' : 'PIÊN PAINÉIS'}</span>
        <h3>${ct ? 'Containers' : 'Mercado interno'}</h3>
        <span class="muted">${rows.filter(e => !e.removed).length} agendamento(s)${last ? ` · atualizado às ${esc(new Date(last).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}` : ''}</span></div>
        <div class="table-wrap" style="max-height:none;min-height:0">${rows.length ? `<table class="grid"><thead><tr><th>Hora</th><th>Senha</th><th>Status</th><th>Tipo de veículo</th><th>Carreta</th><th>Cavalo</th><th>CPF</th>${ct ? '<th>Container</th>' : ''}<th>Transportadora</th><th>Cliente</th><th class="num">Volume</th><th>Transporte</th><th>Ordem</th></tr></thead><tbody>${body}</tbody></table>`
          : `<div class="empty" style="padding:28px"><p>Nenhum agendamento de ${ct ? 'containers' : 'mercado interno'} em ${esc(P.fmtDateBR(ui.date))}. Copie a tela no SEW e pressione <b>Ctrl+V</b>.</p></div>`}</div>`;
    });
    return { nAlt, nTot };
  }
  function renderViewCounts() {
    const day = allTransports().filter(T => T.eff.data === ui.date);
    const alt = day.filter(T => T.printed && !T.faturado && T.alteracoes.length).length;
    $('#v-count-lista').textContent = alt ? `${alt} com alterações` : (day.length || '');
    $('#v-count-lista').classList.toggle('alt', !!alt);
    const ag = state.sew.filter(e => !e.carregamento && !e.removed && e.data === ui.date).length;
    $('#v-count-agenda').textContent = ag || '';
    $('#v-count-ots').textContent = Object.keys(state.ots).length || '';
  }
  // Acrescenta à memória; nada é apagado quando some da tela (a OT some do SAP
  // quando a carga é faturada). Entregas de transportes já faturados são ignoradas.
  function mergeOTs(rows) {
    const now = new Date().toISOString();
    const fatEntregas = new Set();
    Object.keys(state.faturado).forEach(t => { const T = getTransport(t); if (T) T.entregas.forEach(en => fatEntregas.add(en)); });
    const pasted = new Set(rows.map(r => r.remessa));
    let novas = 0;
    rows.forEach(r => {
      if (fatEntregas.has(r.remessa)) return;
      const m = state.ots[r.remessa] || (state.ots[r.remessa] = { remessa: r.remessa, ots: [], itens: [], firstSeen: now });
      if (!m.ots.includes(r.ot)) { m.ots.push(r.ot); novas++; }
      m.lastSeen = now; m.ausente = false;
      const k = [r.ot, r.material, r.posicao].join('|');
      if (!m.itens.some(i => [i.ot, i.material, i.posicao].join('|') === k)) m.itens.push(r);
    });
    Object.values(state.ots).forEach(m => { if (!pasted.has(m.remessa)) m.ausente = true; });
    return { linhas: rows.length, remessas: pasted.size, novas };
  }
  function knownSets() {
    const entregas = new Set(), materiais = new Set();
    Object.values(state.items).forEach(i => { if (i.entrega) entregas.add(i.entrega); if (i.material) materiais.add(i.material); });
    Object.keys(state.ots).forEach(e => entregas.add(e));
    return { entregas, materiais };
  }
  function transportByEntrega() {
    const map = new Map();
    allTransports().forEach(T => T.entregas.forEach(en => map.set(en, T)));
    return map;
  }
  function renderOTs() {
    const byEnt = transportByEntrega();
    const q = P.norm(ui.q);
    const rows = Object.values(state.ots)
      .map(m => ({ m, T: byEnt.get(m.remessa) }))
      .filter(({ m, T }) => !q || P.norm([m.remessa, m.ots.join(' '), m.itens.map(i => i.material + ' ' + i.texto).join(' '), T ? T.transporte + ' ' + T.eff.cliente : ''].join(' ')).includes(q))
      .sort((a, b) => ((a.T && a.T.eff.hora) || '99').localeCompare((b.T && b.T.eff.hora) || '99') || a.m.remessa.localeCompare(b.m.remessa));
    const hm = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    $('#ots-list').innerHTML = rows.length ? `<table class="grid"><thead><tr><th>Remessa (entrega)</th><th>OT</th><th>Material / texto</th><th>Posição</th><th class="num">Qtd</th><th>Transporte</th><th>Data</th><th>Cliente</th><th>Ordem</th><th>Na tela do SAP</th></tr></thead><tbody>${rows.map(({ m, T }) => `
      <tr ${T ? `data-t="${esc(T.transporte)}"` : ''} class="${m.ausente ? 'ot-ausente' : ''}">
        <td class="mono"><b>${esc(m.remessa)}</b></td>
        <td class="mono"><b>${esc(m.ots.join(' / '))}</b></td>
        <td class="wrap">${m.itens.map(i => `${esc(i.material)} ${esc(i.texto)}`).join('<br>')}</td>
        <td class="mono">${m.itens.map(i => esc([i.tpDep, i.posicao].filter(Boolean).join(' · '))).join('<br>')}</td>
        <td class="num">${m.itens.map(i => fmtNum(i.qtd, 0)).join('<br>')}</td>
        <td class="mono">${T ? `<b>${esc(T.transporte)}</b>` : '<span class="muted">sem transporte</span>'}</td>
        <td>${T ? esc(P.fmtDateBR(T.eff.data)) : ''}</td>
        <td class="wrap">${T ? esc(T.eff.cliente) : ''}</td>
        <td>${T ? statusChip(T) : ''}</td>
        <td class="small">${m.ausente ? `<span class="chip grey" title="Não veio na última colagem; continua na memória até a ordem ser faturada">não aparece mais</span>` : `<span class="chip ok">sim</span>`}<span class="sub">desde ${esc(hm(m.firstSeen))}</span></td>
      </tr>`).join('')}</tbody></table>`
      : `<div class="empty" style="padding:36px"><p>Nenhuma OT na memória. Copie a tela de OTs do SAP (<b>Ctrl+A</b>, <b>Ctrl+C</b>) e pressione <b>Ctrl+V</b> aqui.</p></div>`;
    $('#ots-sub').textContent = `${rows.length} remessa(s) na memória · ${rows.filter(r => r.T).length} ligada(s) a transporte`;
  }
  function importSewGrid(grids, mode) {
    for (const g of grids) {
      if (!g || !g.length) continue;
      const entries = P.parseSEW(g, mode);
      if (entries.length) return { entries, res: mergeSew(entries) };
    }
    return null;
  }

  function fieldHTML(T, k, label, opts = {}) {
    const ov = T.man[k] != null && T.man[k] !== '' && String(T.man[k]) !== String(T.base[k] || '');
    const val = T.eff[k] == null ? '' : T.eff[k];
    const req = REQUIRED.some(r => r[0] === k);
    const missing = req && !P.clean(val);
    const type = opts.type || 'text';
    return `<div class="f ${opts.cls || ''} ${ov ? 'override' : ''} ${missing ? 'missing' : ''}">
      <label for="f-${k}">${esc(label)}${req ? ' <span class="req">*</span>' : ''}${ov ? `<button type="button" class="reset" data-reset="${k}" title="Voltar ao valor do LOG: ${esc(T.base[k])}">desfazer</button>` : ''}</label>
      <input id="f-${k}" data-ov="${k}" type="${type}" value="${esc(val)}" ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''} ${opts.mono ? 'style="font-family:var(--f-mono)"' : ''}>
    </div>`;
  }

  function renderDetail() {
    const t = ui.open; const T = t && getTransport(t);
    if (!T) { closeDetail(); return; }
    $('#d-title').textContent = T.transporte;
    { const ex = [isExport(T) && comSeparacao(T) && 'separação', comIdentificador(T) && 'identificador'].filter(Boolean);
      $('#d-print-sub').textContent = ex.length ? `${2 + ex.length} páginas: check-lists + ${ex.join(' + ')}` : '2 check-lists'; }
    $('#d-fat-txt').textContent = T.faturado ? 'Desmarcar faturada' : 'Marcar como faturada';
    $('#d-fat').classList.toggle('on', !!T.faturado);
    $('#d-chips').innerHTML = [janelaChip(T), treinoChip(T), statusChip(T), T.fsc ? `<span class="chip mi">FSC ${esc(T.fsc.fsc)}</span>` : '', T.manualOnly ? '<span class="chip grey">Manual</span>' : ''].join('');
    const e = T.eff;
    const alerts = [];
    if (isAmostra(T)) alerts.push(`<div class="alert warn"><b>Amostra — conferir cliente.</b> A carga contém amostra; o aviso sai no check-list ao lado da quantidade de lotes.</div>`);
    { const tks = String(T.ot.ticket || '').split(/[\/,;\s]+/).map(P.ticketNorm).filter(k => k && state.tickets[k]);
      if (tks.length) alerts.push(`<div class="alert info"><b>Balança</b>: ${tks.map(k => `ticket ${esc(k)} · <b>${kg(state.tickets[k].liq, 0)} kg</b> líquidos`).join(' · ')}. Variação por item na guia Pesos.</div>`); }
    if (T.faturado) alerts.push(`<div class="alert ok">Ordem <b>faturada</b> em ${esc(new Date(T.faturado).toLocaleString('pt-BR'))}.</div>`);
    if (T.printed && T.alteracoes.length) alerts.push(`<div class="alert err"><b>Com alterações</b>: a ordem foi impressa em ${esc(new Date(T.printed).toLocaleString('pt-BR'))} e o agendamento mudou depois disso. Imprima novamente.<ul>${T.alteracoes.map(a => `<li>${esc(a.campo)}: <s>${esc(a.de || '—')}</s> → <b>${esc(a.para || '—')}</b></li>`).join('')}</ul></div>`);
    if (T.missing.length) alerts.push(`<div class="alert err">Faltam dados obrigatórios para imprimir: <b>${esc(T.missing.join(', '))}</b>.</div>`);
    if (T.treino.k === 'err') alerts.push(`<div class="alert warn">Motorista <b>nunca foi treinado</b> — realizar o treinamento antes do carregamento.</div>`);
    if (T.treino.k === 'warn') alerts.push(`<div class="alert warn">Treinamento do motorista <b>expirado</b> — realizar o treinamento.</div>`);
    if (T.solic) { const x = T.solic; alerts.push(`<div class="alert info">Solicitação de Embarque · carregamento <b>${esc(x.agendamento)}</b> · origem <b>${esc(x.origem)}</b>${x.sequencia ? ` · sequência ${esc(x.sequencia)}` : ''}${x.peso ? ` · peso ${fmtNum(x.peso, 0)} kg` : ''}${x.celular ? ` · celular do motorista ${esc(x.celular)}` : ''}${x.validadeTreinamento ? ` · treinamento válido até ${esc(P.fmtDateBR(x.validadeTreinamento))}` : ''}${x.cidade ? ` · destino ${esc(x.cidade)}/${esc(x.uf)}` : ''}</div>`); }
    else if (T.sew) alerts.push(`<div class="alert info">Agendamento SEW · janela <b>${T.sew.janela === 'CONTAINER' ? 'PIÊN CONTAINERS' : 'PIÊN PAINÉIS'}</b> · ${esc(P.fmtDateBR(T.sew.data))} ${esc(T.sew.hora)}${T.sew.senha ? ` · senha ${esc(T.sew.senha)}` : ''}${T.sew.status ? ` · ${esc(T.sew.status)}` : ''}${T.sew.container ? ` · container ${esc(T.sew.container)}` : ''}</div>`);
    else if (!state.sew.length) alerts.push(`<div class="alert info">Sem agendamento SEW importado — janela considerada <b>Mercado interno</b>. Ajuste abaixo se for container.</div>`);

    const tot = T.items.reduce((s, i) => s + (i.qtd || 0), 0);
    const itemsHTML = T.items.map(i => {
      const m = i.mi; const tags = [];
      if (m.familia) tags.push(`<span class="tag">${esc([m.familia, m.linha, m.acabamento].filter(Boolean).join(' '))}</span>`);
      if (m.esp) tags.push(`<span class="tag">${fmtNum(m.esp, 1)} mm</span>`);
      if (m.comp) tags.push(`<span class="tag">${m.comp}×${m.larg}</span>`);
      if (m.mercado) tags.push(`<span class="tag ${m.mercado === 'Exportação' ? 'e' : 'i'}">${esc(m.mercado)}${m.embalagem ? ' · ' + esc(m.embalagem) : ''}</span>`);
      if (m.pecasPallet) tags.push(`<span class="tag">${m.pecasPallet} pç/pallet</span>`);
      return `<tr><td class="mono">${esc(i.material)}<span class="sub">${esc(i.pedido)}</span></td><td>${esc(i.descricao)}<div class="mat-tags">${tags.join('')}</div></td><td class="num">${fmtNum(i.qtd, 0)}</td><td class="num">${fmtNum(i.pallets, 2)}</td></tr>`;
    }).join('');

    $('#d-body').innerHTML = `
      ${alerts.join('')}
      <div class="section">
        <h3>Materiais <span class="h-note">${esc(e.cliente)} · entrega ${esc(e.entrega)} · ${esc(e.incoterm)}</span></h3>
        <table class="items"><thead><tr><th>Material</th><th>Descrição / características</th><th class="num">Qtd</th><th class="num">Pallets</th></tr></thead>
        <tbody>${itemsHTML || '<tr><td colspan="4" class="muted">Sem itens (transporte manual)</td></tr>'}</tbody>
        <tfoot><tr><td></td><td class="muted">${T.items.length} item(ns)${printData(T).fracionada ? ' · <b>carga fracionada</b>' : ''}</td><td class="num"><b>${fmtNum(tot, 0)}</b></td><td class="num"><b>${fmtNum(T.pallets, 2)}</b></td></tr></tfoot></table>
      </div>
      <div class="section">
        <h3>Dados do transporte <span class="h-note">obrigatórios para impressão *</span></h3>
        <div class="fgrid">
          ${fieldHTML(T, 'data', 'Data', { type: 'date' })}
          ${fieldHTML(T, 'hora', 'Hora', { ph: 'hh:mm' })}
          ${fieldHTML(T, 'motorista', 'Nome do motorista', { cls: 'span2' })}
          ${fieldHTML(T, 'cpf', 'CPF', { mono: 1, ph: '000.000.000-00' })}
          ${fieldHTML(T, 'treinamento', 'Treinamento')}
          ${fieldHTML(T, 'transportadora', 'Transportadora', { cls: 'span2' })}
          ${fieldHTML(T, 'placaL', isTruck(e) ? 'Placa truck' : 'Placa carreta', { mono: 1, ph: 'AAA0A00 (UF)' })}
          ${fieldHTML(T, 'placaM', 'Placa cavalo ( - = truck)', { mono: 1, ph: 'AAA0A00 (UF)' })}
          ${fieldHTML(T, 'cliente', 'Cliente', { cls: 'span2' })}
          ${fieldHTML(T, 'entrega', 'Entrega', { mono: 1 })}
          <div class="f"><label for="f-janela">Janela de agendamento <span class="src">${esc(T.janelaSrc)}</span></label>
            <select id="f-janela">
              <option value="">Automático (${T.sew ? (T.sew.janela === 'CONTAINER' ? 'Container' : 'Mercado interno') : 'Mercado interno'})</option>
              <option value="MI" ${T.man.janela === 'MI' ? 'selected' : ''}>Mercado interno</option>
              <option value="CONTAINER" ${T.man.janela === 'CONTAINER' ? 'selected' : ''}>Container</option>
            </select></div>
          <div class="f"><label for="f-fsc">FSC (ao lado da OT) <span class="src">${T.man.fscSel ? 'manual' : (T.fscAuto ? 'lista FSC' : (Object.keys(state.fsc).length ? 'não está na lista' : 'lista FSC não importada'))}</span></label>
            <select id="f-fsc">
              <option value="">Automático (${T.fscAuto ? 'FSC' : 'sem FSC'})</option>
              <option value="SIM" ${T.man.fscSel === 'SIM' ? 'selected' : ''}>Sim, imprimir FSC</option>
              <option value="NAO" ${T.man.fscSel === 'NAO' ? 'selected' : ''}>Não</option>
            </select>${T.fscAuto && T.fscAuto.nome && P.norm(T.fscAuto.nome) !== P.norm(e.cliente) ? `<span class="sub">na lista como: ${esc(T.fscAuto.nome)}</span>` : ''}</div>
        </div>
      </div>
      <div class="section">
        <h3>Controle OT <span class="h-note">campos manuais</span></h3>
        <div class="fgrid three">
          ${OT_FIELDS.map(([k, l]) => `<div class="f"><label for="ot-${k}">${esc(l)}${k === 'ot' && T.otList.length > 1 ? ` (${T.otList.length})` : ''}${k === 'container' && !T.man.container && T.ot.container ? ' <span class="src">SEW</span>' : ''}${k === 'ot' && T.otSrc === 'LT22' ? ' <span class="src">tela de OTs</span>' : ''}</label><input id="ot-${k}" data-ot="${k}" value="${esc(T.ot[k])}" style="font-family:var(--f-mono)"></div>`).join('')}
        </div>
      </div>
      <div class="section">
        <h3>Documentos da ordem <span class="h-note">clique para ampliar</span></h3>
        <div class="pv-thumbs" id="pv-thumbs"></div>
        <div class="doc-extra">
          ${isExport(T) ? '<span class="chip ct">Exportação</span> <span class="muted small">' + (comSeparacao(T) ? `a impressão da ordem inclui também a <b>separação</b>${comIdentificador(T) ? ' e o <b>identificador</b> da carga' : ''}` : 'exportação terrestre/breakbulk: a impressão sai só com os check-lists (sem separação e sem identificador)') + '</span>' : '<span class="muted small">Separação e identificador saem automaticamente nas exportações; para imprimir à parte, use os botões da lateral.</span>'}
        </div>
      </div>`;
    renderThumbs(T);
  }

  function scalePage(page, boxWidth) {
    const pw = parseFloat(page.dataset.wpt || 595.304) * 96 / 72;
    const s = boxWidth / pw;
    page.style.transform = `scale(${s})`;
  }
  async function renderThumbs(T) {
    const box = $('#pv-thumbs'); if (!box) return;
    box.innerHTML = '';
    const caps = ['Check list do veículo', 'Check list da carga'];
    const pages = pagesFor(T, { extras: false });
    pages.forEach((p, i) => {
      const th = document.createElement('div'); th.className = 'thumb'; th.title = 'Ampliar';
      th.appendChild(p);
      const cap = document.createElement('span'); cap.className = 'thumb-cap'; cap.textContent = caps[i]; th.appendChild(cap);
      th.addEventListener('click', () => openPreview([T]));
      box.appendChild(th);
    });
    requestAnimationFrame(() => {
      $$('.thumb', box).forEach(th => scalePage($('.page', th), th.clientWidth));
      fitFields(box);
    });
  }

  function openPreview(list) {
    const dlg = $('#preview-dialog'); const wrap = $('#pv-pages');
    wrap.innerHTML = '';
    $('#pv-title').textContent = list.length === 1 ? `Transporte ${list[0].transporte}` : `${list.length} ordens selecionadas`;
    dlg.showModal();
    const w = Math.min(640, Math.max(320, (wrap.clientWidth - 80) / 2)); let w0 = w;
    list.forEach(T => pagesFor(T).forEach(p => {
      const box = document.createElement('div'); box.className = 'pv-page-wrap';
      const pw = parseFloat(p.dataset.wpt || 595.304), ph = parseFloat(p.dataset.hpt || 841.89);
      const bw = pw > ph ? w * 1.4 : w;
      box.style.width = bw + 'px'; box.style.height = (bw * ph / pw) + 'px'; w0 = bw;
      box.appendChild(p); wrap.appendChild(box); scalePage(p, w0);
    }));
    fitFields(wrap);
    $('#pv-print').onclick = () => { dlg.close(); printTransports(list.map(T => getTransport(T.transporte)).filter(Boolean)); };
  }

  function openDetail(t) {
    ui.open = t;
    $('#detail').hidden = false;
    $('#scrim').hidden = window.innerWidth > 1400;
    renderDetail();
    renderList();
  }
  function closeDetail() {
    ui.open = null; $('#detail').hidden = true; $('#scrim').hidden = true;
    renderList();
    const ti = $('#transporte-input'); if (ti) { ti.focus(); ti.select(); }
  }
  function renderAll() {
    renderList();
    if (ui.view === 'agenda') renderAgenda();
    if (ui.view === 'ots') renderOTs();
    if (ui.view === 'pesos') { renderPesos(); renderBalanca(); }
    renderViewCounts();
    if (ui.open) renderDetail();
  }

  // ------------------------------------------------------------------ eventos principais
  function pickDefaultDate() {
    const today = P.todayISO();
    const dates = Array.from(new Set(Object.values(state.items).map(i => (state.manual[i.transporte] || {}).data || i.data))).filter(Boolean).sort();
    if (!dates.length || dates.includes(today)) return today;
    const future = dates.filter(d => d >= today);
    return future.length ? future[0] : dates[dates.length - 1];
  }

  function bind() {
    $('#date-filter').addEventListener('change', e => { ui.date = e.target.value || P.todayISO(); ui.selected.clear(); renderAll(); });
    $$('#janela-filter button').forEach(b => b.addEventListener('click', () => {
      $$('#janela-filter button').forEach(x => x.classList.toggle('active', x === b)); ui.janela = b.dataset.v; renderList();
    }));
    let st; $('#search').addEventListener('input', e => { clearTimeout(st); st = setTimeout(() => { ui.q = e.target.value; renderAll(); }, 120); });

    $('#daily-table tbody').addEventListener('click', e => {
      if (e.target.closest('tr[data-ag]')) { toast('Este agendamento ainda não tem ordem importada. No SEW, copie a Solicitação de Embarque (Ctrl+A, Ctrl+C) e clique em "Importar ordem".', 'warn'); return; }
      const tr = e.target.closest('tr[data-t]'); if (!tr) return;
      const t = tr.dataset.t;
      const del = e.target.closest('[data-del]');
      if (del) { excluirTransportes([del.dataset.del]); return; }
      if (e.target.matches('input[type=checkbox]')) { e.target.checked ? ui.selected.add(t) : ui.selected.delete(t); renderList(); return; }
      openDetail(t);
    });
    $('#ps-mes').addEventListener('change', e => { pesoUI.mes = e.target.value || pesoUI.mes; pesoUI.aberto = null; renderPesos(); });
    $('#ps-tol').addEventListener('change', e => { pesoUI.tol = Math.max(0.1, P.toNum(e.target.value) || 3); renderPesos(); });
    $('#ps-colar').addEventListener('click', () => colarPorBotao('pesos'));
    bindBalanca();
    $('#ps-xlsx').addEventListener('click', () => { const t = exportarPesos(); toast(t === 'xlsx' ? 'Análise de pesos exportada (.xlsx).' : 'Exportada em .csv (sem internet, o .xlsx não está disponível).', 'ok'); });
    $('#ps-file').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return; e.target.value = '';
      try {
        let grid;
        if (/\.(csv|txt)$/i.test(f.name)) grid = P.trimGrid(P.parseTSV((await f.text()).replace(/;/g, '\t')));
        else { if (!window.XLSX) throw new Error('a leitura de Excel precisa de internet. Salve como CSV ou copie e cole.'); const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' }); grid = P.trimGrid(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' })); }
        importarPesosGrid(grid, f.name);
      } catch (er) { toast('Não foi possível ler o arquivo: ' + (er.message || er), 'err'); }
    });
    $('#pesos').addEventListener('click', e => {
      const a = e.target.closest('[data-pt]'); if (a) { e.preventDefault(); openDetail(a.dataset.pt); return; }
      const tr = e.target.closest('tr.ps-item'); if (!tr) return;
      pesoUI.aberto = pesoUI.aberto === tr.dataset.mat ? null : tr.dataset.mat; renderPesos();
    });
    $('#ots').addEventListener('click', e => { const tr = e.target.closest('tr[data-t]'); if (tr) openDetail(tr.dataset.t); });
    $('#agenda').addEventListener('click', e => { const tr = e.target.closest('tr[data-t]'); if (tr) openDetail(tr.dataset.t); });
    $$('#views button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
    $$('#ag-mode button').forEach(b => b.addEventListener('click', () => { $$('#ag-mode button').forEach(x => x.classList.toggle('active', x === b)); ui.agMode = b.dataset.v; }));
    $('#btn-del-selected').addEventListener('click', () => excluirTransportes(visibleTransports().filter(T => ui.selected.has(T.transporte)).map(T => T.transporte)));
    $('#btn-fat-selected').addEventListener('click', () => { const ts = Array.from(ui.selected); setFat(ts, true); ui.selected.clear(); renderAll(); toast(`${ts.length} ordem(ns) marcada(s) como faturada(s).`, 'ok'); });
    $('#d-fat').addEventListener('click', () => { const T = getTransport(ui.open); if (!T) return; setFat([T.transporte], !T.faturado); renderAll(); toast(T.faturado ? `Transporte ${T.transporte}: faturamento desmarcado.` : `Transporte ${T.transporte} marcado como faturado.`, 'ok'); });
    $('#check-all').addEventListener('change', e => {
      visibleTransports().forEach(T => e.target.checked ? ui.selected.add(T.transporte) : ui.selected.delete(T.transporte)); renderList();
    });
    $('#btn-print-selected').addEventListener('click', () => {
      const list = visibleTransports().filter(T => ui.selected.has(T.transporte));
      printTransports(list);
    });

    $('#transporte-form').addEventListener('submit', async e => {
      e.preventDefault();
      const t = P.intStr($('#transporte-input').value).replace(/\D/g, '');
      if (!t) return;
      const T = getTransport(t);
      if (T) {
        if (T.eff.data && T.eff.data !== ui.date) { ui.date = T.eff.data; $('#date-filter').value = ui.date; }
        openDetail(t); $('#transporte-input').select(); return;
      }
      const ok = await confirmBox('Transporte não encontrado', `<p>O transporte <b>${esc(t)}</b> não está na tabela importada.</p><p>Deseja criá-lo manualmente para preencher os dados e imprimir a ordem?</p>`, 'Criar transporte manual');
      if (ok) createManual(t);
    });
    $('#btn-new-manual').addEventListener('click', async () => {
      const t = P.intStr($('#transporte-input').value).replace(/\D/g, '');
      if (t && !getTransport(t)) return createManual(t);
      $('#transporte-input').focus();
      toast('Digite o número do transporte no campo "Transporte" e pressione Abrir.', 'warn');
    });

    $('#d-close').addEventListener('click', closeDetail);
    $('#scrim').addEventListener('click', closeDetail);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && ui.open && !document.querySelector('dialog[open]')) closeDetail();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && ui.open && !document.querySelector('dialog[open]')) {
        e.preventDefault(); const T = getTransport(ui.open); if (T) printTransports([T]);
      }
    });
    $('#d-print').addEventListener('click', () => { const T = getTransport(ui.open); if (T) printTransports([T]); });

    // edição no painel
    $('#d-body').addEventListener('input', e => {
      const t = ui.open; if (!t) return;
      const man = state.manual[t] || (state.manual[t] = {});
      if (e.target.dataset.ov) {
        const k = e.target.dataset.ov; let v = e.target.value;
        if (k === 'motorista') v = v.toUpperCase();
        const base = (getTransport(t) || {}).base || {};
        if (P.clean(v) === P.clean(base[k])) delete man[k]; else man[k] = v;
      } else if (e.target.dataset.ot) {
        const k = e.target.dataset.ot; const v = e.target.value.trim();
        if (v) man[k] = k === 'container' || k === 'lacre' ? v.toUpperCase() : v; else delete man[k];
      } else return;
      save();
      softRefresh();
    });
    $('#d-body').addEventListener('change', e => {
      const t = ui.open; if (!t) return;
      const man = state.manual[t] || (state.manual[t] = {});
      if (e.target.dataset.ot === 'nf') { aplicarNF(t, e.target.value); softRefresh(); return; }
      if (e.target.id === 'f-fsc') { if (e.target.value) man.fscSel = e.target.value; else delete man.fscSel; save(); renderAll(); return; }
      if (e.target.id === 'f-janela') { if (e.target.value) man.janela = e.target.value; else delete man.janela; save(); renderAll(); return; }
      if (e.target.dataset.ov === 'cpf' && man.cpf) { man.cpf = P.fmtCPF(man.cpf); e.target.value = man.cpf; }
      if ((e.target.dataset.ov === 'placaL' || e.target.dataset.ov === 'placaM') && man[e.target.dataset.ov]) { man[e.target.dataset.ov] = P.normPlate(man[e.target.dataset.ov]); e.target.value = man[e.target.dataset.ov]; }
      // sem redesenhar o painel: o usuário pode estar clicando no próximo campo
      save(); softRefresh();
    });
    $('#d-del').addEventListener('click', () => { if (ui.open) excluirTransportes([ui.open]); });
    $('#d-actions').addEventListener('click', e => {
      const doc = e.target.closest('[data-doc]'); if (!doc) return;
      const T = getTransport(ui.open); if (!T) return;
      if (doc.dataset.doc === 'ver') { openPreview([T]); return; }
      imprimirAvulso([doc.dataset.doc === 'sep' ? buildSeparacao(T) : buildIdentificador(T)]);
    });
    $('#d-body').addEventListener('click', e => {
      const doc = e.target.closest('[data-doc]');
      if (doc) {
        const T = getTransport(ui.open); if (!T) return;
        if (doc.dataset.doc === 'ver') { openPreview([T]); return; }
        imprimirAvulso([doc.dataset.doc === 'sep' ? buildSeparacao(T) : buildIdentificador(T)]);
        return;
      }
      const b = e.target.closest('[data-reset]'); if (!b) return;
      const man = state.manual[ui.open] || {}; delete man[b.dataset.reset]; save(); renderAll();
    });

    // botões de cópia
    $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      const T = getTransport(ui.open); if (!T) return;
      const { text, need } = copyText(b.dataset.copy, T);
      const ok = await toClipboard(text);
      b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 1200);
      const nome = { texto: 'Dados de texto (VL02N/texto)', balanca: 'Dados de balança', motorista: 'Dados do motorista (VT02N)', placa: 'Placa p/ nota (VL02N/placa)' }[b.dataset.copy];
      toast(`${ok ? 'Copiado' : 'Não foi possível copiar'}: ${nome}${need.length ? ` — em branco: ${need.join(', ')}` : ''}`, ok ? (need.length ? 'warn' : 'ok') : 'err', text);
    }));

    $('#btn-copy-list').addEventListener('click', async () => {
      const list = visibleTransports();
      const head = ['Hora', 'Transporte', 'Janela', 'Cliente', 'Entrega', 'Material', 'Descrição', 'Qtd', 'Pallets', 'Placa carreta/truck', 'Placa cavalo', 'Motorista', 'CPF', 'Treinamento', 'Transportadora', 'OT', 'Status'];
      const rows = [];
      list.forEach(T => T.items.forEach(i => rows.push([T.eff.hora, T.transporte, T.janela === 'CONTAINER' ? 'CONTAINER' : 'MERCADO INTERNO', T.eff.cliente, T.eff.entrega, i.material, i.descricao, fmtNum(i.qtd, 0), fmtNum(i.pallets, 2), T.eff.placaL, T.eff.placaM, T.eff.motorista, P.fmtCPF(T.eff.cpf), T.eff.treinamento, T.eff.transportadora, T.ot.ot, T.printed ? 'ordem impressa' : ''])));
      const ok = await toClipboard([head].concat(rows).map(r => r.join('\t')).join('\n'));
      toast(ok ? `Lista copiada (${rows.length} linha(s)) — cole no Excel.` : 'Não foi possível copiar.', ok ? 'ok' : 'err');
    });

    document.addEventListener('paste', e => {
      const tg = e.target;
      if (document.querySelector('dialog[open]') || (tg && (tg.closest('input,textarea,select,[contenteditable]')))) return;
      const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (!text.trim()) return;
      e.preventDefault();
      processarColagem(text, e.clipboardData.getData('text/html'), null);
    });
    // botões de colagem da tela inicial (cada um já sabe qual processo é)
    $$('[data-colar]').forEach(b => b.addEventListener('click', () => colarPorBotao(b.dataset.colar)));
    $('#paste-area').addEventListener('paste', e => {
      const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
      if (!text.trim()) return;
      e.preventDefault();
      const tipo = $('#paste-dialog').dataset.tipo;
      $('#paste-dialog').close();
      processarColagem(text, e.clipboardData.getData('text/html'), tipo);
    });
    $('#paste-close').addEventListener('click', () => $('#paste-dialog').close());
    $('#pv-close').addEventListener('click', () => $('#preview-dialog').close());
    $('#btn-demo').addEventListener('click', loadDemo);
    window.addEventListener('resize', () => { if (ui.open) { const T = getTransport(ui.open); if (T) renderThumbs(T); } });
  }

  // ------------------------------------------------------------------ colagem (Ctrl+V) por processo
  const COLAR = {
    ordem: { titulo: 'Ordem — Solicitação de Embarque', dica: 'No SEW, abra a Solicitação de Embarque, Ctrl+A e Ctrl+C.' },
    MI: { titulo: 'Agendamento — Mercado interno', dica: 'No SEW, Agendamento de Cargas · PIÊN PAINÉIS, Ctrl+A e Ctrl+C.' },
    CONTAINER: { titulo: 'Agendamento — Exportação (containers)', dica: 'No SEW, Agendamento de Cargas · PIÊN CONTAINERS, Ctrl+A e Ctrl+C.' },
    ots: { titulo: 'LT22 — OTs', dica: 'No SAP, tela de OTs (LT22), Ctrl+A e Ctrl+C.' },
    tickets: { titulo: 'Balança — tickets de pesagem', dica: 'Copie a tabela diária da balança com a linha de títulos (Ticket, peso entrada/saída ou líquido, data, placa…), Ctrl+C.' },
    pesos: { titulo: 'Base de pesos', dica: 'Copie a base com a linha de títulos (NF, peso líquido, peso bruto…), Ctrl+C.' },
  };
  async function colarPorBotao(tipo) {
    if (tipo === 'fsc') { imp.tab = 'fsc'; $('#btn-import').click(); setTimeout(() => $('#fsc-file').click(), 120); return; }
    // tenta ler a área de transferência direto; se o navegador não deixar, abre a caixa de colar
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        let text = '', html = '';
        for (const it of items) {
          if (it.types.includes('text/plain')) text = await (await it.getType('text/plain')).text();
          if (it.types.includes('text/html')) html = await (await it.getType('text/html')).text();
        }
        if (text.trim()) { processarColagem(text, html, tipo); return; }
      }
    } catch (e) { /* sem permissão: usa a caixa */ }
    const dlg = $('#paste-dialog');
    dlg.dataset.tipo = tipo;
    $('#paste-title').textContent = COLAR[tipo].titulo;
    $('#paste-hint').textContent = COLAR[tipo].dica;
    $('#paste-area').value = '';
    dlg.showModal();
    setTimeout(() => $('#paste-area').focus(), 30);
  }
  // tipo: 'ordem' | 'MI' | 'CONTAINER' | 'ots' | null (detectar pelo conteúdo)
  function processarColagem(text, html, tipo) {
    text = P.fixMojibake(text);
    const htmlGrid = html && /<table/i.test(html) ? P.trimGrid(P.parseHTMLTable(html) || []) : null;
    // a Solicitação de Embarque é inconfundível: vai para "ordem" mesmo que o botão seja outro
    if (tipo && tipo !== 'ordem' && P.isSolicitacao(text)) { toast(`Isso é uma Solicitação de Embarque (não ${COLAR[tipo].titulo}). Importei como ordem.`, 'warn'); tipo = 'ordem'; }
    const auto = !tipo;
    if ((tipo === 'ordem' || auto) && P.isSolicitacao(text)) {
      const list = P.parseSolicitacoes(text);
      const its = list.length ? importSolicitacoes(list) : [];
      if (!its.length) { toast('Página reconhecida, mas sem a tabela de itens. Copie a página inteira (Ctrl+A, Ctrl+C) e cole de novo.', 'err'); return; }
      const t = its[0].transporte, d = its[0].data;
      if (d) { ui.date = d; $('#date-filter').value = d; }
      if (ui.view !== 'lista') setView('lista');
      renderAll(); openDetail(t);
      const T = getTransport(t);
      toast(`Transporte ${t} importado da Solicitação de Embarque (${T.janela === 'CONTAINER' ? 'container' : 'mercado interno'}).${T.missing.length ? ' Falta: ' + T.missing.join(', ') : ' Pronto para imprimir.'}`, T.missing.length ? 'warn' : 'ok');
      return;
    }
    // tabela diária da balança (ticket + pesos) — antes da base de pesos, que também tem "peso"
    if (tipo === 'tickets' || (auto && /ticket/i.test(text) && /peso|entrada|sa[ií]da|l[ií]quido/i.test(text))) {
      for (const g of [htmlGrid, P.trimGrid(P.parseTSV(text))]) { if (g && g.length && importarTicketsGrid(g, 'colada')) return; }
      if (tipo === 'tickets') { toast('Não reconheci a tabela da balança. Copie com a linha de títulos (Ticket, Peso entrada/saída ou Peso líquido…).', 'err'); return; }
    }
    // base de pesos (NF + peso líquido/bruto)
    if (tipo === 'pesos' || (auto && (ui.view === 'pesos' || (/peso\s*(l[ií]q|bru)/i.test(text) && /\b(NF|NF-?e|nota)/i.test(text))))) {
      for (const g of [htmlGrid, P.trimGrid(P.parseTSV(text))]) { if (g && g.length && P.parsePesos(g).rows.length) { importarPesosGrid(g, 'colada'); return; } }
      if (tipo === 'pesos' || ui.view === 'pesos') { toast('Não reconheci a base de pesos. Copie com a linha de títulos (NF, Peso líquido, Peso bruto…).', 'err'); return; }
    }
    // LT22 / OTs
    if (tipo === 'ots' || (auto && (ui.view === 'ots' || P.isOTScreen(text)))) {
      let rows = P.parseLT22Lista(text); // lista do SAP (formato da LT22)
      if (!rows.length) for (const g of [htmlGrid, P.trimGrid(P.parseTSV(text))]) { if (g && g.length) { rows = P.parseOTs(g, knownSets()); if (rows.length) break; } }
      if (rows.length) {
        const r = mergeOTs(rows); save(true); renderAll();
        const lig = rows.filter(x => transportByEntrega().has(x.remessa)).length;
        toast(`OTs (LT22) atualizadas: ${r.remessas} remessa(s), ${r.novas} OT(s) nova(s) · ${lig} linha(s) ligada(s) a transporte. Detalhes na guia OTs.`, 'ok');
        return;
      }
      if (!auto || ui.view === 'ots') { toast('Não reconheci a tela de OTs. Confira se copiou a tela LT22 com as linhas de remessa e OT.', 'err'); return; }
    }
    // Agendamento de Cargas (mercado interno / exportação)
    const sewLike = tipo === 'MI' || tipo === 'CONTAINER' || (auto && (ui.view === 'agenda' || /Agendamento de Cargas|PI[EÊ]N (PAINEIS|PAINÉIS|CONTAINERS)|Tp\.?\s*Ve[ií]culo/i.test(text)));
    if (sewLike) {
      const r = importSewGrid([htmlGrid, P.parseTSV(text)], tipo === 'MI' || tipo === 'CONTAINER' ? tipo : ui.agMode);
      if (r) {
        save(true);
        const ds = Array.from(new Set(r.entries.map(x => x.data))).sort();
        if (ds.length && !ds.includes(ui.date)) { ui.date = ds.includes(P.todayISO()) ? P.todayISO() : ds[0]; $('#date-filter').value = ui.date; }
        renderAll();
        const mi = r.entries.filter(x => x.janela === 'MI').length, ct = r.entries.length - mi;
        const alt = allTransports().filter(T => T.printed && !T.faturado && T.alteracoes.length).length;
        toast(`Agendamentos atualizados: ${mi} mercado interno · ${ct} exportação/containers.${r.res.alteradas ? ` ${r.res.alteradas} alterado(s).` : ''}${r.res.novas ? ` ${r.res.novas} novo(s).` : ''}${r.res.removidas ? ` ${r.res.removidas} removido(s).` : ''}${alt ? ` ${alt} ordem(ns) impressa(s) com alterações!` : ''} Detalhes na guia Agendamentos.`, alt ? 'err' : 'ok');
        return;
      }
      if (!auto || ui.view === 'agenda') { toast('Não reconheci a tela de agendamento. Copie a página com a linha de títulos (Data, Hora, Seq, Senha, Carreta…).', 'err'); return; }
    }
    // tabela (LOG/SAP): abre a importação já com o conteúdo colado
    imp.tab = 'log';
    $('#btn-import').click();
    imp.html = htmlGrid; $('#log-paste').value = text; parseLogPaste();
  }

  // atualiza sem perder o foco do campo que está sendo digitado
  let softTimer;
  function softRefresh() {
    clearTimeout(softTimer);
    softTimer = setTimeout(() => {
      const T = getTransport(ui.open); if (!T) return;
      $('#d-chips').innerHTML = [janelaChip(T), treinoChip(T), statusChip(T), T.fsc ? `<span class="chip mi">FSC ${esc(T.fsc.fsc)}</span>` : '', T.manualOnly ? '<span class="chip grey">Manual</span>' : ''].join('');
      $('#d-fat-txt').textContent = T.faturado ? 'Desmarcar faturada' : 'Marcar como faturada';
      $('#d-fat').classList.toggle('on', !!T.faturado);
      $$('[data-ov]', $('#d-body')).forEach(inp => {
        const k = inp.dataset.ov; const f = inp.closest('.f');
        const req = REQUIRED.some(r => r[0] === k);
        f.classList.toggle('missing', req && !P.clean(T.eff[k]));
        f.classList.toggle('override', T.man[k] != null && String(T.man[k]) !== String(T.base[k] || ''));
      });
      renderThumbs(T);
      renderList();
    }, 180);
  }

  function createManual(t) {
    const it = { transporte: t, manualOnly: true, data: ui.date || P.todayISO(), hora: '', cliente: '', descricao: '', entrega: '', incoterm: '', material: '', agItem: '', pedido: '', qtd: null, placaL: '', placaM: '', motorista: '', cpf: '', cpfStatus: '', transportadora: '', treinamento: '', tipoVeiculo: '', obs: '' };
    it.key = `${t}|manual`;
    state.items[it.key] = it; save(true);
    openDetail(t);
    toast(`Transporte ${t} criado. Preencha os dados obrigatórios para imprimir.`, 'ok');
  }

  // ------------------------------------------------------------------ importação
  const imp = { tab: 'log', log: null, sew: null, fsc: null, xlsx: null, html: null, sewMode: 'auto' };
  function bindImport() {
    const dlg = $('#import-dialog');
    const open = () => { setTab(imp.tab); dlg.showModal(); updateBackupInfo(); };
    $('#btn-import').addEventListener('click', open);
    document.addEventListener('click', e => { if (e.target.closest('[data-open-import]')) open(); });
    $$('#import-tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

    // LOG
    const ta = $('#log-paste');
    ta.addEventListener('paste', e => {
      const html = e.clipboardData && e.clipboardData.getData('text/html');
      imp.html = html && /<table/i.test(html) ? P.trimGrid(P.parseHTMLTable(html) || []) : null;
    });
    let lt; ta.addEventListener('input', () => { clearTimeout(lt); lt = setTimeout(parseLogPaste, 150); });
    $('#log-clear').addEventListener('click', () => { ta.value = ''; imp.html = null; imp.log = null; $('#log-preview').innerHTML = ''; updateApply(); });
    $('#log-preview').addEventListener('change', e => {
      if (!e.target.dataset.col || !imp.log) return;
      imp.log.mapping.map[+e.target.dataset.col] = e.target.value || null;
      imp.log.mapping.mode = 'manual';
      refreshLogPreview();
    });

    // SEW
    const sta = $('#sew-paste');
    sta.addEventListener('paste', e => {
      const html = e.clipboardData && e.clipboardData.getData('text/html');
      imp.sewHtml = html && /<table/i.test(html) ? P.trimGrid(P.parseHTMLTable(html) || []) : null;
    });
    let swt; sta.addEventListener('input', () => { clearTimeout(swt); swt = setTimeout(parseSewPaste, 150); });
    $$('#sew-mode button').forEach(b => b.addEventListener('click', () => {
      $$('#sew-mode button').forEach(x => x.classList.toggle('active', x === b)); imp.sewMode = b.dataset.v; parseSewPaste();
    }));

    // FSC
    let ft; $('#fsc-paste').addEventListener('input', () => { clearTimeout(ft); ft = setTimeout(() => {
      const g = P.trimGrid(P.parseTSV($('#fsc-paste').value));
      if (!g.length) return;
      salvarFSC(P.parseFSC(g), 'colado');
    }, 400); });

    // planilha FSC (arquivo)
    $('#fsc-file').addEventListener('change', e => { const f = e.target.files[0]; if (f) lerPlanilhaFSC(f); });
    // XLSX
    const fi = $('#xlsx-file'); const drop = $('#xlsx-drop');
    fi.addEventListener('change', () => fi.files[0] && readWorkbook(fi.files[0]));
    ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
    drop.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) readWorkbook(f); });

    // backup
    $('#backup-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ordens-embarque-backup-${P.todayISO()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    $('#backup-import').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const s = JSON.parse(await f.text());
        if (!s || s.v !== 1 || typeof s.items !== 'object') throw new Error('formato');
        const ok = await confirmBox('Restaurar backup', `<p>Substituir os dados atuais pelos do arquivo <b>${esc(f.name)}</b>?</p>`, 'Restaurar');
        if (!ok) return;
        state = Object.assign(emptyState(), s); save(true); ui.date = pickDefaultDate(); $('#date-filter').value = ui.date; renderAll(); updateBackupInfo();
        toast('Backup restaurado.', 'ok');
      } catch (er) { toast('Arquivo de backup inválido.', 'err'); }
      e.target.value = '';
    });
    $('#backup-clear-old').addEventListener('click', async () => {
      const today = P.todayISO();
      const old = Object.values(state.items).filter(i => (i.data || '') < today);
      if (!old.length) return toast('Não há transportes de dias anteriores.', 'warn');
      const ts = new Set(old.map(i => i.transporte));
      const ok = await confirmBox('Apagar dias anteriores', `<p>Apagar ${ts.size} transporte(s) com data anterior a ${P.fmtDateBR(today)}? Faça um backup antes, se quiser guardar o histórico.</p>`, 'Apagar');
      if (!ok) return;
      old.forEach(i => delete state.items[i.key]);
      ts.forEach(t => { if (!Object.values(state.items).some(i => i.transporte === t)) { delete state.manual[t]; delete state.printed[t]; } });
      state.sew = state.sew.filter(s => s.data >= today);
      save(true); renderAll(); updateBackupInfo(); toast('Dias anteriores apagados.', 'ok');
    });

    $('#import-apply').addEventListener('click', () => { applyImport(); });
  }
  async function lerPlanilhaFSC(file) {
    const st = $('#fsc-preview');
    try {
      let grid = null;
      if (/\.csv$|\.txt$/i.test(file.name)) grid = P.trimGrid(P.parseTSV((await file.text()).replace(/;/g, '\t')));
      else {
        if (!window.XLSX) throw new Error('a leitura de Excel precisa de internet (biblioteca SheetJS). Sem internet, salve a planilha como CSV ou copie e cole as linhas abaixo.');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
        const nomes = wb.SheetNames.slice().sort((a, b) => (P.norm(b) === 'FSC') - (P.norm(a) === 'FSC'));
        for (const n of nomes) {
          const g = P.trimGrid(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }));
          if (g.length && Object.keys(P.parseFSC(g)).length) { grid = g; break; }
        }
      }
      salvarFSC(grid ? P.parseFSC(grid) : null, file.name);
    } catch (er) { imp.fsc = null; st.innerHTML = `<div class="alert err">Não foi possível ler a planilha: ${esc(er.message || er)}</div>`; updateApply(); }
  }
  // base FSC importada (arquivo ou colagem) fica salva no app na hora, sem precisar clicar em Importar
  function salvarFSC(lista, arquivo) {
    const n = lista ? Object.keys(lista).length : 0;
    imp.fsc = null;
    if (!n) {
      $('#fsc-preview').innerHTML = '<div class="alert warn">Nenhum cliente reconhecido. A planilha precisa ter a coluna com o nome do cliente (ex.: "Nome Cliente"). A lista atual foi mantida.</div>';
      return updateApply();
    }
    state.fsc = lista; fscIdx = null;
    state.fscInfo = { em: new Date().toISOString(), arquivo: arquivo || '', total: n };
    save(true); renderAll();
    const vals = Object.values(lista), ativos = vals.filter(x => x.ativo !== false).length;
    const hoje = allTransports().filter(T => T.eff.data === ui.date);
    const casam = hoje.filter(T => fscOf(T.eff.cliente));
    $('#fsc-preview').innerHTML = `<div class="alert ok"><b>Base FSC salva no app</b>: ${n} cliente(s) · <b>${ativos}</b> ativo(s)${n - ativos ? ` · ${n - ativos} excluído(s)` : ''}.
      ${hoje.length ? `Nas cargas de ${esc(P.fmtDateBR(ui.date))}: <b>${casam.length}</b> de ${hoje.length} são FSC${casam.length ? ` (${esc(casam.slice(0, 5).map(T => T.eff.cliente).join(', '))}${casam.length > 5 ? '…' : ''})` : ''}.` : ''}
      ${sync && sync.status().mode === 'shared' ? 'Compartilhada com a equipe.' : ''}</div>`;
    $('#fsc-paste').value = ''; $('#fsc-file').value = '';
    atualizaFscAtual(); updateApply();
    toast(`Base FSC salva: ${n} cliente(s). O campo FSC ao lado da OT já usa a nova lista.`, 'ok');
  }
  function atualizaFscAtual() {
    const inf = state.fscInfo, n = Object.keys(state.fsc).length;
    $('#fsc-atual').innerHTML = n ? `Lista salva no app: <b>${n}</b> cliente(s)${inf ? ` · importada em ${esc(new Date(inf.em).toLocaleString('pt-BR'))}${inf.arquivo ? ` (${esc(inf.arquivo)})` : ''}` : ''}.` : 'Nenhuma lista FSC importada ainda.';
  }
  function setTab(tab) {
    imp.tab = tab;
    $$('#import-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('#import-dialog .tab-pane').forEach(p => p.hidden = p.dataset.pane !== tab);
    $('#import-apply').hidden = tab === 'backup' || tab === 'fsc';
    if (tab === 'fsc') atualizaFscAtual();
    updateApply();
  }
  function updateApply() {
    const ready = { log: (imp.log && imp.log.items.length) || (imp.sol && imp.sol.length), sew: imp.sew && imp.sew.length, fsc: imp.fsc && Object.keys(imp.fsc).length, xlsx: imp.xlsx }[imp.tab];
    $('#import-apply').disabled = !ready;
    const msg = {
      log: imp.sol ? `${imp.sol.length} solicitação(ões) de embarque` : imp.log ? `${imp.log.items.length} linha(s) · ${new Set(imp.log.items.map(i => i.transporte)).size} transporte(s)` : '',
      sew: imp.sew ? `${imp.sew.length} agendamento(s)` : '',
      fsc: '', xlsx: imp.xlsx ? imp.xlsx.summary : '', backup: '',
    }[imp.tab];
    $('#import-msg').textContent = msg || '';
  }
  function updateBackupInfo() {
    const n = new Set(Object.values(state.items).map(i => i.transporte)).size;
    $('#backup-info').textContent = `${n} transporte(s) · ${state.sew.length} agendamento(s) SEW · ${Object.keys(state.fsc).length} cliente(s) FSC salvos neste navegador.`;
  }

  function parseLogPaste() {
    const text = $('#log-paste').value;
    imp.sol = null;
    if (!text.trim()) { imp.log = null; $('#log-preview').innerHTML = ''; updateApply(); return; }
    if (P.isSolicitacao(text)) { imp.log = null; imp.sol = P.parseSolicitacoes(text); renderSolPreview(); return; }
    const grid = imp.html && imp.html.length ? imp.html : P.trimGrid(P.parseTSV(text));
    const mapping = P.detectLogMapping(grid);
    imp.log = { grid, mapping, items: [] };
    refreshLogPreview();
  }
  function refreshLogPreview() {
    const { grid, mapping } = imp.log;
    const res = P.rowsToItems(grid, mapping);
    imp.log.items = res.items;
    const ncol = Math.max(...grid.map(r => r.length));
    const opts = k => `<option value="">— ignorar —</option>` + P.LOG_COLS.map(([key, l]) => `<option value="${key}" ${k === key ? 'selected' : ''}>${esc(l)}</option>`).join('');
    const dates = Array.from(new Set(res.items.map(i => i.data).filter(Boolean))).sort();
    const badSet = new Set(res.bad);
    const rows = grid.slice(mapping.headerRow + 1, mapping.headerRow + 41);
    $('#log-preview').innerHTML = `
      <div class="row-actions"><span class="muted">Colunas identificadas por <b>${esc(mapping.mode)}</b> · ${res.items.length} linha(s) válida(s) · ${new Set(res.items.map(i => i.transporte)).size} transporte(s) · data(s): ${dates.map(P.fmtDateBR).join(', ') || '—'}${res.bad.length ? ` · <b style="color:var(--err)">${res.bad.length} linha(s) ignorada(s) sem nº de transporte</b>` : ''}</span></div>
      <div class="preview-wrap"><table>
        <thead><tr>${Array.from({ length: ncol }, (_, i) => `<th><select data-col="${i}" class="${mapping.map[i] ? '' : 'unmapped'}">${opts(mapping.map[i])}</select></th>`).join('')}</tr></thead>
        <tbody>${rows.map((r, ri) => `<tr class="${badSet.has(ri + mapping.headerRow + 1) ? 'bad' : ''}">${Array.from({ length: ncol }, (_, i) => `<td>${esc(P.clean(r[i]))}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    updateApply();
  }
  function renderSolPreview() {
    const its = [].concat(...imp.sol.map(x => x.items));
    $('#log-preview').innerHTML = its.length ? `
      <div class="row-actions"><span class="muted">Reconhecida(s) <b>${imp.sol.length} Solicitação(ões) de Embarque</b> · ${new Set(its.map(i => i.transporte)).size} transporte(s)</span></div>
      <div class="preview-wrap"><table><thead><tr><th>Transporte</th><th>Janela</th><th>Data</th><th>Hora</th><th>Carregamento</th><th>Placa carreta</th><th>Cavalo</th><th>Motorista</th><th>CPF</th><th>Transportadora</th><th>Cliente</th><th>Material</th><th>Qtd</th><th>Container</th></tr></thead>
      <tbody>${its.map(i => `<tr><td>${esc(i.transporte)}</td><td>${i.janela === 'CONTAINER' ? 'Container' : 'Merc. interno'}</td><td>${P.fmtDateBR(i.data)}</td><td>${esc(i.hora)}</td><td>${esc(i.agendamento)}</td><td>${esc(i.placaL)}</td><td>${esc(i.placaM)}</td><td>${esc(i.motorista)}</td><td>${esc(i.cpf)}</td><td>${esc(i.transportadora)}</td><td>${esc(i.cliente)}</td><td>${esc(i.descricao)}</td><td>${fmtNum(i.qtd, 0)}</td><td>${esc(i.container)}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="alert warn">A página foi reconhecida como Solicitação de Embarque, mas a tabela de itens (Pedido · Entrega · Carga…) não veio na cópia. Copie a página inteira (Ctrl+A, Ctrl+C).</div>';
    updateApply();
  }
  function parseSewPaste() {
    const text = $('#sew-paste').value;
    if (!text.trim()) { imp.sew = null; $('#sew-preview').innerHTML = ''; updateApply(); return; }
    const grid = imp.sewHtml && imp.sewHtml.length ? imp.sewHtml : P.parseTSV(text);
    imp.sew = P.parseSEW(grid, imp.sewMode);
    const mi = imp.sew.filter(s => s.janela === 'MI').length, ct = imp.sew.length - mi;
    $('#sew-preview').innerHTML = imp.sew.length ? `
      <div class="row-actions"><span class="muted">${mi} em <b>Mercado interno</b> · ${ct} em <b>Containers</b></span></div>
      <div class="preview-wrap"><table><thead><tr><th>Janela</th><th>Data</th><th>Hora</th><th>Senha</th><th>Carreta</th><th>Cavalo</th><th>CPF</th><th>Container</th><th>Transportadora</th><th>Cliente</th><th>Status</th></tr></thead>
      <tbody>${imp.sew.slice(0, 60).map(s => `<tr><td>${s.janela === 'CONTAINER' ? 'Container' : 'Merc. interno'}</td><td>${P.fmtDateBR(s.data)}</td><td>${esc(s.hora)}</td><td>${esc(s.senha)}</td><td>${esc(s.carreta)}</td><td>${esc(s.cavalo)}</td><td>${esc(s.cpf)}</td><td>${esc(s.container)}</td><td>${esc(s.transportadora)}</td><td>${esc(s.cliente)}</td><td>${esc(s.status)}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="alert warn">Nenhum agendamento reconhecido. Copie a tela incluindo a linha de títulos (Data, Hora, Seq, Senha, …).</div>';
    updateApply();
  }

  function mergeLogItems(items, replaceDates) {
    if (replaceDates) {
      const dates = new Set(items.map(i => i.data).filter(Boolean));
      Object.values(state.items).forEach(i => { if (!i.manualOnly && dates.has(i.data)) delete state.items[i.key]; });
    }
    const ts = new Set(items.map(i => i.transporte));
    // transporte criado manualmente que agora chegou do LOG: mantém só o do LOG
    Object.values(state.items).forEach(i => { if (i.manualOnly && ts.has(i.transporte)) delete state.items[i.key]; });
    items.forEach(i => { state.items[i.key] = i; });
  }
  function importSolicitacoes(list) {
    const items = [].concat(...list.map(x => x.items));
    const ts = new Set(items.map(i => i.transporte));
    // a página do SEW é a versão mais recente do transporte: substitui os itens dele
    Object.values(state.items).forEach(i => { if (ts.has(i.transporte)) delete state.items[i.key]; });
    items.forEach(i => { state.items[i.key] = i; });
    const keys = new Set(list.map(x => x.carregamento).filter(Boolean));
    state.sew = state.sew.filter(e => !(e.carregamento && keys.has(e.carregamento))).concat(list.map(x => x.sew));
    save(true);
    return items;
  }
  // Cada colagem da tela de agendamento substitui as janelas/dias colados.
  // O que mudou em relação à colagem anterior fica registrado em `changes`, e o
  // agendamento que sumiu fica marcado como removido (não é apagado).
  function mergeSew(entries) {
    const now = new Date().toISOString();
    const groups = new Set(entries.map(e => e.janela + '|' + e.data));
    const inGroup = e => !e.carregamento && groups.has(e.janela + '|' + e.data);
    const prev = new Map(state.sew.filter(inGroup).map(e => [sewKey(e), e]));
    const keep = state.sew.filter(e => !inGroup(e));
    const seen = new Set(); let alteradas = 0, novas = 0, removidas = 0;
    const merged = entries.map(e => {
      const k = sewKey(e); seen.add(k);
      const old = prev.get(k);
      const n = Object.assign({}, e, { firstSeen: old ? old.firstSeen : now, updatedAt: now, changes: old ? (old.changes || []).slice() : [] });
      if (!old) { if (prev.size) novas++; return n; }
      const ch = SEW_TRACK.filter(([f]) => P.clean(old[f]) !== P.clean(e[f])).map(([f, l]) => ({ campo: l, de: old[f] || '', para: e[f] || '', em: now }));
      if (old.removed) ch.push({ campo: 'Agendamento', de: 'removido', para: 'ativo', em: now });
      if (ch.length) { alteradas++; n.changes.push(...ch); }
      return n;
    });
    prev.forEach((o, k) => {
      if (seen.has(k)) return;
      if (!o.removed) removidas++;
      merged.push(Object.assign({}, o, { removed: true, changes: (o.changes || []).concat(o.removed ? [] : [{ campo: 'Agendamento', de: 'ativo', para: 'removido', em: now }]) }));
    });
    state.sew = keep.concat(merged);
    return { total: entries.length, alteradas, novas, removidas };
  }
  function focusDateOf(items) {
    const c = {}; items.forEach(i => { if (i.data) c[i.data] = (c[i.data] || 0) + 1; });
    const today = P.todayISO();
    if (c[today]) return today;
    const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : ui.date;
  }

  async function readWorkbook(file) {
    const st = $('#xlsx-status');
    if (!window.XLSX) { st.textContent = 'Biblioteca de leitura do Excel não carregou (sem internet?).'; return; }
    st.textContent = `Lendo ${file.name}… (planilhas grandes podem levar alguns segundos)`;
    await new Promise(r => setTimeout(r, 30));
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, cellFormula: false, cellHTML: false, cellStyles: false, bookVBA: false });
      const sheet = (name, maxCol) => {
        const n = wb.SheetNames.find(s => P.norm(s) === P.norm(name)); if (!n) return null;
        const ws = wb.Sheets[n]; if (!ws['!ref']) return [];
        const rg = XLSX.utils.decode_range(ws['!ref']); if (maxCol != null) rg.e.c = Math.min(rg.e.c, maxCol);
        rg.s.r = 0; rg.s.c = 0;
        return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true, range: rg });
      };
      const out = { summary: '' }; const parts = [];
      const log = sheet('LOG', 24);
      if (log) {
        const grid = log.filter(r => r.some(v => v !== '' && v != null));
        const res = P.rowsToItems(grid, P.detectLogMapping(grid));
        out.items = res.items; parts.push(`LOG: ${res.items.length} linha(s), ${new Set(res.items.map(i => i.transporte)).size} transporte(s)`);
      }
      const sew = sheet('SEW ON LINE', 50);
      if (sew) { out.sew = P.parseSEW(sew, 'auto'); parts.push(`SEW: ${out.sew.length} agendamento(s)`); }
      const fsc = sheet('FSC', 12);
      if (fsc) { out.fsc = P.parseFSC(fsc.filter(r => r.some(v => v !== ''))); parts.push(`FSC: ${Object.keys(out.fsc).length} cliente(s)`); }
      const cot = sheet('Controle OT', 20);
      if (cot) { out.manual = P.parseControleOT(cot); parts.push(`Controle OT: ${Object.keys(out.manual).length} transporte(s) com campos manuais`); }
      if (!parts.length) throw new Error('Nenhuma das guias LOG / SEW ON LINE / FSC / Controle OT foi encontrada.');
      out.summary = parts.join(' · ');
      imp.xlsx = out;
      st.innerHTML = `<div class="alert info">${esc(file.name)} — ${esc(out.summary)}</div>`;
    } catch (er) {
      imp.xlsx = null; st.innerHTML = `<div class="alert err">Não foi possível ler a planilha: ${esc(er.message || er)}</div>`;
    }
    updateApply();
  }

  function applyImport() {
    let msg = '', focus = null, openT = null;
    if (imp.tab === 'log' && imp.sol && imp.sol.length) {
      const its = importSolicitacoes(imp.sol);
      focus = focusDateOf(its); if (imp.sol.length === 1) openT = its[0].transporte;
      msg = `${imp.sol.length} solicitação(ões) de embarque importada(s).`;
      $('#log-paste').value = ''; imp.sol = null; $('#log-preview').innerHTML = '';
    } else if (imp.tab === 'log' && imp.log) {
      mergeLogItems(imp.log.items, $('#log-replace-dates').checked);
      focus = focusDateOf(imp.log.items);
      msg = `${new Set(imp.log.items.map(i => i.transporte)).size} transporte(s) importado(s) do LOG.`;
      $('#log-paste').value = ''; imp.log = null; imp.html = null; $('#log-preview').innerHTML = '';
    } else if (imp.tab === 'sew' && imp.sew) {
      mergeSew(imp.sew); msg = `${imp.sew.length} agendamento(s) SEW importado(s).`;
      $('#sew-paste').value = ''; imp.sew = null; imp.sewHtml = null; $('#sew-preview').innerHTML = '';
    } else if (imp.tab === 'fsc' && imp.fsc) {
      state.fsc = imp.fsc; fscIdx = null;
      state.fscInfo = { em: new Date().toISOString(), arquivo: imp.fscArquivo || '', total: Object.keys(imp.fsc).length };
      msg = `Planilha FSC importada: ${Object.keys(imp.fsc).length} cliente(s). O campo FSC ao lado da OT já usa a nova lista.`;
      $('#fsc-paste').value = ''; $('#fsc-file').value = ''; imp.fsc = null; $('#fsc-preview').textContent = '';
    } else if (imp.tab === 'xlsx' && imp.xlsx) {
      const x = imp.xlsx;
      if (x.items) { mergeLogItems(x.items, true); focus = focusDateOf(x.items); }
      if (x.sew) mergeSew(x.sew);
      if (x.fsc && Object.keys(x.fsc).length) { state.fsc = x.fsc; fscIdx = null; state.fscInfo = { em: new Date().toISOString(), arquivo: 'planilha LOG', total: Object.keys(x.fsc).length }; }
      if (x.manual) Object.entries(x.manual).forEach(([t, m]) => {
        const cur = state.manual[t] || (state.manual[t] = {});
        Object.entries(m).forEach(([k, v]) => { if (!cur[k]) cur[k] = v; }); // não sobrescreve o que já foi digitado no app
      });
      // NF-e já lançada na Controle OT => ordem faturada
      if (x.manual) setFat(Object.keys(x.manual).filter(t => state.manual[t] && state.manual[t].nf), true, true);
      msg = 'Planilha importada: ' + x.summary;
      imp.xlsx = null; $('#xlsx-status').textContent = ''; $('#xlsx-file').value = '';
    } else return;
    save(true);
    $('#import-dialog').close();
    if (focus) { ui.date = focus; $('#date-filter').value = focus; }
    renderAll();
    if (openT) openDetail(openT);
    toast(msg, 'ok');
  }

  // ------------------------------------------------------------------ exemplo (dados fictícios)
  function loadDemo() {
    const d = ui.date || P.todayISO();
    const rows = [
      ['10000101', 'MOVELARIA EXEMPLO LTDA', 'MDF HD NL E1-- 2440x1850x02,5MM P/IF/204', '80000101', 'FOB', '08:30', '1700001', 'ABC1D23 (PR)', 'EFG4H56 (PR)', '9000001 - 10', 3264, 'CARRETA ESPAÇADO-3-EIXOS', 'MOTORISTA EXEMPLO UM', '15/09/2026 - Integração de motoristas Piên', 'TRANSPORTADORA EXEMPLO A', '700001-1', '111.111.111-11', '111.111.111-11'],
      ['10000102', 'INDUSTRIA DE MOVEIS FICTICIA', 'MDF ST LX E1-- 2750x2200x15,0MM P/IM/034', '80000102', 'CIF', '09:30', '1700002', 'IJK7L89 (SC)', 'MNO1P23 (SC)', '9000002 - 10', 340, 'CARRETA AGRUPADO-3-EIXOS', 'MOTORISTA EXEMPLO DOIS', '20/05/2026 - Integração de motoristas PG', 'TRANSPORTADORA EXEMPLO B', '700002-1', '222.222.222-22', '### TREINAMENTO EXPIRADO ###'],
      ['10000102', 'INDUSTRIA DE MOVEIS FICTICIA', 'MDF ST LX E1-- 2750x1850x15,0MM P/IM/040', '80000102', 'CIF', '09:30', '1700003', 'IJK7L89 (SC)', 'MNO1P23 (SC)', '9000002 - 20', 200, 'CARRETA AGRUPADO-3-EIXOS', 'MOTORISTA EXEMPLO DOIS', '20/05/2026 - Integração de motoristas PG', 'TRANSPORTADORA EXEMPLO B', '700002-2', '222.222.222-22', '### TREINAMENTO EXPIRADO ###'],
      ['10000103', 'EXPORT CLIENT S.A.', 'MDF HD LX E1-- 2440x1830x02,5MM P/EF/208', '80000103', 'CIF', '14:00', '1700004', 'QRS4T56 (SC)', 'UVW7X89 (SC)', '9000003 - 10', 1872, 'CARRETA AGRUPADO-3-EIXOS', 'MOTORISTA EXEMPLO TRES', '01/09/2026 - Direção defensiva', 'TRANSPORTADORA EXEMPLO C', '700003-1', '333.333.333-33', '333.333.333-33'],
      ['10000103', 'EXPORT CLIENT S.A.', 'MDF LI LX E1-- 2440x1830x15,0MM P/EM/046', '80000103', 'CIF', '14:00', '1700005', 'QRS4T56 (SC)', 'UVW7X89 (SC)', '9000003 - 30', 92, 'CARRETA AGRUPADO-3-EIXOS', 'MOTORISTA EXEMPLO TRES', '01/09/2026 - Direção defensiva', 'TRANSPORTADORA EXEMPLO C', '700003-2', '333.333.333-33', '333.333.333-33'],
      ['10000104', 'COMERCIO DE PAINEIS MODELO', 'CLR H B0004 F/- 2440x1850x2,8MM P/IG/186', '80000104', 'FOB', '16:00', '1700006', 'YZA1B23 (PR)', '-', '9000004 - 10', 1116, 'TRUCK', 'MOTORISTA EXEMPLO QUATRO', 'NUNCA FOI TREINADO', 'TRANSPORTADORA EXEMPLO D', '700004-1', '444.444.444-44', '444.444.444-44'],
    ];
    const grid = rows.map(r => [r[0], r[1], 100, r[2], d.split('-').reverse().join('/'), r[3], r[4], r[5], r[6], r[15].split('-')[0], '-', r[7], r[8], r[9], r[10], 1, r[11], r[12], r[13], 1, r[14], r[15], '', r[16], r[17]]);
    const res = P.rowsToItems(grid, { headerRow: -1, map: P.LOG_KEYS.slice() });
    mergeLogItems(res.items, false);
    mergeSew([{ janela: 'CONTAINER', data: d, hora: '14:00', status: '200 - Agendamento Concluído', senha: '3*', seq: '1', tipoVeiculo: '', carreta: 'QRS4T56', cavalo: 'UVW7X89', cpf: '333.333.333-33', container: 'ABCU1234567', transportadora: 'TRANSPORTADORA EXEMPLO C', cliente: 'EXPORT CLIENT S.A.', incoterm: 'CIF', volume: null }]);
    state.manual['10000103'] = Object.assign({ ot: '660001', exp: '1000000001', tara: '3700', mwg: '32500', lacre: 'LC0000001', ticket: '900001' }, state.manual['10000103'] || {});
    save(true); ui.date = d; $('#date-filter').value = d; renderAll();
    toast('Exemplo carregado (dados fictícios).', 'ok');
  }

  // ------------------------------------------------------------------ utilidades de UI
  function toast(msg, kind = '', detail) {
    const el = document.createElement('div'); el.className = `toast ${kind}`;
    el.innerHTML = esc(msg) + (detail ? `<pre>${esc(detail)}</pre>` : '');
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, detail ? 5200 : 3200);
  }
  function confirmBox(title, html, okLabel = 'Continuar') {
    const dlg = $('#confirm-dialog');
    $('#cf-title').textContent = title; $('#cf-body').innerHTML = html; $('#cf-ok').textContent = okLabel;
    dlg.returnValue = '';
    dlg.showModal();
    return new Promise(res => dlg.addEventListener('close', () => res(dlg.returnValue === 'ok'), { once: true }));
  }

  // ------------------------------------------------------------------ dados compartilhados (arquivo na rede)
  function syncPill(st) {
    const pill = $('#sync-pill'); if (!pill) return;
    const hm = st.at ? new Date(st.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
    let cls = 'local', txt = 'Dados só neste computador', tip = 'Clique para conectar ao arquivo compartilhado da equipe';
    if (st.mode === 'shared') { cls = st.error ? 'err' : 'ok'; txt = st.error ? `Compartilhado · erro` : `Compartilhado · ${hm}`; tip = `${st.name}${st.error ? ' — ' + st.error : ' — sincronizado às ' + hm}`; }
    if (st.mode === 'permission') { cls = 'warn'; txt = 'Reconectar dados compartilhados'; tip = `Clique para liberar o acesso a ${st.name}`; }
    if (st.mode === 'unsupported') { cls = 'local'; txt = 'Dados só neste computador'; tip = 'Para compartilhar, abra no Chrome ou Edge'; }
    pill.className = `sync-pill ${cls}`; pill.title = tip; $('#sync-txt').textContent = txt;
    const info = $('#sync-info');
    if (info) info.innerHTML = st.mode === 'shared' ? `Conectado a <b>${esc(st.name)}</b>${hm ? ` · última sincronização ${esc(hm)}` : ''}${st.error ? ` · <span class="txt-alt">${esc(st.error)}</span>` : ''}`
      : st.mode === 'permission' ? `Arquivo <b>${esc(st.name)}</b> configurado. O navegador pede para liberar o acesso: clique em <b>Reconectar</b>.`
      : st.mode === 'unsupported' ? 'Este navegador não permite gravar arquivos. Use o <b>Google Chrome</b> ou o <b>Microsoft Edge</b>.'
      : 'Os dados estão salvos só neste computador.';
    $('#sync-reconnect').hidden = st.mode !== 'permission';
    $('#sync-disconnect').hidden = !(st.mode === 'shared' || st.mode === 'permission');
  }
  function bindSync() {
    sync = window.OESync.create({
      getState: () => state,
      setState: s => { state = Object.assign(emptyState(), s); try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* cheio */ } },
      empty: emptyState,
      sewKey,
      onStatus: syncPill,
      onRemoteChange: () => {
        // chegaram dados de outro usuário: se a data aberta está vazia, vai para a data com cargas
        if (!allTransports().some(T => T.eff.data === ui.date)) { ui.date = pickDefaultDate(); $('#date-filter').value = ui.date; }
        renderAll();
      },
    });
    const run = async (fn, okMsg) => {
      try { await fn(); $('#sync-dialog').close(); if (okMsg) toast(okMsg, 'ok'); }
      catch (e) { if (e && e.name === 'AbortError') return; toast('Não foi possível usar o arquivo: ' + (e.message || e), 'err'); }
    };
    $('#sync-pill').addEventListener('click', async () => {
      if (sync.status().mode === 'permission') { const ok = await sync.reconnect(); toast(ok ? 'Dados compartilhados reconectados.' : 'Acesso não liberado.', ok ? 'ok' : 'warn'); return; }
      $('#sync-dialog').showModal();
    });
    $('#sync-create').addEventListener('click', () => run(() => sync.createFile(), 'Arquivo compartilhado criado. Os outros computadores devem usar "Conectar a arquivo existente" e escolher este mesmo arquivo.'));
    $('#sync-open').addEventListener('click', () => run(() => sync.openFile(), 'Conectado ao arquivo compartilhado. Os dados da equipe foram carregados.'));
    $('#sync-reconnect').addEventListener('click', () => run(async () => { if (!(await sync.reconnect())) throw new Error('acesso não liberado'); }, 'Dados compartilhados reconectados.'));
    $('#sync-disconnect').addEventListener('click', () => run(() => sync.disconnect(), 'Desconectado. Os dados continuam neste computador.'));
    $('#sync-now').addEventListener('click', () => run(() => sync.syncNow(), null));
    $('#sync-close').addEventListener('click', () => $('#sync-dialog').close());
    if (!sync.supported()) { $('#sync-create').disabled = true; $('#sync-open').disabled = true; }
    window.__oeSync = sync; // usado nos testes automáticos
    sync.init().catch(e => syncPill({ mode: 'local', error: e.message }));
  }

  // ------------------------------------------------------------------ início
  function init() {
    if (!TPL) { document.body.innerHTML = '<p style="padding:40px">Modelos de impressão não encontrados (js/templates.js).</p>'; return; }
    ui.date = pickDefaultDate();
    $('#date-filter').value = ui.date;
    bind(); bindImport(); bindRelatorio(); bindSync();
    setView('lista');
    // pré-carrega os modelos para a impressão sair na hora
    window.__oeBg = Object.values(TPL).map(t => { const i = new Image(); i.src = t.background; return i; });
    window.addEventListener('storage', e => { if (e.key === STORE_KEY) { state = load(); renderAll(); } });
  }
  init();
})();
