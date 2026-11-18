import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { loadData } from './data.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e13);
scene.fog = new THREE.Fog(0x0b0e13, 15, 40);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.7, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.2));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Sol
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(14, 48),
  new THREE.MeshStandardMaterial({ color: 0x1a2029, roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Grille au sol pour le repère visuel
const grid = new THREE.GridHelper(28, 28, 0x344155, 0x1f2733);
grid.position.y = 0.01;
scene.add(grid);

// --- Déplacement / contrôles ---
const controls = new PointerLockControls(camera, document.body);
const blocker = document.getElementById('blocker');
const hud = document.getElementById('hud');
const crosshair = document.createElement('div');
crosshair.id = 'crosshair';
document.body.appendChild(crosshair);

blocker.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => { blocker.style.display = 'none'; });
controls.addEventListener('unlock', () => {
  if (document.getElementById('dashboard2d').style.display !== 'block') {
    blocker.style.display = 'flex';
  }
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
  if (show) {
    controls.unlock();
    blocker.style.display = 'none';
    hud.style.display = 'none';
  } else {
    hud.style.display = 'block';
    blocker.style.display = 'flex';
  }
}
document.getElementById('closeDashboard').addEventListener('click', toggleDashboard2D);

const ROOM_RADIUS = 12.5;
function clampToRoom() {
  const pos = controls.getObject().position;
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

    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2.5),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
    );
    panel.position.set(x, 1.8, z);
    panel.lookAt(0, 1.8, 0);
    group.add(panel);

    // Cadre, placé légèrement en retrait (plus loin du centre) derrière le panneau
    const frameRadius = radius + 0.05;
    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 2.7),
      new THREE.MeshStandardMaterial({ color: 0x2a323c })
    );
    frame.position.set(Math.cos(angle) * frameRadius, 1.8, Math.sin(angle) * frameRadius);
    frame.lookAt(0, 1.8, 0);
    group.add(frame);

    const label = makeLabelSprite(item.title);
    label.position.set(x * 1.02, 3.3, z * 1.02);
    group.add(label);

    // Petit socle lumineux au sol devant chaque panneau
    const spot = new THREE.PointLight(0xffffff, 8, 6);
    spot.position.set(x * 0.6, 3, z * 0.6);
    group.add(spot);
  });

  scene.add(group);
}

// Panneau d'accueil central
const titleSprite = makeLabelSprite('Dashboard Cybersécurité — 6 indicateurs');
titleSprite.scale.set(5, 0.9, 1);
titleSprite.position.set(0, 3.8, 0);
scene.add(titleSprite);

loadData().then((data) => {
  const chartList = window.buildDashboard(data);
  buildPanels(chartList);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (controls.isLocked) {
    velocity.x -= velocity.x * 10 * delta;
    velocity.z -= velocity.z * 10 * delta;

    const dir = new THREE.Vector3();
    dir.z = Number(move.forward) - Number(move.backward);
    dir.x = Number(move.right) - Number(move.left);
    dir.normalize();

    if (move.forward || move.backward) velocity.z -= dir.z * SPEED * 10 * delta;
    if (move.left || move.right) velocity.x -= dir.x * SPEED * 10 * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    clampToRoom();
  }

  renderer.render(scene, camera);
}
animate();
