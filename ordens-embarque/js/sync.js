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

  const DB = 'arauco-ordens-embarque', STORE = 'kv', HANDLE_KEY = 'sharedFile';
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
  const sameFlat = (x, y) => { const kx = Object.keys(x), ky = Object.keys(y); return kx.length === ky.length && kx.every(k => x[k] === y[k]); };

  // ---------- sincronizador ----------
  function create(cfg) {
    // cfg: { getState, setState(state), empty(), sewKey, onStatus(info), onRemoteChange(), metaKey }
    const META_KEY = cfg.metaKey || 'arauco.ordensEmbarque.syncMeta';
    let doc = loadMeta();           // registros com horário (cópia local)
    let handle = null, needsPermission = false, lastModified = 0, timer = null, poll = null, busy = false, pending = false;
    let status = { mode: 'local', name: '', at: null, error: '' };

    function loadMeta() {
      try { const m = JSON.parse(localStorage.getItem(META_KEY)); if (m && m.entities) return m; } catch (e) { /* vazio */ }
      return null;
    }
    function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(doc)); } catch (e) { /* cheio */ } }
    const setStatus = patch => { Object.assign(status, patch); cfg.onStatus(Object.assign({}, status)); };

    // registra no doc local o que mudou no estado desde a última vez
    function stamp() {
      const now = Date.now();
      const flat = flatten(cfg.getState(), cfg);
      // primeira vez neste computador: o que já existia aqui entra como "antigo" (ts=1),
      // para não sobrescrever o que outros usuários já gravaram no arquivo compartilhado
      if (!doc) { doc = { entities: {}, tomb: {} }; Object.entries(flat).forEach(([k, v]) => { doc.entities[k] = { v, ts: 1 }; }); saveMeta(); return; }
      let changed = false;
      Object.entries(flat).forEach(([k, v]) => { const e = doc.entities[k]; if (!e || e.v !== v) { doc.entities[k] = { v, ts: now }; delete doc.tomb[k]; changed = true; } });
      Object.keys(doc.entities).forEach(k => { if (!(k in flat)) { delete doc.entities[k]; doc.tomb[k] = now; changed = true; } });
      if (changed) saveMeta();
      return changed;
    }

    async function readRemote() {
      const f = await handle.getFile();
      const txt = await f.text();
      let remote = { entities: {}, tomb: {} };
      if (txt.trim()) {
        const j = JSON.parse(txt);
        if (j && j.entities) remote = { entities: j.entities, tomb: j.tomb || {} };
        else if (j && j.v === 1 && j.items) { // backup antigo (estado inteiro): vira registros
          const now = Date.now(); Object.entries(flatten(Object.assign(cfg.empty(), j), cfg)).forEach(([k, v]) => { remote.entities[k] = { v, ts: now - 1 }; });
        }
      }
      return { remote, mtime: f.lastModified };
    }
    async function writeRemote(d) {
      const w = await handle.createWritable();
      await w.write(JSON.stringify({ app: 'arauco-ordens-embarque', formato: 1, gravadoEm: new Date().toISOString(), entities: d.entities, tomb: d.tomb }));
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
        const merged = mergeDocs(doc, remote);
        const mergedFlat = flatOf(merged);
        const localFlat = flatten(cfg.getState(), cfg);
        doc = merged; saveMeta();
        if (!sameFlat(mergedFlat, localFlat)) { cfg.setState(unflatten(mergedFlat, cfg.empty)); cfg.onRemoteChange(); }
        if (forceWrite || !sameFlat(mergedFlat, flatOf(remote)) || Object.keys(merged.tomb).length !== Object.keys(remote.tomb).length) await writeRemote(merged);
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
    }
    function startPolling() { clearInterval(poll); poll = setInterval(check, 15000); document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); }); }

    async function attach(h, isNew) {
      handle = h; needsPermission = false;
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
        stamp();
        if (!this.supported()) { setStatus({ mode: 'unsupported' }); return; }
        let h = null; try { h = await idbGet(HANDLE_KEY); } catch (e) { h = null; }
        if (!h) { setStatus({ mode: 'local' }); return; }
        handle = h; setStatus({ name: h.name });
        const p = await h.queryPermission({ mode: 'readwrite' });
        if (p === 'granted') { await syncNow(); startPolling(); }
        else { needsPermission = true; setStatus({ mode: 'permission' }); }
      },
      // precisam de clique do usuário (o navegador exige)
      async reconnect() {
        if (!handle) return false;
        const p = await handle.requestPermission({ mode: 'readwrite' });
        if (p !== 'granted') return false;
        needsPermission = false; await syncNow(); startPolling(); return true;
      },
      async createFile() {
        const h = await global.showSaveFilePicker({ suggestedName: 'ordens-embarque-dados.json', types: [{ description: 'Dados das ordens de embarque', accept: { 'application/json': ['.json'] } }] });
        await attach(h, true);
      },
      async openFile() {
        const [h] = await global.showOpenFilePicker({ types: [{ description: 'Dados das ordens de embarque', accept: { 'application/json': ['.json'] } }] });
        await attach(h, false);
      },
      async disconnect() { clearInterval(poll); handle = null; needsPermission = false; await idbDel(HANDLE_KEY); setStatus({ mode: 'local', name: '' }); },
      syncNow: () => syncNow(),
      // para testes
      _attachForTest: (h) => attach(h, false),
    };
  }

  global.OESync = { create, flatten, unflatten, mergeDocs };
})(window);
