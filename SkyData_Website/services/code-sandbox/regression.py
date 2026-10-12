"""REAL sandbox suite. Stops before native execution if required isolation is absent.
Run only on the dedicated execution host, never on SkyData's Worker or generic host.
"""
import json, os, tempfile, threading, time
from runner import execute,prerequisites,Unavailable
original='''#include <iostream>
using namespace std;
int main(){int* numbers=new int[5];for(int i=0;i<=5;i++){numbers[i]=i*10;}delete numbers;cout<<numbers[2]<<endl;return 0;}'''
corrected='''#include <iostream>
using namespace std;
int main(){int* numbers=new int[5];for(int i=0;i<5;i++){numbers[i]=i*10;}cout<<numbers[2]<<endl;delete[] numbers;return 0;}'''
def main():
    image=os.environ.get('SKYDATA_SANDBOX_IMAGE','');report={'realExecution':True,'cases':[]}
    try:prerequisites(image)
    except Unavailable as e:
        print(json.dumps({'status':'BLOCKED','realExecutionTestsRun':0,'reason':str(e)}));return 2
    cases=[('corrected',corrected,'20\n','TESTS_PASSED',''),('compilation-error','int main( {','','COMPILATION_FAILED',''),('original',original,'20\n','RUNTIME_ERROR','AddressSanitizer'),('out-of-bounds','int main(){int* p=new int[5]; volatile int i=5;p[i]=10;delete[] p;}','','RUNTIME_ERROR','AddressSanitizer'),('deallocation','int main(){int* p=new int[5];delete p;}','','RUNTIME_ERROR','AddressSanitizer'),('use-after-free','int main(){int* p=new int[5];p[2]=20;delete[] p;return p[2];}','','RUNTIME_ERROR','AddressSanitizer'),('infinite-loop','int main(){for(;;){}}','','RUNTIME_ERROR','TIMEOUT'),('output-limit','#include <iostream>\nint main(){for(;;)std::cout<<"xxxxxxxxxxxxxxxx";}','','RUNTIME_ERROR','OUTPUT_LIMIT'),('network','#include <sys/socket.h>\n#include <arpa/inet.h>\n#include <iostream>\nint main(){int s=socket(AF_INET,SOCK_STREAM,0);sockaddr_in a{};a.sin_family=AF_INET;a.sin_port=htons(443);inet_pton(AF_INET,"1.1.1.1",&a.sin_addr);std::cout<<(connect(s,(sockaddr*)&a,sizeof(a))<0?"blocked":"connected");}','blocked','TESTS_PASSED',''),('readonly-root','#include <fstream>\n#include <iostream>\nint main(){std::ofstream f("/etc/skydata-write");std::cout<<(f?"writable":"blocked");}','blocked','TESTS_PASSED','')]
    with tempfile.NamedTemporaryFile(prefix='skydata-host-only-') as canary:
        cases.append(('host-file','#include <fstream>\n#include <iostream>\nint main(){std::ifstream f('+json.dumps(canary.name)+');std::cout<<(f?"visible":"blocked");}','blocked','TESTS_PASSED',''))
        for name,code,expected,status,diagnostic in cases:
            result=execute({'language':'cpp','code':code,'preset':'sanitizers','tests':[{'stdin':'','expectedStdout':expected}]},image)
            passed=result.get('status')==status and (not diagnostic or diagnostic in json.dumps(result))
            report['cases'].append({'name':name,'passed':passed,'result':result})
        cancel=threading.Event();threading.Timer(.5,cancel.set).start()
        result=execute({'language':'cpp','code':'int main(){for(;;){}}','tests':[{'stdin':'','expectedStdout':''}]},image,cancel)
        report['cases'].append({'name':'cancellation','passed':result['status']=='CANCELLED','result':result})
    report['passed']=all(c['passed'] for c in report['cases']);report['note']='Basic isolation probes only, not a security audit. Sanitizer compatibility must be assessed on this runtime. HTTP auth, memory OOM causality, process exhaustion, spoofed harness output and cross-job isolation remain separate required gates.'
    print(json.dumps(report,indent=2));return 0 if report['passed'] else 1
if __name__=='__main__':raise SystemExit(main())
