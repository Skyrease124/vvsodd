$ErrorActionPreference = 'Stop'
Write-Host 'SkyData Blender Connector 1.1'
Write-Host 'This opens a NEW Blender window and installs the add-on. Your existing Blender window is left open.'
$taskCandidates = @()
$taskCommand = Get-Command blender.exe -ErrorAction SilentlyContinue
if ($taskCommand) { $taskCandidates += $taskCommand.Source }
foreach ($taskRoot in @("$env:ProgramFiles\Blender Foundation", "$env:LOCALAPPDATA\Programs\Blender Foundation")) {
    if (Test-Path -LiteralPath $taskRoot) {
        $taskCandidates += Get-ChildItem -LiteralPath $taskRoot -Filter blender.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
    }
}
$taskCandidates = @($taskCandidates | Sort-Object -Unique)
if ($taskCandidates.Count -eq 1) {
    $taskBlender = $taskCandidates[0]
} else {
    if ($taskCandidates.Count -gt 1) { Write-Host 'Installed Blender versions:'; $taskCandidates | ForEach-Object { Write-Host $_ } }
    $taskBlender = (Read-Host 'Paste the full path to blender.exe (Blender 4.2 or newer)').Trim().Trim('"')
}
if (-not (Test-Path -LiteralPath $taskBlender -PathType Leaf) -or (Split-Path $taskBlender -Leaf) -ne 'blender.exe') {
    throw 'Blender was not found. Install Blender 4.2 or newer, then run this installer again.'
}
$taskScript = Join-Path $PSScriptRoot 'install_in_blender.py'
$taskArguments = '--python "' + $taskScript + '"'
Start-Process -FilePath $taskBlender -ArgumentList $taskArguments
Write-Host 'In the new Blender window: press N in the 3D View, select SkyData, and paste a fresh pairing code.'
