"""Encode exact rendered sequence and labeled nearest-neighbour inspection copy."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import subprocess,json,numpy as np,hashlib
from contract import work_dir
D=work_dir();O=D/'delivery';O.mkdir(exist_ok=True);I=D/'inspection-frames';I.mkdir(exist_ok=True)
font=lambda z:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',z)
F=font(18);M=font(14);S=font(12)
records=json.loads((D/'FRAME-GEOMETRY.json').read_text())
for k in range(75):
 p=Image.open(D/('sequence/f%03d-guided.png'%k)).convert('RGB');assert p.size==(100,72)
 im=Image.new('RGB',(640,520),'#20252d');d=ImageDraw.Draw(im)
 d.text((20,12),'Offline rim-drip preview',font=F,fill='white');d.text((20,38),'5x nearest-neighbour inspection | 900 x 600 render basis',font=M,fill='#c7d0d9')
 im.paste(p.resize((500,360),Image.Resampling.NEAREST),(20,72));im.paste(p,(530,72));d.text((530,151),'Native crop',font=S,fill='white');d.text((530,168),'100 x 72 px',font=S,fill='#c7d0d9')
 phase=records[k]['phase'].capitalize();phase='Residual at rim'if k>=68 else phase
 d.text((20,449),'%s | %.3f s | frame %02d'%(phase,k/30,k),font=F,fill='white');d.text((20,478),'2.5 s at 30 fps playback | authored 3D water geometry',font=M,fill='#c7d0d9');d.text((20,499),'Offline render; not a fluid simulation or runtime performance test',font=S,fill='#c7d0d9');im.save(I/('f%03d.png'%k))

enc=[]
for pattern,out in [(D/'sequence/f%03d-guided.png',O/'offline-rim-drip-native100x72-30fps.mp4'),(I/'f%03d.png',O/'offline-rim-drip-inspection5x-30fps.mp4')]:
 cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','30','-start_number','0','-i',str(pattern),'-frames:v','75','-c:v','libx264','-preset','slow','-crf','8','-pix_fmt','yuv420p','-movflags','+faststart','-metadata','title=Offline authored 3D rim-drip preview','-metadata','comment=Not a fluid simulation or a runtime FPS test. 75 independently rendered deformed-geometry frames at 30 fps playback.','-an',str(out)];subprocess.run(cmd,check=True);probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-select_streams','v:0','-count_frames','-show_entries','stream=codec_name,width,height,pix_fmt,avg_frame_rate,nb_read_frames,duration','-of','json',str(out)]));assert probe['streams'][0]['nb_read_frames']=='75';assert abs(float(probe['streams'][0]['duration'])-2.5)<1e-6;enc.append({'file':str(out),'probe':probe,'command':cmd})
# Decode native video before making the keyframe/contact evidence, so this checks the delivered encoding.
E=D/'decoded-native';E.mkdir(exist_ok=True);subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(O/'offline-rim-drip-native100x72-30fps.mp4'),'-start_number','0',str(E/'f%03d.png')],check=True)
selected=[0,20,40,55,60,62,63,64,65,66,67,74];contact=Image.new('RGB',(960,1170),'#20252d');dr=ImageDraw.Draw(contact);dr.text((10,10),'Offline rim drip | encoded keyframes | 3x nearest-neighbour',font=F,fill='white')
for j,k in enumerate(selected):
 x=10+(j%3)*320;y=48+(j//3)*280;p=Image.open(E/('f%03d.png'%k)).convert('RGB');phase=records[k]['phase'];phase='residual'if k>=68 else phase;dr.text((x,y),'f%02d | %.3f s | %s'%(k,k/30,phase),font=M,fill='white');contact.paste(p.resize((300,216),Image.Resampling.NEAREST),(x,y+27))
 if 64<=k<=67:dr.text((x,y+246),'Gravity fall %.2f mm'%records[k]['fall_mm'],font=M,fill='#c7d0d9')
contact.save(O/'offline-rim-drip-encoded-contact-sheet.png')
# Adjacent release frames in larger magnified detail, with matching crop basis.
adj=Image.new('RGB',(1080,856),'#20252d');dr=ImageDraw.Draw(adj);dr.text((10,10),'Adjacent encoded release frames | 10x nearest-neighbour detail',font=F,fill='white')
for j,k in enumerate(range(61,69)):
 x=10+(j%4)*270;y=45+(j//4)*400;p=Image.open(E/('f%03d.png'%k)).convert('RGB').crop((64,36,84,72));adj.paste(p.resize((200,360),Image.Resampling.NEAREST),(x,y+22));dr.text((x,y),'f%02d | %.3f s'%(k,k/30),font=M,fill='white')
adj.save(O/'offline-rim-drip-adjacent-release-detail.png')
# Numerical compression check, confined to the useful outlet/lobe region.
checks=[]
for k in range(75):
 a=np.array(Image.open(D/('sequence/f%03d-guided.png'%k)).convert('RGB')).astype(float);b=np.array(Image.open(E/('f%03d.png'%k)).convert('RGB')).astype(float);d=abs(a-b);checks.append({'frame':k,'RGB8_mean_abs_error':float(d.mean()),'outlet_RGB8_mean_abs_error':float(d[35:72,64:84].mean()),'outlet_RGB8_max_abs_error':float(d[35:72,64:84].max())})
(D/'ENCODING-VALIDATION.json').write_text(json.dumps({'outputs':enc,'decoded_frame_count':len(list(E.glob('f*.png'))),'compression_checks':checks,'inspection_resize':'Pillow Image.Resampling.NEAREST, exactly five output pixels per native input pixel before video encoding','sound':'No audio'},indent=2))
print(json.dumps({'outputs':[str(x)for x in O.iterdir()],'decoded_frames':75}))
