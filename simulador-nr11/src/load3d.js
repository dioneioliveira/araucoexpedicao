/* ===== Visão 3D da aba "Teste de carga" =====
   Empilhadeira completa, carga com as dimensões reais, triângulo de estabilidade no chão,
   CG da máquina / da carga / combinado e sua projeção, rampa, tombamento frontal e lateral.
   Depende de THREE, F3D e das globais da simulação (T, st, cur, statusOf, dynamics). */
'use strict';
const L3D = (function(){
  let stage=null, ok=null, builtFor=null, loadKey='', lastZ=-1;
  let rollP, pitchP, truckG, mastRig, mastInner, loadG, groundRig, mk={}, wheels=[], fan=null, P=null, odo=0, trailLine=null, tri=null, band=null, outline=null;
  const $l = s => document.querySelector(s);
  const S2T = F3D.S2T;
  const colOf = a => new THREE.Color(a);

  function ensure(){
    if(ok!==null) return ok;
    try{ stage=F3D.createStage($l('#cv3dLoad'),{onInteract:()=>{}}); ok=true; }catch(e){ ok=false; console.warn('WebGL indisponível',e); return false; }
    groundRig=new THREE.Group(); stage.scene.add(groundRig); groundRig.add(stage.ground); groundRig.add(stage.grid);
    rollP=new THREE.Group(); pitchP=new THREE.Group(); rollP.add(pitchP); stage.scene.add(rollP);
    truckG=new THREE.Group(); pitchP.add(truckG);
    stage.view('iso',true);
    return true;
  }

  function disposeTree(o){ o.traverse(c=>{ if(c.geometry) c.geometry.dispose(); }); }

  /* ---------- (re)constrói máquina e marcadores para o modelo atual ---------- */
  function rebuild(){
    while(truckG.children.length){ const c=truckG.children[0]; truckG.remove(c); disposeTree(c); }
    wheels=[]; fan=null; loadKey='';
    P=F3D.build(T);
    const mastIds=['mastro','cilindros','carro','garfos','espaldar'];
    mastRig=new THREE.Group(); mastRig.position.set(0,T.Rf,0); mastInner=new THREE.Group(); mastInner.position.set(0,-T.Rf,0); mastRig.add(mastInner); truckG.add(mastRig);
    for(const id in P){ const m=P[id].model; (mastIds.includes(id)?mastInner:truckG).add(m); }
    P.eixoF.model.traverse(o=>{ if(o.name==='wheel') wheels.push({o,R:T.Rf}); });
    P.eixoR.model.traverse(o=>{ if(o.name==='wheel') wheels.push({o,R:T.Rr}); });
    P.motor.model.traverse(o=>{ if(o.name==='fan') fan=o; });
    // marcadores
    const sph=(r,c)=>{ const m=new THREE.Mesh(new THREE.SphereGeometry(r,20,14),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:.35,roughness:.4})); m.renderOrder=5; m.material.depthTest=false; return m; };
    mk={truck:sph(0.07,0x2b6fbf),load:sph(0.07,0xd9780f),cg:sph(0.10,0x2e9e6b),
        dot:new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.11,0.015,28),new THREE.MeshBasicMaterial({color:0x2e9e6b,transparent:true,opacity:.95,depthTest:false})),
        line:new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,-1,0)]),new THREE.LineBasicMaterial({color:0x2e9e6b,depthTest:false})),
        tline:new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,-1,0)]),new THREE.LineBasicMaterial({color:0x2b6fbf,transparent:true,opacity:.5,depthTest:false})),
        lline:new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,-1,0)]),new THREE.LineBasicMaterial({color:0xd9780f,transparent:true,opacity:.5,depthTest:false}))};
    mk.dot.renderOrder=5; mk.line.renderOrder=5;
    Object.values(mk).forEach(o=>truckG.add(o));
    // triângulo de estabilidade no piso
    const hw=T.T/2, y=0.012, FL=[0,hw], FR=[0,-hw], R=[-T.L,0];
    const to3=(p,yy)=>new THREE.Vector3(p[0],yy,-p[1]);
    const triGeo=new THREE.BufferGeometry().setFromPoints([to3(FL,y),to3(FR,y),to3(R,y)]); triGeo.setIndex([0,1,2]); triGeo.computeVertexNormals();
    tri=new THREE.Mesh(triGeo,new THREE.MeshBasicMaterial({color:0x7fc4c0,transparent:true,opacity:.38,side:THREE.DoubleSide,depthWrite:false,depthTest:false})); tri.renderOrder=3;
    // faixa de risco (borda de 7 cm)
    const a=Math.hypot(FR[0]-R[0],FR[1]-R[1]), b=Math.hypot(FL[0]-R[0],FL[1]-R[1]), c=T.T, per=a+b+c;
    const ix=(a*FL[0]+b*FR[0]+c*R[0])/per, iy=(a*FL[1]+b*FR[1]+c*R[1])/per, area=Math.abs((FR[0]-FL[0])*(R[1]-FL[1])-(R[0]-FL[0])*(FR[1]-FL[1]))/2, rin=2*area/per, k=(rin-0.07)/rin;
    const ip=[FL,FR,R].map(p=>[ix+(p[0]-ix)*k,iy+(p[1]-iy)*k]);
    const sh=new THREE.Shape([FL,FR,R].map(p=>new THREE.Vector2(p[0],p[1]))); sh.holes.push(new THREE.Path(ip.map(p=>new THREE.Vector2(p[0],p[1]))));
    const bg=new THREE.ShapeGeometry(sh); bg.rotateX(Math.PI/2); bg.scale(1,1,-1);   // (x,y_sim) -> (x,0,-y)
    band=new THREE.Mesh(bg,new THREE.MeshBasicMaterial({color:0xd6303a,transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false,depthTest:false})); band.position.y=y+0.003; band.renderOrder=4;
    outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([to3(FL,y+0.006),to3(FR,y+0.006),to3(R,y+0.006)]),new THREE.LineBasicMaterial({color:0x2d8a86,depthTest:false})); outline.renderOrder=5;
    truckG.add(tri); truckG.add(band); truckG.add(outline);
    trailLine=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x444444,transparent:true,opacity:.7,depthTest:false})); trailLine.frustumCulled=false; trailLine.renderOrder=6; truckG.add(trailLine);
    builtFor=T; lastZ=-1;
    const d=Math.max(6.4,(T.L+T.a+T.fork)*2.15);
    stage.ctl.maxD=Math.max(16,d*2.4); stage.ctl.goal={az:stage.ctl.az,el:stage.ctl.el,dist:d,target:new THREE.Vector3(-T.L*0.15,T.guard*0.45,0)};
    stage.__homeDist=d;
  }

  /* ---------- carga: pallet + caixas ---------- */
  function updateLoad(){
    const key=[st.mass>0,st.Lc,st.Wc,st.Hc].join('|');
    if(key===loadKey) return; loadKey=key;
    if(loadG){ mastInner.remove(loadG); disposeTree(loadG); loadG=null; }
    if(st.mass<=0) return;
    loadG=F3D.buildLoad(st.Lc,st.Wc,st.Hc); mastInner.add(loadG);
  }

  /* ---------- atualização por quadro ---------- */
  function update(A,dt){
    if(!ensure()) return;
    if(builtFor!==T) rebuild();
    updateLoad();
    const stt=statusOf(A.fs), phi=dynamics().phi, hw=T.T/2;
    // inclinação do mastro, elevação, carga
    mastRig.rotation.z=cur.tilt*Math.PI/180;
    const ext=Math.max(0,cur.lift-1.0), lift=cur.lift;
    const stg=P.mastro.model.userData.stages; if(stg){ stg[1].position.y=ext/2; stg[2].position.y=ext; }
    P.carro.model.userData.carriage.position.y=lift; P.garfos.model.userData.forks.position.y=lift; P.espaldar.model.userData.backrest.position.y=lift;
    const rod=P.cilindros.model.userData.rod; if(rod) rod.position.y=1.0+ext/2;
    if(loadG){ loadG.position.set(T.a+st.s,lift,-st.yl); loadG.visible=true; }
    // rodas e ventoinha
    odo+=st.speed/3.6*dt; wheels.forEach(w=>{ w.o.rotation.z-=st.speed/3.6*dt/w.R; }); if(fan) fan.rotation.x+=dt*6;
    stage.grid.material.map.offset.x=(odo%1);
    // rampa (piso e máquina inclinam) e tombamento
    groundRig.rotation.z=phi;
    pitchP.rotation.z=phi-cur.tipLong*Math.PI/180;
    const roll=-cur.tipRoll*Math.PI/180; const zc=cur.tipRoll>0?-hw:hw;
    rollP.position.set(0,0,Math.abs(cur.tipRoll)>0.01?zc:0); pitchP.position.set(0,0,Math.abs(cur.tipRoll)>0.01?-zc:0); rollP.rotation.x=roll;
    // marcadores (no referencial da máquina)
    const b0=A.bodies[0], b1=A.bodies[1], cg=A.cg, col=colOf(stt.c);
    mk.truck.position.copy(S2T(b0.x,b0.y,b0.z)); mk.load.visible=!!b1; if(b1) mk.load.position.copy(S2T(b1.x,b1.y,b1.z));
    mk.cg.position.copy(S2T(cg.x,cg.y,cg.z)); mk.cg.material.color.copy(col); mk.cg.material.emissive.copy(col);
    mk.dot.position.set(cg.px,0.02,-cg.py); mk.dot.material.color.copy(col);
    const set=(ln,a,b)=>{ const p=ln.geometry.attributes.position; p.setXYZ(0,a.x,a.y,a.z); p.setXYZ(1,b.x,b.y,b.z); p.needsUpdate=true; ln.geometry.computeBoundingSphere(); };
    set(mk.line,mk.cg.position,new THREE.Vector3(cg.px,0.02,-cg.py)); mk.line.material.color.copy(col);
    set(mk.tline,mk.truck.position,new THREE.Vector3(b0.px,0.02,-b0.py));
    mk.lline.visible=!!b1; if(b1) set(mk.lline,mk.load.position,new THREE.Vector3(b1.px,0.02,-b1.py));
    // rastro do CG no piso
    if(cur.trail.length>1){ const pts=cur.trail.map(p=>new THREE.Vector3(p[0],0.025,-p[1])); trailLine.geometry.setFromPoints(pts); }
    // enquadramento automático quando a altura da carga muda (zoom auto)
    const zTop=Math.max(T.guard,lift+(st.mass>0?st.Hc:0.3)+0.3);
    if(document.querySelector('#optZoom').checked && Math.abs(zTop-lastZ)>0.04){ lastZ=zTop;
      const dd=Math.max(stage.__homeDist||6.4,1.75*zTop+2.4,(T.L+T.a+st.s+st.Lc+0.8)*1.35);
      stage.ctl.goal={az:stage.ctl.az,el:stage.ctl.el,dist:dd,target:new THREE.Vector3(-T.L*0.15,zTop*0.45,0)}; }
    stage.step(dt); stage.render();
    // textos
    const hud=$l('#hud3d'); if(hud){ hud.innerHTML=`Massa total <b>${Math.round(A.M)} kg</b><br>CG combinado: <b>${Math.abs(cg.x*1000).toFixed(0)} mm ${cg.x<0?'atrás':'à frente'}</b> do eixo · altura <b>${cg.z.toFixed(2).replace('.',',')} m</b><br>Rampa <b>${st.slope}%</b> · <span style="color:${stt.c}">${stt.t}</span>`; }
    const tip=$l('#tip3d'); if(tip) tip.hidden=!(stt.k==='tip');
  }

  function show(on){
    $l('#cvSide').hidden=on; $l('#cv3dLoad').hidden=!on; $l('#hud3d').hidden=!on; $l('#sCam').hidden=!on; if(!on) $l('#tip3d').hidden=true;
    document.querySelectorAll('#sView button').forEach(b=>b.classList.toggle('on',b.dataset.v===(on?'3d':'2d')));
    if(on){ ensure(); }
  }
  function view(c){ if(!ensure()) return; if(builtFor!==T) rebuild(); stage.view(c); if(c==='iso'&&stage.__homeDist) stage.ctl.goal.dist=stage.__homeDist; }
  function resize(){ if(stage) stage.resize(); }

  return {update,show,view,resize,get active(){ return ok===true; }};
})();
