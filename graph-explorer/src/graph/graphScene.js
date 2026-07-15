/**
 * The galaxy: nodes, links, labels — driven by the force sim and the theme.
 *
 * Filtering (hubs / attachments) rebuilds the instance buffers and reheats
 * the sim; positions persist across rebuilds so toggling is instant and the
 * layout only gently re-settles.
 */

import * as THREE from 'three';
import { ForceSim } from './forceSim.js';
import { nodeColor } from '../themes.js';

const LABEL_POOL = 28;
const LABEL_DIST = 260; // labels fade in inside this range

export class GraphScene {
  constructor(scene, camera, theme) {
    this.scene = scene;
    this.camera = camera;
    this.theme = theme;

    this.graph = { nodes: [], links: [] };
    this.filters = { hubs: true, attachments: false };
    this.visible = []; // node records currently shown
    this.visibleLinks = [];
    this.positions = new Map(); // id -> [x,y,z], persists across filters
    this.sim = new ForceSim();

    this.nodeMesh = null;
    this.lineSegs = null;
    this.raycaster = new THREE.Raycaster();

    this.labels = [];
    this._initLabels();
  }

  setGraph(graph) {
    this.graph = graph;
    // Degree over the full graph (used for hub prominence and note panel).
    const degree = new Map();
    for (const l of graph.links) {
      degree.set(l.s, (degree.get(l.s) || 0) + 1);
      degree.set(l.t, (degree.get(l.t) || 0) + 1);
    }
    for (const n of graph.nodes) n.degree = degree.get(n.id) || 0;
    this.rebuild();
    // Pre-warm so the galaxy is mostly formed on first render.
    for (let i = 0; i < 200 && !this.sim.settled; i++) this.sim.tick();
    this.syncPositions();
  }

  setFilters(filters) {
    Object.assign(this.filters, filters);
    this.sim.savePositions(this.positions);
    this.rebuild();
  }

  setSpread(spread) {
    this.sim.spread = spread;
    this.sim.reheat(0.35);
  }

  setTheme(theme) {
    this.theme = theme;
    this._paintInstances();
    this._paintLinks();
    for (const l of this.labels) l.dirty = true;
  }

  /** Rebuild meshes for the current filter set. */
  rebuild() {
    this.visible = this.graph.nodes.filter((n) =>
      (n.kind !== 'hub' || this.filters.hubs) &&
      (n.kind !== 'attachment' || this.filters.attachments));
    const ids = new Set(this.visible.map((n) => n.id));
    this.visibleLinks = this.graph.links.filter((l) => ids.has(l.s) && ids.has(l.t));

    // Node size from *visible* degree so hidden attachments don't inflate notes.
    const vdeg = new Map();
    for (const l of this.visibleLinks) {
      vdeg.set(l.s, (vdeg.get(l.s) || 0) + 1);
      vdeg.set(l.t, (vdeg.get(l.t) || 0) + 1);
    }
    for (const n of this.visible) {
      const d = vdeg.get(n.id) || 0;
      n.radius = (n.kind === 'attachment' ? 1.1 : 1.7) + Math.sqrt(d) * 1.35;
    }

    this.sim.setGraph(this.visible, this.visibleLinks, this.positions);
    this._buildNodeMesh();
    this._buildLines();
    this.syncPositions();
  }

  _buildNodeMesh() {
    if (this.nodeMesh) {
      this.nodeMesh.geometry.dispose();
      this.scene.remove(this.nodeMesh);
    }
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshStandardMaterial({
      flatShading: true, roughness: 0.35, metalness: 0.1,
      emissive: 0xffffff, emissiveIntensity: 0.32,
    });
    // Tint emissive by the instance color so bloom glows in each node's hue.
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive * vColor.rgb;',
      );
    };
    this.nodeMesh = new THREE.InstancedMesh(geo, mat, Math.max(this.visible.length, 1));
    this.nodeMesh.count = this.visible.length;
    this.nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._paintInstances();
    this.scene.add(this.nodeMesh);
  }

  _paintInstances() {
    if (!this.nodeMesh) return;
    const c = new THREE.Color();
    this.visible.forEach((n, i) => {
      this.nodeMesh.setColorAt(i, c.set(nodeColor(this.theme, n)));
    });
    if (this.nodeMesh.instanceColor) this.nodeMesh.instanceColor.needsUpdate = true;
  }

  _buildLines() {
    if (this.lineSegs) {
      this.lineSegs.geometry.dispose();
      this.lineSegs.material.dispose();
      this.scene.remove(this.lineSegs);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.visibleLinks.length * 6), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.visibleLinks.length * 6), 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: this.theme.link.opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.lineSegs = new THREE.LineSegments(geo, mat);
    this.lineSegs.frustumCulled = false;
    this.scene.add(this.lineSegs);
    this._paintLinks();
  }

  _paintLinks() {
    if (!this.lineSegs) return;
    this.lineSegs.material.opacity = this.theme.link.opacity;
    const colors = this.lineSegs.geometry.attributes.color;
    const c = new THREE.Color();
    this.visibleLinks.forEach((l, i) => {
      c.set(l.kind === 'attachment' ? this.theme.link.attachmentColor : this.theme.link.color);
      colors.setXYZ(i * 2, c.r, c.g, c.b);
      colors.setXYZ(i * 2 + 1, c.r, c.g, c.b);
    });
    colors.needsUpdate = true;
  }

  /** Advance the sim (if hot) and push positions into the GPU buffers. */
  update() {
    if (this.sim.tick(2)) this.syncPositions();
    this._updateLabels();
  }

  syncPositions() {
    const { pos } = this.sim;
    const m = new THREE.Matrix4();
    this.visible.forEach((n, i) => {
      const r = n.radius;
      m.makeScale(r, r, r);
      m.setPosition(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      this.nodeMesh.setMatrixAt(i, m);
    });
    this.nodeMesh.instanceMatrix.needsUpdate = true;
    this.nodeMesh.computeBoundingSphere();

    const index = new Map(this.visible.map((n, i) => [n.id, i]));
    const lp = this.lineSegs.geometry.attributes.position;
    this.visibleLinks.forEach((l, i) => {
      const a = index.get(l.s) * 3; const b = index.get(l.t) * 3;
      lp.setXYZ(i * 2, pos[a], pos[a + 1], pos[a + 2]);
      lp.setXYZ(i * 2 + 1, pos[b], pos[b + 1], pos[b + 2]);
    });
    lp.needsUpdate = true;
  }

  nodePosition(node) {
    const i = this.visible.indexOf(node);
    if (i === -1) return null;
    return new THREE.Vector3(this.sim.pos[i * 3], this.sim.pos[i * 3 + 1], this.sim.pos[i * 3 + 2]);
  }

  findByLabel(label) {
    const lc = label.toLowerCase();
    return this.graph.nodes.find((n) => n.label.toLowerCase() === lc)
      || this.graph.nodes.find((n) => n.kind === 'note' && n.label.toLowerCase() === lc);
  }

  /** Raycast from the screen-center crosshair. Returns {node, distance} or null. */
  pickCenter(maxDist = Infinity) {
    if (!this.nodeMesh || this.visible.length === 0) return null;
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    this.raycaster.far = maxDist;
    const hits = this.raycaster.intersectObject(this.nodeMesh);
    if (!hits.length) return null;
    return { node: this.visible[hits[0].instanceId], distance: hits[0].distance };
  }

  /** Nearest visible node to a world position (for proximity opening). */
  nearest(point) {
    let best = null; let bestD = Infinity;
    const { pos } = this.sim;
    for (let i = 0; i < this.visible.length; i++) {
      const dx = pos[i * 3] - point.x;
      const dy = pos[i * 3 + 1] - point.y;
      const dz = pos[i * 3 + 2] - point.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < bestD) { bestD = d; best = this.visible[i]; }
    }
    return best ? { node: best, distance: bestD } : null;
  }

  // ------------------------------------------------------------- labels

  _initLabels() {
    for (let i = 0; i < LABEL_POOL; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 96;
      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({
        map: texture, transparent: true, opacity: 0, depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(30, 5.6, 1);
      sprite.visible = false;
      this.scene.add(sprite);
      this.labels.push({ sprite, canvas, texture, node: null, dirty: true });
    }
  }

  _drawLabel(entry) {
    const ctx = entry.canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 96);
    ctx.font = '600 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = this.theme.label.glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = this.theme.label.color;
    let text = entry.node.label;
    while (ctx.measureText(text).width > 490 && text.length > 4) text = `${text.slice(0, -2)}…`;
    ctx.fillText(text, 256, 50);
    entry.texture.needsUpdate = true;
    entry.dirty = false;
  }

  _updateLabels() {
    const cam = this.camera.position;
    const { pos } = this.sim;
    // Collect nodes in range, keep the closest LABEL_POOL of them.
    const inRange = [];
    for (let i = 0; i < this.visible.length; i++) {
      const dx = pos[i * 3] - cam.x;
      const dy = pos[i * 3 + 1] - cam.y;
      const dz = pos[i * 3 + 2] - cam.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < LABEL_DIST * LABEL_DIST) inRange.push([d2, i]);
    }
    inRange.sort((a, b) => a[0] - b[0]);
    const want = inRange.slice(0, LABEL_POOL);

    want.forEach(([d2, i], k) => {
      const entry = this.labels[k];
      const node = this.visible[i];
      if (entry.node !== node || entry.dirty) {
        entry.node = node;
        this._drawLabel(entry);
      }
      const d = Math.sqrt(d2);
      entry.sprite.visible = true;
      entry.sprite.position.set(pos[i * 3], pos[i * 3 + 1] + node.radius + 4.5, pos[i * 3 + 2]);
      // Fade in as you approach; fully visible inside 40% of range.
      const t = THREE.MathUtils.clamp(1 - (d - LABEL_DIST * 0.4) / (LABEL_DIST * 0.6), 0, 1);
      entry.sprite.material.opacity = t * t;
      const s = Math.max(d * 0.11, 9);
      entry.sprite.scale.set(s, s * 0.1875, 1);
    });
    for (let k = want.length; k < LABEL_POOL; k++) {
      this.labels[k].sprite.visible = false;
      this.labels[k].node = null;
    }
  }
}
