Set oShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
repoRoot = fso.GetParentFolderName(WScript.ScriptFullName)
exePath = repoRoot & "\src-tauri\target\release\sync.exe"
oShell.Run """" & exePath & """", 0, False
