// Mirrors colorForLabel() in the prototype and backend — same hash so a
// label's color is identical across every surface (designsystem.md §2.4).
const LABEL_COLORS = [
  '#362F9E', '#2563EB', '#16946E', '#C87F0A', '#E2483B',
  '#5B3DE0', '#0EA5A5', '#DB2777', '#7C8598', '#8E5A2B',
];

export function colorForLabel(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return LABEL_COLORS[h % LABEL_COLORS.length];
}
