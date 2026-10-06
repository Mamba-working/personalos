import { NextResponse, type NextRequest } from 'next/server';
// This proof has no Server Actions or write endpoints. Keep the legacy read-only HTTP boundary.
export function proxy(request: NextRequest) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new NextResponse('Method Not Allowed', {status:405,headers:{Allow:'GET, HEAD'}});
  return NextResponse.next();
}
export const config = { matcher: ['/', '/route-check'] };
