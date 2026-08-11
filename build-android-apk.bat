@echo off
title College Store Student App - Android APK Builder
cls
echo =======================================================
echo   A.V.C.C.E STORE - STUDENT MOBILE APK GENERATOR
echo =======================================================
echo.
echo Select your APK Creation Method:
echo.
echo [1] Expo Cloud APK Build (React Native Native .apk)
echo [2] PWABuilder Web-to-APK Generator (Instant 1-Click)
echo [3] View WebAPK Instant Mobile Installation Guide
echo.
set /p opt="Enter your choice (1-3): "

if "%opt%"=="1" (
    echo.
    echo Navigating to mobile_app directory...
    cd mobile_app
    echo Installing Expo CLI and dependencies...
    call npm install
    echo.
    echo Launching EAS Build for Android Preview APK...
    call npx eas-cli build -p android --profile preview
    pause
    exit
)

if "%opt%"=="2" (
    echo.
    echo Opening PWABuilder in your web browser...
    start https://www.pwabuilder.com
    echo.
    echo INSTRUCTIONS:
    echo 1. Enter your live server URL (e.g. http://your-ip:3000 or ngrok url)
    echo 2. Click "Package for Android"
    echo 3. Download the generated APK file!
    pause
    exit
)

if "%opt%"=="3" (
    cls
    echo =======================================================
    echo   INSTANT Android WebAPK INSTALLATION GUIDE
    echo =======================================================
    echo.
    echo 1. Connect your Android phone to the same Wi-Fi as this PC.
    echo 2. Open Chrome browser on your Android phone.
    echo 3. Type your PC's IP address: http://YOUR_PC_IP:3000
    echo 4. Tap the "Install App" button at the top header or browser menu.
    echo 5. Android will automatically install the app as a native APK icon!
    echo.
    pause
    exit
)

pause
