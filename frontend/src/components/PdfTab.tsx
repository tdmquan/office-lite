import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  EventBus,
  PDFFindController,
  PDFLinkService,
  PDFViewer,
} from 'pdfjs-dist/web/pdf_viewer.mjs';
import 'pdfjs-dist/web/pdf_viewer.css';
import type { TabHandle } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const CMAP_URL = new URL('pdfjs/cmaps/', document.baseURI).href;
const FONT_URL = new URL('pdfjs/standard_fonts/', document.baseURI).href;

interface Props {
  bytes: Uint8Array;
}

interface FindMatches {
  current: number;
  total: number;
}

const PdfTab = forwardRef<TabHandle, Props>(function PdfTab({ bytes }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const eventBusRef = useRef<EventBus | null>(null);
  const viewerInstanceRef = useRef<PDFViewer | null>(null);
  const findInputRef = useRef<HTMLInputElement>(null);

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zip, setZip] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<FindMatches>({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({ getBytes: () => bytes }), [bytes]);

  const dispatchFind = useCallback(
    (type: string, findPrevious: boolean, q: string) => {
      const eventBus = eventBusRef.current;
      if (!eventBus) return;
      eventBus.dispatch('find', {
        source: undefined,
        type,
        query: q,
        caseSensitive: false,
        entireWord: false,
        highlightAll: true,
        matchDiacritics: false,
        findPrevious,
      });
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    const viewer = viewerRef.current;
    if (!container || !viewer) return;

    setError(null);
    const eventBus = new EventBus();
    eventBusRef.current = eventBus;
    const linkService = new PDFLinkService({ eventBus });
    const findController = new PDFFindController({ linkService, eventBus });
    const pdfViewer = new PDFViewer({
      container,
      viewer,
      eventBus,
      linkService,
      findController,
    });
    viewerInstanceRef.current = pdfViewer;
    linkService.setViewer(pdfViewer);

    const onPagesInit = () => {
      pdfViewer.currentScaleValue = 'page-width';
      setNumPages(pdfViewer.pagesCount);
      setZip(true);
      setTimeout(() => setZip(false), 400);
    };
    const onPageChanging = (e: { pageNumber: number }) => setPage(e.pageNumber);
    const onMatches = (e: { matchesCount?: FindMatches }) => {
      if (e.matchesCount) setMatches(e.matchesCount);
    };

    eventBus.on('pagesinit', onPagesInit);
    eventBus.on('pagechanging', onPageChanging);
    eventBus.on('updatefindmatchescount', onMatches);
    eventBus.on('updatefindcontrolstate', onMatches);

    const loadingTask = pdfjsLib.getDocument({
      data: bytes.slice(),
      cMapUrl: CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: FONT_URL,
    });

    loadingTask.promise
      .then((doc) => {
        pdfViewer.setDocument(doc);
        linkService.setDocument(doc, null);
        setNumPages(doc.numPages);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      eventBus.off('pagesinit', onPagesInit);
      eventBus.off('pagechanging', onPageChanging);
      eventBus.off('updatefindmatchescount', onMatches);
      eventBus.off('updatefindcontrolstate', onMatches);
      try {
        pdfViewer.setDocument(null as never);
      } catch {
        /* ignore */
      }
      loadingTask.destroy();
      eventBusRef.current = null;
      viewerInstanceRef.current = null;
    };
  }, [bytes]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen(true);
        setTimeout(() => findInputRef.current?.select(), 0);
      } else if (e.key === 'Escape') {
        setFindOpen(false);
        dispatchFind('', false, '');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatchFind]);

  const onQueryChange = (value: string) => {
    setQuery(value);
    dispatchFind('', false, value);
  };

  const goToPage = (p: number) => {
    const v = viewerInstanceRef.current;
    if (!v || numPages === 0) return;
    v.currentPageNumber = Math.min(Math.max(1, p), numPages);
  };

  const zoomBy = (factor: number) => {
    const v = viewerInstanceRef.current;
    if (!v) return;
    const next = Math.min(5, Math.max(0.25, v.currentScale * factor));
    v.currentScale = next;
  };

  const fitWidth = () => {
    const v = viewerInstanceRef.current;
    if (v) v.currentScaleValue = 'page-width';
  };

  return (
    <div className="pdf-tab">
      <div className="toolbar toolbar-sub">
        <button className="btn" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
          ‹ Trước
        </button>
        <span className="page-indicator">
          <input
            className="page-input"
            type="number"
            min={1}
            max={numPages || 1}
            value={page}
            onChange={(e) => goToPage(Number(e.target.value))}
          />
          / {numPages || '…'}
        </span>
        <button
          className="btn"
          onClick={() => goToPage(page + 1)}
          disabled={numPages > 0 && page >= numPages}
        >
          Sau ›
        </button>
        <span className="divider" />
        <button className="btn" onClick={() => zoomBy(0.9)}>
          −
        </button>
        <button className="btn" onClick={() => zoomBy(1.1)}>
          +
        </button>
        <button className="btn" onClick={fitWidth}>
          Vừa chiều rộng
        </button>
        <span className="divider" />
        <button
          className="btn"
          onClick={() => {
            setFindOpen(true);
            setTimeout(() => findInputRef.current?.select(), 0);
          }}
        >
          Tìm (Ctrl+F)
        </button>
      </div>

      {findOpen && (
        <div className="findbar">
          <input
            ref={findInputRef}
            className="find-input"
            type="text"
            placeholder="Tìm trong PDF…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                dispatchFind('again', e.shiftKey, query);
              } else if (e.key === 'Escape') {
                setFindOpen(false);
                dispatchFind('', false, '');
              }
            }}
          />
          <span className="find-count">
            {matches.total > 0 ? `${matches.current}/${matches.total}` : '0/0'}
          </span>
          <button className="btn" onClick={() => dispatchFind('again', true, query)}>
            ↑
          </button>
          <button className="btn" onClick={() => dispatchFind('again', false, query)}>
            ↓
          </button>
          <button
            className="btn"
            onClick={() => {
              setFindOpen(false);
              dispatchFind('', false, '');
            }}
          >
            ✕
          </button>
        </div>
      )}

      {error && <div className="notice notice-error">Không mở được PDF: {error}</div>}

      <div ref={containerRef} className={`pdf-container${zip ? ' zooming' : ''}`}>
        <div ref={viewerRef} className="pdfViewer" />
      </div>
    </div>
  );
});

export default PdfTab;
