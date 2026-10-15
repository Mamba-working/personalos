"use client";
import { OpenGenUIContentSchema } from "@/vendor/openintelligentui/schema";
import OpenIntelligentArtifact from "./openintelligentui/OpenIntelligentArtifact";
import { RENDERER_DESCRIPTOR,validateCompletedArtifact } from "../../../../packages/contracts/openintelligentui.mjs";
import type { PresentationEnvelope } from "../../../../packages/contracts/content";

export default function ArticleRenderer({presentation,onFollowUp}:{presentation:PresentationEnvelope;onFollowUp?:(text:string)=>void}){
  const compatible=!!presentation&&Object.entries(RENDERER_DESCRIPTOR).every(([key,value])=>(presentation as unknown as Record<string,unknown>)[key]===value);
  const parsed=OpenGenUIContentSchema.safeParse(presentation?.spec);
  const bounded=validateCompletedArtifact(presentation?.spec).valid;
  if(!compatible||!parsed.success||!bounded)return <div role="alert" className="error-panel"><strong>交互产物未执行</strong><p>运行时版本、隔离策略或原生产物结构不匹配。请重新生成并审核此修订版。</p></div>;
  return <OpenIntelligentArtifact content={parsed.data} onFollowUp={onFollowUp}/>;
}
