/* ===== Modelo 3D da empilhadeira (Three.js) =====
   Convenção da simulação: x = frente · y = esquerda · z = altura (m).
   Convenção do Three:     X = frente · Y = altura · Z = direita  (Z = -y da simulação). */
'use strict';
const F3D = (function(){
  const TURQ=0xB7D9D8, LIME=0xD0CC00;

  /* ---------- materiais ---------- */
  const paint = ()=>new THREE.MeshStandardMaterial({color:0xD0CC00,metalness:.25,roughness:.42});
  const paintDk=()=>new THREE.MeshStandardMaterial({color:0xA8A500,metalness:.35,roughness:.45});
  const steel = ()=>new THREE.MeshStandardMaterial({color:0xC3CAD2,metalness:.85,roughness:.28});
  const dark  = ()=>new THREE.MeshStandardMaterial({color:0x3C444F,metalness:.6,roughness:.5});
  const black = ()=>new THREE.MeshStandardMaterial({color:0x1A1D21,metalness:.3,roughness:.65});
  const rubber= ()=>new THREE.MeshStandardMaterial({color:0x17191C,metalness:.05,roughness:.92});
  const seatM = ()=>new THREE.MeshStandardMaterial({color:0x24272C,metalness:.05,roughness:.85});
  const red   = ()=>new THREE.MeshStandardMaterial({color:0xD6303A,metalness:.2,roughness:.4,emissive:0x330508});
  const amber = ()=>new THREE.MeshStandardMaterial({color:0xFFA31A,metalness:.1,roughness:.3,emissive:0xA85A00,emissiveIntensity:.9});
  const lamp  = ()=>new THREE.MeshStandardMaterial({color:0xFFFBE0,metalness:.1,roughness:.2,emissive:0xFFF2A8,emissiveIntensity:.8});
  const wood  = ()=>new THREE.MeshStandardMaterial({color:0xB88A52,metalness:0,roughness:.85});
  const cardb = ()=>new THREE.MeshStandardMaterial({color:0xC9A066,metalness:0,roughness:.8});

  /* ---------- helpers de geometria ---------- */
  function mesh(geo,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}
  function box(w,h,d,mat,x=0,y=0,z=0){return mesh(new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
  function cyl(r,len,mat,x=0,y=0,z=0,axis='z',seg=28){            // cilindro com eixo em x, y ou z
    const g=new THREE.CylinderGeometry(r,r,len,seg); const m=mesh(g,mat,x,y,z);
    if(axis==='z') m.rotation.x=Math.PI/2; else if(axis==='x') m.rotation.z=Math.PI/2; return m;}
  function cylBetween(a,b,r,mat,seg=16){                            // cilindro entre dois pontos (Vector3)
    const d=new THREE.Vector3().subVectors(b,a), len=d.length(); const g=new THREE.CylinderGeometry(r,r,len,seg);
    const m=mesh(g,mat); m.position.copy(a).addScaledVector(d,.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); return m;}
  function rbox(w,h,d,r,mat,x=0,y=0,z=0){                          // caixa com cantos arredondados (extrusão)
    const s=new THREE.Shape(); const hw=w/2,hh=h/2; r=Math.min(r,hw,hh);
    s.moveTo(-hw+r,-hh); s.lineTo(hw-r,-hh); s.quadraticCurveTo(hw,-hh,hw,-hh+r); s.lineTo(hw,hh-r); s.quadraticCurveTo(hw,hh,hw-r,hh);
    s.lineTo(-hw+r,hh); s.quadraticCurveTo(-hw,hh,-hw,hh-r); s.lineTo(-hw,-hh+r); s.quadraticCurveTo(-hw,-hh,-hw+r,-hh);
    const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelThickness:Math.min(.02,r*.6),bevelSize:Math.min(.02,r*.6),bevelSegments:3,curveSegments:10});
    g.translate(0,0,-d/2); return mesh(g,mat,x,y,z);}
  function extrudeProfile(shape,depth,mat,bev=.02){                // perfil lateral (x,y) extrudado na largura (z)
    const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:3,curveSegments:14});
    g.translate(0,0,-depth/2); return mesh(g,mat);}
  function addAll(g,...a){a.forEach(x=>g.add(x));return g;}

  /* ---------- placa (textura) ---------- */
  function plateTexture(text){
    const c=document.createElement('canvas'); c.width=256; c.height=128; const x=c.getContext('2d');
    x.fillStyle='#1d2025'; x.fillRect(0,0,256,128); x.strokeStyle='#D0CC00'; x.lineWidth=5; x.strokeRect(6,6,244,116);
    x.fillStyle='#D0CC00'; x.font='bold 54px system-ui,sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(text,128,52);
    x.font='bold 17px system-ui,sans-serif'; x.fillStyle='#e9e9e9'; x.fillText('CAPACIDADE · C 500 mm',128,102);
    const t=new THREE.CanvasTexture(c); t.anisotropy=4; return t;}

  /* ---------- construção das peças ---------- */
  function build(T){
    const L=T.L, hw=T.T/2, bw=T.bodyW, Rf=T.Rf, Rr=T.Rr, a=T.a, FK=T.fork, MH=T.mastH, GD=T.guard, dz=T.dz||0;
    const P={}; const def=(id,fn)=>{ const g=new THREE.Group(); g.name=id; fn(g); P[id]={id,model:g}; };

    // ---- 1 chassi ----
    def('chassi',g=>{
      for(const s of [-1,1]) g.add(box(L+0.5,0.28,0.11,dark(),-L/2+0.05,0.40,s*(bw/2-0.12)));
      for(const x of [-L-0.2,-L*0.5,-0.32,0.08]) g.add(box(0.09,0.22,bw-0.2,dark(),x,0.40,0));
      g.add(box(0.62,0.05,bw-0.18,steel(),-0.35,0.58,0));                     // assoalho
      for(let i=0;i<5;i++) g.add(box(0.025,0.012,bw-0.24,dark(),-0.62+i*0.12,0.61,0));
      g.add(box(0.14,0.22,bw-0.30,dark(),0.08,0.34,0));
    });

    // ---- rodas ----
    const wheel=(R,wd)=>{
      const w=new THREE.Group(); w.name='wheel';
      w.add(cyl(R,wd,rubber(),0,0,0,'z',40));
      for(let i=0;i<24;i++){const a2=i/24*Math.PI*2; const b=box(R*0.07,R*0.15,wd*1.0,black()); b.position.set(Math.cos(a2)*R*0.99,Math.sin(a2)*R*0.99,0); b.rotation.z=a2; w.add(b);}  // blocos da banda
      for(const s of [-1,1]){
        const f=cyl(R*0.58,0.03,steel(),0,0,s*wd*0.5,'z',36); w.add(f);
        const h=cyl(R*0.22,0.05,dark(),0,0,s*wd*0.52,'z',24); w.add(h);
        for(let i=0;i<8;i++){const a2=i/8*Math.PI*2; w.add(cyl(R*0.032,0.045,black(),Math.cos(a2)*R*0.38,Math.sin(a2)*R*0.38,s*wd*0.53,'z',10));}
      }
      return w;};
    def('eixoF',g=>{
      g.add(cyl(0.06,T.T,steel(),0,Rf,0,'z'));
      g.add(box(0.30,0.20,0.34,dark(),0,Rf+0.05,0));                         // carcaça do diferencial
      for(const s of [-1,1]){const w=wheel(Rf,0.26); w.position.set(0,Rf,s*hw); g.add(w);}
    });
    def('eixoR',g=>{
      g.add(cyl(0.05,0.8,steel(),-L,Rr,0,'z'));
      g.add(box(0.22,0.14,0.26,dark(),-L,Rr+0.05,0));
      g.add(cylBetween(new THREE.Vector3(-L,Rr,0),new THREE.Vector3(-L-0.25,Rr+0.05,0),0.025,dark()));  // barra de direção
      for(const s of [-1,1]){const w=wheel(Rr,0.20); w.position.set(-L,Rr,s*0.40); g.add(w);}
    });

    // ---- 4 motor e radiador ----
    def('motor',g=>{
      const x0=-L+0.20;
      g.add(rbox(0.78,0.44,0.46,0.04,new THREE.MeshStandardMaterial({color:0x6D7782,metalness:.7,roughness:.4}),x0+0.39,0.66,0));   // bloco
      g.add(box(0.70,0.09,0.42,dark(),x0+0.39,0.93,0));                       // cabeçote
      for(let i=0;i<4;i++) g.add(cyl(0.035,0.12,steel(),x0+0.12+i*0.17,1.0,0,'y',14));      // velas / injetores
      g.add(cyl(0.085,0.20,steel(),x0+0.18,1.07,0.12,'y',24));              // filtro de ar
      g.add(rbox(0.22,0.34,0.36,0.03,dark(),x0+0.89,0.62,0));                // caixa de transmissão
      g.add(cyl(0.05,0.55,steel(),x0+0.35,0.46,0,'z',16));                   // coletor/escapamento
      // radiador + ventoinha
      g.add(box(0.12,0.50,0.62,new THREE.MeshStandardMaterial({color:0x2F353C,metalness:.6,roughness:.5}),x0-0.12,0.68,0));
      for(let i=0;i<9;i++) g.add(box(0.13,0.50,0.012,steel(),x0-0.12,0.68,-0.28+i*0.07));
      const fan=new THREE.Group(); fan.name='fan'; fan.position.set(x0+0.03,0.68,0);
      for(let i=0;i<5;i++){const bl=box(0.01,0.34,0.07,black()); bl.rotation.x=i/5*Math.PI*2; bl.position.y=0; fan.add(bl);}
      fan.add(cyl(0.04,0.04,dark(),0,0,0,'x'));
      g.add(fan);
    });

    // ---- 5 contrapeso ----
    def('contrapeso',g=>{
      const s=new THREE.Shape();
      s.moveTo(-L-0.50,0.30); s.lineTo(-L+0.60,0.30); s.lineTo(-L+0.60,0.94); s.quadraticCurveTo(-L+0.50,1.14,-L+0.30,1.16);
      s.lineTo(-L-0.36,1.16); s.quadraticCurveTo(-L-0.62,1.12,-L-0.65,0.90); s.lineTo(-L-0.66,0.56); s.quadraticCurveTo(-L-0.66,0.34,-L-0.50,0.30);
      g.add(extrudeProfile(s,bw,paint(),.025));
      g.add(box(0.06,0.18,bw-0.12,black(),-L-0.68,0.46,0));                  // para-choque
      for(let i=0;i<7;i++){const st=box(0.065,0.34/7*1.01,bw-0.10,i%2?black():red(),-L-0.685,0.40+i*0.34/7,0); g.add(st);}   // faixas
      g.add(cyl(0.035,0.10,black(),-L-0.69,0.62,0,'x',14));                   // pino de reboque
    });

    // ---- 6 carenagem ----
    def('carenagem',g=>{
      const s=new THREE.Shape();
      s.moveTo(-L+0.60,0.30); s.lineTo(-0.12,0.30); s.quadraticCurveTo(0.17,0.30,0.18,0.52); s.lineTo(0.18,0.70); s.quadraticCurveTo(0.15,0.80,0.06,0.88);
      s.lineTo(-0.03,1.04); s.quadraticCurveTo(-0.12,1.08,-0.30,1.07); s.lineTo(-0.34,0.78); s.lineTo(-0.56,0.78); s.quadraticCurveTo(-0.60,0.94,-0.70,0.94); s.lineTo(-L+0.60,0.94); s.closePath();
      // furos dos para-lamas (apenas aparência): perfil sólido + arcos
      g.add(extrudeProfile(s,bw,paint(),.02));
      for(let i=0;i<6;i++) for(const sd of [-1,1]) g.add(box(0.012,0.2,0.012,black(),-1.02+i*0.06,0.78,sd*(bw/2+0.02)).translateY(-0.0));  // venezianas
      for(const [x,R] of [[0,Rf],[-L,Rr]]) for(const sd of [-1,1]){                                                       // para-lamas
        const arc=new THREE.Mesh(new THREE.TorusGeometry(R+0.05,0.028,10,32,Math.PI*0.8),paintDk()); arc.castShadow=true;
        arc.position.set(x,R,sd*(x===0?hw:0.40)+sd*(x===0?0.14:0.12)); arc.rotation.z=Math.PI*0.1; g.add(arc);
}
      g.add(box(0.05,0.12,0.30,lamp(),0.16,0.62,0));
    });

    // ---- 7 placa de capacidade ----
    def('placa',g=>{
      const t=plateTexture(`${(T.Q/1000).toString().replace('.',',')} t`);
      for(const sd of [-1,1]){const m=new THREE.Mesh(new THREE.PlaneGeometry(0.46,0.23),new THREE.MeshStandardMaterial({map:t,roughness:.5,metalness:.3}));
        m.position.set(-L+0.15,0.75,sd*(bw/2+0.012)); if(sd<0) m.rotation.y=Math.PI; m.castShadow=false; g.add(m);}
    });

    // ---- 8 painel e alavancas ----
    def('painel',g=>{
      g.add(rbox(0.22,0.14,0.34,0.03,dark(),-0.22,1.12,0));
      for(let i=0;i<3;i++){const z=-0.09+i*0.09; g.add(cylBetween(new THREE.Vector3(-0.22,1.16,z),new THREE.Vector3(-0.26,1.38,z),0.012,steel(),10)); const k=mesh(new THREE.SphereGeometry(0.03,14,10),red(),-0.26,1.395,z); g.add(k);}
      const disp=box(0.01,0.07,0.16,new THREE.MeshStandardMaterial({color:0x0a1a1a,emissive:0x1fb6a8,emissiveIntensity:.6}),-0.115,1.17,0); g.add(disp);
    });

    // ---- 9 volante e coluna ----
    def('volante',g=>{
      g.add(cylBetween(new THREE.Vector3(-0.16,1.02,0),new THREE.Vector3(-0.40,1.36,0),0.035,black(),16));
      const w=new THREE.Group(); w.position.set(-0.43,1.39,0); w.rotation.z=-0.55-Math.PI/2+Math.PI/2*0;
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.19,0.018,12,36),black()); ring.rotation.y=0; ring.castShadow=true; w.add(ring);
      for(let i=0;i<3;i++){const sp=box(0.36,0.014,0.014,black()); sp.rotation.z=i*Math.PI/3; w.add(sp);}
      w.add(mesh(new THREE.SphereGeometry(0.04,14,10),dark()));
      w.rotation.set(0,Math.PI/2,0); w.rotation.x=0.9; g.add(w);
    });

    // ---- 10 assento e cinto ----
    def('assento',g=>{
      g.add(rbox(0.40,0.10,0.44,0.04,seatM(),-0.80,1.01,0));
      const back=rbox(0.10,0.48,0.42,0.04,seatM(),-1.00,1.30,0); back.rotation.z=-0.12; g.add(back);
      g.add(rbox(0.12,0.14,0.26,0.05,seatM(),-1.04,1.60,0).rotateZ(-0.12));
      g.add(box(0.34,0.04,0.06,dark(),-0.78,1.14,0.26));                      // apoio de braço
      const belt=box(0.03,0.62,0.05,red(),-0.86,1.30,0.15); belt.rotation.z=0.65; belt.material.color.set(0xE8590C); g.add(belt);
      g.add(box(0.05,0.05,0.07,steel(),-0.70,1.07,0.15));
      g.add(box(0.30,0.06,0.46,dark(),-0.80,0.96,0));                         // base do assento
    });

    // ---- 11 protetor de cabeça ----
    def('protetor',g=>{
      const gy=GD-dz, x0=-1.15, x1=-0.04, zf=bw/2-0.06;
      for(const s of [-1,1]){
        g.add(cylBetween(new THREE.Vector3(x0,1.06,s*zf),new THREE.Vector3(x0-0.03,gy,s*zf),0.024,black(),12));
        g.add(cylBetween(new THREE.Vector3(x1,1.02,s*zf),new THREE.Vector3(x1+0.05,gy,s*zf),0.024,black(),12));
      }
      g.add(box(1.42,0.045,bw-0.04,dark(),-0.60,gy,0));
      for(let i=0;i<9;i++) g.add(box(0.04,0.03,bw-0.04,black(),-1.28+i*0.15,gy+0.03,0));
      for(const s of [-1,1]) g.add(box(1.42,0.04,0.04,dark(),-0.60,gy,s*(bw/2-0.02)));
    });

    // ---- 12 iluminação e sinalização ----
    def('luzes',g=>{
      const gy=GD-dz;
      const dome=new THREE.Mesh(new THREE.SphereGeometry(0.075,18,12,0,Math.PI*2,0,Math.PI/2),amber()); dome.position.set(-0.66,gy+0.03,0); g.add(dome);
      g.add(cyl(0.08,0.03,dark(),-0.66,gy+0.02,0,'y',18));
      for(const s of [-1,1]){
        g.add(box(0.05,0.11,0.12,lamp(),0.19,0.66,s*(bw/2-0.14)));               // faróis
        g.add(box(0.05,0.10,0.10,red(),-L-0.70,0.86,s*(bw/2-0.12)));             // lanternas
        g.add(box(0.04,0.04,0.12,amber(),0.19,0.84,s*(bw/2-0.12)));              // pisca
      }
      g.add(cyl(0.05,0.06,dark(),-L-0.70,0.70,0,'x',14));                       // alarme de ré
      g.add(cyl(0.04,0.04,amber(),-1.24,gy+0.06,0.0,'y',14));
    });

    // ---- 13 mastro ----
    def('mastro',g=>{
      const stages=[{x:0.08,w:0.12,z0:0.12,top:MH,m:dark()},{x:0.18,w:0.085,z0:0.27,top:MH,m:dark()},{x:0.255,w:0.075,z0:0.42,top:MH,m:new THREE.MeshStandardMaterial({color:0x7B8590,metalness:.7,roughness:.4})}];
      const inner=[];
      for(let k=0;k<stages.length;k++){
        const st=stages[k]; const grp=new THREE.Group(); grp.name='stage'+k; grp.userData.base=0;
        for(const s of [-1,1]){
          const h=st.top-st.z0; grp.add(box(st.w,h,0.07,st.m,st.x,st.z0+h/2,s*(T.T*0.46)));
          grp.add(box(st.w*0.4,h,0.10,st.m,st.x+st.w*0.2,st.z0+h/2,s*(T.T*0.46)));   // aba do perfil I
        }
        grp.add(box(st.w*0.9,0.07,T.T*0.92,black(),st.x,st.top-0.03,0));            // travessa superior
        grp.add(box(st.w*0.9,0.06,T.T*0.92,black(),st.x,st.z0+0.18,0));              // travessa inferior
        g.add(grp); inner.push(grp);
      }
      g.userData.stages=inner;
    });

    // ---- 14 cilindros hidráulicos ----
    def('cilindros',g=>{
      const lift=new THREE.Group(); lift.name='liftcyl';
      lift.add(cyl(0.05,1.5,dark(),0.13,0.9,0,'y',20));
      const rod=cyl(0.032,1.6,steel(),0.13,1.0,0,'y',16); rod.name='rod'; lift.add(rod);
      g.add(lift); g.userData.rod=rod;
      for(const s of [-1,1]){
        const A=new THREE.Vector3(-0.20,0.66,s*(T.T*0.30)), B=new THREE.Vector3(0.05,1.02,s*(T.T*0.34));
        const mid=A.clone().lerp(B,0.5);
        g.add(cylBetween(A,mid,0.045,dark(),16)); g.add(cylBetween(mid,B,0.026,steel(),12));
        g.add(mesh(new THREE.SphereGeometry(0.04,12,10),steel(),A.x,A.y,A.z)); g.add(mesh(new THREE.SphereGeometry(0.04,12,10),steel(),B.x,B.y,B.z));
      }
    });

    // ---- 15 carro porta-garfos e correntes ----
    def('carro',g=>{
      const grp=new THREE.Group(); grp.name='carriage';
      grp.add(box(0.14,0.46,T.T*0.92,dark(),0.34,0.20,0));
      grp.add(box(0.10,0.05,T.T*0.95,steel(),0.35,0.45,0));                       // barra superior
      grp.add(box(0.10,0.05,T.T*0.95,steel(),0.35,-0.03,0));                      // barra inferior (apoio dos garfos)
      for(const s of [-1,1]) for(const zz of [0.02,0.30]) grp.add(cyl(0.032,0.07,steel(),0.27,zz,s*(T.T*0.40),'z',14));   // roletes
      for(const s of [-1,1]){const ch=box(0.012,1.2,0.03,black(),0.30,0.90,s*0.12); ch.name='chain'; grp.add(ch);}
      g.add(grp); g.userData.carriage=grp;
    });

    // ---- 16 garfos ----
    def('garfos',g=>{
      const grp=new THREE.Group(); grp.name='forks';
      const s=new THREE.Shape(); s.moveTo(a-0.075,0.32); s.lineTo(a-0.005,0.32); s.lineTo(a-0.005,0.012); s.lineTo(a+FK-0.03,0.012);
      s.quadraticCurveTo(a+FK+0.012,0.006,a+FK+0.012,-0.022); s.lineTo(a+FK-0.30,-0.042); s.lineTo(a+0.01,-0.058); s.quadraticCurveTo(a-0.075,-0.06,a-0.075,-0.02); s.closePath();
      for(const sd of [-1,1]){
        const m=extrudeProfile(s,0.12,new THREE.MeshStandardMaterial({color:0xB4BCC6,metalness:.85,roughness:.3}),.008); m.position.z=sd*T.T*0.30; grp.add(m);}
      g.add(grp); g.userData.forks=grp;
    });

    // ---- 17 espaldar ----
    def('espaldar',g=>{
      const grp=new THREE.Group(); grp.name='backrest';
      const w=T.T*0.92, h=1.1;
      for(let i=0;i<9;i++) grp.add(box(0.05,h,0.035,dark(),a-0.07,0.015+h/2,-w/2+i*w/8));
      for(let i=0;i<7;i++) grp.add(box(0.05,0.035,w,dark(),a-0.07,0.03+i*(h-0.05)/6,0));
      grp.add(box(0.06,0.05,w+0.04,steel(),a-0.075,h+0.03,0));
      g.add(grp); g.userData.backrest=grp;
    });

    return P;
  }

  /* ---------- carga (pallet + caixas) ---------- */
  function buildLoad(Lc,Wc,Hc){
    const g=new THREE.Group(); const ph=0.15;
    g.add(box(Lc,0.025,Wc,wood(),Lc/2,0.0125,0));
    for(let i=0;i<3;i++) for(let j=0;j<3;j++){ const bx=0.1,bz=0.1; g.add(box(bx,0.09,bz,wood(),bx/2+(Lc-bx)*i/2,0.07,-Wc/2+bz/2+(Wc-bz)*j/2)); }
    g.add(box(Lc,0.035,Wc,wood(),Lc/2,0.1325,0));
    const gh=Math.max(0.02,Hc-ph); const cols=Math.max(1,Math.round(Lc/0.3)), rows=Math.max(1,Math.round(gh/0.22)), dep=Math.max(1,Math.round(Wc/0.4));
    const cw=Lc/cols, rh=gh/rows, dw=Wc/dep;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) for(let d=0;d<dep;d++){
      const m=cardb(); m.color.offsetHSL(0,0,((r+c+d)%2?0.03:-0.02));
      g.add(box(cw*0.985,rh*0.985,dw*0.985,m,cw*(c+.5),ph+rh*(r+.5),-Wc/2+dw*(d+.5)));
    }
    return g;
  }

  /* ---------- cena, câmera e controles orbitais ---------- */
  function createStage(canvas,opts={}){
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:false});
    renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.NoToneMapping;
    const scene=new THREE.Scene();
    const persp=new THREE.PerspectiveCamera(36,1.6,0.1,200);
    const ortho=new THREE.OrthographicCamera(-4,4,2.5,-2.5,-60,120);
    let camera=persp, bp=false;
    // luzes
    scene.add(new THREE.HemisphereLight(0xffffff,0xd6dede,0.75));
    const sun=new THREE.DirectionalLight(0xffffff,1.25); sun.position.set(-4,7,5); sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048); const sc=sun.shadow.camera; sc.left=-5; sc.right=5; sc.top=5; sc.bottom=-5; sc.near=1; sc.far=22; sun.shadow.bias=-0.0004; sun.shadow.radius=4;
    scene.add(sun);
    const fill=new THREE.DirectionalLight(0xdff4f3,0.55); fill.position.set(5,3,-4); scene.add(fill);
    // ambiente de reflexo (gradiente suave)
    const pm=new THREE.PMREMGenerator(renderer); const envScene=new THREE.Scene();
    const eg=new THREE.SphereGeometry(20,24,12), ec=document.createElement('canvas'); ec.width=4; ec.height=128; const ex=ec.getContext('2d');
    const gr=ex.createLinearGradient(0,0,0,128); gr.addColorStop(0,'#ffffff'); gr.addColorStop(.55,'#e9f0f0'); gr.addColorStop(1,'#b9c4c4'); ex.fillStyle=gr; ex.fillRect(0,0,4,128);
    envScene.add(new THREE.Mesh(eg,new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(ec),side:THREE.BackSide})));
    scene.environment=pm.fromScene(envScene,0.04).texture;
    // piso: sombra + grade de projeto
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.ShadowMaterial({opacity:0.22})); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
    const gc=document.createElement('canvas'); gc.width=gc.height=256; const gx=gc.getContext('2d');
    gx.clearRect(0,0,256,256); gx.strokeStyle='rgba(91,168,165,.42)'; gx.lineWidth=2; gx.strokeRect(0,0,256,256);
    gx.strokeStyle='rgba(91,168,165,.18)'; gx.lineWidth=1; for(let i=1;i<4;i++){gx.beginPath();gx.moveTo(i*64,0);gx.lineTo(i*64,256);gx.stroke();gx.beginPath();gx.moveTo(0,i*64);gx.lineTo(256,i*64);gx.stroke();}
    const gt=new THREE.CanvasTexture(gc); gt.wrapS=gt.wrapT=THREE.RepeatWrapping; gt.repeat.set(24,24); gt.anisotropy=4;
    const grid=new THREE.Mesh(new THREE.PlaneGeometry(24,24),new THREE.MeshBasicMaterial({map:gt,transparent:true,depthWrite:false,opacity:.9}));
    grid.rotation.x=-Math.PI/2; grid.position.y=0.002; scene.add(grid);
    // fade circular do piso
    grid.material.alphaMap=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g2=x.createRadialGradient(64,64,6,64,64,64);g2.addColorStop(0,'#fff');g2.addColorStop(.55,'#cfcfcf');g2.addColorStop(1,'#000');x.fillStyle=g2;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);})();

    // controles orbitais (arrastar = girar · roda = zoom · botão direito/shift = deslocar)
    const ctl={az:-0.75,el:0.38,dist:6.4,target:new THREE.Vector3(-0.25,0.95,0),auto:false,
      goal:null,minD:2.2,maxD:16};
    const state={drag:null,pts:new Map(),pinch:0,moved:0};
    function applyCam(){
      ctl.el=Math.max(0.02,Math.min(Math.PI/2-0.01,ctl.el)); ctl.dist=Math.max(ctl.minD,Math.min(ctl.maxD,ctl.dist));
      const r=ctl.dist, x=r*Math.cos(ctl.el)*Math.cos(ctl.az), y=r*Math.sin(ctl.el), z=r*Math.cos(ctl.el)*Math.sin(ctl.az);
      for(const c of [persp,ortho]){ c.position.set(ctl.target.x+x,ctl.target.y+y,ctl.target.z+z); c.lookAt(ctl.target); }
      if(bp){ const hh=ctl.dist*0.36, ww=hh*(persp.aspect||1.6); ortho.left=-ww; ortho.right=ww; ortho.top=hh; ortho.bottom=-hh; ortho.updateProjectionMatrix(); }
    }
    canvas.addEventListener('pointerdown',e=>{ canvas.setPointerCapture(e.pointerId); state.pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      state.drag={x:e.clientX,y:e.clientY,btn:e.button,shift:e.shiftKey}; state.moved=0; ctl.auto=false; ctl.goal=null; canvas.style.cursor='grabbing'; opts.onInteract&&opts.onInteract(); });
    canvas.addEventListener('pointermove',e=>{
      if(state.pts.has(e.pointerId)) state.pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(state.pts.size===2){ const [p,q]=[...state.pts.values()]; const d=Math.hypot(p.x-q.x,p.y-q.y); if(state.pinch) ctl.dist*=state.pinch/d; state.pinch=d; return; }
      if(!state.drag){ opts.onHover&&opts.onHover(e); return; }
      const dx=e.clientX-state.drag.x, dy=e.clientY-state.drag.y; state.drag.x=e.clientX; state.drag.y=e.clientY; state.moved+=Math.abs(dx)+Math.abs(dy);
      if(state.drag.btn===2||state.drag.shift){ const k=ctl.dist*0.0016; const right=new THREE.Vector3().setFromMatrixColumn(api.camera.matrix,0), up=new THREE.Vector3().setFromMatrixColumn(api.camera.matrix,1);
        ctl.target.addScaledVector(right,-dx*k).addScaledVector(up,dy*k); ctl.target.y=Math.max(0,ctl.target.y); }
      else { ctl.az-=dx*0.0075; ctl.el+=dy*0.0075; }
    });
    const up=e=>{ state.pts.delete(e.pointerId); state.pinch=0; if(!state.pts.size){ const wasClick=state.moved<5; state.drag=null; canvas.style.cursor='grab'; if(wasClick&&opts.onClick) opts.onClick(e); } };
    canvas.addEventListener('pointerup',up); canvas.addEventListener('pointercancel',up);
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('wheel',e=>{ e.preventDefault(); ctl.dist*=Math.exp(e.deltaY*0.0012); ctl.goal=null; },{passive:false});
    canvas.addEventListener('dblclick',()=>view('iso'));
    canvas.style.touchAction='none'; canvas.style.cursor='grab';

    const VIEWS={iso:{az:-0.75,el:0.38},side:{az:Math.PI/2,el:0.03},front:{az:0,el:0.05},back:{az:Math.PI,el:0.05},top:{az:Math.PI/2,el:Math.PI/2-0.02}};
    // az=PI/2 -> câmera em +Z olhando a lateral direita; front: câmera em +X
    function view(name,instant){ const v=VIEWS[name]; if(!v) return; ctl.auto=false;
      ctl.goal={az:nearestAz(v.az),el:v.el,dist:name==='iso'?6.4:(name==='top'?6.8:6.6),target:new THREE.Vector3(-0.25,name==='top'?0:(bp?0.62:0.95),0)}; if(instant){Object.assign(ctl,{az:ctl.goal.az,el:ctl.goal.el,dist:ctl.goal.dist}); ctl.target.copy(ctl.goal.target); ctl.goal=null;} }
    function nearestAz(t){ const tau=Math.PI*2; let d=((t-ctl.az)%tau+tau)%tau; if(d>Math.PI) d-=tau; return ctl.az+d; }
    function resize(){ const r=canvas.getBoundingClientRect(); const w=Math.max(10,r.width), h=Math.max(10,r.height);
      if(canvas.__w!==w||canvas.__h!==h){ canvas.__w=w; canvas.__h=h; renderer.setSize(w,h,false); persp.aspect=w/h; persp.updateProjectionMatrix(); applyCam(); } }
    function step(dt){
      if(ctl.goal){ const k=1-Math.exp(-dt*5); ctl.az+=(ctl.goal.az-ctl.az)*k; ctl.el+=(ctl.goal.el-ctl.el)*k; ctl.dist+=(ctl.goal.dist-ctl.dist)*k; ctl.target.lerp(ctl.goal.target,k);
        if(Math.abs(ctl.goal.az-ctl.az)+Math.abs(ctl.goal.el-ctl.el)+Math.abs(ctl.goal.dist-ctl.dist)<0.002) ctl.goal=null; }
      if(ctl.auto) ctl.az+=dt*0.35;
      applyCam();
    }
    function render(){ resize(); renderer.render(scene,api.camera); }
    function project(v3,out){ const v=v3.clone().project(api.camera); const w=canvas.__w||1,h=canvas.__h||1; out.x=(v.x*0.5+0.5)*w; out.y=(-v.y*0.5+0.5)*h; out.z=v.z; return out; }
    function setBlueprint(on){ bp=on; api.camera=on?ortho:persp; camera=api.camera; sun.castShadow=!on; applyCam(); }
    applyCam();
    const api={renderer,scene,camera,ctl,ground,grid,gridTex:gt,sun,view,step,render,resize,project,canvas,applyCam,setBlueprint};
    return api;
  }

  /* converte ponto da simulação (x frente, y esquerda, z altura) para Three */
  const S2T=(x,y,z)=>new THREE.Vector3(x,z,-y);

  return {build,buildLoad,createStage,S2T,mesh,box,cyl,cylBetween,addAll,TURQ,LIME};
})();
