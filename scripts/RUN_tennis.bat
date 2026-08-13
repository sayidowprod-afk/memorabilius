@echo off
cd /d "%~dp0.."
node scripts/scrape-all-years-tennis.js %*
pause
