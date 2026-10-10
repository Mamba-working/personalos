/** Load existing self-authored canopy data into stock Three r180 materials.
 * No shader patch, geometry mutation, network dependency, or automatic fetch
 * beyond the caller-provided local asset base URL.
 */
export async function loadCanopyWetStock(THREE, baseURL) {
  const root = new URL(baseURL, globalThis.location?.href ?? 'http://localhost/');
  const read = async (name) => {
    const response = await fetch(new URL(name, root));
    if (!response.ok) throw new Error(`Canopy asset ${name}: HTTP ${response.status}`);
    return response;
  };
  const manifest = await (await read('stock-material-manifest.json')).json();
  const buffer = await (await read(manifest.runtimePack.file)).arrayBuffer();
  if (buffer.byteLength !== manifest.runtimePack.bytes) throw new Error('Invalid canopy map byte length');
  const texture = new THREE.DataTexture(new Uint16Array(buffer), ...manifest.size, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.name = 'Self-authored calibrated canopy wet bump + roughness';
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.channel = 0;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return {
    texture,
    manifest,
    apply(material) {
      material.bumpMap = texture;
      material.bumpScale = manifest.bumpScaleMetres;
      material.roughnessMap = texture;
      material.roughness = manifest.materialRoughness;
      // A normalMap would override bumpMap in the stock Three shader.
      material.normalMap = null;
      material.needsUpdate = true;
      return material;
    },
    dispose() { texture.dispose(); },
  };
}
