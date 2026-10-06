import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../../runtime/world/vendor/three/three.module.js';
import {
  IDS, HANDOFF, END, PAPER_W, PAPER_H, PAPER_FRONT_OFFSET,
  actorPose, blenderToThree, cameraPose, makeWorldPose, normalizeTargetRect,
  paperDimensions, rectQuad, nativeRoute, storyFrame, remapProjectionMatrix,
  createWorldRebase, worldRebaseFrame, homography, projectHomography,
} from '../../runtime/story/geometry.js';

// Synthetic fixtures use the real record IDs and varied card dimensions.
// They are not measurements of browser layout or evidence of rendered pixels.
const targets = [
  { id: IDS[0], x: 91, y: 520, width: 348, height: 400 },
  { id: IDS[1], x: 463, y: 520, width: 348, height: 330 },
  { id: IDS[2], x: 835, y: 520, width: 348, height: 390 },
];
const layouts = [
  { width: 1440, height: 900, targets },
  { width: 390, height: 844, targets: targets.map((r, i) => ({ ...r, x: 20, y: 470 + i * 434, width: 350 })) },
  { width: 768, height: 1024, targets: targets.map((r, i) => ({ ...r, x: 24 + i * 252, y: 620, width: 228 })) },
];
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
const arraysClose = (a, b, tolerance) => {
  assert.equal(a.length, b.length);
  a.forEach((value, i) => Array.isArray(value) ? arraysClose(value, b[i], tolerance) : close(value, b[i], tolerance));
};

test('geometry uses the real first content identities and exposes no rendering lifecycle', () => {
  assert.deepEqual(IDS, ['work-context', 'thoughts-type', 'labs-spring']);
  assert.ok(Object.isFrozen(IDS));
  assert.equal(HANDOFF, 9.7);
  const source = fs.readFileSync(new URL('../../runtime/story/geometry.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /new THREE\.(WebGLRenderer|Scene|Mesh)|document\.|window\.|requestAnimationFrame/);
  assert.match(source, /\.\.\/world\/vendor\/three\/three\.module\.js/);
});

test('authored actor, camera and physical book anchors retain the cinematic coordinates', () => {
  arraysClose(actorPose(0).toArray(), [-5, .88, 1.4]);
  arraysClose(actorPose(3).toArray(), [1.16, 1.209, .9]);
  arraysClose(actorPose(HANDOFF).toArray(), [1.44, 1.209, -.2]);
  arraysClose(cameraPose(0, 1440, 900).camera.position.toArray(), [5, 4.8, 12]);
  arraysClose(cameraPose(HANDOFF, 1440, 900).camera.position.toArray(), [4.8, 7, 11.5]);
  const pose = makeWorldPose(HANDOFF, 1440, 900, targets);
  arraysClose(pose.cameraTarget.toArray(), [-.1, 1.65, -.1]);
  arraysClose(pose.hingePosition.toArray(), [-2.092, .7072, -.1]);
  close(pose.cover, 2.47);
  assert.equal(pose.shot, 'handoff');
  const x = blenderToThree([1, 0, 0]), y = blenderToThree([0, 1, 0]);
  close(x.cross(y).distanceTo(blenderToThree([0, 0, 1])), 0);
});

test('all world poses stop at HANDOFF, leaving original host home placement to the integrator', () => {
  for (const layout of layouts) {
    const at = makeWorldPose(HANDOFF, layout.width, layout.height, layout.targets);
    for (const time of [HANDOFF + .01, 11.3, END, 999]) {
      const later = makeWorldPose(time, layout.width, layout.height, layout.targets);
      assert.equal(later.time, HANDOFF);
      arraysClose(later.actor.toArray(), at.actor.toArray());
      arraysClose(later.camera.position.toArray(), at.camera.position.toArray());
      arraysClose(later.camera.quaternion.toArray(), at.camera.quaternion.toArray());
      arraysClose(later.faceQuaternion.toArray(), at.faceQuaternion.toArray());
      arraysClose(later.cameraTarget.toArray(), at.cameraTarget.toArray());
      later.papers.forEach((paper, i) => arraysClose(paper.quad, at.papers[i].quad));
      assert.equal(storyFrame(time, layout).worldTime, HANDOFF);
    }
  }
});

test('arbitrary measured rectangles preserve card aspect ratio and nominal paper limits', () => {
  const fixtureRects = [
    ...targets, { x: -32, y: 2050, w: 240, h: 610 },
    { left: 18, top: 430, width: 640, height: 80 },
  ];
  for (const input of fixtureRects) {
    const rect = normalizeTargetRect(input), size = paperDimensions(input);
    close(size.width / size.height, rect.width / rect.height);
    assert.ok(size.width <= PAPER_W + 1e-12);
    assert.ok(size.height <= PAPER_H + 1e-12);
    arraysClose(rectQuad(input), [[rect.x, rect.y], [rect.x + rect.width, rect.y],
      [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]]);
  }
  assert.deepEqual(paperDimensions(), { width: PAPER_W, height: PAPER_H });
  for (const rect of [{ width: 0, height: 40 }, { width: 80, height: -1 }, { width: NaN, height: 30 }]) {
    assert.throws(() => paperDimensions(rect), RangeError);
  }
  assert.throws(() => makeWorldPose(1, 390, 0), RangeError);
});

test('sampled world geometry is finite, rigid, continuously joined and capped at 52-degree gaze', () => {
  for (const layout of layouts) {
    for (let frame = 0; frame <= 291; frame++) {
      const pose = makeWorldPose(frame / 30, layout.width, layout.height, layout.targets);
      assert.ok(pose.rigidGazeDegrees >= 0 && pose.rigidGazeDegrees <= 52 + 1e-8);
      close(pose.faceQuaternion.length(), 1);
      assert.ok(pose.camera.projectionMatrix.elements.every(Number.isFinite));
      for (const paper of pose.papers) {
        assert.ok(paper.quad.flat().every(Number.isFinite));
        close(paper.quaternion.length(), 1);
        assert.ok(paper.ink >= 0 && paper.ink <= 1);
        assert.ok(paper.exposedFraction >= 0 && paper.exposedFraction <= 1);
      }
    }
    for (const time of [1.6, 2.7, 3, 4.45, 5.25, 7.15, HANDOFF]) {
      const before = makeWorldPose(time - 1e-5, layout.width, layout.height, layout.targets);
      const after = makeWorldPose(time + 1e-5, layout.width, layout.height, layout.targets);
      assert.ok(before.actor.distanceTo(after.actor) < .001);
      assert.ok(before.camera.position.distanceTo(after.camera.position) < .001);
      assert.ok(before.camera.quaternion.angleTo(after.camera.quaternion) < .001);
    }
  }
});

test('homography maps the same card rectangle exactly onto the physical front corners', () => {
  for (const layout of layouts) for (const time of [7.7, 8.5, HANDOFF]) {
    const pose = makeWorldPose(time, layout.width, layout.height, layout.targets);
    pose.papers.forEach((paper, index) => {
      const target = layout.targets[index], matrix = homography(target.width, target.height, paper.quad);
      arraysClose([[0, 0], [target.width, 0], [target.width, target.height], [0, target.height]]
        .map(([x, y]) => projectHomography(matrix, x, y)), paper.quad, 1e-7);
      const local = new THREE.Vector3(-paper.size.width / 2, paper.size.height / 2, PAPER_FRONT_OFFSET);
      close(local.applyMatrix4(paper.matrix).distanceTo(paper.corners[0]), 0);
    });
  }
});

test('optional native route has exact endpoints for real-card-shaped arbitrary targets', () => {
  for (const layout of layouts) {
    const start = makeWorldPose(HANDOFF, layout.width, layout.height, layout.targets);
    IDS.forEach((id, index) => {
      arraysClose(nativeRoute(HANDOFF, index, layout, start), start.papers[index].quad);
      arraysClose(nativeRoute(END, index, layout, start), rectQuad(layout.targets[index]));
    });
  }
});

test('projection remapping keeps displayed coordinates on the one host drawing surface', () => {
  for (const from of layouts) for (const to of layouts) {
    const virtual = { width: from.width, height: from.height, offsetX: 12, offsetY: -100 };
    const pose = makeWorldPose(8.4, from.width, from.height, from.targets), camera = pose.camera.clone();
    camera.projectionMatrix.copy(remapProjectionMatrix(camera.projectionMatrix, virtual, to));
    for (const point of [pose.actor, ...pose.papers.flatMap(p => p.corners)]) {
      const a = point.clone().project(pose.camera), b = point.clone().project(camera);
      close((a.x + 1) * from.width / 2 + virtual.offsetX, (b.x + 1) * to.width / 2);
      close((1 - a.y) * from.height / 2 + virtual.offsetY, (1 - b.y) * to.height / 2);
    }
  }
});

test('world resize rebase begins at displayed geometry and ends at the new aspect ratios', () => {
  const from = layouts[0], to = layouts[1], time = 8.2;
  const frame = storyFrame(time, from), rebase = createWorldRebase(time, frame, from, to);
  const start = worldRebaseFrame(time, to, rebase), end = worldRebaseFrame(time + rebase.duration, to, rebase);
  start.cards.forEach((card, i) => arraysClose(card.quad, frame.cards[i].quad));
  end.viewport.paperSizes.forEach((size, i) => {
    const target = paperDimensions(to.targets[i]);
    close(size.width, target.width);
    close(size.height, target.height);
  });
  close(end.viewport.width, to.width);
  close(end.viewport.height, to.height);
});
