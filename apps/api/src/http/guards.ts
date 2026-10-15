import {Inject,Injectable,type CanActivate,type ExecutionContext} from '@nestjs/common';
import {AUTH,equalSecret,type ApiAuth} from './config.js';
import {ContentError} from '../content/errors.js';
@Injectable()
export class AdminGuard implements CanActivate{
  constructor(@Inject(AUTH)private readonly auth:ApiAuth){}
  canActivate(context:ExecutionContext){
    const request=context.switchToHttp().getRequest();
    const bearer=typeof request.headers.authorization==='string'?request.headers.authorization:'';
    if(!bearer.startsWith('Bearer ')||!equalSecret(bearer.slice(7),this.auth.adminToken))throw new ContentError(401,'unauthorized','An admin bearer token is required');
    if(this.auth.mode==='local-demo'){
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.ip))throw new ContentError(403,'loopback_only','Local-demo mode only accepts loopback clients');
      const origin=request.headers.origin;
      if(origin){let allowed=false;try{const u=new URL(origin);allowed=['http:','https:'].includes(u.protocol)&&['127.0.0.1','localhost','[::1]'].includes(u.hostname);}catch{}if(!allowed)throw new ContentError(403,'origin_forbidden','Cross-site admin requests are rejected');}
    }else if(request.headers.origin){
      // Until real session/CSRF integration exists, token mode accepts service clients only.
      throw new ContentError(403,'origin_forbidden','Browser-origin admin requests require a server-side BFF');
    }
    return true;
  }
}
@Injectable()
export class HumanReviewGuard implements CanActivate{
  constructor(@Inject(AUTH)private readonly auth:ApiAuth){}
  canActivate(context:ExecutionContext){const request=context.switchToHttp().getRequest();const token=request.headers['x-personalos-review-token'];if(typeof token!=='string'||!equalSecret(token,this.auth.reviewToken))throw new ContentError(403,'human_review_required','A separate human-review capability is required');return true;}
}
