import type {CaptureInput} from '../../../../packages/contracts/content.js';
export const syntheticFixtures:Omit<CaptureInput,'idempotencyKey'>[]=[
  {
    externalId:'synthetic-concurrency-v1',title:'并发不是越多越好',origin:'synthetic-fixture',
    permission:{confirmed:true,scope:'selected-snippet'},provenance:{label:'Synthetic architecture workshop / concurrency'},
    publicCitation:{label:'PostgreSQL: SELECT / SKIP LOCKED',url:'https://www.postgresql.org/docs/current/sql-select.html'},
    content:'[fact] 本例用 24 个等长任务演示并发预算，每个任务的工作时间设为 80 毫秒。\n[decision] 计算由受信任的命名函数完成，文章只提供经过范围检查的输入。\n[uncertainty] 这是简化的批次模型，尚未纳入真实网络抖动、资源竞争和服务端限流。',
  },
  {
    externalId:'synthetic-capture-v1',title:'对话片段进入内容工作台',origin:'synthetic-fixture',
    permission:{confirmed:true,scope:'selected-snippet'},provenance:{label:'Synthetic architecture workshop / capture'},
    publicCitation:{label:'Model Context Protocol architecture',url:'https://modelcontextprotocol.io/docs/learn/architecture'},
    content:'[fact] MCP 与 Skill 只能提交用户明确选择并授权的片段，不能声称已读到所有 ChatGPT 或 Codex 历史。\n[decision] 每个 source 保留不可变版本、内容哈希和来源；同一份输入重复提交不会创建重复版本。\n[uncertainty] 跨应用的真实授权、保留策略和用户身份认证仍需生产实现。',
  },
  {
    externalId:'synthetic-publishing-v1',title:'从草稿到可回滚发布',origin:'synthetic-fixture',
    permission:{confirmed:true,scope:'selected-snippet'},provenance:{label:'Synthetic architecture workshop / publishing'},
    content:'[fact] 一次人工批准只绑定一个确定的文章修订和内容哈希。\n[decision] 新修订让先前的草稿批准失效，发布只移动已批准不可变内容的公开指针。\n[uncertainty] 正式上线前仍需审计、账户权限、对象存储和备份恢复演练。',
  },
];
