// Central place to decide: use Convex AI or local fallback.
// Components should import this instead of calling api.ai.* directly when offline must be supported.
import { isDemoMode } from "@/demo/mode";
import { localSummarize, localDetectSubjectAndFormat } from "@/lib/offline-summary";

export function shouldUseOfflineAI(): boolean {
  if (isDemoMode()) return true;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return false;
}

export async function summarizeNotesOfflineAware(
  convexSummarize: (args: { notes: string; subjectLabel: string; date: string }) => Promise<{ title: string; summary: string; keyPoints: string[] }>,
  args: { notes: string; subjectLabel: string; date: string }
) {
  if (shouldUseOfflineAI()) {
    // No network call — pure local
    return Promise.resolve(localSummarize(args.notes, args.subjectLabel));
  }
  try {
    return await convexSummarize(args);
  } catch {
    // If Convex / Vly AI failed (network or service), gracefully fall back instead of showing an error screen
    return localSummarize(args.notes, args.subjectLabel);
  }
}

export async function analyzeImportedSourcesOfflineAware(
  convexAnalyze: (args: { sources: { name: string; kind: string; text: string }[]; subjectHint?: string }) => Promise<{ subjectKey: string; subjectLabel: string; topic: string; confidence: number; title: string; summary: string; keyPoints: string[] }>,
  args: { sources: { name: string; kind: string; text: string }[]; subjectHint?: string }
) {
  if (shouldUseOfflineAI()) {
    return Promise.resolve(localDetectSubjectAndFormat(args.sources, args.subjectHint));
  }
  try {
    return await convexAnalyze(args);
  } catch {
    return localDetectSubjectAndFormat(args.sources, args.subjectHint);
  }
}
