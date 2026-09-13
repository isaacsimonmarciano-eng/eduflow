export function todayISO(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatDateFR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Days from today until the given date (negative = past). */
export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Short French label for the due-date chip: today / tomorrow / weekday. */
export function dueLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  if (days === 2) return "Après-demain";
  return formatDateFR(iso);
}
