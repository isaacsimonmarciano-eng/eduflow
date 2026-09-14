"use node";

import { vly } from "../lib/vly-integrations";
import { v } from "convex/values";
import { action } from "./_generated/server";

const SUBJECTS = [
  { key: "maths", label: "Mathématiques" },
  { key: "francais", label: "Français" },
  { key: "histoire-geo", label: "Histoire-Géo" },
  { key: "svt", label: "SVT" },
  { key: "physique-chimie", label: "Physique-Chimie" },
  { key: "anglais", label: "Anglais" },
  { key: "espagnol", label: "Espagnol" },
  { key: "techno", label: "Technologie" },
  { key: "arts", label: "Arts" },
  { key: "eps", label: "EPS" },
] as const;

const SUMMARY_PROMPT = `Tu es un assistant scolaire pour une classe française. Tu rédiges des résumés fidèles, clairs et structurés à partir des seules informations fournies.
Réponds STRICTEMENT en JSON valide, sans texte autour, avec exactement :
- "title": titre court du cours
- "summary": résumé clair en français
- "keyPoints": tableau de 3 à 8 points clés
N'invente aucune information absente.`;

const IMPORT_PROMPT = `Tu analyses un lot de sources d'un même élève : PDF, document, photo OCR, transcription audio ou texte saisi.
Ta mission :
1. déterminer la matière la plus probable parmi la liste autorisée ;
2. trouver le sujet / chapitre le plus précis possible ;
3. fusionner les sources complémentaires sans répétition ;
4. ne jamais créer de lien entre des éléments qui ne sont pas clairement liés ;
5. produire un excellent résumé fidèle au contenu.
Si les sources couvrent plusieurs sujets réellement distincts, garde un titre général prudent et explique les parties séparément dans le résumé.
Réponds STRICTEMENT en JSON valide avec exactement :
- "subjectKey": une des clés autorisées
- "subjectLabel": le libellé correspondant
- "topic": sujet ou chapitre court
- "confidence": nombre entre 0 et 1
- "title": titre du récapitulatif
- "summary": résumé structuré en français
- "keyPoints": tableau de 3 à 10 points clés
N'invente rien.`;

type Parsed = { title: string; summary: string; keyPoints: string[] };
type ImportParsed = Parsed & {
  subjectKey: string;
  subjectLabel: string;
  topic: string;
  confidence: number;
};

function jsonObject(raw: string): Record<string, unknown> {
  let text = raw.trim();
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }
  try {
    return (JSON.parse(text) ?? {}) as Record<string, unknown>;
  } catch {
    throw new Error("L'IA n'a pas renvoyé un format valide, réessaie.");
  }
}

function parseSummary(raw: string, subjectLabel: string): Parsed {
  const obj = jsonObject(raw);
  const title = typeof obj.title === "string" && obj.title.trim()
    ? obj.title.trim().slice(0, 90)
    : `Cours de ${subjectLabel}`;
  const summary = typeof obj.summary === "string" ? obj.summary.trim().slice(0, 5000) : "";
  const keyPoints = Array.isArray(obj.keyPoints)
    ? obj.keyPoints.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
      .map((k) => k.trim().slice(0, 220)).slice(0, 10)
    : [];
  if (!summary) throw new Error("L'IA n'a pas réussi à rédiger le résumé, réessaie.");
  return { title, summary, keyPoints };
}

function parseImport(raw: string): ImportParsed {
  const obj = jsonObject(raw);
  const candidate = typeof obj.subjectKey === "string" ? obj.subjectKey : "";
  const allowed = SUBJECTS.find((subject) => subject.key === candidate) ?? SUBJECTS[0];
  const parsed = parseSummary(raw, allowed.label);
  const topic = typeof obj.topic === "string" && obj.topic.trim()
    ? obj.topic.trim().slice(0, 120)
    : parsed.title;
  const confidenceValue = typeof obj.confidence === "number" ? obj.confidence : 0.5;
  return {
    ...parsed,
    subjectKey: allowed.key,
    subjectLabel: allowed.label,
    topic,
    confidence: Math.max(0, Math.min(1, confidenceValue)),
  };
}

async function callVly(systemPrompt: string, userPrompt: string, maxTokens = 1400): Promise<string> {
  const result = await vly.ai.completion({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.25,
    maxTokens,
  });
  if (!result.success || !result.data) {
    throw new Error(result.error ?? "Le service IA n'a pas répondu, réessaie dans un instant.");
  }
  const content = result.data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Réponse inattendue de l'IA, réessaie.");
  return content;
}

async function callOpenAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("no-key");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Le service IA a renvoyé une erreur (${response.status}), réessaie.`);
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Réponse inattendue de l'IA, réessaie.");
  return content;
}

async function complete(systemPrompt: string, userPrompt: string, maxTokens?: number) {
  try {
    return await callVly(systemPrompt, userPrompt, maxTokens);
  } catch (vlyErr) {
    try {
      return await callOpenAI(systemPrompt, userPrompt);
    } catch (openaiErr) {
      if (openaiErr instanceof Error && openaiErr.message === "no-key") {
        if (vlyErr instanceof Error && vlyErr.message.length < 200) throw vlyErr;
        throw new Error("Le service IA n'est pas disponible pour le moment.");
      }
      throw openaiErr instanceof Error ? openaiErr : new Error("Le service IA n'a pas répondu.");
    }
  }
}

export const summarizeNotes = action({
  args: { notes: v.string(), subjectLabel: v.string(), date: v.string() },
  handler: async (_ctx, { notes, subjectLabel, date }) => {
    const prompt = `Matière : ${subjectLabel}\nDate du cours : ${date}\n\nNotes :\n${notes}`;
    return parseSummary(await complete(SUMMARY_PROMPT, prompt, 1000), subjectLabel);
  },
});

export const analyzeImportedSources = action({
  args: {
    sources: v.array(v.object({ name: v.string(), kind: v.string(), text: v.string() })),
    subjectHint: v.optional(v.string()),
  },
  handler: async (_ctx, { sources, subjectHint }) => {
    if (!sources.length) throw new Error("Ajoute au moins une source.");
    const allowed = SUBJECTS.map((subject) => `${subject.key} = ${subject.label}`).join("\n");
    const sourceText = sources
      .map((source, index) => `--- SOURCE ${index + 1} | ${source.name} | ${source.kind} ---\n${source.text.slice(0, 18_000)}`)
      .join("\n\n");
    const prompt = `MATIÈRES AUTORISÉES :\n${allowed}\n\n${subjectHint ? `INDICATION ÉLÈVE : ${subjectHint}\n\n` : ""}${sourceText}`;
    return parseImport(await complete(IMPORT_PROMPT, prompt, 2200));
  },
});
