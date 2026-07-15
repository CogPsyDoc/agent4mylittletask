/**
 * Code-generated starfield: a shell of points around the world with subtle
 * per-star twinkle, recolored when the theme changes.
 */

import * as THREE from 'three';

export function createStarfield(theme, { radiusMin = 1600, radiusMax = 3800, countScale = 1 } = {}) {
  const count = Math.floor(theme.stars.count * countScale);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // Uniform direction, biased slightly toward the horizon looks better.
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radiusMin + Math.random() * (radiusMax - radiusMin);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    color.set(theme.stars.colors[(Math.random() * theme.stars.colors.length) | 0]);
    const b = 0.35 + Math.random() * 0.65;
    colors[i * 3] = color.r * b;
    colors[i * 3 + 1] = color.g * b;
    colors[i * 3 + 2] = color.b * b;
    seeds[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTwinkle: { value: theme.stars.twinkle },
    },
    vertexShader: /* glsl */`
      attribute float seed;
      varying vec3 vColor;
      varying float vSeed;
      void main() {
        vColor = color;
        vSeed = seed;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (2.2 + fract(seed) * 2.6) * (900.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uTwinkle;
      varying vec3 vColor;
      varying float vSeed;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        if (d > 0.5) discard;
        float glow = smoothstep(0.5, 0.0, d);
        float tw = 1.0 - uTwinkle * 0.5 * (0.5 + 0.5 * sin(uTime * (1.0 + fract(vSeed) * 2.0) + vSeed * 7.0));
        gl_FragColor = vec4(vColor * glow * glow * tw, glow * tw);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.name = 'starfield';
  points.userData.update = (t) => { mat.uniforms.uTime.value = t; };
  return points;
}
