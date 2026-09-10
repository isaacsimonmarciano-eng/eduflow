export type Subject = {
  key: string;
  label: string;
  emoji: string;
  /** Saturated brand color for this subject */
  color: string;
  /** Soft tint used as chip / tile background */
  soft: string;
};

export const SUBJECTS: Subject[] = [
  { key: "maths", label: "Mathématiques", emoji: "📐", color: "#4f46e5", soft: "#eef2ff" },
  { key: "francais", label: "Français", emoji: "📚", color: "#e11d48", soft: "#fff1f2" },
  { key: "histoire-geo", label: "Histoire-Géo", emoji: "🌍", color: "#0d9488", soft: "#f0fdfa" },
  { key: "svt", label: "SVT", emoji: "🧬", color: "#16a34a", soft: "#f0fdf4" },
  { key: "physique-chimie", label: "Physique-Chimie", emoji: "⚗️", color: "#ea580c", soft: "#fff7ed" },
  { key: "anglais", label: "Anglais", emoji: "🇬🇧", color: "#7c3aed", soft: "#f5f3ff" },
  { key: "espagnol", label: "Espagnol", emoji: "🇪🇸", color: "#d97706", soft: "#fffbeb" },
  { key: "techno", label: "Technologie", emoji: "🛠️", color: "#0891b2", soft: "#ecfeff" },
  { key: "arts", label: "Arts", emoji: "🎨", color: "#db2777", soft: "#fdf2f8" },
  { key: "eps", label: "EPS", emoji: "⚽", color: "#65a30d", soft: "#f7fee7" },
];

const FALLBACK: Subject = {
  key: "autre",
  label: "Autre",
  emoji: "📘",
  color: "#4f46e5",
  soft: "#eef2ff",
};

export function subjectOf(key: string): Subject {
  return SUBJECTS.find((s) => s.key === key) ?? { ...FALLBACK, key, label: "Autre" };
}
