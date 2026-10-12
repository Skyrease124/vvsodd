bl_info = {'name': 'SkyData PC Connector', 'author': 'SkyData', 'version': (1, 4, 0),
           'blender': (4, 2, 0), 'location': '3D View > Sidebar > SkyData',
           'description': 'Connect Blender, read scenes and run modeling instructions', 'category': 'System'}

import os
import platform
import queue
import threading
import time
import bpy
from . import transport, credentials, scene, commands

_results = queue.Queue()
_state = {'token': None, 'running': False, 'busy': False, 'generation': 0,
          'next': 0, 'pending_result': None, 'plan': None, 'model_result': None, 'message': 'Not connected', 'registered': False}

def credential_path():
    return os.path.join(bpy.utils.user_resource('CONFIG', path='skydata', create=True), 'connection.dat')

def forget():
    try:
        os.remove(credential_path())
    except FileNotFoundError:
        pass

def launch(action, payload):
    generation, token = _state['generation'], _state['token']
    _state['busy'] = True
    def worker():
        try:
            result = transport.send(action, payload, token if action != 'pair' else None)
            _results.put((generation, action, result, None))
        except Exception as error:
            safe = error if isinstance(error, transport.ConnectionError) else transport.ConnectionError('Connection failed. Please try again.')
            _results.put((generation, action, None, safe))
    threading.Thread(target=worker, daemon=True, name='SkyData-HTTPS').start()

def tick():
    if not _state['registered']:
        return None
    while True:
        try:
            generation, action, result, error = _results.get_nowait()
        except queue.Empty:
            break
        if generation != _state['generation']:
            continue
        _state['busy'] = False
        if error:
            if action == 'result':
                _state['next'] = time.monotonic() + 5
                if getattr(error, 'obsolete', False): _state['pending_result'] = None
            _state['message'] = str(error)
            if error.revoked:
                _state.update(token=None, running=False)
                try:
                    forget()
                except OSError:
                    pass
            elif action == 'pair':
                _state['running'] = False
        elif action == 'pair':
            _state.update(token=result['token'], running=True, next=0)
            try:
                credentials.save(credential_path(), result['token'])
                _state['message'] = 'Paired. Connecting…'
            except (OSError, ValueError):
                _state['message'] = 'Paired for this session; credential could not be saved.'
        elif action == 'result':
            _state['message'] = 'Connected · Result sent'
            _state['pending_result'] = None
        else:
            _state['message'] = 'Connected · Blender available'
            command = result.get('command')
            if isinstance(command, dict) and command.get('type') in ('scene-read', 'modeling') and isinstance(command.get('id'), str) and len(command['id']) <= 64 and isinstance(command.get('expires'), (int, float)) and command['expires'] > time.time() * 1000:
                try:
                    if command['type'] == 'modeling':
                        _state['plan'] = command.get('plan')
                        _state['model_result'] = None
                        bpy.ops.skydata.execute_modeling('EXEC_DEFAULT')
                        outcome = _state['model_result'] or {'success': False, 'message': 'Blender could not run the command.'}
                        payload = {'requestId': command['id'], 'kind': 'modeling', **outcome}
                        try: payload['scene'] = scene.snapshot(bpy.context)
                        except Exception: pass
                    else:
                        payload = {'requestId': command['id'], 'scene': scene.snapshot(bpy.context)}
                except Exception:
                    payload = {'requestId': command['id'], 'kind': 'modeling', 'success': False, 'message': 'Blender could not run the command.'} if command['type'] == 'modeling' else {'requestId': command['id'], 'error': 'scene_unavailable'}
                _state['pending_result'] = payload
                launch('result', payload)
        if action == 'heartbeat':
            _state['next'] = time.monotonic() + 5
        for window in bpy.context.window_manager.windows:
            for area in window.screen.areas:
                if area.type == 'VIEW_3D':
                    area.tag_redraw()
    if _state['running'] and _state['token'] and not _state['busy'] and time.monotonic() >= _state['next']:
        if _state['pending_result']:
            launch('result', _state['pending_result'])
        else:
            launch('heartbeat', {'blenderReady': True, 'protocolVersion': 5})
    return 0.5

class SKYDATA_OT_execute_modeling(bpy.types.Operator):
    bl_idname = 'skydata.execute_modeling'
    bl_label = 'SkyData modeling command'
    bl_options = {'REGISTER', 'UNDO'}
    def execute(self, context):
        try:
            message = commands.execute(context, _state['plan'])
            _state['model_result'] = {'success': True, 'message': message}
            return {'FINISHED'}
        except Exception as error:
            _state['model_result'] = {'success': False, 'message': str(error)[:500] or 'Blender could not run the command.'}
            return {'CANCELLED'}
        finally:
            _state['plan'] = None

class SKYDATA_OT_pair(bpy.types.Operator):
    bl_idname = 'skydata.pair'
    bl_label = 'Pair this PC'
    def execute(self, context):
        if _state['busy']:
            return {'CANCELLED'}
        code = context.window_manager.skydata_pairing_code.strip()
        normalized = ''.join(code.split()).replace('-', '').upper()
        if len(normalized) != 24 or any(c not in '0123456789ABCDEF' for c in normalized):
            self.report({'ERROR'}, 'Enter the full pairing code from SkyData.')
            return {'CANCELLED'}
        _state.update(generation=_state['generation'] + 1, running=False, pending_result=None, message='Pairing…')
        context.window_manager.skydata_pairing_code = ''
        launch('pair', {'code': code, 'name': (platform.node() or 'Windows PC')[:80]})
        return {'FINISHED'}

class SKYDATA_OT_start(bpy.types.Operator):
    bl_idname = 'skydata.start'
    bl_label = 'Start connection'
    def execute(self, context):
        if not _state['token']:
            try:
                _state['token'] = credentials.read(credential_path())
            except (OSError, ValueError):
                self.report({'ERROR'}, 'Generate a pairing code in SkyData and pair this PC.')
                return {'CANCELLED'}
        _state.update(running=True, next=0, message='Connecting…')
        return {'FINISHED'}

class SKYDATA_OT_stop(bpy.types.Operator):
    bl_idname = 'skydata.stop'
    bl_label = 'Stop connection'
    def execute(self, context):
        _state.update(running=False, busy=False, generation=_state['generation'] + 1, pending_result=None, message='Stopped')
        return {'FINISHED'}

class SKYDATA_OT_forget(bpy.types.Operator):
    bl_idname = 'skydata.forget'
    bl_label = 'Forget local connection'
    def execute(self, context):
        _state.update(token=None, running=False, busy=False, generation=_state['generation'] + 1, pending_result=None, message='Local connection removed')
        try:
            forget()
        except OSError:
            self.report({'ERROR'}, 'Could not remove the local credential file.')
        return {'FINISHED'}

class SKYDATA_OT_material_preview(bpy.types.Operator):
    bl_idname = 'skydata.material_preview'
    bl_label = 'Show materials'
    def execute(self, context):
        for window in context.window_manager.windows:
            for area in window.screen.areas:
                if area.type == 'VIEW_3D':
                    area.spaces.active.shading.type = 'MATERIAL'
                    area.tag_redraw()
        return {'FINISHED'}

class SKYDATA_PT_connector(bpy.types.Panel):
    bl_label = 'SkyData Connector'
    bl_idname = 'SKYDATA_PT_connector'
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'SkyData'
    def draw(self, context):
        layout = self.layout
        layout.label(text=_state['message'])
        layout.label(text='Version 1.4 · Detailed modeling and materials')
        layout.operator('wm.url_open', text='Open SkyData pairing page', icon='URL').url = transport.SITE + '/blender'
        column = layout.column()
        column.enabled = not _state['busy'] and not _state['running']
        column.prop(context.window_manager, 'skydata_pairing_code', text='Code')
        column.operator('skydata.pair')
        layout.operator('skydata.stop' if _state['running'] else 'skydata.start')
        layout.operator('skydata.forget')
        layout.operator('skydata.material_preview', icon='MATERIAL')
        layout.label(text='Disconnect in SkyData to revoke access.')
        layout.label(text='Send modeling requests from SkyData.')

_classes = (SKYDATA_OT_execute_modeling, SKYDATA_OT_pair, SKYDATA_OT_start, SKYDATA_OT_stop, SKYDATA_OT_forget, SKYDATA_OT_material_preview, SKYDATA_PT_connector)

def register():
    for cls in _classes:
        bpy.utils.register_class(cls)
    bpy.types.WindowManager.skydata_pairing_code = bpy.props.StringProperty(name='Pairing code', subtype='PASSWORD', options={'SKIP_SAVE'})
    _state['registered'] = True
    _state['message'] = 'Click Start to resume, or enter a new code.'
    bpy.app.timers.register(tick, first_interval=0.5, persistent=True)

def unregister():
    _state.update(registered=False, running=False, token=None, generation=_state['generation'] + 1, busy=False)
    if bpy.app.timers.is_registered(tick):
        bpy.app.timers.unregister(tick)
    del bpy.types.WindowManager.skydata_pairing_code
    for cls in reversed(_classes):
        bpy.utils.unregister_class(cls)
