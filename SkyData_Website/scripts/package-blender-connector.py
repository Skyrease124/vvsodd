from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import io

root = Path(__file__).resolve().parents[1]
source = root / 'pc-connector'
addon = io.BytesIO()
with ZipFile(addon, 'w', ZIP_DEFLATED) as archive:
    for path in sorted((source / 'skydata_connector').glob('*.py')):
        archive.writestr('skydata_connector/' + path.name, path.read_bytes())
target = root / 'public/downloads/skydata-blender-connector.zip'
target.parent.mkdir(parents=True, exist_ok=True)
(target.parent / 'skydata_connector_addon.zip').write_bytes(addon.getvalue())
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for name in ('Install-SkyData.cmd', 'Install-SkyData.ps1', 'install_in_blender.py', 'README.txt'):
        archive.writestr('SkyData-Blender-Connector/' + name, (source / name).read_bytes())
    archive.writestr('SkyData-Blender-Connector/skydata_connector_addon.zip', addon.getvalue())
print(target)
