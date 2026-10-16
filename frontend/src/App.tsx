import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import PdfTab from './components/PdfTab';
import ExcelTab from './components/ExcelTab';
import WordTab from './components/WordTab';
import {
  EventsOff,
  EventsOn,
  getStartupFile,
  loadFile,
  openFileDialog,
  saveFile,
  saveFileDialog,
} from './api';
import type { LoadedFile, TabHandle } from './types';

function App() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tabRef = useRef<TabHandle>(null);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus((s) => (s === msg ? null : s)), 2500);
  }, []);

  const load = useCallback(
    async (path: string) => {
      if (!path) return;
      setBusy(true);
      setError(null);
      try {
        const loaded = await loadFile(path);
        setFile(loaded);
        setStatus(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onOpen = useCallback(async () => {
    try {
      const path = await openFileDialog();
      if (path) await load(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [load]);

  const serialize = useCallback(async (): Promise<Uint8Array | null> => {
    const handle = tabRef.current;
    if (!handle) return null;
    return await Promise.resolve(handle.getBytes());
  }, []);

  const onSave = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await serialize();
      if (!bytes) return;
      await saveFile(file.path, bytes);
      flash('Đã lưu');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [file, serialize, flash]);

  const onSaveAs = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await serialize();
      if (!bytes) return;
      const path = await saveFileDialog(file.name);
      if (!path) return;
      await saveFile(path, bytes);
      flash('Đã lưu bản sao');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [file, serialize, flash]);

  useEffect(() => {
    void getStartupFile().then((p) => {
      if (p) void load(p);
    });
    const offOpen = EventsOn('open-file', (p: string) => {
      if (p) void load(p);
    }) as unknown as (() => void) | undefined;
    const offDrop = EventsOn(
      'wails:file-drop',
      (_x: number, _y: number, paths: string[]) => {
        if (Array.isArray(paths) && paths.length > 0) void load(paths[0]);
      },
    ) as unknown as (() => void) | undefined;
    return () => {
      if (typeof offOpen === 'function') offOpen();
      if (typeof offDrop === 'function') offDrop();
      EventsOff('open-file');
      EventsOff('wails:file-drop');
    };
  }, [load]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) void onSaveAs();
        else void onSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSave, onSaveAs]);

  const renderTab = () => {
    if (!file) return null;
    switch (file.kind) {
      case 'pdf':
        return <PdfTab ref={tabRef} key={file.path} bytes={file.bytes} />;
      case 'excel':
        return <ExcelTab ref={tabRef} key={file.path} bytes={file.bytes} ext={file.ext} />;
      case 'word':
        return <WordTab ref={tabRef} key={file.path} bytes={file.bytes} ext={file.ext} />;
      default:
        return (
          <div className="notice notice-error">
            Chưa hỗ trợ định dạng .{file.ext || '?'}. Hỗ trợ: PDF, Excel (.xlsx/.xls/.csv),
            Word (.docx).
          </div>
        );
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">Office Lite</div>
        <div className="file-info">
          {file ? (
            <>
              <span className="file-name" title={file.path}>
                {file.name}
              </span>
              <span className={`badge badge-${file.kind}`}>{file.kind}</span>
            </>
          ) : (
            <span className="muted">Chưa mở file nào</span>
          )}
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={onOpen} disabled={busy}>
            Mở file
          </button>
          <button className="btn" onClick={onSave} disabled={!file || busy}>
            Lưu
          </button>
          <button className="btn" onClick={onSaveAs} disabled={!file || busy}>
            Lưu thành…
          </button>
        </div>
      </header>

      {(error || status) && (
        <div className={`notice ${error ? 'notice-error' : 'notice-ok'}`}>
          {error ?? status}
          {error && (
            <button className="notice-close" onClick={() => setError(null)}>
              ✕
            </button>
          )}
        </div>
      )}

      <main className="app-body">
        {busy && <div className="loading-bar" />}
        {file ? (
          renderTab()
        ) : (
          <div className="welcome">
            <h1>Office Lite</h1>
            <p>Mở và xem/sửa file PDF, Excel và Word — không cần Microsoft Office.</p>
            <button className="btn btn-primary btn-lg" onClick={onOpen}>
              Mở file
            </button>
            <p className="muted small">Hoặc kéo-thả file vào cửa sổ này.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
