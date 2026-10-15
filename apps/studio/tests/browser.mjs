/** Full local-only UI acceptance. Requires a running API + enabled loopback Studio. Mutates synthetic demo records. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.STUDIO_TEST_URL||'http://127.0.0.1:3002';
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(base).hostname))throw new Error('Browser demo tests may only mutate a loopback environment');
const evidence=new URL('../test-results/native/',import.meta.url);
await mkdir(evidence,{recursive:true});
let executablePath=process.env.CHROMIUM_PATH||'/usr/bin/chromium';
let browserArgs=['--no-sandbox','--disable-dev-shm-usage'];
// Optional serverless headless shell for environments without full-Chrome Unix sockets.
if(process.env.CHROMIUM_RUNTIME_MODULE){const runtime=(await import(process.env.CHROMIUM_RUNTIME_MODULE)).default;executablePath=await runtime.executablePath();browserArgs=runtime.args.filter(flag=>!['--disable-web-security','--allow-running-insecure-content'].includes(flag));}
const browser=await chromium.launch({executablePath,headless:true,args:browserArgs});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[];const requests=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>requests.push({url:request.url(),method:request.method()}));
const results=[];
async function check(name,run){await run();results.push({name,passed:true});console.log(`PASS ${name}`);}
async function screenshot(name,fullPage=true){await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(80);await page.screenshot({path:new URL(name,evidence).pathname,fullPage});}
try{
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByText('内容 API 已连接',{exact:true}).waitFor({timeout:20000});
  await check('actual API capture/group journey',async()=>{
    const before=await page.locator('.source-card').count();
    await page.getByRole('checkbox',{name:'我确认这是合成演示材料，不含真实个人信息'}).check();
    await page.getByRole('button',{name:'保存片段',exact:false}).click();
    await page.getByText('片段已保存，来源版本与内容指纹可追溯。').waitFor();
    assert.equal(await page.locator('.source-card').count(),before+1);
    await page.getByRole('button',{name:'载入合成样例'}).click();
    await page.getByText('已通过真实 API 保存合成演示片段。下一步，把素材归入主题。').waitFor();
    assert.ok(await page.locator('.source-card').count()>=4);
    await page.getByRole('button',{name:'归入主题',exact:false}).click();
    await page.locator('.topic-card').first().waitFor();
    assert.ok(await page.locator('.topic-card').count()>=3);
    await screenshot('01-capture-desktop.png');
    assert.ok(await page.locator('.skip-link').evaluate(el=>el.getBoundingClientRect().bottom<0),'skip link is hidden unless keyboard focused');
    const outlines=await page.locator('button,a,input,select,textarea,summary').evaluateAll(els=>els.filter(el=>getComputedStyle(el).outlineStyle!=='none').length);
    assert.ok(outlines<=1,'focus ring must not be applied to every interactive element');
  });
  await check('asynchronous generation validates and renders real spec',async()=>{
    const concurrencyTopic=page.locator('.topic-card').filter({hasText:'并发'}).first();
    await concurrencyTopic.click();
    await page.getByRole('button',{name:'生成交互文章',exact:false}).click();
    await page.locator('.document-preview .openintelligent-artifact[data-ready="true"]').waitFor({timeout:30000});
    await page.locator('.message-banner.success').filter({hasText:/生成完成|输入未变/}).waitFor();
    assert.ok(await page.frameLocator('.document-preview iframe').locator('.lab').count()>0);
    assert.ok(await page.getByText('结构有效',{exact:true}).count()>0);
    await screenshot('02-generation-desktop.png');
    await page.frameLocator('.document-preview iframe').locator('.lab').screenshot({path:new URL('07-interactive-explainer.png',evidence).pathname});
    await page.getByRole('tab',{name:'内容规范'}).click();
    assert.match(await page.getByLabel('只读文章 JSON 规范').textContent(),/copilotkit-openintelligentui/);
    await page.getByRole('tab',{name:'文章预览'}).click();
  });
  await check('linked slider, deterministic metrics, plot and step controls issue zero requests',async()=>{
    await page.waitForTimeout(350);
    const range=page.frameLocator('.document-preview iframe').getByRole('slider',{name:'并发数'});
    await range.focus();await page.keyboard.press('Home');
    await page.waitForTimeout(100);
    const start=await page.frameLocator('.document-preview iframe').getByTestId('parallel-ms').textContent();
    const count=requests.length;
    await page.keyboard.press('End');
    await page.waitForTimeout(120);
    const end=await page.frameLocator('.document-preview iframe').getByTestId('parallel-ms').textContent();
    assert.notEqual(start,end);
    assert.equal(await page.frameLocator('.document-preview iframe').locator('#concurrency-value').textContent(),'12');
    await page.frameLocator('.document-preview iframe').getByRole('button',{name:'并行批次',exact:true}).click();
    assert.equal(await page.frameLocator('.document-preview iframe').locator('[data-phase=parallel]').getAttribute('aria-pressed'),'true');
    await page.frameLocator('.document-preview iframe').getByRole('button',{name:'调度开销',exact:true}).click();
    assert.equal(await page.frameLocator('.document-preview iframe').locator('[data-phase=overhead]').getAttribute('aria-pressed'),'true');
    assert.equal(requests.length,count,'reader interactions must remain local, with no AI/backend calls');
    assert.ok(await page.frameLocator('.document-preview iframe').getByTestId('latency-selected').isVisible());
  });
  let publicUrl;let publishedRevisionId;
  await check('human exact-revision approval gates publication',async()=>{
    await page.getByRole('button',{name:'检查修订版并审核',exact:false}).click();
    const approve=page.getByRole('button',{name:'批准此修订版',exact:false});
    const publish=page.getByRole('button',{name:'发布到演示阅读器',exact:false});
    assert.ok(await approve.isDisabled());assert.ok(await publish.isDisabled());
    await page.getByRole('checkbox',{name:/我已阅读并测试此准确修订版/}).check();
    await approve.click();
    await page.getByText('已批准此修订版',{exact:false}).first().waitFor();
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent.includes('发布到演示阅读器')&&!button.disabled));
    assert.ok(await publish.isEnabled());
    await screenshot('03-review-desktop.png');
    await page.locator('.inspector-panel').first().screenshot({path:new URL('08-review-inspector.png',evidence).pathname});
    await publish.click();
    const publicLink=page.getByRole('link',{name:'打开已发布文章 ↗'});
    await publicLink.waitFor();
    publicUrl=new URL(await publicLink.getAttribute('href'),base).href;
    const state=await (await page.request.get(`${base}/api/demo/snapshot`)).json();
    publishedRevisionId=state.articles.find(article=>article.slug==='concurrency-budget').publication.revisionId;
  });
  await check('public reader contains approved DTO only and runs on mobile',async()=>{
    const read=await context.newPage();
    const readerErrors=[];read.on('pageerror',error=>readerErrors.push(error.message));
    await read.goto(publicUrl,{waitUntil:'networkidle'});
    await read.locator('.openintelligent-artifact[data-ready="true"]').waitFor();
    const html=await read.content();
    assert.doesNotMatch(html,/personalos-local-demo|personalos-local-review|"sourceRefs"|"provenance"|"reviewIntent"/);
    assert.equal(await read.locator('.studio-sidebar').count(),0);
    await read.screenshot({path:new URL('04-reader-desktop.png',evidence).pathname,fullPage:true});
    await read.setViewportSize({width:390,height:844});
    await read.screenshot({path:new URL('05-reader-mobile.png',evidence).pathname,fullPage:true});
    assert.ok(await read.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'mobile public reader must not overflow horizontally');
    const range=read.frameLocator('iframe').getByRole('slider',{name:'并发数'});await range.focus();await read.keyboard.press('Home');
    assert.equal(await read.frameLocator('iframe').locator('#concurrency-value').textContent(),'1');
    assert.deepEqual(readerErrors,[]);
    await read.close();
  });
  await check('new revision invalidates previous approval and retains old public revision',async()=>{
    await page.getByText('编辑并创建新修订',{exact:true}).click();
    const title=page.getByLabel('修订标题',{exact:true});
    await title.fill((await title.inputValue()).slice(0,130)+' · 审核演示修订');
    await page.getByRole('button',{name:'保存为新修订',exact:false}).click();
    await page.getByText('新修订已保存。此前的批准不适用于这一版，公开阅读器仍保留原先发布的版本。').waitFor();
    await page.getByText('新修订已使先前批准失效。请重新阅读并批准当前版本。').waitFor();
    assert.ok(await page.getByRole('button',{name:'发布到演示阅读器',exact:false}).isDisabled());
    const response=await page.request.get(publicUrl);assert.equal(response.status(),200);
    assert.ok((await response.text()).includes(publishedRevisionId),'public SSR must retain the approved historical revision');
    await page.setViewportSize({width:390,height:844});
    await screenshot('06-studio-mobile.png');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'mobile studio must not overflow horizontally');
  });
  await check('chat generates the same native artifact, saves an exact draft and follows up as a new revision',async()=>{
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(`${base}/chat`,{waitUntil:'networkidle'});
    await page.getByRole('textbox',{name:'对话问题'}).fill('我有一个随机的研究主题，希望看到一个可交互的解释。请明确标注演示假设。');
    await page.getByRole('button',{name:'发送演示问题',exact:false}).click();
    await page.locator('.conversation-artifact [data-ready="true"]').first().waitFor({timeout:30000});
    assert.equal(await page.locator('.conversation-artifact').count(),1);
    await screenshot('09-chat-desktop.png');
    await page.getByRole('button',{name:'存为审核稿',exact:false}).click();
    await page.getByText('这一准确交互产物已存为私人审核稿。尚未批准或发布。').waitFor();
    const id=new URL(page.url()).searchParams.get('conversation');assert.ok(id);
    let current=await (await page.request.get(`${base}/api/demo/conversations/${id}`)).json();
    const first=current.artifacts[0];assert.equal(first.savedToDraft,true);
    let article=await (await page.request.get(`${base}/api/demo/articles/${first.articleId}`)).json();assert.equal(article.approval,null);assert.equal(article.publication,null);
    const frame=page.frameLocator('.conversation-artifact iframe');
    await frame.getByRole('slider',{name:'并发数'}).focus();await page.keyboard.press('End');
    const before=requests.length;await frame.getByRole('button',{name:'就当前参数追问'}).click();
    await page.getByText('这段交互内容提出了一个后续问题',{exact:true}).waitFor();await page.waitForTimeout(100);
    assert.equal(requests.length,before,'untrusted followup proposal must not submit automatically');
    await page.getByRole('button',{name:'确认发送这个问题 →'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('.conversation-artifact[data-unused], .conversation-artifact .openintelligent-artifact[data-ready="true"]').length===2,undefined,{timeout:30000});
    current=await (await page.request.get(`${base}/api/demo/conversations/${id}`)).json();assert.equal(current.artifacts.length,2);assert.notEqual(current.artifacts[0].revisionId,current.artifacts[1].revisionId);assert.equal(current.artifacts[0].articleId,current.artifacts[1].articleId);
    assert.ok(current.messages.some(message=>message.role==='user'&&message.content.includes('并发数为 12')));
    assert.equal(await page.locator('.conversation-artifact').first().frameLocator('iframe').locator('#concurrency-value').textContent(),'12');
    assert.equal(await page.locator('.conversation-artifact').last().frameLocator('iframe').locator('#concurrency-value').textContent(),'4');
    // Offscreen iframes can be omitted by headless full-page compositing. Capture the
    // actual visible follow-up, rather than presenting a blank compositor surface.
    await page.locator('.conversation-artifact').last().locator('.conversation-artifact-toolbar').scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await page.screenshot({path:new URL('10-chat-followup-desktop.png',evidence).pathname});
    await page.locator('.conversation-artifact').last().frameLocator('iframe').locator('.lab').screenshot({path:new URL('12-chat-followup-lab-desktop.png',evidence).pathname});
    await page.reload({waitUntil:'networkidle'});await page.locator('.conversation-artifact[data-unused], .conversation-artifact .openintelligent-artifact[data-ready="true"]').nth(1).waitFor({timeout:30000});
    assert.equal(await page.locator('.conversation-artifact').count(),2);
    await page.setViewportSize({width:390,height:844});
    await page.locator('.conversation-artifact').last().frameLocator('iframe').locator('.lab').scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await page.screenshot({path:new URL('11-chat-mobile.png',evidence).pathname});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewportSize({width:1440,height:1000});
  });
  await check('MCP review deep link opens the exact article in review stage',async()=>{
    const snapshot=await (await page.request.get(`${base}/api/demo/snapshot`)).json();
    const article=snapshot.articles.find(item=>item.slug==='concurrency-budget');assert.ok(article);
    const review=await context.newPage();
    await review.goto(`${base}/?article=${encodeURIComponent(article.id)}`,{waitUntil:'networkidle'});
    await review.getByRole('heading',{name:'先读懂，再把它交给读者。'}).waitFor();
    assert.equal(await review.getByLabel('已生成文章',{exact:true}).inputValue(),article.id);
    assert.match(await review.frameLocator('.document-preview iframe').locator('h1').textContent(),/审核演示修订/);
    await review.close();
  });
  if(process.env.STUDIO_PUBLIC_TEST_URL)await check('default-disabled public server exposes no administrative UI or proxy',async()=>{
    const publicBase=process.env.STUDIO_PUBLIC_TEST_URL;
    assert.ok(['127.0.0.1','localhost','[::1]'].includes(new URL(publicBase).hostname));
    const publicPage=await context.newPage();
    await publicPage.goto(publicBase,{waitUntil:'networkidle'});
    assert.equal(await publicPage.locator('.studio-sidebar').count(),0);
    assert.ok(await publicPage.locator('.library-article').count()>=1);
    assert.equal((await publicPage.request.get(`${publicBase}/api/demo/snapshot`)).status(),403);
    await publicPage.close();
  });
  await check('proxy rejects missing-origin writes and spoofed external Host',async()=>{
    const missing=await page.request.post(`${base}/api/demo/group`,{data:{idempotencyKey:`browser-no-origin-${Date.now()}`}});
    assert.equal(missing.status(),403);
    const external=await page.request.get(`${base}/api/demo/snapshot`,{headers:{Host:'attacker.example'}});
    assert.equal(external.status(),403);
  });
  assert.deepEqual(errors,[],'browser runtime must not report uncaught errors');
  await writeFile(new URL('browser-results.json',evidence),JSON.stringify({base,results,errors,requestCount:requests.length,screenshots:['01-capture-desktop.png','02-generation-desktop.png','03-review-desktop.png','04-reader-desktop.png','05-reader-mobile.png','06-studio-mobile.png','07-interactive-explainer.png','08-review-inspector.png','09-chat-desktop.png','10-chat-followup-desktop.png','11-chat-mobile.png','12-chat-followup-lab-desktop.png']},null,2));
  console.log(`All ${results.length} browser journeys passed; ${requests.length} local requests; ${errors.length} runtime errors.`);
}catch(error){await screenshot('failure.png');await writeFile(new URL('browser-failure.json',evidence),JSON.stringify({message:error.message,results,errors,requests},null,2));throw error;}
finally{await browser.close();}
