"""Run by the bundled Windows launcher in a new Blender window."""
from pathlib import Path
import bpy

if bpy.app.version < (4, 2, 0):
    raise RuntimeError('SkyData requires Blender 4.2 or newer. Use the manual installation after updating Blender.')

package = Path(__file__).resolve().parent / 'skydata_connector_addon.zip'
bpy.ops.preferences.addon_install(filepath=str(package), overwrite=True)
bpy.ops.preferences.addon_enable(module='skydata_connector')
bpy.ops.wm.save_userpref()
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.show_region_ui = True
print('SkyData installed. In the 3D View sidebar, click SkyData and enter your pairing code.')
bpy.context.window_manager.popup_menu(
    lambda self, context: self.layout.label(text='Open the SkyData tab in the 3D View sidebar (N) to pair.'),
    title='SkyData connector installed', icon='INFO')
