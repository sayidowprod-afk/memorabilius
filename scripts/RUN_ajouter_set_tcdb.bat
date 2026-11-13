@echo off
rem Ajoute un set TCDB au site : colle l'adresse du set, le programme lit la checklist et l'importe apres ta confirmation.
rem Double-clic pour lancer. Chrome s'ouvre (laisse-le ouvert) : si TCDB demande un captcha, resous-le dans cette fenetre.
cd /d "%~dp0.."
:debut
echo.
node scripts/ajouter-set-tcdb.js
echo.
set /p ENCORE=Ajouter un autre set ? (o/N)
if /i "%ENCORE%"=="o" goto debut
pause
