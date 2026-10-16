import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type ValueParserParams,
} from 'ag-grid-community';
import type { TabHandle } from '../types';

ModuleRegistry.registerModules([AllCommunityModule]);

type CellValue = string | number | boolean;

interface SheetData {
  name: string;
  rows: CellValue[][];
}

interface Props {
  bytes: Uint8Array;
  ext: string;
}

function cellValue(v: unknown): CellValue {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  return String(v);
}

function sheetToAoa(ws: XLSX.WorkSheet): CellValue[][] {
  const ref = ws['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: CellValue[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: CellValue[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      row.push(cell ? cellValue(cell.v) : '');
    }
    rows.push(row);
  }
  return rows;
}

function parseCell(params: ValueParserParams): CellValue {
  const raw = params.newValue;
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number' || typeof raw === 'boolean') return raw;
  const s = String(raw);
  const trimmed = s.trim();
  if (trimmed !== '' && trimmed !== '-' && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  return s;
}

const ExcelTab = forwardRef<TabHandle, Props>(function ExcelTab({ bytes, ext }, ref) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const gridApiRef = useRef<GridApi | null>(null);
  const isCsv = ext === 'csv' || ext === 'tsv';

  useEffect(() => {
    try {
      const wb = XLSX.read(bytes, { type: 'array' });
      const parsed: SheetData[] = wb.SheetNames.map((name) => ({
        name,
        rows: sheetToAoa(wb.Sheets[name]),
      }));
      setSheets(parsed.length ? parsed : [{ name: 'Sheet1', rows: [] }]);
      setActive(0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [bytes]);

  const current = sheets[active];

  const colCount = useMemo(
    () => (current ? current.rows.reduce((m, r) => Math.max(m, r.length), 1) : 1),
    [current],
  );

  const columnDefs = useMemo<ColDef[]>(() => {
    const header = current?.rows[0] ?? [];
    const defs: ColDef[] = [];
    for (let c = 0; c < colCount; c++) {
      const cell = header[c];
      const label =
        cell !== undefined && cell !== '' ? String(cell) : XLSX.utils.encode_col(c);
      defs.push({
        field: 'c' + c,
        colId: 'c' + c,
        headerName: label,
        editable: true,
        sortable: true,
        filter: true,
        resizable: true,
        valueParser: parseCell,
      });
    }
    return defs;
  }, [current, colCount]);

  const rowData = useMemo(() => {
    if (!current) return [];
    return current.rows.slice(1).map((r, i) => {
      const obj: Record<string, unknown> = { __r: i + 1 };
      for (let c = 0; c < colCount; c++) obj['c' + c] = r[c] ?? '';
      return obj;
    });
  }, [current, colCount]);

  const onCellValueChanged = useCallback(
    (e: CellValueChangedEvent) => {
      const rowIndex = (e.data as { __r: number }).__r;
      const col = Number(e.column.getColId().slice(1));
      setSheets((prev) => {
        const copy = prev.slice();
        const sheet = copy[active];
        const rows = sheet.rows.slice();
        const row = rows[rowIndex] ? rows[rowIndex].slice() : [];
        row[col] = parseCell({ newValue: e.newValue } as ValueParserParams);
        rows[rowIndex] = row;
        copy[active] = { ...sheet, rows };
        return copy;
      });
    },
    [active],
  );

  const addRow = useCallback(() => {
    setSheets((prev) => {
      const copy = prev.slice();
      const sheet = copy[active];
      const rows = sheet.rows.slice();
      rows.push(new Array(colCount).fill(''));
      copy[active] = { ...sheet, rows };
      return copy;
    });
  }, [active, colCount]);

  const deleteSelected = useCallback(() => {
    const api = gridApiRef.current;
    if (!api) return;
    const selected = new Set<number>();
    api.getSelectedNodes().forEach((n) => {
      const r = (n.data as { __r?: number } | undefined)?.__r;
      if (typeof r === 'number') selected.add(r);
    });
    if (selected.size === 0) return;
    setSheets((prev) => {
      const copy = prev.slice();
      const sheet = copy[active];
      const rows = sheet.rows.filter((_, idx) => !selected.has(idx));
      copy[active] = { ...sheet, rows };
      return copy;
    });
  }, [active]);

  const getBytes = useCallback((): Uint8Array => {
    if (isCsv) {
      const rows = sheets[0]?.rows ?? [];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      return new TextEncoder().encode(csv);
    }
    const wb = XLSX.utils.book_new();
    const used = new Set<string>();
    for (const s of sheets) {
      let name = (s.name || 'Sheet').slice(0, 31);
      let n = 1;
      while (used.has(name)) {
        name = `${name.slice(0, 28)}_${n++}`;
      }
      used.add(name);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), name);
    }
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new Uint8Array(out as ArrayBuffer);
  }, [sheets, isCsv]);

  useImperativeHandle(ref, () => ({ getBytes }), [getBytes]);

  if (error) {
    return <div className="notice notice-error">Không mở được file Excel: {error}</div>;
  }

  return (
    <div className="excel-tab">
      <div className="toolbar toolbar-sub">
        <input
          className="search-input"
          type="search"
          placeholder="Tìm kiếm nhanh…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="divider" />
        <button className="btn" onClick={addRow}>
          + Thêm dòng
        </button>
        <button className="btn" onClick={deleteSelected}>
          Xóa dòng chọn
        </button>
        <span className="muted small">
          {rowData.length} dòng · {colCount} cột — bấm tiêu đề cột để lọc/sắp xếp
        </span>
      </div>

      <div className="grid-wrap ag-theme-quartz">
        <AgGridReact
          theme={themeQuartz}
          columnDefs={columnDefs}
          rowData={rowData}
          getRowId={(p) => String((p.data as { __r: number }).__r)}
          defaultColDef={{ editable: true, sortable: true, filter: true, resizable: true }}
          quickFilterText={search}
          onCellValueChanged={onCellValueChanged}
          onGridReady={(p) => {
            gridApiRef.current = p.api;
          }}
          rowSelection="multiple"
          suppressRowClickSelection
          enableCellTextSelection
          undoRedoCellEditing
          animateRows
        />
      </div>

      {sheets.length > 1 && (
        <div className="sheet-tabs">
          {sheets.map((s, i) => (
            <button
              key={s.name + i}
              className={`sheet-tab${i === active ? ' active' : ''}`}
              onClick={() => setActive(i)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default ExcelTab;
