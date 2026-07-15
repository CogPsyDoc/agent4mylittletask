/**
 * Pluggable avatars — everything is generated in code.
 *
 * An avatar factory returns a THREE.Object3D whose -Z axis is "forward"
 * (three.js camera convention), so the controller can orient it by heading.
 * Register new avatars in the registries below to swap them in.
 */

import * as THREE from 'three';

// ------------------------------------------------------------- flight ships

/** A little triangular dart — unmistakably points where you're heading. */
function makeDart() {
  const g = new THREE.Group();

  const body = new THREE.ConeGeometry(1.1, 4.2, 4, 1);
  body.rotateX(-Math.PI / 2); // cone tip toward -Z
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xb8c4d8, flatShading: true, metalness: 0.55, roughness: 0.4,
  });
  g.add(new THREE.Mesh(body, bodyMat));

  const wing = new THREE.BufferGeometry();
  // Two flat swept-back triangles.
  wing.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, 0.4,   3.4, 0, 2.6,   0, 0, 2.4, // right
    0, 0, 0.4,   0, 0, 2.4,   -3.4, 0, 2.6, // left
  ]), 3));
  wing.computeVertexNormals();
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x7f93b8, flatShading: true, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide,
  });
  g.add(new THREE.Mesh(wing, wingMat));

  const fin = wing.clone().rotateZ(Math.PI / 2);
  const finMesh = new THREE.Mesh(fin, wingMat);
  finMesh.scale.set(0.55, 0.55, 0.55);
  g.add(finMesh);

  // Engine glow — bright enough for bloom to pick up.
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x7fd4ff }),
  );
  glow.position.z = 2.3;
  glow.name = 'engineGlow';
  g.add(glow);

  return g;
}

/** Low-poly blob alternative — a squashed icosahedron with a nose light. */
function makeBlob() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.8, 0),
    new THREE.MeshStandardMaterial({
      color: 0x8fd48f, flatShading: true, metalness: 0.2, roughness: 0.7,
    }),
  );
  body.scale.set(1, 0.75, 1.25);
  g.add(body);

  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2a0 }),
  );
  nose.position.z = -2.0;
  nose.name = 'engineGlow';
  g.add(nose);
  return g;
}

// --------------------------------------------------------- interior avatars

/** A glowing wisp for swimming through the inside of a note. */
function makeWisp() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7, 0),
    new THREE.MeshBasicMaterial({ color: 0xcfffff }),
  );
  g.add(core);
  const shell = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1, 0),
    new THREE.MeshStandardMaterial({
      color: 0x66ccff, flatShading: true, transparent: true, opacity: 0.35,
      emissive: 0x2288cc, emissiveIntensity: 0.8,
    }),
  );
  g.add(shell);
  const light = new THREE.PointLight(0x99ddff, 30, 60, 2);
  g.add(light);
  g.userData.animate = (t) => {
    shell.rotation.set(t * 0.7, t * 0.9, 0);
    core.scale.setScalar(1 + Math.sin(t * 3) * 0.1);
  };
  return g;
}

/** A folded paper dart — you are inside a note, after all. */
function makePaperMoth() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf2f6ff, flatShading: true, roughness: 0.9, metalness: 0,
    emissive: 0x334466, emissiveIntensity: 0.4, side: THREE.DoubleSide,
  });
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    0, 0, -1.6,   2.2, 0.8, 1.2,   0, 0.15, 1.0,
    0, 0, -1.6,   0, 0.15, 1.0,   -2.2, 0.8, 1.2,
  ]), 3));
  wing.computeVertexNormals();
  g.add(new THREE.Mesh(wing, mat));
  const light = new THREE.PointLight(0xaaccff, 18, 50, 2);
  g.add(light);
  g.userData.animate = (t) => {
    g.children[0].scale.y = 1 + Math.sin(t * 6) * 0.25;
  };
  return g;
}

export const FLIGHT_AVATARS = {
  dart: { name: 'Dart', make: makeDart },
  blob: { name: 'Blob', make: makeBlob },
};

export const INTERIOR_AVATARS = {
  wisp: { name: 'Wisp', make: makeWisp },
  moth: { name: 'Paper Moth', make: makePaperMoth },
};

export function createAvatar(registry, key) {
  const entry = registry[key] || Object.values(registry)[0];
  const obj = entry.make();
  obj.name = `avatar:${key}`;
  return obj;
}
