"""Task-local 4096 MiB process-group ceiling and per-command deadline <=2400s."""
import argparse,pathlib,subprocess,os,signal,time,resource,json
p=argparse.ArgumentParser();p.add_argument('--label',required=True);p.add_argument('--timeout',type=int,default=600);p.add_argument('command',nargs=argparse.REMAINDER);a=p.parse_args();assert 1<=a.timeout<=2400;cmd=a.command[1:] if a.command[0]=='--' else a.command
D=pathlib.Path(__file__).resolve().parent;peak=0;stopped=None;t=time.monotonic();last_live=0;min_available=None

def rss_group(pgid):
 total=0
 for path in pathlib.Path('/proc').glob('[0-9]*/stat'):
  try:
   st=path.read_text();f=st[st.rfind(')')+2:].split()
   if int(f[2])==pgid:total+=int(f[21])*os.sysconf('SC_PAGE_SIZE')//1024
  except (OSError,ValueError,IndexError):pass
 return total
with (D/(a.label+'.log')).open('w') as log:
 c=subprocess.Popen(cmd,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 while c.poll() is None:
  elapsed=time.monotonic()-t;rss=rss_group(c.pid);peak=max(peak,rss)
  available=int(next(line.split()[1] for line in pathlib.Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:')));min_available=available if min_available is None else min(min_available,available)
  if elapsed-last_live>10:
   (D/(a.label+'-live.json')).write_text(json.dumps({'running':True,'elapsed_s':elapsed,'current_RSS_KiB':rss,'peak_RSS_KiB':peak,'guard_MiB':4096,'timeout_seconds':a.timeout,'host_available_KiB':available,'minimum_host_available_KiB':min_available},indent=2));last_live=elapsed
  if rss>4096*1024:stopped='Process-group RSS exceeds 4096 MiB'
  elif available<2048*1024:stopped='Host available memory below2048MiB safety headroom'
  elif elapsed>a.timeout:stopped='Bounded timeout'
  if stopped:
   try:os.killpg(c.pid,signal.SIGTERM)
   except ProcessLookupError:pass
   try:c.wait(timeout=5)
   except subprocess.TimeoutExpired:
    try:os.killpg(c.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    c.wait()
   break
  time.sleep(.12)
r={'label':a.label,'exit_code':c.wait(),'elapsed_s':time.monotonic()-t,'peak_process_group_RSS_KiB':peak,'child_peak_RSS_KiB':resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss,'guard_MiB':4096,'timeout_seconds':a.timeout,'stopped':stopped,'command':cmd,'minimum_host_available_KiB':min_available,'scope':'Only this task process-group guard changed; no OS/cgroup/security limits changed'};(D/(a.label+'-process.json')).write_text(json.dumps(r,indent=2));(D/(a.label+'-live.json')).write_text(json.dumps({'running':False,**r},indent=2));print(json.dumps(r));raise SystemExit(r['exit_code'] or (2 if stopped else 0))
