"""Offline transport and main-thread lifecycle checks; no Blender installation required."""
import importlib
import io
import json
from pathlib import Path
import sys
import types
import unittest
import urllib.error
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'pc-connector'))
fake_bpy = types.SimpleNamespace(types=types.SimpleNamespace(Operator=object, Panel=object),
    context=types.SimpleNamespace(window_manager=types.SimpleNamespace(windows=[])))
sys.modules['bpy'] = fake_bpy
addon = importlib.import_module('skydata_connector')
transport = addon.transport

class ConnectorTests(unittest.TestCase):
    def test_transport_target_and_header(self):
        response = io.BytesIO(json.dumps({'connected': True}).encode())
        opener = unittest.mock.Mock()
        opener.open.return_value = response
        with patch.object(transport.urllib.request, 'build_opener', return_value=opener):
            self.assertTrue(transport.send('heartbeat', {'blenderReady': True}, 'a' * 64)['connected'])
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, transport.SITE + '/api/blender/heartbeat')
        self.assertEqual(request.get_header('Authorization'), 'Bearer ' + 'a' * 64)
        self.assertEqual(opener.open.call_args.kwargs['timeout'], 10)
        self.assertEqual(json.loads(request.data), {'blenderReady': True})
        self.assertIsNone(transport.NoRedirect().redirect_request(request, None, 302, '', {}, 'https://other.invalid'))

    def test_revocation_and_secret_free_error(self):
        opener = unittest.mock.Mock()
        opener.open.side_effect = urllib.error.HTTPError(transport.SITE, 401, 'secret-token', {}, None)
        with patch.object(transport.urllib.request, 'build_opener', return_value=opener):
            with self.assertRaises(transport.ConnectionError) as caught:
                transport.send('heartbeat', {}, 'secret-token')
        self.assertTrue(caught.exception.revoked)
        self.assertNotIn('secret-token', str(caught.exception))

    def test_stale_response_cannot_resume_stopped_connection(self):
        addon._state.update(registered=True, generation=2, running=False, busy=False, token=None)
        addon._results.put((1, 'pair', {'token': 'a' * 64}, None))
        addon.tick()
        self.assertIsNone(addon._state['token'])
        self.assertFalse(addon._state['running'])

    def test_revocation_clears_local_connection(self):
        addon._state.update(registered=True, generation=3, running=True, busy=True, token='a' * 64)
        addon._results.put((3, 'heartbeat', None, transport.ConnectionError('Revoked', True)))
        with patch.object(addon, 'forget') as forget:
            addon.tick()
            forget.assert_called_once()
        self.assertIsNone(addon._state['token'])
        self.assertFalse(addon._state['running'])

    def test_saved_token_failure_preserves_session(self):
        addon._state.update(registered=True, generation=4, running=False, busy=True, token=None)
        addon._results.put((4, 'pair', {'token': 'b' * 64}, None))
        with patch.object(addon, 'credential_path', return_value='unused'), patch.object(addon.credentials, 'save', side_effect=OSError()), patch.object(addon, 'launch') as launch:
            addon.tick()
            launch.assert_called_once_with('heartbeat', {'blenderReady': True, 'protocolVersion': 5})
        self.assertEqual(addon._state['token'], 'b' * 64)
        self.assertTrue(addon._state['running'])

    def test_scene_is_read_on_main_thread_then_uploaded(self):
        addon._state.update(registered=True, generation=5, running=True, busy=True, token='c' * 64)
        import time
        addon._results.put((5, 'heartbeat', {'connected': True, 'command': {'type': 'scene-read', 'id': 'request-1', 'expires': time.time() * 1000 + 90000}}, None))
        with patch.object(addon.scene, 'snapshot', return_value={'name': 'Test scene'}) as read, patch.object(addon, 'launch') as launch:
            addon.tick()
            read.assert_called_once_with(fake_bpy.context)
            launch.assert_called_once_with('result', {'requestId': 'request-1', 'scene': {'name': 'Test scene'}})

    def test_unknown_command_is_never_executed(self):
        addon._state.update(registered=True, generation=6, running=True, busy=True, token='c' * 64)
        addon._results.put((6, 'heartbeat', {'command': {'type': 'execute-python', 'id': 'evil', 'code': 'raise Exception()'}}, None))
        with patch.object(addon.scene, 'snapshot') as read, patch.object(addon, 'launch') as launch:
            addon.tick()
            read.assert_not_called()
            launch.assert_not_called()

    def test_large_scene_snapshot_is_bounded(self):
        class Object:
            def __init__(self, n):
                self.selected = n == 0
                self.name = 'Object ' + str(n)
                self.type = 'MESH'
                self.location = [1, 2, 3]
                self.rotation_euler = [0, 0, 0]
                self.scale = [1, 1, 1]
            def select_get(self, view_layer):
                return self.selected
        objects = [Object(i) for i in range(101)]
        context = types.SimpleNamespace(scene=types.SimpleNamespace(name='School', objects=objects, frame_current=1), selected_objects=[objects[0]], view_layer=types.SimpleNamespace(objects=types.SimpleNamespace(active=objects[0])))
        result = addon.scene.snapshot(context)
        self.assertEqual(result['totalObjects'], 101)
        self.assertEqual(len(result['objects']), 100)
        self.assertTrue(result['truncated'])
        self.assertTrue(result['objects'][0]['selected'])
        self.assertEqual(result['activeObject'], 'Object 0')

    def test_modeling_runs_on_main_thread_and_result_retries_without_execution(self):
        import time
        addon._state.update(registered=True, generation=7, running=True, busy=True, token='c' * 64, pending_result=None)
        plan = {'summary': 'Chair', 'operations': [{'op': 'create', 'name': 'Chair', 'primitive': 'empty'}]}
        addon._results.put((7, 'heartbeat', {'command': {'type': 'modeling', 'id': 'model-1', 'expires': time.time()*1000+90000, 'plan': plan}}, None))
        def execute(*args):
            self.assertEqual(addon._state['plan'], plan)
            addon._state['model_result'] = {'success': True, 'message': '1 objects created.'}
        fake_bpy.ops = types.SimpleNamespace(skydata=types.SimpleNamespace(execute_modeling=unittest.mock.Mock(side_effect=execute)))
        with patch.object(addon.scene, 'snapshot', return_value={'name': 'Test scene'}), patch.object(addon, 'launch') as launch:
            addon.tick()
            self.assertEqual(launch.call_args.args[0], 'result')
            self.assertEqual(launch.call_args.args[1]['kind'], 'modeling')
            self.assertTrue(launch.call_args.args[1]['success'])
        fake_bpy.ops.skydata.execute_modeling.assert_called_once()
        addon._results.put((7, 'result', None, transport.ConnectionError('Temporary error')))
        addon.tick()
        addon._state.update(next=0, busy=False)
        with patch.object(addon, 'launch') as launch:
            addon.tick()
            self.assertEqual(launch.call_args.args[0], 'result')
        fake_bpy.ops.skydata.execute_modeling.assert_called_once()
        addon._results.put((7, 'result', {'accepted': True}, None))
        addon.tick()
        self.assertIsNone(addon._state['pending_result'])

    def test_modeling_rejects_code_and_nonfinite_transforms(self):
        for operation in [
            {'op': 'execute-python', 'name': 'Cube', 'code': 'print(1)'},
            {'op': 'create', 'primitive': 'cube', 'name': 'Cube', 'location': [float('nan'), 0, 0]},
            {'op': 'create', 'primitive': 'cube', 'name': 'Cube', 'scale': [-1, 1, 1]},
            {'op': 'update', 'name': 'Cube', 'parent': 'Camera'},
            {'op': 'create', 'primitive': 'cube', 'name': 'Cube', 'parent': 'Cube'}
        ]:
            with self.assertRaises(ValueError):
                addon.commands.validate({'summary': 'Invalid', 'operations': [operation]})

    def test_detailed_mesh_curve_and_wood_plan_validation(self):
        plan = {'summary': 'Detailed chair', 'operations': [
            {'op': 'create', 'name': 'Seat', 'primitive': 'mesh', 'vertices': [[0,0,0], [1,0,0], [0,1,0]], 'faces': [[0,1,2]], 'material': {'type': 'wood', 'color': [.4,.2,.1,1], 'grainAxis': 'X', 'roughness': .4}, 'bevel': .003, 'smooth': False, 'subdivision': 1},
            {'op': 'create', 'name': 'Curved back', 'primitive': 'curve', 'points': [[0,0,0], [0,0,.4], [0,.1,.8]], 'radius': .02, 'material': {'type': 'wood', 'grainAxis': 'Z'}}
        ]}
        self.assertEqual(len(addon.commands.validate(plan)), 2)
        import copy
        bad = copy.deepcopy(plan)
        bad['operations'][0]['faces'] = [[0,1,3]]
        with self.assertRaises(ValueError): addon.commands.validate(bad)
        bad = copy.deepcopy(plan)
        bad['operations'][0]['material']['roughness'] = float('nan')
        with self.assertRaises(ValueError): addon.commands.validate(bad)
        bad = copy.deepcopy(plan)
        bad['operations'][1]['radius'] = -.1
        with self.assertRaises(ValueError): addon.commands.validate(bad)

    def test_zip_contains_installable_addon(self):
        from zipfile import ZipFile
        path = Path(__file__).resolve().parents[1] / 'public/downloads/skydata-blender-connector.zip'
        with ZipFile(path) as package:
            self.assertIsNone(package.testzip())
            contents = package.read('SkyData-Blender-Connector/skydata_connector_addon.zip')
        with ZipFile(io.BytesIO(contents)) as archive:
            self.assertIsNone(archive.testzip())
            self.assertIn('skydata_connector/__init__.py', archive.namelist())
            self.assertFalse(any('__pycache__' in name for name in archive.namelist()))

unittest.main()
