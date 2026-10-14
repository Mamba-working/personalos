import {
  HalfFloatType, LinearFilter, LinearMipmapLinearFilter, Matrix4, PerspectiveCamera, Plane, RGBAFormat,
  Vector3, Vector4, WebGLRenderTarget, type Scene, type WebGLRenderer,
} from 'three';

/** Layer that objects enable to show up in the ground reflection. */
export const REFLECT_LAYER = 1;

/**
 * Renders the scene mirrored about the ground plane (y = 0) into a mip-mapped texture.
 * Camera math follows three's Reflector, including the oblique near plane that clips
 * everything below the ground. The ground shader samples `texture` with `textureMatrix`
 * (world → mirror UV) and uses the mips as a roughness blur.
 */
export class PlanarReflection {
  readonly camera = new PerspectiveCamera();
  readonly target: WebGLRenderTarget;
  readonly textureMatrix = new Matrix4();
  resolutionScale = 0.7;

  private normal = new Vector3(0, 1, 0);
  private plane = new Plane();
  private clipPlane = new Vector4();
  private q = new Vector4();
  private view = new Vector3();
  private lookAt = new Vector3();
  private targetPos = new Vector3();
  private camWorld = new Vector3();
  private rot = new Matrix4();

  constructor() {
    this.target = new WebGLRenderTarget(4, 4, {
      type: HalfFloatType, format: RGBAFormat, samples: 0,
      minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter, generateMipmaps: true,
    });
    this.camera.layers.set(REFLECT_LAYER);
  }

  get texture() { return this.target.texture; }

  setSize(drawW: number, drawH: number) {
    this.target.setSize(Math.max(8, Math.round(drawW * this.resolutionScale)), Math.max(8, Math.round(drawH * this.resolutionScale)));
  }

  render(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
    const cam = this.camera;
    this.camWorld.setFromMatrixPosition(camera.matrixWorld);
    if (this.camWorld.y <= 0.01) return;

    // mirrored eye
    this.view.copy(this.camWorld);
    this.view.y = -this.view.y;
    // mirrored look-at target and up vector
    this.rot.extractRotation(camera.matrixWorld);
    this.lookAt.set(0, 0, -1).applyMatrix4(this.rot).add(this.camWorld);
    this.targetPos.copy(this.lookAt);
    this.targetPos.y = -this.targetPos.y;
    cam.position.copy(this.view);
    cam.up.set(0, 1, 0).applyMatrix4(this.rot);
    cam.up.y = -cam.up.y;
    cam.lookAt(this.targetPos);
    cam.near = camera.near;
    cam.far = camera.far;
    cam.updateMatrixWorld();
    cam.projectionMatrix.copy(camera.projectionMatrix);

    // world -> mirror texture coordinates
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);

    // oblique near plane = ground plane (Eric Lengyel's technique)
    this.plane.setFromNormalAndCoplanarPoint(this.normal, new Vector3(0, 0, 0));
    this.plane.applyMatrix4(cam.matrixWorldInverse);
    this.clipPlane.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
    const p = cam.projectionMatrix.elements;
    this.q.x = (Math.sign(this.clipPlane.x) + p[8]) / p[0];
    this.q.y = (Math.sign(this.clipPlane.y) + p[9]) / p[5];
    this.q.z = -1.0;
    this.q.w = (1.0 + p[10]) / p[14];
    this.clipPlane.multiplyScalar(2.0 / this.clipPlane.dot(this.q));
    p[2] = this.clipPlane.x;
    p[6] = this.clipPlane.y;
    p[10] = this.clipPlane.z + 1.0;
    p[14] = this.clipPlane.w;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    const prevTarget = renderer.getRenderTarget();
    const prevXr = renderer.xr.enabled;
    const prevShadowAuto = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;   // reuse this frame's shadow map
    renderer.setRenderTarget(this.target);
    renderer.state.buffers.depth.setMask(true);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.xr.enabled = prevXr;
    renderer.shadowMap.autoUpdate = prevShadowAuto;
    renderer.setRenderTarget(prevTarget);
  }

  dispose() { this.target.dispose(); }
}
