@echo off
cd /d "%~dp0.."
node scripts/scrape-all-years-soccer-international.js --slot=2 --asc %*
pause
