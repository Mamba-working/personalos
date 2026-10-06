/** Frozen alpha.2 source regression controls, not real layout or screenshots. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {JSDOM} from 'jsdom';
const root=new URL('./fixtures/alpha2-compact-feed/',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const app=read('app.js'),css=read('style.css');
const records=new Function(read('content.js').replace(/\bexport /g,'')+';return records;')();
const oldColumns=new Function('innerWidth',app.match(/^function columnCount\(\).*$/m)[0]+';return columnCount();');

test('frozen alpha.2 feed source remains verifiable independently of changing candidate',()=>{
 const manifest=JSON.parse(read('manifest.json'));
 for(const [name,expected] of Object.entries(manifest.sha256))assert.equal(crypto.createHash('sha256').update(read(name)).digest('hex'),expected,name);
});

test('negative alpha.2 control: normal phone widths force a single 330–450px feed column and 26px title',()=>{
 for(const width of [320,360,390,430,650])assert.equal(oldColumns(width),1);
 assert.equal(oldColumns(768),2);assert.equal(oldColumns(1180),3);
 assert.equal(Math.min(...records.map(r=>r.height)),330);assert.equal(Math.max(...records.map(r=>r.height)),450);
 assert.match(css,/@media\(max-width:650px\)[^\n]*\.feed\{gap:0\}/);
 assert.match(css,/@media\(max-width:650px\)[^\n]*\.card h2\{font-size:26px\}/);
});

test('negative alpha.2 control: actual arrange leaves filtered tablet Work at 5/1 and Labs at 1/5',()=>{
 const dom=new JSDOM('<div id="feed"></div>'),d=dom.window.document,feed=d.querySelector('#feed');
 const entries=new Map(records.map(record=>[record.id,{record:{...record},slot:d.createElement('div'),article:d.createElement('article'),identity:d.createElement('div')}]));
 const arrange=app.match(/^function arrange\(\).*$/m)[0];
 new Function('document','records','entries','feed','columnCount','fitCards','indicator','active',arrange+';arrange();')(d,records,entries,feed,()=>2,()=>{},()=>{},null);
 // This is the unchanged behavior of applyFilter: excluded slots remain in their original column.
 const distribution=category=>[...feed.children].map(column=>[...column.children].filter(slot=>entries.get(records.find(r=>entries.get(r.id).slot===slot).id).record.category===category).length);
 assert.deepEqual(distribution('work'),[5,1]);assert.deepEqual(distribution('labs'),[1,5]);
 assert.doesNotMatch(app.match(/^function applyFilter\(.*$/m)[0],/arrange\(/);
 dom.window.close();
});
