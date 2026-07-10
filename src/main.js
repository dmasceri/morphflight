import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

  // --- dash (left-thumb burst: hold a direction to blink that way, neutral stick = forward surge) ---
  DASH_CD: 0.55,        // cooldown between dashes (s)
  DASH_DUR: 0.15,       // directional blink duration (s) — short = snappier
  DASH_DIST: 8,         // directional blink distance (world units travelled over DASH_DUR)
  DASH_FWD_DUR: 0.13,   // forward-surge burst duration (s)
  DASH_FWD_DIST: 30,    // how far ahead of the camera the surge throws you (−z units)
  DASH_FWD_RECOVER: 2.4,// how fast you ease back to the cruising plane after a surge (higher = snappier return)
  DASH_CAM_CATCH: 2.0,  // how fast the camera reels in the forward gap (LOWER = lazier catch-up, bigger stretch)
  DASH_TRAIL_LEN: 12,   // streamer history length (samples) — longer = longer speed-lines off each octagon point
  DASH_TRAIL_FADE: 0.22,// how long the streamers linger and fade after a dash ends (s)

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
  HIT_CD: 0.8,        // i-frames (seconds) after a hit — stops multi-hit while overlapping (cave walls, asteroids)
  PLAYER_R: 0.9,      // player collision radius vs cave walls / asteroids (0 = point collider; ~orb radius is 0.85)
  AST_HIT_FACTOR: 0.7,// asteroid hit radius as a fraction of its bounding radius (the cube mass is tighter than the sphere)
  PLAYER_BUMP: 40,    // impulse imparted to a rock you clip (÷ rock mass → small rocks scatter, boulders barely budge)
  CAVE_PUSH: 0.8,     // cave wall pushback strength (× forward speed) — higher = firmer wall, less ooze-through

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
  NUM_TEETH_AES: 48,  // framing protrusions seeded into the top/bottom margins — makes the slot feel infinitely tall
  TRENCH_BAND_AES: 75,// how far up/down the framing protrusions reach (well past the play band)

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

  // --- asteroid void: conjoined-cube "tech debris" masses ---
  NUM_ASTEROIDS: 56,   // total rocks, divided across the clumps
  NUM_CLUMPS: 8,       // asteroid clusters drifting through the void — the gaps between them are your lanes
  AST_CLUMP_R: 11,     // how spread out the rocks within a clump are
  AST_SEP: 1.1,        // spawn separation: min centre gap = this × (radii sum) — higher = fewer overlaps, bigger gaps
  AST_SEP_TRIES: 14,   // attempts to find a non-overlapping spot before giving up
  AST_MIN: 1.0,        // min rock size
  AST_RND: 4.2,        // + random size (power-biased toward small)
  AST_BOULDER_P: 0.65, // chance a clump anchors a big mass at its core (the ones you steer around)
  AST_BOULDER: 3.2,    // boulder size multiplier
  AST_X: 60,           // clump-centre spread in x
  AST_Y: 26,           // clump-centre spread in y
  AST_DRIFT: 4.5,      // max lateral drift speed — rocks slide across the frame
  AST_DRIFT_MIN: 1.5,  // min drift speed — nothing sits perfectly still, so lane-blocking rocks always clear a gap
  AST_SPIN: 0.8,       // base tumble rate
  AST_SPIN_DAMP: 0.6,  // how much high drift suppresses spin (0 = independent; 1 = fast drifters barely spin)
  AST_COLLIDE_R: 0.8,  // collision radius as fraction of bounding (lower = more visual overlap before they bounce)
  AST_RESTITUTION: 0.85,// bounciness of rock-on-rock hits (1 = fully elastic)
  AST_SPIN_KICK: 0.5,  // max extra tumble imparted by an impact
  AST_CORES: 3,        // max big box cores — small chunks use fewer (complexity scales with size)
  AST_GREEBLES: 6,     // max studded greeble cubes — small chunks use fewer/none
  AST_OFFAXIS: 0.3,    // fraction of cubes tilted off the grid (fractured look)
  AST_RECT: 0.35,      // fraction of cubes stretched into rectangular slabs/struts
  AST_EDGE_W: 1.6,     // neon edge thickness for chunks (thinner than columns — lots of edges)
  AST_VARIANTS: 10,    // distinct chunk geometries per size tier
  NUM_DEBRIS: 340,     // far dust/debris points for parallax depth
  AST_DEBRIS_X: 120, AST_DEBRIS_Y: 60,

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
// neon disk — mirrors the orb's two-tone vibe in the depth axis: a bright interior octagon (flat, in the
// XZ plane) with a lighter translucent copy 0.1 above and below. The octagon sits in XZ (normal = Y), so
// the DISKH/DISKV morph rotation still holds; a gentle in-plane spin (diskSpin, about Y) echoes the orb.
const DISK_R=1.35, DISK_GAP=0.1;
const diskOct=()=>{ const g=new THREE.EdgesGeometry(new THREE.CircleGeometry(DISK_R,8)); g.rotateX(Math.PI/2); return g; };
const mkDiskRing=(y,opacity)=>{ const m=new THREE.LineSegments(diskOct(),new THREE.LineBasicMaterial({color:COL.diskh,transparent:opacity<1,opacity})); m.position.y=y; return m; };
const diskLines=[mkDiskRing(0,1), mkDiskRing(DISK_GAP,0.35), mkDiskRing(-DISK_GAP,0.35)]; // [bright core, lighter +0.1, lighter -0.1]
const diskSpin=new THREE.Group(); diskSpin.add(...diskLines);
const diskGroup=new THREE.Group(); diskGroup.add(diskSpin); diskGroup.visible=false;
player.add(orbGroup,diskGroup);

let mode=MODE.ORB,lastMode=-1;
function applyModeVisual(){
  if(mode===lastMode)return; lastMode=mode;
  const isOrb=mode===MODE.ORB; orbGroup.visible=isOrb; diskGroup.visible=!isOrb;
  if(!isOrb){ for(const d of diskLines) d.material.color.setHex(MCOL[mode]);
    if(mode===MODE.DISKH) diskGroup.rotation.set(0,0,0); else diskGroup.rotation.set(0,0,Math.PI/2); }
  playerLight.color.setHex(isOrb?0xffb070:MCOL[mode]);
  const t=document.getElementById('modeTxt'); t.textContent=NAME[mode]; t.style.color=MCSS[mode];
}

/* ---------- dash streamers: a line trailing from each of the orb octagon's 8 points. Each point keeps a
   short history of its WORLD positions, so the lines stream opposite the dash for free — toward the camera
   on a forward surge, sideways/vertically on a blink. Head bright → tail fades to nothing (additive). The
   per-vertex history is also a cleaner base for the future ghost-pilot/lightblade upgrades than silhouettes. ---------- */
const TL=CFG.DASH_TRAIL_LEN, TPTS=8;                        // history length, octagon point count
// the streamers anchor to whichever octagon is showing: orb (XY plane, r=0.85) vs disk core (XZ plane, r=DISK_R)
const trailLocalOrb=[], trailLocalDisk=[];
for(let i=0;i<TPTS;i++){ const a=i*Math.PI/4;
  trailLocalOrb.push(new THREE.Vector3(Math.cos(a)*0.85,Math.sin(a)*0.85,0));
  trailLocalDisk.push(new THREE.Vector3(Math.cos(a)*DISK_R,0,Math.sin(a)*DISK_R)); }
const trailHist=trailLocalOrb.map(()=>[]);                  // per-point flat [x,y,z,...] ring buffer, newest first
const _segN=TPTS*(TL-1);
const trailGeo=new THREE.BufferGeometry();
const trailPos=new Float32Array(_segN*2*3), trailCol=new Float32Array(_segN*2*3);
trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPos,3));
trailGeo.setAttribute('color',new THREE.BufferAttribute(trailCol,3));
const trail=new THREE.LineSegments(trailGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:true}));
trail.frustumCulled=false; trail.visible=false; scene.add(trail);
let trailAlpha=0; const _tp=new THREE.Vector3(), _tc=new THREE.Color();
function trailHeads(reset){                                 // sample the current octagon's 8 points in world space (reset = collapse history onto them)
  const isOrb=mode===MODE.ORB, node=isOrb?orbGroup:diskSpin, local=isOrb?trailLocalOrb:trailLocalDisk;
  node.updateWorldMatrix(true,false);
  for(let i=0;i<TPTS;i++){ _tp.copy(local[i]).applyMatrix4(node.matrixWorld); const h=trailHist[i];
    if(reset){ h.length=0; for(let k=0;k<TL;k++) h.push(_tp.x,_tp.y,_tp.z); }
    else { h.unshift(_tp.x,_tp.y,_tp.z); if(h.length>TL*3) h.length=TL*3; } }
}
function buildTrail(){                                      // rebuild the segment soup: head bright → tail dark, × global fade
  _tc.setHex(MCOL[mode]); let o=0;
  for(let i=0;i<TPTS;i++){ const h=trailHist[i];
    for(let k=0;k<TL-1;k++){ const a=k*3,b=a+3;
      trailPos[o]=h[a];trailPos[o+1]=h[a+1];trailPos[o+2]=h[a+2]; trailPos[o+3]=h[b];trailPos[o+4]=h[b+1];trailPos[o+5]=h[b+2];
      const fa=(1-k/(TL-1))*trailAlpha, fb=(1-(k+1)/(TL-1))*trailAlpha;
      trailCol[o]=_tc.r*fa;trailCol[o+1]=_tc.g*fa;trailCol[o+2]=_tc.b*fa; trailCol[o+3]=_tc.r*fb;trailCol[o+4]=_tc.g*fb;trailCol[o+5]=_tc.b*fb;
      o+=6; } }
  trailGeo.attributes.position.needsUpdate=true; trailGeo.attributes.color.needsUpdate=true;
}

/* ---------- dash light blade: in disk mode, a dash that lies IN the disk's plane sweeps a filled 2D
   strip (width = disk diameter) along the dash path instead of point streaks — head bright → tail fades.
   This is the seed for the damaging lightblade; for now it's pure light. ---------- */
const bladeHist=[];                                         // disk-centre world positions over the dash, newest first
const _bladeQuads=TL-1, bladeGeo=new THREE.BufferGeometry();
const bladePos=new Float32Array(_bladeQuads*6*3), bladeCol=new Float32Array(_bladeQuads*6*3);   // 2 tris (6 verts) per swept quad
bladeGeo.setAttribute('position',new THREE.BufferAttribute(bladePos,3));
bladeGeo.setAttribute('color',new THREE.BufferAttribute(bladeCol,3));
const blade=new THREE.Mesh(bladeGeo,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:true}));
blade.frustumCulled=false; blade.visible=false; scene.add(blade);
const bladePerp=new THREE.Vector3(), _bn=new THREE.Vector3(), _bd=new THREE.Vector3();   // half-width vector (⟂ to dash, in-plane); disk normal; dash dir
function bladeReset(){ bladeHist.length=0; for(let k=0;k<TL;k++) bladeHist.push(player.position.x,player.position.y,player.position.z); }
function bladeSample(){ bladeHist.unshift(player.position.x,player.position.y,player.position.z); if(bladeHist.length>TL*3) bladeHist.length=TL*3; }
function buildBlade(){                                       // ribbon between the swept centre-line ± the half-width vector
  _tc.setHex(MCOL[mode]); const px=bladePerp.x,py=bladePerp.y,pz=bladePerp.z; let o=0;
  for(let k=0;k<TL-1;k++){ const i0=k*3,i1=i0+3;
    const ax=bladeHist[i0],ay=bladeHist[i0+1],az=bladeHist[i0+2], bx=bladeHist[i1],by=bladeHist[i1+1],bz=bladeHist[i1+2];
    const fa=(1-k/(TL-1))*trailAlpha, fb=(1-(k+1)/(TL-1))*trailAlpha;
    const V=[[ax+px,ay+py,az+pz,fa],[ax-px,ay-py,az-pz,fa],[bx+px,by+py,bz+pz,fb],   // tri 1: head+, head-, tail+
             [ax-px,ay-py,az-pz,fa],[bx-px,by-py,bz-pz,fb],[bx+px,by+py,bz+pz,fb]];  // tri 2: head-, tail-, tail+
    for(const q of V){ bladePos[o]=q[0];bladePos[o+1]=q[1];bladePos[o+2]=q[2];
      bladeCol[o]=_tc.r*q[3];bladeCol[o+1]=_tc.g*q[3];bladeCol[o+2]=_tc.b*q[3]; o+=3; } }
  bladeGeo.attributes.position.needsUpdate=true; bladeGeo.attributes.color.needsUpdate=true;
}

/* ---------- the great hall: spaced pillars + edge framing ---------- */
const colFillGeo=new THREE.CylinderGeometry(1,1,800,8);  // solid octagonal body — tall so caps stay off-frame at pop-in
const colLineGeo=new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(colFillGeo)); // fat neon outline
// shared materials: collidable (bright, dodge these) vs framing (dimmer, melts into fog). colour only depends on the flag.
const edgeMats=[];  // every fat-line material, so resize can refresh their pixel-resolution
const mkEdgeMat=hex=>{ const m=new LineMaterial({color:hex,linewidth:CFG.COL_EDGE_W,fog:true}); m.resolution.set(innerWidth,innerHeight); edgeMats.push(m); return m; };
const colEdgeMatHit=mkEdgeMat(0x9af2ff), colEdgeMatAes=mkEdgeMat(0x4fbce8);
const mkFillMat=hex=>new THREE.MeshBasicMaterial({color:hex,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
const colFillMatHit=mkFillMat(0x000000), colFillMatAes=mkFillMat(0x000000); // black sides everywhere (consistent scheme); the neon edge carries the colour
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
const wallMat=new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}); // black wall (consistent scheme); the grid + edges carry the colour
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
const toothFillMat=mkFillMat(0x000000), toothEdgeMat=mkEdgeMat(0x9af2ff), toothEdgeMatAes=mkEdgeMat(0x4fbce8); // black body; bright edge = collidable, dim edge = framing
const teeth=[];
function placeTooth(t,anywhere){
  t.side=Math.random()<0.5?-1:1;
  t.reach=CFG.TOOTH_MIN+Math.random()*CFG.TOOTH_REACH;       // how far it juts inward
  t.h=CFG.TOOTH_MIN+Math.random()*CFG.TOOTH_RND*1.4;         // height
  t.w=CFG.TOOTH_MIN+Math.random()*CFG.TOOTH_RND;             // length along the corridor (z)
  t.mesh.scale.set(t.reach,t.h,t.w);
  t.mesh.position.x=t.side*(CFG.TRENCH_HALF-t.reach/2);       // outer face flush to the wall
  t.mesh.position.y=t.aesthetic
    ? (Math.random()<0.5?-1:1)*(CFG.TRENCH_BAND+Math.random()*(CFG.TRENCH_BAND_AES-CFG.TRENCH_BAND)) // framing: top/bottom margins → infinite feel
    : (Math.random()*2-1)*CFG.TRENCH_BAND;                                                           // collidable: the play band
  t.mesh.position.z=anywhere?(CFG.FARZ+Math.random()*(CFG.NEARZ-CFG.FARZ)):(CFG.FARZ+Math.random()*55);
  t.mesh.visible=true;
}
for(let i=0;i<CFG.NUM_TEETH+CFG.NUM_TEETH_AES;i++){
  const aes=i>=CFG.NUM_TEETH;
  const fill=new THREE.Mesh(toothFillGeo,toothFillMat);
  const line=new LineSegments2(toothLineGeo,aes?toothEdgeMatAes:toothEdgeMat); fill.add(line);
  const t={mesh:fill,line:line,aesthetic:aes}; trenchGroup.add(fill); placeTooth(t,true); teeth.push(t);
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
// player-vs-wall helpers for the morphing cross-section (pts normalised; ×R = the world wall)
function pointInPoly(px,py,pts,R){ let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const xi=pts[i][0]*R,yi=pts[i][1]*R,xj=pts[j][0]*R,yj=pts[j][1]*R;
    if(((yi>py)!==(yj>py)) && (px<(xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside; }
  return inside; }
function distToPoly(px,py,pts,R){ let md=Infinity;
  for(let i=0;i<pts.length;i++){ const j=(i+1)%pts.length, ax=pts[i][0]*R,ay=pts[i][1]*R,bx=pts[j][0]*R,by=pts[j][1]*R;
    const dx=bx-ax,dy=by-ay,L2=dx*dx+dy*dy; let t=L2>0?((px-ax)*dx+(py-ay)*dy)/L2:0; t=t<0?0:t>1?1:t;
    const cx=ax+dx*t,cy=ay+dy*t,d=Math.hypot(px-cx,py-cy); if(d<md)md=d; }
  return md; }
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
    b.cx=cx; b.cy=cy; b.cz=z; b.rad=rad; b.cr=Math.hypot(rad,h*0.5); b.mesh.visible=true; // b.cr = bounding sphere (player collision)
    return;
  }
}
for(let i=0;i<CFG.CAVE_NUM_BUMPS;i++){
  const py=makePyramid(Math.random()<0.5?3:4);
  const fill=new THREE.Mesh(py.f,bumpFillMat); const line=new LineSegments2(py.l,bumpEdgeMat); fill.add(line);
  const b={mesh:fill,line,dia:py.dia}; caveGroup.add(fill); placeBump(b,true); bumps.push(b);
}

/* ---------- asteroid void: conjoined-cube "tech debris" masses drifting in clumps ---------- */
const astGroup=new THREE.Group(); astGroup.visible=false; scene.add(astGroup);
const astFillMat=mkFillMat(0x000000);
const astEdgeMat=(()=>{ const m=new LineMaterial({color:0x6fe0ff,linewidth:CFG.AST_EDGE_W,fog:true}); m.resolution.set(innerWidth,innerHeight); edgeMats.push(m); return m; })();
// a rock is an accretion of boxes (a few big cores + studded greebles) welded into one angular mass —
// structural/tech debris, not a natural boulder. Complexity scales with `detail` (small rocks simpler);
// a fraction of boxes are tilted off the grid (AST_OFFAXIS) and stretched into slabs (AST_RECT). Every
// box is fully outlined (12 analytic edges, rotation-aware) for dense right-angle neon; black fills
// occlude the boxes behind so it still reads solid. Pooled per size tier; instances share the geometry.
function boxRot(b){ return new THREE.Matrix4().makeRotationX(b.rot[0]).premultiply(new THREE.Matrix4().makeRotationY(b.rot[1])).premultiply(new THREE.Matrix4().makeRotationZ(b.rot[2])); }
function pushCubeEdges(arr,b,k){
  const cx=b.x*k,cy=b.y*k,cz=b.z*k,hx=b.hx*k,hy=b.hy*k,hz=b.hz*k, m=b.rot?boxRot(b):null, v=new THREE.Vector3();
  const off=[[-hx,-hy,-hz],[hx,-hy,-hz],[hx,hy,-hz],[-hx,hy,-hz],[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]];
  const c=off.map(o=>{ v.set(o[0],o[1],o[2]); if(m)v.applyMatrix4(m); return [cx+v.x,cy+v.y,cz+v.z]; });
  const E=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  for(const e of E){ const a=c[e[0]],d=c[e[1]]; arr.push(a[0],a[1],a[2],d[0],d[1],d[2]); }
}
function pushBox(boxes,x,y,z,h){
  let hx=h*(0.7+Math.random()*0.6),hy=h*(0.7+Math.random()*0.6),hz=h*(0.7+Math.random()*0.6);
  if(Math.random()<CFG.AST_RECT){ const ax=(Math.random()*3)|0,f=1.6+Math.random()*1.8; if(ax===0)hx*=f; else if(ax===1)hy*=f; else hz*=f; } // elongate one axis → slab/strut
  const rot=Math.random()<CFG.AST_OFFAXIS?[(Math.random()*2-1)*0.6,(Math.random()*2-1)*0.6,(Math.random()*2-1)*0.6]:null;                   // tilt off the grid
  boxes.push({x,y,z,hx,hy,hz,rot});
}
function makeChunk(detail){
  const boxes=[]; pushBox(boxes,0,0,0,1);
  const cores=1+((Math.random()*(1+Math.round(detail*CFG.AST_CORES)))|0);   // 1..(1+detail·cores): bigger masses get more
  for(let i=1;i<cores;i++){ const b=boxes[(Math.random()*boxes.length)|0], ax=(Math.random()*3)|0, dir=Math.random()<.5?-1:1, h=0.65+Math.random()*0.55;
    const o=[0,0,0]; o[ax]=dir*([b.hx,b.hy,b.hz][ax]+h)*0.62;                // butt against a face with overlap → conjoined
    pushBox(boxes,b.x+o[0],b.y+o[1],b.z+o[2],h); }
  const greebles=(Math.random()*(Math.round(detail*CFG.AST_GREEBLES)+1))|0;  // small rocks → few/none
  for(let i=0;i<greebles;i++){ const b=boxes[(Math.random()*boxes.length)|0], ax=(Math.random()*3)|0, dir=Math.random()<.5?-1:1, h=0.16+Math.random()*0.34;
    const p=[b.x+(Math.random()*2-1)*b.hx*0.7, b.y+(Math.random()*2-1)*b.hy*0.7, b.z+(Math.random()*2-1)*b.hz*0.7];
    p[ax]=[b.x,b.y,b.z][ax]+dir*([b.hx,b.hy,b.hz][ax]+h*0.5);                // sit on the chosen face
    pushBox(boxes,p[0],p[1],p[2],h); }
  let ext=0.001; for(const b of boxes) ext=Math.max(ext,Math.abs(b.x)+b.hx,Math.abs(b.y)+b.hy,Math.abs(b.z)+b.hz);
  const k=1/ext, fills=[], lp=[];                                           // normalise to ~unit radius, then build fill + edges
  for(const b of boxes){ const g=new THREE.BoxGeometry(b.hx*2*k,b.hy*2*k,b.hz*2*k); if(b.rot)g.applyMatrix4(boxRot(b)); g.translate(b.x*k,b.y*k,b.z*k); fills.push(g); pushCubeEdges(lp,b,k); }
  const l=new LineSegmentsGeometry(); l.setPositions(lp);
  return {f:mergeGeometries(fills,false),l};
}
// three size tiers (simple → complex); seatRock picks the tier matching each rock's size.
const astPool=[0.18,0.5,1.0].map(d=>{ const a=[]; for(let i=0;i<CFG.AST_VARIANTS;i++) a.push(makeChunk(d)); return a; });
// clumps: each is a drifting cluster of rocks; gaps between clumps are the lanes you steer through.
// A clump recycles as a UNIT (so it never tears apart) once its centre passes the camera.
const SPANZ=CFG.NEARZ-CFG.FARZ;
const asteroids=[], clumps=[];
const gauss=()=>(Math.random()+Math.random()+Math.random()-1.5)/1.5;   // ~normal, roughly -1..1
function seatRock(a,cl,idx,boulder){
  const spread=boulder?0.35:1;                                          // boulders sit near the core
  const sz=boulder?(CFG.AST_MIN+CFG.AST_RND)*CFG.AST_BOULDER*(0.8+Math.random()*0.4)
                  :CFG.AST_MIN+CFG.AST_RND*Math.pow(Math.random(),2.0);  // power-biased small, boulders big
  a.r=sz; a.mass=sz*sz*sz;                                               // bounding radius + mass (∝ volume) for collisions
  const tier=boulder?2:(sz>CFG.AST_MIN+CFG.AST_RND*0.5?1:0);             // match geometry complexity to size
  const sh=astPool[tier][(Math.random()*CFG.AST_VARIANTS)|0]; a.mesh.geometry=sh.f; a.line.geometry=sh.l;
  a.mesh.scale.set(sz*(0.72+Math.random()*0.56),sz*(0.72+Math.random()*0.56),sz*(0.72+Math.random()*0.56));
  // offset within the clump, rejecting spots that overlap an already-seated rock (this clump, this cycle)
  for(let attempt=0;attempt<CFG.AST_SEP_TRIES;attempt++){
    a.ox=gauss()*cl.r*spread; a.oy=gauss()*cl.r*spread; a.oz=gauss()*cl.r*1.5*spread;
    let clear=true;
    for(let j=0;j<idx;j++){ const o=cl.members[j], ex=a.ox-o.ox, ey=a.oy-o.oy, ez=a.oz-o.oz, rr=(a.r+o.r)*CFG.AST_SEP;
      if(ex*ex+ey*ey+ez*ez<rr*rr){ clear=false; break; } }
    if(clear)break;
  }
  a.mesh.rotation.set(Math.random()*6.28,Math.random()*6.28,Math.random()*6.28);
  const dAng=Math.random()*6.2832, dSpd=CFG.AST_DRIFT_MIN+Math.random()*(CFG.AST_DRIFT-CFG.AST_DRIFT_MIN);
  a.vx=Math.cos(dAng)*dSpd; a.vy=Math.sin(dAng)*dSpd; a.vz=0;            // drift velocity, min-floored so nothing parks in the lane
  const driftN=Math.min(1,dSpd/(CFG.AST_DRIFT*0.7));                     // 0..1; fast drifters tumble slower
  const spin=CFG.AST_SPIN*(1-CFG.AST_SPIN_DAMP*driftN);
  a.sx=(Math.random()-0.5)*spin; a.sy=(Math.random()-0.5)*spin; a.sz=(Math.random()-0.5)*spin;       // tumble, damped by drift
  a.mesh.visible=true;
}
// elastic sphere bounce between two rocks of the same clump (offsets are clump-relative = world-relative).
// Mass ∝ volume so boulders barely budge; impacts also kick a little tumble in. Impulse-based, no dt.
function astCollide(a,b){
  const dx=a.ox-b.ox, dy=a.oy-b.oy, dz=a.oz-b.oz, rr=(a.r+b.r)*CFG.AST_COLLIDE_R, d2=dx*dx+dy*dy+dz*dz;
  if(d2>=rr*rr||d2<1e-6) return;
  const d=Math.sqrt(d2), nx=dx/d, ny=dy/d, nz=dz/d, mA=a.mass, mB=b.mass, inv=1/(mA+mB);
  const overlap=rr-d;                                                    // separate them (mass-weighted) so they don't sink in
  a.ox+=nx*overlap*mB*inv; a.oy+=ny*overlap*mB*inv; a.oz+=nz*overlap*mB*inv;
  b.ox-=nx*overlap*mA*inv; b.oy-=ny*overlap*mA*inv; b.oz-=nz*overlap*mA*inv;
  const vn=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny+(a.vz-b.vz)*nz;                 // closing speed along the contact normal
  if(vn>0) return;                                                      // already separating
  const jimp=-(1+CFG.AST_RESTITUTION)*vn/(1/mA+1/mB);                   // elastic impulse
  a.vx+=jimp/mA*nx; a.vy+=jimp/mA*ny; a.vz+=jimp/mA*nz;
  b.vx-=jimp/mB*nx; b.vy-=jimp/mB*ny; b.vz-=jimp/mB*nz;
  const kick=Math.min(CFG.AST_SPIN_KICK,-vn*0.15), S=CFG.AST_SPIN*2.5;  // impact spins them up a touch (clamped)
  a.sx=THREE.MathUtils.clamp(a.sx+(Math.random()-0.5)*kick,-S,S); a.sy=THREE.MathUtils.clamp(a.sy+(Math.random()-0.5)*kick,-S,S); a.sz=THREE.MathUtils.clamp(a.sz+(Math.random()-0.5)*kick,-S,S);
  b.sx=THREE.MathUtils.clamp(b.sx+(Math.random()-0.5)*kick,-S,S); b.sy=THREE.MathUtils.clamp(b.sy+(Math.random()-0.5)*kick,-S,S); b.sz=THREE.MathUtils.clamp(b.sz+(Math.random()-0.5)*kick,-S,S);
}
function placeClump(cl,anywhere){
  cl.cx=(Math.random()*2-1)*CFG.AST_X; cl.cy=(Math.random()*2-1)*CFG.AST_Y;
  cl.r=CFG.AST_CLUMP_R*(0.6+Math.random()*0.8);
  cl.z=anywhere?(CFG.FARZ+Math.random()*SPANZ):(CFG.FARZ-Math.random()*60);   // recycle → respawn well beyond far
  const hasBoulder=Math.random()<CFG.AST_BOULDER_P;
  cl.members.forEach((a,idx)=>seatRock(a,cl,idx,hasBoulder&&idx===0));        // member 0 becomes the boulder
}
for(let i=0;i<CFG.NUM_CLUMPS;i++) clumps.push({members:[]});
const astDef=astPool[0][0];   // placeholder geometry; seatRock swaps in the real tier-matched chunk
for(let i=0;i<CFG.NUM_ASTEROIDS;i++){
  const fill=new THREE.Mesh(astDef.f,astFillMat); const line=new LineSegments2(astDef.l,astEdgeMat); fill.add(line);
  const a={mesh:fill,line}; astGroup.add(fill); asteroids.push(a); clumps[i%CFG.NUM_CLUMPS].members.push(a);
}
for(const cl of clumps) placeClump(cl,true);
// far debris: faint additive blue points across the depth span → parallax + a sense of a vast void
const debrisPos=new Float32Array(CFG.NUM_DEBRIS*3);
for(let i=0;i<CFG.NUM_DEBRIS;i++){
  debrisPos[i*3]=(Math.random()*2-1)*CFG.AST_DEBRIS_X;
  debrisPos[i*3+1]=(Math.random()*2-1)*CFG.AST_DEBRIS_Y;
  debrisPos[i*3+2]=CFG.FARZ+Math.random()*SPANZ;
}
const debrisGeo=new THREE.BufferGeometry();
debrisGeo.setAttribute('position',new THREE.Float32BufferAttribute(debrisPos,3));
const debrisMat=new THREE.PointsMaterial({color:0x6fe0ff,size:0.5,sizeAttenuation:true,transparent:true,opacity:0.55,fog:true,blending:THREE.AdditiveBlending,depthWrite:false});
const debris=new THREE.Points(debrisGeo,debrisMat); debris.frustumCulled=false; astGroup.add(debris);

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

/* ---------- dash ---------- */
let dashCd=0,dashT=0,dashFwd=false,dashBlade=false,dashDirX=0,dashDirY=0,dashSpd=0,dashRecover=0,padPrevDash=false;
let camHoldX=0,camHoldY=0;   // camera pose frozen at blink start so it holds while the pilot darts within the frame
function startDash(){
  const mag=Math.hypot(aimX,aimY);
  dashCd=CFG.DASH_CD; trailAlpha=1; dashBlade=false;
  if(mag>0.25){ // directional blink — lunge along the held stick, camera stays put
    dashFwd=false; dashDirX=aimX/mag; dashDirY=aimY/mag;
    dashT=CFG.DASH_DUR; dashSpd=CFG.DASH_DIST/CFG.DASH_DUR;
    camHoldX=camera.position.x; camHoldY=camera.position.y; dashRecover=CFG.DASH_DUR+0.45;
    if(mode!==MODE.ORB){ // light blade: only when the dash lies IN the disk's plane (⟂ to its normal)
      diskSpin.updateWorldMatrix(true,false);
      _bn.set(0,1,0).transformDirection(diskSpin.matrixWorld);          // disk plane normal (world)
      _bd.set(dashDirX,dashDirY,0);
      if(Math.abs(_bd.dot(_bn))<0.35){ dashBlade=true; bladePerp.crossVectors(_bn,_bd).normalize().multiplyScalar(DISK_R); } // half-width ⟂ to dash, in-plane
    }
  }else{        // neutral stick — forward surge: dive away from the camera, then ease back to the cruising plane
    dashFwd=true; dashT=CFG.DASH_FWD_DUR; dashSpd=CFG.DASH_FWD_DIST/CFG.DASH_FWD_DUR; dashRecover=0;
  }
  if(dashBlade){ trail.visible=false; bladeReset(); blade.visible=true; }   // sweep a filled strip...
  else { blade.visible=false; trailHeads(true); trail.visible=true; }       // ...or stream the 8 point lines
}

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
  const dash=!!(gp.buttons[2]&&gp.buttons[2].pressed);   // X (left thumb) = dash; A/B are taken by charge
  return {x,y:-y,lt,rt,charge,dash};
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
let hitCd=0;                                  // invulnerability timer (counts down) after a hit
function playerHit(){ if(hitCd>0)return; hitCd=CFG.HIT_CD; shields=Math.max(0,shields-1); updateHUD(); flash(hitEl,0.55); if(shields===0){shields=3;updateHUD();} }
applyModeVisual(); updateHUD();

/* ---------- loop ---------- */
let last=performance.now(),camPitch=0,camRecenter=0,orbPitch=0; const tmp=new THREE.Vector3();
function tick(now){
  const dt=Math.min((now-last)/1000,0.05); last=now; requestAnimationFrame(tick);
  const pad=readPad();
  if(hitCd>0) hitCd-=dt;

  let mx=0,my=0;
  if(keys['KeyA']||keys['ArrowLeft'])mx-=1; if(keys['KeyD']||keys['ArrowRight'])mx+=1;
  if(keys['KeyW']||keys['ArrowUp'])my+=1;  if(keys['KeyS']||keys['ArrowDown'])my-=1;
  mx+=pad.x; my+=pad.y;
  aimX=THREE.MathUtils.clamp(mx,-1,1); aimY=THREE.MathUtils.clamp(my,-1,1);
  // --- dash: edge-triggered, gated by cooldown; direction is sampled from the stick at press-time ---
  dashCd=Math.max(0,dashCd-dt); if(dashT>0)dashT-=dt; if(dashRecover>0)dashRecover-=dt;
  const wantDash=pad.dash||keys['ShiftLeft']||keys['ShiftRight'];
  if(wantDash&&!padPrevDash&&dashCd<=0&&dashT<=0) startDash(); padPrevDash=wantDash;
  // Boundary contract: the env's outer shell is always a SAFE stop; only obstacles damage. Per-env safe
  // boundary — cave → the visible wall (relax the rectangular lane past the widest wall so the wall
  // collision below governs); stalactite → fly right up to the floor/ceiling planes. Open envs keep the lane.
  const caveBound=CFG.CAVE_RADIUS*(1+CFG.CAVE_IRREG)+2;
  const laneX=(env==='cave')?caveBound:CFG.LANE_X;
  const laneY=(env==='cave')?caveBound:(env==='stalactite')?CFG.CEIL_Y-1:CFG.LANE_Y;
  let dvx=0,dvy=0; if(dashT>0&&!dashFwd){ dvx=dashDirX*dashSpd; dvy=dashDirY*dashSpd; }  // directional blink rides on top of normal steering
  player.position.x=THREE.MathUtils.clamp(player.position.x+(mx*18+dvx)*dt,-laneX,laneX);
  player.position.y=THREE.MathUtils.clamp(player.position.y+(my*14+dvy)*dt,-laneY,laneY);
  if(env==='channel') player.position.x=THREE.MathUtils.clamp(player.position.x,-(CFG.TRENCH_HALF-0.8),CFG.TRENCH_HALF-0.8); // walls close in
  // forward surge: dive to −z during the burst, then ease back to the cruising plane (z=0). Pilot speed
  // returns to cruising the instant the burst ends; the camera (below) closes the remaining gap on its own.
  if(dashFwd&&dashT>0) player.position.z-=dashSpd*dt;
  else if(player.position.z<0) player.position.z+=(0-player.position.z)*Math.min(1,dt*CFG.DASH_FWD_RECOVER);
  const orbPitchRate=(aimY!==0)?CFG.ORB_PITCH_IN:CFG.ORB_LEVEL;  // lean-in vs snap-back-to-level
  orbPitch+=(aimY*CFG.ORB_PITCH-orbPitch)*Math.min(1,dt*orbPitchRate);
  player.rotation.x=orbPitch; player.rotation.z=-mx*0.25; orbGroup.rotation.z+=dt*1.2; diskSpin.rotation.y+=dt*1.2;
  playerLight.position.copy(player.position); playerLight.position.z+=1;
  // dash trail: sweep a filled blade strip (in-plane disk dash) or stream the 8 octagon points; fade out after
  if(dashBlade){
    if(dashT>0) bladeSample();
    if(blade.visible){ if(dashT<=0){ trailAlpha=Math.max(0,trailAlpha-dt/CFG.DASH_TRAIL_FADE); if(trailAlpha<=0)blade.visible=false; } buildBlade(); }
  }else{
    if(dashT>0) trailHeads(false);
    if(trail.visible){ if(dashT<=0){ trailAlpha=Math.max(0,trailAlpha-dt/CFG.DASH_TRAIL_FADE); if(trailAlpha<=0)trail.visible=false; } buildTrail(); }
  }
  camera.position.x+=(player.position.x*CFG.CAM_LEAD_X-camera.position.x)*Math.min(1,dt*CFG.CAM_DAMP);
  // vertical FOLLOW: weak while moving (orb leads, off-centre); on idle the camera slides up to re-frame the
  // orb with a LEVEL horizon (it moves the camera, it does NOT pitch the view at the orb).
  const followLead=player.position.y*CFG.CAM_LEAD_Y+CFG.CAM_HEIGHT;
  camRecenter+=((aimY===0?1:0)-camRecenter)*Math.min(1,dt*CFG.CAM_RECENTER);   // ramps up once you stop moving
  const followY=followLead+(player.position.y-followLead)*camRecenter*CFG.CAM_RECENTER_AMT;
  camera.position.y+=(followY-camera.position.y)*Math.min(1,dt*CFG.CAM_DAMP);
  if(dashT>0&&!dashFwd){ camera.position.x=camHoldX; camera.position.y=camHoldY; } // blink: camera holds, pilot darts within the frame
  // hard cap on how far the orb rides off vertical centre: near the limit the camera tracks 1:1 so the orb
  // simply PINS at the edge. Skipped during a blink + its recovery tail so the held camera eases back instead of snapping.
  else if(dashRecover<=0) camera.position.y=THREE.MathUtils.clamp(camera.position.y,player.position.y-CFG.CAM_MAX_OFFSET,player.position.y+CFG.CAM_MAX_OFFSET);
  // forward surge: dolly the camera toward the pilot's depth so it lazily reels in the gap the dive opened
  camera.position.z+=((player.position.z+CFG.CAM_BACK)-camera.position.z)*Math.min(1,dt*CFG.DASH_CAM_CATCH);
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
    if(t.aesthetic||flythrough) continue;   // framing teeth scroll/recycle but never damage
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
  for(const b of bumps){ b.mesh.position.z+=CFG.SPEED*dt;
    if(b.mesh.position.z>CFG.NEARZ){ placeBump(b,false); continue; }
    if(!flythrough && b.cr){ const dx=b.mesh.position.x-player.position.x, dy=b.mesh.position.y-player.position.y, dz=b.mesh.position.z-player.position.z, hr=b.cr+CFG.PLAYER_R;
      if(dx*dx+dy*dy+dz*dz<hr*hr) playerHit(); } }   // bumps DAMAGE (the cave's real hazard)
  if(!flythrough){ const pts=caveCross(CFG.NEARZ-player.position.z+caveScroll).pts, R=CFG.CAVE_RADIUS, px=player.position.x, py=player.position.y;
    if(!pointInPoly(px,py,pts,R) || distToPoly(px,py,pts,R)<CFG.PLAYER_R){    // SAFE boundary: bonk + push back toward centre, NO damage (the cave's danger is the bumps)
      const pm=Math.hypot(px,py)||1, push=CFG.SPEED*dt*CFG.CAVE_PUSH; player.position.x-=px/pm*push; player.position.y-=py/pm*push; } } }
  if(env==='asteroid'){ for(const cl of clumps){
    cl.z+=CFG.SPEED*dt;                                         // whole clump scrolls together → stays coherent
    const M=cl.members;
    for(const a of M){ a.ox+=a.vx*dt; a.oy+=a.vy*dt; a.oz+=a.vz*dt; }              // integrate drift velocity
    for(let i=0;i<M.length;i++) for(let j=i+1;j<M.length;j++) astCollide(M[i],M[j]); // elastic rock-on-rock bounce
    for(const a of M){
      a.mesh.position.set(cl.cx+a.ox,cl.cy+a.oy,cl.z+a.oz);
      a.mesh.rotation.x+=a.sx*dt; a.mesh.rotation.y+=a.sy*dt; a.mesh.rotation.z+=a.sz*dt;
      if(!flythrough){ const wx=cl.cx+a.ox-player.position.x, wy=cl.cy+a.oy-player.position.y, wz=cl.z+a.oz-player.position.z, hr=a.r*CFG.AST_HIT_FACTOR+CFG.PLAYER_R;
        if(wx*wx+wy*wy+wz*wz<hr*hr){ playerHit(); const d=Math.hypot(wx,wy,wz)||1, dv=CFG.PLAYER_BUMP/a.mass; a.vx+=wx/d*dv; a.vy+=wy/d*dv; } } // clip → damage + shove the rock off you
    }
    if(cl.z>CFG.NEARZ+24) placeClump(cl,false);                 // recycle once every member is safely behind the camera
  }
  const dp=debrisGeo.attributes.position;                       // debris scrolls with the field; recycle past the camera (re-scatter x/y so it doesn't loop in a line)
  for(let i=0;i<CFG.NUM_DEBRIS;i++){ let z=dp.getZ(i)+CFG.SPEED*dt;
    if(z>CFG.NEARZ){ z-=SPANZ; dp.setX(i,(Math.random()*2-1)*CFG.AST_DEBRIS_X); dp.setY(i,(Math.random()*2-1)*CFG.AST_DEBRIS_Y); }
    dp.setZ(i,z); }
  dp.needsUpdate=true; }

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
