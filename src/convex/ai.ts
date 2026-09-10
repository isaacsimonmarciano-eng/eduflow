"use node";

import { vly } from "../lib/vly-integrations";
import { v } from "convex/values";
import { action } from "./_generated/server";

const SYSTEM_PROMPT = `Tu es l'assistant d'un délégué de classe française. À partir de notes prises au dictaphone (souvent des mots-clés et des phrases rapides), tu rédiges un résumé de cours clair, fidèle et concis, adapté à des élèves de collège ou de lycée.

Réponds STRICTEMENT en JSON valide, sans aucun texte autour, avec exactement ces champs :
- "title" : titre court du cours (60 caractères maximum)
- "summary" : résumé de 3 à 6 phrases en français, au présent, facile à relire
- "keyPoints" : tableau de 3 à 6 points clés très courts (80 caractères maximum chacun)

N'invente aucun contenu absent des notes. Si les notes sont trop vagues, rédige un résumé prudent qui liste simplement les notions mentionnées.`;

type Parsed = { title: string; summary: string; keyPoints: string[] };

function parseSummary(raw: string, subjectLabel: string): Parsed {
  let text = raw.trim();
  // The model may wrap JSON in code fences or add prose: keep the {...} part.
  if (!text.startsWith("{")) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) text = text.slice(start, end + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("L'IA n'a pas renvoyé un format valide, réessaie.");
  }

  const obj = (parsed ?? {}) as Record<string, unknown>;
  const title =
    typeof obj.title === "string" && obj.title.trim()
      ? obj.title.trim().slice(0, 90)
      : `Cours de ${subjectLabel}`;
  const summary =
    typeof obj.summary === "string" ? obj.summary.trim().slice(0, 1500) : "";
  const keyPoints = Array.isArray(obj.keyPoints)
    ? obj.keyPoints
        .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
        .map((k) => k.trim().slice(0, 140))
        .slice(0, 6)
    : [];

  if (!summary) {
    throw new Error("L'IA n'a pas réussi à rédiger le résumé, réessaie.");
  }
  return { title, summary, keyPoints };
}

async function callVly(userPrompt: string): Promise<string> {
  const result = await vly.ai.completion({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    maxTokens: 900,
  });
  if (!result.success || !result.data) {
    throw new Error(
      result.error ?? "Le service IA n'a pas répondu, réessaie dans un instant.",
    );
  }
  const content = result.data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Réponse inattendue de l'IA, réessaie.");
  }
  return content;
}

async function callOpenAI(userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("no-key");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Le service IA a renvoyé une erreur (${response.status}), réessaie.`);
  }
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Réponse inattendue de l'IA, réessaie.");
  }
  return content;
}

export const summarizeNotes = action({
  args: {
    notes: v.string(),
    subjectLabel: v.string(),
    date: v.string(),
  },
  handler: async (_ctx, { notes, subjectLabel, date }) => {
    const userPrompt = `Matière : ${subjectLabel}\nDate du cours : ${date}\n\nNotes dictées (mots-clés / phrases) :\n${notes}`;

    let raw: string;
    try {
      raw = await callVly(userPrompt);
    } catch (vlyErr) {
      // Gateway hiccup: fall back to a direct OpenAI key if the user added one.
      try {
        raw = await callOpenAI(userPrompt);
      } catch (openaiErr) {
        if (openaiErr instanceof Error && openaiErr.message === "no-key") {
          if (
            vlyErr instanceof Error &&
            vlyErr.message !== "no-key" &&
            vlyErr.message.length < 200
          ) {
            throw vlyErr;
          }
          throw new Error(
            "Le service IA n'est pas disponible pour le moment. Tu peux rédiger le résumé à la main et l'enregistrer.",
          );
        }
        throw openaiErr instanceof Error
          ? openaiErr
          : new Error("Le service IA n'a pas répondu, réessaie dans un instant.");
      }
    }

    return parseSummary(raw, subjectLabel);
  },
});
