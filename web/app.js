import * as THREE from 'three';
import { loadRaw, aggregate } from './data.js';

// Décor "Aube corail" : horizon chaud, zénith encore bleuté, sol doré.
const BOTTOM_COLOR = 0x2b1f26;
const HORIZON_COLOR = 0xe8794f;
const TOP_COLOR = 0x24335c;
const ACCENT = 0xff9d74;

const scene = new THREE.Scene();
scene.background = new THREE.Color(BOTTOM_COLOR);
scene.fog = new THREE.Fog(BOTTOM_COLOR, 16, 42);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.7, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Matériaux non-éclairés (MeshBasicMaterial/Shader simple) partout : pas de lumières à calculer -> beaucoup plus léger.

// Ciel en dégradé (un seul mesh, shader minimal, pas de fog pour garder les couleurs nettes)
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(55, 16, 12),
  new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(TOP_COLOR) },
      horizonColor: { value: new THREE.Color(HORIZON_COLOR) },
      bottomColor: { value: new THREE.Color(BOTTOM_COLOR) }
    },
    vertexShader: `
      varying float vHeight;
      void main() {
        vHeight = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      varying float vHeight;
      void main() {
        vec3 col = vHeight > 0.0
          ? mix(horizonColor, topColor, smoothstep(0.0, 0.4, vHeight))
          : mix(horizonColor, bottomColor, smoothstep(0.0, -0.35, vHeight));
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false
  })
);
scene.add(sky);

// Étoiles lointaines (un seul draw call)
const starGeo = new THREE.BufferGeometry();
const STAR_COUNT = 600;
const starPositions = new Float32Array(STAR_COUNT * 3);
for (let i = 0; i < STAR_COUNT; i++) {
  const r = 40 + Math.random() * 12;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(Math.random() * 0.9); // concentré au-dessus de l'horizon
  starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 2;
  starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
  color: 0xffe3c2, size: 0.3, sizeAttenuation: true, transparent: true, opacity: 0.35, fog: false
}));
scene.add(stars);

// Sol avec halo radial doux (texture générée une seule fois)
function makeFloorTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1c1419';
  ctx.fillRect(0, 0, size, size);
  const glow = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  glow.addColorStop(0, 'rgba(255,159,116,0.22)');
  glow.addColorStop(1, 'rgba(255,159,116,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(14, 48),
  new THREE.MeshBasicMaterial({ map: makeFloorTexture() })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Grille au sol, teinte rosée assortie à l'aube
const grid = new THREE.GridHelper(28, 28, 0x8a6a5e, 0x2a1f22);
grid.material.transparent = true;
grid.material.opacity = 0.55;
grid.position.y = 0.01;
scene.add(grid);

// --- Déplacement / contrôles ---
// Contrôleur maison (pas de Pointer Lock API) : fonctionne aussi dans les
// previews embarquées (iframe, VSCode...) où cette API est bloquée.
const yawObject = new THREE.Object3D();
yawObject.position.set(0, 1.7, 0);
camera.position.set(0, 0, 0);
yawObject.add(camera);
scene.add(yawObject);

const hint = document.getElementById('hint');
const hud = document.getElementById('hud');
const tooltip3d = document.getElementById('tooltip3d');
const soundToggle = document.getElementById('soundToggle');
const crosshair = document.createElement('div');
crosshair.id = 'crosshair';
document.body.appendChild(crosshair);

soundToggle.addEventListener('click', () => {
  if (window.CyberSound.isAmbientOn()) {
    window.CyberSound.stopAmbient();
    soundToggle.textContent = '🔈';
    soundToggle.classList.remove('on');
  } else {
    window.CyberSound.startAmbient();
    window.CyberSound.playClick();
    soundToggle.textContent = '🔊';
    soundToggle.classList.add('on');
  }
});

const isDashboardOpen = () => document.getElementById('dashboard2d').style.display === 'block';
let engaged = false;
let yaw = 0;
let pitch = 0;
const LOOK_SPEED = 0.0025;
const PITCH_LIMIT = Math.PI / 2 - 0.05;

function engage() {
  if (isDashboardOpen()) return;
  if (!engaged) window.CyberSound.playClick();
  engaged = true;
  hint.classList.add('hidden');
  if (renderer.domElement.requestPointerLock) {
    renderer.domElement.requestPointerLock().catch(() => {});
  }
}
function disengage() {
  engaged = false;
  if (!isDashboardOpen()) hint.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}

renderer.domElement.addEventListener('click', engage);
document.addEventListener('keydown', (e) => { if (e.code === 'Escape') disengage(); });

document.addEventListener('mousemove', (e) => {
  if (!engaged || isDashboardOpen()) return;
  yaw -= e.movementX * LOOK_SPEED;
  pitch -= e.movementY * LOOK_SPEED;
  pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  yawObject.rotation.y = yaw;
  camera.rotation.x = pitch;
});

const move = { forward: false, backward: false, left: false, right: false };
const velocity = new THREE.Vector3();
const SPEED = 6;

document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': move.forward = true; break;
    case 'KeyS': case 'ArrowDown': move.backward = true; break;
    case 'KeyA': case 'ArrowLeft': move.left = true; break;
    case 'KeyD': case 'ArrowRight': move.right = true; break;
    case 'KeyB': toggleDashboard2D(); break;
  }
});
document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': move.forward = false; break;
    case 'KeyS': case 'ArrowDown': move.backward = false; break;
    case 'KeyA': case 'ArrowLeft': move.left = false; break;
    case 'KeyD': case 'ArrowRight': move.right = false; break;
  }
});

function toggleDashboard2D() {
  const panel = document.getElementById('dashboard2d');
  const show = panel.style.display !== 'block';
  panel.style.display = show ? 'block' : 'none';
  window.CyberSound.playClick();
  if (show) {
    disengage();
    hint.classList.add('hidden');
    hud.style.display = 'none';
  } else {
    hud.style.display = 'block';
  }
}
document.getElementById('closeDashboard').addEventListener('click', toggleDashboard2D);

const ROOM_RADIUS = 12.5;
function clampToRoom() {
  const pos = yawObject.position;
  const dist = Math.hypot(pos.x, pos.z);
  if (dist > ROOM_RADIUS) {
    const scale = ROOM_RADIUS / dist;
    pos.x *= scale;
    pos.z *= scale;
  }
  pos.y = 1.7;
}

// --- Panneaux (chargés après les données) ---
function makeLabelSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(16,20,26,0.85)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#9fd3ff';
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(3.2, 0.6, 1);
  return sprite;
}

const textureById = {};
const panelMeshes = [];
const insightById = {}; // id -> { sprite, canvas, ctx, texture, worldX, worldZ }
const PROXIMITY_FAR = 6.5;
const PROXIMITY_NEAR = 3;

function drawInsightCanvas(canvas, text) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(13,17,23,0.88)';
  ctx.strokeStyle = '#4dabf7';
  ctx.lineWidth = 3;
  const r = 14;
  ctx.beginPath();
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, r);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#eaf4ff';
  ctx.font = '600 30px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}

function makeInsightSprite(id, text) {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 130;
  drawInsightCanvas(canvas, text);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0 });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.0, 0.6, 1);
  insightById[id] = { sprite, canvas, texture, opacity: 0 };
  return sprite;
}

// Appelé par charts.js quand un graphique est mis à jour (filtre année, curseur temporel)
window.onChartTextureDirty = (id) => {
  if (textureById[id]) textureById[id].needsUpdate = true;
  const insight = insightById[id];
  const meta = window.getChartMeta(id);
  if (insight && meta) {
    drawInsightCanvas(insight.canvas, meta.insight);
    insight.texture.needsUpdate = true;
  }
};

function buildPanels(chartList) {
  const radius = 9;
  const count = chartList.length;
  const group = new THREE.Group();

  chartList.forEach((item, i) => {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const texture = new THREE.CanvasTexture(item.canvas);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    textureById[item.id] = texture;

    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2.5),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
    );
    panel.position.set(x, 1.8, z);
    panel.lookAt(0, 1.8, 0);
    panel.userData.id = item.id;
    panelMeshes.push(panel);
    group.add(panel);

    // Cadre, placé légèrement en retrait (plus loin du centre) derrière le panneau
    const frameRadius = radius + 0.05;
    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 2.7),
      new THREE.MeshBasicMaterial({ color: 0x33222c })
    );
    frame.position.set(Math.cos(angle) * frameRadius, 1.8, Math.sin(angle) * frameRadius);
    frame.lookAt(0, 1.8, 0);
    group.add(frame);

    const label = makeLabelSprite(item.title);
    label.position.set(x * 1.02, 3.3, z * 1.02);
    group.add(label);

    // Plaque d'analyse : invisible par défaut, apparaît en fondu quand on s'approche
    const meta = window.getChartMeta(item.id);
    const insightSprite = makeInsightSprite(item.id, meta ? meta.insight : '');
    const plaqueRadius = radius - 1.6;
    insightSprite.position.set(Math.cos(angle) * plaqueRadius, 1.1, Math.sin(angle) * plaqueRadius);
    insightById[item.id].worldX = x;
    insightById[item.id].worldZ = z;
    group.add(insightSprite);
  });

  scene.add(group);
}

// Panneau d'accueil central
const titleSprite = makeLabelSprite('Dashboard Cybersécurité — 6 indicateurs');
titleSprite.scale.set(5, 0.9, 1);
titleSprite.position.set(0, 3.8, 0);
scene.add(titleSprite);

let rawData = null;
loadRaw().then((raw) => {
  rawData = raw;
  const data = aggregate(raw, null);
  const chartList = window.buildDashboard(data);
  buildPanels(chartList);

  const $filter = $('#yearFilter');
  raw.years.forEach(y => $filter.append($('<option>').val(y).text(y)));
  $filter.on('change', function () {
    window.CyberSound.playClick();
    const year = this.value || null;
    window.updateDashboard(aggregate(rawData, year));
  });
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Tooltip 3D : raycast depuis le viseur vers les panneaux ---
const raycaster = new THREE.Raycaster();
const camDir = new THREE.Vector3();
const camPos = new THREE.Vector3();
function updateTooltip() {
  if (!engaged || isDashboardOpen() || panelMeshes.length === 0) {
    tooltip3d.style.display = 'none';
    return;
  }
  camera.getWorldPosition(camPos);
  camera.getWorldDirection(camDir);
  raycaster.set(camPos, camDir);
  const hits = raycaster.intersectObjects(panelMeshes);
  if (hits.length && hits[0].distance < 11) {
    const meta = window.getChartMeta(hits[0].object.userData.id);
    if (meta) {
      const rows = meta.labels.map((l, i) => `${l} : ${Math.round(meta.values[i]).toLocaleString('fr-FR')}`).slice(0, 7);
      tooltip3d.innerHTML = `<strong>${meta.title}</strong><br>${rows.join('<br>')}`;
      tooltip3d.style.display = 'block';
      return;
    }
  }
  tooltip3d.style.display = 'none';
}

function updateInsightPlaques(delta) {
  const px = yawObject.position.x, pz = yawObject.position.z;
  for (const id in insightById) {
    const info = insightById[id];
    const dist = Math.hypot(px - info.worldX, pz - info.worldZ);
    let target = (PROXIMITY_FAR - dist) / (PROXIMITY_FAR - PROXIMITY_NEAR);
    target = Math.max(0, Math.min(1, target));
    info.opacity += (target - info.opacity) * Math.min(1, delta * 6);
    info.sprite.material.opacity = info.opacity;
  }
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (engaged && !isDashboardOpen()) {
    velocity.x -= velocity.x * 10 * delta;
    velocity.z -= velocity.z * 10 * delta;

    const dir = new THREE.Vector3();
    dir.z = Number(move.forward) - Number(move.backward);
    dir.x = Number(move.right) - Number(move.left);
    if (dir.x !== 0 || dir.z !== 0) dir.normalize();

    if (move.forward || move.backward) velocity.z -= dir.z * SPEED * 10 * delta;
    if (move.left || move.right) velocity.x -= dir.x * SPEED * 10 * delta;

    yawObject.translateX(-velocity.x * delta);
    yawObject.translateZ(velocity.z * delta);
    clampToRoom();
  }

  updateTooltip();
  updateInsightPlaques(delta);
  renderer.render(scene, camera);
}
animate();
