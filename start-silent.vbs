Set WshShell = CreateObject("WScript.Shell")
Dim scriptDir
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Run npm start silently in background
WshShell.Run "cmd /c cd /d """ & scriptDir & """ && npm start", 0, False

' Wait 2 seconds for server to initialize then open browser
WScript.Sleep 2000
WshShell.Run "http://localhost:3000"
