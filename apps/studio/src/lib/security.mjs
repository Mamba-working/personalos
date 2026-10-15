/** Local demo trust boundary. Host checks complement the API's loopback guard, not production authentication. */
export function isLoopbackHost(host) {
  if (typeof host !== 'string' || /[\s/@\\]/.test(host)) return false;
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host.toLowerCase());
}
export function isAdminEnabled(host, env = process.env) {
  return env.CONTENT_STUDIO_ADMIN_ENABLED === 'true' && isLoopbackHost(host);
}
export function isSameOriginMutation(origin, host) {
  if (!origin || !isLoopbackHost(host)) return false;
  try { const url = new URL(origin); return ['http:', 'https:'].includes(url.protocol) && url.host === host; }
  catch { return false; }
}
export function safeExternalUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
