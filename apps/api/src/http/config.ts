import {timingSafeEqual,createHash} from 'node:crypto';
export const SERVICE='CONTENT_SERVICE',AUTH='CONTENT_AUTH';
export type ApiAuth={mode:'local-demo'|'token';adminToken:string;reviewToken:string};
export const localDemoAuth:ApiAuth={mode:'local-demo',adminToken:'personalos-local-demo',reviewToken:'personalos-local-review'};
export const equalSecret=(a:string,b:string)=>timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
export function authFromEnvironment():ApiAuth{
  const mode=process.env.PERSONALOS_MODE??'local-demo';
  if(mode==='local-demo')return localDemoAuth;
  if(mode!=='token')throw new Error('PERSONALOS_MODE must be local-demo or token');
  const adminToken=process.env.PERSONALOS_ADMIN_TOKEN??'',reviewToken=process.env.PERSONALOS_REVIEW_TOKEN??'';
  if(adminToken.length<32||reviewToken.length<32||adminToken===reviewToken)throw new Error('Token mode requires distinct admin/reviewer secrets with at least 32 characters');
  return {mode,adminToken,reviewToken};
}
