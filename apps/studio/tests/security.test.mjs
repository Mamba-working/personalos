import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isAdminEnabled,isLoopbackHost,isSameOriginMutation,safeExternalUrl} from '../src/lib/security.mjs';

test('admin studio fails closed without explicit local-demo opt-in',()=>{
  assert.equal(isAdminEnabled('127.0.0.1:3002',{}),false);
  assert.equal(isAdminEnabled('example.com',{CONTENT_STUDIO_ADMIN_ENABLED:'true'}),false);
  assert.equal(isAdminEnabled('127.0.0.1:3002',{CONTENT_STUDIO_ADMIN_ENABLED:'true'}),true);
  assert.equal(isAdminEnabled('localhost:3002',{CONTENT_STUDIO_ADMIN_ENABLED:'true'}),true);
});
test('loopback host parser rejects suffixes, credentials, whitespace and malformed IPv6',()=>{
  for(const host of ['localhost.attacker.example','127.0.0.1.attacker.test','localhost@attacker.test','localhost/','localhost\\evil',' localhost','[::1].test','http://localhost','example.com'])assert.equal(isLoopbackHost(host),false,host);
  for(const host of ['localhost','localhost:3002','127.0.0.1:3002','[::1]:3002'])assert.equal(isLoopbackHost(host),true,host);
});
test('mutations require same-origin browser request',()=>{
  assert.equal(isSameOriginMutation(null,'127.0.0.1:3002'),false);
  assert.equal(isSameOriginMutation('https://attacker.test','127.0.0.1:3002'),false);
  assert.equal(isSameOriginMutation('http://127.0.0.1:9999','127.0.0.1:3002'),false);
  assert.equal(isSameOriginMutation('http://127.0.0.1:3002','127.0.0.1:3002'),true);
});
test('external citation links allow only credential-free HTTP(S)',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,test','file:///etc/passwd','https://'+'user'+':'+'password'+'@example.com','not a url'])assert.equal(safeExternalUrl(url),null);
  assert.equal(safeExternalUrl('https://example.com/docs'),'https://example.com/docs');
});
test('studio commands bind loopback and client files do not contain auth credentials',()=>{
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));
  assert.match(pkg.scripts.dev,/--hostname 127\.0\.0\.1/);
  assert.match(pkg.scripts.start,/--hostname 127\.0\.0\.1/);
  for(const file of ['Studio.tsx','ArticleRenderer.tsx']){
    const source=readFileSync(new URL(`../src/components/${file}`,import.meta.url),'utf8');
    assert.doesNotMatch(source,/personalos-local-review|personalos-local-demo|CONTENT_API_TOKEN|dangerouslySetInnerHTML|\beval\(/);
  }
});
test('actual pinned OpenIntelligentUI sandbox runtime replaces the experimental catalog renderer',()=>{
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));
  assert.equal(pkg.dependencies['@jetbrains/websandbox'],'1.2.1');
  assert.equal(pkg.dependencies['@json-render/react'],undefined);
  const renderer=readFileSync(new URL('../src/components/openintelligentui/OpenIntelligentArtifact.tsx',import.meta.url),'utf8');
  assert.match(renderer,/Websandbox\.create\(localApi/);
  assert.match(renderer,/await sandbox\.run\(content\.jsFunctions\)/);
  assert.match(renderer,/validHostRpcMessage/);
  assert.doesNotMatch(renderer,/\beval\(/);
  const wrapper=readFileSync(new URL('../src/components/ArticleRenderer.tsx',import.meta.url),'utf8');
  assert.match(wrapper,/validateCompletedArtifact/);
  assert.match(wrapper,/RENDERER_DESCRIPTOR/);
});

test('vendored upstream copies retain their pinned source hashes and license',async()=>{
  const {createHash}=await import('node:crypto');
  const root=new URL('../src/vendor/openintelligentui/',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('UPSTREAM.json',root)));
  assert.equal(manifest.repository,'https://github.com/CopilotKit/OpenIntelligentUI');
  assert.equal(manifest.commit,'8391a94c1c3939c679e40ddd7bfc08a9ef690e70');
  for(const file of manifest.files)assert.equal(createHash('sha256').update(readFileSync(new URL(file.localFile,root))).digest('hex'),file.sha256,file.localFile);
  assert.match(readFileSync(new URL('LICENSE',root),'utf8'),/Copyright \(c\) Atai Barkai/);
});
