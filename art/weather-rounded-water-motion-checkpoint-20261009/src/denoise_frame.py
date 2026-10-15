import subprocess,json,hashlib
from pathlib import Path
from contract import work_dir,oidn
D=work_dir();O=D/'full900/processed';exe=oidn()
assert hashlib.sha256(exe.read_bytes()).hexdigest()=='1cb3a28ebc99b90d7548b0b8b16f70c163cb59abe8582458a254aa303338269c'
r=[]
for mode,kind,output in [('color','hero','hero-color.pfm'),('guided','hero','hero-guided.pfm'),('color','catcher','catcher-denoised.pfm')]:
 cmd=[str(exe),'--device','cpu','--quality','high','--threads','2','--maxmem','1024','--hdr',str(O/(kind+'.pfm')),'--output',str(O/output)]
 if mode=='guided':cmd+=['--alb',str(O/'albedo.pfm'),'--nrm',str(O/'normal.pfm')]
 p=subprocess.run(cmd,capture_output=True,text=True,timeout=180);(O/(output+'.log')).write_text(p.stdout+'\n'+p.stderr);assert p.returncode==0;r.append({'kind':kind,'mode':mode,'command':cmd})
(D/'full900/DENOISE-CONTRACT.json').write_text(json.dumps({'native_width':900,'crop_top_origin':[0,0,900,600],'same_raw_sample_buffer_all_modes':True,'samples':512,'catcher_color_only_for_both_denoised_comparisons':True,'plate_untouched':True,'records':r},indent=2))
