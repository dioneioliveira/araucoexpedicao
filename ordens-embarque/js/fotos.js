/* Fotos das cargas de container: armazenamento (IndexedDB), compressão,
   leitura dos dados nas fotos (OCR opcional, Tesseract.js via CDN) e e-mail (.eml).
   As imagens ficam só neste computador (IndexedDB); no estado do app (e no arquivo
   compartilhado) vão apenas o nome do arquivo e os dados lidos/conferidos. */
(function (global) {
  'use strict';

  // 6 fotos por carga de container; as 3 primeiras trazem dados que são confrontados
  // Dados conferidos vêm de 2 fotos: PORTA FECHADA (nº, tara, max gross) e RIC + LACRE (RIC sobre a ordem Arauco,
  // com o lacre ao lado, foto de perto). As outras 4 são registro do carregamento, sem campos.
  const SLOTS = [
    { k: 'porta', nome: 'Porta fechada', dica: 'nº do container, tara e max gross', campos: ['container', 'tara', 'mwg'], re: /porta|door|tara|tare|placa|plate|fechad|closed/i },
    { k: 'ric', nome: 'RIC + lacre', dica: 'RIC sobre a ordem, com o lacre ao lado (de perto)', campos: ['container', 'contOrdem', 'lacre', 'lacreFis', 'tara', 'mwg'], re: /\bric\b|ric[\s_\-.]|^ric|interc[aâ]mbio|eir/i },
    { k: 'lacre', nome: 'Lacre (detalhe)', dica: 'lacre na porta', campos: [], re: /lacre|seal|selo/i },
    { k: 'f4', nome: 'Interior vazio', dica: 'container vazio', campos: [], re: /vazio|empty|interno|inside/i },
    { k: 'f5', nome: 'Carga amarrada', dica: 'carga e amarração', campos: [], re: /meia|carga|carregad|half|load|amarra/i },
    { k: 'f6', nome: 'Foto 6', dica: 'outra (opcional)', campos: [], re: /aberta|open|extra|outra/i },
  ];
  const PADRAO_MWG = 32500; // max gross mais comum: valor diferente gera aviso (não é usado para preencher)
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
  const putLocal = (id, blob) => tx('readwrite', s => s.put(blob, id));
  const getLocal = id => tx('readonly', s => s.get(id));
  const delLocal = id => tx('readwrite', s => s.delete(id));
  // pasta compartilhada (servidor): a foto fica nos dois lugares; quem não tem a foto busca na pasta e guarda cópia
  let remoto = null;
  const setRemoto = r => { remoto = r; };
  async function put(id, blob) { await putLocal(id, blob); if (remoto) await remoto.put(id, blob).catch(() => false); }
  async function get(id) {
    const b = await getLocal(id).catch(() => null); if (b) return b;
    if (!remoto) return null;
    const r = await remoto.get(id).catch(() => null);
    if (r) { await putLocal(id, r).catch(() => {}); return r; }
    return null;
  }
  async function del(id) { await delLocal(id).catch(() => {}); if (remoto) await remoto.del(id).catch(() => {}); }
  // envia para a pasta as fotos que só existem neste computador (ex.: importadas antes de conectar a pasta)
  async function enviarPendentes(ids) { if (!remoto) return 0; let n = 0; for (const id of ids) { if (await remoto.get(id).catch(() => null)) continue; const b = await getLocal(id).catch(() => null); if (b && await remoto.put(id, b).catch(() => false)) n++; } return n; }

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
    const re = /\b([A-Z]{3}[UJZ])[\s\-.:|]*(\d{3})[\s\-.]*(\d{3})[\s\-.()\[\]|]*(?:[iIl!]\s*[|\])]?[\s\-.()\[\]|]*)?(\d)\b/g; // borda da caixa do dígito lida como \"i |\"
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
  // peso só na MESMA linha do rótulo e em kg (ou sem unidade, como no RIC); valor em LBS não é convertido.
  // Fora da faixa possível => não aceita (ex.: tara lida no lugar do max gross).
  const FAIXA = { tara: [1000, 10000], mwg: [10000, 40000], payload: [8000, 38000] };
  const naFaixa = (v, k) => v != null && v >= FAIXA[k][0] && v <= FAIXA[k][1];
  function pesoApos(text, labels, faixa) {
    const t = String(text || '').toUpperCase().replace(/\r/g, '');
    for (const lab of labels) {
      const re = new RegExp(lab, 'g'); let m;
      while ((m = re.exec(t))) {
        const resto = t.slice(m.index + m[0].length).split('\n');
        let linha = resto[0];
        // rótulo sozinho na linha e o número sozinho na linha de baixo (comum no RIC): aceita só nesse formato
        if (!/\d/.test(linha) && /^\s*[:.]?\s*\d{1,3}(?:[.,]\d{3})+\s*(KGS?\.?)?\s*$|^\s*[:.]?\s*\d{4,6}\s*(KGS?\.?)?\s*$/.test(resto[1] || '')) linha = resto[1];
        const nums = linha.matchAll(/(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*(K[G6C]S?|KG\.|LBS?\.?|CU)?/g);
        for (const n of nums) {
          if (n[2] && !/^K[G6C]/.test(n[2])) continue; // LBS / CU.M: não é o peso em kg
          const v = kgNum(n[1]);
          return naFaixa(v, faixa) ? v : null;
        }
      }
    }
    return null;
  }
  const lerTara = text => pesoApos(text, ['\\bT[AE]R[EA]\\b'], 'tara'); // TARE / TARA / TERE…
  // rótulo do max gross lido com erros comuns: "Mox Grass Weight", "MAX GR@SS", "MAK.GROSS"…
  const lerMwg = text => pesoApos(text, ['\\bM[AO0][XKH]\\.?\\s*G[RP][AO0@Q][S5$]{1,2}\\b', 'MAX\\.?\\s*GROSS', 'MAX\\.?\\s*G\\.?\\s*W', '\\bM\\.?\\s*G\\.?\\s*W\\b', 'MAX\\.?\\s*WT', 'MAXIMUM\\s*GROSS', 'PESO\\s*BRUTO\\s*M[AÁ]X'], 'mwg');
  const lerPayload = text => pesoApos(text, ['M[AO0][XK]\\.?\\s*CARGO', 'PAYLOAD', 'PAY\\s*LOAD', '\\bNET\\b', 'CARGA\\s*[UÚ]TIL'], 'payload');
  // placa da porta: MAX GROSS = TARE + PAYLOAD. Três valores em KG que fecham a soma identificam tara e max gross
  // mesmo se os rótulos saírem separados dos números; leitura que não fecha a soma => ILEGÍVEL.
  function pesosPorta(text) {
    const t = String(text || '').toUpperCase();
    let tara = lerTara(t), mwg = lerMwg(t); const pay = lerPayload(t);
    const kgs = Array.from(new Set(Array.from(t.matchAll(/(\d{1,3}(?:[.,]\d{3})+|\d{4,6})\s*K[G6C]/g)).map(n => kgNum(n[1])).filter(Boolean)));
    const triplas = [];
    kgs.forEach(a => kgs.forEach(c => { if (naFaixa(a, 'mwg') && naFaixa(c, 'tara') && kgs.includes(a - c) && naFaixa(a - c, 'payload')) triplas.push({ mwg: a, tara: c }); }));
    const tri = triplas.length === 1 ? triplas[0] : null;
    if (tri) {
      tara = tara == null ? tri.tara : (tara === tri.tara ? tara : ILEGIVEL);
      mwg = mwg == null ? tri.mwg : (mwg === tri.mwg ? mwg : ILEGIVEL);
    }
    if (typeof tara === 'number' && typeof mwg === 'number' && pay != null && mwg !== tara + pay) { tara = ILEGIVEL; mwg = ILEGIVEL; }
    // padrão da operação: "32.500 KG" escrito na porta é o max gross (o payload é sempre menor que o max gross)
    if (mwg == null && kgs.includes(PADRAO_MWG)) mwg = PADRAO_MWG;
    return { tara: tara || ILEGIVEL, mwg: mwg || ILEGIVEL };
  }

  // ---------- lacre ----------
  const normLacre = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // lacre: o esperado só conta se aparecer escrito igual; senão, o código logo depois de "LACRE"/"SEAL NO"
  // (prefixo de letras + dígitos, sem trocar letras por números)
  function lerLacre(text, esperado) {
    const t = String(text || '').toUpperCase();
    const e = normLacre(esperado);
    if (e && e.length >= 4 && normLacre(t).includes(e)) return e;
    const m = t.match(/(?:LACRE|S[EC][AE][L1I]|SELO)\s*(?:N[ºO°]?\.?)?\s*[:.\-]?\s*([A-Z]{0,4}[\s\-]?\d{5,14})\b/);
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
  const RE_CONT_RIC = /C[O0]NT[A4][I1L]NER\s*(N[O0º°]\b\.?|NUMBER|#)|CNTR\s*N|EQUIPMENT\s*N/;
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
      Object.assign(r, pesosPorta(text));
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
  // Duas fontes (se a rede bloquear uma, tenta a outra). Um único "motor" de leitura é criado e reaproveitado
  // para todas as fotos (antes era baixado de novo a cada foto).
  const FONTES = [
    { nome: 'jsDelivr', lib: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js', corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
      langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int' },
    { nome: 'unpkg', lib: 'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js',
      workerPath: 'https://unpkg.com/tesseract.js@5.1.1/dist/worker.min.js', corePath: 'https://unpkg.com/tesseract.js-core@5.1.1',
      langPath: 'https://unpkg.com/@tesseract.js-data/eng@1.0.0/4.0.0_best_int' },
  ];
  const estado = { st: 'nao', msg: 'Leitura automática ainda não usada.' }; // nao | carregando | ok | erro
  const prazo = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
  function script(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = () => res(); s.onerror = () => { s.remove(); rej(new Error('bloqueado')); };
      document.head.appendChild(s);
    });
  }
  let motorP = null;
  function carregarOCR() {
    if (motorP) return motorP;
    estado.st = 'carregando'; estado.msg = 'Carregando a leitura automática…';
    motorP = (async () => {
      const erros = [];
      for (const f of FONTES) {
        try {
          if (!global.Tesseract) await prazo(script(f.lib), 20000, 'tempo esgotado');
          const w = await prazo(global.Tesseract.createWorker('eng', 1, { workerPath: f.workerPath, corePath: f.corePath, langPath: f.langPath }), 90000, 'tempo esgotado');
          estado.st = 'ok'; estado.msg = `Leitura automática disponível (${f.nome}).`;
          return w;
        } catch (e) { erros.push(`${f.nome}: ${e.message || e}`); }
      }
      throw new Error('a rede não deixou baixar a leitura automática (' + erros.join('; ') + ')');
    })().catch(e => { motorP = null; estado.st = 'erro'; estado.msg = 'Leitura automática indisponível: ' + e.message + '. Digite os dados nos campos de cada foto.'; throw e; });
    return motorP;
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
  // recorte de uma área da foto (frações 0–1), ampliado para a leitura: texto pequeno passa a ser legível
  async function recortar(blob, r) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const sx = r.x * img.naturalWidth, sy = r.y * img.naturalHeight, sw = r.w * img.naturalWidth, sh = r.h * img.naturalHeight;
      const k = Math.min(4, 2400 / Math.max(sw, sh));
      const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      return await new Promise(res => c.toBlob(res, 'image/png'));
    } finally { URL.revokeObjectURL(url); }
  }
  async function ocr(blob, modo) {
    const w = await carregarOCR();
    const inv = modo === 'invertido';
    const img = inv ? await prepararInvertido(blob) : await prepararOCR(blob);
    await w.setParameters({ tessedit_pageseg_mode: inv ? '11' : '3' }); // 11 = texto espalhado (placas pintadas)
    const r = await w.recognize(img);
    return (r && r.data && r.data.text) || '';
  }
  // pintura clara sobre porta escura: canal azul invertido + contraste esticado
  async function prepararInvertido(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const s = Math.min(3, 3200 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height); const px = d.data; const hist = new Uint32Array(256);
      for (let i = 0; i < px.length; i += 4) hist[255 - px[i + 2]]++;
      const n = px.length / 4; let lo = 0, hi = 255, acc = 0;
      for (; lo < 255 && (acc += hist[lo]) < n * 0.02; lo++); acc = 0;
      for (; hi > 0 && (acc += hist[hi]) < n * 0.02; hi--);
      const k = 255 / Math.max(1, hi - lo);
      for (let i = 0; i < px.length; i += 4) { const v = Math.max(0, Math.min(255, (255 - px[i + 2] - lo) * k)); px[i] = px[i + 1] = px[i + 2] = v; }
      g.putImageData(d, 0, 0);
      return await new Promise(res => c.toBlob(res, 'image/png'));
    } finally { URL.revokeObjectURL(url); }
  }
  // dados de várias leituras da mesma foto: vale o valor lido; se duas leituras discordam, ILEGÍVEL
  function dadosJuntos(slot, textos, esperado) {
    const rs = textos.map(t => dadosDoTexto(slot, t, esperado)); const out = {};
    new Set([].concat(...rs.map(Object.keys))).forEach(k => {
      const vals = Array.from(new Set(rs.map(r => r[k]).filter(v => v != null && v !== '' && !ehIlegivel(v)).map(String)));
      out[k] = vals.length === 1 ? (typeof rs.find(r => String(r[k]) === vals[0])[k] === 'number' ? +vals[0] : vals[0]) : ILEGIVEL;
    });
    return out;
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
    SLOTS, CAMPO_NOME, put, get, del, delLocal, setRemoto, enviarPendentes, comprimir, reduzir, blobToDataURL, distribuir, imagens, assinatura, papelBranco, classificar,
    ILEGIVEL, ehIlegivel, PADRAO_MWG, digitoVerificador, contValido, normCont, fmtCont, containersNoTexto, lerTara, lerMwg, lerLacre, normLacre, lacreIgual, dadosDoTexto,
    carregarOCR, ocr, recortar, dadosJuntos, montarEML, estadoOCR: () => estado,
  };
})(window);
