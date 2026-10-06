import test from 'node:test';
import assert from 'node:assert/strict';
import {bootChatWorld} from './chat-world-fixture.mjs';
test('actual chat controller opens and closes on actual world subscriber clock without replacing actor, content or input (CPU/JSDOM)',async()=>{
 const f=await bootChatWorld();try{
  const input=f.$('#question'),actor=f.cpu.actor,articles=[...f.d.querySelectorAll('article.card')];
  input.value='保留草稿';f.chat.show({history:false});assert.equal(f.chat.getState().phase,'opening');const open=f.settleChat();assert.equal(open.phase,'open');
  assert.equal(f.$('#question'),input);assert.equal(f.cpu.actor,actor);assert.equal(f.$('#ai-canvas').hidden,false);
  f.chat.close({history:false});assert.equal(f.chat.getState().phase,'closing');assert.equal(f.settleChat().phase,'closed');assert.equal(f.$('#ai-canvas').hidden,true);assert.equal(input.value,'保留草稿');assert.equal(f.$('#question'),input);assert.deepEqual([...f.d.querySelectorAll('article.card')],articles);assert.equal(f.cpu.actor,actor);assert.equal(f.d.querySelectorAll('#world-stage canvas').length,1);
 }finally{f.destroy();}
});
test('actual mounted mobile chat restores deep content underlay and original reader/input on world clock (synthetic viewport)',async()=>{
 const f=await bootChatWorld({width:390});try{
  f.w.contentStudy.open('work-context',{push:false});f.settle();f.d.scrollingElement.scrollTop=820;f.$('#reader').scrollTop=170;
  const article=f.$('[data-content-id="work-context"]'),input=f.$('#question'),actor=f.cpu.actor;input.value='继续保留草稿';
  f.chat.show({history:false});assert.equal(f.settleChat().phase,'open');assert.equal(f.chat.getState().mobileFlow,'flow');assert.equal(f.chat.isPageLocked(),true);
  f.chat.close({history:false});assert.equal(f.chat.getState().closingBackground,true);assert.equal(f.chat.getState().mobileFlow,'closing');assert.equal(f.$('.mobile-chat-background').hidden,false);
  assert.equal(f.settleChat().phase,'closed');assert.equal(f.chat.isPageLocked(),false);assert.equal(f.d.scrollingElement.scrollTop,820);assert.equal(f.$('#reader').scrollTop,170);assert.equal(f.$('#canvas').firstElementChild,article);assert.equal(f.$('#question'),input);assert.equal(input.value,'继续保留草稿');assert.equal(f.cpu.actor,actor);assert.equal(f.$('.mobile-chat-background').children.length,0);
 }finally{f.destroy();}
});
