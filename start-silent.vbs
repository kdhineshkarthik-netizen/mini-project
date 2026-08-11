Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

Dim scriptDir
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check if Node server is listening on port 3000
Function IsServerRunning()
    Dim execObj
    Set execObj = WshShell.Exec("cmd /c netstat -ano | findstr :3000")
    IsServerRunning = Not execObj.StdOut.AtEndOfStream
End Function

' If server is not running, start node server.js silently in background
If Not IsServerRunning() Then
    WshShell.Run "cmd /c cd /d """ & scriptDir & """ && node server.js", 0, False
    
    ' Wait until server port 3000 is listening (max 10 seconds)
    Dim attempts
    attempts = 0
    Do While Not IsServerRunning() And attempts < 20
        WScript.Sleep 500
        attempts = attempts + 1
    Loop
End If

' Open application in default web browser
WshShell.Run "http://localhost:3000"

