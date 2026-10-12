"""Separate-host C++ runner. Not imported by the Worker. No HTTP listener.
Requires audited Docker+runsc and an immutable image digest. No fallback runtime.
"""
import argparse, json, os, re, selectors, shutil, subprocess, threading, time, uuid
MAX_REQUEST=70000
class Unavailable(RuntimeError):pass
class Invalid(ValueError):pass
def validate(job):
    if not isinstance(job,dict) or set(job)-{'language','code','preset','tests'}:raise Invalid('Unknown request fields')
    if job.get('language')!='cpp':raise Invalid('Only C++ is implemented')
    code=job.get('code')
    if not isinstance(code,str) or not code.strip() or len(code.encode())>32768 or '\0' in code:raise Invalid('Code must be 1–32768 bytes without NUL')
    preset=job.get('preset','warnings')
    if preset not in ('warnings','sanitizers'):raise Invalid('Choose an allowlisted compilation preset')
    tests=job.get('tests')
    if not isinstance(tests,list) or not 1<=len(tests)<=8:raise Invalid('Provide 1–8 tests')
    for t in tests:
        if not isinstance(t,dict) or set(t)!={'stdin','expectedStdout'} or any(not isinstance(v,str) or len(v.encode())>4096 for v in t.values()):raise Invalid('Each test needs bounded stdin and expectedStdout')
    return {'language':'cpp','code':code,'preset':preset,'tests':tests}
def prerequisites(image):
    if not re.fullmatch(r'[A-Za-z0-9./:_-]+@sha256:[a-f0-9]{64}',image or ''):raise Unavailable('Supply an immutable image digest; mutable tags are refused')
    if not shutil.which('docker') or not shutil.which('runsc'):raise Unavailable('Docker and gVisor runsc are required. No host execution fallback.')
    r=subprocess.run(['docker','info','--format','{{json .}}'],capture_output=True,timeout=5,env={'PATH':os.environ.get('PATH','')})
    if r.returncode:raise Unavailable('Docker unavailable')
    info=json.loads(r.stdout)
    runtime=info.get('Runtimes',{}).get('runsc',{})
    path=runtime.get('path',runtime.get('Path',''))
    if os.path.basename(path)!='runsc':raise Unavailable('Docker runtime must resolve to audited runsc')
    if info.get('MemoryLimit') is not True or info.get('PidsLimit') is not True or info.get('CPUCfsQuota') is not True or not any('seccomp' in x for x in info.get('SecurityOptions',[])):raise Unavailable('Required cgroup/seccomp controls are unavailable')
    return info

def command(image,name):
    return ['docker','run','--pull=never','--runtime=runsc','--name',name,'--label','skydata.execution=isolated','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--user=65532:65532','--pids-limit=64','--memory=512m','--memory-swap=512m','--cpus=1','--ulimit=core=0','--ulimit=nofile=64:64','--ulimit=fsize=16777216:16777216','--tmpfs=/work:rw,nosuid,nodev,size=64m,mode=0700,uid=65532,gid=65532','--workdir=/work','-i',image]
# Single process, one active sandbox. A deployment controller must enforce one instance.
SLOT=threading.BoundedSemaphore(1)
def execute(job,image,cancel=None):
    job=validate(job);prerequisites(image)
    if not SLOT.acquire(blocking=False):raise Unavailable('Concurrency limit reached')
    name='skydata-job-'+uuid.uuid4().hex; started=time.monotonic(); process=None;cleanup=False
    try:
        process=subprocess.Popen(command(image,name),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':os.environ.get('PATH','')})
        payload=memoryview(json.dumps(job).encode()); data=bytearray();errors=bytearray();sel=selectors.DefaultSelector()
        for pipe,key,events in [(process.stdin,'in',selectors.EVENT_WRITE),(process.stdout,'out',selectors.EVENT_READ),(process.stderr,'err',selectors.EVENT_READ)]:os.set_blocking(pipe.fileno(),False);sel.register(pipe,events,key)
        reason=None
        try:
            while sel.get_map():
                if cancel and cancel.is_set():reason='CANCELLED';break
                if time.monotonic()-started>35:reason='TIMEOUT';break
                for event,_ in sel.select(.05):
                    if event.data=='in':
                        try:n=os.write(event.fileobj.fileno(),payload);payload=payload[n:]
                        except BrokenPipeError:payload=memoryview(b'')
                        if not payload:sel.unregister(event.fileobj);event.fileobj.close()
                    else:
                        chunk=os.read(event.fileobj.fileno(),4096)
                        if not chunk:sel.unregister(event.fileobj);continue
                        target=data if event.data=='out' else errors;target.extend(chunk)
                        if len(data)+len(errors)>400000:reason='OUTPUT_LIMIT';break
                if reason:break
        finally:sel.close()
        if reason:return {'status':reason,'tests':[],'durationMs':round((time.monotonic()-started)*1000),'universalCorrectness':False}
        process.wait(timeout=2)
        if process.returncode:return {'status':'SANDBOX_FAILURE','tests':[],'error':errors[:4096].decode('utf8','replace')}
        result=json.loads(data)
        if not isinstance(result,dict) or result.get('status') not in ['COMPILATION_FAILED','TESTS_PASSED','TESTS_FAILED','RUNTIME_ERROR']:raise Unavailable('Invalid sandbox response')
        result['sandboxDurationMs']=round((time.monotonic()-started)*1000)
        result['image']=image;result['runtime']='runsc';return result
    finally:
        try:
            removed=subprocess.run(['docker','rm','--force',name],capture_output=True,timeout=10,env={'PATH':os.environ.get('PATH','')});cleanup=removed.returncode==0
        finally:
            if process:
                if process.poll() is None:process.kill()
                process.wait(timeout=2)
                for pipe in [process.stdin,process.stdout,process.stderr]:
                    if pipe:pipe.close()
            SLOT.release()
        if not cleanup:raise Unavailable('Sandbox cleanup failed; stop accepting jobs and investigate')
def main():
    p=argparse.ArgumentParser();p.add_argument('--preflight',action='store_true');args=p.parse_args();image=os.environ.get('SKYDATA_SANDBOX_IMAGE','')
    try:
        if args.preflight:prerequisites(image);print(json.dumps({'status':'CONFIGURATION_CHECKED','isolationVerified':False}));return
        raw=__import__('sys').stdin.buffer.read(MAX_REQUEST+1)
        if len(raw)>MAX_REQUEST:raise Invalid('Request too large')
        print(json.dumps(execute(json.loads(raw),image)))
    except (Unavailable,Invalid,ValueError,subprocess.SubprocessError) as e:
        print(json.dumps({'status':'DISABLED','error':str(e),'tests':[]}));raise SystemExit(2)
if __name__=='__main__':main()
