/* Fotos das cargas de container: armazenamento (IndexedDB), compressão,
   leitura dos dados nas fotos (OCR opcional, Tesseract.js via CDN) e e-mail (.eml).
   As imagens ficam só neste computador (IndexedDB); no estado do app (e no arquivo
   compartilhado) vão apenas o nome do arquivo e os dados lidos/conferidos. */
(function (global) {
  'use strict';

  // 6 fotos por carga de container; as 3 primeiras trazem dados que são confrontados
  const SLOTS = [
    { k: 'porta', nome: 'Porta do container', dica: 'nº do container, tara e carga máx.', campos: ['container', 'tara', 'mwg'], re: /porta|door|tara|tare|placa|plate/i },
    { k: 'ric', nome: 'RIC', dica: 'RIC + ordem + lacre físico: container, lacre, tara, max gross', campos: ['container', 'contOrdem', 'lacre', 'lacreFis', 'tara', 'mwg'], re: /\bric\b|ric[\s_\-.]|^ric|interc[aâ]mbio|eir/i },
    { k: 'lacre', nome: 'Lacre', dica: 'nº do lacre', campos: ['lacre'], re: /lacre|seal|selo/i },
    { k: 'f4', nome: 'Foto 4', dica: 'container vazio / interno', campos: [], re: /vazio|empty|interno|inside/i },
    { k: 'f5', nome: 'Foto 5', dica: 'carga / meia porta', campos: [], re: /meia|carga|carregad|half|load/i },
    { k: 'f6', nome: 'Foto 6', dica: 'porta fechada e lacrada', campos: [], re: /fechad|closed|lacrad|final/i },
  ];
  const CAMPO_NOME = { container: 'Nº container', contOrdem: 'Container na ordem (papel)', tara: 'Tara (kg)', mwg: 'Carga máx. / Max gross (kg)', lacre: 'Lacre', lacreFis: 'Lacre físico (na foto)' };

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
  async function comprimir(file, max = 2400, q = 0.85) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('imagem inválida')); i.src = url; });
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', q));
    } finally { URL.revokeObjectURL(url); }
  }
  const reduzir = (blob, max = 1280) => comprimir(blob, max, 0.8); // fotos do e-mail
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

  // dado que existe na foto mas não dá para ler com certeza
  const ILEGIVEL = 'ILEGÍVEL';
  const ehIlegivel = v => /^ILEG[IÍ]VEL$/i.test(String(v || '').trim());

  // ---------- nº de container (ISO 6346) ----------
  const ISO_VAL = (() => { const m = {}; let v = 10; for (let c = 65; c <= 90; c++) { if (v % 11 === 0) v++; m[String.fromCharCode(c)] = v++; } return m; })();
  function digitoVerificador(c10) {
    let s = 0; for (let i = 0; i < 10; i++) { const ch = c10[i]; const v = /\d/.test(ch) ? +ch : ISO_VAL[ch]; if (v == null) return null; s += v * 2 ** i; }
    return (s % 11) % 10;
  }
  const normCont = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const contValido = v => { const c = normCont(v); return /^[A-Z]{3}[UJZ]\d{7}$/.test(c) && digitoVerificador(c) === +c[10]; };
  // Sem adivinhar: só vale o nº lido exatamente como está escrito (4 letras + 7 dígitos) e com o dígito
  // verificador certo. Letras/dígitos trocados pela leitura => não aceita (o campo fica ILEGÍVEL).
  function containersNoTexto(text) {
    const t = String(text || '').toUpperCase();
    const out = [];
    const re = /\b([A-Z]{3}[UJZ])[\s\-.:]*(\d{3})[\s\-.]*(\d{3})[\s\-.()\[\]|]*(\d)\b/g;
    let m;
    while ((m = re.exec(t))) {
      const c = m[1] + m[2] + m[3] + m[4];
      if (digitoVerificador(c) === +c[10]) out.push({ c, ok: true });
      re.lastIndex = m.index + 1;
    }
    const vistos = new Set();
    return out.filter(x => !vistos.has(x.c) && vistos.add(x.c));
  }
  const fmtCont = c => { if (ehIlegivel(c)) return ILEGIVEL; const x = normCont(c); const m = x.match(/^([A-Z]{4})(\d{6})(\d)$/); return m ? `${m[1]} ${m[2]}-${m[3]}` : x; };

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
        const resto = t.slice(m.index + m[0].length - 4).split('\n');
        const trecho = resto.slice(0, 2).join(' '); // só a linha do rótulo e a seguinte
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
  // lacre: o esperado só conta se aparecer escrito igual; senão, o código logo depois de "LACRE"/"SEAL NO"
  // (prefixo de letras + dígitos, sem trocar letras por números)
  function lerLacre(text, esperado) {
    const t = String(text || '').toUpperCase();
    const e = normLacre(esperado);
    if (e && e.length >= 4 && normLacre(t).includes(e)) return e;
    const m = t.match(/(?:LACRE|SEAL|SELO)\s*(?:N[ºO°]?\.?)?\s*[:.\-]?\s*([A-Z]{0,4}[\s\-]?\d{5,14})\b/);
    if (m) return normLacre(m[1]);
    return '';
  }
  const ocorrencias = (t, code) => code ? normLacre(t).split(code).length - 1 : 0;
  const lacreIgual = (a, b) => !!a && !!b && normLacre(a) === normLacre(b);

  // container logo depois de um rótulo (ex.: "Container No:" no RIC, "Número Container" na ordem Arauco)
  function contRotulo(text, re) {
    const t = String(text || '').toUpperCase(); let m; const g = new RegExp(re.source, 'g');
    while ((m = g.exec(t))) { const c = containersNoTexto(t.slice(m.index + m[0].length, m.index + m[0].length + 40))[0]; if (c) return c.c; }
    return '';
  }
  const RE_CONT_RIC = /CONTAINER\s*(N[O0º°]\b\.?|NUMBER|#)|CNTR\s*N|EQUIPMENT\s*N/;
  const RE_CONT_ORDEM = /N\S{0,3}MERO\s*(DO\s*)?CONT[AE]INER|N[º°O]\.?\s*(DO\s*)?CONT[AE]INER/;
  // dados de uma foto a partir do texto lido
  function dadosDoTexto(slot, text, esperado) {
    const r = {};
    if (slot === 'ric') {
      // a foto do RIC traz o RIC (container, lacre, tara, max gross), a ordem Arauco (container) e o lacre físico
      const t = String(text || '').toUpperCase();
      const cs = containersNoTexto(t).filter(x => x.ok);
      r.container = contRotulo(t, RE_CONT_RIC) || (cs.length === 1 ? cs[0].c : '');
      r.contOrdem = contRotulo(t, RE_CONT_ORDEM) || '';
      // o mesmo nº aparece duas vezes (RIC e ordem) e não achamos o rótulo da ordem: é o da ordem também
      if (!r.contOrdem && r.container && ocorrencias(t, r.container) >= 2) r.contOrdem = r.container;
      const l = lerLacre(t, esperado.lacre); if (l) r.lacre = l;
      // lacre físico: o código do lacre aparece de novo na foto (gravado no lacre)
      if (l && ocorrencias(t, l) >= 2) r.lacreFis = l;
      const ta = lerTara(t); if (ta) r.tara = ta; const mw = lerMwg(t); if (mw) r.mwg = mw;
      // o que a foto do RIC deveria mostrar e não foi lido com certeza: ILEGÍVEL
      SLOTS.find(x => x.k === 'ric').campos.forEach(k => { if (!r[k]) r[k] = ILEGIVEL; });
      return r;
    }
    if (slot === 'porta') {
      const cs = containersNoTexto(text);
      r.container = cs.length === 1 ? cs[0].c : ILEGIVEL; // nenhum ou mais de um nº diferente: não escolhe
      r.tara = lerTara(text) || ILEGIVEL; r.mwg = lerMwg(text) || ILEGIVEL;
    }
    if (slot === 'lacre') {
      // foto só do lacre: o único código (letras + dígitos) escrito nela
      const cods = Array.from(new Set((String(text || '').toUpperCase().match(/\b[A-Z]{0,4}\s?\d{6,14}\b/g) || []).map(normLacre)));
      r.lacre = lerLacre(text, esperado.lacre) || (cods.length === 1 ? cods[0] : ILEGIVEL);
    }
    return r;
  }

  // que foto é esta? pontuação pelo texto lido: porta (placa com TARE/MAX GROSS), RIC (folha com muitos campos), lacre
  function classificar(text, esperado) {
    const t = String(text || '').toUpperCase(); const len = t.replace(/\s+/g, '').length;
    const cont = containersNoTexto(t).length > 0;
    const conta = (re) => (t.match(re) || []).length;
    let porta = (cont ? 2 : 0) + (/\bTARE\b|\bTARA\b/.test(t) ? 3 : 0) + (/GROSS|MAX\.?\s*G|M\.?\s*G\.?\s*W|PAYLOAD|CU\.?\s*CAP|\bNET\b|\bLB\b/.test(t) ? 3 : 0);
    const docs = conta(/\bRIC\b|INTERC[AÂ]MBIO|RECIBO|\bEIR\b|INTERCHANGE|AVARIA|TERMINAL|MOTORISTA|ASSINATURA|TRANSPORTADORA|BOOKING|NAVIO|ARMADOR|PLACA|DEPOT|DEP[OÓ]SITO|VISTORIA|GATE|TRUCK\s*N|DRIVER|CARRIER|VESSEL|VOYAGE|\bPOL\b|SEAL\s*N|CONTAINER\s*N|REFERENCE|SHIPPING|CUSTOMER|GRADE|SOLICITA|EMBARQUE|AGENDAMENTO/g);
    const ric = docs * 2 + (cont ? 1 : 0) + (len > 220 ? 2 : 0);
    if (docs >= 3) porta -= 5; // documento (RIC/ordem) também tem TARE e MAX GROSS, mas não é a porta
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
      const s = Math.min(2, 3200 / Math.max(img.naturalWidth, img.naturalHeight)); // texto pequeno do RIC: ler em alta resolução
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
    SLOTS, CAMPO_NOME, put, get, del, comprimir, reduzir, blobToDataURL, distribuir, imagens, assinatura, papelBranco, classificar,
    ILEGIVEL, ehIlegivel, digitoVerificador, contValido, normCont, fmtCont, containersNoTexto, lerTara, lerMwg, lerLacre, normLacre, lacreIgual, dadosDoTexto,
    carregarOCR, ocr, montarEML,
  };
})(window);
