/**
 * Third-person flight, flight-simulator style with stable yaw-based movement:
 *
 *   mouse      — turns heading (yaw) and tilts view (pitch); never rolls
 *   W / S      — thrust forward/back along the *level* heading
 *   A / D      — strafe left/right
 *   R / F      — rise / descend
 *   Space      — hold for hyperdrive
 *
 * Movement is force-based with damping, so it feels weighty. The camera
 * chases with a slight lag (the world swings) while the avatar itself is
 * always dead-center in the frame.
 */

import * as THREE from 'three';

const PITCH_LIMIT = Math.PI / 2 - 0.08;

export class FlightController {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;

    this.position = new THREE.Vector3(0, 30, 320);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.05;

    this.baseSpeed = 40; // set by the speed slider
    this.accel = 3.2; // approach rate toward target velocity (1/s)
    this.sensitivity = 0.0022;

    this.hyper = 0; // 0..1 ramp
    this.hyperHeld = false;
    this.hyperMultiplier = 9;

    this.enabled = true;
    this.keys = new Set();

    this.avatar = null;
    this.cameraDistance = 14;
    this._camPos = new THREE.Vector3();
    this._smoothCam = null; // lazily initialised to first computed position

    this._bind();
  }

  setAvatar(object) {
    this.avatar = object;
  }

  _bind() {
    this.canvas.addEventListener('click', () => {
      if (this.enabled && document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock();
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.canvas || !this.enabled) return;
      this.yaw -= e.movementX * this.sensitivity;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - e.movementY * this.sensitivity, -PITCH_LIMIT, PITCH_LIMIT,
      );
    });
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      this.keys.add(e.code);
      if (e.code === 'Space') { this.hyperHeld = true; e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.hyperHeld = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.hyperHeld = false; });
  }

  get pointerLocked() {
    return document.pointerLockElement === this.canvas;
  }

  /** Direction the view faces, including pitch. */
  viewDir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  update(dt) {
    dt = Math.min(dt, 0.05);

    // Hyperdrive ramps up while held, bleeds off quickly when released.
    const hyperTarget = (this.hyperHeld && this.enabled) ? 1 : 0;
    const hyperRate = this.hyperHeld ? 1.6 : 5.5;
    this.hyper += (hyperTarget - this.hyper) * Math.min(1, hyperRate * dt);
    if (!this.hyperHeld && this.hyper < 0.02) this.hyper = 0;

    // --- input → target velocity in world space (yaw-level basis)
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const target = new THREE.Vector3();

    if (this.enabled) {
      if (this.keys.has('KeyW')) target.add(forward);
      if (this.keys.has('KeyS')) target.sub(forward);
      if (this.keys.has('KeyD')) target.add(right);
      if (this.keys.has('KeyA')) target.sub(right);
      if (this.keys.has('KeyR')) target.y += 1;
      if (this.keys.has('KeyF')) target.y -= 1;
    }
    if (target.lengthSq() > 0) target.normalize();

    const speed = this.baseSpeed * (1 + this.hyper * (this.hyperMultiplier - 1));
    target.multiplyScalar(speed);
    // Hyperdrive always surges forward along the view direction.
    if (this.hyper > 0.01) {
      target.addScaledVector(this.viewDir(), speed * this.hyper);
    }

    // Smooth acceleration toward the target, exponential damping.
    const k = 1 - Math.exp(-this.accel * dt);
    this.velocity.lerp(target, k);
    this.position.addScaledVector(this.velocity, dt);

    this._placeAvatar(dt);
    this._placeCamera(dt);
  }

  _placeAvatar(dt) {
    if (!this.avatar) return;
    this.avatar.position.copy(this.position);
    // Face the view direction; bank a little into turns for feel.
    const q = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'),
    );
    const lateral = this.velocity.dot(new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)));
    const bank = THREE.MathUtils.clamp(-lateral * 0.004, -0.5, 0.5);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), bank));
    this.avatar.quaternion.slerp(q, Math.min(1, 10 * dt));
    if (this.avatar.userData.animate) this.avatar.userData.animate(performance.now() / 1000);
  }

  _placeCamera(dt) {
    const dir = this.viewDir();
    const dist = this.cameraDistance * (1 + this.hyper * 0.4);
    this._camPos.copy(this.position)
      .addScaledVector(dir, -dist)
      .addScaledVector(new THREE.Vector3(0, 1, 0), dist * 0.28);

    if (!this._smoothCam) this._smoothCam = this._camPos.clone();
    // Lag the camera position so the world swings; look straight at the
    // avatar so it stays pinned to the center of the frame.
    this._smoothCam.lerp(this._camPos, 1 - Math.exp(-9 * dt));
    this.camera.position.copy(this._smoothCam);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.position);
  }

  /** Snapshot for dive-in/dive-out — restores you to the exact same spot. */
  saveState() {
    return {
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  restoreState(s) {
    this.position.copy(s.position);
    this.velocity.copy(s.velocity);
    this.yaw = s.yaw;
    this.pitch = s.pitch;
    this._smoothCam = null; // snap the camera, no interpolation from the other world
    this.update(0.0001);
  }
}
