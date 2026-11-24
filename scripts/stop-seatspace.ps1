$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$manifestPath = Join-Path $root 'tmp\seatspace-processes.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { Write-Host 'No SeatSpace-owned server process manifest was found; nothing was stopped.'; exit 0 }
$entries = @(Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json)
foreach ($entry in $entries) {
  try {
    $process = Get-Process -Id ([int]$entry.processId) -ErrorAction Stop
    $path = $process.Path
    $startedAt = $process.StartTime.ToUniversalTime()
    $expectedAt = [DateTime]::Parse($entry.startUtc).ToUniversalTime()
    if ($path -and [IO.Path]::GetFullPath($path) -ieq [IO.Path]::GetFullPath($entry.executable) -and [Math]::Abs(($startedAt - $expectedAt).TotalSeconds) -lt 3) {
      Stop-Process -Id $process.Id -ErrorAction Stop
      Write-Host "Stopped SeatSpace $($entry.label) (PID $($entry.processId))."
    } else { Write-Warning "Skipped PID $($entry.processId): it no longer matches the recorded SeatSpace process." }
  } catch { Write-Host "SeatSpace $($entry.label) was already stopped or could not be verified." }
}
Remove-Item -LiteralPath $manifestPath -Force
