@echo off
title A.V.C.C.E Store POS Server (Offline)
cd /d "%~dp0"
echo Starting POS Billing & Inventory Server...
start "" http://localhost:3000
npm start
