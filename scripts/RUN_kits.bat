@echo off
REM Genere les tenues supplementaires des equipes (exterieur, alternative, legendaire + Bobcats / SuperSonics) puis met a jour live.json.
REM Reprend automatiquement la ou ca s'est arrete (scripts/.bobble-checkpoint.json, cle kits).
cd /d E:\memorabilius
set BOBBLE_WORK=E:/bobble-work
if not exist E:\bobble-work mkdir E:\bobble-work

curl -s -m 2 http://127.0.0.1:8188/system_stats >nul 2>&1 || start "ComfyUI" /min cmd /c "cd /d F:\ComfyUI\ComfyUI_windows_portable && .\python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build"

echo Attente de ComfyUI...
:attente
timeout /t 3 /nobreak >nul
curl -s -m 2 http://127.0.0.1:8188/system_stats >nul 2>&1 || goto attente

node scripts\bobble-kits.mjs PHI
node scripts\bobble-live.mjs
node scripts\bobble-kits.mjs
node scripts\bobble-live.mjs
echo.
echo Termine (ou arrete). Relancer ce fichier reprend a l'element suivant.

