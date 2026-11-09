import ExcelJS from "exceljs";

export function serialToIso(serial: number): string | null {
  if (serial < 20_000 || serial > 80_000) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + serial * 86_400_000);
  const year = date.getUTCFullYear();
  if (year < 2020 || year > 2035) return null;
  return `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const record = value as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (Array.isArray(record.richText)) return record.richText.map((part) => part.text).join("");
    if ("result" in record) return cellText(record.result);
    if ("text" in record && record.text != null) return String(record.text);
  }
  return String(value).trim();
}

function looksLikeDateFormat(fmt: string | undefined): boolean {
  if (!fmt) return false;
  const lower = fmt.toLowerCase();
  if (lower === "general" || lower === "0" || lower.includes("0.00")) return false;
  return /[dmy]/.test(lower);
}

export async function workbookMatrices(buffer: Buffer | ArrayBuffer): Promise<{ name: string; rows: string[][] }[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook.worksheets.map((sheet) => {
    const rows: string[][] = [];
    const width = sheet.columnCount || 12;
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const values: string[] = [];
      for (let col = 1; col <= Math.max(width, row.cellCount); col += 1) {
        const cell = row.getCell(col);
        let text = cellText(cell.value).trim();
        if (typeof cell.value === "number" && looksLikeDateFormat(cell.numFmt)) {
          text = serialToIso(cell.value) || text;
        }
        values.push(text);
      }
      rows.push(values);
    });
    return { name: sheet.name, rows };
  });
}
