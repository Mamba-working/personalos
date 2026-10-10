// Compatibility entry point: run the complete normal aggregate, without filters.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const result=spawnSync('npm',['test'],{cwd:fileURLToPath(new URL('../',import.meta.url)),stdio:'inherit'});
process.exit(result.status??1);
