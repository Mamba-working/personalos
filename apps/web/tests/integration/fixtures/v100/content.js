// All records are authored demonstration fixtures, not claims about the owner's life.
const topics=[
['work','Interfaces that carry context','界面变化之后，内容仍在原来的关系里。','系统设计 / 示例',400,'context'],
['thoughts','当内容成为界面','每一段内容，都可以拥有适合它的表达方式。','阅读札记 / 示例',330,'type'],
['labs','A small spring laboratory','改变阻尼，观察系统如何回到平衡。','可交互实验 / 示例',390,'spring'],
['work','A map, three views','同一份数据，分别看全貌、细节和关联。','信息架构 / 示例',360,'map'],
['labs','Signals, in sequence','一条曲线，也可以解释连续性。','数据视图 / 示例',340,'signal'],
['thoughts','留住阅读的位置','返回，不应该意味着重新寻找。','界面笔记 / 示例',390,'reading'],
['thoughts','未完成也有形状','一张卡片可以是想法的入口，而非最后的结论。','开放问题 / 示例',330,'notes'],
['work','A field guide to structure','从最小片段开始，把复杂内容整理成可读的层次。','公开练习 / 示例',430,'structure'],
['labs','The rhythm of a grid','用稳定间距和有限尺寸，容纳不一样的内容。','版式实验 / 示例',370,'grid'],
['work','A quieter dashboard','把正在发生的事，放在能一眼看见的位置。','仪表盘 / 示例',360,'dashboard'],
['thoughts','长中文：信息在变化时，阅读的连续性应该由谁来负责？','当一句话跨越很多行时，变化的外壳仍然需要尊重文字自己的节奏。','长文本 / 示例',450,'long'],
['labs','Late arrivals','图片稍晚到达，位置先为它留好。','加载实验 / 示例',390,'late'],
['labs','The shape of feedback','操作被听见之后，界面应该清楚回应。','反馈实验 / 示例',350,'feedback'],
['thoughts','Small details, lasting trust','熟悉的事按照熟悉的方式发生。','设计札记 / 示例',330,'trust'],
['work','Readable states','开始、进行中、完成，都有各自的表达。','状态设计 / 示例',400,'states'],
['thoughts','从预览到深入','先看一眼，再展开细节，最后回到刚才读到的地方。','阅读路径 / 示例',390,'depth'],
['labs','Boundaries in motion','边界可以变化，内部的文字不用跟着忙碌。','裁切实验 / 示例',350,'bounds'],
['work','One identity, many frames','外框改变尺寸，同一个内容保持它的身份。','原型研究 / 示例',420,'identity']
];
export const records=topics.map(([category,title,summary,meta,height,kind],i)=>({id:`${category}-${kind}`,category,title,summary,meta,height,kind,index:String(i+1).padStart(2,'0'),placeholder:true}));
export function graphic(kind){
 if(kind==='type'||kind==='notes'||kind==='long')return `<div style="padding:18px 20px;color:var(--tone);font:46px/1.15 Georgia,serif;letter-spacing:-2px">Aa<span style="font:22px sans-serif;letter-spacing:0;padding-left:22px">字</span><div style="margin-top:8px;font:10px ui-monospace,monospace;letter-spacing:2px;color:var(--muted)">CONTENT → CONTEXT</div></div>`;
 const path=Array.from({length:46},(_,i)=>`${i?'L':'M'}${(i*6.65).toFixed(2)},${(58+Math.sin(i*.31)*Math.exp(-i/55)*31).toFixed(2)}`).join(' ');
 return `<svg class="signal" viewBox="0 0 300 128" preserveAspectRatio="none" aria-label="示例波形图" role="img"><path d="M0 32H300M0 64H300M0 96H300M60 0V128M120 0V128M180 0V128M240 0V128" stroke="currentColor" opacity=".08" fill="none"/><path d="${path}" stroke="var(--tone)" stroke-width="2" fill="none"/><circle cx="149" cy="${(58+Math.sin(22*.31)*Math.exp(-22/55)*31).toFixed(2)}" r="4" fill="var(--tone)"/></svg><span class="visual-label">${kind.toUpperCase()} / EXAMPLE DATA</span>`;
}
export function detail(record){
 const chinese='这是一段用于验证阅读连续性的中文示例。打开卡片后，外框从预览逐渐扩展到阅读空间，内部的文字在固定宽度中排版。读者可以继续往下看，选择文字，或返回刚才的位置。内容长度、迟到的图片以及窗口尺寸的变化，都不应该破坏这段关系。';
 return `<div class="detail-kicker">${record.category.toUpperCase()} / PLACEHOLDER</div><h3>${record.kind==='spring'?'What brings a system back?':record.kind==='long'?'让文字保留自己的节奏。':'A closer look.'}</h3><p>${record.summary} 这是一份演示片段，用来探索内容、布局与交互之间的关系。</p><h4>从一个稳定的片段开始</h4><p>${chinese}</p>${record.kind==='spring'?'<div class="spring-demo"><div class="readout" data-readout>ζ = 0.72</div><div class="mini-controls"><button data-damping="0.35">轻阻尼</button><button data-damping="0.72">平衡</button><button data-damping="1.00">临界</button></div><p class="image-caption">交互数据为演示参数。</p></div>':''}${record.kind==='late'?'<img class="late-image" data-late-image alt="延迟加载的示例波形图，非个人图片" width="360" height="150"><p class="image-caption">公开演示：图片区域已预留。</p>':''}<h4>内容先于容器</h4><p>${chinese}</p><ul><li>同一个内容，拥有预览和阅读两种组织方式。</li><li>保留浏览位置，也保留操作的上下文。</li><li>关闭时，回到卡片当前所在的位置。</li></ul><h4>继续阅读</h4><p>${chinese}</p><p>${chinese}</p><div class="note">此内容为作者编写的 Placeholder，不代表吴逸飞的工作、观点或个人经历。动效原则参考 <a href="https://emilkowal.ski/ui/the-magic-of-clip-path" target="_blank" rel="noopener">Emil 的裁切研究</a> 与 <a href="https://gsap.com/docs/v3/Plugins/Flip/" target="_blank" rel="noopener">GSAP 的状态捕获原理</a>。</div>`;
}
