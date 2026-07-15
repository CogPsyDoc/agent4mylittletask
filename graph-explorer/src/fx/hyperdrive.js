/**
 * Hyperdrive post-process: tunnel-vision vignette + radial smear + bright
 * speed-lines streaking past the screen edges. Intensity 0 is a passthrough.
 */

import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const HyperdriveShader = {
  name: 'HyperdriveShader',
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0 },
    uTime: { value: 0 },
    uTint: { value: [0.8, 0.9, 1.0] },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uTime;
    uniform vec3 uTint;
    varying vec2 vUv;

    float hash(float n) { return fract(sin(n) * 43758.5453123); }

    void main() {
      vec2 center = vec2(0.5);
      vec2 toC = vUv - center;
      float r = length(toC);

      // Ease-in so residual low intensities are truly invisible.
      float I = smoothstep(0.04, 1.0, uIntensity);
      if (I < 0.003) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      // Radial smear: sample along the ray toward the center.
      vec3 col = vec3(0.0);
      const int TAPS = 7;
      float total = 0.0;
      for (int i = 0; i < TAPS; i++) {
        float t = float(i) / float(TAPS - 1);
        float w = 1.0 - t * 0.55;
        vec2 offset = toC * t * 0.14 * I * smoothstep(0.05, 0.6, r);
        col += texture2D(tDiffuse, vUv - offset).rgb * w;
        total += w;
      }
      col /= total;

      // Speed lines: thin bright dashes racing outward along radial lanes.
      float angle = atan(toC.y, toC.x) / 6.28318 + 0.5; // 0..1 around the screen
      float streaks = 0.0;
      for (int k = 0; k < 2; k++) {
        float fk = float(k);
        float lanes = 70.0 + fk * 43.0;
        float laneF = angle * lanes + fk * 17.31;
        float laneId = floor(laneF);
        float seed = hash(laneId + fk * 91.0);
        // Thin angular profile — a line, not a wedge.
        float thin = smoothstep(0.14, 0.02, abs(fract(laneF) - 0.5));
        // Dash sliding outward along the lane.
        float phase = fract(r * (1.4 + seed * 1.2) - uTime * (2.0 + seed * 2.5) + seed * 7.0);
        float dash = smoothstep(0.55, 0.72, phase) * smoothstep(1.0, 0.85, phase);
        streaks += thin * dash * step(0.45, seed) * (0.4 + 0.6 * seed);
      }
      streaks *= smoothstep(0.22, 0.7, r) * I * I;
      col += uTint * streaks * 2.2;

      // Tunnel vignette closing in from the edges.
      float vig = 1.0 - I * 0.75 * smoothstep(0.35, 0.95, r);
      col *= vig;
      // Slight brightening at the very center — the tunnel mouth.
      col += uTint * I * 0.12 * smoothstep(0.35, 0.0, r);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createHyperdrivePass() {
  const pass = new ShaderPass(HyperdriveShader);
  pass.setIntensity = (v) => { pass.uniforms.uIntensity.value = v; };
  pass.setTime = (t) => { pass.uniforms.uTime.value = t; };
  pass.setTint = (rgb) => { pass.uniforms.uTint.value = rgb; };
  return pass;
}
