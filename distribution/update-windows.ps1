$ErrorActionPreference = 'Stop'
$repo = '__REPOSITORY__'
$extensionId = '__EXTENSION_ID__'
$base = Join-Path $env:LOCALAPPDATA 'ASINPulse'
$destination = Join-Path $base 'extension'
$sourceDirectory = Split-Path -Parent $env:ASIN_PULSE_UPDATER
$releasePage = "https://github.com/$repo/releases/latest"
$temp = Join-Path ([IO.Path]::GetTempPath()) ('ASINPulse-' + [guid]::NewGuid())
$chrome = @("${env:ProgramFiles}\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
try {
  Write-Host "ASIN Pulse - Install or Update" -ForegroundColor Cyan
  if (!$chrome -and $env:ASIN_PULSE_SETUP_TEST -ne '1') { throw 'Google Chrome was not found. Install Chrome, then run this setup again.' }
  New-Item -ItemType Directory -Force -Path $base,$temp | Out-Null
  if ((Test-Path (Join-Path $sourceDirectory 'release.json')) -and (Test-Path (Join-Path $sourceDirectory 'extension\manifest.json'))) {
    $package = $sourceDirectory
    Write-Host 'Installing the release you downloaded...'
  } else {
    Write-Host 'Downloading the latest release...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $archive = Join-Path $temp 'ASIN-Pulse.zip'
    $checksum = Join-Path $temp 'ASIN-Pulse.zip.sha256'
    try {
      Invoke-WebRequest "$releasePage/download/ASIN-Pulse.zip" -OutFile $archive -UseBasicParsing
      Invoke-WebRequest "$releasePage/download/ASIN-Pulse.zip.sha256" -OutFile $checksum -UseBasicParsing
    } catch {
      Write-Host "If this repository is private, sign in to GitHub and open $releasePage"
      throw 'Download ASIN-Pulse.zip, extract it, and run ASIN-Pulse-Setup.cmd from the extracted folder.'
    }
    $expected = ((Get-Content -LiteralPath $checksum -Raw).Trim() -split '\s+')[0]
    if ($expected -notmatch '^[a-fA-F0-9]{64}$' -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expected) { throw 'The download checksum did not match. Please try again.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
      foreach ($entry in $zip.Entries) {
        $entryPath = [IO.Path]::GetFullPath((Join-Path $temp $entry.FullName))
        if (!$entryPath.StartsWith($temp + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'The archive contained an unsafe path.' }
      }
    } finally { $zip.Dispose() }
    $package = Join-Path $temp 'package'
    Expand-Archive -LiteralPath $archive -DestinationPath $package
  }
  $incoming = Join-Path $package 'extension'
  $manifest = Get-Content (Join-Path $incoming 'manifest.json') -Raw | ConvertFrom-Json
  if ($manifest.name -ne 'ASIN Pulse — Sales & Sourcing' -or !$manifest.key) { throw 'The downloaded package is not ASIN Pulse.' }
  $firstInstall = !(Test-Path (Join-Path $destination 'manifest.json'))
  $stage = Join-Path $base 'extension-new'
  if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
  Copy-Item -LiteralPath $incoming -Destination $stage -Recurse
  $backup = Join-Path $base 'extension-backup'
  if (Test-Path $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
  if (Test-Path $destination) { Move-Item -LiteralPath $destination -Destination $backup }
  try { Move-Item -LiteralPath $stage -Destination $destination } catch {
    if (Test-Path $backup) { Move-Item -LiteralPath $backup -Destination $destination }
    throw
  }
  $installedUpdater = Join-Path $base 'ASIN-Pulse-Setup.cmd'
  $newUpdater = Join-Path $package 'ASIN-Pulse-Setup.cmd'
  if ([IO.Path]::GetFullPath($newUpdater) -ne [IO.Path]::GetFullPath($installedUpdater)) { Copy-Item -LiteralPath $newUpdater -Destination $installedUpdater -Force }
  if ($env:ASIN_PULSE_SETUP_TEST -ne '1') {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $shell = New-Object -ComObject WScript.Shell
  $updateShortcut = $shell.CreateShortcut((Join-Path $desktop 'Update ASIN Pulse.lnk'))
  $updateShortcut.TargetPath = $installedUpdater
  $updateShortcut.WorkingDirectory = $base
  $updateShortcut.Save()
  $openShortcut = $shell.CreateShortcut((Join-Path $desktop 'ASIN Pulse.lnk'))
  $openShortcut.TargetPath = $chrome
  $openShortcut.Arguments = "--app=chrome-extension://$extensionId/sourcing.html"
  $openShortcut.Save()
  }
  $guidePath = Join-Path $base 'START-HERE.html'
  $guide = Get-Content (Join-Path $package 'START-HERE.html') -Raw -Encoding UTF8
  $safeFolder = [Net.WebUtility]::HtmlEncode($destination)
  $guide.Replace('__INSTALL_FOLDER__', $safeFolder) | Set-Content -LiteralPath $guidePath -Encoding UTF8
  Write-Host "Installed $($manifest.version_name)" -ForegroundColor Green
  if ($env:ASIN_PULSE_SETUP_TEST -eq '1' -or $env:ASIN_PULSE_SETUP_NO_LAUNCH -eq '1') { Write-Host 'Installer test completed.'; exit 0 }
  if ($firstInstall) {
    Write-Host 'Chrome will open the one-time setup guide. Choose Load unpacked and select:'
    Write-Host $destination -ForegroundColor Cyan
    Start-Process -FilePath $chrome -ArgumentList @('--new-window', ('"' + $guidePath + '"'), 'chrome://extensions/')
  } else {
    Write-Host 'Reloading ASIN Pulse. Saved scans stay in your Chrome profile.'
    Start-Process -FilePath $chrome -ArgumentList "chrome-extension://$extensionId/update.html"
  }
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  if ($env:ASIN_PULSE_SETUP_TEST -ne '1') { Read-Host 'Press Enter to close' }
  exit 1
} finally {
  if (Test-Path $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
