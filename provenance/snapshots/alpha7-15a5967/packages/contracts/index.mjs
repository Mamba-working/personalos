export const PRODUCT_VERSION = '0.1.0-alpha.7';
export const API_SCAFFOLD_VERSION = '0.0.1';
export const CATEGORIES = Object.freeze(['work', 'thoughts', 'labs']);
export function healthResponse() {
  return {status: 'ok', service: 'personalos-api', scaffoldVersion: API_SCAFFOLD_VERSION};
}
export function serviceStatus() {
  return {
    product: 'PersonalOS', productVersion: PRODUCT_VERSION, apiScaffoldVersion: API_SCAFFOLD_VERSION,
    capabilities: {health: true, status: true, contentApi: false, chatApi: false, authentication: false, persistence: false},
    frontendConnected: false,
  };
}
export function validateContentRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const keys = ['id','category','title','summary','meta','height','kind','index','placeholder'];
  return Object.keys(record).length === keys.length && keys.every(key => Object.hasOwn(record,key))
    && ['id','title','summary','meta','kind'].every(key => typeof record[key] === 'string' && record[key].length > 0)
    && CATEGORIES.includes(record.category) && Number.isInteger(record.height) && record.height > 0
    && typeof record.index === 'string' && /^\d{2}$/.test(record.index) && record.placeholder === true;
}
