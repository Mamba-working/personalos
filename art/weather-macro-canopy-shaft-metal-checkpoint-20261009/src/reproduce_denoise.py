"""OIDN2.5.1 stage; existing official installation only, no downloads."""
import argparse,subprocess,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--oidn',required=True);p.add_argument('--output',required=True);a=p.parse_args();P=Path(a.output).resolve()/'processed';records=[]
for mode,kind,dest in [('color','hero','hero-color.pfm'),('guided','hero','hero-guided.pfm'),('color','catcher','catcher-denoised.pfm')]:
 cmd=[a.oidn,'--device','cpu','--quality','high','--threads','2','--maxmem','1024','--hdr',str(P/(kind+'.pfm')),'--output',str(P/dest)]
 if mode=='guided':cmd+=['--alb',str(P/'albedo.pfm'),'--nrm',str(P/'normal.pfm')]
 subprocess.run(cmd,check=True);records.append(cmd)
(P/'denoise-receipt.json').write_text(json.dumps(records,indent=2))
