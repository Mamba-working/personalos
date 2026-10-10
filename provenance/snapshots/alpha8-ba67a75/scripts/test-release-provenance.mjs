import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {historicalAlpha7Root} from './historical-alpha7.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
// Run the complete original alpha.6/alpha.7 provenance and version-identity assertion files from exact historical
// source, then the independently pinned successor gate and its negative cases.
for(const [cwd,files] of [
 [historicalAlpha7Root(root),['scripts/check-provenance.test.mjs','scripts/check-weather-elapsed-boundary.test.mjs','packages/contracts/test/contracts.test.mjs','apps/web/static-server.test.mjs']],
 [root,['scripts/check-reader-release-boundary.test.mjs']]
]){
 const result=spawnSync(process.execPath,['--test',...files],{cwd,stdio:'inherit'});
 if(result.status!==0)process.exit(result.status??1);
}
