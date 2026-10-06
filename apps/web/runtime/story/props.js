import * as DefaultTHREE from '../world/vendor/three/three.module.js';
import { IDS, PAPER_W, PAPER_H, PAPER_THICKNESS, PAPER_FRONT_OFFSET, clamp } from './geometry.js';

/**
 * Add only the story book and three unlettered paper shells to an existing scene.
 * The host retains its renderer, camera, Ball, lights, platter, clock and DOM ink.
 * A supplied contact-shadow texture is borrowed; dispose never releases it.
 */
export function createStoryProps({ THREE = DefaultTHREE, scene, shadowTexture } = {}) {
  if (!scene?.add) throw new TypeError('createStoryProps requires the host scene');

  const root = new THREE.Group();
  root.name = 'PersonalOS / cinematic props';
  root.visible = false;
  scene.add(root);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const shadowCasters = [];
  const material = (Type, parameters) => {
    const result = new Type({ ...parameters, transparent: true });
    materials.add(result);
    return result;
  };
  const mesh = (geometry, mat, parent, name) => {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, mat);
    result.name = name;
    result.castShadow = result.receiveShadow = true;
    shadowCasters.push(result);
    parent.add(result);
    return result;
  };

  // The source's deterministic cloth micro-surface, independent of actor assets.
  const noiseSize = 128, data = new Uint8Array(noiseSize * noiseSize * 4);
  let seed = 7027;
  for (let i = 0; i < noiseSize * noiseSize; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 120 + (seed >>> 26);
    data.set([value, value, value, 255], i * 4);
  }
  const noise = new THREE.DataTexture(data, noiseSize, noiseSize, THREE.RGBAFormat);
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.repeat.set(8, 8);
  noise.needsUpdate = true;
  textures.add(noise);

  const coverMat = material(THREE.MeshPhysicalMaterial, {
    color: '#6C809F', roughness: .46, metalness: .025, clearcoat: .12,
    bumpMap: noise, bumpScale: .002,
  });
  const pageMat = material(THREE.MeshStandardMaterial, { color: '#F5F1EA', roughness: .87 });
  const edgeMat = material(THREE.MeshStandardMaterial, { color: '#C9C6BE', roughness: .9 });
  const tabMat = material(THREE.MeshStandardMaterial, { color: '#A9B4C7', roughness: .8 });

  // Authored book values, with Blender (x,y,z) translated to Three (x,z,-y).
  const book = new THREE.Group();
  book.name = 'Story book';
  book.position.set(-1, .36, -.1);
  book.scale.setScalar(1.12);
  root.add(book);
  function cube(w, h, d, mat, x, y, z, name, parent = book) {
    const result = mesh(new THREE.BoxGeometry(w, h, d), mat, parent, name);
    result.position.set(x, y, z);
    return result;
  }
  cube(1.95, .07, 1.46, coverMat, 0, 0, 0, 'Book lower cover');
  cube(1.82, .2, 1.33, pageMat, 0, .135, 0, 'Book page block');
  for (let i = 0; i < 7; i++) {
    cube(1.824, .004, 1.334, edgeMat, 0, .055 + i * .026, 0, `Book page edge ${i + 1}`);
  }
  const hinge = new THREE.Group();
  hinge.name = 'Story book hinge';
  hinge.position.set(-.975, .31, 0);
  book.add(hinge);
  const lid = cube(1.95, .07, 1.46, coverMat, .975, 0, 0, 'Book opening cover', hinge);
  cube(.15, .32, 1.46, coverMat, -.945, .16, 0, 'Continuous cloth spine');
  const hingePin = mesh(new THREE.CylinderGeometry(.041, .041, 1.46, 48), coverMat, book, 'Connected rounded hinge edge');
  hingePin.rotation.x = Math.PI / 2;
  hingePin.position.set(-.975, .31, 0);
  cube(.085, .015, .38, tabMat, .52, .03, .83, 'Book ribbon tab');

  // This optional contact is book-local and uses only the host's existing map.
  // It never constructs an auxiliary canvas, light, floor or shadow renderer.
  let contactShadow = null;
  if (shadowTexture) {
    const geometry = new THREE.PlaneGeometry(2.25, 1.75);
    geometries.add(geometry);
    contactShadow = new THREE.Mesh(geometry, material(THREE.MeshBasicMaterial, {
      map: shadowTexture, opacity: .35, depthWrite: false, toneMapped: false,
    }));
    contactShadow.name = 'Book contact shadow';
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -.034;
    book.add(contactShadow);
  }

  const papers = IDS.map(id => {
    const group = new THREE.Group();
    group.name = `${id} / world paper shell`;
    group.userData.contentId = id;
    root.add(group);
    const front = mesh(new THREE.PlaneGeometry(PAPER_W, PAPER_H), material(THREE.MeshBasicMaterial, {
      color: '#F5F1EA', side: THREE.DoubleSide, toneMapped: false,
    }), group, `${id} / paper front`);
    front.position.z = PAPER_FRONT_OFFSET;
    const edge = mesh(new THREE.BoxGeometry(PAPER_W, PAPER_H, PAPER_THICKNESS - .001), pageMat,
      group, `${id} / paper thickness`);
    edge.position.z = -.0005;
    return group;
  });

  let disposed = false, lastOpacity = null;
  function apply(worldPose, { opacity = 1, papersVisible = true } = {}) {
    if (disposed) return false;
    if (!worldPose || !Number.isFinite(worldPose.cover) || worldPose.papers?.length !== IDS.length) {
      throw new TypeError('Story props require a complete three-paper world pose');
    }
    if (!Number.isFinite(opacity)) throw new RangeError('Story prop opacity must be finite');
    const alpha = clamp(opacity);
    root.visible = alpha > 0;
    if (alpha !== lastOpacity) {
      for (const mat of materials) {
        const contact = mat === contactShadow?.material;
        mat.opacity = alpha * (contact ? .35 : 1);
        mat.depthWrite = !contact && alpha >= .999;
      }
      // Avoid an opaque cast-shadow silhouette while the props fade out.
      for (const caster of shadowCasters) caster.castShadow = alpha >= .999;
      lastOpacity = alpha;
    }
    hinge.rotation.z = worldPose.cover;
    papers.forEach((paper, index) => {
      const pose = worldPose.papers[index];
      paper.scale.set(pose.size.width / PAPER_W, pose.size.height / PAPER_H, 1);
      paper.position.copy(pose.position);
      paper.quaternion.copy(pose.quaternion);
      const visible = Array.isArray(papersVisible) ? papersVisible[index]
        : papersVisible instanceof Set ? papersVisible.has(IDS[index]) : papersVisible;
      paper.visible = alpha > 0 && Boolean(visible);
    });
    return true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    root.visible = false;
    root.removeFromParent();
    for (const geometry of geometries) geometry.dispose();
    for (const mat of materials) mat.dispose();
    for (const texture of textures) texture.dispose();
    root.clear();
  }

  return { apply, dispose, root, book, hinge, lid, hingePin, papers, contactShadow };
}
