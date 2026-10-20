import { cleanText, participantError } from "@/lib/validate";

export type CsvRow = { name: string; unit: string };
export type CsvIssue = { line: number; message: string };

function detectSeparator(sample: string): string {
  const semis = (sample.match(/;/g) || []).length;
  const commas = (sample.match(/,/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  if (tabs > semis && tabs > commas) return "\t";
  if (semis > 0 && semis >= commas) return ";";
  return ",";
}

export function parseCsv(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, "");
  if (!cleaned.trim()) return [];

  const firstBreak = cleaned.search(/\r?\n/);
  const sample = firstBreak === -1 ? cleaned : cleaned.slice(0, firstBreak);
  const sep = detectSeparator(sample);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (inQuotes) {
      if (char === '"') {
        if (cleaned[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && cleaned[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function rowsFromCsv(text: string): { rows: CsvRow[]; errors: CsvIssue[] } {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { rows: [], errors: [{ line: 1, message: "A planilha está vazia." }] };
  }

  let start = 0;
  let nameIdx = 0;
  let unitIdx = 1;
  const head = table[0].map(norm);
  const looksHeader = head.some((value) => ["nome", "name", "franqueado", "participante"].includes(value));

  if (looksHeader) {
    start = 1;
    const foundName = head.findIndex((value) => ["nome", "name", "franqueado", "participante"].includes(value));
    const foundUnit = head.findIndex((value) => ["unidade", "unit", "escola", "franquia"].includes(value));
    if (foundName >= 0) nameIdx = foundName;
    if (foundUnit < 0) {
      return { rows: [], errors: [{ line: 1, message: "Não encontrei a coluna Unidade no cabeçalho." }] };
    }
    unitIdx = foundUnit;
  }

  const rows: CsvRow[] = [];
  const errors: CsvIssue[] = [];

  for (let index = start; index < table.length; index += 1) {
    const columns = table[index];
    const name = cleanText(columns[nameIdx] ?? "");
    const unit = cleanText(columns[unitIdx] ?? "");
    const problem = participantError(name, unit);
    if (problem) errors.push({ line: index + 1, message: problem });
    else rows.push({ name, unit });
  }

  if (rows.length > 5000) {
    return { rows: [], errors: [{ line: 1, message: "O limite é de 5000 franqueados por importação." }] };
  }

  return { rows, errors };
}

function csvCell(value: string): string {
  let safe = value.replace(/\r?\n/g, " ");
  if (/^[=+\-@\t]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: string[][], separator: string, withBom: boolean): string {
  const body = rows.map((row) => row.map(csvCell).join(separator)).join("\r\n");
  const csv = `${body}\r\n`;
  return withBom ? `\uFEFF${csv}` : csv;
}
