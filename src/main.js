import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

/* ============================================================
   MORPHFLIGHT — vertical-slice prototype (v5 logic)
   Single file on purpose: Claude Code's first job is to split
   this into modules (see README). Until then, the knobs you'll
   reach for most live in CFG right below.
   ============================================================ */

const CFG = {
  // --- feel ---
  FOV: 90,            // wide-angle = cavernous. Try 80–85 if too fish-eye.
  FOG: 0.015,         // lower = see deeper into the hall
  SPEED: 27,          // forward scroll speed
  FIRE_INT: 0.15,     // seconds between disk volleys (higher = slower cadence)
  FIRE_INT_ORB: 0.08, // orb cadence — faster than the disks
  ORB_BIAS: 18,       // how hard the orb stream leans toward your travel direction
  ORB_PITCH: 0.25,    // how far the orb noses up/down with vertical movement (radians; negate to invert)
  ORB_PITCH_IN: 10,   // how fast it leans into the movement
  ORB_LEVEL: 5,       // how fast the orb snaps back to level after you let go

  // --- camera ---
  CAM_LOOK_UP: -0.5,  // default upward aim (target sits this far above the camera) — higher = faces up more
  CAM_TILT: 5,        // extra up/down aim when moving vertically
  CAM_TILT_IN: 6,     // how fast the view tilts toward full while moving (higher = snappier)
  CAM_TILT_OUT: 3,    // how fast it eases back to default when you stop (higher = quicker settle)
  CAM_LOOK_AHEAD: 50, // how far ahead the camera aims
  CAM_RECENTER: 3,    // how fast the view pans to re-center the orb after you stop moving
  CAM_RECENTER_AMT: 0.6,// idle re-center strength (1 = orb dead-center, 0 = off; lower keeps the resting tilt)
  CAM_HEIGHT: 2.5,    // resting camera height — its start Y and the idle vertical-follow base
  CAM_BACK: 11,       // how far behind the orb the camera sits (start Z)
  CAM_LEAD_X: 0.3,    // horizontal follow: fraction of your x offset the camera trails (orb leads sideways)
  CAM_LEAD_Y: 0.26,   // vertical follow while moving: fraction of your y offset (orb leads vertically)
  CAM_DAMP: 4,        // how fast the camera position chases its follow target (higher = stiffer)
  CAM_MAX_OFFSET: 4,  // max world-units the orb may ride off vertical centre — caps the lead so it pins at the edge instead of leading then rebounding (lower = orb stays more centred)

  // --- you take a hit when your orb/shape clips a column or enemy ---
  HIT_Z: 1.6,         // depth window for a body collision
  HIT_XY: 1.1,        // how close in x/y an enemy must be to clip you

  // --- enemies ---
  WAVE_AIM: 0.4,      // how strongly each wave leans toward your altitude (1 = dead-on, 0 = always centered)

  // --- the column field ---
  NUM_COLLIDABLE: 7,  // real in-lane obstacles you dodge
  NUM_AESTHETIC: 65,  // <<< side framing columns — the "infinite forest" lives HERE
  AES_X_MIN: 16,      // nearest a side pillar sits to center (just outside the lane)
  AES_X_RANGE: 130,   // how far out side pillars scatter (16 .. 146) — wide for the forest
  COL_X_MULT: 2,      // min x-distance between in-lane columns (× radii+clearance; higher = sparser)
  COL_Z_WIN: 180,     // z-window over which that x-spacing is enforced (higher = sparser in depth)
  COL_EDGE_W: 2.4,    // neon edge thickness in px (1 = hairline)
  PILLAR_MIN: 1.35,   // base pillar radius
  PILLAR_RND: 1.8,    // + random radius
  AES_SCALE: 1.6,     // side pillars are grander

  // --- environment ---
  ENV: 'forest',      // starting environment: 'forest' | 'stalactite'
  NUM_SPIKES: 30,     // in-lane stalactites + stalagmites (the ones you weave)
  NUM_SPIKES_AES: 280,// framing spikes spread wide to the sides — the "infinite" cavern
  SPIKE_LEN_MIN: 4,   // shortest spike
  SPIKE_LEN_RND: 12,  // + random length
  SPIKE_R_MIN: 0.8,   // base spike radius (girth at the ceiling/floor)
  SPIKE_R_RND: 1.6,   // + random radius
  SPIKE_X: 17,        // in-lane spikes scatter across ±this in x
  SPIKE_AES_X_MIN: 18,    // framing spikes start just outside the lane
  SPIKE_AES_X_RANGE: 120, // ...and scatter out to ±138
  SPIKE_AES_SCALE: 1.5,   // framing spikes are grander
  CEIL_Y: 13,         // ceiling the stalactites hang from
  FLOOR_Y: -13,       // floor the stalagmites rise from

  // --- channel (bounded: two tall side walls, a vertical slot — no floor/ceiling) ---
  TRENCH_HALF: 9,     // half-width of the slot (walls at ±this)
  TRENCH_BAND: 12,    // vertical band the teeth spawn across (±this)
  NUM_TEETH: 24,      // protrusions jutting inward to break up the walls
  TOOTH_MIN: 1.5,     // min protrusion size
  TOOTH_RND: 3.5,     // + random size
  TOOTH_REACH: 4.5,   // how far a tooth juts inward from the wall

  // --- cave (bounded: constant polygon sections joined by short morphing transitions) ---
  CAVE_RINGS: 30,     // rings in flight at once
  CAVE_SPACING: 9,    // z-gap between rings
  CAVE_RADIUS: 16,    // tunnel size
  CAVE_SECTION_SEC: 12, // seconds flown through each constant polygon (crank up for long sections)
  CAVE_TRANS_SEC: 7,    // seconds of morphing transition between polygons
  CAVE_IRREG: 0.7,      // wall jaggedness — vertex radius varies ±this (0 = regular/round; higher = more angular). PRIMARY roundness control
  CAVE_ANGLE_JIT: 0.6,  // angular jitter of wall vertices (fraction of even spacing) — adds to the jaggedness
  CAVE_MIN_EDGE: 0.3,   // guardrail only: reject degenerate tiny edges (LOWER = allows MORE angularity)
  CAVE_MAX_ANGLE: 168,  // guardrail only: reject near-flat corners (HIGHER = allows MORE angularity)
  CAVE_NUM_BUMPS: 14,   // low pyramids protruding from the walls (sparser than the channel teeth)
  CAVE_BUMP_BASE: 1.5,  // base scale (× the unit pyramid)
  CAVE_BUMP_RND: 1.6,   // + random
  CAVE_BUMP_H: 3.2,     // protrusion height

  // --- asteroid void (sketch) ---
  NUM_ASTEROIDS: 44,  // floating rocks
  AST_MIN: 1.5,       // min size
  AST_RND: 4.5,       // + random size
  AST_X: 60,          // spread across ±this in x
  AST_Y: 24,          // spread across ±this in y

  // --- bounds / depth ---
  LANE_X: 15, LANE_Y: 11,
  FARZ: -260, NEARZ: 14,
};

const COL={ orb:0x39b6ff, diskh:0x3dffa0, diskv:0x3dffa0, charge:0xff3d8b, enemy:0xff4fb6 };
const MODE={ORB:0,DISKH:1,DISKV:2};
const NAME=['ORB','DISK-H','DISK-V'];
const MCOL=[COL.orb,COL.diskh,COL.diskv];
const MCSS=['var(--orb)','var(--diskh)','var(--diskv)'];
const MFORM=['swarm','row','stack'];
const ORB_W=1.4;

const app=document.getElementById('app');
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x05060a,CFG.FOG);

const camera=new THREE.PerspectiveCamera(CFG.FOV,innerWidth/innerHeight,0.1,700);
camera.position.set(0,CFG.CAM_HEIGHT,CFG.CAM_BACK); camera.lookAt(0,0,-40);

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.setClearColor(0x05060a,1);
app.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x2a201a,0.85));
const playerLight=new THREE.PointLight(0xffb070,1.7,90,1.6); scene.add(playerLight);
const moodA=new THREE.PointLight(0xb2342a,0.6,200,2); moodA.position.set(40,20,-90); scene.add(moodA);
const moodB=new THREE.PointLight(0x4a5460,0.45,200,2); moodB.position.set(-42,-22,-140); scene.add(moodB);

/* ---------- player rig ---------- */
const player=new THREE.Group(); scene.add(player);
// neon octagon (orb mode) — flat polygon facing the camera, bright with a faint outer glow ring
const octEdges=r=>new THREE.EdgesGeometry(new THREE.CircleGeometry(r,8));
const orbMesh=new THREE.LineSegments(octEdges(0.85),new THREE.LineBasicMaterial({color:COL.orb}));
const orbHalo=new THREE.LineSegments(octEdges(1.15),new THREE.LineBasicMaterial({color:COL.orb,transparent:true,opacity:0.3}));
const orbGroup=new THREE.Group(); orbGroup.add(orbMesh,orbHalo);
// neon green disk — octagon outline, baked flat (XZ plane) so the morph rotation logic still holds
const diskCircle=new THREE.CircleGeometry(1.35,8); diskCircle.rotateX(Math.PI/2);
const diskLine=new THREE.LineSegments(new THREE.EdgesGeometry(diskCircle),new THREE.LineBasicMaterial({color:COL.diskh}));
const diskGroup=new THREE.Group(); diskGroup.add(diskLine); diskGroup.visible=false;
player.add(orbGroup,diskGroup);

let mode=MODE.ORB,lastMode=-1;
function applyModeVisual(){
  if(mode===lastMode)return; lastMode=mode;
  const isOrb=mode===MODE.ORB; orbGroup.visible=isOrb; diskGroup.visible=!isOrb;
  if(!isOrb){ diskLine.material.color.setHex(MCOL[mode]);
    if(mode===MODE.DISKH) diskGroup.rotation.set(0,0,0); else diskGroup.rotation.set(0,0,Math.PI/2); }
  playerLight.color.setHex(isOrb?0xffb070:MCOL[mode]);
  const t=document.getElementById('modeTxt'); t.textContent=NAME[mode]; t.style.color=MCSS[mode];
}

/* ---------- the great hall: spaced pillars + edge framing ---------- */
const colFillGeo=new THREE.CylinderGeometry(1,1,800,8);  // solid octagonal body — tall so caps stay off-frame at pop-in
const colLineGeo=new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(colFillGeo)); // fat neon outline
// shared materials: collidable (bright, dodge these) vs framing (dimmer, melts into fog). colour only depends on the flag.
const edgeMats=[];  // every fat-line material, so resize can refresh their pixel-resolution
const mkEdgeMat=hex=>{ const m=new LineMaterial({color:hex,linewidth:CFG.COL_EDGE_W,fog:true}); m.resolution.set(innerWidth,innerHeight); edgeMats.push(m); return m; };
const colEdgeMatHit=mkEdgeMat(0x9af2ff), colEdgeMatAes=mkEdgeMat(0x4fbce8);
const mkFillMat=hex=>new THREE.MeshBasicMaterial({color:hex,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
const colFillMatHit=mkFillMat(0x1c5378), colFillMatAes=mkFillMat(0x0e2436);
const forestGroup=new THREE.Group(); scene.add(forestGroup);
const pillars=[];
function placePillar(p,anywhere){
  p.r=(CFG.PILLAR_MIN+Math.random()*CFG.PILLAR_RND)*(p.aesthetic?CFG.AES_SCALE:1.0);
  p.mesh.scale.set(p.r,1,p.r);
  p.mesh.position.y=(Math.random()*2-1)*(p.aesthetic?6:3);
  p.mesh.position.z=anywhere?(CFG.FARZ+Math.random()*(CFG.NEARZ-CFG.FARZ)):(CFG.FARZ+Math.random()*55);
  p.mesh.rotation.y=Math.random()*Math.PI;
  if(p.aesthetic){
    const side=Math.random()<0.5?-1:1;
    p.mesh.position.x=side*(CFG.AES_X_MIN+Math.random()*CFG.AES_X_RANGE);
  }else{
    let x=0,ok=false,tries=0;
    do{ x=(Math.random()*2-1)*15; ok=true;
      for(const q of pillars){ if(q===p||q.aesthetic||!q.alive)continue;
        if(Math.abs(q.mesh.position.z-p.mesh.position.z)<CFG.COL_Z_WIN &&
           Math.abs(q.mesh.position.x-x)<(q.r+p.r+2*ORB_W)*CFG.COL_X_MULT){ ok=false;break; } }
      tries++; }while(!ok&&tries<14);
    p.mesh.position.x=x;
  }
  p.alive=true; p.mesh.visible=true;
}
for(let i=0;i<CFG.NUM_COLLIDABLE+CFG.NUM_AESTHETIC;i++){
  const aes=i>=CFG.NUM_COLLIDABLE;
  // solid dark body (polygonOffset keeps the neon edge on top, no z-fight) + fat neon outline as a child
  const fill=new THREE.Mesh(colFillGeo,aes?colFillMatAes:colFillMatHit);
  const line=new LineSegments2(colLineGeo,aes?colEdgeMatAes:colEdgeMatHit); fill.add(line);
  const p={mesh:fill,line:line,aesthetic:aes}; forestGroup.add(fill); placePillar(p,true); pillars.push(p);
}

/* ---------- stalactite / stalagmite field (bounded env) ---------- */
const spikeGroup=new THREE.Group(); spikeGroup.visible=false; scene.add(spikeGroup);
const spikeFillGeo=new THREE.ConeGeometry(1,1,6);  // unit hex spike, apex +y
const spikeLineGeo=new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(spikeFillGeo));
const spikeEdgeMat=mkEdgeMat(0x6fe0ff), spikeFillMat=mkFillMat(0x000000); // solid black body, blue neon edge (matches the cave)
const spikes=[];
function placeSpike(s,anywhere){
  const sc=s.aesthetic?CFG.SPIKE_AES_SCALE:1;
  s.len=(CFG.SPIKE_LEN_MIN+Math.random()*CFG.SPIKE_LEN_RND)*sc;
  s.r=(CFG.SPIKE_R_MIN+Math.random()*CFG.SPIKE_R_RND)*sc;
  s.ceiling=Math.random()<0.5;                                   // hang from ceiling vs rise from floor
  s.mesh.scale.set(s.r,s.len,s.r);
  s.mesh.rotation.set(s.ceiling?Math.PI:0,Math.random()*Math.PI*2,0); // flip ceiling spikes so the tip points down
  s.mesh.position.x=s.aesthetic
    ? (Math.random()<0.5?-1:1)*(CFG.SPIKE_AES_X_MIN+Math.random()*CFG.SPIKE_AES_X_RANGE) // wide framing, both sides
    : (Math.random()*2-1)*CFG.SPIKE_X;                                                   // in-lane
  s.mesh.position.y=s.ceiling?(CFG.CEIL_Y-s.len/2):(CFG.FLOOR_Y+s.len/2); // base flush to ceiling/floor
  s.mesh.position.z=anywhere?(CFG.FARZ+Math.random()*(CFG.NEARZ-CFG.FARZ)):(CFG.FARZ+Math.random()*55);
  s.mesh.visible=true;
}
for(let i=0;i<CFG.NUM_SPIKES+CFG.NUM_SPIKES_AES;i++){
  const fill=new THREE.Mesh(spikeFillGeo,spikeFillMat);
  const line=new LineSegments2(spikeLineGeo,spikeEdgeMat); fill.add(line);
  const s={mesh:fill,line:line,aesthetic:i>=CFG.NUM_SPIKES}; spikeGroup.add(fill); placeSpike(s,true); spikes.push(s);
}
// solid BLACK floor + ceiling, each with a dense BLUE grid floating on it (Tron look, matches the cave)
const capMat=new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
const capGeo=new THREE.PlaneGeometry(700,700);
for(const y of [CFG.CEIL_Y,CFG.FLOOR_Y]){ const m=new THREE.Mesh(capGeo,capMat); m.rotation.x=Math.PI/2; m.position.y=y; spikeGroup.add(m); }
const CAP_CELL=10;                              // channel wall-grid cell
const FLOOR_DIV=140, FLOOR_CELL=700/FLOOR_DIV;  // denser floor/ceiling grid (5-unit cells)
const mkGrid=y=>{ const g=new THREE.GridHelper(700,FLOOR_DIV,0x4fbce8,0x4fbce8); g.position.y=y; g.material.transparent=true; g.material.opacity=0.5; spikeGroup.add(g); return g; };
const ceilGrid=mkGrid(CFG.CEIL_Y), floorGrid=mkGrid(CFG.FLOOR_Y);
let capScroll=0;

/* ---------- channel (bounded env): two tall side walls forming a vertical slot, teeth jut inward ---------- */
const trenchGroup=new THREE.Group(); trenchGroup.visible=false; scene.add(trenchGroup);
const wallMat=new THREE.MeshBasicMaterial({color:0x0c2236,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
const wallGeo=new THREE.PlaneGeometry(700,800);  // tall enough that top/bottom never frame — a slot, not a trench
const wallGrids=[];
for(const sx of [-1,1]){
  const w=new THREE.Mesh(wallGeo,wallMat); w.rotation.y=sx*Math.PI/2; w.position.x=sx*CFG.TRENCH_HALF; trenchGroup.add(w);
  const g=new THREE.GridHelper(700,70,0x6fe0ff,0x2f6f9e); g.rotation.z=Math.PI/2; g.position.x=sx*CFG.TRENCH_HALF; // stand the grid up on the wall
  g.material.transparent=true; g.material.opacity=0.5; trenchGroup.add(g); wallGrids.push(g);
}
// teeth: solid neon blocks jutting inward from the walls (the things you thread)
const toothFillGeo=new THREE.BoxGeometry(1,1,1);
const toothLineGeo=new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(toothFillGeo));
const toothFillMat=mkFillMat(0x1c5378), toothEdgeMat=mkEdgeMat(0x9af2ff);
const teeth=[];
function placeTooth(t,anywhere){
  t.side=Math.random()<0.5?-1:1;
  t.reach=CFG.TOOTH_MIN+Math.random()*CFG.TOOTH_REACH;       // how far it juts inward
  t.h=CFG.TOOTH_MIN+Math.random()*CFG.TOOTH_RND*1.4;         // height
  t.w=CFG.TOOTH_MIN+Math.random()*CFG.TOOTH_RND;             // length along the corridor (z)
  t.mesh.scale.set(t.reach,t.h,t.w);
  t.mesh.position.x=t.side*(CFG.TRENCH_HALF-t.reach/2);       // outer face flush to the wall
  t.mesh.position.y=(Math.random()*2-1)*CFG.TRENCH_BAND;     // anywhere up/down the visible slot
  t.mesh.position.z=anywhere?(CFG.FARZ+Math.random()*(CFG.NEARZ-CFG.FARZ)):(CFG.FARZ+Math.random()*55);
  t.mesh.visible=true;
}
for(let i=0;i<CFG.NUM_TEETH;i++){
  const fill=new THREE.Mesh(toothFillGeo,toothFillMat);
  const line=new LineSegments2(toothLineGeo,toothEdgeMat); fill.add(line);
  const t={mesh:fill,line:line}; trenchGroup.add(fill); placeTooth(t,true); teeth.push(t);
}
let trenchScroll=0;

/* ---------- cave (bounded env): a tunnel whose cross-section morphs along the flight ---------- */
const caveGroup=new THREE.Group(); caveGroup.visible=false; scene.add(caveGroup);
const caveEdgeMat=mkEdgeMat(0x6fe0ff);
// irregular section polygons (4–8 sides) via rejection sampling: no tiny edges, no near-flat corners
function polyOK(p){
  const n=p.length;
  for(let i=0;i<n;i++){
    const a=p[i],b=p[(i+1)%n],pr=p[(i-1+n)%n];
    if(Math.hypot(b[0]-a[0],b[1]-a[1])<CFG.CAVE_MIN_EDGE) return false;
    const v1x=pr[0]-a[0],v1y=pr[1]-a[1],v2x=b[0]-a[0],v2y=b[1]-a[1];
    let c=(v1x*v2x+v1y*v2y)/(Math.hypot(v1x,v1y)*Math.hypot(v2x,v2y)); c=Math.max(-1,Math.min(1,c));
    if(Math.acos(c)*180/Math.PI>CFG.CAVE_MAX_ANGLE) return false;
  }
  return true;
}
function makeCavePoly(n){
  for(let a=0;a<400;a++){ const p=[];
    for(let i=0;i<n;i++){ const ang=(i+(Math.random()-0.5)*CFG.CAVE_ANGLE_JIT)*(2*Math.PI/n), r=1+(Math.random()*2-1)*CFG.CAVE_IRREG; p.push([Math.cos(ang)*r,Math.sin(ang)*r]); }
    if(polyOK(p)) return p;
  }
  return Array.from({length:n},(_,i)=>{ const ang=i*2*Math.PI/n; return [Math.cos(ang),Math.sin(ang)]; }); // fallback: regular
}
const CAVE_POLYS=[4,4,5,5,6,6].map(makeCavePoly);  // max 6 sides — fewer sides reads more angular
const CAVE_M=24;  // perimeter resample resolution (lets different-sided polys morph point-for-point)
function resamplePoly(poly){
  const n=poly.length, edges=[]; let total=0;
  for(let i=0;i<n;i++){ const a=poly[i],b=poly[(i+1)%n],L=Math.hypot(b[0]-a[0],b[1]-a[1]); edges.push([a,b,L]); total+=L; }
  const out=[];
  for(let k=0;k<CAVE_M;k++){ let d=k/CAVE_M*total,i=0; while(i<n-1&&d>edges[i][2]){ d-=edges[i][2]; i++; } const e=edges[i],f=e[2]>0?d/e[2]:0; out.push([e[0][0]+(e[1][0]-e[0][0])*f,e[0][1]+(e[1][1]-e[0][1])*f]); }
  return out;
}
const CAVE_RES=CAVE_POLYS.map(resamplePoly);
const SECTION_D=CFG.CAVE_SECTION_SEC*CFG.SPEED, TRANS_D=CFG.CAVE_TRANS_SEC*CFG.SPEED;
const UNIT_D=SECTION_D+TRANS_D, PERIOD_D=UNIT_D*CAVE_RES.length;
function caveCross(track){  // cross-section (resampled point list) at a track distance: constant in a section, lerped in a transition
  let p=((track%PERIOD_D)+PERIOD_D)%PERIOD_D; const idx=Math.floor(p/UNIT_D), within=p-idx*UNIT_D;
  const A=CAVE_RES[idx], B=CAVE_RES[(idx+1)%CAVE_RES.length];
  if(within<SECTION_D) return {pts:A,A,B,trans:false};
  const t=(within-SECTION_D)/TRANS_D, s=t*t*(3-2*t);
  return {pts:A.map((a,j)=>[a[0]+(B[j][0]-a[0])*s,a[1]+(B[j][1]-a[1])*s]),A,B,trans:true};
}
function ringPositions(track){
  const c=caveCross(track),R=CFG.CAVE_RADIUS,P=c.pts,M=P.length,arr=[];
  for(let k=0;k<M;k++){ const m=(k+1)%M; arr.push(P[k][0]*R,P[k][1]*R,0,P[m][0]*R,P[m][1]*R,0); }      // cross-section outline
  if(c.trans){ const N=caveCross(track+CFG.CAVE_SPACING).pts;                                            // transitions also draw the "vectors between nodes" forward to the next ring
    for(let k=0;k<M;k++) arr.push(P[k][0]*R,P[k][1]*R,0, N[k][0]*R,N[k][1]*R,-CFG.CAVE_SPACING); }
  return arr;
}
const rings=[];
for(let i=0;i<CFG.CAVE_RINGS;i++){
  const track=i*CFG.CAVE_SPACING, geo=new LineSegmentsGeometry(); geo.setPositions(ringPositions(track));
  const r={mesh:new LineSegments2(geo,caveEdgeMat),geo,track}; r.mesh.frustumCulled=false;
  r.mesh.position.z=CFG.NEARZ-i*CFG.CAVE_SPACING;
  caveGroup.add(r.mesh); rings.push(r);
}
const CAVE_SPAN=CFG.CAVE_RINGS*CFG.CAVE_SPACING;
// low pyramids protruding inward from the walls — solid black + blue edge, like the tunnel
let caveScroll=0;  // total tunnel scroll (advances only in cave env) — keeps bumps glued to the right wall section
const bumpFillMat=mkFillMat(0x000000), bumpEdgeMat=mkEdgeMat(0x6fe0ff);
// a unit pyramid with an IRREGULAR n-gon base (base radii in [1,2] → edge lengths vary ~x..2x); apex +y, base -y
function makePyramid(n){
  const base=[];
  for(let i=0;i<n;i++){ const a=(i+(Math.random()-0.5)*0.5)*(2*Math.PI/n), r=1+Math.random(); base.push([Math.cos(a)*r,Math.sin(a)*r]); }
  const pos=[];
  for(let i=0;i<n;i++){ const p0=base[i],p1=base[(i+1)%n]; pos.push(0,0.5,0, p0[0],-0.5,p0[1], p1[0],-0.5,p1[1]); } // side faces
  for(let i=1;i<n-1;i++){ const p0=base[0],p1=base[i],p2=base[i+1]; pos.push(p0[0],-0.5,p0[1], p2[0],-0.5,p2[1], p1[0],-0.5,p1[1]); } // base cap so the base outline renders as edges
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.computeVertexNormals();
  const l=new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(g));
  let dia=0; for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){ const d=Math.hypot(base[i][0]-base[j][0],base[i][1]-base[j][1]); if(d>dia)dia=d; }
  return {f:g,l,dia};
}
const bumps=[], _vx=new THREE.Vector3(), _vy=new THREE.Vector3(), _vz=new THREE.Vector3(), _m4=new THREE.Matrix4(), _qB=new THREE.Quaternion(), _qT=new THREE.Quaternion(), _yU=new THREE.Vector3(0,1,0);
const snapHalf=tr=>(Math.round(tr/CFG.CAVE_SPACING-0.5)+0.5)*CFG.CAVE_SPACING;  // nearest half-cell → sits BETWEEN ring hoops, never on a line
function bumpClear(self,cx,cy,cz,rad){  // true if a base footprint at (cx,cy,cz)/rad doesn't collide with any other pyramid
  for(const o of bumps){ if(o===self||o.rad===undefined) continue;
    const ex=cx-o.cx,ey=cy-o.cy,ez=cz-o.cz,rr=rad+o.rad;
    if(ex*ex+ey*ey+ez*ez<rr*rr) return false; }
  return true;
}
function placeBump(b,anywhere){
  const span=CFG.NEARZ-CFG.FARZ, R=CFG.CAVE_RADIUS;
  for(let attempt=0;attempt<16;attempt++){
    const track=snapHalf(anywhere?(caveScroll+Math.random()*span):(caveScroll+span-Math.random()*40));
    const z=CFG.NEARZ-track+caveScroll, pts=caveCross(track).pts, M=pts.length;  // z from track+scroll → glued to this wall section
    // pick a wall edge, then merge its collinear neighbours to recover the whole flat FACE this bump sits on
    const dirOf=i=>{ const a=pts[i],c=pts[(i+1)%M],ex=c[0]-a[0],ey=c[1]-a[1],L=Math.hypot(ex,ey)||1; return [ex/L,ey/L]; };
    let k=(Math.random()*M)|0; const d0=dirOf(k);
    const colin=i=>{ const di=dirOf(i); return Math.abs(di[0]*d0[0]+di[1]*d0[1])>0.999; };
    let lo=k,hi=k;
    for(let g=0;g<M&&colin((lo-1+M)%M);g++){ lo=(lo-1+M)%M; if(lo===hi)break; }
    for(let g=0;g<M&&colin((hi+1)%M);g++){ hi=(hi+1)%M; if(hi===lo)break; }
    const pA=pts[lo],pB=pts[(hi+1)%M], mx=(pA[0]+pB[0])/2, my=(pA[1]+pB[1])/2;
    let dx=pB[0]-pA[0],dy=pB[1]-pA[1]; const faceLen=Math.hypot(dx,dy)||1; dx/=faceLen; dy/=faceLen; // tangential along the face
    let nx=-dy,ny=dx; if(nx*mx+ny*my>0){ nx=-nx; ny=-ny; }                                          // face normal, pointing inward
    const h=CFG.CAVE_BUMP_H*(0.7+Math.random()*1.9);                                                 // height range up to 2.6× base (max doubled)
    const s=Math.min(CFG.CAVE_BUMP_BASE+Math.random()*CFG.CAVE_BUMP_RND, faceLen*R*0.85/b.dia);      // uniform base scale; diameter capped to the face so any spin still fits
    const cx=mx*R, cy=my*R, rad=s*b.dia/2;                                                           // base centre + footprint radius on the wall
    if(attempt<15 && !bumpClear(b,cx,cy,z,rad)) continue;                                            // reject overlap with other pyramids
    b.mesh.scale.set(s,h,s);
    _vx.set(dx,dy,0); _vy.set(nx,ny,0); _vz.crossVectors(_vx,_vy); _m4.makeBasis(_vx,_vy,_vz);
    _qB.setFromRotationMatrix(_m4); _qT.setFromAxisAngle(_yU,Math.random()*Math.PI*2);
    b.mesh.quaternion.copy(_qB).multiply(_qT);   // seat flat on the face, then random spin about the wall normal
    b.mesh.position.set(cx+nx*(h/2),cy+ny*(h/2),z);
    b.cx=cx; b.cy=cy; b.cz=z; b.rad=rad; b.mesh.visible=true;
    return;
  }
}
for(let i=0;i<CFG.CAVE_NUM_BUMPS;i++){
  const py=makePyramid(Math.random()<0.5?3:4);
  const fill=new THREE.Mesh(py.f,bumpFillMat); const line=new LineSegments2(py.l,bumpEdgeMat); fill.add(line);
  const b={mesh:fill,line,dia:py.dia}; caveGroup.add(fill); placeBump(b,true); bumps.push(b);
}

/* ---------- asteroid void (sketch env): tumbling rocks drifting past ---------- */
const astGroup=new THREE.Group(); astGroup.visible=false; scene.add(astGroup);
const astFillMat=mkFillMat(0x000000), astEdgeMat=mkEdgeMat(0x6fe0ff);
const astShapes=[new THREE.IcosahedronGeometry(1,0),new THREE.DodecahedronGeometry(1,0),new THREE.OctahedronGeometry(1,0)]
  .map(g=>({f:g,l:new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(g))}));
const asteroids=[];
function placeAsteroid(a,anywhere){
  const sz=CFG.AST_MIN+Math.random()*CFG.AST_RND;
  a.mesh.scale.set(sz*(0.7+Math.random()*0.6),sz*(0.7+Math.random()*0.6),sz*(0.7+Math.random()*0.6)); // irregular
  a.mesh.position.set((Math.random()*2-1)*CFG.AST_X,(Math.random()*2-1)*CFG.AST_Y,
    anywhere?(CFG.FARZ+Math.random()*(CFG.NEARZ-CFG.FARZ)):(CFG.FARZ+Math.random()*40));
  a.mesh.rotation.set(Math.random()*6.28,Math.random()*6.28,Math.random()*6.28);
  a.sx=(Math.random()-0.5)*0.6; a.sy=(Math.random()-0.5)*0.6; a.sz=(Math.random()-0.5)*0.6;          // tumble rates
  a.mesh.visible=true;
}
for(let i=0;i<CFG.NUM_ASTEROIDS;i++){
  const sh=astShapes[(Math.random()*astShapes.length)|0];
  const fill=new THREE.Mesh(sh.f,astFillMat); const line=new LineSegments2(sh.l,astEdgeMat); fill.add(line);
  const a={mesh:fill,line}; astGroup.add(fill); placeAsteroid(a,true); asteroids.push(a);
}

/* ---------- pools ---------- */
const boltGeo=new THREE.BoxGeometry(0.12,0.12,1.7); const projs=[];
function spawnProj(vx,vy,vz,color){
  let p=projs.find(o=>!o.alive);
  if(!p){ const mat=new THREE.MeshBasicMaterial({transparent:true,opacity:0.95,blending:THREE.AdditiveBlending});
          p={mesh:new THREE.Mesh(boltGeo,mat),alive:false}; scene.add(p.mesh); projs.push(p); }
  p.mesh.material.color.setHex(color); p.mesh.position.copy(player.position);
  p.vx=vx;p.vy=vy;p.vz=vz;p.alive=true;p.mesh.visible=true;p.life=2.4;
  p.mesh.lookAt(p.mesh.position.x+vx,p.mesh.position.y+vy,p.mesh.position.z+vz);
}
const enemyShapes=[new THREE.IcosahedronGeometry(0.66,0),new THREE.DodecahedronGeometry(0.64,0),new THREE.OctahedronGeometry(0.74,0)]; const enemies=[];
function spawnEnemy(x,y,z,formation){
  let e=enemies.find(o=>!o.alive);
  if(!e){ const g=enemyShapes[(Math.random()*enemyShapes.length)|0];
    e={mesh:new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:COL.enemy,wireframe:true})),alive:false};scene.add(e.mesh);enemies.push(e);}
  e.mesh.position.set(x,y,z); e.mesh.material.color.setHex(COL.enemy);
  e.hp=60;e.alive=true;e.mesh.visible=true;e.formation=formation;
  e.bx=x;e.by=y;e.phase=Math.random()*6.28;e.spin=0.01+Math.random()*0.04;
}

/* ---------- formations ---------- */
let waveTimer=0.8,waveIx=0; const WAVES=['row','stack','swarm'];
function spawnWave(kind){
  const z=CFG.FARZ+12;
  // aim each wave at your current altitude (× WAVE_AIM) so there's no safe corner to park in
  const cy=THREE.MathUtils.clamp(player.position.y*CFG.WAVE_AIM,-CFG.LANE_Y,CFG.LANE_Y);
  if(kind==='row'){ for(let i=-5;i<=5;i++) spawnEnemy(i*2.8,cy,z,'row'); }            // wide horizontal wall (x ±14) — match DISK-H
  else if(kind==='stack'){ for(let i=-5;i<=5;i++) spawnEnemy(0,cy+i*1.9,z,'stack'); } // tall vertical wall (y ±9.5) — match DISK-V
  else { for(let i=0;i<16;i++) spawnEnemy((Math.random()*2-1)*7,cy+(Math.random()*2-1)*6,z+Math.random()*8,'swarm'); } // broad cloud — match ORB
}

/* ---------- weapon ---------- */
let fireTimer=0; let aimX=0,aimY=0;
function fire(){
  const c=MCOL[mode], S=52;
  const bx=aimX*CFG.ORB_BIAS, by=aimY*CFG.ORB_BIAS;
  if(mode===MODE.ORB){
    const off=[[0,0],[0.8,0.5],[-0.8,0.5],[0.5,-0.8],[-0.5,-0.8]];
    for(const o of off) spawnProj(o[0]+bx, o[1]+by, -S, c);
  } else if(mode===MODE.DISKH){
    for(let i=-2;i<=2;i++) spawnProj(i*6+bx*0.4, by, -S, c);
  } else {
    for(let i=-2;i<=2;i++) spawnProj(bx, i*6+by*0.4, -S, c);
  }
}

/* ---------- charge ---------- */
let charges=3,maxCharges=3;
const nova=new THREE.Mesh(new THREE.SphereGeometry(1,24,24),
  new THREE.MeshBasicMaterial({color:COL.charge,transparent:true,opacity:0,side:THREE.BackSide}));
nova.visible=false; scene.add(nova);
let novaActive=false,novaR=0;
function fireCharge(){ if(charges<=0||novaActive)return;
  charges--; updateHUD(); novaActive=true; novaR=2; nova.visible=true;
  nova.position.copy(player.position); nova.material.opacity=0.5; flash(document.getElementById('flash'),0.9); }

/* ---------- environment switching + flythrough (vibe-check geometry with no combat) ---------- */
let env=CFG.ENV, flythrough=false;
const envEl=document.createElement('div'); envEl.className='hud';
envEl.style.cssText='top:42px;left:0;right:0;text-align:center;font-size:11px;color:var(--dim);letter-spacing:.06em;';
document.body.appendChild(envEl);
function updateEnvHud(){ envEl.innerHTML='ENV <b style="color:var(--ink)">'+env.toUpperCase()+'</b>'+(flythrough?' · <b style="color:var(--ink)">FLYTHROUGH</b> (no combat)':'')+'  —  [1] forest  [2] stalactite  [3] channel  [4] cave  [5] asteroid  [P] flythrough'; }
function setEnv(name){ env=name;
  forestGroup.visible=(env==='forest'); spikeGroup.visible=(env==='stalactite');
  trenchGroup.visible=(env==='channel'); caveGroup.visible=(env==='cave'); astGroup.visible=(env==='asteroid');
  updateEnvHud(); }
function setFlythrough(b){ flythrough=b;
  if(b){ for(const e of enemies){e.alive=false;e.mesh.visible=false;} for(const p of projs){p.alive=false;p.mesh.visible=false;} }
  updateEnvHud(); }
setEnv(env);

/* ---------- input ---------- */
const keys={};
addEventListener('keydown',e=>{ keys[e.code]=true; if(e.code==='Space'){fireCharge();e.preventDefault();} if(e.code==='KeyF')fireCharge();
  if(e.code==='Digit1')setEnv('forest'); if(e.code==='Digit2')setEnv('stalactite'); if(e.code==='Digit3')setEnv('channel'); if(e.code==='Digit4')setEnv('cave'); if(e.code==='Digit5')setEnv('asteroid'); if(e.code==='KeyP')setFlythrough(!flythrough); });
addEventListener('keyup',e=>keys[e.code]=false);
let mouseL=false,mouseR=false; const cv=renderer.domElement;
cv.addEventListener('mousedown',e=>{ if(e.button===0)mouseL=true; if(e.button===2)mouseR=true; });
addEventListener('mouseup',e=>{ if(e.button===0)mouseL=false; if(e.button===2)mouseR=false; });
cv.addEventListener('contextmenu',e=>e.preventDefault());
let padPrevCharge=false,usingPad=false; const axBase=[];
function readPad(){
  const pads=navigator.getGamepads?navigator.getGamepads():[]; let gp=null;
  for(const p of pads){ if(p){gp=p;break;} }
  if(!gp){ if(usingPad){usingPad=false;document.getElementById('gp').innerHTML='⌨ keyboard + mouse<br><span style="opacity:.7">plug in a controller to use triggers</span>';} return {x:0,y:0,lt:0,rt:0,charge:false}; }
  if(!usingPad){usingPad=true;document.getElementById('gp').innerHTML='🎮 '+(gp.id.split('(')[0].trim()||'gamepad');}
  const dz=v=>Math.abs(v)<0.16?0:v;
  let x=dz(gp.axes[0]||0),y=dz(gp.axes[1]||0);
  if(gp.buttons[14]&&gp.buttons[14].pressed)x=-1; if(gp.buttons[15]&&gp.buttons[15].pressed)x=1;
  if(gp.buttons[12]&&gp.buttons[12].pressed)y=-1; if(gp.buttons[13]&&gp.buttons[13].pressed)y=1;
  const bt=i=>gp.buttons[i]?Math.max(gp.buttons[i].value||0, gp.buttons[i].pressed?1:0):0;
  // Triggers: a "standard" pad exposes them at buttons[6] (LT) / buttons[7] (RT). But some
  // Xbox pads (045e:0b13) surface them on axes[3]/[4] *even while reporting mapping:"standard"*,
  // so we can't trust gp.mapping. Instead auto-detect a trigger axis by its resting value:
  // an analog trigger rests at -1, a stick rests near 0. Capture each axis baseline on first
  // sight; any axis resting below -0.5 is a trigger, mapped from its -1..+1 range to 0..1.
  gp.axes.forEach((v,i)=>{ if(axBase[i]===undefined) axBase[i]=v; });
  const axTrig=i=>(axBase[i]<-0.5 && gp.axes[i]!==undefined)?Math.max(0,(gp.axes[i]+1)/2):0;
  let lt=Math.max(bt(6),axTrig(3)),rt=Math.max(bt(7),axTrig(4));
  const charge=!!((gp.buttons[0]&&gp.buttons[0].pressed)||(gp.buttons[1]&&gp.buttons[1].pressed));
  return {x,y:-y,lt,rt,charge};
}

/* ---------- HUD ---------- */
let score=0,chain=0,bestChain=0,shields=3;
function updateHUD(){
  document.getElementById('score').textContent=score;
  document.getElementById('chainSmall').textContent=chain;
  let p=''; for(let i=0;i<maxCharges;i++)p+='<span class="pip '+(i<charges?'on':'')+'"></span>'; document.getElementById('pips').innerHTML=p;
  let s=''; for(let i=0;i<3;i++)s+='<span class="shp '+(i<shields?'':'off')+'"></span>'; document.getElementById('shields').innerHTML=s;
}
const chainBig=document.getElementById('chainBig');
function bumpChain(matched){
  if(matched){ chain++; bestChain=Math.max(bestChain,chain);
    chainBig.textContent='PERFECT ×'+chain; chainBig.style.color=MCSS[mode];
    chainBig.style.transform='scale(1.18)'; setTimeout(()=>chainBig.style.transform='scale(1)',90);
  } else { chain=0; chainBig.textContent=''; } updateHUD();
}
function popText(world,text,color){
  const v=world.clone().project(camera);
  const el=document.createElement('div'); el.className='pop'; el.textContent=text; el.style.color=color;
  el.style.left=((v.x*0.5+0.5)*innerWidth)+'px'; el.style.top=((-v.y*0.5+0.5)*innerHeight)+'px';
  document.body.appendChild(el);
  let t=0;(function up(){t+=0.05;el.style.top=(parseFloat(el.style.top)-1.2)+'px';el.style.opacity=String(1-t);
    if(t<1)requestAnimationFrame(up);else el.remove();})();
}
function flash(el,to){el.style.transition='none';el.style.opacity=to;requestAnimationFrame(()=>{el.style.transition='opacity .4s';el.style.opacity=0;});}
const hitEl=document.getElementById('hit');
applyModeVisual(); updateHUD();

/* ---------- loop ---------- */
let last=performance.now(),camPitch=0,camRecenter=0,orbPitch=0; const tmp=new THREE.Vector3();
function tick(now){
  const dt=Math.min((now-last)/1000,0.05); last=now; requestAnimationFrame(tick);
  const pad=readPad();

  let mx=0,my=0;
  if(keys['KeyA']||keys['ArrowLeft'])mx-=1; if(keys['KeyD']||keys['ArrowRight'])mx+=1;
  if(keys['KeyW']||keys['ArrowUp'])my+=1;  if(keys['KeyS']||keys['ArrowDown'])my-=1;
  mx+=pad.x; my+=pad.y;
  aimX=THREE.MathUtils.clamp(mx,-1,1); aimY=THREE.MathUtils.clamp(my,-1,1);
  player.position.x=THREE.MathUtils.clamp(player.position.x+mx*18*dt,-CFG.LANE_X,CFG.LANE_X);
  player.position.y=THREE.MathUtils.clamp(player.position.y+my*14*dt,-CFG.LANE_Y,CFG.LANE_Y);
  if(env==='channel') player.position.x=THREE.MathUtils.clamp(player.position.x,-(CFG.TRENCH_HALF-0.8),CFG.TRENCH_HALF-0.8); // walls close in
  const orbPitchRate=(aimY!==0)?CFG.ORB_PITCH_IN:CFG.ORB_LEVEL;  // lean-in vs snap-back-to-level
  orbPitch+=(aimY*CFG.ORB_PITCH-orbPitch)*Math.min(1,dt*orbPitchRate);
  player.rotation.x=orbPitch; player.rotation.z=-mx*0.25; orbGroup.rotation.z+=dt*1.2;
  playerLight.position.copy(player.position); playerLight.position.z+=1;
  camera.position.x+=(player.position.x*CFG.CAM_LEAD_X-camera.position.x)*Math.min(1,dt*CFG.CAM_DAMP);
  // vertical FOLLOW: weak while moving (orb leads, off-centre); on idle the camera slides up to re-frame the
  // orb with a LEVEL horizon (it moves the camera, it does NOT pitch the view at the orb).
  const followLead=player.position.y*CFG.CAM_LEAD_Y+CFG.CAM_HEIGHT;
  camRecenter+=((aimY===0?1:0)-camRecenter)*Math.min(1,dt*CFG.CAM_RECENTER);   // ramps up once you stop moving
  const followY=followLead+(player.position.y-followLead)*camRecenter*CFG.CAM_RECENTER_AMT;
  camera.position.y+=(followY-camera.position.y)*Math.min(1,dt*CFG.CAM_DAMP);
  // hard cap on how far the orb rides off vertical centre: near the limit the camera tracks 1:1 so the orb
  // simply PINS at the edge (no leading-then-rebounding while you hold the stick against it)
  camera.position.y=THREE.MathUtils.clamp(camera.position.y,player.position.y-CFG.CAM_MAX_OFFSET,player.position.y+CFG.CAM_MAX_OFFSET);
  // PITCH: tilts with vertical input, eases back to the neutral resting aim when you let go (no orb-chasing)
  camPitch+=(aimY-camPitch)*Math.min(1,dt*((aimY!==0)?CFG.CAM_TILT_IN:CFG.CAM_TILT_OUT));
  camera.lookAt(camera.position.x, camera.position.y+CFG.CAM_LOOK_UP+camPitch*CFG.CAM_TILT, camera.position.z-CFG.CAM_LOOK_AHEAD);

  const wantH=(pad.rt>=0.35)||keys['KeyE']||mouseL;
  const wantV=(pad.lt>=0.35)||keys['KeyQ']||mouseR;
  if(wantH&&wantV) mode=(pad.rt>=pad.lt)?MODE.DISKH:MODE.DISKV;
  else if(wantH) mode=MODE.DISKH; else if(wantV) mode=MODE.DISKV; else mode=MODE.ORB;
  applyModeVisual();
  const wantCharge=pad.charge; if(wantCharge&&!padPrevCharge)fireCharge(); padPrevCharge=wantCharge;

  if(env==='forest') for(const p of pillars){
    p.mesh.position.z+=CFG.SPEED*dt; p.mesh.rotation.y+=dt*0.04;
    if(!p.alive){ if(p.mesh.position.z>CFG.NEARZ)placePillar(p,false); continue; }
    if(p.mesh.position.z>CFG.NEARZ){ placePillar(p,false); continue; }
    if(p.aesthetic||flythrough) continue;
    if(Math.abs(p.mesh.position.z-player.position.z)<1.3 &&
       Math.abs(p.mesh.position.x-player.position.x)<(p.r+0.7)){
      p.alive=false; p.mesh.visible=false; shields=Math.max(0,shields-1); updateHUD(); flash(hitEl,0.55);
      if(shields===0){shields=3;updateHUD();}
    }
  }
  if(env==='stalactite'){ for(const s of spikes){
    s.mesh.position.z+=CFG.SPEED*dt;
    if(s.mesh.position.z>CFG.NEARZ){ placeSpike(s,false); continue; }
    if(flythrough||s.aesthetic) continue;
    if(Math.abs(s.mesh.position.z-player.position.z)<1.4){
      const baseY=s.ceiling?CFG.CEIL_Y:CFG.FLOOR_Y;
      const frac=1-Math.abs(player.position.y-baseY)/s.len;   // cone width factor at the player's height (1 at base → 0 at tip)
      if(frac>0 && Math.abs(s.mesh.position.x-player.position.x)<(s.r*frac+0.6)){
        shields=Math.max(0,shields-1); updateHUD(); flash(hitEl,0.55); if(shields===0){shields=3;updateHUD();}
      }
    }
  }
  capScroll=(capScroll+CFG.SPEED*dt)%FLOOR_CELL; ceilGrid.position.z=capScroll; floorGrid.position.z=capScroll; }
  if(env==='channel'){ for(const t of teeth){
    t.mesh.position.z+=CFG.SPEED*dt;
    if(t.mesh.position.z>CFG.NEARZ){ placeTooth(t,false); continue; }
    if(flythrough) continue;
    if(Math.abs(t.mesh.position.z-player.position.z)<t.w/2+0.8 &&
       Math.abs(player.position.x-t.mesh.position.x)<t.reach/2+0.6 &&
       Math.abs(player.position.y-t.mesh.position.y)<t.h/2+0.6){
      shields=Math.max(0,shields-1); updateHUD(); flash(hitEl,0.55); if(shields===0){shields=3;updateHUD();}
    }
  }
  trenchScroll=(trenchScroll+CFG.SPEED*dt)%CAP_CELL; for(const g of wallGrids) g.position.z=trenchScroll; }
  if(env==='cave'){ caveScroll+=CFG.SPEED*dt; for(const r of rings){
    r.mesh.position.z+=CFG.SPEED*dt;   // each ring's shape is FIXED in world space (set on wrap); the morph plays out across rings as they scroll past
    if(r.mesh.position.z>CFG.NEARZ){ r.mesh.position.z-=CAVE_SPAN; r.track+=CAVE_SPAN; r.geo.setPositions(ringPositions(r.track)); }
  }
  for(const b of bumps){ b.mesh.position.z+=CFG.SPEED*dt; if(b.mesh.position.z>CFG.NEARZ) placeBump(b,false); } }
  if(env==='asteroid') for(const a of asteroids){
    a.mesh.position.z+=CFG.SPEED*dt;
    a.mesh.rotation.x+=a.sx*dt; a.mesh.rotation.y+=a.sy*dt; a.mesh.rotation.z+=a.sz*dt;
    if(a.mesh.position.z>CFG.NEARZ) placeAsteroid(a,false);
  }

  if(!flythrough){ waveTimer-=dt; if(waveTimer<=0){ spawnWave(WAVES[waveIx%WAVES.length]); waveIx++; waveTimer=2.7; } }
  if(!flythrough){ fireTimer-=dt; if(fireTimer<=0){ fire(); fireTimer=(mode===MODE.ORB)?CFG.FIRE_INT_ORB:CFG.FIRE_INT; } }

  for(const p of projs){ if(!p.alive)continue;
    p.mesh.position.x+=p.vx*dt; p.mesh.position.y+=p.vy*dt; p.mesh.position.z+=p.vz*dt;
    p.life-=dt; if(p.life<=0||p.mesh.position.z<CFG.FARZ-5){p.alive=false;p.mesh.visible=false;continue;}
    for(const pl of pillars){ if(env!=='forest'||!pl.alive||pl.aesthetic)continue;
      if(Math.abs(p.mesh.position.z-pl.mesh.position.z)<1.0 &&
         Math.abs(p.mesh.position.x-pl.mesh.position.x)<(pl.r+0.2)){ p.alive=false;p.mesh.visible=false;break; }
    }
  }

  for(const e of enemies){ if(!e.alive)continue;
    e.mesh.position.z+=CFG.SPEED*dt; e.phase+=dt*2.2;
    if(e.formation==='row')   e.mesh.position.y=e.by+Math.sin(e.phase)*3.2;
    if(e.formation==='stack') e.mesh.position.x=e.bx+Math.sin(e.phase)*3.6;
    if(e.formation==='swarm'){ e.mesh.position.x+=Math.sin(e.phase*1.3)*dt*2.0; e.mesh.position.y+=Math.cos(e.phase)*dt*1.6; }
    e.mesh.rotation.x+=e.spin; e.mesh.rotation.y+=e.spin;
    if(e.mesh.position.z>12){ e.alive=false; e.mesh.visible=false; if(chain>0)bumpChain(false); continue; } // slipped past — no damage
    if(Math.abs(e.mesh.position.z-player.position.z)<CFG.HIT_Z &&
       Math.abs(e.mesh.position.x-player.position.x)<CFG.HIT_XY &&
       Math.abs(e.mesh.position.y-player.position.y)<CFG.HIT_XY){
      e.alive=false; e.mesh.visible=false; shields=Math.max(0,shields-1); updateHUD(); flash(hitEl,0.5);
      if(shields===0){shields=3;updateHUD();} if(chain>0)bumpChain(false); continue; }
    for(const p of projs){ if(!p.alive)continue;
      if(p.mesh.position.distanceToSquared(e.mesh.position)<0.95){
        const matched=(MFORM[mode]===e.formation);
        e.hp-=matched?140:16; p.alive=false; p.mesh.visible=false;
        if(e.hp<=0){ e.alive=false; e.mesh.visible=false; score+=matched?150:40; bumpChain(matched);
          tmp.copy(e.mesh.position); popText(tmp,matched?'PERFECT':'+40',matched?MCSS[mode]:'#8a7d70'); break; }
      }
    }
  }

  if(novaActive){ novaR+=64*dt; nova.scale.setScalar(novaR); nova.material.opacity=Math.max(0,0.5*(1-novaR/30));
    for(const e of enemies){ if(e.alive&&e.mesh.position.distanceTo(player.position)<novaR){e.alive=false;e.mesh.visible=false;score+=80;} }
    for(const pl of pillars){ if(pl.alive&&!pl.aesthetic&&Math.abs(pl.mesh.position.z-player.position.z)<novaR&&Math.abs(pl.mesh.position.x-player.position.x)<novaR){pl.alive=false;pl.mesh.visible=false;} }
    if(novaR>30){ novaActive=false; nova.visible=false; updateHUD(); } }

  renderer.render(scene,camera);
}
requestAnimationFrame(tick);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);
  for(const m of edgeMats) m.resolution.set(innerWidth,innerHeight);});
