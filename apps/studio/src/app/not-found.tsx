import Link from "next/link";
export default function NotFound(){return <main className="public-error"><p className="eyebrow">NOT PUBLISHED / 404</p><h1>这篇文章还没有公开发布</h1><p>可能仍在审核中，或链接已经变更。只有已批准并发布的修订版可以在这里阅读。</p><Link href="/library">返回文章列表 →</Link></main>;}
