package main

import (
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/options"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the backend struct exposed to the frontend.
type App struct {
	ctx         context.Context
	startupFile string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.startupFile = firstFileArg(os.Args[1:])
}

// firstFileArg returns the first argument that points to an existing file.
// Used to support Windows "Open with" / double-click file association.
func firstFileArg(args []string) string {
	for _, arg := range args {
		arg = strings.TrimSpace(arg)
		if arg == "" || strings.HasPrefix(arg, "-") || strings.HasPrefix(arg, "/") {
			continue
		}
		if st, err := os.Stat(arg); err == nil && !st.IsDir() {
			return arg
		}
	}
	return ""
}

// GetStartupFile returns the path supplied via command line, or "" if none.
func (a *App) GetStartupFile() string {
	return a.startupFile
}

// ReadFileBase64 reads a file and returns its content encoded as base64.
func (a *App) ReadFileBase64(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(data), nil
}

// WriteFileBase64 decodes base64 content and writes it to path.
func (a *App) WriteFileBase64(path string, contentBase64 string) error {
	data, err := base64.StdEncoding.DecodeString(contentBase64)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

// FileName returns the base name of the given path.
func (a *App) FileName(path string) string {
	return filepath.Base(path)
}

// FileExists reports whether the path exists and is a file.
func (a *App) FileExists(path string) bool {
	st, err := os.Stat(path)
	return err == nil && !st.IsDir()
}

// OpenFileDialog shows a native open dialog with file type filters.
func (a *App) OpenFileDialog() (string, error) {
	return wailsruntime.OpenFileDialog(a.ctx, wailsruntime.OpenDialogOptions{
		Title: "Mở file",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "Tất cả file hỗ trợ", Pattern: "*.pdf;*.xlsx;*.xls;*.csv;*.docx;*.doc"},
			{DisplayName: "PDF (*.pdf)", Pattern: "*.pdf"},
			{DisplayName: "Excel (*.xlsx;*.xls;*.csv)", Pattern: "*.xlsx;*.xls;*.csv"},
			{DisplayName: "Word (*.docx;*.doc)", Pattern: "*.docx;*.doc"},
			{DisplayName: "Tất cả file (*.*)", Pattern: "*.*"},
		},
	})
}

// SaveFileDialog shows a native save dialog.
func (a *App) SaveFileDialog(defaultName string) (string, error) {
	return wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		Title:           "Lưu file",
		DefaultFilename: defaultName,
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "Tất cả file (*.*)", Pattern: "*.*"},
		},
	})
}

// handleSecondInstance is called when the app is launched again while running
// (for example when the user opens another file). It forwards the new file path
// to the running instance.
func (a *App) handleSecondInstance(data options.SecondInstanceData) {
	if a.ctx == nil {
		return
	}
	path := firstFileArg(data.Args)
	if path == "" {
		return
	}
	wailsruntime.WindowUnminimise(a.ctx)
	wailsruntime.WindowShow(a.ctx)
	wailsruntime.EventsEmit(a.ctx, "open-file", path)
}
