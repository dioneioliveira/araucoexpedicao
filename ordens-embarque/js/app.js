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
  const emptyState = () => ({ v: 1, items: {}, sew: [], fsc: {}, manual: {}, printed: {} });
  let state = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && s.v === 1) return Object.assign(emptyState(), s); } catch (e) { /* sem storage */ }
    return emptyState();
  }
  let saveTimer = null;
  function save(now) {
    clearTimeout(saveTimer);
    const pr = document.getElementById('print-root'); if (pr && !printing) pr.dataset.key = ''; // dados mudaram
    const run = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { toast('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado).', 'err'); } };
    if (now) run(); else saveTimer = setTimeout(run, 250);
  }
  let printing = false;
  const ui = { date: '', janela: 'ALL', q: '', selected: new Set(), open: null };

  // campos do transporte que podem ser corrigidos/preenchidos à mão
  const OVERRIDABLE = ['data', 'hora', 'cliente', 'entrega', 'incoterm', 'motorista', 'cpf', 'transportadora', 'placaL', 'placaM', 'tipoVeiculo', 'treinamento'];
  // campos da guia "Controle OT"
  const OT_FIELDS = [
    ['ot', 'OT'], ['doc', 'Doc'], ['nf', 'NF-e'], ['tara', 'Tara container'], ['mwg', 'Peso máx. (MWG)'],
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
    const pool = sameDay.length ? sameDay : hits;
    return pool.find(s => s.janela === 'CONTAINER') || pool[0];
  }
  function fscOf(cliente) {
    const n = P.norm(cliente); if (!n) return null;
    if (state.fsc[n]) return state.fsc[n];
    if (n.length >= 30) { const k = Object.keys(state.fsc).find(x => x.startsWith(n)); if (k) return state.fsc[k]; } // nome truncado pelo SAP
    return null;
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
    const fsc = fscOf(eff.cliente);
    const ot = Object.fromEntries(OT_FIELDS.map(([k]) => [k, man[k] || '']));
    if (!ot.container && f.container) ot.container = f.container;
    if (!ot.container && sew && sew.container) ot.container = sew.container;
    const missing = REQUIRED.filter(([k]) => !P.clean(eff[k])).map(([, l]) => l);
    return {
      transporte: t, items: mats, base, eff, man, sew, janela, janelaSrc: man.janela ? 'manual' : (f.janela ? 'Solicitação de Embarque' : (sew ? 'SEW' : 'padrão')),
      solic: f.fonte === 'Solicitação de Embarque' ? f : null,
      fsc, ot, pallets: mats.length && palletsOk ? pallets : (pallets || null), missing, treino: treino(eff),
      printed: state.printed[t] || null, manualOnly: items.every(i => i.manualOnly),
    };
  }
  function allTransports() {
    const g = new Map();
    Object.values(state.items).forEach(it => { if (!g.has(it.transporte)) g.set(it.transporte, []); g.get(it.transporte).push(it); });
    return Array.from(g, ([t, items]) => makeTransport(t, items));
  }
  const getTransport = t => { const items = Object.values(state.items).filter(i => i.transporte === t); return items.length ? makeTransport(t, items) : null; };

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
      naContainer: cont ? 'N/A' : '',
      pallets: palTxt,
      fracionada: pal != null && Math.abs(pal - Math.round(pal)) > 1e-9 ? 'carga fracionada' : '',
      fscClaim: T.fsc ? T.fsc.claim : '',
      otQr: T.ot.ot,
      ot: T.ot.ot,
      fsc: T.fsc ? T.fsc.fsc : '',
      janelaContainer: cont ? 'CONTAINER' : '',
      treinamento: e.treinamento,
      cpfTreinamento: /EXPIRADO/i.test(e.cpfStatus) && !T.man.cpf ? e.cpfStatus : P.fmtCPF(e.cpf),
      entregaTransporte: [e.entrega, T.transporte].filter(Boolean).join(' / '),
    };
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
    // Controle OT!I3:J4 — CPF e placas (VT02N / SAP)
    return { text: `CPF\t${P.cpfDigits(e.cpf)}\nPlacas\t${placasTexto(e)}`, need: [['cpf', 'CPF'], ['placaL', 'Placa']].filter(([k]) => !e[k]).map(x => x[1]) };
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
        const sp = document.createElement('span'); sp.textContent = val; el.appendChild(sp);
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
    if (measuring) root.classList.remove('measuring');
  }
  function pagesFor(T) {
    const d = printData(T);
    // mesma ordem da macro impress2026ordens: Check do veículo, depois Check da carga
    return [buildPage('veiculo', d), buildPage('carga', d)];
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
    list.forEach(T => { state.printed[T.transporte] = now; });
    save(true);
    renderAll();
    toast(`${list.length} ordem(ns) enviada(s) para impressão — ${list.length * 2} página(s).`, 'ok');
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
    return `<span class="chip ${c ? 'ct' : 'mi'}" title="Origem: ${esc(T.janelaSrc)}"><span class="dot"></span>${c ? 'Container' : 'Mercado interno'}</span>`;
  }
  function statusChip(T) {
    if (T.printed) return `<span class="chip ok" title="${esc(new Date(T.printed).toLocaleString('pt-BR'))}">Ordem impressa</span>`;
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
      .sort((a, b) => (a.eff.hora || '99').localeCompare(b.eff.hora || '99') || a.transporte.localeCompare(b.transporte));
  }

  function renderKPIs(list) {
    const dayAll = allTransports().filter(T => T.eff.data === ui.date);
    const mi = dayAll.filter(T => T.janela !== 'CONTAINER').length, ct = dayAll.length - mi;
    const pal = dayAll.reduce((s, T) => s + (T.pallets || 0), 0);
    const printed = dayAll.filter(T => T.printed).length;
    const pend = dayAll.filter(T => T.missing.length).length;
    const tr = dayAll.filter(T => T.treino.k === 'err' || T.treino.k === 'warn').length;
    $('#kpis').innerHTML = [
      ['Transportes', dayAll.length, P.fmtDateBR(ui.date), ''],
      ['Mercado interno', mi, 'janela PIÊN PAINÉIS', ''],
      ['Containers', ct, 'janela PIÊN CONTAINERS', 'lime'],
      ['Pallets', fmtNum(pal, 1), 'previstos no dia', 'grey'],
      ['Ordens impressas', `${printed}<span class="k-sub"> / ${dayAll.length}</span>`, `${dayAll.length - printed} a imprimir`, ''],
      ['Atenção', pend + tr, `${pend} com dados faltando · ${tr} treinamento`, 'lime'],
    ].map(([l, v, s, c]) => `<div class="card kpi ${c}"><div class="k-label">${l}</div><div class="k-val">${v}</div><div class="k-sub">${esc(s)}</div></div>`).join('');
  }

  function renderList() {
    const list = visibleTransports();
    renderKPIs(list);
    const tb = $('#daily-table tbody');
    tb.innerHTML = list.map(T => {
      const e = T.eff; const first = T.items[0] || {};
      const more = T.items.length > 1 ? ` <span class="chip grey">+${T.items.length - 1}</span>` : '';
      return `<tr data-t="${esc(T.transporte)}" class="${ui.open === T.transporte ? 'active' : ''} ${T.printed ? 'printed' : ''}">
        <td class="c-check"><input type="checkbox" ${ui.selected.has(T.transporte) ? 'checked' : ''} aria-label="Selecionar ${esc(T.transporte)}"></td>
        <td class="mono">${esc(e.hora)}</td>
        <td class="mono"><b>${esc(T.transporte)}</b></td>
        <td>${janelaChip(T)}</td>
        <td class="wrap">${esc(e.cliente)}${T.fsc ? ` <span class="chip mi">FSC</span>` : ''}</td>
        <td class="mono">${esc(e.entrega)}</td>
        <td class="wrap">${esc(first.descricao || '')}${more}</td>
        <td class="num">${fmtNum(T.pallets, 2)}</td>
        <td>${placasHTML(e)}</td>
        <td class="wrap">${esc(e.motorista)}<span class="sub mono">${esc(P.fmtCPF(e.cpf))}</span></td>
        <td>${treinoChip(T)}</td>
        <td class="wrap">${esc(e.transportadora)}</td>
        <td class="mono">${esc(T.ot.ot)}</td>
        <td>${statusChip(T)}</td>
      </tr>`;
    }).join('');
    $('#empty-state').hidden = list.length > 0;
    $('#daily-table').style.display = list.length ? '' : 'none';
    $('#list-title').textContent = `Lista diária · ${P.fmtDateBR(ui.date)}`;
    const ag = state.sew.filter(s => s.data === ui.date).length;
    $('#list-sub').textContent = `${list.length} transporte(s)${ag ? ` · ${ag} agendamento(s) SEW` : ''}`;
    // seleção
    const vis = new Set(list.map(T => T.transporte));
    Array.from(ui.selected).forEach(t => { if (!vis.has(t)) ui.selected.delete(t); });
    $('#sel-count').textContent = ui.selected.size;
    $('#btn-print-selected').disabled = !ui.selected.size;
    $('#check-all').checked = list.length > 0 && list.every(T => ui.selected.has(T.transporte));
    // datalist do campo Transporte
    const dl = $('#transporte-list');
    const ts = Array.from(new Set(Object.values(state.items).map(i => i.transporte))).sort().reverse().slice(0, 400);
    dl.innerHTML = ts.map(t => `<option value="${esc(t)}">`).join('');
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
    $('#d-chips').innerHTML = [janelaChip(T), treinoChip(T), statusChip(T), T.fsc ? `<span class="chip mi">FSC ${esc(T.fsc.fsc)}</span>` : '', T.manualOnly ? '<span class="chip grey">Manual</span>' : ''].join('');
    const e = T.eff;
    const alerts = [];
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
        </div>
      </div>
      <div class="section">
        <h3>Controle OT <span class="h-note">campos manuais</span></h3>
        <div class="fgrid three">
          ${OT_FIELDS.map(([k, l]) => `<div class="f"><label for="ot-${k}">${esc(l)}${k === 'container' && !T.man.container && T.ot.container ? ' <span class="src">SEW</span>' : ''}</label><input id="ot-${k}" data-ot="${k}" value="${esc(T.ot[k])}" style="font-family:var(--f-mono)"></div>`).join('')}
        </div>
      </div>
      <div class="section">
        <h3>Documentos da ordem <span class="h-note">clique para ampliar</span></h3>
        <div class="pv-thumbs" id="pv-thumbs"></div>
      </div>`;
    renderThumbs(T);
  }

  function scalePage(page, boxWidth) {
    const pw = 595.304 * 96 / 72;
    const s = boxWidth / pw;
    page.style.transform = `scale(${s})`;
  }
  async function renderThumbs(T) {
    const box = $('#pv-thumbs'); if (!box) return;
    box.innerHTML = '';
    const caps = ['Check list do veículo', 'Check list da carga'];
    const pages = pagesFor(T);
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
    const w = Math.min(640, Math.max(320, (wrap.clientWidth - 80) / 2));
    list.forEach(T => pagesFor(T).forEach(p => {
      const box = document.createElement('div'); box.className = 'pv-page-wrap';
      box.style.width = w + 'px'; box.style.height = (w * 841.89 / 595.304) + 'px';
      box.appendChild(p); wrap.appendChild(box); scalePage(p, w);
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
  }
  function renderAll() { renderList(); if (ui.open) renderDetail(); }

  // ------------------------------------------------------------------ eventos principais
  function pickDefaultDate() {
    const today = P.todayISO();
    const dates = Array.from(new Set(Object.values(state.items).map(i => (state.manual[i.transporte] || {}).data || i.data))).filter(Boolean).sort();
    if (!dates.length || dates.includes(today)) return today;
    const future = dates.filter(d => d >= today);
    return future.length ? future[0] : dates[dates.length - 1];
  }

  function bind() {
    $('#date-filter').addEventListener('change', e => { ui.date = e.target.value || P.todayISO(); ui.selected.clear(); renderList(); });
    $$('#janela-filter button').forEach(b => b.addEventListener('click', () => {
      $$('#janela-filter button').forEach(x => x.classList.toggle('active', x === b)); ui.janela = b.dataset.v; renderList();
    }));
    let st; $('#search').addEventListener('input', e => { clearTimeout(st); st = setTimeout(() => { ui.q = e.target.value; renderList(); }, 120); });

    $('#daily-table tbody').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-t]'); if (!tr) return;
      const t = tr.dataset.t;
      if (e.target.matches('input[type=checkbox]')) { e.target.checked ? ui.selected.add(t) : ui.selected.delete(t); renderList(); return; }
      openDetail(t);
    });
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
      if (e.target.id === 'f-janela') { if (e.target.value) man.janela = e.target.value; else delete man.janela; save(); renderAll(); return; }
      if (e.target.dataset.ov === 'cpf' && man.cpf) { man.cpf = P.fmtCPF(man.cpf); e.target.value = man.cpf; }
      if ((e.target.dataset.ov === 'placaL' || e.target.dataset.ov === 'placaM') && man[e.target.dataset.ov]) { man[e.target.dataset.ov] = P.normPlate(man[e.target.dataset.ov]); e.target.value = man[e.target.dataset.ov]; }
      // sem redesenhar o painel: o usuário pode estar clicando no próximo campo
      save(); softRefresh();
    });
    $('#d-body').addEventListener('click', e => {
      const b = e.target.closest('[data-reset]'); if (!b) return;
      const man = state.manual[ui.open] || {}; delete man[b.dataset.reset]; save(); renderAll();
    });

    // botões de cópia
    $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      const T = getTransport(ui.open); if (!T) return;
      const { text, need } = copyText(b.dataset.copy, T);
      const ok = await toClipboard(text);
      b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 1200);
      const nome = { texto: 'Dados de texto', balanca: 'Dados de balança', motorista: 'Dados do motorista' }[b.dataset.copy];
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
      if (P.isSolicitacao(text)) {
        const list = P.parseSolicitacoes(text);
        const its = list.length ? importSolicitacoes(list) : [];
        if (!its.length) { toast('Página reconhecida, mas sem a tabela de itens. Copie a página inteira (Ctrl+A, Ctrl+C) e cole de novo.', 'err'); return; }
        const t = its[0].transporte, d = its[0].data;
        if (d) { ui.date = d; $('#date-filter').value = d; }
        renderAll(); openDetail(t);
        const T = getTransport(t);
        toast(`Transporte ${t} importado da Solicitação de Embarque (${T.janela === 'CONTAINER' ? 'container' : 'mercado interno'}).${T.missing.length ? ' Falta: ' + T.missing.join(', ') : ' Pronto para imprimir.'}`, T.missing.length ? 'warn' : 'ok');
        return;
      }
      // tabela (LOG/SAP, SEW): abre a importação já com o conteúdo colado
      const html = e.clipboardData.getData('text/html');
      const sew = /PI[EÊ]N (PAINEIS|PAINÉIS|CONTAINERS)|Tp\.?Ve[ií]culo/i.test(text);
      imp.tab = sew ? 'sew' : 'log';
      $('#btn-import').click();
      if (sew) { imp.sewHtml = html && /<table/i.test(html) ? P.trimGrid(P.parseHTMLTable(html) || []) : null; $('#sew-paste').value = text; parseSewPaste(); }
      else { imp.html = html && /<table/i.test(html) ? P.trimGrid(P.parseHTMLTable(html) || []) : null; $('#log-paste').value = text; parseLogPaste(); }
    });
    $('#pv-close').addEventListener('click', () => $('#preview-dialog').close());
    $('#btn-demo').addEventListener('click', loadDemo);
    window.addEventListener('resize', () => { if (ui.open) { const T = getTransport(ui.open); if (T) renderThumbs(T); } });
  }

  // atualiza sem perder o foco do campo que está sendo digitado
  let softTimer;
  function softRefresh() {
    clearTimeout(softTimer);
    softTimer = setTimeout(() => {
      const T = getTransport(ui.open); if (!T) return;
      $('#d-chips').innerHTML = [janelaChip(T), treinoChip(T), statusChip(T), T.fsc ? `<span class="chip mi">FSC ${esc(T.fsc.fsc)}</span>` : '', T.manualOnly ? '<span class="chip grey">Manual</span>' : ''].join('');
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
      imp.fsc = g.length ? P.parseFSC(g) : null;
      const n = imp.fsc ? Object.keys(imp.fsc).length : 0;
      $('#fsc-preview').textContent = n ? `${n} cliente(s) reconhecido(s). A lista atual (${Object.keys(state.fsc).length}) será substituída.` : '';
      updateApply();
    }, 150); });

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
  function setTab(tab) {
    imp.tab = tab;
    $$('#import-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    $$('#import-dialog .tab-pane').forEach(p => p.hidden = p.dataset.pane !== tab);
    $('#import-apply').hidden = tab === 'backup';
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
  function mergeSew(entries) {
    const keys = new Set(entries.map(s => s.janela + '|' + s.data));
    state.sew = state.sew.filter(s => !keys.has(s.janela + '|' + s.data)).concat(entries);
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
      state.fsc = imp.fsc; msg = `${Object.keys(imp.fsc).length} cliente(s) FSC salvos.`;
      $('#fsc-paste').value = ''; imp.fsc = null; $('#fsc-preview').textContent = '';
    } else if (imp.tab === 'xlsx' && imp.xlsx) {
      const x = imp.xlsx;
      if (x.items) { mergeLogItems(x.items, true); focus = focusDateOf(x.items); }
      if (x.sew) mergeSew(x.sew);
      if (x.fsc && Object.keys(x.fsc).length) state.fsc = x.fsc;
      if (x.manual) Object.entries(x.manual).forEach(([t, m]) => {
        const cur = state.manual[t] || (state.manual[t] = {});
        Object.entries(m).forEach(([k, v]) => { if (!cur[k]) cur[k] = v; }); // não sobrescreve o que já foi digitado no app
      });
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
    state.manual['10000103'] = Object.assign({ ot: '660001', exp: '1000000001', tara: '3700', mwg: '32500', lacre: 'LC0000001', ticket: '900001', nf: '9001' }, state.manual['10000103'] || {});
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

  // ------------------------------------------------------------------ início
  function init() {
    if (!TPL) { document.body.innerHTML = '<p style="padding:40px">Modelos de impressão não encontrados (js/templates.js).</p>'; return; }
    ui.date = pickDefaultDate();
    $('#date-filter').value = ui.date;
    bind(); bindImport();
    renderList();
    // pré-carrega os modelos para a impressão sair na hora
    window.__oeBg = Object.values(TPL).map(t => { const i = new Image(); i.src = t.background; return i; });
    window.addEventListener('storage', e => { if (e.key === STORE_KEY) { state = load(); renderAll(); } });
  }
  init();
})();
