// Compatibility entry point: the versioned release gate now owns this candidate.
import {verifyProvenance} from './check-provenance.mjs';
import {fileURLToPath} from 'node:url';
console.log(JSON.stringify(verifyProvenance(fileURLToPath(new URL('../',import.meta.url))),null,2));
