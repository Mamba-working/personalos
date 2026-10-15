import bpy,json,hashlib,importlib.util,math
from pathlib import Path
D=Path(__file__).resolve().parent;SRC=D/'hybrid-rain-hero-v4-canopy-candidate.blend';sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest();expected='6271bd8348d2bafa74009ff96dac469bbfdb7baf84862faf6dcf63add30467ec';assert sha(SRC)==expected;bpy.ops.wm.open_mainfile(filepath=str(SRC))
p=D/'materials/thin_sheet_canopy.py';spec=importlib.util.spec_from_file_location('thin_sheet',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);r=m.apply_thin_sheet(bpy.context.scene)
checks=[]
for angle in [0,30,60,80,89,89.99]:
 c=math.cos(math.radians(angle));eta=1.38;ct=math.sqrt(1-(1-c*c)/(eta*eta));rs=((c-eta*ct)/(c+eta*ct))**2;rp=((eta*c-ct)/(eta*c+ct))**2;R=(rs+rp)/2;eff=2*R/(1+R);T=(1-R)/(1+R);series=R+(1-R)**2*R/(1-R*R);assert abs(eff+T-1)<1e-12 and abs(eff-series)<1e-9 and 0<=eff<=1;checks.append({'angle':angle,'interface_R':R,'sheet_R':eff,'sheet_T':T,'sum':eff+T})
OUT=D/'hybrid-rain-hero-v4-thin-sheet-candidate.blend';assert not OUT.exists();bpy.ops.wm.save_as_mainfile(filepath=str(OUT),compress=True);r.update(source_sha256=expected,source_unchanged=sha(SRC)==expected,output=str(OUT),output_sha256=sha(OUT),shader_sha256=sha(p),energy_checks=checks);(D/'THIN-SHEET-CANDIDATE-MANIFEST.json').write_text(json.dumps(r,indent=2));print('THIN_SHEET_READY',r['output_sha256'],flush=True)
