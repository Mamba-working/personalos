// Node-only import alias for static validation, not an application runtime patch.
export async function resolve(specifier,context,nextResolve){if(specifier==='three')return {url:new URL('../public/vendor/three/three.module.min.js',import.meta.url).href,shortCircuit:true};return nextResolve(specifier,context);}
