@echo off
cd /d "%~dp0.."
node scripts/scrape-all-years-wnba.js %*
pause
