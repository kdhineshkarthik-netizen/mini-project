@echo off
title Create Desktop App Icon
cd /d "%~dp0"

echo Creating Desktop App Icon for A.V.C.C.E Store POS...
cscript //nologo "%~dp0create-desktop-shortcut.vbs"
echo.
echo Done! You can now launch the app directly from your Desktop icon.
echo Double-clicking the app icon will automatically start the Node.js server and open the app.
pause
