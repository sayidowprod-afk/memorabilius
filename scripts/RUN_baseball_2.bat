@echo off
cd /d "%~dp0.."
node scripts/scrape-all-years-baseball.js --slot=2 --asc %*
pause
