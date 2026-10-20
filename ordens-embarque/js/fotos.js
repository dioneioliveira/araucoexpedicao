/* Fotos das cargas de container: armazenamento (IndexedDB), compressão,
   leitura dos dados nas fotos (OCR opcional, Tesseract.js via CDN) e e-mail (.eml).
   As imagens ficam só neste computador (IndexedDB); no estado do app (e no arquivo
   compartilhado) vão apenas o nome do arquivo e os dados lidos/conferidos. */
(function (global) {
  'use strict';

  // 6 fotos por carga de container; as 3 primeiras trazem dados que são confrontados
  const SLOTS = [
    { k: 'porta', nome: 'Porta do container', dica: 'nº do container, tara e carga máx.', campos: ['container', 'tara', 'mwg'], re: /porta|door|tara|tare|placa|plate/i },
    { k: 'ric', nome: 'RIC', dica: 'nº do container e lacre', campos: ['container', 'lacre'], re: /\bric\b|ric[\s_\-.]|^ric|interc[aâ]mbio|eir/i },
    { k: 'lacre', nome: 'Lacre', dica: 'nº do lacre', campos: ['lacre'], re: /lacre|seal|selo/i },
    { k: 'f4', nome: 'Foto 4', dica: 'container vazio / interno', campos: [], re: /vazio|empty|interno|inside/i },
    { k: 'f5', nome: 'Foto 5', dica: 'carga / meia porta', campos: [], re: /meia|carga|carregad|half|load/i },
    { k: 'f6', nome: 'Foto 6', dica: 'porta fechada e lacrada', campos: [], re: /fechad|closed|lacrad|final/i },
  ];
  const CAMPO_NOME = { container: 'Nº container', tara: 'Tara (kg)', mwg: 'Carga máx. / Max gross (kg)', lacre: 'Lacre' };

  // ---------- IndexedDB das imagens ----------
  const DB = 'arauco-ordens-fotos', STORE = 'fotos';
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const tx = (mode, fn) => db().then(d => new Promise((res, rej) => {
    const t = d.transaction(STORE, mode); const q = fn(t.objectStore(STORE));
    t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error);
  }));
  const put = (id, blob) => tx('readwrite', s => s.put(blob, id));
  const get = id => tx('readonly', s => s.get(id));
  const del = id => tx('readwrite', s => s.delete(id));

  // ---------- imagem: reduz para no máx. 1600 px (JPEG) ----------
  async function comprimir(file, max = 1600, q = 0.82) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('imagem inválida')); i.src = url; });
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', q));
    } finally { URL.revokeObjectURL(url); }
  }
  const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

  // distribui os arquivos de uma pasta nas 6 posições: pelo nome (porta, ric, lacre…), o resto em ordem
  function distribuir(files) {
    const imgs = Array.from(files).filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|bmp|heic)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    const out = {}; const usados = new Set();
    SLOTS.forEach(s => { const f = imgs.find(x => !usados.has(x) && s.re.test(x.name)); if (f) { out[s.k] = f; usados.add(f); } });
    const resto = imgs.filter(f => !usados.has(f));
    SLOTS.forEach(s => { if (!out[s.k] && resto.length) out[s.k] = resto.shift(); });
    return { porSlot: out, sobra: resto.length, total: imgs.length };
  }

  const imagens = files => Array.from(files).filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|bmp)$/i.test(f.name))
    .sort((a, b) => (a.lastModified - b.lastModified) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  const assinatura = f => `${f.name}|${f.size}|${f.lastModified}`;

  // folha de papel (RIC): fração de pixels claros e sem cor — usado quando a leitura do texto não está disponível
  async function papelBranco(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const c = document.createElement('canvas'); c.width = 96; c.height = 72; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 96, 72);
      const d = g.getImageData(0, 0, 96, 72).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mn > 175 && mx - mn < 30) n++; }
      return n / (d.length / 4);
    } catch (e) { return 0; } finally { URL.revokeObjectURL(url); }
  }

  // ---------- nº de container (ISO 6346) ----------
  const ISO_VAL = (() => { const m = {}; let v = 10; for (let c = 65; c <= 90; c++) { if (v % 11 === 0) v++; m[String.fromCharCode(c)] = v++; } return m; })();
  function digitoVerificador(c10) {
    let s = 0; for (let i = 0; i < 10; i++) { const ch = c10[i]; const v = /\d/.test(ch) ? +ch : ISO_VAL[ch]; if (v == null) return null; s += v * 2 ** i; }
    return (s % 11) % 10;
  }
  const normCont = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const contValido = v => { const c = normCont(v); return /^[A-Z]{3}[UJZ]\d{7}$/.test(c) && digitoVerificador(c) === +c[10]; };
  const DIG = { O: '0', Q: '0', D: '0', I: '1', L: '1', T: '1', Z: '2', S: '5', B: '8', G: '6' };
  const LET = { 0: 'O', 1: 'I', 5: 'S', 8: 'B', 2: 'Z', 6: 'G' };
  // letras parecidas no prefixo (O/Q, C/G, I/L…): o dígito verificador decide
  const PARECIDAS = { O: 'QDC', Q: 'O', D: 'O', C: 'GO', G: 'C', I: 'LT', L: 'I', T: 'I', B: 'RE', R: 'B', E: 'FB', F: 'E', M: 'NH', N: 'MH', H: 'NM', S: 'B', K: 'X', X: 'K', V: 'U', W: 'M' };
  const COMUNS = new Set(['OQ', 'QO', 'OD', 'DO', 'CG', 'GC', 'IL', 'LI', 'IT', 'TI', 'MN', 'NM', 'VU']);
  function corrigirPrefixo(c) {
    if (digitoVerificador(c) === +c[10]) return [{ c, ok: true }];
    const alts = [];
    for (let i = 0; i < 3; i++) for (const alt of (PARECIDAS[c[i]] || '')) {
      const x = c.slice(0, i) + alt + c.slice(i + 1);
      if (digitoVerificador(x) === +x[10]) alts.push({ c: x, ok: true, corrigido: true, peso: COMUNS.has(c[i] + alt) ? 0 : 1 });
    }
    return alts.length ? alts.sort((a, b) => a.peso - b.peso) : [{ c, ok: false }];
  }
  function containersNoTexto(text) {
    const t = String(text || '').toUpperCase();
    const out = [];
    const re = /([A-Z0-9]{3}[UJZ0])[\s\-.:]*([0-9OQDILTZSBG]{3})[\s\-.]*([0-9OQDILTZSBG]{3})[\s\-.()\[\]|]*([0-9OQDILTZSBG])/g;
    let m;
    while ((m = re.exec(t))) {
      const pre = m[1].split('').map((ch, i) => (i < 3 ? (LET[ch] || ch) : (ch === '0' ? 'U' : ch))).join('');
      const num = (m[2] + m[3] + m[4]).split('').map(ch => DIG[ch] || ch).join('');
      const c = pre + num;
      if (/^[A-Z]{3}[UJZ]\d{7}$/.test(c)) out.push(...corrigirPrefixo(c));
      re.lastIndex = m.index + 1;
    }
    // únicos, válidos primeiro
    const vistos = new Set();
    return out.filter(x => !vistos.has(x.c) && vistos.add(x.c)).sort((a, b) => b.ok - a.ok);
  }
  const fmtCont = c => { const x = normCont(c); const m = x.match(/^([A-Z]{4})(\d{6})(\d)$/); return m ? `${m[1]} ${m[2]}-${m[3]}` : x; };

  // ---------- pesos da placa da porta (TARE / MAX GROSS) ----------
  function kgNum(s) {
    const x = String(s).replace(/\s+/g, '');
    if (/^\d{1,3}([.,]\d{3})+$/.test(x)) return +x.replace(/[.,]/g, '');
    if (/^\d{4,6}$/.test(x)) return +x;
    return null;
  }
  function pesoApos(text, labels) {
    const t = String(text || '').toUpperCase().replace(/\r/g, '');
    for (const lab of labels) {
      const re = new RegExp(lab + '[^\\n]{0,4}', 'g'); let m;
      while ((m = re.exec(t))) {
        const trecho = t.slice(m.index + m[0].length - 4, m.index + 90);
        // prefere o número seguido de KG; senão o primeiro número de 4–6 dígitos
        const kgm = trecho.match(/(\d{1,3}(?:[.,\s]\d{3})+|\d{4,6})\s*(KGS?|KG\.)/);
        if (kgm) { const v = kgNum(kgm[1]); if (v) return v; }
        const nm = trecho.match(/(\d{1,3}(?:[.,]\d{3})+|\d{4,6})/);
        if (nm) { const v = kgNum(nm[1]); if (v) return v; }
      }
    }
    return null;
  }
  const lerTara = text => pesoApos(text, ['TARE', 'TARA']);
  const lerMwg = text => pesoApos(text, ['MAX\\.?\\s*GROSS', 'MAX\\.?\\s*G\\.?\\s*W', 'M\\.?\\s*G\\.?\\s*W', 'GROSS\\s*WEIGHT', 'MAX\\.?\\s*WT', 'PESO\\s*BRUTO\\s*M', 'MAXIMUM\\s*GROSS', 'GROSS']);

  // ---------- lacre ----------
  const normLacre = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const lacreOCR = v => normLacre(v).replace(/[OQD]/g, '0').replace(/[IL]/g, '1');
  // procura o lacre esperado no texto (tolerando O/0, I/1); senão, o código depois de "LACRE"/"SEAL"
  function lerLacre(text, esperado) {
    const t = String(text || '').toUpperCase();
    const e = normLacre(esperado);
    if (e && e.length >= 4) {
      const alvo = lacreOCR(e); const corrido = lacreOCR(t);
      if (corrido.includes(alvo)) return e;
      // só os dígitos do lacre (prefixos de letras costumam sair errados)
      const dig = e.replace(/\D/g, '');
      if (dig.length >= 5 && corrido.includes(dig)) return e;
    }
    const m = t.match(/(?:LACRE|SEAL|SELO)[^A-Z0-9\n]{0,12}(?:N[ºO°.]*\s*)?([A-Z]{0,4}[\s\-]?\d{5,12})/);
    if (m) return normLacre(m[1]);
    return '';
  }
  const lacreIgual = (a, b) => !!a && !!b && lacreOCR(a) === lacreOCR(b);

  // dados de uma foto a partir do texto lido
  function dadosDoTexto(slot, text, esperado) {
    const r = {};
    if (slot === 'porta' || slot === 'ric') {
      const cs = containersNoTexto(text);
      const alvo = normCont(esperado.container);
      const hit = cs.find(x => x.c === alvo) || cs.find(x => x.ok) || cs[0];
      if (hit) r.container = hit.c;
    }
    if (slot === 'porta') { const ta = lerTara(text); if (ta) r.tara = ta; const mw = lerMwg(text); if (mw) r.mwg = mw; }
    if (slot === 'ric' || slot === 'lacre') { const l = lerLacre(text, esperado.lacre); if (l) r.lacre = l; }
    return r;
  }

  // que foto é esta? pontuação pelo texto lido: porta (placa com TARE/MAX GROSS), RIC (folha com muitos campos), lacre
  function classificar(text, esperado) {
    const t = String(text || '').toUpperCase(); const len = t.replace(/\s+/g, '').length;
    const cont = containersNoTexto(t).length > 0;
    const conta = (re) => (t.match(re) || []).length;
    const porta = (cont ? 2 : 0) + (/\bTARE\b|\bTARA\b/.test(t) ? 3 : 0) + (/GROSS|MAX\.?\s*G|M\.?\s*G\.?\s*W|PAYLOAD|CU\.?\s*CAP|\bNET\b|\bLB\b/.test(t) ? 3 : 0);
    const ric = conta(/\bRIC\b|INTERC[AÂ]MBIO|RECIBO|\bEIR\b|INTERCHANGE|AVARIA|TERMINAL|MOTORISTA|ASSINATURA|TRANSPORTADORA|BOOKING|NAVIO|ARMADOR|PLACA|DEPOT|DEP[OÓ]SITO|VISTORIA/g) * 2 + (cont ? 1 : 0) + (len > 220 ? 2 : 0);
    const temLacre = esperado && esperado.lacre ? !!lerLacre(t, esperado.lacre) : /(LACRE|SEAL|SELO)[^A-Z0-9]{0,12}[A-Z]{0,4}\d{5,}/.test(t);
    // folha com container E lacre = RIC; o lacre sozinho (sem nº de container nem pesos) = foto do lacre
    const ricTotal = ric + (/\bRIC\b/.test(t) ? 3 : 0) + (cont && temLacre ? 4 : 0);
    const lacre = (temLacre ? 4 : 0) + (/LACRE|SEAL|SELO/.test(t) ? 1 : 0) + (len < 80 && /\d{5,}/.test(t) ? 3 : 0) - (len > 220 ? 2 : 0) - (cont ? 4 : 0) - (porta >= 6 ? 3 : 0);
    return { porta, ric: ricTotal, lacre };
  }

  // ---------- OCR (Tesseract.js, carregado só quando usado; precisa de internet) ----------
  const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  let tessP = null;
  function carregarOCR() {
    if (global.Tesseract) return Promise.resolve(global.Tesseract);
    if (!tessP) tessP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = TESS; s.async = true;
      s.onload = () => (global.Tesseract ? res(global.Tesseract) : rej(new Error('OCR indisponível')));
      s.onerror = () => { tessP = null; rej(new Error('sem internet para carregar a leitura automática (OCR)')); };
      document.head.appendChild(s);
    });
    return tessP;
  }
  // realce para OCR: tons de cinza + contraste, ampliado
  async function prepararOCR(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const s = Math.min(2, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      const g = c.getContext('2d'); g.filter = 'grayscale(1) contrast(1.6)'; g.drawImage(img, 0, 0, c.width, c.height);
      return await new Promise(res => c.toBlob(res, 'image/png'));
    } finally { URL.revokeObjectURL(url); }
  }
  async function ocr(blob, onProgress) {
    const T = await carregarOCR();
    const img = await prepararOCR(blob);
    const r = await T.recognize(img, 'eng', { logger: m => onProgress && m.status === 'recognizing text' && onProgress(m.progress) });
    return (r && r.data && r.data.text) || '';
  }

  // ---------- e-mail .eml (abre como rascunho no Outlook: X-Unsent) ----------
  const b64utf8 = s => btoa(unescape(encodeURIComponent(s)));
  const wrap76 = s => s.replace(/.{1,76}/g, '$&\r\n');
  function montarEML({ para, cc, assunto, html, anexos }) {
    const bd = '=_oe_' + Math.random().toString(36).slice(2);
    const h = ['X-Unsent: 1', para ? `To: ${para}` : '', cc ? `Cc: ${cc}` : '', `Subject: =?UTF-8?B?${b64utf8(assunto)}?=`, 'MIME-Version: 1.0',
      `Content-Type: multipart/related; boundary="${bd}"; type="text/html"`].filter(Boolean).join('\r\n');
    const parts = [`--${bd}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64utf8(html))}`];
    anexos.forEach(a => parts.push(`--${bd}\r\nContent-Type: ${a.tipo}; name="${a.nome}"\r\nContent-Transfer-Encoding: base64\r\nContent-ID: <${a.cid}>\r\nContent-Disposition: inline; filename="${a.nome}"\r\n\r\n${wrap76(a.base64)}`));
    return `${h}\r\n\r\n${parts.join('\r\n')}\r\n--${bd}--\r\n`;
  }

  global.OEF = {
    SLOTS, CAMPO_NOME, put, get, del, comprimir, blobToDataURL, distribuir, imagens, assinatura, papelBranco, classificar,
    digitoVerificador, contValido, normCont, fmtCont, containersNoTexto, lerTara, lerMwg, lerLacre, normLacre, lacreIgual, dadosDoTexto,
    carregarOCR, ocr, montarEML,
  };
})(window);
