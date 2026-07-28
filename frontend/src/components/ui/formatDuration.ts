// TimeEntry.durationMinutes is a fractional-minute Decimal on the backend
// (schema.prisma) so sub-minute timer runs aren't rounded away to 0 — it
// arrives over the wire as a numeric string (Prisma's Decimal → JSON
// behavior), hence the Number() coercion here rather than assuming a number.
export function formatDuration(minutes: number | string | null | undefined): string {
  const mins = Number(minutes ?? 0);
  if (!mins) return '—';
  const totalSeconds = Math.round(mins * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
