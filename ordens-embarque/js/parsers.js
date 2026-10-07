/* Leitura e normalização dos dados colados (LOG/SAP, SEW, FSC) e da planilha.
   Os dados chegam "irregulares": NBSP nas placas, CPF sem zeros à esquerda,
   datas/horas como número serial do Excel, colunas deslocadas, etc. */
(function (global) {
  'use strict';

  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const clean = v => v == null ? '' : String(v).replace(/[   \t]/g, ' ').replace(/\s+/g, ' ').trim();
  const norm = v => clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

  // ---------- datas / horas ----------
  function serialToParts(n) {
    const ms = Math.round((n - 25569) * 864e5);
    const d = new Date(ms);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
  }
  function toISODate(v) {
    if (v instanceof Date && !isNaN(v)) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    if (typeof v === 'number' && v > 20000 && v < 80000) { const p = serialToParts(v); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; }
    const s = clean(v);
    let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; if (+m[2] > 12) return ''; return `${y}-${pad(m[2])}-${pad(m[1])}`; }
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    if (/^\d{5}([.,]\d+)?$/.test(s)) return toISODate(parseFloat(s.replace(',', '.')));
    return '';
  }
  function toTime(v) {
    if (v instanceof Date && !isNaN(v)) return `${pad(v.getHours())}:${pad(v.getMinutes())}`;
    if (typeof v === 'number' && isFinite(v)) {
      const f = v % 1; const mins = Math.round(f * 1440) % 1440;
      return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
    }
    const s = clean(v);
    let m = s.match(/(?:^|\s)(\d{1,2})[:h](\d{2})(?::\d{2})?/i);
    if (m && +m[1] < 24) return `${pad(m[1])}:${m[2]}`;
    if (/^0?[.,]\d+$/.test(s)) return toTime(parseFloat(s.replace(',', '.')));
    return '';
  }
  const fmtDateBR = iso => { const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || ''); };
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  // ---------- números / documentos ----------
  function toNum(v) {
    if (typeof v === 'number') return v;
    let s = clean(v).replace(/[^\d,.\-]/g, '');
    if (!s) return NaN;
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (s.includes(',')) s = s.replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return parseFloat(s);
  }
  const intStr = v => { if (typeof v === 'number') return String(Math.round(v)); const s = clean(v); return /^\d+([.,]0+)?$/.test(s) ? s.replace(/[.,]0+$/, '') : s; };
  function cpfDigits(v) {
    if (typeof v === 'number') v = String(Math.round(v));
    const d = clean(v).replace(/\D/g, '');
    if (!d || d.length > 11) return '';
    return d.padStart(11, '0');
  }
  const fmtCPF = v => { const d = cpfDigits(v); return d ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : clean(v); };
  const isCPFLike = v => { const s = clean(v); return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(s) || /^\d{9,11}$/.test(s); };

  // ---------- placas ----------
  const PLATE_RE = /([A-Z]{3})\s*-?\s*(\d[A-Z0-9]\d{2})/;
  function normPlate(v) {
    const s = clean(v).toUpperCase();
    if (!s) return '';
    if (/^[-–—]+$/.test(s)) return '-';
    const m = s.match(PLATE_RE);
    if (!m) return s;
    const uf = (s.match(/\(\s*([A-Z]{2})\s*\)/) || s.match(/[\s\-\/]([A-Z]{2})$/) || [])[1];
    return m[1] + m[2] + (uf ? ` (${uf})` : '');
  }
  const plate7 = p => { const m = clean(p).toUpperCase().match(PLATE_RE); return m ? m[1] + m[2] : ''; };
  const plateUF = p => (clean(p).toUpperCase().match(/\(([A-Z]{2})\)/) || [])[1] || '';
  const isPlate = v => PLATE_RE.test(clean(v).toUpperCase()) && clean(v).length <= 14;

  // ---------- materiais ----------
  // "MDF HD LX E1-- 2440x1830x02,5MM P/EF/208" -> família, linha, acabamento,
  // dimensões, espessura, mercado (P/E = exportação, P/I = interno) e peças/pallet
  function matInfo(desc) {
    const d = clean(desc).toUpperCase();
    const tk = d.split(' ');
    const dims = d.match(/(\d{3,4})\s*X\s*(\d{3,4})\s*X\s*(\d{1,3}(?:[,.]\d+)?)/);
    const pack = d.match(/P\/([A-Z])([A-Z0-9]?)\/(\d{1,4})\s*$/) || d.match(/\/([A-Z])([A-Z0-9]?)\/(\d{1,4})\s*$/);
    let pecas = pack ? +pack[3] : NaN;
    if (!pecas) { const r = parseInt(d.slice(-3), 10); if (r > 0) pecas = r; }
    return {
      familia: tk[0] || '', linha: tk[1] || '', acabamento: tk[2] || '',
      comp: dims ? +dims[1] : null, larg: dims ? +dims[2] : null,
      esp: dims ? parseFloat(dims[3].replace(',', '.')) : null,
      mercado: pack ? ({ E: 'Exportação', I: 'Interno' }[pack[1]] || pack[1]) : '',
      embalagem: pack ? pack[1] + pack[2] : '',
      pecasPallet: pecas || null,
    };
  }

  // ---------- leitura do que foi colado ----------
  function parseTSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    const t = String(text || '').replace(/\r\n?/g, '\n');
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) {
        if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === '\t') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    // sem tabulação (copiado de PDF/web como texto): separa por 2+ espaços
    if (rows.length && rows.every(r => r.length === 1)) {
      // lista do SAP GUI: colunas separadas por "|"
      if (rows.filter(r => (r[0].match(/\|/g) || []).length >= 2).length >= rows.length / 2)
        return rows.filter(r => !/^[\s\-|]+$/.test(r[0])).map(r => r[0].replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|'));
      return rows.map(r => r[0].split(/\s{2,}|\s*;\s*/));
    }
    return rows;
  }
  function parseHTMLTable(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const trs = doc.querySelectorAll('tr');
    if (!trs.length) return null;
    const grid = [];
    const spans = []; // rowspan pendente por coluna
    trs.forEach((tr, ri) => {
      const row = []; let ci = 0;
      const take = () => { while (spans[ci] && spans[ci].left > 0) { row[ci] = ''; spans[ci].left--; ci++; } };
      take();
      tr.querySelectorAll('th,td').forEach(td => {
        take();
        const txt = (td.innerText || td.textContent || '').replace(/\n+/g, ' ');
        const cs = Math.max(1, +td.getAttribute('colspan') || 1);
        const rs = Math.max(1, +td.getAttribute('rowspan') || 1);
        row[ci] = txt;
        for (let k = 1; k < cs; k++) row[ci + k] = '';
        if (rs > 1) for (let k = 0; k < cs; k++) spans[ci + k] = { left: rs - 1 };
        ci += cs;
      });
      take();
      grid[ri] = Array.from(row, v => v == null ? '' : v);
    });
    return grid;
  }
  const trimGrid = g => g.map(r => r.map(v => typeof v === 'string' ? v.replace(/ /g, ' ').trim() : v))
    .filter(r => r.some(v => v !== '' && v != null));

  // ---------- LOG (guia LOG da planilha, colunas A..Y) ----------
  const LOG_COLS = [
    ['transporte', 'Transporte'], ['cliente', 'Cliente'], ['colC', 'Col. C'], ['descricao', 'Descrição material'],
    ['data', 'Data'], ['entrega', 'Entrega'], ['incoterm', 'Incoterm'], ['hora', 'Hora'], ['material', 'Material'],
    ['agendamento', 'Agendamento'], ['obs', 'Observação'], ['placaL', 'Placa carreta/truck'], ['placaM', 'Placa cavalo'],
    ['pedido', 'Pedido - item'], ['qtd', 'Quantidade'], ['colP', 'Col. P'], ['tipoVeiculo', 'Tipo de veículo'],
    ['motorista', 'Motorista'], ['treinamento', 'Treinamento'], ['colT', 'Col. T'], ['transportadora', 'Transportadora'],
    ['agItem', 'Agendamento - item'], ['colW', 'Col. W'], ['cpf', 'CPF'], ['cpfStatus', 'CPF / status treinamento'],
  ];
  const LOG_KEYS = LOG_COLS.map(c => c[0]);
  const LOG_LABEL = Object.fromEntries(LOG_COLS);
  const HEADER_SYN = {
    transporte: ['TRANSPORTE', 'N TRANSPORTE', 'NO TRANSPORTE', 'Nº TRANSPORTE', 'DOC TRANSPORTE'],
    cliente: ['CLIENTE', 'RECEBEDOR', 'NOME CLIENTE', 'NOME DO CLIENTE', 'EMISSOR', 'NOME RECEBEDOR'],
    descricao: ['DESCRICAO', 'DESCRICAO MATERIAL', 'TEXTO BREVE MATERIAL', 'DENOMINACAO', 'PRODUTO'],
    data: ['DATA', 'DATA CARREGAMENTO', 'DATA AGENDAMENTO', 'DT'],
    entrega: ['ENTREGA', 'REMESSA', 'FORNECIMENTO', 'DOC ENTREGA'],
    incoterm: ['INCOTERM', 'INCOTERMS', 'FRETE'],
    hora: ['HORA', 'HORARIO', 'HR'],
    material: ['MATERIAL', 'COD MATERIAL', 'CODIGO', 'ITEM'],
    agendamento: ['AGENDAMENTO', 'N AGENDAMENTO', 'SENHA'],
    obs: ['OBS', 'OBSERVACAO', 'OBSERVACOES'],
    placaL: ['PLACA', 'CARRETA', 'PLACA CARRETA', 'VEICULO', 'PLACA 1'],
    placaM: ['CAVALO', 'PLACA CAVALO', 'PLACA 2'],
    pedido: ['PEDIDO', 'PEDIDO ITEM', 'ORDEM VENDA', 'OV'],
    qtd: ['QTD', 'QUANTIDADE', 'QTDE', 'PECAS'],
    tipoVeiculo: ['TIPO VEICULO', 'TP VEICULO', 'TIPO DE VEICULO', 'TP.VEICULO'],
    motorista: ['MOTORISTA', 'NOME MOTORISTA', 'NOME DO MOTORISTA'],
    treinamento: ['TREINAMENTO', 'INTEGRACAO'],
    transportadora: ['TRANSPORTADORA', 'TRANSP', 'AGENTE DE FRETE'],
    agItem: ['AGENDAMENTO ITEM'],
    cpf: ['CPF', 'CPF MOTORISTA'],
    cpfStatus: ['STATUS TREINAMENTO', 'VALIDADE TREINAMENTO'],
  };

  const TESTS = {
    transporte: v => /^1\d{7}$/.test(intStr(v)),
    entrega: v => /^8\d{7}$/.test(intStr(v)),
    data: v => !!toISODate(v) && !/:/.test(String(v)),
    hora: v => (typeof v === 'number' && v >= 0 && v < 1) || /^\d{1,2}:\d{2}(:\d{2})?$/.test(clean(v)),
    incoterm: v => /^(FOB|CIF|FCA|EXW|CFR|CPT|CIP|DAP|DPU|DDP|FAS)$/i.test(clean(v)),
    material: v => /^\d{6,7}$/.test(intStr(v)),
    descricao: v => /\d{3,4}\s*X\s*\d{3,4}/i.test(clean(v)),
    placa: v => isPlate(v) || clean(v) === '-',
    pedido: v => /^\d{5,}\s*-\s*\d+$/.test(clean(v)),
    agItem: v => /^\d{4,}-\d+$/.test(clean(v)),
    cpf: v => isCPFLike(v),
    cpfStatus: v => isCPFLike(v) || /TREINAMENTO|EXPIRADO/i.test(clean(v)),
    tipoVeiculo: v => /(CARRETA|TRUCK|BITREM|RODOTREM|VANDERL|EIXO|TOCO|BI-TREM)/i.test(clean(v)),
    treinamento: v => /(TREINAD|INTEGRA|DIRE[CÇ][AÃ]O|^\d{2}\/\d{2}\/\d{4}\s*-)/i.test(clean(v)),
    qtd: v => isFinite(toNum(v)) && clean(v) !== '',
  };
  const frac = (col, test) => { const vals = col.filter(v => clean(v) !== ''); return vals.length ? vals.filter(test).length / vals.length : 0; };

  function findHeaderRow(grid) {
    for (let r = 0; r < Math.min(grid.length, 15); r++) {
      const cells = grid[r].map(norm);
      const hits = cells.filter(c => c && Object.values(HEADER_SYN).some(list => list.some(s => c === s || c.replace(/[^A-Z ]/g, '').trim() === s))).length;
      if (hits >= 3 && cells.some(c => c.includes('TRANSPORTE'))) return r;
    }
    return -1;
  }
  function mapByHeader(row) {
    const map = row.map(() => null); const used = new Set();
    row.forEach((h, i) => {
      const c = norm(h).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
      for (const [k, list] of Object.entries(HEADER_SYN)) {
        if (used.has(k)) continue;
        if (list.some(s => c === s.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim())) { map[i] = k; used.add(k); return; }
      }
    });
    // "Placa" duas vezes: a 2ª é o cavalo
    if (!used.has('placaM')) { const idx = row.map((h, i) => /PLACA/.test(norm(h)) ? i : -1).filter(i => i >= 0 && map[i] !== 'placaL'); if (idx.length) map[idx[0]] = 'placaM'; }
    return map;
  }
  function positionalScore(rows) {
    const col = i => rows.map(r => r[i]);
    const checks = [[0, TESTS.transporte], [4, TESTS.data], [5, TESTS.entrega], [11, TESTS.placa], [23, TESTS.cpf]];
    return checks.reduce((s, [i, t]) => s + frac(col(i), t), 0) / checks.length;
  }
  function mapByContent(rows) {
    const ncol = Math.max(...rows.map(r => r.length));
    const cols = Array.from({ length: ncol }, (_, i) => rows.map(r => r[i]));
    const map = Array(ncol).fill(null); const used = new Set();
    const pick = (key, test, min = 0.6, from = 0) => {
      let best = -1, bs = min;
      for (let i = from; i < ncol; i++) { if (map[i]) continue; const s = frac(cols[i], test); if (s > bs) { bs = s; best = i; } }
      if (best >= 0) { map[best] = key; used.add(key); }
      return best;
    };
    pick('transporte', TESTS.transporte); pick('entrega', TESTS.entrega); pick('agItem', TESTS.agItem);
    pick('pedido', TESTS.pedido); pick('data', TESTS.data); pick('hora', TESTS.hora); pick('incoterm', TESTS.incoterm);
    pick('descricao', TESTS.descricao); pick('material', TESTS.material); pick('tipoVeiculo', TESTS.tipoVeiculo);
    pick('treinamento', TESTS.treinamento);
    const pl = pick('placaL', v => isPlate(v)); if (pl >= 0) pick('placaM', TESTS.placa, 0.6, pl + 1);
    const cp = pick('cpf', v => isCPFLike(v)); if (cp >= 0) pick('cpfStatus', TESTS.cpfStatus, 0.6, cp + 1);
    // colunas de texto restantes: cliente (antes da descrição), motorista (após tipo de
    // veículo) e transportadora (após o treinamento) — mesma ordem da guia LOG
    const textCols = [];
    for (let i = 0; i < ncol; i++) if (!map[i] && frac(cols[i], v => /[A-Z]{3,}/i.test(clean(v)) && !isFinite(toNum(v))) > 0.6) textCols.push(i);
    const before = (k) => map.indexOf(k);
    const tsel = (key, cond) => { const i = textCols.find(c => !map[c] && cond(c)); if (i != null) map[i] = key; };
    tsel('cliente', c => before('descricao') < 0 || c < before('descricao'));
    tsel('motorista', c => before('tipoVeiculo') < 0 || c > before('tipoVeiculo'));
    tsel('transportadora', c => before('treinamento') < 0 || c > before('treinamento'));
    tsel('obs', () => true);
    pick('qtd', v => TESTS.qtd(v) && toNum(v) > 0 && toNum(v) < 100000);
    return map;
  }
  function detectLogMapping(grid) {
    const hr = findHeaderRow(grid);
    if (hr >= 0) return { headerRow: hr, map: mapByHeader(grid[hr]), mode: 'cabeçalho' };
    const rows = grid.slice(0, 200);
    if (positionalScore(rows) >= 0.55) return { headerRow: -1, map: LOG_KEYS.slice(), mode: 'posição (guia LOG)' };
    return { headerRow: -1, map: mapByContent(rows), mode: 'conteúdo' };
  }
  function rowsToItems(grid, mapping) {
    const items = [], bad = [];
    const start = mapping.headerRow + 1;
    for (let r = start; r < grid.length; r++) {
      const row = grid[r]; const raw = {};
      mapping.map.forEach((k, i) => { if (k && raw[k] == null) raw[k] = row[i]; });
      const transporte = intStr(raw.transporte);
      if (!/^\d{6,12}$/.test(transporte)) { if (row.some(v => clean(v))) bad.push(r); continue; }
      const it = {
        transporte,
        cliente: clean(raw.cliente), colC: clean(raw.colC), descricao: clean(raw.descricao),
        data: toISODate(raw.data), entrega: intStr(raw.entrega), incoterm: clean(raw.incoterm).toUpperCase(),
        hora: toTime(raw.hora), material: intStr(raw.material), agendamento: intStr(raw.agendamento),
        obs: clean(raw.obs), placaL: normPlate(raw.placaL), placaM: normPlate(raw.placaM),
        pedido: clean(raw.pedido), qtd: toNum(raw.qtd), colP: clean(raw.colP), tipoVeiculo: clean(raw.tipoVeiculo),
        motorista: clean(raw.motorista).toUpperCase(), treinamento: clean(raw.treinamento), colT: clean(raw.colT),
        transportadora: clean(raw.transportadora), agItem: clean(raw.agItem), colW: clean(raw.colW),
        cpf: fmtCPF(raw.cpf), cpfStatus: isCPFLike(raw.cpfStatus) ? fmtCPF(raw.cpfStatus) : clean(raw.cpfStatus),
      };
      if (!isFinite(it.qtd)) it.qtd = null;
      if (!it.placaM && it.placaL) it.placaM = '-';
      it.key = [it.transporte, it.agItem || it.pedido || '', it.material || '', it.entrega || ''].join('|');
      items.push(it);
    }
    return { items, bad };
  }

  // ---------- SEW (Agendamento de Cargas — PIÊN PAINÉIS / PIÊN CONTAINERS) ----------
  function parseSEW(grid, mode) {
    const out = [];
    for (let r = 0; r < grid.length; r++) {
      const cells = grid[r].map(norm);
      const starts = [];
      cells.forEach((c, i) => { if (c === 'DATA' && cells[i + 1] === 'HORA') starts.push(i); });
      if (!starts.length) continue;
      starts.forEach((s, bi) => {
        const end = starts[bi + 1] != null ? starts[bi + 1] : cells.length;
        const head = {}; for (let i = s; i < end; i++) if (cells[i] && head[cells[i]] == null) head[cells[i]] = i;
        let janela = mode && mode !== 'auto' ? mode : null;
        if (!janela) {
          // título da janela nas linhas acima, na mesma faixa de colunas
          for (let k = r - 1; k >= 0 && k >= r - 12 && !janela; k--) {
            for (let i = Math.max(0, s - 2); i < end; i++) {
              const t = norm(grid[k][i]);
              if (t.includes('CONTAINER')) { janela = 'CONTAINER'; break; }
              if (t.includes('PAINEIS') || t.includes('PAINEL')) { janela = 'MI'; break; }
            }
          }
          if (!janela) janela = head['NUMERO CONTAINER'] != null ? 'CONTAINER' : (starts.length > 1 ? (bi === 0 ? 'MI' : 'CONTAINER') : 'MI');
        }
        const col = name => { for (const k of Object.keys(head)) if (k.startsWith(name)) return head[k]; return -1; };
        const cData = s, cHora = s + 1, cCarreta = col('CARRETA'), cCavalo = col('CAVALO'), cCpf = col('CPF'),
          cCont = col('NUMERO CONTAINER'), cTransp = col('TRANSPORTADORA'), cCli = col('CLIENTE'), cVol = col('VOLUME'),
          cSenha = col('SENHA'), cTipo = col('TP'), cSeq = col('SEQ'), cInco = col('INCOTERMS');
        for (let k = r + 1; k < grid.length; k++) {
          const row = grid[k];
          const nc = row.map(norm);
          if (nc[s] === 'DATA' && nc[s + 1] === 'HORA') break;
          const data = toISODate(row[cData]);
          if (!data) continue;
          const carreta = cCarreta >= 0 ? clean(row[cCarreta]) : '';
          if (!carreta || /^AGENDAR$/i.test(carreta)) continue;
          out.push({
            janela, data, hora: toTime(row[cHora]),
            status: clean(row[s - 1]), senha: cSenha >= 0 ? clean(row[cSenha]) : '', seq: cSeq >= 0 ? intStr(row[cSeq]) : '',
            tipoVeiculo: cTipo >= 0 ? clean(row[cTipo]) : '',
            carreta: normPlate(carreta), cavalo: cCavalo >= 0 ? normPlate(row[cCavalo]) : '',
            cpf: cCpf >= 0 ? fmtCPF(row[cCpf]) : '', container: cCont >= 0 ? clean(row[cCont]).toUpperCase() : '',
            transportadora: cTransp >= 0 ? clean(row[cTransp]) : '', cliente: cCli >= 0 ? clean(row[cCli]) : '',
            incoterm: cInco >= 0 ? clean(row[cInco]) : '', volume: cVol >= 0 ? toNum(row[cVol]) : null,
          });
        }
      });
    }
    // sem cabeçalho reconhecido: tenta linhas soltas com data + placa
    if (!out.length) {
      grid.forEach(row => {
        const data = row.map(toISODate).find(Boolean); const pl = row.filter(v => isPlate(v));
        if (data && pl.length) out.push({ janela: mode && mode !== 'auto' ? mode : 'MI', data, hora: row.map(v => /:/.test(clean(v)) ? toTime(v) : '').find(Boolean) || '', status: '', carreta: normPlate(pl[0]), cavalo: normPlate(pl[1] || ''), cpf: '', container: '', transportadora: '', cliente: '', volume: null, senha: '', seq: '', tipoVeiculo: '', incoterm: '' });
      });
    }
    return out;
  }

  // ---------- FSC ----------
  // Planilha de clientes FSC (guia FSC: Data de ingresso · Data de exclusão · Data de
  // reingresso · Cód. Cliente · Nome Cliente · Vendedor · Gerente · FSC · claim).
  // Aceita outras ordens de colunas: identifica pelos títulos. Cliente excluído (com data
  // de exclusão e sem reingresso posterior) fica marcado como inativo.
  function parseFSC(grid) {
    const H = r => r.map(c => norm(c).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim());
    const isName = h => /^(NOME( DO)? CLIENTE|CLIENTE|RAZAO SOCIAL|NOME|RECEBEDOR|NOME DO RECEBEDOR)$/.test(h);
    let hr = grid.findIndex(r => H(r).some(isName));
    let c = { nome: 4, cod: 3, exc: 1, rein: 2, fsc: 7, claim: 8 };
    if (hr >= 0) {
      const h = H(grid[hr]); const f = re => h.findIndex(x => re.test(x));
      c = {
        nome: h.findIndex(x => /^(NOME( DO)? CLIENTE|RAZAO SOCIAL)$/.test(x)) >= 0 ? h.findIndex(x => /^(NOME( DO)? CLIENTE|RAZAO SOCIAL)$/.test(x)) : h.findIndex(isName),
        cod: f(/^(COD|CODIGO)( DO)? ?CLIENTE$|^COD$|^CODIGO$/), exc: f(/EXCLUS/), rein: f(/REINGRESS/),
        fsc: f(/^FSC$|CERTIFIC|^FSC /), claim: f(/CLAIM|DECLARA/),
      };
      if (c.claim < 0 && c.fsc >= 0 && !h[c.fsc + 1]) c.claim = c.fsc + 1;
    }
    const out = {};
    grid.slice(hr + 1).forEach(r => {
      const nome = clean(r[c.nome]); const key = norm(nome);
      if (!key || key.length < 3) return;
      const exc = c.exc >= 0 ? toISODate(r[c.exc]) : '', rein = c.rein >= 0 ? toISODate(r[c.rein]) : '';
      const ativo = !exc || (!!rein && rein >= exc);
      const fscVal = c.fsc >= 0 ? clean(r[c.fsc]) : '';
      out[key] = { nome, codigo: c.cod >= 0 ? intStr(r[c.cod]) : '', fsc: fscVal || 'FSC', claim: c.claim >= 0 ? clean(r[c.claim]) : '', ativo, exclusao: exc, reingresso: rein };
    });
    return out;
  }

  // chave de comparação de nomes de cliente: sem acento, pontuação e sufixos (LTDA, S/A, ME…)
  const STOP = new Set(['LTDA', 'LTD', 'ME', 'EPP', 'EIRELI', 'SA', 'S', 'A', 'CIA', 'DE', 'DA', 'DO', 'DOS', 'DAS', 'E', 'THE', 'INC', 'SAS', 'SRL', 'CV']);
  const nomeTokens = n => norm(n).replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(t => t && !STOP.has(t));
  const nomeChave = n => nomeTokens(n).join(' ');

  // ---------- Controle OT (campos manuais) ----------
  function parseControleOT(grid) {
    const out = {};
    const hr = grid.findIndex(r => r.some(c => /^TIC\.?\s*BALANCA/.test(norm(c))));
    const start = hr >= 0 ? hr + 1 : 5;
    for (let i = start; i < grid.length; i++) {
      const r = grid[i]; const t = intStr(r[0]);
      if (!/^\d{6,12}$/.test(t)) continue;
      const v = j => { const x = r[j]; if (x == null) return ''; const s = intStr(x); return /^(SEM OT|#N\/A|0)$/i.test(s) ? '' : s; };
      const m = { ot: v(7), doc: v(9), nf: v(10), tara: v(11), mwg: v(12), exp: v(13), container: clean(r[14]).toUpperCase(), lacre: clean(r[15]).toUpperCase(), ticket: v(16) };
      Object.keys(m).forEach(k => { if (!m[k]) delete m[k]; });
      if (Object.keys(m).length) out[t] = m;
    }
    return out;
  }

  // ---------- texto com acentuação quebrada (UTF-8 lido como Windows-1252) ----------
  const CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
  function fixMojibake(str) {
    if (!/[ÃÂ][\u0080-¿Œ-™]/.test(str)) return str;
    return str.replace(/[Â-ô][\u0080-¿ŒœŠšŸŽžƒˆ˜–-™]{1,3}/g, m => {
      const bytes = [];
      for (const ch of m) { const c = ch.charCodeAt(0); const b = c < 256 ? c : CP1252[c]; if (b == null) return m; bytes.push(b); }
      try { return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); } catch (e) { return m; }
    });
  }

  // ---------- página "Solicitação de Embarque - Carregamento de Produto Terminado" (SEW) ----------
  // Uma ficha por carregamento: cabeçalho (agendamento, origem, placas), tabela
  // de itens (Pedido · Entrega · Carga = nº do transporte · Cod.Mat · Material ·
  // Qtde · Cliente), dados do motorista e tabela de treinamentos.
  const isSolicitacao = text => /Solicita\S*\s+de\s+Embarque/i.test(fixMojibake(String(text || ''))) && /Placa\s+(Carreta|Cavalo|Truck)/i.test(text);
  function parseSolicitacoes(text) {
    const t = fixMojibake(String(text || '').replace(/\r\n?/g, '\n'));
    const parts = t.split(/(?=Solicita\S*\s+de\s+Embarque)/i).filter(isSolicitacao);
    return parts.map(parseSolicitacao).filter(Boolean);
  }
  function parseSolicitacao(text) {
    const lines = text.split('\n').map(l => l.split('\t').map(c => clean(c)));
    const kv = {};
    lines.forEach(cells => {
      for (let i = 0; i < cells.length - 1; i++) {
        const m = cells[i].match(/^(.+?):$/);
        if (m) { const k = norm(m[1]); if (kv[k] == null) kv[k] = cells[i + 1]; }
      }
    });
    const g = (...keys) => { for (const k of keys) { const v = kv[norm(k)]; if (v) return v; } return ''; };
    // itens
    const hi = lines.findIndex(c => { const n = c.map(norm); return n.includes('PEDIDO') && n.includes('ENTREGA') && n.includes('CARGA'); });
    const items = [];
    if (hi >= 0) {
      const h = lines[hi].map(norm);
      const col = (...names) => { for (const nm of names) { const i = h.indexOf(nm); if (i >= 0) return i; } return -1; };
      const c = { pedido: col('PEDIDO'), entrega: col('ENTREGA'), carga: col('CARGA'), mat: col('COD.MAT', 'COD MAT', 'MATERIAL COD'), desc: col('MATERIAL'), texto: col('TEXTO COMERCIAL'), qtd: col('QTDE', 'QTD', 'QUANTIDADE'), cli: col('NOME DO CLIENTE', 'CLIENTE'), cid: col('CIDADE'), uf: col('UF'), dep: col('DEPOSITO') };
      for (let r = hi + 1; r < lines.length; r++) {
        const row = lines[r];
        if (!/^\d{6,12}$/.test(intStr(row[c.carga])) && !/^\d+\s*-\s*\d+$/.test(row[c.pedido] || '')) break;
        items.push({ pedido: row[c.pedido] || '', entrega: intStr(row[c.entrega]), transporte: intStr(row[c.carga]), material: intStr(row[c.mat]), descricao: row[c.desc] || '', textoComercial: row[c.texto] || '', qtd: toNum(row[c.qtd]), cliente: row[c.cli] || '', cidade: row[c.cid] || '', uf: row[c.uf] || '', deposito: row[c.dep] || '' });
      }
    }
    // treinamentos: maior validade entre os aplicados
    const ti = lines.findIndex(c => { const n = c.map(norm); return n[0] === 'TREINAMENTO' && n.includes('VALIDADE'); });
    const treinos = [];
    if (ti >= 0) {
      for (let r = ti + 1; r < lines.length; r++) {
        const [nome, status, data, validade] = lines[r];
        if (!nome || lines[r].length < 3) break;
        treinos.push({ nome, aplicado: norm(status) === 'APLICADO', data: toISODate(data), validade: toISODate(validade) });
      }
    }
    const data = toISODate(g('Agendamento')) || toISODate(g('Data'));
    const placaCarreta = g('Placa Carreta'), placaCavalo = g('Placa Cavalo'), placaTruck = g('Placa Truck', 'Placa');
    let placaL, placaM;
    if (placaCarreta) { placaL = normPlate(placaCarreta); placaM = placaCavalo ? normPlate(placaCavalo) : '-'; }
    else { placaL = normPlate(placaTruck || placaCavalo); placaM = '-'; }
    const ult = g('Ult.Treinamento', 'Ult. Treinamento', 'Ultimo Treinamento');
    const aplicados = treinos.filter(x => x.aplicado && x.validade);
    const validade = aplicados.map(x => x.validade).sort().pop() || '';
    const cpf = fmtCPF(g('CPF'));
    let treinamento = ult, cpfStatus = cpf;
    if (!ult && !aplicados.length && treinos.length) treinamento = 'NUNCA FOI TREINADO';
    else if (validade && data && validade < data) cpfStatus = '### TREINAMENTO EXPIRADO ###';
    const origem = g('Origem');
    const janela = /CONTAINER/i.test(origem) ? 'CONTAINER' : 'MI';
    const carregamento = intStr(g('Carregamento'));
    const head = {
      data, hora: toTime(g('Hora')), incoterm: g('Frete').toUpperCase(), agendamento: carregamento,
      obs: g('Observacao'), placaL, placaM, tipoVeiculo: g('Carreta', 'Truck', 'Veiculo') || g('Cavalo'),
      motorista: g('Nome').toUpperCase(), treinamento, transportadora: g('Transportadora'), cpf, cpfStatus,
      celular: g('Celular'), cnpjTransportadora: g('CNPJ'), origem, janela, sequencia: g('Sequencia'),
      peso: toNum(g('Peso da Carga')), container: g('Container', 'Numero Container', 'N Container').toUpperCase(),
      lacre: g('Lacre').toUpperCase(), validadeTreinamento: validade, fonte: 'Solicitação de Embarque',
    };
    if (!items.length) return null;
    const out = items.map((it, i) => {
      const o = Object.assign({ colC: '', colP: '', colT: '', colW: '' }, head, it);
      o.agItem = carregamento ? `${carregamento}-${i + 1}` : String(i + 1);
      if (!isFinite(o.qtd)) o.qtd = null;
      o.key = [o.transporte, o.agItem, o.material, o.entrega].join('|');
      return o;
    });
    const sew = { janela, data, hora: head.hora, status: 'Solicitação de Embarque', senha: '', seq: head.sequencia, tipoVeiculo: head.tipoVeiculo, carreta: placaL, cavalo: placaM === '-' ? '' : placaM, cpf, container: head.container, transportadora: head.transportadora, cliente: items[0].cliente, incoterm: head.incoterm, volume: null, carregamento, peso: head.peso, celular: head.celular };
    return { items: out, sew, carregamento, transportes: Array.from(new Set(out.map(o => o.transporte))) };
  }

  // ---------- tela de OTs por remessa (SAP LT22: Remessa · Material · Texto · Tp.dep · Posição · OT · Qtd) ----------
  const OT_SYN = {
    remessa: ['REMESSA', 'ENTREGA', 'FORNECIMENTO', 'N REMESSA', 'NO REMESSA', 'DOC REFERENCIA', 'DOCUMENTO DE REFERENCIA'],
    ot: ['OT', 'N OT', 'NO OT', 'N OT.', 'NUMERO OT', 'ORDEM TRANSPORTE', 'ORDEM DE TRANSPORTE', 'N ORDEM TRANSPORTE', 'NUMERO DA OT'],
    material: ['MATERIAL', 'COD MATERIAL', 'COD.MAT'],
    texto: ['TEXTO BREVE MATERIAL', 'TEXTO BREVE', 'DESCRICAO', 'DENOMINACAO'],
    tpDep: ['TP.DEP.ORIGEM', 'TP DEP ORIGEM', 'TIPO DEPOSITO ORIGEM', 'TPD'],
    posicao: ['POSICAO DEP.ORIGEM', 'POSICAO DEP ORIGEM', 'POSICAO', 'POSICAO ORIGEM'],
    qtd: ['QTD.TEORICA ORIGEM', 'QTD TEORICA ORIGEM', 'QTD', 'QUANTIDADE', 'QTDE'],
  };
  const hnorm = h => norm(h).replace(/[º°]/g, '').replace(/[^A-Z0-9. ]/g, ' ').replace(/\s+/g, ' ').trim();
  const isOTScreen = text => {
    const raw = fixMojibake(String(text || '')).split('\n').slice(0, 30).join(' ');
    if (/N[º°o.]?\s*OT\b/i.test(raw) && /(Pos\.?\s*origem|Posi\S*\s*Dest|UD\s+destino|QtdTe)/i.test(raw)) return true; // lista LT22 do SAP
    const t = hnorm(raw);
    return /\bOT\b|ORDEM (DE )?TRANSPORTE/.test(t) && /REMESSA|TP\.?DEP|POSICAO DEP|QTD\.?TEORICA/.test(t);
  };
  // Lista LT22 do SAP (colunas fixas, copiada da tela):
  // Nº OT · Material · T · Texto breve · Tp. · Pos.origem · UD origem · QtdTeó · UMA · Tp. ·
  // PosiçDest · UD destino · Dt.criação · Hora · …  — a posição de destino é a remessa
  // (entrega) com zeros à esquerda: 0085714382 => 85714382.
  function parseLT22Lista(text) {
    const out = [];
    fixMojibake(String(text || '')).replace(/\r/g, '').split('\n').forEach(line => {
      const tk = line.replace(/\t/g, ' ').trim().split(/\s+/);
      if (tk.length < 6 || !/^\d{6,12}$/.test(tk[0]) || !/^\d{5,10}$/.test(tk[1])) return;
      // remessa: 1º número de 8–10 dígitos depois do material, precedido de "qtd UMA tpDest"
      let j = -1;
      for (let i = 2; i < tk.length; i++) { if (/^\d{8,10}$/.test(tk[i]) && /^\d{3}$/.test(tk[i - 1] || '') && /^[A-Z]{1,4}$/i.test(tk[i - 2] || '')) { j = i; break; } }
      if (j < 0) for (let i = 2; i < tk.length; i++) { if (/^0*8\d{7}$/.test(tk[i])) { j = i; break; } }
      if (j < 0) return;
      const ot = tk[0].replace(/^0+(?=\d)/, ''), remessa = tk[j].replace(/^0+(?=\d)/, ''), material = tk[1].replace(/^0+(?=\d)/, '');
      const qtdTok = /^[A-Z]{1,4}$/i.test(tk[j - 2] || '') ? tk[j - 3] : '';
      // depois do material: [T] texto … Tp.origem Pos.origem [UD origem] qtd
      const meio = tk.slice(2, qtdTok ? j - 3 : j);
      let tpDep = '', posicao = '';
      for (let i = meio.length - 2; i >= 0; i--) { if (/^[A-Z0-9]{3}$/.test(meio[i]) && /^[A-Z0-9][A-Z0-9\-]{1,9}$/.test(meio[i + 1]) && /[A-Z]/.test(meio[i])) { tpDep = meio[i]; posicao = meio[i + 1]; meio.splice(i); break; } }
      const texto = meio.join(' ').replace(/,$/, '');
      out.push({ remessa, ot, material, texto, tpDep, posicao, qtd: qtdTok ? toNum(qtdTok) : null });
    });
    return out;
  }
  // known = { entregas: Set, materiais: Set } — entregas e materiais já conhecidos no app,
  // usados para reconhecer a remessa e descartar o código do material quando a
  // colagem vem sem títulos ou fora de padrão.
  function parseOTs(grid, known) {
    known = known || {};
    const ents = known.entregas || new Set(), mats = known.materiais || new Set();
    const hr = grid.findIndex(r => { const h = r.map(hnorm); return h.some(x => OT_SYN.ot.includes(x)) && h.some(x => OT_SYN.remessa.includes(x)); });
    const out = [];
    if (hr >= 0) {
      // 1) com títulos: pelas colunas
      const h = grid[hr].map(hnorm); const col = {};
      Object.entries(OT_SYN).forEach(([k, list]) => { const i = h.findIndex(x => list.includes(x)); if (i >= 0) col[k] = i; });
      grid.slice(hr + 1).forEach(r => {
        const remessa = intStr(r[col.remessa]); const ot = intStr(r[col.ot]);
        if (!/^\d{6,12}$/.test(remessa) || !/^\d{3,12}$/.test(ot)) return;
        out.push({ remessa, ot, material: col.material != null ? intStr(r[col.material]) : '', texto: col.texto != null ? clean(r[col.texto]) : '',
          tpDep: col.tpDep != null ? clean(r[col.tpDep]) : '', posicao: col.posicao != null ? clean(r[col.posicao]) : '', qtd: col.qtd != null ? toNum(r[col.qtd]) : null });
      });
      return out;
    }
    // 2) sem títulos / fora de padrão: linha a linha. Remessa = entrega conhecida ou
    //    8xxxxxxx; OT = número de 6 a 12 dígitos na mesma linha que não é a remessa
    //    nem o material (quantidades têm menos dígitos).
    grid.forEach(r => {
      // pedido-item ("6984037 - 10") e datas não são OT
      const cells = r.map(c => (typeof c === 'number' ? String(Math.round(c)) : clean(c)).replace(/\b\d{5,}\s*-\s*\d{1,4}\b/g, ' ').replace(/\b\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4}\b/g, ' ').replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' '));
      const nums = [];
      cells.forEach((c, ci) => { (c.match(/\d[\d.]*\d|\d/g) || []).forEach(tok => { const d = tok.replace(/\./g, '').replace(/^0+(?=\d)/, ''); if (/^\d+$/.test(d) && !/^\d{1,3}(\.\d{3})+$/.test(tok)) nums.push({ d, ci }); }); });
      let rem = nums.find(n => ents.has(n.d)) || nums.find(n => /^8\d{7}$/.test(n.d));
      if (!rem) return;
      const looksMat = n => mats.has(n.d) || (!mats.size && /^1\d{6}$/.test(n.d));
      const cand = nums.filter(n => n.d !== rem.d && n.d.length >= 6 && n.d.length <= 12 && !looksMat(n) && !ents.has(n.d) && !/^8\d{7}$/.test(n.d));
      if (!cand.length) return;
      const ot = cand[0];
      const mat = nums.find(n => looksMat(n));
      const texto = cells.find(c => /[A-Z]{3,}/i.test(c) && /\d+\s*x\s*\d+/i.test(c)) || '';
      const qtd = nums.filter(n => n.ci > ot.ci && n.d.length <= 5).map(n => +n.d)[0];
      out.push({ remessa: rem.d, ot: ot.d, material: mat ? mat.d : '', texto, tpDep: '', posicao: '', qtd: qtd != null ? qtd : null });
    });
    return out;
  }

  // ---------- base de pesos (análise de peso por item) ----------
  // Colunas reconhecidas pelos títulos (vários nomes possíveis). A NF é a chave mestra.
  const PESO_SYN = {
    nf: [/^(N[ºO°]?\.?\s*)?(DA\s+)?(NF|NFE|NF-E|NOTA|NOTA FISCAL|N NF|NUM(ERO)? (DA )?(NF|NOTA)( FISCAL)?|DOC(UMENTO)? FISCAL)$/, /NOTA FISCAL|^NF/],
    data: [/^DATA( DE)?( EMISSAO| DOC(UMENTO)?| FATURAMENTO| SAIDA)?$|^EMISSAO$|^DT\.? ?(EMIS|DOC|FAT)/],
    material: [/^(COD(IGO)?\.? ?)?MATERIAL$|^COD\.? ?MAT|^ITEM$|^PRODUTO$|^COD(IGO)? (DO )?PRODUTO$|^SKU$/],
    descricao: [/DESCRI|TEXTO BREVE|DENOMINA|TEXTO COMERCIAL|NOME (DO )?PRODUTO/],
    qtd: [/^(QTD|QTDE|QUANTIDADE)( FATURADA| PECAS| PC| EM PECAS)?$|^PECAS$|^PCS$/],
    unidade: [/^(UM|UN|UNID|UNIDADE|UMB|UMV)$/],
    pl: [/PESO\s*LIQ|^P\.?\s*LIQ|^PL$|LIQUIDO/],
    pb: [/PESO\s*BRU|^P\.?\s*BRU|^PB$|BRUTO/],
    volume: [/^(VOLUME|M3|M³|VOL)$/],
    cliente: [/^(CLIENTE|NOME (DO )?CLIENTE|RECEBEDOR|DESTINATARIO|RAZAO SOCIAL)$/],
    transporte: [/^TRANSPORTE$|^N[ºO]? ?TRANSPORTE$/],
    entrega: [/^(ENTREGA|REMESSA|FORNECIMENTO)$/],
    placa: [/^PLACA/],
  };
  const PESO_LABEL = { nf: 'NF-e', data: 'Data', material: 'Material', descricao: 'Descrição', qtd: 'Quantidade', unidade: 'Unidade', pl: 'Peso líquido', pb: 'Peso bruto', volume: 'Volume', cliente: 'Cliente', transporte: 'Transporte', entrega: 'Entrega', placa: 'Placa' };
  const nfNorm = v => { const d = intStr(v).replace(/\D/g, '').replace(/^0+(?=\d)/, ''); return d; };
  function parsePesos(grid) {
    const H = r => r.map(c => norm(c).replace(/[º°]/g, 'O').replace(/[^A-Z0-9 .\-³]/g, ' ').replace(/\s+/g, ' ').trim());
    const hr = grid.findIndex(r => { const h = H(r); return h.some(x => PESO_SYN.nf.some(re => re.test(x))) && h.some(x => PESO_SYN.pl[0].test(x) || PESO_SYN.pb[0].test(x)); });
    if (hr < 0) return { rows: [], map: {}, erro: 'Não encontrei a linha de títulos com NF e peso (líquido ou bruto).' };
    const h = H(grid[hr]); const map = {};
    Object.entries(PESO_SYN).forEach(([k, res]) => {
      for (const re of res) { const i = h.findIndex((x, j) => re.test(x) && !Object.values(map).includes(j)); if (i >= 0) { map[k] = i; break; } }
    });
    const rows = [];
    grid.slice(hr + 1).forEach(r => {
      const nf = nfNorm(r[map.nf]); if (!nf || nf.length < 3) return;
      const get = k => (map[k] != null ? r[map[k]] : '');
      const row = {
        nf, data: toISODate(get('data')), material: intStr(get('material')).replace(/^0+(?=\d)/, ''), descricao: clean(get('descricao')),
        qtd: toNum(get('qtd')), unidade: clean(get('unidade')).toUpperCase(), pl: toNum(get('pl')), pb: toNum(get('pb')), volume: toNum(get('volume')),
        cliente: clean(get('cliente')), transporte: intStr(get('transporte')), entrega: intStr(get('entrega')).replace(/^0+(?=\d)/, ''), placa: clean(get('placa')).toUpperCase(),
      };
      ['qtd', 'pl', 'pb', 'volume'].forEach(k => { if (!isFinite(row[k])) row[k] = null; });
      if (row.pl == null && row.pb == null) return;
      rows.push(row);
    });
    return { rows, map, header: grid[hr] };
  }

  global.OEP = {
    parsePesos, nfNorm, PESO_LABEL,
    isOTScreen, parseOTs, parseLT22Lista,
    fixMojibake, isSolicitacao, parseSolicitacoes,
    clean, norm, pad, toISODate, toTime, fmtDateBR, todayISO, toNum, intStr, cpfDigits, fmtCPF, isCPFLike,
    normPlate, plate7, plateUF, isPlate, matInfo, parseTSV, parseHTMLTable, trimGrid,
    LOG_COLS, LOG_KEYS, LOG_LABEL, detectLogMapping, rowsToItems, parseSEW, parseFSC, parseControleOT, nomeTokens, nomeChave,
  };
})(window);
