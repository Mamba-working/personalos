import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {healthResponse, serviceStatus, validateContentRecord} from '../index.mjs';
import {records} from '../../../apps/web/runtime/content.js';
test('health contract and schema agree on literal identifiers', async () => {
  const schema=JSON.parse(await readFile(new URL('../schemas/health.schema.json',import.meta.url),'utf8'));
  const health=healthResponse();
  assert.deepEqual(Object.keys(health).sort(), schema.required.slice().sort());
  for(const key of schema.required)assert.equal(health[key],schema.properties[key].const);
});
test('status only claims implemented health/status endpoints', () => {
  const status=serviceStatus();
  assert.equal(status.productVersion,'0.1.0-alpha.7');
  assert.deepEqual(status.capabilities,{health:true,status:true,contentApi:false,chatApi:false,authentication:false,persistence:false});
  assert.equal(status.frontendConnected,false);
});
test('18 authored demo records meet the explicit content contract', () => {
  assert.equal(records.length,18);
  assert.equal(new Set(records.map(record=>record.id)).size,18);
  assert.ok(records.every(validateContentRecord));
  assert.equal(validateContentRecord({...records[0],secret:'rejected'}),false);
  assert.equal(validateContentRecord({...records[0],placeholder:false}),false);
  assert.equal(validateContentRecord({...records[0],category:'private'}),false);
  assert.equal(validateContentRecord(null),false);
});
