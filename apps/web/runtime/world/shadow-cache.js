/** Native renderer-owned cache for unchanged Three r180 shadow inputs.
 * VSM renders receivers as well as casters. Compare GPU buffer versions, not
 * vertex contents, and fall back to a fresh pass for custom/animated paths.
 * No render wrapping, clock, quality changes, or weather-side policy writer.
 */
export function createShadowCache({ THREE, renderer, scene, camera }) {
  let shadowMap = renderer.shadowMap;
  const originalAutoUpdate = shadowMap.autoUpdate;
  const previous = [];
  let cursor = 0, dirty = true, changed = false, unsafe = false, disposed = false;
  const value = next => { if (previous[cursor] !== next) changed = true; previous[cursor++] = next; };
  const array = values => { value(values?.length); if (values) for (const next of values) value(next); };
  const matrix = m => array(m?.elements);
  const vector = v => { value(v?.x); value(v?.y); value(v?.z); value(v?.w); };
  const attribute = a => { value(a); value(a?.version); value(a?.count); value(a?.data); value(a?.data?.version); };
  const planes = items => { value(items?.length); if (items) for (const p of items) { vector(p.normal); value(p.constant); } };
  function texture(t) {
    value(t); if (!t) return;
    value(t.version); value(t.channel); value(t.matrixAutoUpdate); matrix(t.matrix);
    vector(t.offset); vector(t.repeat); vector(t.center); value(t.rotation);
    value(t.wrapS); value(t.wrapT); value(t.flipY);
    if (t.isVideoTexture || t.isFramebufferTexture) unsafe = true;
  }
  function material(m) {
    value(m); if (!m) return;
    for (const key of ['version', 'visible', 'side', 'shadowSide', 'wireframe',
      'wireframeLinewidth', 'linewidth', 'alphaTest', 'alphaToCoverage',
      'displacementScale', 'displacementBias', 'clipShadows', 'clipIntersection']) value(m[key]);
    // Color, roughness, opacity and light intensity do not change r180's depth
    // material. Alpha-test/displacement textures and clipping do.
    if (m.alphaTest > 0 || m.alphaToCoverage) { texture(m.map); texture(m.alphaMap); }
    if (m.displacementMap && m.displacementScale !== 0) texture(m.displacementMap);
    if (m.clipShadows) planes(m.clippingPlanes);
    if (m.isShaderMaterial || m.isRawShaderMaterial) unsafe = true;
  }
  function visit(object) {
    if (!object.visible) return;
    if (object.isLight && object.castShadow && object.layers.test(camera.layers)) {
      const shadow = object.shadow;
      value(object); matrix(object.matrixWorld); value(shadow);
      matrix(object.target?.matrixWorld);
      if (!object.isDirectionalLight || !shadow) unsafe = true;
      if (shadow) {
        for (const key of ['bias', 'normalBias', 'radius', 'blurSamples', 'intensity', 'autoUpdate']) value(shadow[key]);
        vector(shadow.mapSize); value(shadow.map); value(shadow.mapPass); value(shadow.camera);
        const c = shadow.camera;
        for (const key of ['near', 'far', 'left', 'right', 'top', 'bottom', 'zoom', 'fov', 'aspect']) value(c[key]);
        matrix(c.projectionMatrix); vector(c.up); value(c.layers.mask);
        // A caller-requested refresh or missing/released map must not be lost.
        if (shadow.needsUpdate || shadow.map === null) dirty = true;
      }
    }
    if ((object.isMesh || object.isLine || object.isPoints) && object.layers.test(camera.layers)
      && (object.castShadow || (object.receiveShadow && shadowMap.type === THREE.VSMShadowMap))) {
      value(object); matrix(object.matrixWorld); value(object.castShadow); value(object.receiveShadow);
      value(object.frustumCulled); value(object.layers.mask);
      const g = object.geometry;
      value(g); attribute(g.index);
      for (const name of Object.keys(g.attributes)) { value(name); attribute(g.attributes[name]); }
      value(g.drawRange.start); value(g.drawRange.count);
      for (const group of g.groups) { value(group.start); value(group.count); value(group.materialIndex); }
      value(g.groups.length); vector(g.boundingSphere?.center); value(g.boundingSphere?.radius);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      value(materials.length); for (const m of materials) material(m);
      // These may deform geometry or alter depth at render time without a
      // BufferAttribute version. Preserve automatic behavior for such paths.
      if (object.isSkinnedMesh || object.isInstancedMesh || object.isBatchedMesh
        || Object.keys(g.morphAttributes).length || object.customDepthMaterial || object.customDistanceMaterial
        || object.onBeforeShadow !== THREE.Object3D.prototype.onBeforeShadow
        || object.onAfterShadow !== THREE.Object3D.prototype.onAfterShadow) unsafe = true;
    }
    for (const child of object.children) visit(child);
  }
  function prepare() {
    if (disposed) return false;
    // WebGLRenderer replaces its shadow-map service on context restoration.
    if (shadowMap !== renderer.shadowMap) { shadowMap = renderer.shadowMap; dirty = true; previous.length = 0; }
    // The native frame has now applied actor/story/weather changes. Resolve
    // parent transforms before comparing exactly what the shadow pass consumes.
    if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
    cursor = 0; changed = false; unsafe = false;
    value(shadowMap.enabled); value(shadowMap.type); value(camera.layers.mask);
    value(renderer.localClippingEnabled); planes(renderer.clippingPlanes);
    if (scene.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) unsafe = true;
    visit(scene);
    if (cursor !== previous.length) changed = true;
    previous.length = cursor;
    const refresh = dirty || changed || unsafe || shadowMap.needsUpdate;
    shadowMap.autoUpdate = false;
    if (refresh) shadowMap.needsUpdate = true;
    dirty = false;
    return Boolean(refresh);
  }
  return {
    prepare,
    invalidate() { if (!disposed) dirty = true; },
    dispose() {
      if (disposed) return;
      disposed = true; previous.length = 0;
      renderer.shadowMap.autoUpdate = originalAutoUpdate;
      // Leave any pending refresh intact; this service does not own the map.
    },
  };
}
