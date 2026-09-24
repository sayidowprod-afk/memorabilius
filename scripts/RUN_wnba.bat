@echo off
set SHOW_BROWSER=1
cd /d "%~dp0.."
node scripts/scrape-all-years-wnba.js %*
pause
