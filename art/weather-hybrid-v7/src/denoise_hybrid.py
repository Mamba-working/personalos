import sys,json,hashlib,time,subprocess
from pathlib import Path
D=Path(__file__).resolve().parent;label=sys.argv[1] if len(sys.argv)>1 else 'preview-v1';assert label in ['preview-v1','preview-v2','preview-v3','preview-v4','full-v3','full-v7','hero-baseline-v4','hero-canopy-v5','hero-thin-v6','hero-structured-v7','hero-material-v5'];O=D/label;exe=D.parent/'oidn-restore-2.5.1-20261007-9zJ5fR/oidn-2.5.1.x86_64.linux/bin/oidnDenoise'
assert hashlib.sha256(exe.read_bytes()).hexdigest()=='1cb3a28ebc99b90d7548b0b8b16f70c163cb59abe8582458a254aa303338269c'
records=[]
for kind in ['hero','catcher']:
 cmd=[str(exe),'--device','cpu','--quality','high','--threads','2','--maxmem','1024','--hdr',str(O/(kind+'.pfm')),'--output',str(O/(kind+'-denoised.pfm'))]
 if kind=='hero' and (O/'albedo.pfm').exists() and (O/'normal.pfm').exists():cmd+=['--alb',str(O/'albedo.pfm'),'--nrm',str(O/'normal.pfm')]
 p=subprocess.run(cmd,capture_output=True,text=True,timeout=180);(O/(kind+'-denoise.log')).write_text(p.stdout+'\n'+p.stderr);assert p.returncode==0;pout=O/(kind+'-denoised.pfm');records.append({'kind':kind,'command':cmd,'sha256':hashlib.sha256(pout.read_bytes()).hexdigest()})
(O/'DENOISE-CONTRACT.json').write_text(json.dumps({'method':('Official OIDN2.5.1 albedo+normal-guided HDR on CG hero, color-only on catcher. Guide validity in transparent panels is checked against retained raw.' if (O/'albedo.pfm').exists() else 'Official OIDN2.5.1 color-only HDR on separate CG hero and catcher passes.')+' Static plate is not denoised. Original CG coverage alpha retained.','records':records},indent=2))
