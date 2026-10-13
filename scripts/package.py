#!/usr/bin/env python3
"""Build a no-dependency Chrome extension release and the Windows updater."""
import hashlib,json,os,subprocess,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent.parent
out=root/'artifacts';out.mkdir(exist_ok=True)
config=json.loads((root/'distribution/config.json').read_text())
manifest=json.loads((root/'manifest.json').read_text())
revision=os.environ.get('GITHUB_SHA') or subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
manifest['version_name']=f"{manifest['version']} ({revision[:7]})"
ps=(root/'distribution/update-windows.ps1').read_text().replace('__REPOSITORY__',config['repository']).replace('__EXTENSION_ID__',config['extensionId'])
cmd='@echo off\r\nsetlocal\r\nset "ASIN_PULSE_UPDATER=%~f0"\r\npowershell.exe -NoLogo -NoProfile -Command "$s=Get-Content -LiteralPath $env:ASIN_PULSE_UPDATER -Raw; & ([ScriptBlock]::Create(($s -split \'# POWERSHELL START\\r?\\n\',2)[1]))"\r\nexit /b %errorlevel%\r\n# POWERSHELL START\r\n'+ps.replace('\n','\r\n')
(out/'ASIN-Pulse-Setup.cmd').write_bytes(cmd.encode('utf-8-sig'))
# A BOM before @echo is not valid in cmd.exe; PowerShell reads UTF-8 explicitly below.
cmd=cmd.replace(' -Raw;',' -Raw -Encoding UTF8;')
(out/'ASIN-Pulse-Setup.cmd').write_bytes(cmd.encode('utf-8'))
info=json.dumps({'version':manifest['version'],'revision':revision,'repository':config['repository']},indent=2)+'\n'
with zipfile.ZipFile(out/'ASIN-Pulse.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(root.iterdir()):
        if p.suffix in ['.js','.html','.css'] and p.is_file():z.write(p,'extension/'+p.name)
    for p in sorted((root/'icons').iterdir()):z.write(p,'extension/icons/'+p.name)
    z.writestr('extension/manifest.json',json.dumps(manifest,indent=2)+'\n')
    z.writestr('extension/build-info.json',info)
    z.writestr('release.json',info)
    z.write(out/'ASIN-Pulse-Setup.cmd','ASIN-Pulse-Setup.cmd')
    z.writestr('START-HERE.html',(root/'distribution/START-HERE.html').read_text().replace('__REPOSITORY__',config['repository']))
    z.write(root/'README.md','README.md')
(out/'ASIN-Pulse.zip.sha256').write_text(hashlib.sha256((out/'ASIN-Pulse.zip').read_bytes()).hexdigest()+'  ASIN-Pulse.zip\n')
print(out/'ASIN-Pulse.zip')
