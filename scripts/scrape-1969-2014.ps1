Get-Content .env.local | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.+)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2])
    }
}

$years = 2014..1969

foreach ($year in $years) {
    Write-Host ''
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host "  Annee : $year" -ForegroundColor Yellow
    Write-Host '========================================' -ForegroundColor Cyan

    $attempt = 0
    $success = $false

    while ($attempt -lt 2 -and -not $success) {
        $attempt++
        if ($attempt -gt 1) {
            Write-Host "  Retry $attempt/2 dans 60s..." -ForegroundColor Yellow
            Start-Sleep -Seconds 60
        }

        node scripts/scrape-tcdb-nba.js --year=$year --major-only

        if ($LASTEXITCODE -eq 0) {
            $success = $true
            Write-Host "OK : $year termine" -ForegroundColor Green
        } else {
            Write-Host "ERREUR annee $year (tentative $attempt)" -ForegroundColor Red
        }
    }

    if (-not $success) {
        Write-Host "ECHEC annee $year apres 2 tentatives - on passe" -ForegroundColor Red
    }

    # Pause entre chaque annee pour laisser Chrome se reposer
    Write-Host '  Pause 30s avant la prochaine annee...' -ForegroundColor Gray
    Start-Sleep -Seconds 30
}

Write-Host ''
Write-Host 'Scraping termine 2014 vers 1969' -ForegroundColor Green
