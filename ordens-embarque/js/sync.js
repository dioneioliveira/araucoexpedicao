/* Dados compartilhados entre usuários: um arquivo .json numa pasta de rede
   (ou pasta sincronizada do OneDrive/SharePoint), lido e gravado pelo próprio
   navegador (File System Access API — Chrome/Edge). Sem servidor.

   O estado é "achatado" em registros (um por transporte, OT, agendamento…),
   cada um com o horário da última alteração. Ao gravar, o arquivo é relido e
   os registros são juntados (vale o mais recente; exclusões ficam marcadas),
   para que dois usuários trabalhando ao mesmo tempo não apaguem o trabalho um
   do outro. */
(function (global) {
  'use strict';

  const DB = 'arauco-ordens-embarque', STORE = 'kv', HANDLE_KEY = 'sharedFile', DIR_KEY = 'sharedDir';
  // perfis fixos (não se criam usuários): cada computador usa um deles; cada perfil tem um arquivo fixo na pasta oficial
  const PERFIS = ['Faturamento ADM', 'Faturamento EXP', 'Controladores', 'ADM'];
  const arqPerfil = p => p + '.json';
  const ARQ = 'ordens-embarque-dados.json', MARCA = 'ordens-embarque-pasta.json', META_IDB = 'syncMeta';
  const nomeArq = s => String(s || '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120); // nome válido no Windows
  const TOMB_DAYS = 45;

  // ---------- IndexedDB (o "atalho" para o arquivo fica salvo no navegador) ----------
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function idbGet(k) { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  async function idbSet(k, v) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
  async function idbDel(k) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }

  // ---------- estado <-> registros ----------
  // cfg.sewKey(e): identidade de um agendamento
  function flatten(state, cfg) {
    const out = {};
    const put = (k, v) => { if (v !== undefined && v !== null) out[k] = JSON.stringify(v); };
    Object.entries(state.items || {}).forEach(([k, v]) => put('item:' + k, v));
    // campos digitados: um registro por campo, para duas pessoas poderem editar o mesmo transporte
    Object.entries(state.manual || {}).forEach(([k, v]) => Object.entries(v || {}).forEach(([f, x]) => { if (x !== '' && x != null) put('man:' + k + '|' + f, x); }));
    Object.entries(state.printed || {}).forEach(([k, v]) => put('printed:' + k, v));
    Object.entries(state.snap || {}).forEach(([k, v]) => put('snap:' + k, v));
    Object.entries(state.faturado || {}).forEach(([k, v]) => put('fat:' + k, v));
    Object.entries(state.fatNf || {}).forEach(([k, v]) => put('fatnf:' + k, v));
    Object.entries(state.ots || {}).forEach(([k, v]) => put('ot:' + k, v));
    (state.sew || []).forEach(e => put('sew:' + cfg.sewKey(e), e));
    Object.entries(state.pesos || {}).forEach(([k, v]) => put('peso:' + k, v));
    Object.entries(state.tickets || {}).forEach(([k, v]) => put('tk:' + k, v));
    Object.entries(state.fotos || {}).forEach(([k, v]) => put('foto:' + k, v));
    Object.entries(state.histBalanca || {}).forEach(([k, v]) => put('hb:' + k, v));
    Object.entries(state.ocorr || {}).forEach(([k, v]) => put('oc:' + k, v));
    if (state.fechamentos) put('fech', state.fechamentos); // só nomes e dados lidos; as imagens ficam no computador
    if (state.fsc && Object.keys(state.fsc).length) put('fsc', state.fsc);
    if (state.fscInfo) put('fscinfo', state.fscInfo);
    return out;
  }
  function unflatten(flat, empty) {
    const s = empty();
    s.fatNf = {};
    Object.entries(flat).forEach(([k, json]) => {
      const i = k.indexOf(':'); const kind = i < 0 ? k : k.slice(0, i); const id = i < 0 ? '' : k.slice(i + 1);
      const v = JSON.parse(json);
      switch (kind) {
        case 'item': s.items[id] = v; break;
        case 'man': { const j = id.lastIndexOf('|'); const t = id.slice(0, j), f = id.slice(j + 1); (s.manual[t] = s.manual[t] || {})[f] = v; break; }
        case 'printed': s.printed[id] = v; break;
        case 'snap': s.snap[id] = v; break;
        case 'fat': s.faturado[id] = v; break;
        case 'fatnf': s.fatNf[id] = v; break;
        case 'ot': s.ots[id] = v; break;
        case 'sew': s.sew.push(v); break;
        case 'peso': (s.pesos = s.pesos || {})[id] = v; break;
        case 'tk': (s.tickets = s.tickets || {})[id] = v; break;
        case 'foto': (s.fotos = s.fotos || {})[id] = v; break;
        case 'hb': (s.histBalanca = s.histBalanca || {})[id] = v; break;
        case 'oc': (s.ocorr = s.ocorr || {})[id] = v; break;
        case 'fech': s.fechamentos = v; break;
        case 'fsc': s.fsc = v; break;
        case 'fscinfo': s.fscInfo = v; break;
        default: break;
      }
    });
    return s;
  }

  // ---------- junção de dois conjuntos de registros ----------
  // doc = { entities: {key: {v: json, ts}}, tomb: {key: ts} }
  function mergeDocs(a, b) {
    const ent = {}, tomb = {};
    const keys = new Set([...Object.keys(a.entities), ...Object.keys(b.entities), ...Object.keys(a.tomb), ...Object.keys(b.tomb)]);
    keys.forEach(k => {
      const ea = a.entities[k], eb = b.entities[k];
      const e = !ea ? eb : !eb ? ea : (eb.ts > ea.ts ? eb : ea);
      const t = Math.max(a.tomb[k] || 0, b.tomb[k] || 0);
      if (e && e.ts >= t) ent[k] = e; else if (t) tomb[k] = t;
    });
    const limite = Date.now() - TOMB_DAYS * 864e5;
    Object.keys(tomb).forEach(k => { if (tomb[k] < limite) delete tomb[k]; });
    return { entities: ent, tomb };
  }
  const flatOf = doc => Object.fromEntries(Object.entries(doc.entities).map(([k, e]) => [k, e.v]));
  const novaEpoca = () => new Date().toISOString() + '-' + Math.random().toString(36).slice(2, 7);
  const sameFlat = (x, y) => { const kx = Object.keys(x), ky = Object.keys(y); return kx.length === ky.length && kx.every(k => x[k] === y[k]); };

  // ---------- sincronizador ----------
  function create(cfg) {
    // cfg: { getState, setState(state), empty(), sewKey, onStatus(info), onRemoteChange(), metaKey }
    const META_KEY = cfg.metaKey || 'arauco.ordensEmbarque.syncMeta';
    let doc = null, metaPronta = false; // registros com horário (cópia local, no IndexedDB)
    let marca = null, adotar = false;   // pasta oficial (arquivo de identificação) / próxima leitura: vale a pasta
    let handle = null, dir = null, needsPermission = false, lastModified = 0, timer = null, poll = null, busy = false, pending = false;
    const me = () => (cfg.user && cfg.user()) || '';
    const logado = () => PERFIS.includes(me());
    // presença: cada usuário grava presenca/<nome>.json com a ordem aberta; os outros leem a cada verificação
    let aberto = null, presencaEm = 0, presencaTxt = '';
    let status = { mode: 'local', name: '', at: null, error: '' };

    // a cópia de controle do sync ficava no localStorage (dobrava o uso dos ~5 MB): agora fica no IndexedDB
    async function loadMeta() {
      let m = null;
      try { m = await idbGet(META_IDB); } catch (e) { m = null; }
      if (!m) { try { const j = JSON.parse(localStorage.getItem(META_KEY)); if (j && j.entities) { m = j; await idbSet(META_IDB, m); } } catch (e) { /* vazio */ } }
      try { localStorage.removeItem(META_KEY); } catch (e) { /* sem storage */ }
      doc = m && m.entities ? m : null; metaPronta = true;
    }
    let metaT = null;
    function saveMeta() { clearTimeout(metaT); const d = doc; metaT = setTimeout(() => idbSet(META_IDB, d).catch(() => {}), 200); }
    const setStatus = patch => { Object.assign(status, patch); cfg.onStatus(Object.assign({}, status)); };

    // registra no doc local o que mudou no estado desde a última vez
    function stamp() {
      if (!metaPronta) return false;
      const now = Date.now();
      const flat = flatten(cfg.getState(), cfg);
      // primeira vez neste computador: o que já existia aqui entra como "antigo" (ts=1),
      // para não sobrescrever o que outros usuários já gravaram no arquivo compartilhado
      if (!doc) { doc = { entities: {}, tomb: {}, epoca: '' }; Object.entries(flat).forEach(([k, v]) => { doc.entities[k] = { v, ts: 1 }; }); saveMeta(); return; }
      let changed = false;
      Object.entries(flat).forEach(([k, v]) => { const e = doc.entities[k]; if (!e || e.v !== v) { doc.entities[k] = { v, ts: now, by: me() }; delete doc.tomb[k]; changed = true; } });
      Object.keys(doc.entities).forEach(k => { if (!(k in flat)) { delete doc.entities[k]; doc.tomb[k] = now; changed = true; } });
      if (changed) saveMeta();
      return changed;
    }

    async function readRemote() {
      const f = await handle.getFile();
      const txt = await f.text();
      let remote = { entities: {}, tomb: {}, epoca: '', vazio: !txt.trim() };
      if (txt.trim()) {
        const j = JSON.parse(txt);
        if (j && j.entities) remote = { entities: j.entities, tomb: j.tomb || {}, epoca: j.epoca || '' };
        else if (j && j.v === 1 && j.items) { // backup antigo (estado inteiro): vira registros
          const now = Date.now(); Object.entries(flatten(Object.assign(cfg.empty(), j), cfg)).forEach(([k, v]) => { remote.entities[k] = { v, ts: now - 1 }; });
        }
      }
      return { remote, mtime: f.lastModified };
    }
    async function writeRemote(d) {
      const w = await handle.createWritable();
      await w.write(JSON.stringify({ app: 'arauco-ordens-embarque', formato: 1, gravadoEm: new Date().toISOString(), epoca: d.epoca || '', entities: d.entities, tomb: d.tomb }));
      await w.close();
      try { lastModified = (await handle.getFile()).lastModified; } catch (e) { /* ok */ }
    }

    // lê o arquivo, junta com o local, aplica no app e grava de volta se o local tinha novidades
    async function syncNow(forceWrite) {
      if (!handle || needsPermission) return;
      if (busy) { pending = true; return; }
      busy = true;
      try {
        stamp();
        const { remote, mtime } = await readRemote();
        // a pasta é a fonte dos dados: ao conectar este computador, ou depois do fechamento semanal (época nova),
        // o que vale é o arquivo da pasta, não o que estava guardado neste navegador
        if (!remote.vazio && ((adotar) || (remote.epoca && doc.epoca !== remote.epoca))) {
          adotar = false;
          doc = { entities: remote.entities, tomb: remote.tomb, epoca: remote.epoca || novaEpoca() }; saveMeta();
          cfg.setState(unflatten(flatOf(doc), cfg.empty)); cfg.onRemoteChange({ deOutros: [], adotado: true });
          if (!remote.epoca && logado()) await writeRemote(doc); else lastModified = mtime;
          setStatus({ mode: 'shared', at: new Date(), error: '' });
          return;
        }
        adotar = false;
        if (!doc.epoca) doc.epoca = remote.epoca || novaEpoca();
        // o que outro usuário alterou desde a última vez (para avisar quem está usando)
        const deOutros = [];
        Object.entries(remote.entities).forEach(([k, re]) => { const le = doc.entities[k]; if ((!le || re.ts > le.ts) && re.by && re.by !== me()) deOutros.push({ k, by: re.by, v: re.v }); });
        const merged = mergeDocs(doc, remote); merged.epoca = doc.epoca;
        const mergedFlat = flatOf(merged);
        const localFlat = flatten(cfg.getState(), cfg);
        doc = merged; saveMeta();
        if (!sameFlat(mergedFlat, localFlat)) { cfg.setState(unflatten(mergedFlat, cfg.empty)); cfg.onRemoteChange({ deOutros }); }
        if (!logado()) { lastModified = mtime; setStatus({ mode: 'shared', at: new Date(), error: '' }); return; } // sem perfil: só lê
        if (forceWrite || !sameFlat(mergedFlat, flatOf(remote)) || Object.keys(merged.tomb).length !== Object.keys(remote.tomb).length) {
          // alguém gravou entre a leitura e agora? junta de novo antes de gravar (não apaga a gravação do colega)
          const agora = (await handle.getFile()).lastModified;
          if (agora !== mtime) { const { remote: r2 } = await readRemote(); const ep = doc.epoca; doc = mergeDocs(doc, r2); doc.epoca = ep; saveMeta(); const f2 = flatOf(doc); if (!sameFlat(f2, flatten(cfg.getState(), cfg))) { cfg.setState(unflatten(f2, cfg.empty)); cfg.onRemoteChange({ deOutros: [] }); } }
          await writeRemote(doc);
        }
        else lastModified = mtime;
        setStatus({ mode: 'shared', at: new Date(), error: '' });
      } catch (e) {
        setStatus({ error: e && e.name === 'NotAllowedError' ? 'sem permissão' : (e.message || String(e)) });
        if (e && e.name === 'NotAllowedError') { needsPermission = true; setStatus({ mode: 'permission' }); }
      } finally {
        busy = false;
        if (pending) { pending = false; setTimeout(() => syncNow(), 50); }
      }
    }
    // verificação periódica: só sincroniza se o arquivo mudou
    async function check() {
      if (!handle || needsPermission || busy) return;
      try { const f = await handle.getFile(); if (f.lastModified !== lastModified) await syncNow(); } catch (e) { setStatus({ error: e.message || String(e) }); }
      if (dir) presenca().catch(() => {});
    }
    // presença e último acesso ficam no arquivo fixo do perfil (Faturamento ADM.json…): só atualiza o que já existe
    async function presenca() {
      const meu = JSON.stringify({ perfil: me(), nome: me(), aberto, em: Date.now() });
      if (me() && PERFIS.includes(me()) && (meu.replace(/"em":\d+/, '') !== presencaTxt || Date.now() - presencaEm > 10000)) {
        try {
          const w = await (await dir.getFileHandle(arqPerfil(me()))).createWritable(); await w.write(meu); await w.close();
          presencaTxt = meu.replace(/"em":\d+/, ''); presencaEm = Date.now();
          if (status.erroPerfil) setStatus({ erroPerfil: '' });
        } catch (e) { if (e && e.name === 'NotFoundError') setStatus({ erroPerfil: `o arquivo "${arqPerfil(me())}" não existe na pasta oficial` }); }
      }
      const outros = [];
      for (const p of PERFIS) {
        if (p === me()) continue;
        try { const j = JSON.parse(await (await (await dir.getFileHandle(arqPerfil(p))).getFile()).text()); if (j && j.em && Date.now() - j.em < 30000) outros.push({ nome: p, aberto: j.aberto, em: j.em }); } catch (e) { /* perfil sem arquivo ou ainda sem uso */ }
      }
      if (cfg.onPresence) cfg.onPresence(outros);
    }
    // arquivos fixos: criados uma única vez, na configuração da pasta oficial (ou numa pasta oficial antiga sem eles)
    async function garantirPerfis(d) {
      for (const p of PERFIS) {
        try { await d.getFileHandle(arqPerfil(p)); } catch (e) {
          const w = await (await d.getFileHandle(arqPerfil(p), { create: true })).createWritable(); await w.write(JSON.stringify({ perfil: p, nome: p, aberto: null, em: 0 })); await w.close();
        }
      }
    }
    let visBind = false;
    function startPolling() {
      clearInterval(poll); poll = setInterval(check, dir ? 4000 : 15000);
      if (!visBind) { visBind = true; document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); }); }
    }
    // fotos na pasta compartilhada (fotos/<id>.jpg): todos veem as mesmas fotos
    const fotos = {
      async put(id, blob) { if (!dir || needsPermission || !logado()) return false; const fd = await dir.getDirectoryHandle('fotos', { create: true }); const w = await (await fd.getFileHandle(nomeArq(id) + '.jpg', { create: true })).createWritable(); await w.write(blob); await w.close(); return true; },
      async get(id) { if (!dir || needsPermission) return null; try { const fd = await dir.getDirectoryHandle('fotos'); return await (await fd.getFileHandle(nomeArq(id) + '.jpg')).getFile(); } catch (e) { return null; } },
      async del(id) { if (!dir || needsPermission) return; try { const fd = await dir.getDirectoryHandle('fotos'); await fd.removeEntry(nomeArq(id) + '.jpg'); } catch (e) { /* já não existe */ } },
    };
    async function lerMarca(d) { try { return JSON.parse(await (await (await d.getFileHandle(MARCA)).getFile()).text()); } catch (e) { return null; } }
    async function temDados(d) { try { await d.getFileHandle(ARQ); return true; } catch (e) { return false; } }
    async function gravarMarca(d, m) { const w = await (await d.getFileHandle(MARCA, { create: true })).createWritable(); await w.write(JSON.stringify(m, null, 1)); await w.close(); return m; }
    async function attachDir(d, opt) {
      if (!(await temDados(d)) && !(await lerMarca(d)) && !(opt && opt.nova)) { const e = new Error('esta pasta não é a pasta oficial da expedição'); e.code = 'PASTA_NAO_OFICIAL'; throw e; }
      marca = await lerMarca(d);
      if (!marca) marca = await gravarMarca(d, { app: 'arauco-ordens-embarque', id: novaEpoca(), criadaEm: new Date().toISOString(), criadaPor: me(), caminho: (opt && opt.caminho) || '' }); // pasta antiga (já tinha dados) ganha a identificação
      adotar = !(opt && opt.nova); // computador conectando: vale o que está na pasta
      await garantirPerfis(d);
      dir = d; handle = await d.getFileHandle(ARQ, { create: true }); needsPermission = false;
      try { await idbSet(DIR_KEY, d); await idbDel(HANDLE_KEY); } catch (e) { /* reconectar manualmente na próxima vez */ }
      setStatus({ mode: 'shared', name: d.name, pasta: true, marca, error: '' });
      const vazio = !(await (await handle.getFile()).text()).trim();
      await syncNow(vazio);
      startPolling(); presenca().catch(() => {});
    }

    async function attach(h, isNew) {
      handle = h; dir = null; needsPermission = false;
      try { await idbSet(HANDLE_KEY, h); } catch (e) { /* atalho não salvo: reconectar manualmente na próxima vez */ }
      setStatus({ mode: 'shared', name: h.name, error: '' });
      await syncNow(!!isNew);
      startPolling();
    }

    return {
      supported: () => typeof global.showOpenFilePicker === 'function' && typeof global.indexedDB !== 'undefined',
      status: () => Object.assign({}, status),
      // chamado pelo app a cada gravação local
      changed() {
        stamp();
        if (!handle || needsPermission) return;
        clearTimeout(timer); timer = setTimeout(() => syncNow(), 700);
      },
      async init() {
        await loadMeta();
        stamp();
        if (!this.supported()) { setStatus({ mode: 'unsupported' }); return; }
        let d = null; try { d = await idbGet(DIR_KEY); } catch (e) { d = null; }
        if (d) {
          dir = d; setStatus({ name: d.name, pasta: true });
          if ((await d.queryPermission({ mode: 'readwrite' })) === 'granted') { marca = await lerMarca(d); setStatus({ marca }); handle = await d.getFileHandle(ARQ, { create: true }); await syncNow(); startPolling(); presenca().catch(() => {}); }
          else { needsPermission = true; setStatus({ mode: 'permission' }); }
          return;
        }
        let h = null; try { h = await idbGet(HANDLE_KEY); } catch (e) { h = null; }
        if (!h) { setStatus({ mode: 'local' }); return; }
        handle = h; setStatus({ name: h.name });
        const p = await h.queryPermission({ mode: 'readwrite' });
        if (p === 'granted') { await syncNow(); startPolling(); }
        else { needsPermission = true; setStatus({ mode: 'permission' }); }
      },
      // precisam de clique do usuário (o navegador exige)
      async reconnect() {
        if (dir) {
          if ((await dir.requestPermission({ mode: 'readwrite' })) !== 'granted') return false;
          needsPermission = false; marca = await lerMarca(dir); setStatus({ marca }); handle = await dir.getFileHandle(ARQ, { create: true }); await syncNow(); startPolling(); presenca().catch(() => {}); return true;
        }
        if (!handle) return false;
        const p = await handle.requestPermission({ mode: 'readwrite' });
        if (p !== 'granted') return false;
        needsPermission = false; await syncNow(); startPolling(); return true;
      },
      // pasta compartilhada no servidor: dados + fotos + quem está usando
      // 1) escolher a pasta e ver se é a oficial; 2) conectar (o app decide o que perguntar entre os dois passos)
      async escolherPasta() { const d = await global.showDirectoryPicker({ id: 'oe-pasta', mode: 'readwrite' }); return { dir: d, marca: await lerMarca(d), temDados: await temDados(d) }; },
      conectarPasta: (d, opt) => attachDir(d, opt),
      async openFolder() { const d = await global.showDirectoryPicker({ id: 'oe-pasta', mode: 'readwrite' }); await attachDir(d); },
      marca: () => marca,
      logado: () => logado(),
      // fechamento semanal: o estado atual (já zerado) vira a nova época; quem estiver conectado passa a usar este arquivo
      async resetar() {
        const now = Date.now(); const flat = flatten(cfg.getState(), cfg);
        doc = { entities: Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, { v, ts: now, by: me() }])), tomb: {}, epoca: novaEpoca() }; saveMeta();
        if (handle && !needsPermission && logado()) { await writeRemote(doc); setStatus({ at: new Date() }); return true; }
        return false;
      },
      pasta: () => !!dir && !needsPermission,
      setAberto(t) { if (aberto === (t || null)) return; aberto = t || null; if (dir && !needsPermission) presenca().catch(() => {}); },
      fotos,
      // grava um arquivo qualquer na pasta compartilhada (ex.: arquivo/ordens-embarque-2026-10.xlsx)
      async salvarArquivo(sub, nome, blob) {
        if (!dir || needsPermission || !logado()) return false;
        let d = dir; for (const p of sub) d = await d.getDirectoryHandle(p, { create: true });
        const w = await (await d.getFileHandle(nomeArq(nome), { create: true })).createWritable(); await w.write(blob); await w.close(); return true;
      },
      async createFile() {
        const h = await global.showSaveFilePicker({ suggestedName: 'ordens-embarque-dados.json', types: [{ description: 'Dados das ordens de embarque', accept: { 'application/json': ['.json'] } }] });
        await attach(h, true);
      },
      async openFile() {
        const [h] = await global.showOpenFilePicker({ types: [{ description: 'Dados das ordens de embarque', accept: { 'application/json': ['.json'] } }] });
        await attach(h, false);
      },
      async disconnect() { clearInterval(poll); handle = null; dir = null; needsPermission = false; await idbDel(HANDLE_KEY); await idbDel(DIR_KEY); setStatus({ mode: 'local', name: '', pasta: false }); },
      syncNow: () => syncNow(),
      // para testes
      _attachForTest: (h) => attach(h, false),
      _attachDirForTest: (d, opt) => attachDir(d, opt),
    };
  }

  global.OESync = { create, flatten, unflatten, mergeDocs, PERFIS };
})(window);
