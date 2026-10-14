import {
  CircleGeometry, Color, CubeCamera, DirectionalLight, HalfFloatType, Mesh, MeshStandardMaterial,
  PMREMGenerator, Scene, WebGLCubeRenderTarget, type Object3D, type WebGLRenderer, type WebGLRenderTarget,
  type Vector3,
} from 'three';
import { applyPatches } from '../core/patch';
import { atmospherePatch } from './atmosphere';

/**
 * Sun (with soft VSM shadows around the ball) and an environment probe: the sky,
 * mountains and a stand-in ground are rendered into a small cube map and prefiltered
 * with PMREM, giving every PBR material sky-coloured ambient light and reflections.
 */
export class Lighting {
  readonly sun: DirectionalLight;
  readonly envScene = new Scene();
  private envSun: DirectionalLight;
  private envGround: Mesh;
  private cubeRT = new WebGLCubeRenderTarget(128, { type: HalfFloatType, generateMipmaps: false });
  private cubeCam = new CubeCamera(0.5, 40000, this.cubeRT);
  private pmrem: PMREMGenerator;
  private pmremRT: WebGLRenderTarget | null = null;
  private frames = 0;
  updateEvery = 6;

  constructor(renderer: WebGLRenderer, envSky: Object3D, envTerrain: Object3D) {
    this.sun = new DirectionalLight(0xffffff, 10);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 140;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 9;
    this.sun.shadow.blurSamples = 20;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;

    this.pmrem = new PMREMGenerator(renderer);
    this.envSun = new DirectionalLight(0xffffff, 10);
    const gmat = new MeshStandardMaterial({ color: 0x777777, roughness: 0.9 });
    applyPatches(gmat, [atmospherePatch]);
    this.envGround = new Mesh(new CircleGeometry(6000, 48), gmat);
    this.envGround.rotation.x = -Math.PI / 2;
    this.envScene.add(envSky, envTerrain, this.envGround, this.envSun, this.envSun.target);
  }

  /** Point the sun along `dir`, centred on the ball so the shadow map stays sharp where it matters. */
  setSun(dir: Vector3, color: Color, intensity: number, focus: Vector3) {
    this.sun.color.copy(color);
    this.sun.intensity = intensity;
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(dir, 60);
    this.sun.target.updateMatrixWorld();
    this.envSun.color.copy(color);
    this.envSun.intensity = intensity;
    this.envSun.position.copy(dir).multiplyScalar(100);
  }

  setGroundAlbedo(c: Color) { (this.envGround.material as MeshStandardMaterial).color.copy(c); }

  /** Re-render the probe every few frames (or immediately when `force`). */
  updateEnvironment(renderer: WebGLRenderer, scene: Scene, at: Vector3, force = false) {
    if (!force && this.frames++ % this.updateEvery !== 0) return;
    this.cubeCam.position.set(at.x, 1.2, at.z);
    const prevEnv = this.envScene.environment;
    this.envScene.environment = scene.environment;   // stand-in ground uses the previous probe
    this.cubeCam.update(renderer, this.envScene);
    this.envScene.environment = prevEnv;
    this.pmremRT = this.pmrem.fromCubemap(this.cubeRT.texture, this.pmremRT);
    scene.environment = this.pmremRT.texture;
  }
}
