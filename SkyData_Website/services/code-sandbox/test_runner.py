"""Application/control tests only. Never executes supplied C++ on the host."""
import json, unittest
from unittest.mock import patch
import runner
JOB={'language':'cpp','code':'int main() {}','tests':[{'stdin':'','expectedStdout':''}]}
IMAGE='skydata-cpp@sha256:'+'a'*64
class Controls(unittest.TestCase):
    def test_defaults(self):self.assertEqual(runner.validate(JOB)['preset'],'warnings')
    def test_invalid(self):
        for change in [{'language':'python'},{'language':'javascript'},{'code':'x'*32769},{'code':'\0'},{'preset':'-fplugin=evil'},{'tests':[]},{'tests':[{'stdin':'','expectedStdout':'','command':'evil'}]},{'command':'sh'}]:
            with self.subTest(change=change),self.assertRaises(runner.Invalid):runner.validate({**JOB,**change})
    def test_no_mutable_image(self):
        with self.assertRaises(runner.Unavailable):runner.prerequisites('image:latest')
    def test_no_fallback(self):
        with patch('runner.shutil.which',return_value=None),patch('runner.subprocess.Popen') as p:
            with self.assertRaises(runner.Unavailable):runner.execute(JOB,IMAGE)
            p.assert_not_called()
    def test_limits(self):
        argv=runner.command(IMAGE,'safe-name');s=' '.join(argv)
        for option in ['--runtime=runsc','--network=none','--cap-drop=ALL','--read-only','--pids-limit=64','--memory=512m','--memory-swap=512m','--cpus=1','--pull=never','--user=65532:65532']:self.assertIn(option,argv)
        self.assertNotIn('--privileged',s);self.assertNotIn('docker.sock',s);self.assertNotIn('--volume',s);self.assertNotIn('--env',s)
    def test_absent_cgroups(self):
        info={'Runtimes':{'runsc':{'path':'runsc'}},'MemoryLimit':False,'PidsLimit':True,'CPUCfsQuota':True,'SecurityOptions':['seccomp']}
        with patch('runner.shutil.which',return_value='/bin/mock'),patch('runner.subprocess.run',return_value=type('R',(),{'returncode':0,'stdout':json.dumps(info)})()):
            with self.assertRaises(runner.Unavailable):runner.prerequisites(IMAGE)
if __name__=='__main__':unittest.main()
