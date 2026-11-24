$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$manifestPath = Join-Path $root 'tmp\seatspace-processes.json'
$logDir = Join-Path $root 'tmp\seatspace-logs'
$nodePath = 'C:\Program Files\nodejs\node.exe'
$apiPort = 4000
$webPort = 5181

if (-not (Test-Path -LiteralPath $nodePath)) {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($node) { $nodePath = $node.Source } else { throw 'Node.js was not found. Install Node.js, then run start_seatspace.bat again.' }
}
$nodeVersionText = (& $nodePath --version 2>$null)
if ($nodeVersionText -notmatch '^v(?<major>\d+)\.(?<minor>\d+)\.') { throw 'Could not read the installed Node.js version.' }
$nodeMajor = [int]$Matches.major
$nodeMinor = [int]$Matches.minor
if (-not (($nodeMajor -eq 20 -and $nodeMinor -ge 19) -or ($nodeMajor -eq 22 -and $nodeMinor -ge 12) -or $nodeMajor -gt 22)) {
  throw "Node.js $nodeVersionText is too old for this project. Install Node.js 20.19+ or 22.12+."
}
if (-not (Test-Path -LiteralPath (Join-Path $root '.env'))) { throw 'The project .env file is missing. Restore your local configuration before starting.' }
if (-not (Test-Path -LiteralPath (Join-Path $root 'node_modules\vite\bin\vite.js'))) { throw 'Frontend dependencies are missing. Run npm install in the project folder.' }
if (-not (Test-Path -LiteralPath (Join-Path $root 'server\index.js'))) { throw 'The existing SeatSpace backend entry point was not found.' }
$pg = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Where-Object Status -eq 'Running' | Select-Object -First 1
if (-not $pg) { throw 'PostgreSQL is not running. Start the existing PostgreSQL Windows service, then retry. No database changes were made.' }

New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$started = @()
function Test-Http($url) {
  try { $r = Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing; return [int]$r.StatusCode -eq 200 }
  catch { return $false }
}
function Start-IfMissing($label, $port, $url, $entry, $extraArgs) {
  if (Test-Http $url) { Write-Host "$label already responds at $url"; return }
  $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listener) { throw "$label port $port is already occupied, but its health URL did not respond. Close the conflicting app or change the project port." }
  $out = Join-Path $logDir "$label.out.log"
  $err = Join-Path $logDir "$label.err.log"
  $process = Start-Process -FilePath $nodePath -ArgumentList (@($entry) + $extraArgs) -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
  Start-Sleep -Seconds 2
  if ($process.HasExited) { throw "$label stopped during startup. See $err" }
  $script:started += [pscustomobject]@{ label=$label; processId=$process.Id; executable=$nodePath; startUtc=$process.StartTime.ToUniversalTime().ToString('o') }
  $script:started | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8
  Write-Host "$label started (PID $($process.Id)); checking $url ..."
  for ($i=0; $i -lt 20; $i++) { if (Test-Http $url) { Write-Host "$label is ready at $url"; return }; Start-Sleep -Seconds 1 }
  $tail = if (Test-Path $err) { (Get-Content -LiteralPath $err -Tail 12) -join "`n" } else { 'No error log was written.' }
  throw "$label did not become ready. Recent log:`n$tail"
}

Start-IfMissing 'backend' $apiPort "http://127.0.0.1:$apiPort/api/health" 'server\index.js' @()
Start-IfMissing 'frontend' $webPort "http://127.0.0.1:$webPort/" 'node_modules\vite\bin\vite.js' @('--host','127.0.0.1','--port',"$webPort",'--strictPort')
if ($started.Count -gt 0) { $started | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8 }
Write-Host 'SeatSpace is available at http://127.0.0.1:5181/'
Write-Host 'Backend health: http://127.0.0.1:4000/api/health'
Write-Host 'MongoDB is optional for audit events; PostgreSQL is required for bookings.'
