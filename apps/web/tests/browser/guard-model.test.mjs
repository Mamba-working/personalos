import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {requireFeedColumns,requireMenuContained} from './guard-model.mjs';
import {inspectPng} from './png-check.mjs';
import {requireRenderedPixels} from './canvas-proof.mjs';
test('real geometric columns are required, state labels alone cannot pass',()=>{
  assert.doesNotThrow(()=>requireFeedColumns({columnBoxes:[{x:0,w:160},{x:172,w:160}]},2));
  assert.throws(()=>requireFeedColumns({columnBoxes:[{x:0,w:332}]},2),/FEED_COLUMNS/);
  assert.throws(()=>requireFeedColumns({columnBoxes:[{x:0,w:160},{x:0,w:160}]},2),/geometric track/);
  assert.throws(()=>requireFeedColumns({columnBoxes:[{x:0,w:160},{x:0,w:160},{x:172,w:160}]},3),/geometric track/);
});
test('intermediate menu overflow is a failure even if endpoints fit',()=>{
  const row=overflow=>({menu:{open:true,scrollWidth:overflow?400:300,clientWidth:300},document:{scrollWidth:390,clientWidth:390}});
  assert.doesNotThrow(()=>requireMenuContained([row(false)]));
  assert.throws(()=>requireMenuContained([row(false),row(true),row(false)]),/MENU_OVERFLOW/);
  assert.throws(()=>requireMenuContained([]),/no open\/intermediate/);
});
function flatPng(alpha){
  const chunk=(name,bytes)=>{const b=Buffer.alloc(bytes.length+12);b.writeUInt32BE(bytes.length);b.write(name,4);bytes.copy(b,8);return b;};
  const header=Buffer.alloc(13);header.writeUInt32BE(4);header.writeUInt32BE(4,4);header[8]=8;header[9]=6;
  const raw=Buffer.alloc(4*(4*4+1));for(let y=0;y<4;y++)for(let x=0;x<4;x++)raw[y*17+1+x*4+3]=alpha;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
test('transparent or solid canvas cannot satisfy the render pixel criterion',()=>{
  assert.equal(inspectPng(flatPng(0)).visibleFraction,0);
  assert.equal(inspectPng(flatPng(255)).quantizedColors,1);
  assert.throws(()=>requireRenderedPixels(inspectPng(flatPng(0))),/RENDER_PIXELS/);
  assert.throws(()=>requireRenderedPixels(inspectPng(flatPng(255))),/RENDER_PIXELS/);
});
