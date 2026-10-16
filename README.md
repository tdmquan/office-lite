# Office Lite

Ứng dụng desktop mở/xem và lưu file **PDF, Excel (.xlsx/.xls/.csv) và Word (.docx)** mà không cần cài Microsoft Office.

Xây dựng bằng [Wails v2](https://wails.io): backend **Go**, giao diện **React + TypeScript**.

## Môi trường

Chạy/ build trên **Windows 10/11**. Cần cài sẵn:

- [Go](https://go.dev/dl/) 1.21+
- [Node.js](https://nodejs.org/) 18+ (kèm npm)
- [Wails CLI v2](https://wails.io/docs/gettingstarted/installation): `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

Kiểm tra: `wails doctor`

## Chạy dev

```powershell
wails dev
```

## Build bản chạy

```powershell
wails build
```

Kết quả ở `build\bin\office-lite.exe`.

Muốn thêm "Office Lite" vào menu **Open with** của Windows (không cần quyền admin):

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-associations.ps1
```
