/* ===== Aba "Montagem da empilhadeira" =====
   Peças voam da bandeja até a máquina (3D), com vista explodida, raio-X, rótulos numerados e modo "Projeto 2D"
   (desenho técnico ortogonal). Depende de THREE, F3D e TRUCKS. */
'use strict';
const ASM = (function(){
  const T = TRUCKS['2.5'];
  const $a = s => document.querySelector(s);
  const V3 = (a)=>new THREE.Vector3(a[0],a[1],a[2]);

  /* ---------- catálogo de peças (coordenadas Three: X frente · Y altura · Z direita) ---------- */
  const PARTS = [
   {id:'chassi',n:1,name:'Chassi',grp:'Estrutura',req:[],kg:650,anchor:[-0.7,0.42,0],ex:[0,-0.10,0],
    func:'Estrutura de aço que sustenta tudo: motor, cabine, contrapeso e mastro. É a “espinha dorsal” da empilhadeira.',
    where:'Na base da máquina, entre os eixos dianteiro e traseiro.',
    nr:'Nunca fure, solde ou modifique o chassi sem projeto do fabricante: isso altera a resistência e a estabilidade.'},
   {id:'eixoF',n:2,name:'Eixo e rodas dianteiros (tração)',grp:'Estrutura',req:['chassi'],kg:420,anchor:[0,0.34,0.5],ex:[0.65,-0.05,0],
    func:'Transmitem a força do motor ao piso e suportam a maior parte do peso, principalmente com carga. O eixo dianteiro é o pivô da “gangorra” do triângulo de estabilidade.',
    where:'Na frente, logo atrás do mastro.',
    nr:'Antes de iniciar o turno: pneus sem cortes, desgaste excessivo ou objetos presos, e porcas das rodas firmes.'},
   {id:'eixoR',n:3,name:'Eixo e rodas traseiros (direção)',grp:'Estrutura',req:['chassi'],kg:230,anchor:[-1.65,0.27,0.4],ex:[-0.65,-0.05,0],
    func:'Eixo oscilante que gira para esterçar. A empilhadeira vira com as rodas de trás, por isso a traseira “varre” a curva.',
    where:'Na traseira, sob o contrapeso.',
    nr:'Em curva, a traseira avança para fora: cuidado com pedestres e prateleiras. É também o terceiro ponto do triângulo de estabilidade.'},
   {id:'motor',n:4,name:'Motor e radiador',grp:'Motorização',req:['chassi'],kg:380,anchor:[-1.1,0.7,0],ex:[-0.30,0.95,0],
    func:'Fonte de potência: move a tração e a bomba hidráulica. Pode ser a combustão (GLP/diesel) ou elétrico, com bateria. O radiador resfria o motor.',
    where:'Sob o assento e o capô, na metade traseira da máquina.',
    nr:'Cheque óleo, água e vazamentos. Motor a combustão em local fechado exige ventilação (gases). Abasteça ou recarregue só em área própria, com o motor desligado.'},
   {id:'contrapeso',n:5,name:'Contrapeso',grp:'Carroceria',req:['chassi'],kg:1100,anchor:[-1.85,0.75,0],ex:[-1.15,0.10,0],
    func:'Massa de ferro fundido na traseira que equilibra a carga na frente. É por isso que o modelo se chama “contrabalançado”.',
    where:'Na traseira, atrás do motor.',
    nr:'Nunca retire nem acrescente peso: a capacidade da placa foi calculada com esse contrapeso exato. É a peça mais pesada da máquina.'},
   {id:'carenagem',n:6,name:'Carenagem (capô e para-lamas)',grp:'Carroceria',req:['motor','contrapeso'],kg:220,anchor:[-0.45,0.9,0],ex:[0.20,1.55,0],
    func:'Cobre o motor e as rodas, protege contra sujeira e dá acesso à manutenção. O para-lama evita que o pneu jogue detritos.',
    where:'Sobre o motor, da cabine ao nariz da máquina.',
    nr:'Capô bem travado e para-lamas sem trincas. Use o raio-X deste simulador para enxergar o que há por baixo.'},
   {id:'placa',n:7,name:'Placa de capacidade',grp:'Carroceria',req:['contrapeso'],kg:2,anchor:[-1.5,0.75,0.55],ex:[-1.30,0.75,0],
    func:'Informa a capacidade nominal, o centro de carga (500 mm) e as limitações por altura. É o “documento” da máquina.',
    where:'Nas laterais do contrapeso, à vista do operador.',
    nr:'A NR-11 exige indicar a carga máxima em local visível. Placa ilegível, trocada ou ausente: máquina fora de operação.'},
   {id:'painel',n:8,name:'Painel e alavancas hidráulicas',grp:'Cockpit',req:['carenagem'],kg:25,anchor:[-0.24,1.2,0],ex:[0.55,1.90,0],
    func:'Concentram os comandos do mastro: elevar e baixar, inclinar para frente e para trás, e acessórios. O visor mostra horímetro e alertas.',
    where:'À direita do operador, ao lado do volante.',
    nr:'Opere com movimentos suaves e só do posto de comando. Alavanca “dura” ou vazando óleo: pare e comunique a manutenção.'},
   {id:'volante',n:9,name:'Volante e coluna de direção',grp:'Cockpit',req:['painel'],kg:12,anchor:[-0.4,1.35,0],ex:[1.0,2.25,0],
    func:'Comanda o esterçamento das rodas traseiras. A coluna é inclinada para ficar ergonômica.',
    where:'Na frente do assento, sobre a coluna.',
    nr:'Teste a direção parado antes de sair: sem folga excessiva, sem ruídos e sem “puxar” para um lado.'},
   {id:'assento',n:10,name:'Assento e cinto de segurança',grp:'Cockpit',req:['carenagem'],kg:35,anchor:[-0.85,1.2,0],ex:[-0.65,2.00,0],
    func:'Posto do operador. O cinto mantém o operador dentro do protetor de cabeça se a máquina tombar.',
    where:'Sobre o capô, no centro da máquina.',
    nr:'Cinto sempre afivelado. Em tombamento, não salte: segure firme o volante, pés apoiados, e incline-se para o lado oposto à queda.'},
   {id:'protetor',n:11,name:'Protetor de cabeça',grp:'Segurança e sinalização',req:['carenagem'],kg:130,anchor:[-0.6,2.0,0],ex:[-0.30,2.95,0],
    func:'Estrutura que protege o operador contra queda de objetos vindos do alto.',
    where:'Sobre a cabine.',
    nr:'Jamais retirar, cortar ou alterar. Verifique trincas e soldas antes de operar.'},
   {id:'luzes',n:12,name:'Iluminação e sinalização',grp:'Segurança e sinalização',req:['protetor'],kg:8,anchor:[-0.66,2.15,0],ex:[-0.30,3.35,0],
    func:'Giroflex, faróis, lanternas, pisca e alarme de ré avisam pedestres e outros veículos da presença e da manobra.',
    where:'No teto da cabine, na frente e na traseira.',
    nr:'A NR-11 exige sinal sonoro (buzina). Teste luzes e alarme todos os dias; sinalização queimada impede a operação.'},
   {id:'mastro',n:13,name:'Mastro (3 estágios)',grp:'Sistema de elevação',req:['eixoF'],kg:340,anchor:[0.15,1.2,0],ex:[1.6,0.25,0],
    func:'Estrutura telescópica que sobe e desce a carga. Os estágios deslizam uns dentro dos outros, guiados por roletes.',
    where:'Na frente da máquina, fixado ao eixo dianteiro.',
    nr:'Inspecione trilhos, roletes e folgas. Nunca trafegue com o mastro alto e nunca passe sob garfos elevados.'},
   {id:'cilindros',n:14,name:'Cilindros hidráulicos',grp:'Sistema de elevação',req:['mastro','chassi'],kg:90,anchor:[-0.05,0.85,0],ex:[1.25,-0.25,0],
    func:'O cilindro central empurra o mastro para cima. Os dois laterais inclinam o mastro para frente e para trás. Funcionam com óleo sob pressão.',
    where:'No centro do mastro (elevação) e entre o mastro e o chassi (inclinação).',
    nr:'Vazamento de óleo = pare e comunique. A inclinação para trás encosta a carga e melhora a estabilidade ao transportar.'},
   {id:'carro',n:15,name:'Carro porta-garfos e correntes',grp:'Sistema de elevação',req:['mastro'],kg:120,anchor:[0.35,0.45,0],ex:[2.2,0.35,0],
    func:'Peça que desliza no mastro e onde os garfos se encaixam. As correntes puxam o carro para cima e para baixo.',
    where:'Na face frontal do mastro.',
    nr:'Correntes: lubrificadas, sem folga excessiva e sem elos trincados. Corrente desigual desalinha a carga.'},
   {id:'garfos',n:16,name:'Garfos',grp:'Sistema de elevação',req:['carro'],kg:110,anchor:[0.9,0.1,0],ex:[2.9,0,0],
    func:'Apoiam a carga. Devem entrar sob pelo menos 3/4 (75%) do comprimento da carga, bem afastados e centralizados.',
    where:'Presos ao carro porta-garfos, apontando para frente.',
    nr:'Trincas, empenamento ou talão desgastado: retire de uso. Nunca levante pessoas nos garfos.'},
   {id:'espaldar',n:17,name:'Espaldar (encosto da carga)',grp:'Sistema de elevação',req:['carro'],kg:28,anchor:[0.38,0.7,0],ex:[2.55,0.9,0],
    func:'Grade que impede a carga de cair sobre o operador quando o mastro inclina ou a carga está elevada.',
    where:'Atrás da carga, sobre o carro porta-garfos.',
    nr:'Altura adequada à carga. Não remova nem improvise: ele protege o operador.'}
  ];
  const N = PARTS.length, byId = {}; PARTS.forEach(p=>byId[p.id]=p);
  const TOTAL_KG = PARTS.reduce((s,p)=>s+p.kg,0);

  /* ---------- estado ---------- */
  const S = {}; PARTS.forEach(p=>S[p.id]={st:'idle',t:0,dur:1.0,bounce:0,delay:0});
  const A = {sel:null,hover:null,e:0,xray:false,labels:true,camName:'iso',func:false,odo:0,lift:0.2,tt:0,bp:false,queue:[],qT:0,done:false,spin:false,ready:false};
  let stage=null, holders={}, ghosts={}, edgeSets={}, labelEls={}, fx=[], rayMeshes=[], lastAvailKey='', toastT=0, ray=null;
  const clock={now:0};

  const isOn = id => S[id].st==='on';
  const canMount = id => byId[id].req.every(isOn);
  const missing = id => byId[id].req.filter(r=>!isOn(r)).map(r=>byId[r].name);
  const count = ()=>PARTS.filter(p=>isOn(p.id)).length;
  const dependents = id => PARTS.filter(p=>p.req.includes(id) && (S[p.id].st==='on'||S[p.id].st==='fly'));

  /* ---------- materiais de ghost / blueprint ---------- */
  const ghostFill = new THREE.MeshBasicMaterial({color:0xB7D9D8,transparent:true,opacity:0.10,depthWrite:false});
  const lineLocked = new THREE.LineBasicMaterial({color:0x7fb7b5,transparent:true,opacity:0.45});
  const lineAvail = new THREE.LineBasicMaterial({color:0xB5B000,transparent:true,opacity:0.9});
  const bpFill = new THREE.MeshBasicMaterial({color:0xFFFFFF,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  const bpGlass = new THREE.MeshBasicMaterial({color:0xFFFFFF,transparent:true,opacity:0.0,depthWrite:false});
  const bpLine = new THREE.LineBasicMaterial({color:0x2d5f5e});
  const selLine = new THREE.LineBasicMaterial({color:0x8d8a00});

  /* ---------- geometria fundida (um único objeto por peça) ---------- */
  function mergedGeometry(model){
    const inv=new THREE.Matrix4().copy(model.matrixWorld).invert(); const arrs=[]; let n=0;
    model.traverse(o=>{ if(!o.isMesh||o.userData.bp) return; let g=o.geometry.clone(); g=g.index?g.toNonIndexed():g;
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld)); const pos=g.attributes.position.array; arrs.push(pos); n+=pos.length; g.dispose(); });
    const all=new Float32Array(n); let off=0; arrs.forEach(a=>{ all.set(a,off); off+=a.length; });
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(all,3)); geo.computeVertexNormals(); return geo;
  }

  /* ---------- toast ---------- */
  function toast(msg,warn){ const el=$a('#aToast'); el.textContent=msg; el.className='show'+(warn?' warn':''); clearTimeout(toastT); toastT=setTimeout(()=>el.className='',2600); }

  /* ---------- efeitos (faíscas) ---------- */
  let sparkTex=null;
  function sparkTexture(){ if(sparkTex) return sparkTex; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d');
    const g=x.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.25,'rgba(230,226,60,.95)'); g.addColorStop(1,'rgba(208,204,0,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); sparkTex=new THREE.CanvasTexture(c); return sparkTex; }
  function burst(p){
    const base=V3(p.anchor).add(V3(p.ex).multiplyScalar(A.e));
    for(let i=0;i<18;i++){
      const m=new THREE.SpriteMaterial({map:sparkTexture(),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,color:i%3?0xD0CC00:0x7fd6d2});
      const s=new THREE.Sprite(m); s.position.copy(base); const sc=0.10+Math.random()*0.10; s.scale.set(sc,sc,sc);
      const a=Math.random()*Math.PI*2, b=Math.random()*Math.PI-Math.PI/2, sp=0.9+Math.random()*1.4;
      fx.push({s,v:new THREE.Vector3(Math.cos(a)*Math.cos(b),Math.sin(b)*0.8+0.35,Math.sin(a)*Math.cos(b)).multiplyScalar(sp),life:0.7,max:0.7,grow:0}); stage.scene.add(s); }
    const rm=new THREE.SpriteMaterial({map:sparkTexture(),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,color:0xD0CC00});
    const r=new THREE.Sprite(rm); r.position.copy(base); r.scale.set(0.2,0.2,0.2); fx.push({s:r,v:new THREE.Vector3(),life:0.55,max:0.55,grow:3.2}); stage.scene.add(r);
  }
  function stepFx(dt){
    for(let i=fx.length-1;i>=0;i--){ const f=fx[i]; f.life-=dt; if(f.life<=0){ stage.scene.remove(f.s); f.s.material.dispose(); fx.splice(i,1); continue; }
      f.s.position.addScaledVector(f.v,dt); f.v.y-=2.2*dt; const k=f.life/f.max; f.s.material.opacity=k;
      if(f.grow){ const sc=0.2+(1-k)*f.grow; f.s.scale.set(sc,sc,sc);} }
  }

  /* ---------- montagem do palco 3D ---------- */
  function init(){
    if(stage) return;
    const cv=$a('#cv3d'); let ok=true;
    try{ stage=F3D.createStage(cv,{onClick:onClick3d,onHover:onHover3d,onInteract:()=>{A.spin=false;$a('#aSpin').classList.remove('on');}}); }catch(e){ ok=false; console.warn('WebGL indisponível',e); }
    if(!ok){ toast('Seu navegador não conseguiu iniciar o 3D (WebGL).',true); return; }
    stage.ctl.target.set(-0.25,0.95,0);
    const P=F3D.build(T);
    PARTS.forEach((p,i)=>{
      const model=P[p.id].model; const holder=new THREE.Group(); holder.name='h_'+p.id; const anchor=V3(p.anchor);
      holder.position.copy(anchor); model.position.copy(anchor).negate(); holder.add(model); stage.scene.add(holder); holders[p.id]=holder;
      model.traverse(o=>{ o.userData.pid=p.id; });
      // geometria fundida da peça: 1 malha + 1 linha de contorno (blueprint e fantasma)
      model.updateMatrixWorld(true); const mg=mergedGeometry(model);
      const bpe=new THREE.LineSegments(new THREE.EdgesGeometry(mg,28),bpLine); bpe.visible=false; bpe.userData.bp=true; model.add(bpe); edgeSets[p.id]=[bpe];
      model.traverse(o=>{ if(o.isMesh) o.userData.orig=o.material; });
      const gh=new THREE.Group(); gh.name='g_'+p.id;
      const gm=new THREE.Mesh(mg,ghostFill); gm.position.copy(anchor).negate(); gm.renderOrder=2; gm.userData.pid=p.id;
      const gl=new THREE.LineSegments(new THREE.EdgesGeometry(mg,28),lineLocked); gl.position.copy(anchor).negate(); gl.userData.pid=p.id;
      gh.add(gm); gh.add(gl); gh.userData.pid=p.id; gh.position.copy(anchor); stage.scene.add(gh); ghosts[p.id]={g:gh,lines:[gl]};
    });
    A.P=P;
    ray=new THREE.Raycaster();
    buildTray(); buildLabels(); renderThumbs(); applyXray(); refreshTray(); renderCard(null);
    stage.view('iso',true);
    A.ready=true;
  }

  /* ---------- bandeja ---------- */
  function buildTray(){
    const list=$a('#aList'); list.innerHTML=''; let grp='';
    PARTS.forEach(p=>{
      if(p.grp!==grp){ grp=p.grp; const h=document.createElement('div'); h.className='grp'; h.textContent=grp; list.appendChild(h); }
      const d=document.createElement('div'); d.className='part'; d.dataset.id=p.id;
      d.innerHTML=`<span class="no">${p.n}</span><img width="62" height="40" alt="" style="border-radius:6px;background:#F5F7F7;border:1px solid #ECEEEE;object-fit:contain"><div class="tx"><b>${p.name}</b><small></small></div>`;
      d.onclick=()=>pick(p.id); list.appendChild(d);
    });
  }
  function refreshTray(){
    const c=count(); $a('#aCount').textContent=`${c}/${N}`; $a('#aBar').style.width=(c/N*100)+'%';
    document.querySelectorAll('#aList .part').forEach(d=>{
      const id=d.dataset.id, s=S[id]; const on=s.st==='on', fly=s.st==='fly'||s.st==='leave', av=!on&&!fly&&canMount(id);
      d.className='part'+(on?' on':'')+(av?' avail':'')+((!on&&!fly&&!av)?' locked':'')+(A.sel===id?' sel':'');
      d.querySelector('small').textContent=on?'✓ montada':fly?'em movimento…':av?'clique para montar':'monte antes: '+missing(id).join(', ');
    });
    $a('#aFunc').disabled=!(isOn('eixoF')||isOn('mastro'));
    $a('#aFunc').classList.toggle('glow',count()===N&&!A.func);
    $a('#aFunc').textContent=A.func?'■ Parar teste':'⚙ Testar funções';
    updateAvailVisuals(true);
  }
  function renderThumbs(){
    let r=null; try{ r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); }catch(e){ return; }
    const w=186,h=120; r.setSize(w,h,false); r.setPixelRatio(1);
    const sc=new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff,0xcfd9d9,1.0)); const dl=new THREE.DirectionalLight(0xffffff,1.1); dl.position.set(-3,5,4); sc.add(dl);
    const cam=new THREE.PerspectiveCamera(30,w/h,0.1,50);
    PARTS.forEach(p=>{
      const m=A.P[p.id].model.clone(true); m.traverse(o=>{ if(o.isLineSegments) o.visible=false; });
      m.position.set(0,0,0); const g=new THREE.Group(); g.add(m); sc.add(g);
      const bb=new THREE.Box3().setFromObject(g); const c=bb.getCenter(new THREE.Vector3()), size=bb.getSize(new THREE.Vector3()); g.position.sub(c);
      const rad=Math.max(0.12,size.length()/2); const d=rad/Math.sin(THREE.MathUtils.degToRad(15))*0.95;
      cam.position.set(d*0.62,d*0.42,d*0.66); cam.lookAt(0,0,0); cam.updateProjectionMatrix();
      r.render(sc,cam); const img=document.querySelector(`#aList .part[data-id="${p.id}"] img`); if(img) img.src=r.domElement.toDataURL('image/png');
      sc.remove(g);
    });
    const ext=r.getContext().getExtension('WEBGL_lose_context'); r.dispose(); if(ext) ext.loseContext();
  }

  /* ---------- rótulos numerados ---------- */
  function buildLabels(){
    const box=$a('#aLabels'); box.innerHTML='';
    PARTS.forEach(p=>{ const el=document.createElement('div'); el.className='lb'; el.innerHTML=`${p.n}<span class="nm">${p.name}</span>`; el.style.display='none';
      el.onclick=()=>select(p.id); el.onmouseenter=()=>{A.hover=p.id;}; el.onmouseleave=()=>{ if(A.hover===p.id) A.hover=null; }; box.appendChild(el); labelEls[p.id]=el; });
  }
  const tmpP={x:0,y:0,z:0};
  function updateLabels(){
    PARTS.forEach(p=>{
      const el=labelEls[p.id], show=A.labels&&(S[p.id].st==='on');
      if(!show){ el.style.display='none'; return; }
      const h=holders[p.id]; const pos=V3(p.anchor).add(V3(p.ex).multiplyScalar(A.e)); pos.y+=0.0;
      stage.project(pos,tmpP); el.style.display=tmpP.z>1?'none':'flex'; el.style.left=tmpP.x+'px'; el.style.top=tmpP.y+'px'; el.classList.toggle('sel',A.sel===p.id);
    });
  }

  /* ---------- seleção, montagem, desmontagem ---------- */
  function select(id){ A.sel=id; refreshTray(); renderCard(id); }
  function pick(id){
    select(id); const s=S[id];
    if(s.st==='on'||s.st==='fly'||s.st==='leave') return;
    if(!canMount(id)){ toast('Monte antes: '+missing(id).join(', '),true); return; }
    mount(id);
  }
  function mount(id,delay=0){ const s=S[id]; if(s.st!=='idle') return; s.st='fly'; s.t=0; s.dur=1.05; s.delay=delay; A.done=false; refreshTray(); renderCard(A.sel); }
  function unmount(id,delay=0){ const s=S[id]; if(s.st!=='on') return; s.st='leave'; s.t=1; s.delay=delay; refreshTray(); }
  function removeOne(id){
    const d=dependents(id); if(d.length){ toast('Remova antes: '+d.map(x=>x.name).join(', '),true); return; }
    unmount(id); A.done=false;
  }
  function resetAll(){ A.queue.length=0; A.func=false; const on=PARTS.filter(p=>S[p.id].st==='on'||S[p.id].st==='fly'); on.slice().reverse().forEach((p,i)=>{ if(S[p.id].st==='fly'){S[p.id].st='leave';S[p.id].delay=i*0.05;} else unmount(p.id,i*0.07); }); A.done=false; refreshTray(); renderCard(A.sel); }
  function autoAll(){ A.queue=PARTS.filter(p=>S[p.id].st==='idle').map(p=>p.id); A.qT=0; }

  /* ---------- ficha da peça ---------- */
  function renderCard(id){
    const box=$a('#aCard'), c=count(), kg=PARTS.filter(p=>isOn(p.id)).reduce((s,p)=>s+p.kg,0);
    const stat=`<div class="stat"><div><b>${c}/${N}</b><small>peças</small></div><div><b>${kg.toLocaleString('pt-BR')} kg</b><small>massa montada</small></div><div><b>${Math.round(kg/TOTAL_KG*100)}%</b><small>da máquina</small></div></div>`;
    const nextP=PARTS.find(p=>S[p.id].st==='idle'&&canMount(p.id));
    let html='';
    if(!id){
      $a('#aGroup').textContent='';
      html=`<p style="margin-bottom:8px">Monte a empilhadeira peça por peça, como numa linha de montagem. <b>Clique numa peça da bandeja</b> (ou no contorno turquesa na máquina) e ela voa até o lugar certo.</p>
        <p>Gire a máquina com o mouse ou o dedo. Use <b>vista explodida</b> para ver cada componente separado, <b>raio-X</b> para enxergar o motor sob o capô e <b>Projeto 2D</b> para o desenho técnico.</p>${stat}`;
    } else {
      const p=byId[id], s=S[id]; $a('#aGroup').textContent=p.grp;
      let act='';
      if(s.st==='on') act=`<button onclick="ASM.removeOne('${id}')">Desmontar esta peça</button>`;
      else if(s.st==='idle') act=canMount(id)?`<button class="pri" onclick="ASM.pick('${id}')">Montar esta peça</button>`:`<div class="next" style="border-color:#F2D9A8;background:#FFF8EA">🔒 Monte antes: <b>${missing(id).join(', ')}</b></div>`;
      html=`<div class="ihead"><div class="inum">${p.n}</div><div><h3>${p.name}</h3><small>${p.grp} · ≈ ${p.kg.toLocaleString('pt-BR')} kg</small></div></div>
        <h4>Função</h4><p>${p.func}</p><h4>Onde fica</h4><p>${p.where}</p><h4>No dia a dia do operador · NR-11</h4><p class="nr">${p.nr}</p><div style="margin-top:8px">${act}</div>${stat}`;
    }
    if(c===N) html+=`<div class="done"><b>✓ Montagem concluída!</b> Os 17 componentes estão no lugar. Clique em <b>Testar funções</b> para ver rodas, ventoinha e mastro funcionando, e depois gire a máquina para conferir cada lado.</div>`;
    else if(nextP) html+=`<div class="next">Próxima peça sugerida: <b>${nextP.n}. ${nextP.name}</b><br><button class="pri" onclick="ASM.pick('${nextP.id}')">Montar agora</button></div>`;
    box.innerHTML=html;
  }

  /* ---------- interação com a cena ---------- */
  function hit(e){
    const r=stage.canvas.getBoundingClientRect(); const m=new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
    ray.setFromCamera(m,stage.camera);
    const objs=[]; PARTS.forEach(p=>{ const s=S[p.id].st; if(s==='on') objs.push(holders[p.id]); else if(s==='idle') objs.push(ghosts[p.id].g); });
    const hits=ray.intersectObjects(objs,true); const ids=[];
    for(const h of hits){ if(h.object.isLineSegments&&!h.object.userData.pid) continue; let o=h.object; while(o&&!o.userData.pid) o=o.parent; if(o&&o.userData.pid&&!ids.includes(o.userData.pid)) ids.push(o.userData.pid); }
    // prefere peças já montadas ou que podem ser montadas agora (as bloqueadas ficam por último)
    return ids.find(id=>S[id].st==='on'||canMount(id))||ids[0]||null;
  }
  function onHover3d(e){ const id=hit(e); A.hover=id; stage.canvas.style.cursor=id?'pointer':'grab'; }
  function onClick3d(e){ const id=hit(e); if(id) pick(id); }

  /* ---------- visuais ---------- */
  function applyXray(){
    if(A.bp) setBlueprint(true);
    ['carenagem','contrapeso'].forEach(id=>{ const m=A.P[id].model; m.traverse(o=>{ if(o.isMesh&&o.userData.orig){ const mt=o.userData.orig; mt.transparent=A.xray; mt.opacity=A.xray?0.30:1; mt.depthWrite=!A.xray; mt.needsUpdate=true; } }); });
  }
  function setBlueprint(on){
    A.bp=on; A.camName=on?'side':'iso'; PARTS.forEach(p=>{ A.P[p.id].model.traverse(o=>{ if(o.isMesh&&o.userData.orig){ o.material=on?((A.xray&&(p.id==='carenagem'||p.id==='contrapeso'))?bpGlass:bpFill):o.userData.orig; o.castShadow=!on; } if(o.isLineSegments&&o.userData.bp) o.visible=on; }); });
    stage.ground.visible=!on; stage.setBlueprint&&stage.setBlueprint(on);
    $a('#cv3d').parentElement.classList.toggle('bp',on);
    document.querySelectorAll('#aView button').forEach(b=>b.classList.toggle('on',b.dataset.v===(on?'2d':'3d')));
    stage.view(on?'side':'iso'); $a('#aHint').textContent=on?'Desenho técnico (vistas ortogonais): use Lateral, Frente, Traseira e Topo · roda do mouse aproxima':'Arraste para girar · roda do mouse para aproximar · duplo clique para recentralizar';
  }
  function updateAvailVisuals(force){
    const key=PARTS.map(p=>S[p.id].st[0]+(canMount(p.id)?1:0)).join('');
    if(!force&&key===lastAvailKey) return; lastAvailKey=key;
    PARTS.forEach(p=>{ const g=ghosts[p.id]; if(!g) return; const idle=S[p.id].st==='idle'; g.g.visible=idle; const av=idle&&canMount(p.id);
      g.lines.forEach(l=>{ l.material=av?lineAvail:lineLocked; }); });
  }
  const ease=t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2, easeOut=t=>1-Math.pow(1-t,3);
  function setHighlight(id,col,amount){
    A.P[id].model.traverse(o=>{ if(o.isMesh&&o.userData.orig&&o.userData.orig.emissive){ const mt=o.userData.orig; if(mt.userData.e0===undefined){ mt.userData.e0=mt.emissive.getHex(); mt.userData.i0=mt.emissiveIntensity; }
      if(amount>0){ mt.emissive.setHex(col); mt.emissiveIntensity=amount; } else { mt.emissive.setHex(mt.userData.e0); mt.emissiveIntensity=mt.userData.i0; } } });
  }
  let hlPrev={};

  /* ---------- quadro a quadro ---------- */
  function frame(dt){
    if(!A.ready){ init(); if(!A.ready) return; }
    clock.now+=dt;
    // fila "montar tudo"
    if(A.queue.length){ A.qT-=dt; if(A.qT<=0){ const id=A.queue.shift(); if(S[id].st==='idle'&&canMount(id)){ mount(id); A.sel=id; renderCard(id);} else if(S[id].st==='idle'){ A.queue.push(id); } A.qT=0.45; } }
    // estados
    let changed=false;
    PARTS.forEach((p,i)=>{
      const s=S[p.id];
      if(s.delay>0){ s.delay-=dt; if(s.st==='leave'||s.st==='fly') return; }
      if(s.st==='fly'){ s.t+=dt/s.dur; if(s.t>=1){ s.t=1; s.st='on'; s.bounce=0.4; burst(p); changed=true; if(count()===N){ A.done=true; toast('✓ Montagem concluída! Teste as funções e gire a máquina.'); } else toast(p.id==='carenagem'&&!A.xray?'✓ Carenagem montada · dica: ligue o raio-X para ver o motor sob o capô':`✓ ${p.n}. ${p.name} montada`); } }
      else if(s.st==='leave'){ s.t-=dt/(s.dur*0.8); if(s.t<=0){ s.t=0; s.st='idle'; changed=true; } }
      if(s.bounce>0) s.bounce=Math.max(0,s.bounce-dt);
    });
    if(changed){ refreshTray(); renderCard(A.sel); }
    // explosão
    const eT=document.querySelector('#aExplode').checked?1:0; A.e+=(eT-A.e)*Math.min(1,dt*3.2);
    // poses
    PARTS.forEach((p,i)=>{
      const s=S[p.id], h=holders[p.id], gh=ghosts[p.id].g, anchor=V3(p.anchor), ex=V3(p.ex).multiplyScalar(A.e), base=anchor.clone().add(ex);
      gh.position.copy(base);
      if(s.st==='idle'){ h.visible=false; return; }
      h.visible=true;
      if(s.st==='on'){ h.position.copy(base); h.rotation.set(0,0,0); const b=s.bounce>0?1+0.05*Math.sin(s.bounce/0.4*Math.PI):1; h.scale.setScalar(b); }
      else { const u=ease(Math.max(0,Math.min(1,s.t))); const start=base.clone().add(new THREE.Vector3(-4.6,2.4+0.28*(i%5),3.4-0.3*(i%4)));
        const ctrl=start.clone().lerp(base,0.5); ctrl.y=Math.max(start.y,base.y)+1.6;
        const a=1-u; h.position.set(a*a*start.x+2*a*u*ctrl.x+u*u*base.x, a*a*start.y+2*a*u*ctrl.y+u*u*base.y, a*a*start.z+2*a*u*ctrl.z+u*u*base.z);
        h.rotation.set(0,a*Math.PI*1.3*(i%2?1:-1),a*0.5*(i%3?1:-1)); h.scale.setScalar(0.35+0.65*easeOut(Math.max(0,Math.min(1,s.t)))); }
    });
    // realce (hover / seleção)
    PARTS.forEach(p=>{ const want=A.sel===p.id?'sel':(A.hover===p.id?'hov':''); if(hlPrev[p.id]!==want){ hlPrev[p.id]=want; if(want==='sel') setHighlight(p.id,0xB5B000,0.35); else if(want==='hov') setHighlight(p.id,0x5BA8A5,0.30); else setHighlight(p.id,0,0); }
      const gl=ghosts[p.id]; if(S[p.id].st==='idle'){ const hov=(A.hover===p.id||A.sel===p.id); gl.lines.forEach(l=>{ if(l.material===lineLocked) l.material=lineLocked; }); } });
    // pulso das peças disponíveis
    lineAvail.opacity=0.55+0.4*Math.sin(clock.now*4); ghostFill.opacity=0.08+0.05*Math.sin(clock.now*4);
    updateAvailVisuals(false);
    // testar funções: rodas, ventoinha, mastro e piso em movimento
    if(A.func){ A.odo+=dt*1.5; A.tt+=dt; }
    const liftT=A.func?0.2+0.85*(1-Math.cos(A.tt*0.9))*0.9:0.2; A.lift+=(liftT-A.lift)*Math.min(1,dt*4);
    const ext=Math.max(0,A.lift-1.0);
    const spin=A.func?dt*5:0;
    ['eixoF','eixoR'].forEach(id=>{ const R=id==='eixoF'?T.Rf:T.Rr; A.P[id].model.traverse(o=>{ if(o.name==='wheel') o.rotation.z-= (A.func?dt*1.5:0)/R; }); });
    A.P.motor.model.traverse(o=>{ if(o.name==='fan') o.rotation.x+=spin; });
    const m=A.P.mastro.model.userData.stages; if(m){ m[0].position.y=0; m[1].position.y=ext/2; m[2].position.y=ext; }
    A.P.carro.model.userData.carriage.position.y=A.lift; A.P.garfos.model.userData.forks.position.y=A.lift; A.P.espaldar.model.userData.backrest.position.y=A.lift;
    const rod=A.P.cilindros.model.userData.rod; if(rod) rod.position.y=1.0+ext/2;
    stage.grid.material.map.offset.x=(A.odo%1);
    // câmera
    if(A.spin) stage.ctl.auto=true;
    stage.step(dt); stepFx(dt); stage.render(); updateLabels(); updateDims();
  }

  /* ---------- cotas do desenho técnico (vista lateral) ---------- */
  const tp2={x:0,y:0,z:0};
  function updateDims(){
    const svg=$a('#aDims'); if(!(A.bp&&A.camName==='side')){ if(svg.innerHTML) svg.innerHTML=''; return; }
    const pr=(x,y)=>{ stage.project(new THREE.Vector3(x,y,0.6),tp2); return [tp2.x,tp2.y]; };
    const L=T.L, out=[]; const col='#2d8a86';
    const hdim=(x1,x2,y,label)=>{ const [a,b]=pr(x1,y),[c,d]=pr(x2,y), t=5; out.push(`<g stroke="${col}" stroke-width="1.2" fill="none"><path d="M${a} ${b}H${c}M${a} ${b-t}V${b+t}M${c} ${d-t}V${d+t}"/><path d="M${a} ${b}l8 -3v6zM${c} ${d}l-8 -3v6z" fill="${col}"/></g><text x="${(a+c)/2}" y="${b-6}" text-anchor="middle" font-size="11" font-weight="600" fill="${col}" style="paint-order:stroke;stroke:#fff;stroke-width:3px">${label}</text>`); };
    const vdim=(x,y1,y2,label)=>{ const [a,b]=pr(x,y1),[c,d]=pr(x,y2), t=5; out.push(`<g stroke="${col}" stroke-width="1.2" fill="none"><path d="M${a} ${b}V${d}M${a-t} ${b}H${a+t}M${c-t} ${d}H${c+t}"/><path d="M${a} ${b}l-3 -8h6zM${c} ${d}l-3 8h6z" fill="${col}"/></g><text transform="translate(${a-8} ${(b+d)/2}) rotate(-90)" text-anchor="middle" font-size="11" font-weight="600" fill="${col}" style="paint-order:stroke;stroke:#fff;stroke-width:3px">${label}</text>`); };
    const on=id=>isOn(id);
    if(on('eixoF')&&on('eixoR')) hdim(-L,0,-0.30,`ENTRE-EIXOS ${Math.round(L*1000)} mm`);
    if(on('garfos')) hdim(T.a,T.a+T.fork,-0.30,`GARFOS ${Math.round(T.fork*1000)} mm`);
    if(on('contrapeso')&&on('garfos')) hdim(-L-0.66,T.a+T.fork,-0.62,`COMPRIMENTO TOTAL ${Math.round((L+0.66+T.a+T.fork)*1000)} mm`);
    if(on('protetor')) vdim(-L-0.95,0,T.guard,`ALTURA ${Math.round(T.guard*1000)} mm`);
    if(on('mastro')) vdim(1.9,0,T.mastH,`MASTRO ${Math.round(T.mastH*1000)} mm`);
    svg.innerHTML=out.join('');
  }

  /* ---------- eventos de interface ---------- */
  function wire(){
    $a('#aAuto').onclick=()=>{ if(count()===N){ toast('A máquina já está completa. Clique em Desmontar para recomeçar.',true); return; } autoAll(); };
    $a('#aReset').onclick=resetAll;
    $a('#aFunc').onclick=()=>{ A.func=!A.func; refreshTray(); if(A.func) toast('Testando: rodas, ventoinha do radiador e mastro em movimento'); };
    $a('#aExplode').onchange=()=>{ if(!stage) return; const on=$a('#aExplode').checked; if(!A.bp) stage.view(on?'iso':'iso'); stage.ctl.goal={az:stage.ctl.az,el:stage.ctl.el,dist:on?9.2:5.6,target:new THREE.Vector3(on?0.5:-0.25,on?1.7:0.95,0)}; };
    $a('#aXray').onchange=()=>{ A.xray=$a('#aXray').checked; applyXray(); };
    $a('#aLabelsOn').onchange=()=>{ A.labels=$a('#aLabelsOn').checked; };
    document.querySelectorAll('#aCam button').forEach(b=>b.onclick=()=>{
      if(!stage) return; const c=b.dataset.c;
      if(c==='spin'){ A.spin=!A.spin; stage.ctl.auto=A.spin; b.classList.toggle('on',A.spin); return; }
      A.spin=false; $a('#aSpin').classList.remove('on'); A.camName=c; stage.view(c); });
    document.querySelectorAll('#aView button').forEach(b=>b.onclick=()=>{ if(stage) setBlueprint(b.dataset.v==='2d'); });
    new ResizeObserver(()=>{ if(stage) stage.resize(); }).observe($a('.cwrap'));
  }

  function forceAll(){ PARTS.forEach(p=>{ S[p.id].st='on'; S[p.id].t=1; S[p.id].bounce=0; }); A.done=true; refreshTray(); renderCard(A.sel); }
  return {frame,init,wire,pick,removeOne,select,PARTS,S,A,mount,count,forceAll};
})();
document.addEventListener('DOMContentLoaded',()=>ASM.wire());
