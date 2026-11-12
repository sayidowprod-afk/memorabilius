@echo off
rem Importe les setlists recentes (annee en cours et precedente) de checklistinsider.com pour tous les sports, y compris les cartes non sportives.
rem Ne traite que les sets ABSENTS du site (--new-only) : un set deja present est ignore. Jamais destructif.
rem Pour voir ce qui serait ajoute SANS rien ecrire :  RUN_nouveaux_sets.bat --dry-run
cd /d "%~dp0.."
for /f %%y in ('powershell -nologo -command "(Get-Date).Year"') do set YEAR=%%y
set /a PREV=%YEAR%-1
echo === Nouveaux sets : saisons %PREV% et %YEAR% ===

for %%s in (basketball football baseball hockey soccer racing wrestling mma tennis) do (
  echo.
  echo --- %%s ---
  node scripts/scrape-checklistinsider.js --sport=%%s --from=%YEAR% --to=%PREV% --new-only %*
)

echo.
echo --- non-sport ---
node scripts/scrape-checklistinsider.js --season-url=https://www.checklistinsider.com/non-sport-cards/%YEAR%-non-sport-cards --new-only %*
node scripts/scrape-checklistinsider.js --season-url=https://www.checklistinsider.com/non-sport-cards/%PREV%-non-sport-cards --new-only %*

echo.
echo Termine.
pause
