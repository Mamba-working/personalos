import * as THREE from 'three';
// Existing self-authored Blender data maps, calibrated by bounded read-only
// extraction. Local RGBA8 pack: R physical bump, G roughness/.06. No color art.
export async function applyCanopyWetMaps(root, renderer) {
  const texture = await new THREE.TextureLoader().loadAsync('./assets/canopy-wet-stock-rgba8.png');
  texture.name = 'Approved canopy crease + wet height and variable roughness';
  texture.colorSpace = THREE.NoColorSpace; texture.flipY = false; texture.channel = 0;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = Math.min(4,renderer.capabilities.getMaxAnisotropy());texture.needsUpdate = true;
  let count = 0;
  root.traverse(mesh=>{if(mesh.isMesh && mesh.userData.slice_role==='canopy'){
    mesh.material.bumpMap=texture;mesh.material.bumpScale=.0006577785534318537;mesh.material.roughnessMap=texture;
    mesh.material.roughness=.06;mesh.material.normalMap=null;mesh.material.needsUpdate=true;count++;
  }});
  if(count!==1){texture.dispose();throw new Error('Wet material expects the single approved canopy');}
  return {source:'Existing packed non-color self-authored Blender canopy maps',uv:'ConnectedWetField_SurfaceMetric_v1, verified exact glTF mapping',
    size:[1024,512],pack:'RGBA8 PNG',bytes:227080,sha256:'0a24cc230df5a22bfd5cf0ff36c4c0ff39eadf688539dee8f384ca2760f5e5fa',
    bumpScaleMetres:.0006577785534318537,heightQuantizationStepMetres:.0006577785534318537/255,
    limit:'Calibrated single-bump approximation of chained Blender normals; no silhouette displacement or layered optical equivalence'};
}
