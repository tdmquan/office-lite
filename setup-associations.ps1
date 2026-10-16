# Đăng ký "Office Lite" vào menu "Open with" của Windows (phạm vi HKCU, không cần quyền admin).
# Cách dùng (PowerShell):
#   cd D:\Project\office-lite
#   powershell -ExecutionPolicy Bypass -File .\setup-associations.ps1
# Gỡ đăng ký:
#   powershell -ExecutionPolicy Bypass -File .\setup-associations.ps1 -Unregister

param(
    [string]$ExePath = (Join-Path $PSScriptRoot 'build\bin\office-lite.exe'),
    [switch]$Unregister
)

$ErrorActionPreference = 'Stop'

$appName = 'Office Lite'
$progId  = 'OfficeLite.Document'
$exeName = 'office-lite.exe'
$exts    = @('.pdf', '.xlsx', '.xls', '.xlsm', '.csv', '.docx', '.doc')

$progRoot = "HKCU:\Software\Classes\$progId"
$appRoot  = "HKCU:\Software\Classes\Applications\$exeName"

if ($Unregister) {
    foreach ($k in @($progRoot, $appRoot)) {
        if (Test-Path $k) { Remove-Item -Recurse -Force $k }
    }
    foreach ($ext in $exts) {
        $k = "HKCU:\Software\Classes\$ext\OpenWithProgids"
        if (Test-Path $k) { Remove-ItemProperty -Path $k -Name $progId -ErrorAction SilentlyContinue }
    }
    Write-Host "Đã gỡ đăng ký '$appName'."
    exit 0
}

if (-not (Test-Path $ExePath)) {
    Write-Error "Không tìm thấy '$ExePath'. Hãy build trước bằng:  wails build"
}
$ExePath = (Resolve-Path $ExePath).Path

# 1) ProgID: mô tả + icon + lệnh mở
New-Item -Force $progRoot | Out-Null
Set-Item -Path $progRoot -Value "$appName Document"
New-Item -Force "$progRoot\DefaultIcon" | Out-Null
Set-Item -Path "$progRoot\DefaultIcon" -Value "$ExePath,0"
New-Item -Force "$progRoot\shell\open\command" | Out-Null
Set-Item -Path "$progRoot\shell\open\command" -Value "`"$ExePath`" `"%1`""

# 2) Applications\office-lite.exe để xuất hiện trong hộp thoại "Open with"
New-Item -Force "$appRoot\shell\open\command" | Out-Null
Set-Item -Path "$appRoot\shell\open\command" -Value "`"$ExePath`" `"%1`""
New-Item -Force "$appRoot\SupportedTypes" | Out-Null
New-ItemProperty -Path $appRoot -Name 'FriendlyAppName' -Value $appName -Force | Out-Null

# 3) Gợi ý app cho từng phần mở rộng
foreach ($ext in $exts) {
    $k = "HKCU:\Software\Classes\$ext\OpenWithProgids"
    New-Item -Force $k | Out-Null
    New-ItemProperty -Path $k -Name $progId -PropertyType None -Value '' -Force | Out-Null
    New-ItemProperty -Path "$appRoot\SupportedTypes" -Name $ext -PropertyType None -Value '' -Force | Out-Null
}

Write-Host "Đã đăng ký '$appName' cho: $($exts -join ', ')"
Write-Host "Chuột phải file -> Open with -> Choose another app -> chọn '$appName' (tick 'Always use')."
