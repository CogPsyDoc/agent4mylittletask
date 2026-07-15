/**
 * 3D force-directed layout, Obsidian-style:
 *   - springs along links
 *   - Barnes-Hut n-body repulsion between nodes
 *   - a weak pull toward the origin (hubs drift to the center)
 *
 * The simulation cools (alpha decays) and freezes when settled, so nodes
 * hold still. Call reheat() after any filter/spacing change and the layout
 * gently re-settles.
 */

const THETA2 = 0.81; // Barnes-Hut opening criterion, squared
const EPS = 1e-4;

export class ForceSim {
  constructor() {
    this.n = 0;
    this.pos = new Float32Array(0); // xyz interleaved
    this.vel = new Float32Array(0);
    this.size = new Float32Array(0); // per-node visual radius → charge
    this.links = []; // {a, b, rest}
    this.alpha = 0;
    this.alphaDecay = 0.015;
    this.spread = 1; // link-length / spacing multiplier from the UI slider
    this.settled = true;
  }

  /**
   * (Re)build from visible nodes. `positions` is a Map(id -> [x,y,z]) used to
   * keep already-placed nodes where they are across filter changes.
   */
  setGraph(nodes, links, positions) {
    this.n = nodes.length;
    this.pos = new Float32Array(this.n * 3);
    this.vel = new Float32Array(this.n * 3);
    this.size = new Float32Array(this.n);
    this.ids = nodes.map((nd) => nd.id);

    const index = new Map();
    nodes.forEach((nd, i) => {
      index.set(nd.id, i);
      const p = positions.get(nd.id) || seedPosition(nd.id);
      this.pos[i * 3] = p[0];
      this.pos[i * 3 + 1] = p[1];
      this.pos[i * 3 + 2] = p[2];
      this.size[i] = nd.radius || 1;
    });

    this.links = [];
    for (const l of links) {
      const a = index.get(l.s);
      const b = index.get(l.t);
      if (a === undefined || b === undefined) continue;
      this.links.push({ a, b, rest: 1 });
    }
    this.reheat(1);
  }

  reheat(alpha = 0.45) {
    this.alpha = Math.max(this.alpha, alpha);
    this.settled = false;
  }

  /** Advance the simulation; returns true if positions changed. */
  tick(iterations = 1) {
    if (this.settled || this.n === 0) return false;
    for (let it = 0; it < iterations; it++) {
      this.alpha += (0 - this.alpha) * this.alphaDecay;
      if (this.alpha < 0.004) {
        this.alpha = 0;
        this.settled = true;
        break;
      }
      this.applyForces();
    }
    return true;
  }

  applyForces() {
    const { n, pos, vel, size, alpha, spread } = this;
    const repulsion = 900 * spread * spread;
    const linkLength = 55 * spread;
    const springK = 0.06;
    const centerK = 0.0025;
    const damping = 0.82;
    const maxV = 14 * spread;

    // --- repulsion via Barnes-Hut octree
    const tree = buildOctree(pos, size, n);
    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      let fx = 0; let fy = 0; let fz = 0;
      // Iterative traversal with an explicit stack.
      const stack = [tree];
      while (stack.length) {
        const node = stack.pop();
        if (!node || node.mass === 0) continue;
        let dx = node.cx - pos[ix];
        let dy = node.cy - pos[ix + 1];
        let dz = node.cz - pos[ix + 2];
        let d2 = dx * dx + dy * dy + dz * dz;
        if (node.body === i && node.count === 1) continue;
        if (node.count === 1 || (node.half * node.half * 4) / (d2 + EPS) < THETA2) {
          if (d2 < EPS) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); dz = (Math.random() - 0.5); d2 = 1; }
          const f = (repulsion * node.mass) / (d2 * Math.sqrt(d2) + EPS);
          fx -= dx * f; fy -= dy * f; fz -= dz * f;
        } else if (node.children) {
          for (let c = 0; c < 8; c++) if (node.children[c]) stack.push(node.children[c]);
        }
      }
      vel[ix] += fx * alpha;
      vel[ix + 1] += fy * alpha;
      vel[ix + 2] += fz * alpha;
    }

    // --- springs along links
    for (const l of this.links) {
      const a = l.a * 3; const b = l.b * 3;
      const dx = pos[b] - pos[a];
      const dy = pos[b + 1] - pos[a + 1];
      const dz = pos[b + 2] - pos[a + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + EPS;
      const rest = linkLength + (size[l.a] + size[l.b]) * 2;
      const f = springK * (d - rest) * alpha;
      const ux = (dx / d) * f; const uy = (dy / d) * f; const uz = (dz / d) * f;
      vel[a] += ux; vel[a + 1] += uy; vel[a + 2] += uz;
      vel[b] -= ux; vel[b + 1] -= uy; vel[b + 2] -= uz;
    }

    // --- weak centering + integrate
    for (let i = 0; i < n; i++) {
      const ix = i * 3;
      vel[ix] -= pos[ix] * centerK * alpha;
      vel[ix + 1] -= pos[ix + 1] * centerK * alpha;
      vel[ix + 2] -= pos[ix + 2] * centerK * alpha;

      let vx = vel[ix] *= damping;
      let vy = vel[ix + 1] *= damping;
      let vz = vel[ix + 2] *= damping;
      const v = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (v > maxV) {
        const s = maxV / v;
        vx = vel[ix] *= s; vy = vel[ix + 1] *= s; vz = vel[ix + 2] *= s;
      }
      pos[ix] += vx;
      pos[ix + 1] += vy;
      pos[ix + 2] += vz;
    }
  }

  /** Copy current positions into a Map(id -> [x,y,z]). */
  savePositions(map) {
    for (let i = 0; i < this.n; i++) {
      map.set(this.ids[i], [this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]]);
    }
    return map;
  }
}

/** Deterministic scatter on a sphere shell, seeded from the node id. */
function seedPosition(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  const r1 = ((h >>> 0) % 10000) / 10000;
  const r2 = ((Math.imul(h, 48271) >>> 0) % 10000) / 10000;
  const r3 = ((Math.imul(h, 69621) >>> 0) % 10000) / 10000;
  const theta = r1 * Math.PI * 2;
  const phi = Math.acos(2 * r2 - 1);
  const r = 120 + r3 * 240;
  return [
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi) * 0.7,
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

// ------------------------------------------------------------------ octree

function buildOctree(pos, size, n) {
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3]; const y = pos[i * 3 + 1]; const z = pos[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const half = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1) / 2 + 1;
  const root = newCell((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2, half);
  for (let i = 0; i < n; i++) insert(root, i, pos, size[i], 0);
  summarize(root);
  return root;
}

function newCell(x, y, z, half) {
  return {
    x, y, z, half,
    body: -1, count: 0, mass: 0, cx: 0, cy: 0, cz: 0, children: null,
  };
}

function insert(cell, i, pos, mass, depth) {
  if (cell.count === 0) {
    cell.body = i; cell.count = 1; cell.mass = mass;
    cell.cx = pos[i * 3]; cell.cy = pos[i * 3 + 1]; cell.cz = pos[i * 3 + 2];
    return;
  }
  if (depth > 24) { // coincident points — just merge into this cell
    cell.count += 1;
    cell.cx = (cell.cx * cell.mass + pos[i * 3] * mass) / (cell.mass + mass);
    cell.cy = (cell.cy * cell.mass + pos[i * 3 + 1] * mass) / (cell.mass + mass);
    cell.cz = (cell.cz * cell.mass + pos[i * 3 + 2] * mass) / (cell.mass + mass);
    cell.mass += mass;
    return;
  }
  if (!cell.children) {
    cell.children = new Array(8).fill(null);
    // push the existing single body down
    const b = cell.body;
    cell.body = -1;
    insertChild(cell, b, pos, cell.mass, depth);
  }
  insertChild(cell, i, pos, mass, depth);
  cell.count += 1;
}

function insertChild(cell, i, pos, mass, depth) {
  const x = pos[i * 3]; const y = pos[i * 3 + 1]; const z = pos[i * 3 + 2];
  const oct = (x > cell.x ? 1 : 0) | (y > cell.y ? 2 : 0) | (z > cell.z ? 4 : 0);
  if (!cell.children[oct]) {
    const h = cell.half / 2;
    cell.children[oct] = newCell(
      cell.x + (oct & 1 ? h : -h),
      cell.y + (oct & 2 ? h : -h),
      cell.z + (oct & 4 ? h : -h),
      h,
    );
  }
  insert(cell.children[oct], i, pos, mass, depth + 1);
}

function summarize(cell) {
  if (!cell.children) return; // leaf: mass/center already set
  let m = 0; let cx = 0; let cy = 0; let cz = 0;
  for (let c = 0; c < 8; c++) {
    const ch = cell.children[c];
    if (!ch) continue;
    summarize(ch);
    m += ch.mass;
    cx += ch.cx * ch.mass; cy += ch.cy * ch.mass; cz += ch.cz * ch.mass;
  }
  cell.mass = m;
  if (m > 0) { cell.cx = cx / m; cell.cy = cy / m; cell.cz = cz / m; }
}
