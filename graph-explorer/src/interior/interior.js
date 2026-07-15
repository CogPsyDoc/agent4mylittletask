/**
 * Inside a note: its text floats as glowing white letters over a rippling
 * reflective plane that dissolves into a starry night sky. Lightning wanders
 * through the letter field, scattering nearby letters outward and upward;
 * they spring back and re-form in its wake. Overhead, the same text hangs as
 * northern-lights curtains — purely decorative, not meant to be read.
 *
 * Everything here is generated in code from the note's text.
 */

import * as THREE from 'three';
import { getGlyphAtlas } from './glyphAtlas.js';
import { createStarfield } from '../fx/starfield.js';
import { createAvatar, INTERIOR_AVATARS } from '../avatars.js';

const MAX_GLYPHS = 2600;
const LINE_CHARS = 64;
const GLYPH_W = 2.1; // advance per character
const LINE_H = 4.6;
const FIELD_Y = 2.2; // resting height of letters above the plane

const SCATTER_RADIUS = 16;
const SCATTER_FORCE = 260;
const SPRING_K = 5.5;
const SPRING_DAMP = 3.2;

const INTERIOR_STARS_THEME = {
  stars: { colors: [0xffffff, 0xcfe0ff, 0xaad4ff, 0xfff2cf], count: 5200, twinkle: 0.7 },
};

const AURORA_PALETTES = [
  [0x39ff9e, 0x1e6fff],
  [0x66ffc4, 0x8a3fff],
  [0x3fffd8, 0xff4fd8],
  [0x7cff5e, 0x2f9fff],
  [0xb26bff, 0x35ffc9],
];

export class InteriorWorld {
  constructor(camera) {
    this.camera = camera;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040c);
    this.scene.fog = new THREE.FogExp2(0x030818, 0.0016);

    this.scene.add(new THREE.HemisphereLight(0x223a66, 0x02040a, 0.7));

    this.stars = createStarfield(INTERIOR_STARS_THEME, { radiusMin: 1200, radiusMax: 2600 });
    this.scene.add(this.stars);

    this.bolt = new Lightning();
    this.scene.add(this.bolt.group);

    this.ocean = this._makeOcean();
    this.scene.add(this.ocean);

    this.avatarKey = 'wisp';
    this.avatar = createAvatar(INTERIOR_AVATARS, this.avatarKey);
    this.scene.add(this.avatar);

    this.letters = null; // built per note
    this.auroras = [];
    this._time = 0;
  }

  setAvatar(key) {
    this.avatarKey = key;
    this.scene.remove(this.avatar);
    this.avatar = createAvatar(INTERIOR_AVATARS, key);
    this.scene.add(this.avatar);
  }

  /** Build the world for one note. */
  enter(title, text) {
    this._disposeNote();
    this.letters = new LetterField(title, text);
    this.scene.add(this.letters.mesh);
    this.scene.add(this.letters.mirror);
    this._buildAuroras(text || title);
  }

  /** Suggested start pose: hovering at the near edge of the text, facing it. */
  startPose() {
    const depth = this.letters ? this.letters.depth : 60;
    return { position: new THREE.Vector3(0, 9, depth / 2 + 46), yaw: 0, pitch: -0.12 };
  }

  update(dt, t) {
    this._time = t;
    this.stars.userData.update(t);
    this.bolt.update(dt, t, this.letters);
    if (this.letters) this.letters.update(dt, t, this.bolt.impact);
    const u = this.ocean.material.uniforms;
    u.uTime.value = t;
    u.uBolt.value.copy(this.bolt.impact);
    u.uBoltGlow.value = this.bolt.glow;
    for (const a of this.auroras) a.material.uniforms.uTime.value = t;
    if (this.avatar.userData.animate) this.avatar.userData.animate(t);
  }

  _makeOcean() {
    const geo = new THREE.CircleGeometry(2400, 96);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBolt: { value: new THREE.Vector3() },
        uBoltGlow: { value: 0 },
        uSky: { value: new THREE.Color(0x02040c) },
        uDeep: { value: new THREE.Color(0x04102a) },
        uGlint: { value: new THREE.Color(0x9fc4ff) },
      },
      vertexShader: /* glsl */`
        varying vec3 vWorld;
        void main() {
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uBolt;
        uniform float uBoltGlow;
        uniform vec3 uSky;
        uniform vec3 uDeep;
        uniform vec3 uGlint;
        varying vec3 vWorld;

        // Ripple height from a few directional waves; normal by analytic slope.
        vec2 slope(vec2 p, float t) {
          vec2 s = vec2(0.0);
          s += 0.35 * vec2(cos(p.x * 0.18 + t * 1.1), 0.0) * 0.18;
          s += 0.30 * vec2(0.0, cos(p.y * 0.23 - t * 0.9)) * 0.23;
          s += 0.22 * cos(dot(p, vec2(0.31, 0.27)) + t * 1.7) * vec2(0.31, 0.27);
          s += 0.16 * cos(dot(p, vec2(-0.42, 0.51)) + t * 2.3) * vec2(-0.42, 0.51);
          s += 0.09 * cos(dot(p, vec2(0.9, -0.7)) + t * 3.1) * vec2(0.9, -0.7);
          return s;
        }

        void main() {
          vec2 p = vWorld.xz;
          float r = length(p);
          vec2 sl = slope(p, uTime);
          vec3 N = normalize(vec3(-sl.x, 1.0, -sl.y));
          vec3 V = normalize(cameraPosition - vWorld);

          // "Moonlight" from high above, plus star-glint sparkle.
          vec3 L = normalize(vec3(0.35, 0.8, -0.45));
          float spec = pow(max(dot(reflect(-L, N), V), 0.0), 90.0);
          float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);

          vec3 col = uDeep * (0.55 + 0.45 * max(dot(N, L), 0.0));
          col = mix(col, uSky * 1.4, fres * 0.6);
          col += uGlint * spec * 0.8;

          // Lightning glow blooming across the nearby water.
          float bd = length(p - uBolt.xz);
          col += vec3(0.55, 0.7, 1.0) * uBoltGlow * 6.0 / (bd * bd * 0.08 + 16.0);

          // Dissolve into the sky at the horizon — no visible edge.
          float fade = 1.0 - smoothstep(900.0, 2100.0, r);
          float fog = 1.0 - exp(-0.0012 * r);
          col = mix(col, uSky, fog * 0.85);

          gl_FragColor = vec4(col, 0.92 * fade);
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    return mesh;
  }

  _buildAuroras(text) {
    for (const a of this.auroras) {
      this.scene.remove(a);
      a.geometry.dispose();
      a.material.uniforms.uMap.value.dispose();
      a.material.dispose();
    }
    this.auroras = [];

    const words = text.replace(/\s+/g, ' ').trim();
    for (let i = 0; i < 5; i++) {
      const palette = AURORA_PALETTES[i % AURORA_PALETTES.length];
      const width = 500 + i * 170;
      const height = 90 + (i % 3) * 45;
      const curtain = makeAuroraCurtain(words, width, height, palette, i);
      const angle = (i / 5) * Math.PI * 2 + 0.7;
      const dist = 380 + i * 130;
      curtain.position.set(Math.cos(angle) * dist, 130 + i * 42, Math.sin(angle) * dist);
      curtain.lookAt(0, curtain.position.y * 0.7, 0);
      this.scene.add(curtain);
      this.auroras.push(curtain);
    }
  }

  _disposeNote() {
    if (this.letters) {
      this.scene.remove(this.letters.mesh);
      this.scene.remove(this.letters.mirror);
      this.letters.dispose();
      this.letters = null;
    }
  }
}

// ---------------------------------------------------------------- letters

class LetterField {
  constructor(title, text) {
    const atlas = getGlyphAtlas();

    // Title as a big first line, then the body, word-wrapped.
    const body = (text || '').slice(0, 6000);
    const lines = [{ text: title.slice(0, LINE_CHARS), scale: 2.4 }, { text: '', scale: 1 }];
    for (const para of body.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        if ((line + word).length > LINE_CHARS) { lines.push({ text: line, scale: 1 }); line = ''; }
        line += (line ? ' ' : '') + word;
      }
      lines.push({ text: line, scale: 1 });
    }

    // Gather glyph instances.
    const glyphs = [];
    let z = 0;
    for (const { text: lineText, scale } of lines) {
      const w = lineText.length * GLYPH_W * scale;
      for (let c = 0; c < lineText.length; c++) {
        const ch = lineText[c];
        if (ch === ' ') continue;
        glyphs.push({
          x: c * GLYPH_W * scale - w / 2,
          z,
          scale,
          uv: atlas.uvFor(atlas.has(ch) ? ch : '•'),
        });
        if (glyphs.length >= MAX_GLYPHS) break;
      }
      z += LINE_H * scale;
      if (glyphs.length >= MAX_GLYPHS) break;
    }
    this.count = glyphs.length;
    this.depth = z;
    const zOff = -z / 2; // center the block on the origin

    const n = this.count;
    this.home = new Float32Array(n * 3);
    this.disp = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);

    const uvA = new Float32Array(n * 2);
    const seedA = new Float32Array(n);
    const scaleA = new Float32Array(n);
    glyphs.forEach((g, i) => {
      this.home[i * 3] = g.x;
      this.home[i * 3 + 1] = FIELD_Y + (g.scale - 1) * 1.4;
      this.home[i * 3 + 2] = g.z + zOff;
      uvA[i * 2] = g.uv[0];
      uvA[i * 2 + 1] = g.uv[1];
      seedA[i] = Math.random();
      scaleA[i] = g.scale;
    });

    const base = new THREE.PlaneGeometry(1.9, 2.6);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    geo.attributes.uv = base.attributes.uv;
    geo.instanceCount = n;
    geo.setAttribute('iHome', new THREE.InstancedBufferAttribute(this.home, 3));
    this.dispAttr = new THREE.InstancedBufferAttribute(this.disp, 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iDisp', this.dispAttr);
    geo.setAttribute('iGlyphUv', new THREE.InstancedBufferAttribute(uvA, 2));
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seedA, 1));
    geo.setAttribute('iScale', new THREE.InstancedBufferAttribute(scaleA, 1));
    this.geometry = geo;

    const makeMaterial = (mirror) => new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: atlas.texture },
        uCellUv: { value: new THREE.Vector2(atlas.cellUv[0], atlas.cellUv[1]) },
        uTime: { value: 0 },
        uMirror: { value: mirror ? -1 : 1 },
        uOpacity: { value: mirror ? 0.28 : 1 },
        uBrightness: { value: mirror ? 0.55 : 1.12 }, // just over bloom threshold
      },
      vertexShader: /* glsl */`
        attribute vec3 iHome;
        attribute vec3 iDisp;
        attribute vec2 iGlyphUv;
        attribute float iSeed;
        attribute float iScale;
        uniform float uTime;
        uniform float uMirror;
        uniform vec2 uCellUv;
        varying vec2 vUv;
        varying float vDim;
        void main() {
          vec3 world = iHome + iDisp;
          world.y += sin(uTime * 0.9 + iSeed * 6.2831) * 0.16;
          vDim = 1.0 - 0.35 * smoothstep(0.0, 26.0, iDisp.y + length(iDisp.xz)); // scattered letters dim slightly
          world.y *= uMirror;
          // Cylindrical billboard: letters stand upright, face the camera.
          vec3 toCam = cameraPosition - world;
          toCam.y = 0.0;
          float len = max(length(toCam), 0.001);
          toCam /= len;
          vec3 right = vec3(toCam.z, 0.0, -toCam.x);
          vec3 p = world + (right * position.x + vec3(0.0, uMirror, 0.0) * position.y) * iScale;
          vUv = iGlyphUv + uv * uCellUv;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap;
        uniform float uOpacity;
        uniform float uBrightness;
        varying vec2 vUv;
        varying float vDim;
        void main() {
          float a = texture2D(uMap, vUv).a;
          if (a < 0.03) discard;
          gl_FragColor = vec4(vec3(uBrightness) * vDim, a * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: !mirror,
      side: THREE.DoubleSide,
      fog: false,
    });

    this.mesh = new THREE.Mesh(geo, makeMaterial(false));
    this.mesh.renderOrder = 3;
    this.mesh.frustumCulled = false;
    this.mirror = new THREE.Mesh(geo, makeMaterial(true));
    this.mirror.renderOrder = 1;
    this.mirror.frustumCulled = false;
  }

  /** Spring physics: lightning shoves nearby letters out and up; they re-form. */
  update(dt, t, impact) {
    dt = Math.min(dt, 0.05);
    const { home, disp, vel, count } = this;
    const r2 = SCATTER_RADIUS * SCATTER_RADIUS;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const px = home[ix] + disp[ix];
      const py = home[ix + 1] + disp[ix + 1];
      const pz = home[ix + 2] + disp[ix + 2];

      const dx = px - impact.x;
      const dz = pz - impact.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < r2) {
        const d = Math.sqrt(d2) + 0.001;
        const falloff = 1 - d / SCATTER_RADIUS;
        const f = SCATTER_FORCE * falloff * falloff * dt;
        vel[ix] += (dx / d) * f;
        vel[ix + 2] += (dz / d) * f;
        vel[ix + 1] += f * (0.9 + 0.4 * falloff); // and upward
      }

      // Spring back home + damping.
      vel[ix] += (-SPRING_K * disp[ix] - SPRING_DAMP * vel[ix]) * dt;
      vel[ix + 1] += (-SPRING_K * disp[ix + 1] - SPRING_DAMP * vel[ix + 1]) * dt;
      vel[ix + 2] += (-SPRING_K * disp[ix + 2] - SPRING_DAMP * vel[ix + 2]) * dt;
      disp[ix] += vel[ix] * dt;
      disp[ix + 1] += vel[ix + 1] * dt;
      disp[ix + 2] += vel[ix + 2] * dt;
      // Letters never sink below the water.
      if (home[ix + 1] + disp[ix + 1] < 0.6) disp[ix + 1] = 0.6 - home[ix + 1];
    }
    this.dispAttr.needsUpdate = true;
    this.mesh.material.uniforms.uTime.value = t;
    this.mirror.material.uniforms.uTime.value = t;
  }

  dispose() {
    this.geometry.dispose();
    this.mesh.material.dispose();
    this.mirror.material.dispose();
  }
}

// --------------------------------------------------------------- lightning

class Lightning {
  constructor() {
    this.group = new THREE.Group();
    this.impact = new THREE.Vector3();
    this.glow = 0;
    this._regen = 0;

    this.segments = 16;
    const positions = new Float32Array((this.segments + 1) * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.line = new THREE.Line(this.geo, new THREE.LineBasicMaterial({
      color: 0xdfeaff, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.line.frustumCulled = false;
    this.group.add(this.line);

    this.light = new THREE.PointLight(0xbfd8ff, 0, 260, 1.8);
    this.group.add(this.light);

    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = spriteCanvas.height = 64;
    const ctx = spriteCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(220,235,255,1)');
    grad.addColorStop(0.4, 'rgba(150,190,255,0.35)');
    grad.addColorStop(1, 'rgba(120,160,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(spriteCanvas),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.flash.scale.set(26, 26, 1);
    this.group.add(this.flash);
  }

  /** The strike point wanders across the letter field. */
  update(dt, t, letters) {
    const hw = letters ? Math.max(letters.depth * 0.9, 70) : 70;
    this.impact.set(
      Math.sin(t * 0.23) * Math.sin(t * 0.11 + 2.1) * hw,
      0,
      Math.sin(t * 0.17 + 4.0) * Math.cos(t * 0.29) * hw * 0.8,
    );

    // Storm rhythm: mostly on, occasional lulls.
    const storm = 0.55 + 0.45 * Math.sin(t * 0.4) * Math.sin(t * 0.13 + 1.7);
    const flicker = 0.55 + 0.45 * Math.sin(t * 31.0) * Math.sin(t * 17.3);
    this.glow = Math.max(0, storm) * (0.4 + 0.6 * flicker);

    this._regen -= dt;
    if (this._regen <= 0) {
      this._regen = 0.06 + Math.random() * 0.06;
      this._rebuildBolt();
    }

    this.line.material.opacity = 0.25 + this.glow * 0.75;
    this.light.position.set(this.impact.x, 14, this.impact.z);
    this.light.intensity = this.glow * 260;
    this.flash.position.set(this.impact.x, 3.5, this.impact.z);
    this.flash.material.opacity = this.glow;
  }

  _rebuildBolt() {
    const pos = this.geo.attributes.position;
    const top = new THREE.Vector3(
      this.impact.x + (Math.random() - 0.5) * 30,
      55 + Math.random() * 25,
      this.impact.z + (Math.random() - 0.5) * 30,
    );
    for (let i = 0; i <= this.segments; i++) {
      const f = i / this.segments;
      // Jitter shrinks toward both anchor points.
      const j = Math.sin(f * Math.PI) * 9;
      pos.setXYZ(
        i,
        THREE.MathUtils.lerp(top.x, this.impact.x, f) + (Math.random() - 0.5) * j,
        THREE.MathUtils.lerp(top.y, 0.5, f),
        THREE.MathUtils.lerp(top.z, this.impact.z, f) + (Math.random() - 0.5) * j,
      );
    }
    pos.needsUpdate = true;
  }
}

// ----------------------------------------------------------------- aurora

function makeAuroraCurtain(text, width, height, palette, seed) {
  // Render the note's text into a long strip — texture for the curtain.
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const size = 54 + ((seed + r) % 3) * 22;
    ctx.font = `700 ${size}px "Courier New", monospace`;
    // Start each row at a different point in the text so rows differ.
    const start = ((seed * 131 + r * 517) % Math.max(text.length, 1));
    const rowText = (text.slice(start) + ' ' + text).slice(0, 220);
    ctx.fillText(rowText, -((seed * 97) % 300), (r + 0.5) * (canvas.height / rows));
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;

  const geo = new THREE.PlaneGeometry(width, height, 96, 10);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uSeed: { value: seed * 7.31 },
      uColorA: { value: new THREE.Color(palette[0]) },
      uColorB: { value: new THREE.Color(palette[1]) },
      uRepeat: { value: 1.0 + (seed % 3) * 0.7 },
      uSpeed: { value: 0.008 + (seed % 4) * 0.004 },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uSeed;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        // Slow curtain sway — several overlapping waves.
        float w1 = sin(uv.x * 9.0 + uTime * 0.5 + uSeed) * 14.0;
        float w2 = sin(uv.x * 23.0 - uTime * 0.31 + uSeed * 2.0) * 6.0;
        p.z += (w1 + w2) * (0.35 + uv.y);
        p.y += sin(uv.x * 5.0 + uTime * 0.4 + uSeed) * 6.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uTime;
      uniform float uRepeat;
      uniform float uSpeed;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec2 vUv;
      void main() {
        vec2 uv = vec2(vUv.x * uRepeat + uTime * uSpeed, vUv.y);
        float a = texture2D(uMap, uv).a;
        // Soft vertical falloff like an aurora sheet.
        float band = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.45, vUv.y);
        vec3 col = mix(uColorB, uColorA, vUv.y);
        float glow = a * band;
        gl_FragColor = vec4(col * (0.35 + glow * 1.3), glow * 0.75 + band * 0.05);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 4;
  mesh.frustumCulled = false;
  return mesh;
}
