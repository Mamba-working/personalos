import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { JSDOM } from 'jsdom';
import { records } from '../../lib/server/demo-content';
const require=createRequire(import.meta.url);
test('real production HTTP delivers dynamic SSR, deep-link metadata, 18 articles, and protected source boundaries',async()=>{
  const port=4197,base=`http://127.0.0.1:${port}`,logs:string[]=[];
  const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',chunk=>logs.push(String(chunk)));child.stderr.on('data',chunk=>logs.push(String(chunk)));
  const start=Date.now();let ready=false;
  try{
    while(Date.now()-start<15000){if(child.exitCode!==null)throw new Error(logs.join(''));try{const response=await fetch(base);if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
    assert.equal(ready,true,logs.join(''));
    const measurements=[];
    mkdirSync('tests/next/evidence',{recursive:true});
    for(const path of ['/', '/?space=thoughts&item=thoughts-long', '/?space=work&item=thoughts-long&chat=open']){
      const started=performance.now(),response=await fetch(base+path),html=await response.text(),elapsedMs=performance.now()-started,dom=new JSDOM(html),doc=dom.window.document;
      writeFileSync(`tests/next/evidence/response-${measurements.length}.html`,html);
      assert.equal(response.status,200);assert.match(response.headers.get('cache-control')??'',/no-store|no-cache|private/);
      assert.equal(doc.querySelectorAll('article.card').length,18);assert.equal(doc.querySelectorAll('#native-content-island').length,1);
      const ids=[...doc.querySelectorAll('[id]')].map(node=>node.id);assert.equal(new Set(ids).size,ids.length);
      for(const record of records)assert.equal(doc.getElementById(`title-${record.id}`)?.textContent,record.title);
      assert.equal(doc.querySelector('#content-root')?.hasAttribute('inert'),false);
      // Fetch the actual production CSS. HTML presence alone is not readable SSR evidence.
      const cssAssets=await Promise.all([...doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(async link=>{
        const result=await fetch(new URL(link.getAttribute('href')!,base));assert.equal(result.status,200);return result.text();
      }));
      assert.ok(cssAssets.length>0,'The production response must actually load stylesheets');
      const stylesheet=doc.createElement('style');stylesheet.textContent=cssAssets.join('\n');doc.head.append(stylesheet);
      const styleChecks=[];
      for(const body of doc.querySelectorAll<HTMLElement>('article.card .detail-body')){
        const article=body.closest('article')!,bodyStyle=dom.window.getComputedStyle(body);
        assert.ok(body.textContent!.length>600,'Actual authored body text must be present');
        assert.equal(bodyStyle.display,'block',article.getAttribute('data-content-id')!);
        assert.equal(bodyStyle.position,'static','No-JS body participates in native document flow');
        for(let ancestor:Element|null=body;ancestor;ancestor=ancestor.parentElement){
          const computed=dom.window.getComputedStyle(ancestor);
          assert.notEqual(computed.display,'none',`${article.getAttribute('data-content-id')} hidden by ${ancestor.id||ancestor.className}`);
          assert.notEqual(computed.visibility,'hidden');assert.notEqual(computed.visibility,'collapse');
          assert.notEqual(computed.opacity,'0');assert.equal(ancestor.hasAttribute('hidden'),false);assert.equal(ancestor.hasAttribute('inert'),false);
          assert.doesNotMatch(computed.clipPath,/100%/,'No ancestor may fully clip the no-JS article');
        }
        const style=dom.window.getComputedStyle(article);assert.equal(style.height,'auto');assert.equal(style.overflow,'visible');
        styleChecks.push({id:article.getAttribute('data-content-id'),bodyDisplay:bodyStyle.display,bodyPosition:bodyStyle.position,articleHeight:style.height,articleOverflow:style.overflow});
      }
      assert.equal(styleChecks.length,18);
      if(path==='/'){
        const link=doc.querySelector<HTMLAnchorElement>('article[data-content-id="thoughts-long"] .open-card')!;
        const opened=await fetch(new URL(link.getAttribute('href')!,base));assert.equal(opened.status,200);
        const openedDOM=new JSDOM(await opened.text()),openedDoc=openedDOM.window.document;
        assert.equal(openedDoc.querySelector('#canvas article')?.getAttribute('data-content-id'),'thoughts-long');
        const closed=await fetch(new URL(openedDoc.querySelector('#close')!.getAttribute('href')!,base));assert.equal(closed.status,200);
        const closedDOM=new JSDOM(await closed.text());assert.equal(closedDOM.window.document.querySelector('#stage')?.hasAttribute('hidden'),true);
        assert.equal(closedDOM.window.document.querySelectorAll('article.card').length,18);openedDOM.window.close();closedDOM.window.close();
      }
      writeFileSync(`tests/next/evidence/no-js-css-${measurements.length}.json`,JSON.stringify({scope:'Production CSS computed by JSDOM with scripts disabled; no browser layout/paint or geometry acceptance',styleChecks},null,2)+'\n');
      if(path.includes('item=')){assert.match(doc.title,/长中文/);assert.equal(doc.querySelector('#canvas article')?.getAttribute('data-content-id'),'thoughts-long');assert.ok(doc.querySelector('#canvas .detail-body')!.textContent!.includes('让文字保留自己的节奏'));assert.doesNotMatch(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')??'',/chat/);}
      const scripts=[...doc.querySelectorAll<HTMLScriptElement>('script[src]')].map(node=>node.src);
      const assets=await Promise.all(scripts.map(async src=>{const res=await fetch(new URL(src,base)),buffer=Buffer.from(await res.arrayBuffer());assert.equal(res.status,200);return{src,rawBytes:buffer.length,gzipBytes:gzipSync(buffer).length};}));
      measurements.push({path,status:response.status,elapsedMs,htmlBytes:Buffer.byteLength(html),htmlGzipBytes:gzipSync(html).length,ssrArticleCount:18,initialScriptRawBytes:assets.reduce((sum,item)=>sum+item.rawBytes,0),initialScriptGzipBytes:assets.reduce((sum,item)=>sum+item.gzipBytes,0),assets});dom.window.close();
    }
    for(const path of ['/runtime/app.js','/package.json','/.env','/api/v1/status','/provenance/runtime-files.json','/..%2F..%2Fpackage.json'])assert.equal((await fetch(base+path)).status,404,path);
    assert.equal((await fetch(base,{method:'HEAD'})).status,200);
    assert.equal((await fetch(base,{method:'PUT'})).status,405);
    const chunkRoot=join(process.cwd(),'.next/static/chunks');const chunks=readdirSync(chunkRoot).filter(name=>name.endsWith('.js')).map(name=>({name,bytes:statSync(join(chunkRoot,name)).size,gzipBytes:gzipSync(readFileSync(join(chunkRoot,name))).length}));
    mkdirSync('tests/next/evidence',{recursive:true});writeFileSync('tests/next/evidence/http-measurements.json',JSON.stringify({scope:'Node production HTTP. Synthetic local timing, not browser performance. Deferred chunks are listed separately.',measurements,chunks},null,2)+'\n');
  }finally{child.kill('SIGTERM');await new Promise<void>(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',()=>resolve());});}
});
