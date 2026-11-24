# Motion Tools per After Effects: installazione su Windows, senza diritti di amministratore.
#
#   irm https://raw.githubusercontent.com/VinMsr/motion-tools/main/install.ps1 | iex
#
# Scarica l'ultima versione da GitHub, controlla l'impronta SHA-256, la copia nella cartella
# delle estensioni del tuo utente e abilita le estensioni non firmate (solo per il tuo utente).
$ErrorActionPreference = 'Stop'
$Repo = if ($env:MT_REPO) { $env:MT_REPO } else { 'VinMsr/motion-tools' }
$Id = 'tools.inflect.panel'
$Dest = Join-Path $env:APPDATA "Adobe\CEP\extensions\$Id"
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ("mt-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $Tmp | Out-Null
try {
  Write-Host "Cerco l'ultima versione su github.com/$Repo ..."
  $rel = Invoke-RestMethod -Headers @{ 'User-Agent' = 'MotionTools-Installer'; 'Accept' = 'application/vnd.github+json' } "https://api.github.com/repos/$Repo/releases/latest"
  $zip = $rel.assets | Where-Object { $_.name -match '^motion-tools-[0-9.]+\.zip$' } | Select-Object -First 1
  if (-not $zip) { throw "Nell'ultima release non c'e' il file motion-tools-X.Y.Z.zip." }
  $zipPath = Join-Path $Tmp 'mt.zip'
  Write-Host "Scarico $($zip.name) ..."
  Invoke-WebRequest -UseBasicParsing -Uri $zip.browser_download_url -OutFile $zipPath
  $shaAsset = $rel.assets | Where-Object { $_.name -eq ($zip.name + '.sha256') } | Select-Object -First 1
  if ($shaAsset) {
    $want = ((Invoke-WebRequest -UseBasicParsing -Uri $shaAsset.browser_download_url).Content -split '\s+')[0].ToLower()
    $have = (Get-FileHash -Algorithm SHA256 $zipPath).Hash.ToLower()
    if ($want -ne $have) { throw 'Il file scaricato non corrisponde alla release (impronta diversa).' }
    Write-Host 'File verificato.'
  }
  Expand-Archive -Path $zipPath -DestinationPath (Join-Path $Tmp 'x')
  $src = Join-Path $Tmp 'x\motion-tools'
  $manifest = Join-Path $src 'CSXS\manifest.xml'
  if (-not (Test-Path $manifest)) { throw 'Nello zip manca Motion Tools (CSXS\manifest.xml).' }
  if (-not (Select-String -Path $manifest -Pattern "ExtensionBundleId=""$Id""" -Quiet)) { throw "Lo zip contiene un'altra estensione." }
  $ver = ([regex]::Match((Get-Content $manifest -Raw), 'ExtensionBundleVersion="([0-9.]+)"')).Groups[1].Value

  Write-Host "Installo Motion Tools $ver in:`n  $Dest"
  if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
  New-Item -ItemType Directory -Force -Path (Split-Path $Dest) | Out-Null
  Copy-Item -Recurse $src $Dest
  Get-ChildItem (Join-Path $env:TEMP 'cep_cache') -Directory -Filter "*$Id*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
  foreach ($v in 9..14) { New-Item -Force -Path "HKCU:\Software\Adobe\CSXS.$v" | Out-Null; Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.$v" -Name PlayerDebugMode -Value '1' }

  Write-Host "`nFatto: Motion Tools $ver installato."
  Write-Host 'Chiudi After Effects del tutto, riaprilo e apri Finestra > Estensioni > Motion Tools.'
  Write-Host 'Da qui in poi si aggiorna da solo.'
} catch {
  Write-Host "`nNon riuscito: $($_.Exception.Message)"
} finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
