import 'server-only';
import { parseContentProof, type ContentProof, type Section } from '@personalos/contracts/content-proof';
const chapters = [
  ['从一张卡片开始', '一张卡片不是被缩小的文章，而是阅读的邀请。它需要给出足够明确的线索，让人知道打开之后会遇见什么。标题、摘要和内容的气质应当连在一起；至于段落之间的停顿、论证的转折和最后留下的问题，应该交给阅读本身。'],
  ['把注意力还给文字', '阅读不是把页面从上到下移动一次。我们会停在一个句子上，回到前面的定义，比较相隔很远的两段话。有时只读一半，有时打开另一个窗口查找背景。一个安静的阅读面，应当允许这些不整齐的路径，而不是把每次操作都当作需要重新开始的演出。'],
  ['稳定不等于静止', '稳定的意思，是人在变化中仍然知道自己在哪里。卡片可以展开，窗外的光线可以改变，正文也可以得到新的补充。但正在输入的句子不应该丢失，刚才读到的段落不应该突然换成另一段。变化需要有边界，边界要服务于人的记忆。'],
  ['让工具保持具体', '工具的价值，往往来自它是否把一个具体的小问题处理妥当。一个计数器不需要伪装成完整的实验平台；一段笔记不需要套用项目报告的结构。内容先有自己的目的，界面再选择恰当的表达，才不会为了形式而牺牲信息。'],
  ['为返回留一条路', '人们经常在打开之后才判断内容是否适合自己。返回不是失败，而是探索的一部分。回到原来的卡片、原来的滚动位置，甚至原来的输入状态，可以减少重新寻找的负担。好的返回路径不需要解释，因为读者会自然地把它当成理所当然。'],
  ['更新不是重新开始', '一篇文章可能增加注释，也可能修正一个措辞。新的版本应当真实出现，但它不必夺走读者正在做的事情。对于不会改变意义的补充，可以在稳定的时刻合并，并且用段落的位置保留阅读上下文。身份与更新需要同时成立。'],
  ['区分界面与内容', '同样属于 Thoughts 的内容，可以是一句话，也可以是一篇长文；Labs 可以是交互工具，也可以是失败实验的记录。栏目回答内容放在哪里，表达方式回答它怎样被理解。这是两个不同的问题，不应该被同一张模板锁死。'],
  ['保留没有写完的部分', '我们并不总是在一个完整的时段里工作。一个临时想法、一组尚未确认的数字、一句写到一半的话，都值得被保存。界面不必替人决定它们是否重要，至少应当保证一次普通的打开、关闭和刷新不会把它们抹去。'],
  ['朴素的技术承诺', '这里的技术承诺很小：正文由明确的内容记录生成，交互由组件维护，运动只改变登记过的外层表现。它不意味着所有功能已经迁移，也不意味着已经连接真实数据库。清楚说明已经做到什么，能够让下一步的判断更可靠。'],
  ['留下可以继续的空间', '一个个人空间，不必在第一次打开时就展示所有可能性。它可以从一篇愿意读完的文章、一个能保留状态的小实验开始。只有当这些细小的承诺经得起反复使用，更复杂的叙事和协作才有扎实的基础。'],
];
export function revisionFromQuery(value: string | string[] | undefined): number { return value === '2' ? 2 : 1; }
export async function readContentProof(revision: number): Promise<ContentProof> {
  const sections: Section[] = chapters.map(([heading, paragraph], index) => ({ id: `section-${index + 1}`, heading, paragraphs: [{ id: 'opening', text: paragraph }, { id: 'reflection', text: `换一个角度看，${paragraph}这也是这份演示希望检验的事情：当结构与表现分开之后，我们能否让变化发生，同时不打断手上的阅读。` }] }));
  if (revision === 2) sections[0].paragraphs.unshift({ id: 'revision-note', text: '服务器版本 2 新增：这段内容只存在于新的服务端记录中。它故意加在文章前部，用来检查正文更新后，正在阅读的段落是否仍然停留在原来的位置。' });
  return parseContentProof({ schemaVersion: 1, source: 'server-fixture', revision, records: [
    { id: 'quiet-reading', revision, space: 'thoughts', kind: 'essay', title: '给阅读留一点安静', summary: revision === 2 ? '服务器版本 2 · 在内容持续更新时，保留读者的位置与注意力。' : '关于卡片、阅读与返回。一篇用于检验真实组件身份的中文长文。', provenance: 'authored-demo', sections },
    { id: 'small-counter', revision, space: 'labs', kind: 'counter-lab', title: '把一个小念头留下来', summary: '一个有记忆的小实验。试着写一句话、加几次，再打开、返回或更新正文。', provenance: 'authored-demo', step: revision === 2 ? 2 : 1, instruction: revision === 2 ? '服务器版本 2：每次现在加 2，你已经写下的内容和计数应当保留。' : '服务器版本 1：每次加 1。计数和草稿只保存在当前页面的 React 实例中。', sections: [{ id: 'lab-notes', heading: '这个实验验证什么', paragraphs: [{ id: 'identity', text: '这不是持久化笔记产品。它检验同一个输入框和同一个组件，能否穿过卡片、阅读和新服务端版本而不被替换。刷新整个浏览器文档仍会重置这个演示。' }, { id: 'purpose', text: 'Work、Thoughts、Labs 是内容的归属，不是三张固定模板。这里的实验与长文拥有不同的正文结构，只共享稳定身份、阅读和返回的协议。' }] }] },
  ] });
}
