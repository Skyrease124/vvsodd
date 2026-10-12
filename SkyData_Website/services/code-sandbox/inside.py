"""Trusted harness INSIDE an isolated, disposable gVisor container. Never run on host."""
import json, os, selectors, subprocess, sys, time
LIMIT=32768
ENV={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','HOME':'/work','ASAN_OPTIONS':'detect_leaks=0:abort_on_error=1','UBSAN_OPTIONS':'halt_on_error=1'}
def capture(args, stdin, seconds):
    started=time.monotonic(); output={'stdout':bytearray(),'stderr':bytearray()}; cause=None
    p=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=ENV,start_new_session=True)
    sel=selectors.DefaultSelector()
    for key,pipe in [('stdout',p.stdout),('stderr',p.stderr)]:
        os.set_blocking(pipe.fileno(),False);sel.register(pipe,selectors.EVENT_READ,key)
    pending=memoryview(stdin.encode());os.set_blocking(p.stdin.fileno(),False)
    if pending:sel.register(p.stdin,selectors.EVENT_WRITE,'stdin')
    else:p.stdin.close()
    try:
        while sel.get_map():
            if time.monotonic()-started>seconds:cause='TIMEOUT';break
            for event,_ in sel.select(.05):
                key=event.data
                if key=='stdin':
                    try:n=os.write(event.fileobj.fileno(),pending);pending=pending[n:]
                    except BrokenPipeError:pending=memoryview(b'')
                    if not pending:sel.unregister(event.fileobj);event.fileobj.close()
                    continue
                chunk=os.read(event.fileobj.fileno(),4096)
                if not chunk:sel.unregister(event.fileobj);continue
                remaining=LIMIT-sum(len(v) for v in output.values())
                output[key].extend(chunk[:remaining])
                if len(chunk)>remaining:cause='OUTPUT_LIMIT';break
            if cause:break
        if cause:
            import signal
            os.killpg(p.pid,signal.SIGKILL)
        try:code=p.wait(timeout=1)
        except subprocess.TimeoutExpired:
            import signal
            os.killpg(p.pid,signal.SIGKILL);code=p.wait(timeout=1);cause=cause or 'TIMEOUT'
    finally:sel.close()
    return {**{k:v.decode('utf8','replace') for k,v in output.items()},'exitCode':code,'failure':cause,'durationMs':round((time.monotonic()-started)*1000)}
def main():
    payload=json.loads(sys.stdin.buffer.read(80001))
    # Host supplies only validated code, preset and tests; no shell commands or arbitrary flags.
    if payload.get('language')!='cpp':raise ValueError('C++ only')
    code=payload['code'];tests=payload['tests'];preset=payload['preset']
    if not isinstance(code,str) or len(code.encode())>32768 or not tests or len(tests)>8:raise ValueError('Invalid job')
    if preset not in ['warnings','sanitizers']:raise ValueError('Invalid preset')
    with open('/work/main.cpp','x') as f:f.write(code)
    flags=['-std=c++17','-Wall','-Wextra','-Wpedantic','-Wmismatched-new-delete','-O0','-g','-fno-omit-frame-pointer']
    if preset=='sanitizers':flags+=['-fsanitize=address,undefined','-fno-sanitize-recover=all']
    compiler=capture(['/usr/bin/g++','--version'],'',2)['stdout'].splitlines()[0]
    compile_result=capture(['/usr/bin/g++',*flags,'/work/main.cpp','-o','/work/program'],'',10)
    result={'language':'cpp','compiler':compiler,'flags':flags,'compilation':compile_result,'tests':[],'status':'COMPILATION_FAILED'}
    if compile_result['exitCode']==0 and not compile_result['failure']:
        result['status']='TESTS_PASSED'
        for i,test in enumerate(tests):
            actual=capture(['/work/program'],test['stdin'],2)
            passed=actual['exitCode']==0 and not actual['failure'] and actual['stdout']==test['expectedStdout']
            result['tests'].append({'index':i,'expectedStdout':test['expectedStdout'],**actual,'passed':passed})
            if not passed:
                result['status']='RUNTIME_ERROR' if actual['exitCode']!=0 or actual['failure'] else 'TESTS_FAILED'
                break
    result['universalCorrectness']=False
    print(json.dumps(result))
if __name__=='__main__':main()
