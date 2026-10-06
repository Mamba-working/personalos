import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../runtime/world/vendor/three/three.module.js';
import { createStoryProps } from '../../runtime/story/props.js';
import { IDS, HANDOFF, PAPER_W, PAPER_H, PAPER_FRONT_OFFSET, makeWorldPose } from '../../runtime/story/geometry.js';

const targets = [{ width: 348, height: 400 }, { width: 348, height: 330 }, { width: 348, height: 390 }];
const poseAt = time => makeWorldPose(time, 1440, 900, targets);

test('props add no actor, camera, renderer, lights, canvas or animation loop', () => {
  const source = fs.readFileSync(new URL('../../runtime/story/props.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /new THREE\.(WebGLRenderer|Scene|SphereGeometry|PerspectiveCamera|.*Light)|document\.|window\.|requestAnimationFrame/);
  const scene = new THREE.Scene(), existingActor = new THREE.Group();
  existingActor.name = 'Existing host Ball';
  scene.add(existingActor);
  const props = createStoryProps({ scene });
  assert.equal(scene.children.length, 2);
  assert.equal(scene.children[0], existingActor);
  assert.equal(props.root.visible, false);
  assert.deepEqual(props.papers.map(p => p.userData.contentId), IDS);
  assert.equal(props.root.children.length, 4);
  props.dispose();
  assert.deepEqual(scene.children, [existingActor]);
});

test('book hinge, pin and gaze edge stay attached throughout the full authored opening', () => {
  const scene = new THREE.Scene(), props = createStoryProps({ THREE, scene });
  for (let frame = 0; frame <= 291; frame++) {
    const pose = poseAt(frame / 30);
    assert.equal(props.apply(pose), true);
    scene.updateMatrixWorld(true);
    const hingeWorld = props.hinge.getWorldPosition(new THREE.Vector3());
    assert.ok(hingeWorld.distanceTo(pose.hingePosition) < 1e-12);
    assert.ok(props.hingePin.getWorldPosition(new THREE.Vector3()).distanceTo(hingeWorld) < 1e-12);
    assert.ok(new THREE.Vector3(-.975, 0, 0).applyMatrix4(props.lid.matrixWorld).distanceTo(hingeWorld) < 1e-12);
    assert.ok(new THREE.Vector3(.975, .035, 0).applyMatrix4(props.lid.matrixWorld).distanceTo(pose.edgeTarget) < 1e-12);
  }
  props.dispose();
});

test('actual paper-shell mesh corners equal the model corners for different card aspect ratios', () => {
  const scene = new THREE.Scene(), props = createStoryProps({ scene });
  for (const time of [0, 5.2, 7.3, 8.8, HANDOFF]) {
    const pose = poseAt(time);
    props.apply(pose);
    scene.updateMatrixWorld(true);
    props.papers.forEach((paper, index) => {
      const local = [[-PAPER_W / 2, PAPER_H / 2], [PAPER_W / 2, PAPER_H / 2],
        [PAPER_W / 2, -PAPER_H / 2], [-PAPER_W / 2, -PAPER_H / 2]];
      local.forEach(([x, y], corner) => {
        const point = new THREE.Vector3(x, y, PAPER_FRONT_OFFSET).applyMatrix4(paper.matrixWorld);
        assert.ok(point.distanceTo(pose.papers[index].corners[corner]) < 1e-12);
      });
      assert.equal(paper.children.length, 2);
      assert.equal(paper.children[0].material.toneMapped, false);
    });
  }
  props.dispose();
});

test('host controls independent paper ownership without replacing any mesh', () => {
  const scene = new THREE.Scene(), props = createStoryProps({ scene }), pose = poseAt(HANDOFF);
  const uuids = props.papers.map(p => p.uuid);
  props.apply(pose, { papersVisible: false });
  assert.ok(props.papers.every(p => !p.visible));
  assert.equal(props.root.visible, true);
  props.apply(pose, { papersVisible: [true, false, true] });
  assert.deepEqual(props.papers.map(p => p.visible), [true, false, true]);
  props.apply(pose, { papersVisible: new Set([IDS[1]]) });
  assert.deepEqual(props.papers.map(p => p.visible), [false, true, false]);
  props.apply(pose, { papersVisible: true });
  assert.ok(props.papers.every(p => p.visible));
  assert.deepEqual(props.papers.map(p => p.uuid), uuids);
  props.dispose();
});

test('opacity hides complete props and suppresses opaque cast shadows while fading', () => {
  const scene = new THREE.Scene(), texture = new THREE.Texture();
  const props = createStoryProps({ scene, shadowTexture: texture }), pose = poseAt(HANDOFF);
  props.apply(pose, { opacity: .4 });
  assert.equal(props.lid.material.opacity, .4);
  assert.equal(props.lid.material.depthWrite, false);
  assert.equal(props.lid.castShadow, false);
  assert.ok(Math.abs(props.contactShadow.material.opacity - .14) < 1e-12);
  props.apply(pose, { opacity: 0 });
  assert.equal(props.root.visible, false);
  assert.ok(props.papers.every(p => !p.visible));
  props.apply(pose, { opacity: 2 });
  assert.equal(props.lid.material.opacity, 1);
  assert.equal(props.lid.material.depthWrite, true);
  assert.equal(props.lid.castShadow, true);
  assert.equal(props.contactShadow.material.depthWrite, false);
  props.dispose();
  texture.dispose();
});

test('dispose releases owned resources once and preserves borrowed texture and host objects', () => {
  const scene = new THREE.Scene(), actor = new THREE.Group(), texture = new THREE.Texture();
  scene.add(actor);
  const props = createStoryProps({ scene, shadowTexture: texture });
  const resources = new Set();
  props.root.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    if (object.material) {
      resources.add(object.material);
      if (object.material.bumpMap) resources.add(object.material.bumpMap);
    }
  });
  const disposals = new Map();
  for (const resource of resources) resource.addEventListener('dispose', () => disposals.set(resource, (disposals.get(resource) || 0) + 1));
  let borrowedDisposals = 0;
  texture.addEventListener('dispose', () => borrowedDisposals++);
  props.dispose();
  props.dispose();
  assert.equal(disposals.size, resources.size);
  assert.ok([...disposals.values()].every(count => count === 1));
  assert.equal(borrowedDisposals, 0);
  assert.deepEqual(scene.children, [actor]);
  assert.equal(props.apply(poseAt(0)), false);
  assert.equal(props.root.children.length, 0);
});

test('invalid scene and incomplete poses fail explicitly', () => {
  assert.throws(() => createStoryProps(), TypeError);
  const scene = new THREE.Scene(), props = createStoryProps({ scene });
  assert.throws(() => props.apply({}), TypeError);
  assert.throws(() => props.apply(poseAt(0), { opacity: NaN }), RangeError);
  props.dispose();
});
