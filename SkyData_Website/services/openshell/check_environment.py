"""Read-only inventory. Never creates a sandbox or executes submitted code."""
import json, os, platform, shutil

def inventory():
    commands={name:bool(shutil.which(name)) for name in ['openshell','openshell-gateway','docker','podman','kubectl','helm']}
    host_virtualization=os.path.exists('/dev/kvm') and os.access('/dev/kvm',os.R_OK|os.W_OK)
    candidate=commands['docker'] or commands['podman'] or commands['kubectl'] or host_virtualization
    return {'platform':platform.system(),'kernel':platform.release(),'commands':commands,'kvmDeviceAccessible':host_virtualization,'localRuntimeCandidate':candidate,'isolationVerified':False,'productionExecutionEnabled':False,'status':'NEEDS_QUALIFICATION' if commands['openshell'] and candidate else 'BLOCKED','note':'Inventory only: command presence and kernel version do not prove Landlock/seccomp, resource, network or result-integrity enforcement. A remote gateway is not probed without explicitly supplied authenticated configuration.'}
if __name__=='__main__':
    result=inventory();print(json.dumps(result,indent=2));raise SystemExit(2 if result['status']=='BLOCKED' else 0)
