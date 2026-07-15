/**
 * Vault Galaxy — entry point.
 *
 * Two worlds share one renderer, camera and flight controller:
 *   galaxy   — the force-directed vault graph you fly through
 *   interior — inside a single note (dive with E, leave with E/Escape)
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { THEMES } from './themes.js';
import { GraphScene } from './graph/graphScene.js';
import { FlightController } from './controls/flightController.js';
import { createStarfield } from './fx/starfield.js';
import { createHyperdrivePass } from './fx/hyperdrive.js';
import { createAvatar, FLIGHT_AVATARS, INTERIOR_AVATARS } from './avatars.js';
import { InteriorWorld } from './interior/interior.js';
import { createUI } from './ui.js';
import { plainText } from './util/markdown.js';

const BASE = import.meta.env.BASE_URL;
const BASE_FOV = 70;

// ------------------------------------------------------------- renderer
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 9000);

// --------------------------------------------------------------- galaxy
let themeKey = 'deepSpace';
let theme = THEMES[themeKey];

const galaxy = new THREE.Scene();
galaxy.background = new THREE.Color(theme.background);
galaxy.fog = new THREE.FogExp2(theme.fog.color, theme.fog.density);

const hemi = new THREE.HemisphereLight(theme.lights.hemiSky, theme.lights.hemiGround, theme.lights.hemiIntensity);
galaxy.add(hemi);
const dir = new THREE.DirectionalLight(theme.lights.dir, theme.lights.dirIntensity);
dir.position.set(0.6, 1, 0.4);
galaxy.add(dir);

let stars = createStarfield(theme);
galaxy.add(stars);

const graphScene = new GraphScene(galaxy, camera, theme);

// ------------------------------------------------------ controller/avatar
const controller = new FlightController(canvas, camera);
let flightAvatarKey = 'dart';
let flightAvatar = createAvatar(FLIGHT_AVATARS, flightAvatarKey);
galaxy.add(flightAvatar);
controller.setAvatar(flightAvatar);

// -------------------------------------------------------------- interior
const interior = new InteriorWorld(camera);

// ---------------------------------------------------------- post-process
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(galaxy, camera);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  theme.bloom.strength, theme.bloom.radius, theme.bloom.threshold,
);
composer.addPass(bloom);
const hyperPass = createHyperdrivePass();
composer.addPass(hyperPass);
composer.addPass(new OutputPass());

const INTERIOR_BLOOM = { strength: 0.75, radius: 0.6, threshold: 0.32 };

function applyBloom(b) {
  bloom.strength = b.strength;
  bloom.radius = b.radius;
  bloom.threshold = b.threshold;
}

// ------------------------------------------------------------------- UI
let mode = 'galaxy';
const noteCache = new Map();
let proximityNode = null; // node whose panel was auto-opened by flying close

async function noteText(node) {
  if (node.kind !== 'note') return null;
  if (!noteCache.has(node.id)) {
    const res = await fetch(`${BASE}data/notes/${node.id}.md`);
    noteCache.set(node.id, res.ok ? await res.text() : '*Failed to load note text.*');
  }
  return noteCache.get(node.id);
}

async function openNote(node, { byProximity = false } = {}) {
  const text = await noteText(node);
  proximityNode = byProximity ? node : null;
  const actions = [];
  if (node.kind === 'note') {
    actions.push({ label: 'Dive in  (E)', onClick: () => diveInto(node) });
  }
  actions.push({
    label: 'Fly to',
    onClick: () => {
      const p = graphScene.nodePosition(node);
      if (!p) return;
      const back = controller.position.clone().sub(p);
      const d = Math.max(back.length(), 1);
      controller.position.copy(p).addScaledVector(back, (node.radius + 26) / d);
      controller.velocity.set(0, 0, 0);
    },
  });
  ui.showNote(node, text, actions);
}

const ui = createUI({
  onTheme: (key) => applyTheme(key),
  onFlightAvatar: (key) => {
    flightAvatarKey = key;
    galaxy.remove(flightAvatar);
    flightAvatar = createAvatar(FLIGHT_AVATARS, key);
    galaxy.add(flightAvatar);
    controller.setAvatar(flightAvatar);
  },
  onInteriorAvatar: (key) => {
    interior.setAvatar(key);
    if (mode === 'interior') controller.setAvatar(interior.avatar);
  },
  onFilters: (f) => graphScene.setFilters(f),
  onSpeed: (v) => { controller.baseSpeed = v; },
  onSpread: (v) => graphScene.setSpread(v),
  onWikilink: (label) => {
    const node = graphScene.findByLabel(label);
    if (node) openNote(node);
  },
});

function applyTheme(key) {
  themeKey = key;
  theme = THEMES[key];
  galaxy.background.set(theme.background);
  galaxy.fog.color.set(theme.fog.color);
  galaxy.fog.density = theme.fog.density;
  hemi.color.set(theme.lights.hemiSky);
  hemi.groundColor.set(theme.lights.hemiGround);
  hemi.intensity = theme.lights.hemiIntensity;
  dir.color.set(theme.lights.dir);
  dir.intensity = theme.lights.dirIntensity;

  galaxy.remove(stars);
  stars.geometry.dispose();
  stars.material.dispose();
  stars = createStarfield(theme);
  galaxy.add(stars);

  graphScene.setTheme(theme);
  hyperPass.setTint(theme.hyperTint);
  if (mode === 'galaxy') applyBloom(theme.bloom);
}

// ------------------------------------------------------------ dive in/out
let savedFlight = null;

async function diveInto(node) {
  if (mode !== 'galaxy' || node.kind !== 'note') return;
  const text = await noteText(node);
  savedFlight = controller.saveState();
  ui.dive(() => {
    interior.enter(node.label, plainText(text || node.label));
    const pose = interior.startPose();
    controller.position.copy(pose.position);
    controller.velocity.set(0, 0, 0);
    controller.yaw = pose.yaw;
    controller.pitch = pose.pitch;
    controller._smoothCam = null;
    controller.setAvatar(interior.avatar);
    renderPass.scene = interior.scene;
    applyBloom(INTERIOR_BLOOM);
    mode = 'interior';
    ui.hideNote();
    ui.setMode('interior', node.label);
  });
}

function surface() {
  if (mode !== 'interior' || !savedFlight) return;
  ui.dive(() => {
    controller.setAvatar(flightAvatar);
    controller.restoreState(savedFlight);
    renderPass.scene = galaxy;
    applyBloom(theme.bloom);
    mode = 'galaxy';
    ui.setMode('galaxy');
  });
}

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.code === 'KeyE') {
    if (mode === 'interior') surface();
    else {
      const target = (ui.openNode && ui.openNode.kind === 'note') ? ui.openNode
        : graphScene.pickCenter(600)?.node;
      if (target && target.kind === 'note') diveInto(target);
    }
  }
  if (e.code === 'Escape' && mode === 'interior') surface();
});

// Crosshair click → open whatever is centered.
canvas.addEventListener('click', () => {
  if (mode !== 'galaxy' || !controller.pointerLocked) return;
  const hit = graphScene.pickCenter(600);
  if (hit) openNote(hit.node);
});

// ------------------------------------------------------------- load data
const graphData = await fetch(`${BASE}data/graph.json`).then((r) => r.json());
graphScene.setGraph(graphData);
ui.setStats({
  notes: graphData.nodes.filter((n) => n.kind === 'note').length,
  hubs: graphData.nodes.filter((n) => n.kind === 'hub').length,
  attachments: graphData.nodes.filter((n) => n.kind === 'attachment').length,
  links: graphData.links.length,
});
ui.setMode('galaxy');

// Small debug/scripting handle (also used by the smoke tests).
window.__vaultGalaxy = {
  controller,
  graphScene,
  interior,
  hyperPass,
  bloom,
  stars: () => stars,
  get mode() { return mode; },
  openNote: (id) => {
    const node = graphData.nodes.find((n) => n.id === id || n.label === id);
    if (node) openNote(node);
    return node;
  },
  dive: (id) => {
    const node = graphData.nodes.find((n) => (n.id === id || n.label === id) && n.kind === 'note');
    if (node) diveInto(node);
    return node;
  },
  surface,
};

// ------------------------------------------------------------- main loop
const clock = new THREE.Clock();
let lastFov = BASE_FOV;

function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  controller.update(dt);

  if (mode === 'galaxy') {
    graphScene.update();
    stars.userData.update(t);

    // Crosshair targeting + proximity note opening.
    const hit = graphScene.pickCenter(600);
    ui.setTargeted(!!hit);
    const near = graphScene.nearest(controller.position);
    if (near) {
      const openDist = near.node.radius * 2 + 16;
      if (near.distance < openDist && ui.openNode !== near.node) {
        openNote(near.node, { byProximity: true });
      } else if (proximityNode && ui.openNode === proximityNode
        && (near.node !== proximityNode || near.distance > openDist * 2.5)) {
        ui.hideNote();
        proximityNode = null;
      }
    }
  } else {
    // Stay above the water inside a note.
    if (controller.position.y < 1.6) {
      controller.position.y = 1.6;
      if (controller.velocity.y < 0) controller.velocity.y = 0;
    }
    interior.update(dt, t);
    ui.setTargeted(false);
  }

  // Hyperdrive: tunnel FOV + streak shader.
  const fov = BASE_FOV * (1 + controller.hyper * 0.32);
  if (Math.abs(fov - lastFov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    lastFov = fov;
  }
  hyperPass.setIntensity(controller.hyper);
  hyperPass.setTime(t);

  composer.render();
}
tick();

// ---------------------------------------------------------------- resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
