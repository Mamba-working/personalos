import Link from "next/link";
import Brand from "./Brand";
import { publicGet } from "@/lib/backend";
import type { PublicArticle } from "../../../../packages/contracts/content";
export default async function PublicLibrary() {
  let articles: PublicArticle[]=[]; let unavailable=false;
  try { const result=await publicGet<{articles:PublicArticle[]}>("articles"); articles=result.articles; } catch { unavailable=true; }
  return <div className="reader-shell"><header className="reader-nav"><Brand/><span className="reader-nav-note">可交互的解释性文章</span></header><main className="library-main"><p className="eyebrow">A SMALL LIBRARY OF UNDERSTANDING</p><h1>让知识，<br/>成为可以探索的东西。</h1><p className="library-deck">从一段对话出发。用文字建立脉络，用交互看见变化。<br/>每篇文章都经过规范校验与人工审批后发布。</p><div className="mock-disclosure"><span className="status-dot"/>Mock AI生成，真实API/存储/审批流程</div><section className="library-list" aria-label="已发布文章">{unavailable?<div className="empty-state error-panel"><h2>暂时无法连接内容服务</h2><p>请稍后重试。这里不会用本地假数据代替已发布文章。</p></div>:!articles.length?<div className="empty-state"><p className="eyebrow">NOT PUBLISHED YET</p><h2>第一篇文章还在工作台里</h2><p>只有对准确修订版完成人工审批并发布的文章，才会出现在这里。</p></div>:articles.map(article=><Link key={article.id} className="library-article" href={`/read/${encodeURIComponent(article.slug)}`}><span className="eyebrow">交互式解释 · MOCK AI</span><h2>{article.title}</h2><p>{article.summary}</p><span className="read-link">打开文章 <span aria-hidden="true">↗</span></span></Link>)}</section></main><footer className="reader-footer"><span>PersonalOS · Content Studio Demo</span><span>原生交互产物 / 隔离运行 / 人工发布</span></footer></div>;
}
