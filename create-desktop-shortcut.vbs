Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

Dim scriptDir, desktopPath, shortcutPath, targetPath, iconPath

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
desktopPath = WshShell.SpecialFolders("Desktop")
shortcutPath = desktopPath & "\A.V.C.C.E Store POS.lnk"
targetPath = scriptDir & "\start-silent.vbs"
iconPath = scriptDir & "\public\app_icon.ico"

' Fallbacks if primary ico doesn't exist
If Not fso.FileExists(iconPath) Then
    If fso.FileExists(scriptDir & "\public\icon.ico") Then
        iconPath = scriptDir & "\public\icon.ico"
    ElseIf fso.FileExists(scriptDir & "\public\icon-512.png") Then
        iconPath = scriptDir & "\public\icon-512.png"
    End If
End If

If fso.FileExists(shortcutPath) Then
    On Error Resume Next
    fso.DeleteFile shortcutPath, True
    On Error GoTo 0
End If

Set shortcut = WshShell.CreateShortcut(shortcutPath)
shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """" & targetPath & """"
shortcut.WorkingDirectory = scriptDir
shortcut.Description = "A.V.C.C.E Store POS & Inventory System"
If fso.FileExists(iconPath) Then
    shortcut.IconLocation = iconPath & ",0"
End If
shortcut.Save

WScript.Echo "Desktop App Icon created successfully on your Desktop!"
