// docs/prd-phase2.md §9 — one shared exporter for every table this phase
// touches, instead of a bespoke CSV builder per page. Client-side only: the
// data driving these tables is already fetched and in memory, so there's no
// need for a backend export endpoint.
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportToCsv(filename: string, columns: string[], rows: unknown[][]) {
  const lines = [columns.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
