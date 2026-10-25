"use strict";
import * as CHS from "./chantiers.js";
import { interiorPoly, polyArea, pointInPoly, labelPoint } from "./walls/rooms.js";
// ---------- chantier ouvert ----------
// Un seul chantier est chargé à la fois ; changer de chantier recharge la page (état propre, annuler/rétablir compris).
const CH=CHS.current();
let FOND=CH.fond&&CH.fond.src==="asset"?CH.fond.url:"";   // image du fond (URL) ; chargée depuis IndexedDB sinon
let BG=CH.fond?{x:CH.fond.x,y:CH.fond.y,w:CH.fond.w,h:CH.fond.h}:{x:0,y:0,w:0,h:0};
let calib=null;                                               // mise à l'échelle en cours : {a,b,cur}
let preview=null;                                             // aperçu d'un relevé automatique : {nodes, walls, openings} | {rooms} | {devices, links, unknown}
const PLAN={w:16,h:11};

// ---------- modèle ----------
let NID=0,SID=0,AID=0,RID=0,OID=0,DID=0;
const state={nodes:[],segs:[],rooms:[],app:[],lia:[],openings:[],dims:[],wallEp:0.20};
const layers={fond:{on:true,lock:false},pieces:{on:true,lock:false},murs:{on:true,lock:false},
  ouvertures:{on:true,lock:false},appareils:{on:true,lock:false},liaisons:{on:true,lock:false},cotes:{on:true,lock:false}};
const TYPES={
 PC16:{n:"Prise 16 A",h:30,r:"P"}, PC20:{n:"Prise 20 A",h:30,r:"P"}, RJ45:{n:"RJ45",h:30,r:"R"},
 LUM:{n:"Point lumineux",h:null,r:"L"}, SPOT:{n:"Spot",h:null,r:"L"}, INT:{n:"Interrupteur",h:110,r:"I"},
 VV:{n:"Va-et-vient",h:110,r:"I"}, BP:{n:"Bouton poussoir",h:110,r:"BP"}, VMC:{n:"VMC",h:null,r:"V"}, TAB:{n:"Tableau",h:null,r:"TD"},
 SC:{n:"Sortie de câble",h:null,r:"SC"},
};
const PAL=["PC16","PC20","RJ45","LUM","SPOT","INT","VV","BP","VMC","SC","TAB"];

let tool="piece", sel=null, testMode=false, tab="plan";
let draftFrom=null, draftPt=null, typed="", roomDraft=null, dimDraft=null;
let showDims=true, showReps=true;
let bgLevel=0.60, symCm=20, ortho=true, gridM=0.05;
let view={cx:PLAN.w/2,cy:PLAN.h/2,scale:1};
const VB={w:100,h:70};
let dirty=false; const undo=[],redo=[];
let clip=null, lastW={x:PLAN.w/2,y:PLAN.h/2};

const symScaleOf=()=>symCm/180;
const uidN=()=>"n"+(++NID),uidS=()=>"s"+(++SID),uidA=()=>"a"+(++AID),uidR=()=>"r"+(++RID),uidO=()=>"o"+(++OID),uidD=()=>"d"+(++DID);
function node(x,y){const n={id:uidN(),x:+x.toFixed(3),y:+y.toFixed(3)};state.nodes.push(n);return n}
function nodeById(id){return state.nodes.find(n=>n.id===id)}
function segById(id){return state.segs.find(s=>s.id===id)}
const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
// épaisseur d'un mur : la sienne (murs relevés du PDF) sinon l'épaisseur par défaut du chantier
const epOf=s=>s&&s.ep>0?s.ep:state.wallEp;
// demi-épaisseur des AUTRES murs qui arrivent à un sommet (pour mesurer depuis la face intérieure)
const cornerHalf=(nodeId,exceptId)=>{let m=0;state.segs.forEach(s=>{if(s.id!==exceptId&&(s.a===nodeId||s.b===nodeId))m=Math.max(m,epOf(s));});return m/2;};
function segLen(s){const a=nodeById(s.a),b=nodeById(s.b);return a&&b?dist(a.x,a.y,b.x,b.y):0}
function segDir(s){const a=nodeById(s.a),b=nodeById(s.b),L=segLen(s)||1;return {ux:(b.x-a.x)/L,uy:(b.y-a.y)/L,a,b,L}}

// ---------- historique / persistance ----------
function packState(){return JSON.stringify({nodes:state.nodes,segs:state.segs,rooms:state.rooms,app:state.app,lia:state.lia,openings:state.openings,dims:state.dims,wallEp:state.wallEp})}
function snapshot(){undo.push(packState());if(undo.length>80)undo.shift();redo.length=0}
function applyPack(s){const o=JSON.parse(s);["nodes","segs","rooms","app","lia","openings","dims"].forEach(k=>state[k]=o[k]||[]);if(o.wallEp)state.wallEp=o.wallEp;sel=null}
const KEY=CH.key;
let saveT=null;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{try{
  localStorage.setItem(KEY,JSON.stringify({s:packState(),view,bg:bgLevel,sym:symCm,ortho,dims:showDims,reps:showReps,layers}));dirty=false;paintStatus();
  CHS.update(CH.id,{updated:Date.now(),stats:{pieces:state.rooms.length,murs:state.segs.length,appareils:state.app.length}});
}catch(e){}},400)}
function load(){try{const r=localStorage.getItem(KEY);if(!r)return;const o=JSON.parse(r);
  if(o.s)applyPack(o.s); if(o.view)view=o.view;
  if(typeof o.bg==="number")bgLevel=o.bg; if(typeof o.sym==="number")symCm=o.sym;
  if(typeof o.ortho==="boolean")ortho=o.ortho; if(typeof o.dims==="boolean")showDims=o.dims;
  if(typeof o.reps==="boolean")showReps=o.reps; if(o.layers)Object.assign(layers,o.layers);
  state.nodes.forEach(n=>{const k=+String(n.id).slice(1);if(k>NID)NID=k});
  state.segs.forEach(s=>{const k=+String(s.id).slice(1);if(k>SID)SID=k});
  state.app.forEach(a=>{const k=+String(a.id).slice(1);if(k>AID)AID=k});
  state.rooms.forEach(r=>{const k=+String(r.id).slice(1);if(k>RID)RID=k});
  state.openings.forEach(o2=>{const k=+String(o2.id).slice(1);if(k>OID)OID=k});
  state.dims.forEach(d=>{const k=+String(d.id).slice(1);if(k>DID)DID=k});
}catch(e){}}
function markDirty(){dirty=true;save();paintStatus()}
function paintStatus(){const d=document.getElementById("savedot"),t=document.getElementById("savetxt");
  if(dirty){d.classList.add("dirty");t.textContent="Non synchronisé";}else{d.classList.remove("dirty");t.textContent="Enregistré";}}

// ---------- vue ----------
// la zone de dessin prend exactement les proportions de l'écran : pas de bandes, pas de décalage entre clic et affichage
function syncVB(){const R=sv.getBoundingClientRect();if(R.width>0&&R.height>0){VB.h=70;VB.w=70*R.width/R.height;sv.setAttribute("viewBox","0 0 "+VB.w+" "+VB.h);}}
function fit(){syncVB();let pts=[...state.nodes,...state.app];
  if(!pts.length&&FOND&&BG.w>0)pts=[{x:BG.x,y:BG.y},{x:BG.x+BG.w,y:BG.y+BG.h}];   // chantier vide : cadrer le fond
  const bb=pts.length?bbox(pts):null;
  const w=bb?Math.max(2,bb.x1-bb.x0):PLAN.w,h=bb?Math.max(2,bb.y1-bb.y0):PLAN.h,pad=1.0;
  view.scale=Math.min(VB.w/(w+pad*2),VB.h/(h+pad*2));view.cx=bb?bb.cx:PLAN.w/2;view.cy=bb?bb.cy:PLAN.h/2;draw();}
function V2W(vx,vy){return [view.cx+(vx-VB.w/2)/view.scale,view.cy+(vy-VB.h/2)/view.scale]}
function W2V(x,y){return [VB.w/2+(x-view.cx)*view.scale,VB.h/2+(y-view.cy)*view.scale]}
function evWorld(e){const ctm=sv.getScreenCTM();if(!ctm)return [0,0];const p=sv.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const v=p.matrixTransform(ctm.inverse());return V2W(v.x,v.y);}
function pxPerVB(){const r=sv.getBoundingClientRect();return Math.min(r.width/VB.w,r.height/VB.h)||1;}
function tolM(){return 12/pxPerVB()/view.scale}

// ---------- accrochage ----------
function snapWorld(wx,wy,excl){const tol=tolM();let best=null,bd=tol;
  for(const n of state.nodes){if(excl&&n.id===excl)continue;const d=dist(wx,wy,n.x,n.y);if(d<bd){bd=d;best={x:n.x,y:n.y,node:n.id,kind:"nœud"};}}
  if(best)return best;
  const gx=Math.round(wx/gridM)*gridM,gy=Math.round(wy/gridM)*gridM;return {x:+gx.toFixed(3),y:+gy.toFixed(3),node:null,kind:"grille"};}
function applyOrtho(fx,fy,wx,wy){if(!ortho)return [wx,wy];return (Math.abs(wx-fx)>=Math.abs(wy-fy))?[wx,fy]:[fx,wy];}

// ---------- repères auto ----------
function repMap(){const m={},c={};
  state.app.forEach(a=>{const fam=TYPES[a.t].r;c[fam]=(c[fam]||0)+1;m[a.id]=fam+c[fam];});return m;}

// ---------- rendu ----------
const sv=document.getElementById("sv");
function glyph(t){switch(t){
  case"PC16":return `<circle r="0.9" class="gy"/><text y="0.3" class="gl">16</text>`;
  case"PC20":return `<circle r="0.9" class="gf"/><text y="0.3" class="glw">20</text>`;
  case"RJ45":return `<rect x="-0.8" y="-0.8" width="1.6" height="1.6" rx="0.2" class="gy"/><text y="0.3" class="gl">RJ</text>`;
  case"LUM":return `<circle r="0.9" class="gy"/><path d="M-0.6 -0.6L0.6 0.6M0.6 -0.6L-0.6 0.6" class="gs"/>`;
  case"SPOT":return `<circle r="0.6" class="gy"/><circle r="0.22" class="gf"/>`;
  case"INT":return `<circle r="0.55" class="gy"/><line x1="0.35" y1="-0.35" x2="0.95" y2="-0.95" class="gs"/>`;
  case"VV":return `<circle r="0.55" class="gy"/><line x1="0.35" y1="-0.35" x2="0.95" y2="-0.95" class="gs"/><line x1="-0.1" y1="0.3" x2="0.5" y2="-0.3" class="gs"/>`;
  case"BP":return `<circle r="0.55" class="gy"/><circle r="0.2" class="gf"/>`;
  case"VMC":return `<rect x="-0.8" y="-0.8" width="1.6" height="1.6" rx="0.3" class="gy"/><text y="0.3" class="gl">V</text>`;
  case"SC":return `<circle r="0.6" class="gy"/><path d="M-0.85 -0.85L0.85 0.85M0.85 -0.85L-0.85 0.85" class="gs"/>`;
  case"TAB":return `<rect x="-1" y="-1.2" width="2" height="2.4" rx="0.2" class="gf"/><text y="0.3" class="glw">TD</text>`;
 } return `<circle r="0.8" class="gy"/>`;}
function lightsOn(cid){const s=new Set();state.lia.filter(x=>x.c===cid).forEach(x=>s.add(x.l));return s}

// intervalles pleins d'un mur en retirant les ouvertures
function wallIntervals(seg){const L=segLen(seg);const ops=state.openings.filter(o=>o.seg===seg.id).map(o=>[o.t-o.w/2,o.t+o.w/2]).sort((a,b)=>a[0]-b[0]);
  const out=[];let cur=0;ops.forEach(([s,e])=>{if(s>cur)out.push([cur,Math.min(s,L)]);cur=Math.max(cur,e);});
  if(cur<L)out.push([cur,L]);return out;}

function draw(){
 syncVB();followWalls();
 const s=view.scale,[bx,by]=W2V(BG.x,BG.y),ep=state.wallEp;
 let h=`<style>
  .gy{fill:var(--panel);stroke:var(--accent);stroke-width:.14}.gf{fill:var(--accent);stroke:var(--accent);stroke-width:.14}
  .gs{stroke:var(--accent);stroke-width:.16;fill:none}.gl{fill:var(--accent);font:600 .75px var(--fm);text-anchor:middle}
  .glw{fill:#fff;font:600 .7px var(--fm);text-anchor:middle}</style>`;
 if(bgLevel>0&&layers.fond.on&&FOND)h+=`<image href="${FOND}" x="${bx}" y="${by}" width="${BG.w*s}" height="${BG.h*s}" opacity="${bgLevel}" preserveAspectRatio="none"/>`;
 const g=1*s;
 if(g>6){let gl="";for(let x=((0-view.cx)*s+VB.w/2)%g;x<VB.w;x+=g)gl+=`<line x1="${x}" y1="0" x2="${x}" y2="${VB.h}"/>`;
  for(let y=((0-view.cy)*s+VB.h/2)%g;y<VB.h;y+=g)gl+=`<line x1="0" y1="${y}" x2="${VB.w}" y2="${y}"/>`;
  h+=`<g stroke="var(--grid)" stroke-width=".4">${gl}</g>`;}
 h+=`<g transform="translate(${VB.w/2} ${VB.h/2}) scale(${s}) translate(${-view.cx} ${-view.cy})">`;
 // groupe sélectionné (sélection multiple ou pièce) : ce qui bougera
 const GH=(multi.size>1||(sel&&sel.kind==="room"))?currentGroup():null;
 // pièces
 if(layers.pieces.on){let rf="";state.rooms.forEach(r=>{const on=isSel("room",r.id)||(GH&&GH.rooms.has(r.id));
   rf+=`<polygon points="${roomPoly(r).map(p=>p.x+","+p.y).join(" ")}" fill="var(--accent)" opacity="${on?0.14:0.07}"/>`;});h+=`<g>${rf}</g>`;}
 // murs (intervalles pleins) + jonctions
 if(layers.murs.on){let mp="",jn="";
  state.segs.forEach(seg=>{const d=segDir(seg);if(!d.a)return;const on=(sel&&(sel.kind==="seg"||sel.kind==="segDelAsk")&&sel.id===seg.id)||(GH&&GH.nodes.has(seg.a)&&GH.nodes.has(seg.b));const col=on?'var(--sel)':'var(--wall)';
    const e2=epOf(seg)/2,nx=-d.uy*e2,ny=d.ux*e2;
    wallIntervals(seg).forEach(([s0,s1])=>{const ax=d.a.x+d.ux*s0,ay=d.a.y+d.uy*s0,bxp=d.a.x+d.ux*s1,byp=d.a.y+d.uy*s1;
      mp+=`<polygon points="${ax+nx},${ay+ny} ${bxp+nx},${byp+ny} ${bxp-nx},${byp-ny} ${ax-nx},${ay-ny}" fill="${col}"/>`;});});
  state.nodes.forEach(n=>{let e=0;state.segs.forEach(s=>{if(s.a===n.id||s.b===n.id)e=Math.max(e,epOf(s));});if(e>0)jn+=`<rect x="${n.x-e/2}" y="${n.y-e/2}" width="${e}" height="${e}" fill="var(--wall)"/>`;});
  h+=`<g>${jn}${mp}</g>`;}
 // ouvertures (portes/fenêtres)
 if(layers.ouvertures.on){let op="";state.openings.forEach(o=>{const seg=segById(o.seg);if(!seg)return;const d=segDir(seg);
   const cx=d.a.x+d.ux*o.t,cy=d.a.y+d.uy*o.t,nx=-d.uy,ny=d.ux;const hw=o.w/2,ep=epOf(seg);
   const on=isSel("open",o.id)||(GH&&GH.opens.has(o.id));const c=on?'var(--sel)':'var(--accent2)';
   const j1x=cx-d.ux*hw,j1y=cy-d.uy*hw,j2x=cx+d.ux*hw,j2y=cy+d.uy*hw;
   if(o.kind==="fenetre"){op+=`<line x1="${j1x+nx*ep/2}" y1="${j1y+ny*ep/2}" x2="${j2x+nx*ep/2}" y2="${j2y+ny*ep/2}" stroke="${c}" stroke-width="0.04"/>`;
     op+=`<line x1="${j1x-nx*ep/2}" y1="${j1y-ny*ep/2}" x2="${j2x-nx*ep/2}" y2="${j2y-ny*ep/2}" stroke="${c}" stroke-width="0.04"/>`;
     op+=`<line x1="${(j1x+j2x)/2+nx*ep/2}" y1="${(j1y+j2y)/2+ny*ep/2}" x2="${(j1x+j2x)/2-nx*ep/2}" y2="${(j1y+j2y)/2-ny*ep/2}" stroke="${c}" stroke-width="0.03" opacity="0.6"/>`;
   } else { // porte : gond à une extrémité, battant + arc
     const sdir=o.swing==="ext"?1:-1, hinge=o.hinge==="d"?1:-1;
     const hx=o.hinge==="d"?j2x:j1x, hy=o.hinge==="d"?j2y:j1y;
     // battant ouvert ~ perpendiculaire
     const lx=hx+nx*sdir*o.w, ly=hy+ny*sdir*o.w;
     op+=`<line x1="${hx}" y1="${hy}" x2="${lx}" y2="${ly}" stroke="${c}" stroke-width="0.04"/>`;
     // arc du battant (quart de cercle)
     const fx=o.hinge==="d"?j1x:j2x, fy=o.hinge==="d"?j1y:j2y;
     op+=`<path d="M ${lx} ${ly} A ${o.w} ${o.w} 0 0 ${hinge*sdir>0?1:0} ${fx} ${fy}" fill="none" stroke="${c}" stroke-width="0.03" opacity="0.7"/>`;
   }
   if(isSel("open",o.id))op+=`<circle cx="${cx}" cy="${cy}" r="${hw+0.15}" fill="none" stroke="var(--sel)" stroke-width="0.05" stroke-dasharray="0.3 0.2"/>`;
 });h+=`<g>${op}</g>`;}
 // aperçus
 if(tool==="mur"&&draftFrom&&draftPt){const f=nodeById(draftFrom);if(f)h+=`<line x1="${f.x}" y1="${f.y}" x2="${draftPt.x}" y2="${draftPt.y}" stroke="var(--accent)" stroke-width="${ep}" stroke-linecap="round" opacity=".5"/>`;}
 if(tool==="piece"&&roomDraft){const x=Math.min(roomDraft.x0,roomDraft.x1),y=Math.min(roomDraft.y0,roomDraft.y1),w=Math.abs(roomDraft.x1-roomDraft.x0),hh=Math.abs(roomDraft.y1-roomDraft.y0);
   h+=`<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="var(--accent)" opacity=".1" stroke="var(--accent)" stroke-width="${ep}" stroke-dasharray="0.3 0.2"/>`;}
 if((tool==="cote")&&dimDraft&&draftPt){h+=`<line x1="${dimDraft.x}" y1="${dimDraft.y}" x2="${draftPt.x}" y2="${draftPt.y}" stroke="var(--dimc)" stroke-width="0.05" stroke-dasharray="0.2 0.15"/>`;}
 // cotes permanentes sur murs
 if(showDims&&layers.cotes.on&&layers.murs.on){let dm="";state.segs.forEach(seg=>{const d=segDir(seg);if(!d.a)return;const L=d.L;
   const mx=(d.a.x+d.b.x)/2,my=(d.a.y+d.b.y)/2,ox=-d.uy*(ep/2+0.22),oy=d.ux*(ep/2+0.22);
   dm+=`<text x="${mx+ox}" y="${my+oy}" text-anchor="middle" dominant-baseline="middle" fill="var(--mut)" font-size="0.3" font-family="var(--fm)">${L.toFixed(2)}</text>`;});h+=`<g>${dm}</g>`;}
 // cotes libres
 if(layers.cotes.on){let fd="";state.dims.forEach(dd=>{const on=isSel("dim",dd.id)||(GH&&GH.dims.has(dd.id));const c=on?'var(--sel)':'var(--dimc)';
   const L=dist(dd.a.x,dd.a.y,dd.b.x,dd.b.y);const mx=(dd.a.x+dd.b.x)/2,my=(dd.a.y+dd.b.y)/2;
   const ux=(dd.b.x-dd.a.x)/(L||1),uy=(dd.b.y-dd.a.y)/(L||1),nx=-uy,ny=ux;
   fd+=`<line x1="${dd.a.x}" y1="${dd.a.y}" x2="${dd.b.x}" y2="${dd.b.y}" stroke="${c}" stroke-width="0.04"/>`;
   fd+=`<line x1="${dd.a.x-nx*0.1}" y1="${dd.a.y-ny*0.1}" x2="${dd.a.x+nx*0.1}" y2="${dd.a.y+ny*0.1}" stroke="${c}" stroke-width="0.04"/>`;
   fd+=`<line x1="${dd.b.x-nx*0.1}" y1="${dd.b.y-ny*0.1}" x2="${dd.b.x+nx*0.1}" y2="${dd.b.y+ny*0.1}" stroke="${c}" stroke-width="0.04"/>`;
   fd+=`<text x="${mx+nx*0.25}" y="${my+ny*0.25}" text-anchor="middle" dominant-baseline="middle" fill="${c}" font-size="0.34" font-family="var(--fm)">${L.toFixed(2)}</text>`;});h+=`<g>${fd}</g>`;}
 // noms + aires pièces
 if(layers.pieces.on){let rl="";state.rooms.forEach(r=>{const lp=r.poly?labelPoint(r.poly):{x:(r.x0+r.x1)/2,y:(r.y0+r.y1)/2},cx=lp.x,cy=lp.y,ar=roomArea(r);
   rl+=`<text x="${cx}" y="${cy-0.15}" text-anchor="middle" fill="var(--fg)" font-size="0.5" font-family="var(--ff)">${r.name}</text>`;
   rl+=`<text x="${cx}" y="${cy+0.5}" text-anchor="middle" fill="var(--mut)" font-size="0.36" font-family="var(--fm)">${ar.toFixed(1)} m²</text>`;});h+=`<g opacity="0.9">${rl}</g>`;}
 // liaisons
 if(layers.liaisons.on){const byId=Object.fromEntries(state.app.map(a=>[a.id,a]));let ll="";
   state.lia.forEach(x=>{const c=byId[x.c],l=byId[x.l];if(!c||!l)return;const mx=(c.x+l.x)/2,my=(c.y+l.y)/2-dist(c.x,c.y,l.x,l.y)*0.18,hot=testMode&&sel&&sel.id===c.id;
     ll+=`<path d="M${c.x} ${c.y} Q ${mx} ${my} ${l.x} ${l.y}" fill="none" stroke="${hot?'var(--accent2)':'var(--accent)'}" stroke-width="${hot?0.1:0.05}" opacity="${hot?0.95:0.5}"/>`;});h+=`<g>${ll}</g>`;}
 // appareils + repères
 if(layers.appareils.on){const onSet=testMode&&sel?lightsOn(sel.id):null,ss=symScaleOf(),rm=showReps?repMap():null;let ap="";
   state.app.forEach(a=>{const aSel=isSel("app",a.id)||(GH&&GH.apps.has(a.id)),lit=onSet&&onSet.has(a.id);
     ap+=`<g transform="translate(${a.x} ${a.y})"><g transform="scale(${ss})">`;
     if(lit)ap+=`<circle r="1.5" fill="var(--warn)" opacity=".5"/>`;
     if(aSel)ap+=`<circle r="1.5" fill="none" stroke="var(--sel)" stroke-width=".12" stroke-dasharray=".3 .25"/>`;
     ap+=glyph(a.t)+`</g>`;
     if(rm)ap+=`<text x="${symCm/100*0.75}" y="${-symCm/100*0.6}" fill="var(--accent2)" font-size="0.3" font-family="var(--fm)">${rm[a.id]}</text>`;
     ap+=`</g>`;});h+=`<g>${ap}</g>`;}
 // nœuds
 if((tool==="mur"||tool==="sel")&&layers.murs.on){let nn="";state.nodes.forEach(n=>{const on=isSel("node",n.id)||(GH&&GH.nodes.has(n.id));
   nn+=`<rect x="${n.x-0.09}" y="${n.y-0.09}" width="0.18" height="0.18" fill="${on?'var(--sel)':'var(--panel)'}" stroke="var(--accent)" stroke-width="0.04"/>`;});h+=`<g>${nn}</g>`;}
 // guides d'alignement
 if(guides&&guides.length){const [wx0,wy0]=V2W(0,0),[wx1,wy1]=V2W(VB.w,VB.h);let gg="";
   guides.forEach(gd=>{if(gd.v)gg+=`<line x1="${gd.at}" y1="${wy0}" x2="${gd.at}" y2="${wy1}" stroke="var(--accent2)" stroke-width="0.03" stroke-dasharray="0.2 0.15" opacity="0.8"/>`;
     else gg+=`<line x1="${wx0}" y1="${gd.at}" x2="${wx1}" y2="${gd.at}" stroke="var(--accent2)" stroke-width="0.03" stroke-dasharray="0.2 0.15" opacity="0.8"/>`;});h+=`<g>${gg}</g>`;}
 // poignées d'ouverture sélectionnée
 if(sel&&sel.kind==="open"){const so=state.openings.find(x=>x.id===sel.id);const H=so&&openHandles(so);
   if(H){[H.j1,H.j2].forEach(j=>{h+=`<circle cx="${j.x}" cy="${j.y}" r="0.12" fill="var(--panel)" stroke="var(--sel)" stroke-width="0.05"/>`;});}}
 if(draftPt&&draftPt.snap)h+=`<circle cx="${draftPt.x}" cy="${draftPt.y}" r="0.18" fill="none" stroke="var(--snap)" stroke-width="0.05"/>`;
 // cadre englobant du groupe sélectionné
 if(GH&&!drag){const bb=bbox(groupPoints(GH));if(bb){const m=0.25;h+=`<rect x="${bb.x0-m}" y="${bb.y0-m}" width="${bb.x1-bb.x0+2*m}" height="${bb.y1-bb.y0+2*m}" fill="none" stroke="var(--sel)" stroke-width="0.04" stroke-dasharray="0.25 0.18" opacity="0.8"/>`;}}
 // cadre de sélection en cours : bleu plein = entièrement dedans ; vert pointillé = touché
 if(marquee&&marquee.moved){const cr=marquee.x1<marquee.x0,x=Math.min(marquee.x0,marquee.x1),y=Math.min(marquee.y0,marquee.y1),w=Math.abs(marquee.x1-marquee.x0),hh=Math.abs(marquee.y1-marquee.y0);
   h+=`<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${cr?'var(--ok)':'var(--accent)'}" fill-opacity="0.08" stroke="${cr?'var(--ok)':'var(--accent)'}" stroke-width="0.05" ${cr?'stroke-dasharray="0.3 0.2"':''}/>`;}
 // aperçu de pose d'appareil sous le curseur
 if(ghost&&TYPES[tool]&&layers.appareils.on){const ss2=symScaleOf();h+=`<g transform="translate(${ghost.x} ${ghost.y}) scale(${ss2})" opacity="0.5">${glyph(ghost.t)}</g>`;}
 // aperçu de série
 if(seriesMode&&seriesPrev){const src=state.app.find(a=>a.id===seriesMode.src),ss2=symScaleOf();
   if(src){seriesPrev.forEach(p=>{h+=`<g transform="translate(${p.x} ${p.y}) scale(${ss2})" opacity="0.55">${glyph(src.t)}</g>`;});
     const last=seriesPrev[seriesPrev.length-1];if(last)h+=`<line x1="${src.x}" y1="${src.y}" x2="${last.x}" y2="${last.y}" stroke="var(--accent2)" stroke-width="0.03" stroke-dasharray="0.2 0.15"/>`;}}
 // aperçu du relevé automatique des murs (avant validation)
 if(preview){const P=preview;let pv="";
   (P.rooms||[]).forEach(r=>{const lp=labelPoint(r.poly);pv+=`<polygon points="${r.poly.map(p=>p.x+","+p.y).join(" ")}" fill="var(--accent2)" fill-opacity="0.16" stroke="var(--accent2)" stroke-width="0.03" stroke-dasharray="0.15 0.1"/>`+
     `<text x="${lp.x}" y="${lp.y}" text-anchor="middle" fill="var(--accent2)" font-size="0.42" font-weight="700" font-family="var(--ff)">${r.name}</text><text x="${lp.x}" y="${lp.y+0.45}" text-anchor="middle" fill="var(--accent2)" font-size="0.32" font-family="var(--fm)">${r.area.toFixed(1)} m²</text>`;});
   (P.walls||[]).forEach(w=>{const a=P.nodes[w.a],b=P.nodes[w.b];const L=dist(a.x,a.y,b.x,b.y)||1,nx=-(b.y-a.y)/L*w.ep/2,ny=(b.x-a.x)/L*w.ep/2;
     pv+=`<polygon points="${a.x+nx},${a.y+ny} ${b.x+nx},${b.y+ny} ${b.x-nx},${b.y-ny} ${a.x-nx},${a.y-ny}" fill="var(--accent2)" fill-opacity="0.5" stroke="var(--accent2)" stroke-width="0.02"/>`;});
   (P.openings||[]).forEach(o=>{const w=P.walls[o.seg],a=P.nodes[w.a],b=P.nodes[w.b];const L=dist(a.x,a.y,b.x,b.y)||1,ux=(b.x-a.x)/L,uy=(b.y-a.y)/L;
     pv+=`<line x1="${a.x+ux*(o.t-o.w/2)}" y1="${a.y+uy*(o.t-o.w/2)}" x2="${a.x+ux*(o.t+o.w/2)}" y2="${a.y+uy*(o.t+o.w/2)}" stroke="${o.kind==="porte"?"#e07b00":"var(--ok)"}" stroke-width="${Math.max(0.06,w.ep*0.8)}"/>`;});
   (P.walls?P.nodes:[]).forEach(n=>{pv+=`<circle cx="${n.x}" cy="${n.y}" r="0.05" fill="var(--accent2)"/>`;});
   if(P.devices){const D=P.devices,ss=symScaleOf();
     (P.links||[]).forEach(l=>{const c=D[l.c],m=D[l.l];if(c&&m)pv+=`<line x1="${c.x}" y1="${c.y}" x2="${m.x}" y2="${m.y}" stroke="var(--accent2)" stroke-width="0.025" stroke-dasharray="0.12 0.08" opacity="0.8"/>`;});
     D.forEach(d=>{pv+=`<circle cx="${d.x}" cy="${d.y}" r="${ss*1.25}" fill="var(--accent2)" fill-opacity="0.25" stroke="var(--accent2)" stroke-width="0.02"/><g transform="translate(${d.x} ${d.y}) scale(${ss})">${glyph(d.t)}</g>`;});
     (P.unknown||[]).forEach(u=>{pv+=`<circle cx="${u.x}" cy="${u.y}" r="${ss*0.9}" fill="none" stroke="#d33" stroke-width="0.025" stroke-dasharray="0.05 0.04"/>`;});}
   h+=`<g>${pv}</g>`;}
 // mise à l'échelle du fond : segment entre les deux points cliqués
 if(calib&&calib.a){const b=calib.b||calib.cur;const cs=0.22/Math.max(0.6,view.scale/20);
   const cross=(p)=>`<path d="M${p.x-cs} ${p.y}H${p.x+cs}M${p.x} ${p.y-cs}V${p.y+cs}" stroke="var(--accent2)" stroke-width="0.04"/><circle cx="${p.x}" cy="${p.y}" r="${cs*0.55}" fill="none" stroke="var(--accent2)" stroke-width="0.03"/>`;
   h+=cross(calib.a);if(b){h+=`<line x1="${calib.a.x}" y1="${calib.a.y}" x2="${b.x}" y2="${b.y}" stroke="var(--accent2)" stroke-width="0.05" stroke-dasharray="0.25 0.12"/>`+cross(b);}}
 h+=`</g>`;sv.innerHTML=h;
 if(typeof placeHud==="function")placeHud();
}

// ---------- hit-tests ----------
function hitNode(wx,wy){let b=null,bd=tolM();for(const n of state.nodes){const d=dist(wx,wy,n.x,n.y);if(d<bd){bd=d;b=n;}}return b;}
function hitApp(wx,wy){let b=null,bd=Math.max(tolM(),symCm/100);for(const a of state.app){const d=dist(wx,wy,a.x,a.y);if(d<bd){bd=d;b=a;}}return b;}
function segDistPt(px,py,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=px-a.x,wy=py-a.y,Lq=vx*vx+vy*vy;let t=Lq?((wx*vx+wy*vy)/Lq):0;t=Math.max(0,Math.min(1,t));return {d:dist(px,py,a.x+t*vx,a.y+t*vy),t:t*Math.sqrt(Lq)};}
function hitSeg(wx,wy){let b=null,bd=tolM(),bt=0;for(const s of state.segs){const a=nodeById(s.a),c=nodeById(s.b);if(!a||!c)continue;const r=segDistPt(wx,wy,a,c);if(r.d<bd){bd=r.d;b=s;bt=r.t;}}return b?{seg:b,t:bt}:null;}
function hitOpen(wx,wy){let b=null,bd=1e9;const tol=Math.max(tolM(),state.wallEp,...state.segs.map(epOf))+0.12;
  for(const o of state.openings){const seg=segById(o.seg);if(!seg)continue;const d=segDir(seg);
    const j1={x:d.a.x+d.ux*(o.t-o.w/2),y:d.a.y+d.uy*(o.t-o.w/2)},j2={x:d.a.x+d.ux*(o.t+o.w/2),y:d.a.y+d.uy*(o.t+o.w/2)};
    const r=segDistPt(wx,wy,j1,j2);if(r.d<tol&&r.d<bd){bd=r.d;b=o;}}return b;}
// poignées de largeur d'une ouverture sélectionnée
function openHandles(o){const seg=segById(o.seg);if(!seg)return null;const d=segDir(seg);
  return {d,j1:{x:d.a.x+d.ux*(o.t-o.w/2),y:d.a.y+d.uy*(o.t-o.w/2)},j2:{x:d.a.x+d.ux*(o.t+o.w/2),y:d.a.y+d.uy*(o.t+o.w/2)}};}
function hitOpenHandle(wx,wy,o){const H=openHandles(o);if(!H)return null;const tol=tolM()*1.2;
  if(dist(wx,wy,H.j1.x,H.j1.y)<tol)return "j1";if(dist(wx,wy,H.j2.x,H.j2.y)<tol)return "j2";return null;}
// projeter un point sur un mur -> {t,x,y,d}
function projOnSeg(wx,wy,seg){const d=segDir(seg);const t=Math.max(0,Math.min(d.L,(wx-d.a.x)*d.ux+(wy-d.a.y)*d.uy));
  return {t,x:d.a.x+d.ux*t,y:d.a.y+d.uy*t,d:dist(wx,wy,d.a.x+d.ux*t,d.a.y+d.uy*t),dir:d};}
// accrocher un appareil mural au mur le plus proche (face côté curseur)
function snapToWall(wx,wy){let best=null,bd=0.6;for(const seg of state.segs){const p=projOnSeg(wx,wy,seg);if(p.t<=0.001||p.t>=p.dir.L-0.001)continue;if(p.d<bd){bd=p.d;best={seg,p};}}
  if(!best)return null;const d=best.p.dir;const nx=-d.uy,ny=d.ux;const sideSign=((wx-d.a.x)*nx+(wy-d.a.y)*ny)>=0?1:-1;const off=epOf(best.seg)/2+0.06;
  return {x:+(best.p.x+nx*off*sideSign).toFixed(3),y:+(best.p.y+ny*off*sideSign).toFixed(3),seg:best.seg.id,wall:true};}
// guides d'alignement sur un autre appareil (même x ou même y)
let guides=[];
function snapAlign(x,y,exclId){guides=[];const tol=tolM()*0.9;let rx=x,ry=y;
  for(const a of state.app){if(a.id===exclId)continue;
    if(Math.abs(a.x-x)<tol){rx=a.x;guides.push({v:true,at:a.x});}
    if(Math.abs(a.y-y)<tol){ry=a.y;guides.push({v:false,at:a.y});}}
  return {x:rx,y:ry};}
const wallMounted=t=>["PC16","PC20","RJ45","INT","VV","BP","SC"].includes(t);

// ---------- appareils attachés à leur mur ----------
// a.wa = {e:"a"|"b", d, s} : distance d (m) depuis la FACE du mur d'angle côté e (le plus proche), côté s (±1) du mur.
// Avant chaque dessin, followWalls() replace les appareils d'après a.wa : ils suivent leur mur (déplacé, tourné,
// allongé, épaissi) et gardent leur distance à l'angle (« prise à 30 cm de l'angle » reste vrai).
function attachOf(a){const seg=segById(a.seg);if(!seg)return null;const p=projOnSeg(a.x,a.y,seg),d=p.dir;if(!d.a||!d.L)return null;
  const s=((a.x-p.x)*-d.uy+(a.y-p.y)*d.ux)>=0?1:-1;
  const dA=p.t-cornerHalf(seg.a,seg.id),dB=d.L-p.t-cornerHalf(seg.b,seg.id);
  return dA<=dB?{e:"a",d:+dA.toFixed(3),s}:{e:"b",d:+dB.toFixed(3),s};}
function attach(a){if(!a.seg){delete a.wa;return;}const w=attachOf(a);if(w)a.wa=w;else{delete a.seg;delete a.wa;}}
function posFromAttach(a){const seg=segById(a.seg);if(!seg||!a.wa)return null;const d=segDir(seg);if(!d.a||!d.L)return null;
  let t=a.wa.e==="a"?a.wa.d+cornerHalf(seg.a,seg.id):d.L-a.wa.d-cornerHalf(seg.b,seg.id);t=Math.max(0,Math.min(d.L,t));
  const off=epOf(seg)/2+0.06;
  return {x:+(d.a.x+d.ux*t-d.uy*off*a.wa.s).toFixed(3),y:+(d.a.y+d.uy*t+d.ux*off*a.wa.s).toFixed(3)};}
// pièces : rectangle (outil Pièce) ou contour de murs détecté (r.cycle → r.poly = contour intérieur, surface habitable)
const roomPoly=r=>r.poly&&r.poly.length>2?r.poly:[{x:Math.min(r.x0,r.x1),y:Math.min(r.y0,r.y1)},{x:Math.max(r.x0,r.x1),y:Math.min(r.y0,r.y1)},{x:Math.max(r.x0,r.x1),y:Math.max(r.y0,r.y1)},{x:Math.min(r.x0,r.x1),y:Math.max(r.y0,r.y1)}];
const roomArea=r=>r.poly&&r.poly.length>2?Math.abs(polyArea(r.poly)):Math.abs((r.x1-r.x0)*(r.y1-r.y0));
// le contour d'une pièce suit ses murs (déplacés, tournés, allongés, épaissis)
function followRooms(){for(const r of state.rooms){
  if(r.cycle){const P=interiorPoly(r.cycle,nodeById,segById,state.wallEp);
    if(P){r.poly=P;r.x0=Math.min(...P.map(p=>p.x));r.x1=Math.max(...P.map(p=>p.x));r.y0=Math.min(...P.map(p=>p.y));r.y1=Math.max(...P.map(p=>p.y));}
    else r.open=true;                                                      // un mur du contour a disparu : la pièce n'est plus fermée
    continue;}
  const ss=(r.segs||[]).map(segById);if(!ss.length||ss.some(s=>!s))continue;
  const ns=ss.flatMap(s=>[nodeById(s.a),nodeById(s.b)]).filter(Boolean);if(ns.length<4)continue;
  r.x0=Math.min(...ns.map(n=>n.x));r.x1=Math.max(...ns.map(n=>n.x));r.y0=Math.min(...ns.map(n=>n.y));r.y1=Math.max(...ns.map(n=>n.y));}}
function followWalls(){followRooms();for(const a of state.app){if(!a.seg)continue;
  if(!segById(a.seg)){delete a.seg;delete a.wa;continue;}                 // mur supprimé : l'appareil reste, détaché
  if(!a.wa){a.wa=attachOf(a);if(!a.wa)continue;}                          // ancien dessin : attache calculée une fois
  const p=posFromAttach(a);if(p){a.x=p.x;a.y=p.y;}}}
// raccroche un appareil mural au mur le plus proche (≤ 60 cm), sinon le détache
function reattach(a){if(!wallMounted(a.t)){delete a.seg;delete a.wa;return;}const ws=snapToWall(a.x,a.y);
  if(ws){a.seg=ws.seg;a.x=ws.x;a.y=ws.y;attach(a);}else{delete a.seg;delete a.wa;}}
// supprimer un mur : avec ses appareils, ou en les gardant (détachés)
function removeSeg(id,withApps){snapshot();
  if(withApps){const kill=new Set(state.app.filter(a=>a.seg===id).map(a=>a.id));state.app=state.app.filter(a=>!kill.has(a.id));state.lia=state.lia.filter(l=>!kill.has(l.c)&&!kill.has(l.l));}
  else state.app.forEach(a=>{if(a.seg===id){delete a.seg;delete a.wa;}});
  state.openings=state.openings.filter(o=>o.seg!==id);state.segs=state.segs.filter(x=>x.id!==id);cleanNodes();
  sel=null;markDirty();draw();showSide();}

// ---------- sélection multiple / groupes ----------
const multi=new Set();                 // clés "kind:id"
let marquee=null;                      // cadre de sélection en cours
let seriesMode=null, seriesPrev=null, seriesN=3;
let ghost=null;                        // aperçu de pose d'appareil sous le curseur
const mk=(k,id)=>k+":"+id;
function isSel(k,id){return (sel&&sel.kind===k&&sel.id===id)||multi.has(mk(k,id));}
function clearSel(){sel=null;multi.clear();}
function setSingle(k,id){multi.clear();sel={kind:k,id};}
function addKey(s){if(s.kind==="seg"){const sg=segById(s.id);if(sg){multi.add(mk("node",sg.a));multi.add(mk("node",sg.b));}}else multi.add(mk(s.kind,s.id));}
function normalizeSel(){if(multi.size===1){const key=[...multi][0];const i=key.indexOf(":");sel={kind:key.slice(0,i),id:key.slice(i+1)};multi.clear();}else if(multi.size>1)sel=null;}
function toggleMulti(k,id){
  if(multi.size===0&&sel&&["app","node","room","open","dim","seg"].includes(sel.kind)){addKey(sel);sel=null;}
  if(k==="seg"){const s=segById(id);if(s){const ka=mk("node",s.a),kb=mk("node",s.b);if(multi.has(ka)&&multi.has(kb)){multi.delete(ka);multi.delete(kb);}else{multi.add(ka);multi.add(kb);}}}
  else{const key=mk(k,id);multi.has(key)?multi.delete(key):multi.add(key);}
  normalizeSel();}
function roomAt(wx,wy){for(let i=state.rooms.length-1;i>=0;i--){const r=state.rooms[i];
  if(r.poly&&r.poly.length>2){if(pointInPoly(wx,wy,r.poly))return r;continue;}
  if(wx>=Math.min(r.x0,r.x1)&&wx<=Math.max(r.x0,r.x1)&&wy>=Math.min(r.y0,r.y1)&&wy<=Math.max(r.y0,r.y1))return r;}return null;}
function roomExpand(r,G){const ep=state.wallEp,own=new Set(),others=new Set();
  (r.segs||[]).forEach(sid=>{const s=segById(sid);if(s){own.add(s.a);own.add(s.b);}});
  state.rooms.forEach(o=>{if(o.id!==r.id)(o.segs||[]).forEach(sid=>{const s=segById(sid);if(s){others.add(s.a);others.add(s.b);}});});
  const X0=Math.min(r.x0,r.x1),X1=Math.max(r.x0,r.x1),Y0=Math.min(r.y0,r.y1),Y1=Math.max(r.y0,r.y1);
  const inR=(x,y,m)=>x>=X0-m&&x<=X1+m&&y>=Y0-m&&y<=Y1+m;
  own.forEach(id=>G.nodes.add(id));
  state.nodes.forEach(n=>{if(!own.has(n.id)&&!others.has(n.id)&&inR(n.x,n.y,r.segs?0.02:ep/2))G.nodes.add(n.id);});
  state.app.forEach(a=>{if(inR(a.x,a.y,0.02))G.apps.add(a.id);});
  state.dims.forEach(d=>{if(inR(d.a.x,d.a.y,0.02)&&inR(d.b.x,d.b.y,0.02))G.dims.add(d.id);});}
function currentGroup(){const G={nodes:new Set(),apps:new Set(),rooms:new Set(),opens:new Set(),dims:new Set()};
  const add=(k,id)=>{if(k==="node")G.nodes.add(id);else if(k==="app")G.apps.add(id);else if(k==="room")G.rooms.add(id);else if(k==="open")G.opens.add(id);else if(k==="dim")G.dims.add(id);
    else if(k==="seg"){const s=segById(id);if(s){G.nodes.add(s.a);G.nodes.add(s.b);}}};
  if(multi.size)multi.forEach(key=>{const i=key.indexOf(":");add(key.slice(0,i),key.slice(i+1));});else if(sel)add(sel.kind,sel.id);
  G.rooms.forEach(rid=>{const r=state.rooms.find(x=>x.id===rid);if(r)roomExpand(r,G);});
  state.openings.forEach(o=>{const s=segById(o.seg);if(s&&G.nodes.has(s.a)&&G.nodes.has(s.b))G.opens.add(o.id);});
  return G;}
const groupEmpty=G=>!G.nodes.size&&!G.apps.size&&!G.rooms.size&&!G.opens.size&&!G.dims.size;
function openCenter(id){const o=state.openings.find(x=>x.id===id);if(!o)return null;const s=segById(o.seg);if(!s)return null;const d=segDir(s);return {x:d.a.x+d.ux*o.t,y:d.a.y+d.uy*o.t};}
function groupPoints(G){const pts=[];G.nodes.forEach(id=>{const n=nodeById(id);if(n)pts.push(n);});
  G.apps.forEach(id=>{const a=state.app.find(x=>x.id===id);if(a)pts.push(a);});
  G.rooms.forEach(id=>{const r=state.rooms.find(x=>x.id===id);if(r)pts.push({x:r.x0,y:r.y0},{x:r.x1,y:r.y1});});
  G.dims.forEach(id=>{const d=state.dims.find(x=>x.id===id);if(d)pts.push(d.a,d.b);});
  G.opens.forEach(id=>{const c=openCenter(id);if(c)pts.push(c);});return pts;}
function bbox(pts){if(!pts.length)return null;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;pts.forEach(p=>{x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);});return {x0,y0,x1,y1,cx:(x0+x1)/2,cy:(y0+y1)/2};}
function clampOpenings(){state.openings.forEach(o=>{const s=segById(o.seg);if(!s)return;const L=segLen(s);o.w=Math.min(o.w,Math.max(0.2,L));o.t=+Math.max(o.w/2,Math.min(L-o.w/2,o.t)).toFixed(3);});}
function groupCount(G){return G.apps.size+G.rooms.size+G.dims.size+G.opens.size+state.segs.filter(s=>G.nodes.has(s.a)&&G.nodes.has(s.b)).length;}

function startGroupDrag(wx,wy,G,perp){G=G||currentGroup();if(groupEmpty(G))return false;
  const orig={nodes:{},apps:{},rooms:{},dims:{}};
  G.nodes.forEach(id=>{const n=nodeById(id);if(n)orig.nodes[id]={x:n.x,y:n.y};});
  G.apps.forEach(id=>{const a=state.app.find(x=>x.id===id);if(a)orig.apps[id]={x:a.x,y:a.y};});
  G.rooms.forEach(id=>{const r=state.rooms.find(x=>x.id===id);if(r)orig.rooms[id]={x0:r.x0,y0:r.y0,x1:r.x1,y1:r.y1};});
  G.dims.forEach(id=>{const d=state.dims.find(x=>x.id===id);if(d)orig.dims[id]={a:{...d.a},b:{...d.b}};});
  drag={kind:"group",G,orig,sx:wx,sy:wy,perp:perp||null,moved:false};return true;}
function moveGroup(wx,wy,shift){let dx=wx-drag.sx,dy=wy-drag.sy;
  if(drag.perp){let k=dx*drag.perp.x+dy*drag.perp.y;k=Math.round(k/gridM)*gridM;dx=k*drag.perp.x;dy=k*drag.perp.y;showText("Déplacement du mur : "+fmtM(Math.abs(k)));}
  else{if(shift){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0;}dx=Math.round(dx/gridM)*gridM;dy=Math.round(dy/gridM)*gridM;showText("Δ "+fmtM(dx)+" ; "+fmtM(dy));}
  const o=drag.orig;
  for(const id in o.nodes){const n=nodeById(id);if(n){n.x=+(o.nodes[id].x+dx).toFixed(3);n.y=+(o.nodes[id].y+dy).toFixed(3);}}
  for(const id in o.apps){const a=state.app.find(x=>x.id===id);if(a){a.x=+(o.apps[id].x+dx).toFixed(2);a.y=+(o.apps[id].y+dy).toFixed(2);
    if(a.seg){const s=segById(a.seg);if(!(s&&o.nodes[s.a]&&o.nodes[s.b]))reattach(a);}}}
  for(const id in o.rooms){const r=state.rooms.find(x=>x.id===id),q=o.rooms[id];if(r){r.x0=+(q.x0+dx).toFixed(3);r.x1=+(q.x1+dx).toFixed(3);r.y0=+(q.y0+dy).toFixed(3);r.y1=+(q.y1+dy).toFixed(3);}}
  for(const id in o.dims){const d=state.dims.find(x=>x.id===id),q=o.dims[id];if(d){d.a={x:q.a.x+dx,y:q.a.y+dy};d.b={x:q.b.x+dx,y:q.b.y+dy};}}
  clampOpenings();}
function transformGroup(kind){const G=currentGroup();if(groupEmpty(G))return;const bb=bbox(groupPoints(G));if(!bb)return;
  const c={x:Math.round(bb.cx/gridM)*gridM,y:Math.round(bb.cy/gridM)*gridM};
  const f={cw:(dx,dy)=>[-dy,dx],ccw:(dx,dy)=>[dy,-dx],mx:(dx,dy)=>[-dx,dy],my:(dx,dy)=>[dx,-dy]}[kind];
  const T=p=>{const [nx,ny]=f(p.x-c.x,p.y-c.y);return {x:+(c.x+nx).toFixed(3),y:+(c.y+ny).toFixed(3)};};
  snapshot();
  G.nodes.forEach(id=>{const n=nodeById(id);if(n){const p=T(n);n.x=p.x;n.y=p.y;}});
  // les appareils posés sur un mur transformé le suivent, même s'ils n'étaient pas sélectionnés (sinon une symétrie les mettrait du mauvais côté)
  const onMoved=a=>{const s=a.seg&&segById(a.seg);return !!(s&&G.nodes.has(s.a)&&G.nodes.has(s.b));};
  state.app.forEach(a=>{if(!G.apps.has(a.id)&&!onMoved(a))return;const p=T(a);a.x=+p.x.toFixed(2);a.y=+p.y.toFixed(2);
    if(a.seg){if(onMoved(a))attach(a);else reattach(a);}});
  G.rooms.forEach(id=>{const r=state.rooms.find(x=>x.id===id);if(r){const p0=T({x:r.x0,y:r.y0}),p1=T({x:r.x1,y:r.y1});r.x0=Math.min(p0.x,p1.x);r.x1=Math.max(p0.x,p1.x);r.y0=Math.min(p0.y,p1.y);r.y1=Math.max(p0.y,p1.y);}});
  G.dims.forEach(id=>{const d=state.dims.find(x=>x.id===id);if(d){d.a=T(d.a);d.b=T(d.b);}});
  if(kind==="mx"||kind==="my")G.opens.forEach(id=>{const o=state.openings.find(x=>x.id===id);if(o)o.swing=o.swing==="int"?"ext":"int";});
  clampOpenings();markDirty();draw();showSide();}
function serializeGroup(G){const segs=state.segs.filter(s=>G.nodes.has(s.a)&&G.nodes.has(s.b));const segIds=new Set(segs.map(s=>s.id));
  const data={nodes:[...G.nodes].map(nodeById).filter(Boolean).map(n=>({...n})),segs:segs.map(s=>({...s})),
    openings:state.openings.filter(o=>segIds.has(o.seg)).map(o=>({...o})),
    rooms:[...G.rooms].map(id=>state.rooms.find(r=>r.id===id)).filter(Boolean).map(r=>({...r,segs:(r.segs||[]).slice()})),
    apps:[...G.apps].map(id=>state.app.find(a=>a.id===id)).filter(Boolean).map(a=>({...a})),
    dims:[...G.dims].map(id=>state.dims.find(d=>d.id===id)).filter(Boolean).map(d=>({id:d.id,a:{...d.a},b:{...d.b}}))};
  const appIds=new Set(data.apps.map(a=>a.id));data.lia=state.lia.filter(l=>appIds.has(l.c)&&appIds.has(l.l)).map(l=>({...l}));
  const bb=bbox([...data.nodes,...data.apps,...data.rooms.flatMap(r=>[{x:r.x0,y:r.y0},{x:r.x1,y:r.y1}]),...data.dims.flatMap(d=>[d.a,d.b])]);
  data.cx=bb?bb.cx:0;data.cy=bb?bb.cy:0;return data;}
function instantiateGroup(data,dx,dy){const nm={},sm={},am={};multi.clear();sel=null;
  data.nodes.forEach(n=>{const nn=node(n.x+dx,n.y+dy);nm[n.id]=nn.id;multi.add(mk("node",nn.id));});
  data.segs.forEach(s=>{if(nm[s.a]&&nm[s.b]){const id=uidS();sm[s.id]=id;state.segs.push({...s,id,a:nm[s.a],b:nm[s.b]});}});
  data.openings.forEach(o=>{if(sm[o.seg]){const id=uidO();state.openings.push({...o,id,seg:sm[o.seg]});multi.add(mk("open",id));}});
  data.rooms.forEach(r=>{const id=uidR();const segs=(r.segs||[]).map(s=>sm[s]).filter(Boolean);
    if(r.cycle&&r.cycle.every(c=>sm[c.seg]&&nm[c.from])){state.rooms.push({id,name:r.name+" (copie)",cycle:r.cycle.map(c=>({seg:sm[c.seg],from:nm[c.from]})),poly:r.poly.map(p=>({x:p.x+dx,y:p.y+dy})),x0:r.x0+dx,y0:r.y0+dy,x1:r.x1+dx,y1:r.y1+dy,segs,auto:true});multi.add(mk("room",id));return;}
    state.rooms.push({id,name:r.name+" (copie)",x0:+(r.x0+dx).toFixed(3),y0:+(r.y0+dy).toFixed(3),x1:+(r.x1+dx).toFixed(3),y1:+(r.y1+dy).toFixed(3),segs});multi.add(mk("room",id));});
  data.apps.forEach(a=>{const id=uidA();am[a.id]=id;const na={...a,id,x:+(a.x+dx).toFixed(2),y:+(a.y+dy).toFixed(2)};if(na.seg)na.seg=sm[na.seg];if(!na.seg){delete na.seg;delete na.wa;}state.app.push(na);multi.add(mk("app",id));});
  data.lia.forEach(l=>{if(am[l.c]&&am[l.l])state.lia.push({c:am[l.c],l:am[l.l]});});
  data.dims.forEach(d=>{const id=uidD();state.dims.push({id,a:{x:d.a.x+dx,y:d.a.y+dy},b:{x:d.b.x+dx,y:d.b.y+dy}});multi.add(mk("dim",id));});
  normalizeSel();}
function duplicateGroup(){const G=currentGroup();if(groupEmpty(G))return;snapshot();instantiateGroup(serializeGroup(G),0.5,0.5);markDirty();draw();showSide();}
function deleteGroup(G){snapshot();
  const segKill=new Set(state.segs.filter(s=>G.nodes.has(s.a)||G.nodes.has(s.b)).map(s=>s.id));
  state.openings=state.openings.filter(o=>!G.opens.has(o.id)&&!segKill.has(o.seg));
  state.segs=state.segs.filter(s=>!segKill.has(s.id));
  state.nodes=state.nodes.filter(n=>!G.nodes.has(n.id));cleanNodes();
  state.rooms=state.rooms.filter(r=>!G.rooms.has(r.id));
  state.app=state.app.filter(a=>!G.apps.has(a.id));state.lia=state.lia.filter(l=>!G.apps.has(l.c)&&!G.apps.has(l.l));
  state.dims=state.dims.filter(d=>!G.dims.has(d.id));
  clearSel();markDirty();draw();showSide();}
function selectAll(){multi.clear();sel=null;
  if(layers.appareils.on&&!layers.appareils.lock)state.app.forEach(a=>multi.add(mk("app",a.id)));
  if(layers.murs.on&&!layers.murs.lock)state.nodes.forEach(n=>multi.add(mk("node",n.id)));
  if(layers.pieces.on&&!layers.pieces.lock)state.rooms.forEach(r=>multi.add(mk("room",r.id)));
  if(layers.cotes.on&&!layers.cotes.lock)state.dims.forEach(d=>multi.add(mk("dim",d.id)));
  normalizeSel();draw();showSide();}
function segInter(p1,p2,p3,p4){const d=(p2.x-p1.x)*(p4.y-p3.y)-(p2.y-p1.y)*(p4.x-p3.x);if(Math.abs(d)<1e-12)return false;
  const t=((p3.x-p1.x)*(p4.y-p3.y)-(p3.y-p1.y)*(p4.x-p3.x))/d,u=((p3.x-p1.x)*(p2.y-p1.y)-(p3.y-p1.y)*(p2.x-p1.x))/d;return t>=0&&t<=1&&u>=0&&u<=1;}
function segRectHit(a,b,x0,y0,x1,y1){const ins=p=>p.x>=x0&&p.x<=x1&&p.y>=y0&&p.y<=y1;if(ins(a)||ins(b))return true;
  const E=[[{x:x0,y:y0},{x:x1,y:y0}],[{x:x1,y:y0},{x:x1,y:y1}],[{x:x1,y:y1},{x:x0,y:y1}],[{x:x0,y:y1},{x:x0,y:y0}]];return E.some(([p,q])=>segInter(a,b,p,q));}
// cadre : de gauche à droite = objets entièrement dedans ; de droite à gauche = objets touchés
function marqueeSelect(m){const x0=Math.min(m.x0,m.x1),x1=Math.max(m.x0,m.x1),y0=Math.min(m.y0,m.y1),y1=Math.max(m.y0,m.y1),crossing=m.x1<m.x0;
  const inside=(x,y)=>x>=x0&&x<=x1&&y>=y0&&y<=y1;
  if(!m.shift){multi.clear();sel=null;}else if(sel){addKey(sel);sel=null;}
  const add=(k,id)=>multi.add(mk(k,id));
  if(layers.appareils.on&&!layers.appareils.lock)state.app.forEach(a=>{if(inside(a.x,a.y))add("app",a.id);});
  if(layers.murs.on&&!layers.murs.lock){state.nodes.forEach(n=>{if(inside(n.x,n.y))add("node",n.id);});
    if(crossing)state.segs.forEach(s=>{const a=nodeById(s.a),b=nodeById(s.b);if(a&&b&&segRectHit(a,b,x0,y0,x1,y1)){add("node",s.a);add("node",s.b);}});}
  if(layers.pieces.on&&!layers.pieces.lock)state.rooms.forEach(r=>{const rx0=Math.min(r.x0,r.x1),rx1=Math.max(r.x0,r.x1),ry0=Math.min(r.y0,r.y1),ry1=Math.max(r.y0,r.y1);
    const full=rx0>=x0&&rx1<=x1&&ry0>=y0&&ry1<=y1,over=rx0<=x1&&rx1>=x0&&ry0<=y1&&ry1>=y0;if(crossing?over:full)add("room",r.id);});
  if(layers.cotes.on&&!layers.cotes.lock)state.dims.forEach(d=>{const ia=inside(d.a.x,d.a.y),ib=inside(d.b.x,d.b.y);if(crossing?(ia||ib):(ia&&ib))add("dim",d.id);});
  if(layers.ouvertures.on&&!layers.ouvertures.lock)state.openings.forEach(o=>{const c=openCenter(o.id);if(c&&inside(c.x,c.y))add("open",o.id);});
  normalizeSel();}
function resizeRoom(r,nw,nh){const X0=Math.min(r.x0,r.x1),X1=Math.max(r.x0,r.x1),Y0=Math.min(r.y0,r.y1),Y1=Math.max(r.y0,r.y1);
  const own=new Set();(r.segs||[]).forEach(sid=>{const s=segById(sid);if(s){own.add(s.a);own.add(s.b);}});
  own.forEach(id=>{const n=nodeById(id);if(!n)return;if(nw!=null&&Math.abs(n.x-X1)<0.01)n.x=+(X0+nw).toFixed(3);if(nh!=null&&Math.abs(n.y-Y1)<0.01)n.y=+(Y0+nh).toFixed(3);});
  r.x0=X0;r.y0=Y0;if(nw!=null)r.x1=+(X0+nw).toFixed(3);else r.x1=X1;if(nh!=null)r.y1=+(Y0+nh).toFixed(3);else r.y1=Y1;clampOpenings();}

// ---------- mesure sur mur (distance à l'angle) ----------
const fmtM=v=>(v>=0?"":"−")+Math.abs(v).toFixed(2).replace(".",",")+" m";
const fmtCm=v=>Math.round(v*100)+" cm";
function wallMeasure(segId,x,y){const seg=segById(segId);if(!seg)return null;const p=projOnSeg(x,y,seg),d=p.dir;
  const cA=cornerHalf(seg.a,seg.id),cB=cornerHalf(seg.b,seg.id),nx=-d.uy,ny=d.ux;
  const side=((x-p.x)*nx+(y-p.y)*ny)>=0?1:-1;
  return {seg,t:p.t,L:d.L,dA:Math.max(0,p.t-cA),dB:Math.max(0,d.L-p.t-cB),cA,cB,side,dir:d};}
function posOnWall(m,fromA,dm){const t=Math.max(0,Math.min(m.L,fromA?dm+m.cA:m.L-(dm+m.cB))),d=m.dir,off=epOf(m.seg)/2+0.06;
  return {x:+(d.a.x+d.ux*t-d.uy*off*m.side).toFixed(2),y:+(d.a.y+d.uy*t+d.ux*off*m.side).toFixed(2)};}
function wallText(m){const near=Math.min(m.dA,m.dB),far=Math.max(m.dA,m.dB);return fmtCm(near)+" de l'angle · "+fmtCm(far)+" de l'autre";}
function placementFor(t,wx,wy,exclId){let px=wx,py=wy,segRef=null;
  if(wallMounted(t)){const ws=snapToWall(wx,wy);if(ws){px=ws.x;py=ws.y;segRef=ws.seg;}}
  if(!segRef){const al=snapAlign(px,py,exclId);px=al.x;py=al.y;if(!guides.length){px=Math.round(px/gridM)*gridM;py=Math.round(py/gridM)*gridM;}}else guides=[];
  return {x:+px.toFixed(2),y:+py.toFixed(2),seg:segRef};}
function seriesPositions(src,end,n){const out=[];for(let i=1;i<n;i++){const f=i/(n-1);let x=src.x+(end.x-src.x)*f,y=src.y+(end.y-src.y)*f,seg=null;
  if(wallMounted(src.t)&&end.seg){const ws=snapToWall(x,y);if(ws){x=ws.x;y=ws.y;seg=ws.seg;}}out.push({x:+x.toFixed(2),y:+y.toFixed(2),seg});}return out;}
function showText(s){const r=document.getElementById("readout");r.hidden=false;r.textContent=s;}

// ---------- interactions ----------
let drag=null,pan=null;
function hitAny(wx,wy){
  if(layers.murs.on&&!layers.murs.lock){const n=hitNode(wx,wy);if(n)return {kind:"node",id:n.id,obj:n};}
  if(layers.appareils.on&&!layers.appareils.lock){const a=hitApp(wx,wy);if(a)return {kind:"app",id:a.id,obj:a};}
  if(layers.ouvertures.on&&!layers.ouvertures.lock){const o=hitOpen(wx,wy);if(o)return {kind:"open",id:o.id,obj:o};}
  if(layers.murs.on&&!layers.murs.lock){const s=hitSeg(wx,wy);if(s)return {kind:"seg",id:s.seg.id,obj:s.seg};}
  if(layers.cotes.on&&!layers.cotes.lock){for(const d of state.dims){if(segDistPt(wx,wy,d.a,d.b).d<tolM())return {kind:"dim",id:d.id,obj:d};}}
  return null;}
function inGroup(G,h){if(h.kind==="node")return G.nodes.has(h.id);if(h.kind==="app")return G.apps.has(h.id);if(h.kind==="open")return G.opens.has(h.id);
  if(h.kind==="dim")return G.dims.has(h.id);if(h.kind==="seg"){const s=segById(h.id);return s&&G.nodes.has(s.a)&&G.nodes.has(s.b);}return false;}
function placeApp(t,p){const na={id:uidA(),t,x:p.x,y:p.y,h:TYPES[t].h};if(p.seg){na.seg=p.seg;attach(na);}state.app.push(na);return na;}

sv.addEventListener("pointerdown",e=>{sv.setPointerCapture(e.pointerId);const [wx,wy]=evWorld(e);
  if(document.activeElement&&document.activeElement!==document.body&&document.activeElement.blur)document.activeElement.blur();
  if(e.button===2||e.button===1||tool==="pan"){pan={x:e.clientX,y:e.clientY,cx:view.cx,cy:view.cy};return;}
  if(seriesMode){const src=state.app.find(a=>a.id===seriesMode.src);if(src&&seriesPrev&&seriesPrev.length){snapshot();multi.clear();sel=null;multi.add(mk("app",src.id));
      seriesPrev.forEach(p=>{const na=placeApp(src.t,p);na.h=src.h;multi.add(mk("app",na.id));});normalizeSel();markDirty();}
    seriesMode=null;seriesPrev=null;hideReadout();setHint(hintFor(tool));draw();showSide();return;}
  if(tool==="calib"){
    if(!calib||calib.b){calib={a:{x:wx,y:wy},b:null,cur:null};setHint("Échelle : cliquez le second point de la cote connue.");draw();return;}
    let[bx,by]=ortho?applyOrtho(calib.a.x,calib.a.y,wx,wy):[wx,wy];if(dist(calib.a.x,calib.a.y,bx,by)<1e-6)return;
    calib.b={x:bx,y:by};hideReadout();multi.clear();sel={kind:"calibAsk"};draw();showSide();document.dispatchEvent(new CustomEvent("okteo:ask"));
    setHint("Échelle : tapez la longueur réelle de cette cote dans le panneau de droite.");return;}
  if(tool==="piece"){const p=snapWorld(wx,wy);roomDraft={x0:p.x,y0:p.y,x1:p.x,y1:p.y};return;}
  if(tool==="mur"){let p;if(draftFrom){const f=nodeById(draftFrom);let[ox,oy]=applyOrtho(f.x,f.y,wx,wy);p=snapWorld(ox,oy);}else p=snapWorld(wx,wy);
    const nd=p.node?nodeById(p.node):node(p.x,p.y);
    if(draftFrom&&draftFrom!==nd.id){snapshot();state.segs.push({id:uidS(),a:draftFrom,b:nd.id});markDirty();}
    draftFrom=nd.id;typed="";draw();return;}
  if(tool==="porte"||tool==="fenetre"){const hs=hitSeg(wx,wy);if(!hs){setHint("Cliquez sur un mur pour y insérer l'ouverture.");return;}
    snapshot();const w=tool==="porte"?0.83:1.0;const L=segLen(hs.seg);const t=Math.max(w/2,Math.min(L-w/2,hs.t));
    const o={id:uidO(),seg:hs.seg.id,t:+t.toFixed(3),w,kind:tool,hinge:"g",swing:"int"};state.openings.push(o);
    tool="sel";setSingle("open",o.id);buildTools();markDirty();draw();showSide();return;}
  if(tool==="offset"){const hs=hitSeg(wx,wy);if(!hs){setHint("Cliquez le mur à dupliquer en parallèle.");return;}
    const d=segDir(hs.seg);const nx=-d.uy,ny=d.ux;const side=((wx-d.a.x)*nx+(wy-d.a.y)*ny)>=0?1:-1;
    multi.clear();sel={kind:"offsetAsk",seg:hs.seg.id,side};showSide();document.dispatchEvent(new CustomEvent("okteo:ask"));setHint("Indiquez la distance de la cloison parallèle dans le panneau de droite.");return;}
  if(tool==="cote"){const p=snapWorld(wx,wy);if(!dimDraft){dimDraft={x:p.x,y:p.y};setHint("Cliquez le second point de la cote.");}
    else{snapshot();state.dims.push({id:uidD(),a:{x:dimDraft.x,y:dimDraft.y},b:{x:p.x,y:p.y}});dimDraft=null;markDirty();draw();showSide();setHint(hintFor("cote"));}return;}
  if(tool==="sel"){
    if(testMode){const a=hitApp(wx,wy);if(a&&(a.t==="INT"||a.t==="VV"||a.t==="BP")){setSingle("app",a.id);draw();}return;}
    const shift=e.shiftKey;
    if(!shift&&layers.ouvertures.on&&!layers.ouvertures.lock&&sel&&sel.kind==="open"){const so=state.openings.find(x=>x.id===sel.id);const hh=so&&hitOpenHandle(wx,wy,so);
      if(hh){drag={kind:"openW",o:so,handle:hh,sx:wx,sy:wy,moved:false};return;}}
    const hit=hitAny(wx,wy);
    if(hit){
      if(shift){toggleMulti(hit.kind,hit.id);draw();showSide();return;}
      if(multi.size>1||(sel&&sel.kind==="room")){const G=currentGroup();if(inGroup(G,hit)){startGroupDrag(wx,wy,G);drag.clickHit=hit;draw();return;}}
      setSingle(hit.kind,hit.id);
      if(hit.kind==="node")drag={kind:"node",n:hit.obj,sx:wx,sy:wy,moved:false};
      else if(hit.kind==="app")drag={kind:"app",a:hit.obj,dx:hit.obj.x-wx,dy:hit.obj.y-wy,sx:wx,sy:wy,moved:false};
      else if(hit.kind==="open")drag={kind:"openT",o:hit.obj,sx:wx,sy:wy,moved:false};
      else if(hit.kind==="seg"){const d=segDir(hit.obj);const G={nodes:new Set([hit.obj.a,hit.obj.b]),apps:new Set(),rooms:new Set(),opens:new Set(),dims:new Set()};
        startGroupDrag(wx,wy,G,{x:-d.uy,y:d.ux});}
      draw();showSide();return;}
    const rm=layers.pieces.on&&!layers.pieces.lock?roomAt(wx,wy):null;
    if(rm&&!shift&&isSel("room",rm.id)){startGroupDrag(wx,wy);draw();return;}
    if(rm&&!shift&&multi.size>1){const G=currentGroup();if(G.rooms.has(rm.id)){startGroupDrag(wx,wy,G);draw();return;}}
    marquee={x0:wx,y0:wy,x1:wx,y1:wy,moved:false,shift,room:rm?rm.id:null};return;}
  if(tool==="lien"){const a=hitApp(wx,wy);if(!a)return;
    if(!sel||sel.kind!=="link"){if(a.t==="INT"||a.t==="VV"||a.t==="BP"){multi.clear();sel={kind:"link",id:a.id};draw();setHint("Cliquez la/les lumière(s) commandée(s). Échap pour terminer.");}}
    else{if(a.t==="LUM"||a.t==="SPOT"){snapshot();if(!state.lia.some(x=>x.c===sel.id&&x.l===a.id))state.lia.push({c:sel.id,l:a.id});markDirty();draw();}}return;}
  // pose d'appareil (aperçu = position finale)
  if(TYPES[tool]){snapshot();const p=placementFor(tool,wx,wy,null);guides=[];const na=placeApp(tool,p);setSingle("app",na.id);markDirty();draw();showSide();}
});
sv.addEventListener("pointermove",e=>{const [wx,wy]=evWorld(e);lastW={x:wx,y:wy};
  if(pan){const k=pxPerVB();view.cx=pan.cx-(e.clientX-pan.x)/k/view.scale;view.cy=pan.cy-(e.clientY-pan.y)/k/view.scale;draw();return;}
  if(seriesMode){const src=state.app.find(a=>a.id===seriesMode.src);if(!src){seriesMode=null;return;}
    const end=placementFor(src.t,wx,wy,src.id);seriesPrev=seriesPositions(src,end,seriesMode.n);
    showText(seriesMode.n+" appareils · pas de "+fmtM(dist(src.x,src.y,end.x,end.y)/(seriesMode.n-1)));draw();return;}
  if(marquee){marquee.x1=wx;marquee.y1=wy;if(!marquee.moved&&dist(marquee.x0,marquee.y0,wx,wy)>tolM()*0.4)marquee.moved=true;draw();return;}
  if(roomDraft){const p=snapWorld(wx,wy);roomDraft.x1=p.x;roomDraft.y1=p.y;showReadout2(Math.abs(roomDraft.x1-roomDraft.x0),Math.abs(roomDraft.y1-roomDraft.y0));draw();return;}
  if(drag){ if(!drag.moved){if(dist(drag.sx,drag.sy,wx,wy)<tolM()*0.35)return;snapshot();drag.moved=true;}
    if(drag.kind==="group"){moveGroup(wx,wy,e.shiftKey);draw();showSide();}
    else if(drag.kind==="node"){const p=snapWorld(wx,wy,drag.n.id);drag.n.x=p.x;drag.n.y=p.y;clampOpenings();draw();showSide();}
    else if(drag.kind==="openT"){const seg=segById(drag.o.seg);const pr=projOnSeg(wx,wy,seg);
      drag.o.t=+Math.max(drag.o.w/2,Math.min(pr.dir.L-drag.o.w/2,pr.t)).toFixed(3);draw();showSide();}
    else if(drag.kind==="openW"){const seg=segById(drag.o.seg);const pr=projOnSeg(wx,wy,seg);
      drag.o.w=+Math.max(0.2,Math.abs(pr.t-drag.o.t)*2).toFixed(3);clampOpenings();draw();showSide();}
    else{const p=placementFor(drag.a.t,wx+drag.dx,wy+drag.dy,drag.a.id);drag.a.x=p.x;drag.a.y=p.y;
      if(p.seg){drag.a.seg=p.seg;attach(drag.a);const m=wallMeasure(p.seg,p.x,p.y);if(m)showText(wallText(m));}else{delete drag.a.seg;delete drag.a.wa;hideReadout();}draw();showSide();}
    return;}
  if(tool==="calib"&&calib&&calib.a&&!calib.b){const[bx,by]=ortho?applyOrtho(calib.a.x,calib.a.y,wx,wy):[wx,wy];calib.cur={x:bx,y:by};
    showText("Échelle actuelle : "+dist(calib.a.x,calib.a.y,bx,by).toFixed(2)+" m entre les deux points");draw();return;}
  if(TYPES[tool]&&tool!=="sel"){ghost=placementFor(tool,wx,wy,null);ghost.t=tool;
    if(ghost.seg){const m=wallMeasure(ghost.seg,ghost.x,ghost.y);if(m)showText(typed!==""?("⌨ "+typed+" cm de l'angle le plus proche · Entrée pour poser"):wallText(m));}
    else if(typed===""){hideReadout();}draw();return;}
  if(tool==="mur"){let ox=wx,oy=wy;if(draftFrom){const f=nodeById(draftFrom);[ox,oy]=applyOrtho(f.x,f.y,wx,wy);}const p=snapWorld(ox,oy);draftPt={x:p.x,y:p.y,snap:p.kind==="nœud"};
    if(draftFrom){const f=nodeById(draftFrom);showReadout(dist(f.x,f.y,p.x,p.y),Math.atan2(-(p.y-f.y),p.x-f.x));}draw();}
  else if(tool==="cote"&&dimDraft){const p=snapWorld(wx,wy);draftPt={x:p.x,y:p.y,snap:p.kind==="nœud"};showReadout(dist(dimDraft.x,dimDraft.y,p.x,p.y),0);draw();}
});
sv.addEventListener("pointerleave",()=>{if(ghost){ghost=null;if(typed==="")hideReadout();draw();}});
function endPtr(){
  if(marquee){const m=marquee;marquee=null;
    if(m.moved)marqueeSelect(m);
    else if(m.room){if(m.shift)toggleMulti("room",m.room);else setSingle("room",m.room);}
    else if(!m.shift)clearSel();
    draw();showSide();return;}
  if(roomDraft){const r=roomDraft;roomDraft=null;hideReadout();const w=Math.abs(r.x1-r.x0),hh=Math.abs(r.y1-r.y0);
    if(w>0.3&&hh>0.3){snapshot();const x0=Math.min(r.x0,r.x1),y0=Math.min(r.y0,r.y1),x1=Math.max(r.x0,r.x1),y1=Math.max(r.y0,r.y1);
      const n1=node(x0,y0),n2=node(x1,y0),n3=node(x1,y1),n4=node(x0,y1),sids=[];
      [[n1,n2],[n2,n3],[n3,n4],[n4,n1]].forEach(([a,b])=>{const id=uidS();sids.push(id);state.segs.push({id,a:a.id,b:b.id});});
      const rm={id:uidR(),name:"Pièce "+(state.rooms.length+1),x0,y0,x1,y1,segs:sids};state.rooms.push(rm);setSingle("room",rm.id);markDirty();draw();showSide();}
    else draw();return;}
  if(drag){const d=drag;drag=null;guides=[];hideReadout();
    if(d.moved)markDirty();else if(d.clickHit)setSingle(d.clickHit.kind,d.clickHit.id);
    draw();showSide();}
  if(pan){pan=null;save();}}
sv.addEventListener("pointerup",endPtr);sv.addEventListener("pointercancel",endPtr);
sv.addEventListener("contextmenu",e=>e.preventDefault());
sv.addEventListener("dblclick",()=>{if(tool==="mur"){draftFrom=null;draftPt=null;typed="";hideReadout();draw();}});
sv.addEventListener("wheel",e=>{e.preventDefault();const [wx,wy]=evWorld(e);const f=e.deltaY<0?1.12:1/1.12;view.scale=Math.max(2,Math.min(90,view.scale*f));const [nx,ny]=evWorld(e);view.cx+=wx-nx;view.cy+=wy-ny;draw();},{passive:false});

function showReadout(len,ang){const r=document.getElementById("readout");r.hidden=false;let deg=Math.round(ang*180/Math.PI);if(deg<0)deg+=360;r.textContent=(typed!==""?("⌨ "+typed+" m"):(len.toFixed(2)+" m"))+(ang?("  ·  "+deg+"°"):"");}
function showReadout2(w,h){const r=document.getElementById("readout");r.hidden=false;r.textContent=w.toFixed(2)+" × "+h.toFixed(2)+" m  ·  "+(w*h).toFixed(1)+" m²";}
function hideReadout(){document.getElementById("readout").hidden=true;}

// ---------- menu contextuel flottant (près de l'objet) ----------
const stageEl=document.querySelector(".stage"),hudEl=document.getElementById("hud");
function worldToScreen(x,y){const [vx,vy]=W2V(x,y);const ctm=sv.getScreenCTM();if(!ctm)return null;
  const p=sv.createSVGPoint();p.x=vx;p.y=vy;const sp=p.matrixTransform(ctm);const r=stageEl.getBoundingClientRect();
  return {x:sp.x-r.left,y:sp.y-r.top};}
function selCenter(){
  if(multi.size>1){const bb=bbox(groupPoints(currentGroup()));return bb&&{x:bb.cx,y:bb.y0};}
  if(!sel)return null;
  if(sel.kind==="app"){const a=state.app.find(x=>x.id===sel.id);return a&&{x:a.x,y:a.y};}
  if(sel.kind==="open")return openCenter(sel.id);
  if(sel.kind==="seg"){const s=segById(sel.id);if(!s)return null;const a=nodeById(s.a),b=nodeById(s.b);return a&&b&&{x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  if(sel.kind==="node")return nodeById(sel.id);
  if(sel.kind==="room"){const r=state.rooms.find(x=>x.id===sel.id);return r&&{x:(r.x0+r.x1)/2,y:Math.min(r.y0,r.y1)};}
  if(sel.kind==="dim"){const d=state.dims.find(x=>x.id===sel.id);return d&&{x:(d.a.x+d.b.x)/2,y:(d.a.y+d.b.y)/2};}
  return null;}
const HUD_TF=`<button data-h="ccw" title="Rotation 90° à gauche (Maj+R)">⟲</button><button data-h="cw" title="Rotation 90° à droite (R)">⟳</button>
  <button data-h="mx" title="Symétrie gauche-droite (X)">⇋</button><button data-h="my" title="Symétrie haut-bas (Y)">⇵</button>`;
function hudHTML(){
  if(multi.size>1){const n=groupCount(currentGroup());
    return `<span class="lab">${n} objet${n>1?"s":""}</span><span class="vsep"></span>${HUD_TF}<span class="vsep"></span>
      <button data-h="gdup" title="Dupliquer (Ctrl+D)">Dupliquer</button><button data-h="gdel" title="Supprimer (Suppr)">🗑</button>`;}
  if(!sel)return "";
  if(sel.kind==="open"){const o=state.openings.find(x=>x.id===sel.id);if(!o)return "";
    return `<button data-h="w-" class="mini">−</button><span class="lab">${o.w.toFixed(2)} m</span><button data-h="w+" class="mini">+</button>
      <span class="vsep"></span><button data-h="gond">Gond</button><button data-h="sens">Sens</button>
      <button data-h="kind">${o.kind==="porte"?"→ Fenêtre":"→ Porte"}</button>
      <span class="vsep"></span><button data-h="del" title="Supprimer">🗑</button>`;}
  if(sel.kind==="app"){const a=state.app.find(x=>x.id===sel.id);if(!a)return "";
    const m=a.seg?wallMeasure(a.seg,a.x,a.y):null;
    const dc=m?`<span class="vsep"></span><span class="lab" title="Distance à l'angle le plus proche, face intérieure">↤</span><input data-h="dc" data-from="${m.dA<=m.dB?"A":"B"}" type="number" step="1" value="${Math.round(Math.min(m.dA,m.dB)*100)}"><span class="lab">cm</span>`:"";
    return `<span class="lab">${(repMap()[a.id]||a.t)}</span><span class="vsep"></span>
      <span class="lab">h</span><input data-h="h" type="number" step="1" value="${a.h??""}" ${a.h==null?'placeholder="plaf."':''}>${dc}
      <span class="vsep"></span><span class="lab">×</span><input data-h="n" type="number" min="2" max="40" step="1" value="${seriesN}" style="width:40px"><button data-h="serie" title="Poser une série équirépartie jusqu'au point cliqué">Série</button>
      <button data-h="dup" title="Dupliquer (Ctrl+D)">Dupliquer</button><span class="vsep"></span><button data-h="del">🗑</button>`;}
  if(sel.kind==="seg"){const s=segById(sel.id);if(!s)return "";const a=nodeById(s.a),b=nodeById(s.b);const L=dist(a.x,a.y,b.x,b.y);
    return `<span class="lab">L</span><input data-h="L" type="number" step="0.01" value="${L.toFixed(2)}"><span class="lab">m</span>
      <span class="vsep"></span><span class="lab" title="Épaisseur de ce mur">ép.</span><input data-h="ep" type="number" step="1" min="2" max="80" value="${Math.round(epOf(s)*100)}" title="Épaisseur de ce mur (cm)"><span class="lab">cm</span>
      <span class="vsep"></span><button data-h="del">🗑</button>`;}
  if(sel.kind==="room"){const r=state.rooms.find(x=>x.id===sel.id);if(!r)return "";
    return `<input data-h="name" type="text" value="${r.name.replace(/"/g,'&quot;')}" style="width:104px"><span class="vsep"></span>${HUD_TF}
      <span class="vsep"></span><button data-h="gdup" title="Dupliquer la pièce et son contenu (Ctrl+D)">Dupliquer</button><button data-h="gdel" title="Supprimer la pièce, ses murs et son contenu">🗑</button>`;}
  if(sel.kind==="node")return `<button data-h="del">Supprimer le sommet</button>`;
  if(sel.kind==="dim")return `<button data-h="del">Supprimer la cote</button>`;
  return "";}
function wireHud(){hudEl.querySelectorAll("[data-h]").forEach(el=>{
  const act=el.dataset.h;
  const run=fn=>{snapshot();fn();markDirty();draw();showSide();};
  if(el.tagName==="INPUT"){el.onchange=e=>{
    if(act==="n"){seriesN=Math.max(2,Math.min(40,Math.round(+e.target.value||3)));return;}
    if(!sel)return;
    if(act==="h"){const a=state.app.find(x=>x.id===sel.id);run(()=>a.h=e.target.value===""?null:+e.target.value);}
    if(act==="dc"){const a=state.app.find(x=>x.id===sel.id);const m=a&&a.seg&&wallMeasure(a.seg,a.x,a.y);
      if(m)run(()=>{const p=posOnWall(m,el.dataset.from==="A",(+e.target.value)/100);a.x=p.x;a.y=p.y;attach(a);});}
    if(act==="ep"){const s=segById(sel.id),v=+e.target.value;if(s&&v>=2&&v<=80)run(()=>{s.ep=+(v/100).toFixed(3);});}
    if(act==="L"){const s=segById(sel.id),a=nodeById(s.a),c=nodeById(s.b),d=dist(a.x,a.y,c.x,c.y)||1,nl=+e.target.value;run(()=>{c.x=+(a.x+(c.x-a.x)/d*nl).toFixed(3);c.y=+(a.y+(c.y-a.y)/d*nl).toFixed(3);clampOpenings();});}
    if(act==="name"){const r=state.rooms.find(x=>x.id===sel.id);run(()=>r.name=e.target.value||r.name);}
  };return;}
  el.onclick=()=>{
    if(act==="del"){delSel();return;}
    if(act==="gdel"){deleteGroup(currentGroup());return;}
    if(act==="gdup"){duplicateGroup();return;}
    if(["cw","ccw","mx","my"].includes(act)){transformGroup(act);return;}
    if(!sel)return;
    if(sel.kind==="open"){const o=state.openings.find(x=>x.id===sel.id);if(!o)return;
      if(act==="w-")run(()=>o.w=Math.max(0.2,+(o.w-0.05).toFixed(2)));
      if(act==="w+")run(()=>{o.w=+(o.w+0.05).toFixed(2);clampOpenings();});
      if(act==="gond")run(()=>o.hinge=o.hinge==="g"?"d":"g");
      if(act==="sens")run(()=>o.swing=o.swing==="int"?"ext":"int");
      if(act==="kind")run(()=>o.kind=o.kind==="porte"?"fenetre":"porte");}
    if(act==="dup"&&sel.kind==="app"){duplicateGroup();}
    if(act==="serie"&&sel.kind==="app"){const inp=hudEl.querySelector('[data-h="n"]');if(inp)seriesN=Math.max(2,Math.min(40,Math.round(+inp.value||3)));
      seriesMode={src:sel.id,n:seriesN};seriesPrev=null;setHint("Série de "+seriesN+" : cliquez le point d'arrivée. Échap pour annuler.");draw();}
  };});}
function placeHud(){const kinds=["open","app","seg","room","node","dim"];
  const active=multi.size>1||(sel&&kinds.includes(sel.kind));
  if(!active||drag||pan||roomDraft||marquee||seriesMode){hudEl.hidden=true;return;}
  const c=selCenter();if(!c){hudEl.hidden=true;return;}
  const html=hudHTML();if(!html){hudEl.hidden=true;return;}
  if(hudEl.contains(document.activeElement)&&!hudEl.hidden)return; // ne pas reconstruire pendant une saisie
  hudEl.innerHTML=html;wireHud();
  const p=worldToScreen(c.x,c.y);if(!p){hudEl.hidden=true;return;}
  const r=stageEl.getBoundingClientRect();let left=Math.max(140,Math.min(r.width-140,p.x)),top=Math.max(48,p.y-34);
  hudEl.style.left=left+"px";hudEl.style.top=top+"px";hudEl.hidden=false;}

// ---------- panneau ----------
function layerPanel(){const names={fond:"Fond",pieces:"Pièces",murs:"Murs",ouvertures:"Ouvertures",appareils:"Appareils",liaisons:"Liaisons",cotes:"Cotes"};
  return `<h3 style="margin-top:14px">Calques</h3>`+Object.keys(layers).map(k=>`<div class="lay"><span>${names[k]}</span><span class="btns">
    <button data-lay="${k}" data-act="on">${layers[k].on?"👁":"—"}</button><button data-lay="${k}" data-act="lock">${layers[k].lock?"🔒":"🔓"}</button></span></div>`).join("");}
function wireLayers(b){b.querySelectorAll("[data-lay]").forEach(btn=>btn.onclick=()=>{const k=btn.dataset.lay;
  if(btn.dataset.act==="on")layers[k].on=!layers[k].on;else layers[k].lock=!layers[k].lock;save();draw();showSide();});}

function showSide(){const b=document.getElementById("sidebody");
  if(sel&&sel.kind==="segDelAsk"){const id=sel.id,n=sel.n;
    b.innerHTML=`<h3>Supprimer le mur</h3><p class="note" style="margin-top:0">Ce mur porte <b>${n} appareil${n>1?"s":""}</b> (prises, interrupteurs…).</p>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px"><button id="sd-all" class="danger">Supprimer le mur et ses ${n} appareil${n>1?"s":""}</button>
      <button id="sd-keep">Supprimer le mur, garder les appareils</button><button id="sd-no">Annuler</button></div>
      <p class="note">Les appareils gardés restent à leur place, détachés : glissez-les contre un autre mur pour les raccrocher. Ctrl+Z annule.</p>`;
    b.querySelector("#sd-all").onclick=()=>removeSeg(id,true);b.querySelector("#sd-keep").onclick=()=>removeSeg(id,false);
    b.querySelector("#sd-no").onclick=()=>{sel={kind:"seg",id};draw();showSide();};return;}
  if(sel&&sel.kind==="calibAsk"&&calib&&calib.b){const d=dist(calib.a.x,calib.a.y,calib.b.x,calib.b.y);
    b.innerHTML=`<h3>Mise à l'échelle du fond</h3>
      <div class="prop"><div class="field full"><label>Longueur réelle entre les deux points <span class="u">m</span></label><input id="cl-L" type="number" step="0.01" min="0.1" placeholder="ex. 13.00"></div></div>
      <div style="display:flex;gap:6px;margin-top:10px"><button id="cl-ok" class="on">Valider l'échelle</button><button id="cl-redo">Recommencer</button><button id="cl-no">Annuler</button></div>
      <p class="note">Mesure actuelle : <b class="num">${d.toFixed(3)} m</b>. Choisissez la plus grande cote lisible du plan (ex. la longueur totale de la maison) : l'erreur sera plus petite.
      Le fond est agrandi ou réduit autour du premier point ; le dessin existant ne bouge pas.</p>`;
    const inp=b.querySelector("#cl-L");setTimeout(()=>inp.focus(),0);
    const ok=()=>{const L=+String(inp.value).replace(",",".");if(!(L>0)){inp.focus();return;}applyCalib(L);};
    b.querySelector("#cl-ok").onclick=ok;inp.onkeydown=e=>{if(e.key==="Enter")ok();};
    b.querySelector("#cl-redo").onclick=()=>{calib=null;sel=null;setHint(hintFor("calib"));draw();showSide();};
    b.querySelector("#cl-no").onclick=()=>{calib=null;sel=null;tool="sel";buildTools();setHint(hintFor("sel"));draw();showSide();};return;}
  if(tab==="chantiers"){b.innerHTML=`<h3>Chantiers</h3><p class="note">Chantier ouvert : <b>${CH.nom}</b>${CH.numero?" · "+CH.numero:""}. Cliquez sur <b>Plan</b> pour revenir au dessin.</p>`;return;}
  if(tab==="params"){b.innerHTML=`<h3>Paramètres</h3><p class="note">Réglez ici les clés IA. Cliquez sur <b>Plan</b> pour revenir au dessin.</p>`;return;}
  if(tab!=="plan"){b.innerHTML=`<h3>${tab}</h3><p class="note">Onglet à venir.</p>`;return;}
  if(sel&&sel.kind==="offsetAsk"){
    b.innerHTML=`<h3>Cloison parallèle</h3>
      <div class="prop"><div class="field full"><label>Distance <span class="u">m</span></label><input id="od" type="number" step="0.01" value="0.80" autofocus></div></div>
      <div style="display:flex;gap:6px;margin-top:10px"><button id="odok" class="on">Créer</button><button id="odc">Annuler</button></div>
      <p class="note">Crée un mur parallèle à celui sélectionné, du côté où vous avez cliqué.</p>`;
    b.querySelector("#odok").onclick=()=>{const dd=+b.querySelector("#od").value;const s=segById(sel.seg);if(s&&dd>0){const d=segDir(s);const nx=-d.uy*dd*sel.side,ny=d.ux*dd*sel.side;
      snapshot();const a2=node(d.a.x+nx,d.a.y+ny),b2=node(d.b.x+nx,d.b.y+ny);state.segs.push({id:uidS(),a:a2.id,b:b2.id});markDirty();}
      sel=null;tool="sel";buildTools();draw();showSide();};
    b.querySelector("#odc").onclick=()=>{sel=null;draw();showSide();};return;}
  if(multi.size>1){const G=currentGroup();const nm=state.segs.filter(s=>G.nodes.has(s.a)&&G.nodes.has(s.b)).length;
    const row=(l,v)=>v?`<div class="kv"><span>${l}</span><span class="num">${v}</span></div>`:"";
    b.innerHTML=`<h3>Sélection · ${groupCount(G)} objets</h3>
      ${row("Pièces",G.rooms.size)}${row("Murs",nm)}${row("Ouvertures",G.opens.size)}${row("Appareils",G.apps.size)}${row("Cotes",G.dims.size)}
      <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
        <button id="g_ccw" title="Maj+R">⟲ 90°</button><button id="g_cw" title="R">⟳ 90°</button>
        <button id="g_mx" title="X">⇋ Symétrie</button><button id="g_my" title="Y">⇵ Symétrie</button></div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button id="g_dup">Dupliquer</button><button id="g_del" class="danger">Supprimer</button></div>
      <p class="note">Glissez n'importe quel élément de la sélection pour déplacer le groupe (Maj : reste dans l'axe). Ctrl+C / Ctrl+V pour copier-coller sous le curseur.<br>
      Cadre de sélection : de gauche à droite (bleu) = objets entièrement dedans ; de droite à gauche (vert) = objets touchés. Maj+clic pour ajouter ou retirer.</p>`;
    b.querySelector("#g_ccw").onclick=()=>transformGroup("ccw");b.querySelector("#g_cw").onclick=()=>transformGroup("cw");
    b.querySelector("#g_mx").onclick=()=>transformGroup("mx");b.querySelector("#g_my").onclick=()=>transformGroup("my");
    b.querySelector("#g_dup").onclick=duplicateGroup;b.querySelector("#g_del").onclick=()=>deleteGroup(currentGroup());return;}
  if(sel&&sel.kind==="open"){const o=state.openings.find(x=>x.id===sel.id);const L=segLen(segById(o.seg));
    b.innerHTML=`<h3>${o.kind==="porte"?"Porte":"Fenêtre"}</h3>
     <div class="prop">
      <div class="field"><label>Largeur <span class="u">m</span></label><input id="ow" type="number" step="0.01" value="${o.w}"></div>
      <div class="field"><label>Position <span class="u">m</span></label><input id="ot" type="number" step="0.01" value="${o.t.toFixed(2)}"></div>
      <div class="field"><label>Type</label><select id="ok"><option value="porte"${o.kind==="porte"?" selected":""}>Porte</option><option value="fenetre"${o.kind==="fenetre"?" selected":""}>Fenêtre</option></select></div>
      <div class="field"><label>Gond</label><select id="oh"><option value="g"${o.hinge==="g"?" selected":""}>Gauche</option><option value="d"${o.hinge==="d"?" selected":""}>Droit</option></select></div>
      <div class="field full"><label>Ouverture</label><select id="os"><option value="int"${o.swing==="int"?" selected":""}>Vers l'intérieur</option><option value="ext"${o.swing==="ext"?" selected":""}>Vers l'extérieur</option></select></div>
     </div>
     <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button id="ihg">Inverser gond</button><button id="ihs">Inverser sens</button></div>
     <div style="margin-top:8px"><button id="delo" class="danger">Supprimer</button></div>
     <p class="note">Glissez l'ouverture le long du mur pour la déplacer ; tirez une poignée pour la largeur. Raccourcis : G gond · S sens · Suppr.</p>`;
    const re=()=>{draw();showSide();};
    b.querySelector("#ow").onchange=e=>{snapshot();o.w=+(+e.target.value).toFixed(2);markDirty();re();};
    b.querySelector("#ot").onchange=e=>{snapshot();o.t=+(+e.target.value).toFixed(2);markDirty();re();};
    b.querySelector("#ok").onchange=e=>{snapshot();o.kind=e.target.value;markDirty();re();};
    b.querySelector("#oh").onchange=e=>{snapshot();o.hinge=e.target.value;markDirty();re();};
    b.querySelector("#os").onchange=e=>{snapshot();o.swing=e.target.value;markDirty();re();};
    b.querySelector("#ihg").onclick=()=>{snapshot();o.hinge=o.hinge==="g"?"d":"g";markDirty();re();};
    b.querySelector("#ihs").onclick=()=>{snapshot();o.swing=o.swing==="int"?"ext":"int";markDirty();re();};
    b.querySelector("#delo").onclick=()=>{snapshot();state.openings=state.openings.filter(x=>x.id!==o.id);sel=null;markDirty();re();};return;}
  if(sel&&sel.kind==="dim"){const d=state.dims.find(x=>x.id===sel.id);const L=dist(d.a.x,d.a.y,d.b.x,d.b.y);
    b.innerHTML=`<h3>Cote</h3><div class="kv"><span>Mesure</span><span class="num">${L.toFixed(2)} m</span></div>
     <div style="margin-top:12px"><button id="deld" class="danger">Supprimer</button></div>`;
    b.querySelector("#deld").onclick=()=>{snapshot();state.dims=state.dims.filter(x=>x.id!==d.id);sel=null;markDirty();draw();showSide();};return;}
  if(sel&&sel.kind==="room"){const r=state.rooms.find(x=>x.id===sel.id);const w=Math.abs(r.x1-r.x0),hh=Math.abs(r.y1-r.y0);
    b.innerHTML=`<h3>Pièce</h3>
     <div class="prop"><div class="field full"><label>Nom</label><input id="rn" type="text" value="${r.name.replace(/"/g,'&quot;')}"></div>
      ${r.cycle?"":`<div class="field"><label>Largeur <span class="u">m</span></label><input id="rw" type="number" step="0.01" value="${w.toFixed(2)}"></div>
      <div class="field"><label>Profondeur <span class="u">m</span></label><input id="rh" type="number" step="0.01" value="${hh.toFixed(2)}"></div>`}</div>
     <div class="kv"><span>${r.cycle?"Surface habitable":"Surface"}</span><span class="num">${roomArea(r).toFixed(2)} m²</span></div>
     ${r.cycle?`<div class="kv"><span>Murs du contour</span><span class="num">${r.cycle.length}</span></div>`:""}
     ${r.open?`<p class="note warn">Un mur de son contour a été supprimé : la pièce n'est plus fermée (forme figée). Relancez « Détecter les pièces ».</p>`:""}
     ${r.also&&r.also.length?`<p class="note warn">Le plan indique aussi ici : <b>${r.also.join(", ")}</b>. Un mur manque peut-être pour les séparer.</p>`:""}
     <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
       <button id="r_ccw" title="Maj+R">⟲ 90°</button><button id="r_cw" title="R">⟳ 90°</button><button id="r_mx" title="X">⇋</button><button id="r_my" title="Y">⇵</button></div>
     <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button id="r_dup">Dupliquer</button><button id="delr" class="danger">Supprimer</button></div>
     <p class="note">${r.cycle?"Pièce détectée d'après ses murs : sa forme et sa surface suivent les murs quand on les déplace. Surface mesurée entre les faces intérieures des murs.":"La largeur et la profondeur déplacent réellement les murs de droite et du bas."} Glissez la pièce sélectionnée pour la déplacer avec ses murs et ses appareils. Supprimer retire la pièce, ses murs et son contenu.</p>`;
    b.querySelector("#rn").onchange=e=>{snapshot();r.name=e.target.value||r.name;markDirty();draw();};
    if(b.querySelector("#rw"))b.querySelector("#rw").onchange=e=>{const v=+e.target.value;if(v>0.3){snapshot();resizeRoom(r,v,null);markDirty();draw();showSide();}};
    if(b.querySelector("#rh"))b.querySelector("#rh").onchange=e=>{const v=+e.target.value;if(v>0.3){snapshot();resizeRoom(r,null,v);markDirty();draw();showSide();}};
    b.querySelector("#r_ccw").onclick=()=>transformGroup("ccw");b.querySelector("#r_cw").onclick=()=>transformGroup("cw");
    b.querySelector("#r_mx").onclick=()=>transformGroup("mx");b.querySelector("#r_my").onclick=()=>transformGroup("my");
    b.querySelector("#r_dup").onclick=duplicateGroup;
    b.querySelector("#delr").onclick=()=>deleteGroup(currentGroup());return;}
  if(sel&&sel.kind==="seg"){const s=segById(sel.id);const a=nodeById(s.a),c=nodeById(s.b);const L=dist(a.x,a.y,c.x,c.y);
    b.innerHTML=`<h3>Mur</h3><div class="prop">
      <div class="field full"><label>Longueur <span class="u">m</span></label><input id="f_L" type="number" step="0.01" value="${L.toFixed(2)}"></div>
      <div class="field full"><label>Épaisseur des murs <span class="u">m</span></label><input id="f_ep" type="number" step="0.01" value="${state.wallEp}"></div></div>
     <div style="margin-top:12px"><button id="delseg" class="danger">Supprimer ce mur</button></div>
     <p class="note">Modifier la longueur déplace l'extrémité B. Glissez un sommet pour ajuster un angle.</p>`;
    b.querySelector("#f_L").onchange=e=>{const nl=+e.target.value,d=dist(a.x,a.y,c.x,c.y)||1;snapshot();c.x=+(a.x+(c.x-a.x)/d*nl).toFixed(3);c.y=+(a.y+(c.y-a.y)/d*nl).toFixed(3);markDirty();draw();showSide();};
    b.querySelector("#f_ep").onchange=e=>{snapshot();state.wallEp=+(+e.target.value).toFixed(2);markDirty();draw();showSide();};
    b.querySelector("#delseg").onclick=()=>{snapshot();state.openings=state.openings.filter(o=>o.seg!==sel.id);state.segs=state.segs.filter(x=>x.id!==sel.id);cleanNodes();sel=null;markDirty();draw();showSide();};return;}
  if(sel&&sel.kind==="node"){const n=nodeById(sel.id);
    b.innerHTML=`<h3>Sommet</h3><div class="prop"><div class="field"><label>X <span class="u">m</span></label><input id="nx" type="number" step="0.01" value="${n.x}"></div>
     <div class="field"><label>Y <span class="u">m</span></label><input id="ny" type="number" step="0.01" value="${n.y}"></div></div>
     <div style="margin-top:12px"><button id="deln" class="danger">Supprimer le sommet</button></div>
     <p class="note">Relie ${state.segs.filter(s=>s.a===n.id||s.b===n.id).length} mur(s).</p>`;
    b.querySelector("#nx").onchange=e=>{snapshot();n.x=+(+e.target.value).toFixed(3);markDirty();draw();showSide();};
    b.querySelector("#ny").onchange=e=>{snapshot();n.y=+(+e.target.value).toFixed(3);markDirty();draw();showSide();};
    b.querySelector("#deln").onclick=()=>{snapshot();state.segs=state.segs.filter(s=>s.a!==n.id&&s.b!==n.id);state.nodes=state.nodes.filter(x=>x.id!==n.id);sel=null;markDirty();draw();showSide();};return;}
  if(sel&&sel.kind==="app"){const a=state.app.find(x=>x.id===sel.id);const rm=repMap();const m=a.seg?wallMeasure(a.seg,a.x,a.y):null;
    b.innerHTML=`<h3>Appareil · <span style="color:var(--accent2)">${rm[a.id]||""}</span></h3>
     <div class="prop">
      <div class="field full"><label>Type</label><select id="f_t">${Object.keys(TYPES).map(t=>`<option value="${t}"${t===a.t?" selected":""}>${TYPES[t].n}</option>`).join("")}</select></div>
      ${m?`<div class="field"><label>Depuis l'angle A <span class="u">cm</span></label><input id="f_dA" type="number" step="1" value="${Math.round(m.dA*100)}"></div>
      <div class="field"><label>Depuis l'angle B <span class="u">cm</span></label><input id="f_dB" type="number" step="1" value="${Math.round(m.dB*100)}"></div>`:""}
      <div class="field"><label>X plan <span class="u">m</span></label><input id="f_x" type="number" step="0.01" value="${a.x}"></div>
      <div class="field"><label>Y plan <span class="u">m</span></label><input id="f_y" type="number" step="0.01" value="${a.y}"></div>
      <div class="field full"><label>Hauteur <span class="u">cm</span></label><input id="f_h" type="number" step="1" value="${a.h??""}" ${a.h==null?'placeholder="— plafond —"':''}></div></div>
     <div style="display:flex;gap:6px;margin-top:12px"><button id="dup">Dupliquer</button><button id="del" class="danger">Supprimer</button></div>
     <p class="note">${m?"Fixé au mur : les distances sont mesurées depuis la face intérieure du mur d'angle, comme sur le chantier. Tapez 30 pour « à 30 cm de l'angle ».":"Approchez l'appareil d'un mur pour qu'il s'y fixe et afficher ses distances aux angles."}</p>`;
    const re=()=>{draw();showSide();};
    if(m){b.querySelector("#f_dA").onchange=e=>{snapshot();const p=posOnWall(m,true,(+e.target.value)/100);a.x=p.x;a.y=p.y;markDirty();re();};
      b.querySelector("#f_dB").onchange=e=>{snapshot();const p=posOnWall(m,false,(+e.target.value)/100);a.x=p.x;a.y=p.y;markDirty();re();};}
    b.querySelector("#f_t").onchange=e=>{snapshot();a.t=e.target.value;if(a.h==null&&TYPES[a.t].h!=null)a.h=TYPES[a.t].h;markDirty();re();};
    b.querySelector("#f_x").onchange=e=>{snapshot();a.x=+(+e.target.value).toFixed(2);markDirty();re();};
    b.querySelector("#f_y").onchange=e=>{snapshot();a.y=+(+e.target.value).toFixed(2);markDirty();re();};
    b.querySelector("#f_h").onchange=e=>{snapshot();a.h=e.target.value===""?null:+e.target.value;markDirty();re();};
    b.querySelector("#dup").onclick=duplicateGroup;
    b.querySelector("#del").onclick=delSel;return;}
  // rien sélectionné : stats + calques
  const counts={};state.app.forEach(a=>counts[a.t]=(counts[a.t]||0)+1);
  const totA=state.rooms.reduce((s,r)=>s+roomArea(r),0);
  b.innerHTML=`<h3>Chantier</h3>
    <div class="kv"><span>Pièces</span><span class="num">${state.rooms.length}${totA?` · ${totA.toFixed(1)} m²`:""}</span></div>
    <div class="kv"><span>Murs</span><span class="num">${state.segs.length}</span></div>
    <div class="kv"><span>Ouvertures</span><span class="num">${state.openings.length}</span></div>
    <div class="kv"><span>Appareils</span><span class="num">${state.app.length}</span></div>
    <div class="kv"><span>Liaisons</span><span class="num">${state.lia.length}</span></div>
    ${Object.keys(counts).length?Object.keys(counts).map(t=>`<div class="kv"><span>${TYPES[t]?.n||t}</span><span class="num">${counts[t]}</span></div>`).join(""):""}
    ${layerPanel()}
    <p class="note">Outils : <b>Pièce</b> (rectangle), <b>Mur</b> (cloisons), <b>Porte</b>/<b>Fenêtre</b> (cliquer un mur), <b>// Cloison</b> (parallèle), <b>Cote</b> (2 points), puis les appareils. Raccourcis : E pièce · B mur · V sélection.</p>`;
  wireLayers(b);
}
function cleanNodes(){const used=new Set();state.segs.forEach(s=>{used.add(s.a);used.add(s.b)});state.nodes=state.nodes.filter(n=>used.has(n.id));}
function delSel(){
  if(multi.size>1||(sel&&sel.kind==="room")){deleteGroup(currentGroup());return;}
  if(!sel)return;
  if(sel.kind==="app"){snapshot();state.app=state.app.filter(x=>x.id!==sel.id);state.lia=state.lia.filter(x=>x.c!==sel.id&&x.l!==sel.id);}
  else if(sel.kind==="seg"){const n=state.app.filter(a=>a.seg===sel.id).length;
    if(n){sel={kind:"segDelAsk",id:sel.id,n};draw();showSide();document.dispatchEvent(new CustomEvent("okteo:ask"));setHint("Ce mur porte "+n+" appareil"+(n>1?"s":"")+" : choisissez dans le panneau de droite.");return;}
    snapshot();state.openings=state.openings.filter(o=>o.seg!==sel.id);state.segs=state.segs.filter(x=>x.id!==sel.id);cleanNodes();}
  else if(sel.kind==="node"){snapshot();const id=sel.id;state.segs=state.segs.filter(s=>s.a!==id&&s.b!==id);state.nodes=state.nodes.filter(n=>n.id!==id);}
  else if(sel.kind==="open"){snapshot();state.openings=state.openings.filter(x=>x.id!==sel.id);}
  else if(sel.kind==="room"){snapshot();state.rooms=state.rooms.filter(x=>x.id!==sel.id);}
  else if(sel.kind==="dim"){snapshot();state.dims=state.dims.filter(x=>x.id!==sel.id);}
  else return;
  sel=null;markDirty();draw();showSide();}

// ---------- barres ----------
function buildTools(){const t=document.getElementById("tools");
  const base=[["sel","Sélection"],["piece","Pièce"],["mur","Mur"],["porte","Porte"],["fenetre","Fenêtre"],["offset","∥ Cloison"],["cote","Cote"],["pan","Main"],["lien","Liaison"]];
  let h=base.map(([k,n])=>`<button data-tool="${k}" class="${tool===k?'on':''}">${n}</button>`).join("");
  h+=`<button data-tool="__test" class="${testMode?'on':''}">Test</button><span class="sep"></span>`;
  h+=`<span class="palette">`+PAL.map(k=>`<button data-tool="${k}" class="${tool===k?'on':''}" title="${TYPES[k].n}">${k==="PC16"?"16A":k==="PC20"?"20A":TYPES[k].n.split(" ")[0]}</button>`).join("")+`</span>`;
  t.innerHTML=h;
  t.querySelectorAll("button").forEach(btn=>btn.onclick=()=>{const v=btn.dataset.tool;resetTransient();
    if(v==="__test"){testMode=!testMode;clearSel();buildTools();setHint(testMode?"Mode test : cliquez une commande pour voir ses lumières.":"");draw();showSide();return;}
    tool=v;testMode=false;clearSel();buildTools();setHint(hintFor(v));draw();showSide();});}
function applyCalib(L){if(!calib||!calib.b)return false;const a=calib.a,d=dist(a.x,a.y,calib.b.x,calib.b.y);if(!(d>0)||!(L>0))return false;
  const f=L/d;BG={x:a.x+(BG.x-a.x)*f,y:a.y+(BG.y-a.y)*f,w:BG.w*f,h:BG.h*f};
  CH.fond={...CH.fond,x:BG.x,y:BG.y,w:BG.w,h:BG.h,calibre:true};CHS.update(CH.id,{fond:CH.fond});
  calib=null;sel=null;tool="sel";buildTools();fit();showSide();
  setHint("Échelle réglée : "+L.toFixed(2)+" m entre les deux points ("+(f>=1?"×":"÷")+(f>=1?f:1/f).toFixed(3)+"). Vérifiez avec l'outil Cote sur une autre dimension.");
  document.dispatchEvent(new CustomEvent("okteo:fond"));document.dispatchEvent(new CustomEvent("okteo:calibrated"));return true;}
function resetTransient(){calib=null;draftFrom=null;draftPt=null;typed="";roomDraft=null;dimDraft=null;marquee=null;seriesMode=null;seriesPrev=null;ghost=null;hideReadout();}
function hintFor(v){const m={sel:"Clic : sélectionner · glisser dans le vide : cadre de sélection · Maj+clic : ajouter · glisser un mur : le déplacer · Ctrl+A : tout. Molette : zoom · clic droit : vue.",
  piece:"Glissez un rectangle pour créer une pièce (murs + surface d'un coup).",
  mur:"Cliquez pour enchaîner les murs ; double-clic ou Échap pour finir ; tapez un nombre pour fixer la longueur.",
  porte:"Cliquez sur un mur pour y poser une porte qui le perce.",
  fenetre:"Cliquez sur un mur pour y poser une fenêtre.",
  offset:"Cliquez un mur, du côté voulu, puis indiquez la distance de la cloison parallèle.",
  calib:"Échelle du fond : zoomez sur une cote connue du plan (ex. 13,00), cliquez ses deux extrémités, puis tapez sa longueur réelle.",
  cote:"Cliquez deux points pour poser une cote mesurée.",
  pan:"Faites glisser pour déplacer la vue.",lien:"Cliquez une commande, puis la/les lumière(s)."};
  if(TYPES[v])return "Pose : "+TYPES[v].n+". L'outil reste actif."+(wallMounted(v)?" Près d'un mur, tapez une distance en cm puis Entrée pour poser à cette distance de l'angle.":"");
  return m[v]||"";}
function setHint(s){document.getElementById("hint").textContent=s||"";}
function buildTabs(){const el=document.getElementById("tabs");
  const items=[["chantiers","Chantiers",null],["plan","Plan",null],["boites","Boîtes","à venir"],["bandes","Bandes","à venir"],["lignes","Lignes directes","à venir"],["params","Paramètres",null]];
  el.innerHTML=items.map(([k,n,s])=>`<button data-tab="${k}" class="${tab===k?'on':''}${k==="params"?" tab-params":""}" ${s?'disabled':''}><span class="lbl">${n}</span>${s?`<span class="soon">${s}</span>`:""}</button>`).join("");
  el.querySelectorAll("button").forEach(b=>b.onclick=()=>{if(b.disabled)return;setTab(b.dataset.tab);});}
function setTab(t){tab=t;buildTabs();showSide();document.dispatchEvent(new CustomEvent("okteo:tab",{detail:tab}));if(tab==="plan")requestAnimationFrame(draw);}

// ---------- contrôles ----------
document.getElementById("bg").addEventListener("input",e=>{bgLevel=+e.target.value/100;document.getElementById("bgv").textContent=e.target.value+"%";draw();save();});
document.getElementById("sym").addEventListener("input",e=>{symCm=+e.target.value;document.getElementById("symv").textContent=e.target.value;draw();save();});
document.getElementById("ortho").addEventListener("change",e=>{ortho=e.target.checked;save();});
document.getElementById("dims").addEventListener("change",e=>{showDims=e.target.checked;draw();save();});
document.getElementById("reps").addEventListener("change",e=>{showReps=e.target.checked;draw();save();});
document.getElementById("zin").onclick=()=>{view.scale=Math.min(90,view.scale*1.15);draw();};
document.getElementById("zout").onclick=()=>{view.scale=Math.max(2,view.scale/1.15);draw();};
document.getElementById("zfit").onclick=fit;
document.getElementById("undo").onclick=()=>{if(!undo.length)return;redo.push(packState());applyPack(undo.pop());markDirty();draw();showSide();};
document.getElementById("redo").onclick=()=>{if(!redo.length)return;undo.push(packState());applyPack(redo.pop());markDirty();draw();showSide();};
document.getElementById("export").onclick=()=>{const data={chantier:CH.nom+"_"+CH.numero,murs:{nodes:state.nodes,segs:state.segs,epaisseur:state.wallEp},pieces:state.rooms,ouvertures:state.openings,appareils:state.app,reperes:repMap(),liaisons:state.lia,cotes:state.dims};
  const t=JSON.stringify(data,null,2);navigator.clipboard?.writeText(t).then(()=>setHint("Chantier (JSON) copié."),()=>{document.getElementById("sidebody").innerHTML=`<h3>Export JSON</h3><textarea style="width:100%;height:60vh;font-family:var(--fm);font-size:11px" readonly>${t.replace(/</g,"&lt;")}</textarea>`;});};
document.getElementById("theme").onclick=()=>{const r=document.documentElement;const cur=r.getAttribute("data-theme")||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");r.setAttribute("data-theme",cur==="dark"?"light":"dark");draw();};
document.addEventListener("keydown",e=>{if(/input|select|textarea/i.test(e.target.tagName))return;
  const k=e.key.toLowerCase(),grp=multi.size>1||(sel&&sel.kind==="room");
  // saisie de longueur pendant le tracé d'un mur
  if(tool==="mur"&&draftFrom){if(/^[0-9]$/.test(e.key)||e.key==="."){typed+=e.key;draw();return;}
    if(e.key==="Backspace"){typed=typed.slice(0,-1);draw();return;}
    if(e.key==="Enter"&&typed!==""){const f=nodeById(draftFrom);let[ox,oy]=applyOrtho(f.x,f.y,draftPt?draftPt.x:f.x+1,draftPt?draftPt.y:f.y);
      let dx=ox-f.x,dy=oy-f.y;const d=Math.hypot(dx,dy)||1,L=+typed,nx=f.x+dx/d*L,ny=f.y+dy/d*L;const nd=node(nx,ny);snapshot();state.segs.push({id:uidS(),a:draftFrom,b:nd.id});draftFrom=nd.id;typed="";markDirty();draw();return;}}
  // saisie d'une distance à l'angle pendant la pose d'un appareil mural
  if(TYPES[tool]&&wallMounted(tool)&&!e.ctrlKey){
    if(/^[0-9]$/.test(e.key)&&ghost&&ghost.seg){typed+=e.key;const m=wallMeasure(ghost.seg,ghost.x,ghost.y);showText("⌨ "+typed+" cm de l'angle le plus proche · Entrée pour poser");return;}
    if(e.key==="Backspace"&&typed!==""){typed=typed.slice(0,-1);if(typed==="")hideReadout();else showText("⌨ "+typed+" cm de l'angle le plus proche · Entrée pour poser");return;}
    if(e.key==="Enter"&&typed!==""&&ghost&&ghost.seg){const m=wallMeasure(ghost.seg,ghost.x,ghost.y);
      if(m){snapshot();const p=posOnWall(m,m.dA<=m.dB,(+typed)/100);const na=placeApp(tool,{x:p.x,y:p.y,seg:ghost.seg});setSingle("app",na.id);markDirty();}
      typed="";hideReadout();draw();showSide();return;}}
  if(e.key==="Escape"){
    if(seriesMode){seriesMode=null;seriesPrev=null;hideReadout();setHint(hintFor(tool));draw();return;}
    if(typed!==""){typed="";hideReadout();draw();return;}
    if(tool==="mur"&&draftFrom){draftFrom=null;draftPt=null;hideReadout();draw();return;}
    if(dimDraft){dimDraft=null;hideReadout();draw();return;}
    clearSel();resetTransient();if(tool!=="sel"){tool="sel";buildTools();}setHint(hintFor("sel"));draw();showSide();return;}
  if((e.key==="Delete"||e.key==="Backspace")&&(sel||multi.size>1)){e.preventDefault();delSel();return;}
  if(sel&&sel.kind==="open"&&!e.ctrlKey){const o=state.openings.find(x=>x.id===sel.id);
    if(o&&k==="g"){snapshot();o.hinge=o.hinge==="g"?"d":"g";markDirty();draw();showSide();return;}
    if(o&&k==="s"){snapshot();o.swing=o.swing==="int"?"ext":"int";markDirty();draw();showSide();return;}}
  if(e.ctrlKey&&k==="z"&&!e.shiftKey){e.preventDefault();document.getElementById("undo").click();return;}
  if(e.ctrlKey&&(k==="y"||(e.shiftKey&&k==="z"))){e.preventDefault();document.getElementById("redo").click();return;}
  if(e.ctrlKey&&k==="a"){e.preventDefault();if(tool!=="sel"){tool="sel";buildTools();setHint(hintFor("sel"));}selectAll();return;}
  if(e.ctrlKey&&k==="c"){const G=currentGroup();if(!groupEmpty(G)){clip=serializeGroup(G);e.preventDefault();setHint("Copié ("+groupCount(G)+" objet"+(groupCount(G)>1?"s":"")+"). Ctrl+V colle sous le curseur.");}return;}
  if(e.ctrlKey&&k==="v"&&clip&&clip.nodes){e.preventDefault();snapshot();const dx=Math.round((lastW.x-clip.cx)/gridM)*gridM,dy=Math.round((lastW.y-clip.cy)/gridM)*gridM;
    instantiateGroup(clip,dx,dy);if(tool!=="sel"){tool="sel";buildTools();}markDirty();draw();showSide();return;}
  if(e.ctrlKey&&k==="d"){e.preventDefault();duplicateGroup();return;}
  if(grp&&!e.ctrlKey){if(k==="r"){transformGroup(e.shiftKey?"ccw":"cw");return;}if(k==="x"){transformGroup("mx");return;}if(k==="y"){transformGroup("my");return;}}
  const map={v:"sel",e:"piece",b:"mur",o:"porte",f:"fenetre",c:"cote",m:"pan",l:"lien",p:"PC16",r:"LUM",i:"INT"};
  if(map[k]&&!e.ctrlKey&&!e.altKey){resetTransient();tool=map[k];testMode=false;if(tool!=="sel")clearSel();buildTools();setHint(hintFor(tool));draw();showSide();}});

// init
load();buildTools();buildTabs();
document.getElementById("bg").value=Math.round(bgLevel*100);document.getElementById("bgv").textContent=Math.round(bgLevel*100)+"%";
document.getElementById("sym").value=Math.round(symCm);document.getElementById("symv").textContent=Math.round(symCm);
document.getElementById("ortho").checked=ortho;document.getElementById("dims").checked=showDims;document.getElementById("reps").checked=showReps;
{const bd=document.querySelector(".badge");if(bd){bd.textContent=CH.nom+(CH.numero?" · "+CH.numero:"");bd.title="Chantier ouvert ("+(CH.client||"pavillonneur ?")+") : cliquez pour changer de chantier";bd.onclick=()=>setTab("chantiers");}}
document.title="Oktéo AI · "+CH.nom;
fit();setHint(hintFor(tool));paintStatus();showSide();
if(CH.fond&&CH.fond.src==="idb")CHS.getFile("fond:"+CH.id).then(bl=>{if(!bl)return;FOND=URL.createObjectURL(bl);fit();document.dispatchEvent(new CustomEvent("okteo:fond"));}).catch(()=>{});
// nouveau fond pas encore à l'échelle : on enchaîne directement sur la mise à l'échelle
if(CH.fond&&!CH.fond.calibre){tool="calib";buildTools();setHint("Nouveau fond : "+hintFor("calib"));}
addEventListener("resize",draw);
// la zone de dessin change de taille quand le panneau de droite s'ouvre, se ferme ou s'élargit
if(window.ResizeObserver)new ResizeObserver(()=>draw()).observe(document.querySelector(".stage"));

// ---------- interface publique (extensions : assistant, palette, paramètres ; tests) ----------
function zoomToBox(x0,y0,x1,y1){syncVB();const pad=0.8,w=Math.max(1.5,x1-x0),h=Math.max(1.5,y1-y0);
  view.scale=Math.min(90,Math.min(VB.w/(w+pad*2),VB.h/(h+pad*2)));view.cx=(x0+x1)/2;view.cy=(y0+y1)/2;draw();}
function objBox(id){const k=String(id)[0];
  if(k==="a"){const a=state.app.find(x=>x.id===id);return a&&{kind:"app",x0:a.x,y0:a.y,x1:a.x,y1:a.y};}
  if(k==="r"){const r=state.rooms.find(x=>x.id===id);return r&&{kind:"room",x0:Math.min(r.x0,r.x1),y0:Math.min(r.y0,r.y1),x1:Math.max(r.x0,r.x1),y1:Math.max(r.y0,r.y1)};}
  if(k==="s"){const s=segById(id);if(!s)return null;const a=nodeById(s.a),b=nodeById(s.b);return a&&b&&{kind:"seg",x0:Math.min(a.x,b.x),y0:Math.min(a.y,b.y),x1:Math.max(a.x,b.x),y1:Math.max(a.y,b.y)};}
  if(k==="o"){const c=openCenter(id);return c&&{kind:"open",x0:c.x,y0:c.y,x1:c.x,y1:c.y};}
  if(k==="d"){const d=state.dims.find(x=>x.id===id);return d&&{kind:"dim",x0:Math.min(d.a.x,d.b.x),y0:Math.min(d.a.y,d.b.y),x1:Math.max(d.a.x,d.b.x),y1:Math.max(d.a.y,d.b.y)};}
  if(k==="n"){const n=nodeById(id);return n&&{kind:"node",x0:n.x,y0:n.y,x1:n.x,y1:n.y};}
  return null;}
window.okteo={
  state,TYPES,PAL,layers,sv,
  get BG(){return BG},get FOND(){return FOND},ch:CH,
  chantier:(CH.nom+(CH.numero?" · "+CH.numero:"")),chantierKey:CH.id==="evrard-04949"?"evrard.04949":CH.id,
  startCalib(){resetTransient();clearSel();tool="calib";testMode=false;if(tab!=="plan")setTab("plan");buildTools();setHint(hintFor("calib"));draw();showSide();},
  applyCalib(a,b,L){calib={a,b,cur:null};return applyCalib(L);},
  setPreview(p){preview=p||null;draw();},
  roomArea,roomPoly,
  // tout ce qu'il faut pour imprimer le plan (en mètres) : murs découpés aux ouvertures, portes avec leur arc,
  // pièces (contour, surface), appareils (repère, pièce), liaisons, cotes, fond
  exportGeometry(){followWalls();
    const walls=[],joints=[],openings=[],wallDims=[];
    state.segs.forEach(seg=>{const d=segDir(seg);if(!d.a||!d.L)return;const e=epOf(seg),e2=e/2,nx=-d.uy*e2,ny=d.ux*e2;
      wallIntervals(seg).forEach(([s0,s1])=>{const ax=d.a.x+d.ux*s0,ay=d.a.y+d.uy*s0,bx=d.a.x+d.ux*s1,by=d.a.y+d.uy*s1;
        walls.push([{x:ax+nx,y:ay+ny},{x:bx+nx,y:by+ny},{x:bx-nx,y:by-ny},{x:ax-nx,y:ay-ny}]);});
      wallDims.push({x:(d.a.x+d.b.x)/2-d.uy*(e2+0.22),y:(d.a.y+d.b.y)/2+d.ux*(e2+0.22),L:d.L,ang:Math.atan2(d.uy,d.ux)});});
    state.nodes.forEach(n=>{let e=0;state.segs.forEach(s=>{if(s.a===n.id||s.b===n.id)e=Math.max(e,epOf(s));});if(e>0)joints.push({x:n.x,y:n.y,e});});
    state.openings.forEach(o=>{const seg=segById(o.seg);if(!seg)return;const d=segDir(seg);if(!d.a)return;const ep=epOf(seg),nx=-d.uy,ny=d.ux,hw=o.w/2;
      const cx=d.a.x+d.ux*o.t,cy=d.a.y+d.uy*o.t,j1={x:cx-d.ux*hw,y:cy-d.uy*hw},j2={x:cx+d.ux*hw,y:cy+d.uy*hw};
      const O={kind:o.kind,j1,j2,n:{x:nx,y:ny},ep,w:o.w};
      if(o.kind!=="fenetre"){const sdir=o.swing==="ext"?1:-1,H=o.hinge==="d"?j2:j1,F=o.hinge==="d"?j1:j2,Lp={x:H.x+nx*sdir*o.w,y:H.y+ny*sdir*o.w};
        let a0=Math.atan2(Lp.y-H.y,Lp.x-H.x),a1=Math.atan2(F.y-H.y,F.x-H.x),da=a1-a0;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
        O.hinge=H;O.leaf=Lp;O.arc=Array.from({length:13},(_,i)=>({x:H.x+Math.cos(a0+da*i/12)*o.w,y:H.y+Math.sin(a0+da*i/12)*o.w}));}
      openings.push(O);});
    const rooms=state.rooms.map(r=>{const P=roomPoly(r);return {name:r.name,poly:P,area:roomArea(r),label:r.poly?labelPoint(r.poly):{x:(r.x0+r.x1)/2,y:(r.y0+r.y1)/2}};});
    const reps=repMap();
    const apps=state.app.map(a=>({id:a.id,t:a.t,x:a.x,y:a.y,h:a.h,hDef:TYPES[a.t].h,rep:reps[a.id],name:TYPES[a.t].n,room:(roomAt(a.x,a.y)||{}).name||null}));
    const byId=Object.fromEntries(state.app.map(a=>[a.id,a]));
    const links=state.lia.map(l=>byId[l.c]&&byId[l.l]&&{a:{x:byId[l.c].x,y:byId[l.c].y},b:{x:byId[l.l].x,y:byId[l.l].y}}).filter(Boolean);
    const dims=state.dims.map(d=>({a:{...d.a},b:{...d.b},L:dist(d.a.x,d.a.y,d.b.x,d.b.y)}));
    return {walls,joints,openings,wallDims,rooms,apps,links,dims,symU:symScaleOf(),
      fond:FOND&&BG.w>0?{url:FOND,x:BG.x,y:BG.y,w:BG.w,h:BG.h}:null,
      chantier:{nom:CH.nom,numero:CH.numero||"",client:CH.client||""}};},
  // ajoute des pièces détectées ({name, cycle, poly, also}) ; replace = retire d'abord toutes les pièces existantes
  addRooms(list,{replace=false}={}){snapshot();if(replace)state.rooms=[];
    for(const r of list){const P=r.poly;state.rooms.push({id:uidR(),name:r.name,cycle:r.cycle,poly:P,also:r.also||[],auto:true,segs:[...new Set(r.cycle.map(c=>c.seg))],
      x0:Math.min(...P.map(p=>p.x)),x1:Math.max(...P.map(p=>p.x)),y0:Math.min(...P.map(p=>p.y)),y1:Math.max(...P.map(p=>p.y))});}
    preview=null;resetTransient();clearSel();if(tab!=="plan")setTab("plan");markDirty();draw();showSide();return list.length;},
  // ajoute des appareils relevés ({t,x,y,h?}) et leurs liaisons ({c,l} = indices dans list) : un seul pas d'annulation.
  // Les appareils muraux se collent au mur le plus proche (≤ 60 cm) et restent attachés à leur distance de l'angle.
  importDevices(list,links=[],{replace=false}={}){snapshot();
    if(replace){state.app=[];state.lia=[];}
    const ids=list.map(d=>{if(!TYPES[d.t])return null;const p=wallMounted(d.t)?(snapToWall(d.x,d.y)||{x:d.x,y:d.y}):{x:d.x,y:d.y};
      const na={id:uidA(),t:d.t,x:+(+p.x).toFixed(3),y:+(+p.y).toFixed(3),h:d.h||TYPES[d.t].h,auto:true};if(p.seg){na.seg=p.seg;attach(na);}state.app.push(na);return na.id;});
    let nl=0;links.forEach(l=>{const c=ids[l.c],lm=ids[l.l];if(c&&lm&&!state.lia.some(x=>x.c===c&&x.l===lm)){state.lia.push({c,l:lm});nl++;}});
    preview=null;resetTransient();clearSel();tool="sel";testMode=false;if(tab!=="plan")setTab("plan");buildTools();markDirty();draw();showSide();
    return {appareils:ids.filter(Boolean).length,muraux:state.app.filter(a=>ids.includes(a.id)&&a.seg).length,liaisons:nl};},
  measure(appId){const a=state.app.find(x=>x.id===appId);if(!a||!a.seg)return null;const m=wallMeasure(a.seg,a.x,a.y);return m&&{seg:a.seg,dA:+m.dA.toFixed(3),dB:+m.dB.toFixed(3),near:+Math.min(m.dA,m.dB).toFixed(3),side:m.side};},
  toClient(x,y){const p=worldToScreen(x,y);const r=document.querySelector(".stage").getBoundingClientRect();return p&&{x:p.x+r.left,y:p.y+r.top};},
  // ajoute au dessin le résultat d'un relevé automatique (un seul pas d'annulation)
  importWalls(r,{replace=false}={}){snapshot();
    if(replace){state.openings=[];state.segs=[];state.nodes=[];state.rooms.forEach(rm=>rm.segs=[]);state.app.forEach(a=>{delete a.seg;});}
    const ids=r.nodes.map(n=>node(n.x,n.y).id);
    const sids=r.walls.map(w=>{const id=uidS();state.segs.push({id,a:ids[w.a],b:ids[w.b],ep:w.ep});return id;});
    r.openings.forEach(o=>state.openings.push({id:uidO(),seg:sids[o.seg],t:o.t,w:o.w,kind:o.kind,hinge:"g",swing:"int"}));
    state.app.forEach(a=>{if(!a.seg||!segById(a.seg))reattach(a);});
    clampOpenings();preview=null;resetTransient();clearSel();tool="sel";testMode=false;if(tab!=="plan")setTab("plan");buildTools();markDirty();draw();showSide();
    return {murs:sids.length,ouvertures:r.openings.length};},
  saveNow(){clearTimeout(saveT);try{localStorage.setItem(KEY,JSON.stringify({s:packState(),view,bg:bgLevel,sym:symCm,ortho,dims:showDims,reps:showReps,layers}));dirty=false;paintStatus();
    CHS.update(CH.id,{updated:Date.now(),stats:{pieces:state.rooms.length,murs:state.segs.length,appareils:state.app.length}});}catch(e){}},
  get tool(){return tool},get tab(){return tab},get testMode(){return testMode},get view(){return view},set view(v){view=v},VB,
  get selection(){return sel?[sel.kind+":"+sel.id]:[...multi]},
  draw,showSide,fit,syncVB,snapshot,markDirty,repMap,roomAt,hintFor,setHint,buildTools,
  setTool(v){resetTransient();tool=v;testMode=false;if(v!=="sel")clearSel();if(tab!=="plan")setTab("plan");buildTools();setHint(hintFor(v));draw();showSide();},
  toggleTest(){resetTransient();testMode=!testMode;clearSel();buildTools();setHint(testMode?"Mode test : cliquez une commande pour voir ses lumières.":"");draw();showSide();},
  setTab,
  objBox,zoomToBox,
  // emprise du dessin + du fond de plan (pour l'image envoyée à l'IA)
  extent(){const pts=[...state.nodes,...state.app];const bb=pts.length?bbox(pts):null;const fond=layers.fond.on&&bgLevel>0&&!!FOND&&BG.w>0;
    const xs=[...(bb?[bb.x0,bb.x1]:[]),...(fond?[BG.x,BG.x+BG.w]:[])],ys=[...(bb?[bb.y0,bb.y1]:[]),...(fond?[BG.y,BG.y+BG.h]:[])];
    return xs.length?{x0:Math.min(...xs),y0:Math.min(...ys),x1:Math.max(...xs),y1:Math.max(...ys)}:{x0:0,y0:0,x1:PLAN.w,y1:PLAN.h};},
  select(ids){clearSel();resetTransient();const keys=ids.map(id=>{const b=objBox(id);return b?b.kind+":"+id:null;}).filter(Boolean);
    keys.forEach(k=>multi.add(k));normalizeSel();if(tool!=="sel"){tool="sel";testMode=false;buildTools();}if(tab!=="plan")setTab("plan");draw();showSide();return keys.length;},
  zoomTo(ids){const bs=ids.map(objBox).filter(Boolean);if(!bs.length)return false;if(tab!=="plan")setTab("plan");
    zoomToBox(Math.min(...bs.map(b=>b.x0)),Math.min(...bs.map(b=>b.y0)),Math.max(...bs.map(b=>b.x1)),Math.max(...bs.map(b=>b.y1)));return true;},
  renameRoom(id,name){const r=state.rooms.find(x=>x.id===id);if(!r||!name)return false;snapshot();r.name=String(name).slice(0,40);markDirty();draw();showSide();return true;},
  deleteSelection(){delSel();},
  selectAll(){if(tool!=="sel"){tool="sel";buildTools();}selectAll();},
  duplicate(){duplicateGroup();},
  transform(k){const grp=multi.size>1||(sel&&sel.kind==="room");if(!grp&&!sel)return false;transformGroup(k);return true;},
  undo(){document.getElementById("undo").click();},redo(){document.getElementById("redo").click();},
  clearSel(){clearSel();resetTransient();draw();showSide();},
  toggle(name){const el=document.getElementById(name);if(el){el.checked=!el.checked;el.dispatchEvent(new Event("change"));}},
  zoom(f){view.scale=Math.max(2,Math.min(90,view.scale*f));draw();},
};
// accès historique pour les tests automatiques
window.__okteo={state,draw};
document.dispatchEvent(new CustomEvent("okteo:ready"));
