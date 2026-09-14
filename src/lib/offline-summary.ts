// Fallback local (sans Internet) pour la génération de résumés.
// Utilisé automatiquement en mode démo / hors-ligne pour ne jamais montrer d'erreur d'IA.
export type LocalSummary = { title: string; summary: string; keyPoints: string[] };

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function sentences(text: string): string[] {
  const raw = text
    .replace(/\r\n/g, "\n")
    .split(/[\n\.!\?]+/)
    .map(clean)
    .filter(Boolean);
  // keep 4-8 sentences max, dedup-ish
  const seen = new Set<string>();
  const out: string[] = [];
  for (const sent of raw) {
    const k = sent.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(sent);
    if (out.length >= 12) break;
  }
  return out;
}

export function localSummarize(notes: string, subjectLabel: string): LocalSummary {
  const text = notes.trim().slice(0, 6000);
  const sents = sentences(text);
  const first = sents[0] ?? "";
  // title: first phrase or fallback
  let title = first ? first.slice(0, 72) : `Cours de ${subjectLabel}`;
  if (!title) title = `Cours de ${subjectLabel}`;
  if (title.length > 90) title = title.slice(0, 87) + "…";
  // Ensure title starts upper
  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (!/[a-zA-Z0-9]$/.test(title)) title = title.replace(/[.:\-–—,\s]+$/g, "");

  const summaryParts = sents.slice(0, 6);
  const summary = summaryParts.length
    ? summaryParts.join(". ") + (summaryParts.length ? "." : "")
    : "Résumé généré localement (hors-ligne) à partir des notes fournies. Relis et ajuste avant publication.";

  const keyPoints = sents.slice(0, 6).map((s) => (s.length > 120 ? s.slice(0, 117) + "…" : s));
  const finalPoints =
    keyPoints.length >= 3
      ? keyPoints.slice(0, 6)
      : ["Idée principale du cours", "Deuxième point à retenir", "À réviser avant le prochain cours"];

  return { title, summary, keyPoints: finalPoints.slice(0, 8) };
}

export function localDetectSubjectAndFormat(sources: { name: string; kind: string; text: string }[], subjectHint?: string) {
  const all = sources.map((s) => s.text).join("\n\n");
  const parsed = localSummarize(all, subjectHint ?? "Autre");
  const key = subjectHint ? guessKey(subjectHint) : guessKeyFromText(all);
  const labels: Record<string, string> = {
    maths: "Mathématiques", francais: "Français", "histoire-geo": "Histoire-Géo", svt: "SVT", "physique-chimie": "Physique-Chimie", anglais: "Anglais", espagnol: "Espagnol", techno: "Technologie", arts: "Arts", eps: "EPS", autre: "Autre",
  };
  return {
    subjectKey: key,
    subjectLabel: labels[key] ?? "Autre",
    topic: parsed.title,
    confidence: 0.52,
    title: parsed.title,
    summary: parsed.summary + "\n\n— Généré hors-ligne à partir de tes sources (aucune donnée envoyée).",
    keyPoints: parsed.keyPoints,
  };
}

function guessKey(label: string): string {
  const n = label.toLowerCase();
  if (n.includes("math")) return "maths";
  if (n.includes("fran")) return "francais";
  if (n.includes("histoire") || n.includes("geo") || n.includes("géo")) return "histoire-geo";
  if (n.includes("svt") || n.includes("bio")) return "svt";
  if (n.includes("physique") || n.includes("chimie")) return "physique-chimie";
  if (n.includes("anglais")) return "anglais";
  if (n.includes("espagnol")) return "espagnol";
  if (n.includes("techno")) return "techno";
  if (n.includes("art")) return "arts";
  if (n.includes("eps") || n.includes("sport")) return "eps";
  return "autre";
}
function guessKeyFromText(text: string): string {
  const t = text.toLowerCase();
  const scores: Record<string, number> = {};
  const bump = (k: string, words: string[]) => {
    let s = 0;
    for (const w of words) if (t.includes(w)) s += 1;
    scores[k] = s;
  };
  bump("maths", ["thalès", "thales", "triangle", "proportion", "équation", "fonction", "géométrie"]);
  bump("francais", ["verbe", "grammaire", "roman", "poème", "texte", "argument"]);
  bump("histoire-geo", ["révolution", "histoire", "géographie", "carte", "guerre", "empire"]);
  bump("svt", ["cellule", "adn", "photosynthèse", "ecosystème", "organisme"]);
  bump("physique-chimie", ["atome", "molécule", "énergie", "chimie", "physique", "réaction"]);
  bump("anglais", ["english", "vocabulary", "grammar", "present", "past"]);
  bump("espagnol", ["español", "verbo", "vocabulario"]);
  bump("techno", ["algorithme", "code", "réseau", "technologie", "python"]);
  let best = "autre";
  let bestScore = 0;
  for (const [k, v] of Object.entries(scores)) if (v > bestScore) { best = k; bestScore = v; }
  return best;
}
