// Minimal, dependency-free parser for CSV / TSV / plain multiline input used
// by the batch importer. Handles quoted fields, escaped quotes, CRLF.

export function detectDelimiter(sample: string): ',' | '\t' | ';' {
  const firstLine = sample.split(/\r?\n/)[0] ?? ''
  const counts = {
    ',': (firstLine.match(/,/g) || []).length,
    '\t': (firstLine.match(/\t/g) || []).length,
    ';': (firstLine.match(/;/g) || []).length
  }
  const best = (Object.entries(counts) as [',' | '\t' | ';', number][]).sort(
    (a, b) => b[1] - a[1]
  )[0]
  return best[1] > 0 ? best[0] : ','
}

export function parseDelimited(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^﻿/, '') // strip BOM
  const delim = delimiter ?? detectDelimiter(text)
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delim) {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c === '\r') {
      // ignore; \n handles the row break
    } else {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

/** Treat each non-empty line as a single text row (paste mode). */
export function parseLines(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}
