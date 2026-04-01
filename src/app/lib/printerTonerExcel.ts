import * as XLSX from 'xlsx';

export const PRINTER_TONER_EXCEL_URL = '/suivie-incidents-imprimantes.xlsm';

export type TableData = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function countNonEmpty(row: unknown[]): number {
  return row.reduce((c, v) => c + (toText(v) ? 1 : 0), 0);
}

function normalizeColumns(columns: string[]): string[] {
  const out: string[] = [];
  const seen = new Map<string, number>();

  for (const raw of columns) {
    const base = toText(raw);
    const key = base || 'Column';
    const next = (seen.get(key) ?? 0) + 1;
    seen.set(key, next);
    out.push(next === 1 ? key : `${key} (${next})`);
  }

  return out;
}

function trimTrailingEmptyColumns(matrix: unknown[][]): unknown[][] {
  if (matrix.length === 0) return matrix;
  let maxLen = 0;
  for (const r of matrix) maxLen = Math.max(maxLen, r.length);

  let lastNonEmptyCol = -1;
  for (let col = 0; col < maxLen; col++) {
    let hasValue = false;
    for (const r of matrix) {
      if (toText(r[col]) !== '') {
        hasValue = true;
        break;
      }
    }
    if (hasValue) lastNonEmptyCol = col;
  }

  const end = Math.max(0, lastNonEmptyCol + 1);
  return matrix.map((r) => r.slice(0, end));
}

export async function loadPrinterTonerWorkbook(url: string = PRINTER_TONER_EXCEL_URL): Promise<XLSX.WorkBook> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Unable to load Excel file (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
}

export function sheetToTable(workbook: XLSX.WorkBook, sheetName: string): TableData {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return { columns: [], rows: [] };

  // Read full sheet as matrix
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as unknown[][];
  const rows = trimTrailingEmptyColumns(rawRows);

  // Find a header row: first row with at least 3 non-empty cells
  let headerIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (countNonEmpty(rows[i] ?? []) >= 3) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return { columns: [], rows: [] };

  const header = normalizeColumns((rows[headerIndex] ?? []).map((c) => toText(c)));

  const outRows: Array<Record<string, unknown>> = [];
  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (countNonEmpty(row) === 0) continue;
    const obj: Record<string, unknown> = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = row[c] ?? '';
    }
    outRows.push(obj);
  }

  return { columns: header.filter(Boolean), rows: outRows };
}

export function formatExcelCell(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toLocaleString('fr-FR');
  }

  const s = String(value);

  // Handle ISO dates that come as strings
  const ms = Date.parse(s);
  if (!Number.isNaN(ms) && /\d{4}-\d{2}-\d{2}T/.test(s)) {
    return new Date(ms).toLocaleString('fr-FR');
  }

  return s;
}
