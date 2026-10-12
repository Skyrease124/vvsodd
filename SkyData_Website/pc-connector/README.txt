SkyData Blender Connector 1.4 - Windows / Blender 4.2 or newer

1. Download the ZIP on your PC, right-click it and choose Extract All.
2. In the extracted folder, double-click Install-SkyData.cmd.
   This opens a new Blender window. It does not close your existing window.
   If Blender is not detected, paste the full path to blender.exe.
3. In Blender's 3D View press N, then select the SkyData sidebar tab.
4. On SkyData, sign into your OWNER account and open + > Connect Blender.
   Generate a fresh pairing code, paste it into Blender and click Pair this PC.
   SkyData should show PC connected / Blender available after its next refresh.

No separate Python installation is needed. Blender must remain open and the PC
must be awake and online. Status and command checks run every 5 seconds. On reopening
Blender, click Start connection to resume. No network connection starts simply
by enabling the add-on. Close other connected Blender instances to avoid overlap.

Manual install: Blender > Edit > Preferences > Add-ons > menu > Install from Disk.
Select skydata_connector_addon.zip and enable SkyData PC Connector. Then press N
in the 3D View and select SkyData. This also works for portable Blender installs.

This release pairs your PC, reads scene metadata, and executes modeling prompts
from the Connect Blender page. Type a request such as "Build a wooden chair" and
click Send to Blender. NVIDIA translates the prompt into a bounded modeling plan.
Supported: custom meshes, curved tubular parts, cubes, spheres, cylinders,
cones, toruses, planes, grouped models, position/rotation/scale, rounded bevels,
smooth shading, subdivision, procedural wood grain and fabric, metal and glass.
Click Show materials in the SkyData tab to see textures in Material Preview. No arbitrary Python is executed.
Existing objects are preserved unless an instruction asks to transform or color
them. Deletions, imports, screenshots and rendering are not supported.
Use Read scene before requesting edits to existing objects. Keep Blender in
Object Mode. Commands check exact names and roll back if an operation fails.
Successful commands appear as SkyData modeling command in Blender's undo history.
If a request times out, inspect Blender before repeating it: it may have run but
its result did not arrive. Commands are claimed once to prevent duplicate edits.

Updating: install the new add-on ZIP, save your work and restart Blender.
Click Start connection to resume your existing pairing. If Windows could not
save your credential, generate a fresh code and pair again.

The add-on ZIP is also available directly on the Connect Blender page: do NOT
extract that direct ZIP before installing it in Blender.

Credentials are protected using Windows user-scoped DPAPI, outside your .blend
files. Disconnect PC in SkyData revokes the credential. Forget local connection
only removes this PC's saved credential; it does not revoke server access.
On non-Windows systems pairing works for the current Blender session only.
Only outbound HTTPS to your SkyData site is used. No inbound port is opened.

If pairing fails: generate a new code (codes expire after 10 minutes and are
single-use), check internet access, then retry. If Windows blocks the launcher,
use the manual add-on installation above rather than disabling security settings.
The Windows installer and Blender UI still require testing on your actual PC.
