<#
.SYNOPSIS
    Healthcare Platform - Stop Running Services
.DESCRIPTION
    Safely terminates any backend (port 8000) or frontend (port 5173) processes.
#>

Write-Host "==============================================================================" -ForegroundColor Yellow
Write-Host "                Stopping Healthcare Platform Services..." -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Yellow

$connections = Get-NetTCPConnection -LocalPort 8000, 5173 -State Listen -ErrorAction SilentlyContinue

if ($connections) {
    $pids = $connections.OwningProcess | Sort-Object -Unique
    foreach ($procId in $pids) {
        try {
            $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
            if ($p) {
                Write-Host "Stopping process $($p.ProcessName) (PID: ${procId})..." -ForegroundColor White
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Write-Host "Failed to stop PID ${procId}: $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "No services were listening on ports 8000 or 5173." -ForegroundColor White
}

Write-Host "Healthcare Platform services stopped." -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Yellow
