import Link from "next/link";
import { notFound } from "next/navigation";
import Brand from "@/components/Brand";
import ArticleRenderer from "@/components/ArticleRenderer";
import { publicGet } from "@/lib/backend";
import type { PublicArticle } from "../../../../../../packages/contracts/content";
export const dynamic = "force-dynamic";
export default async function ReadPage({params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  let article:PublicArticle;
  try { ({article}=await publicGet<{article:PublicArticle}>(`articles/${encodeURIComponent(slug)}`)); }
  catch(error) { if(error instanceof Error&&error.message==="NOT_FOUND") notFound(); return <main className="public-error"><h1>内容服务暂时不可用</h1><p>这篇文章暂时无法载入，请稍后重试。</p><Link href="/library">返回文章列表</Link></main>; }
  return <div className="reader-shell"><header className="reader-nav"><Brand/><Link className="text-link" href="/library">所有文章 ↗</Link></header><main className="public-article"><div className="publication-label"><span className="status-dot"/>已发布 · 人工审核修订版<span className="mono">{article.contentHash.slice(0,12)}</span></div><ArticleRenderer key={article.revisionId} presentation={article.presentation}/><aside className="public-transparency"><strong>关于这篇演示文章</strong><p>Mock AI生成，真实API/存储/审批流程。生成器为受控模拟器，模型调用 0 次。OpenIntelligentUI 原生交互产物在隔离 iframe 中运行。读者交互不触发 AI 生成；完整代码、运行时与隔离策略均绑定已审核修订版。</p><p className="mono">修订 {article.revisionId} · 发布于 {new Date(article.publishedAt).toLocaleString("zh-CN",{timeZone:"UTC"})} UTC</p></aside></main><footer className="reader-footer"><span>PersonalOS · Field Notes</span><Link href="/library">继续探索 ↗</Link></footer></div>;
}
