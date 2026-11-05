@echo off
rem Starts the Litany Reader and opens it in your browser.
cd /d "%~dp0"
start "" http://localhost:8484
node server.js
