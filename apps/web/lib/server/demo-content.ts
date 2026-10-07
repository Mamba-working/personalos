// This module is imported only by Server Components. Content remains the authored alpha.3 source.
import { records as authored, graphic, detail } from '../../runtime/content.js';
import type { ContentRecord } from '../navigation/route-state';
export const records = authored as ContentRecord[];
export { graphic, detail };
if (records.length !== 18 || new Set(records.map(record => record.id)).size !== 18 || records.some(record => record.placeholder !== true)) throw new Error('Invalid authored content manifest');
