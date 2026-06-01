import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const importDir = path.join(repoRoot, 'database', 'import');
const outputDir = path.join(repoRoot, 'recovered');
const outputFile = path.join(outputDir, 'old-table-data.json');

async function main() {
  await mkdir(outputDir, { recursive: true });

  const workbookFiles = [
    'suivie incidents imprimantes.xlsm',
    'MA6-Stock Inventory.xlsx',
    'Inventory-MA6.xlsx',
  ].map((name) => path.join(importDir, name));

  const recovered = [];

  for (const filePath of workbookFiles) {
    const workbook = xlsx.readFile(filePath, { cellDates: true });
    const sheets = [];
    const restoredWorkbook = xlsx.utils.book_new();

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: null, blankrows: false, raw: false });
      sheets.push({
        name: sheetName,
        rowCount: rows.length,
        rows,
      });

      const restoredSheet = xlsx.utils.json_to_sheet(rows, { skipHeader: false });
      xlsx.utils.book_append_sheet(restoredWorkbook, restoredSheet, sheetName.slice(0, 31));
    }

    const restoredXlsxPath = path.join(outputDir, `${path.parse(filePath).name}.xlsx`);
    xlsx.writeFile(restoredWorkbook, restoredXlsxPath);

    recovered.push({
      file: path.basename(filePath),
      sheetCount: sheets.length,
      sheets,
      restoredXlsx: restoredXlsxPath,
    });
  }

  await writeFile(outputFile, JSON.stringify(recovered, null, 2), 'utf8');

  const totals = recovered.map((book) => ({
    file: book.file,
    sheets: book.sheetCount,
    rows: book.sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0),
  }));

  console.log(JSON.stringify({ outputFile, totals }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});