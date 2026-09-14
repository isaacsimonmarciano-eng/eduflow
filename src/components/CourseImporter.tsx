import { api } from "@/convex/_generated/api";
import { SUBJECTS, subjectOf } from "@/lib/subjects";
import { todayISO } from "@/lib/dates";
import { extractImportedFile, textSource, type ImportedSource } from "@/lib/courseImport";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction, useMutation } from "convex/react";
import { FileAudio, FileText, Image, Loader2, Plus, Sparkles, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Analysis = {
  subjectKey: string;
  subjectLabel: string;
  topic: string;
  confidence: number;
  title: string;
  summary: string;
  keyPoints: string[];
};

const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.csv,image/*,audio/*,.mp3,.m4a,.wav,.aac,.ogg";

function iconFor(kind: ImportedSource["kind"]) {
  if (kind === "audio") return <FileAudio className="size-4" />;
  if (kind === "photo") return <Image className="size-4" />;
  return <FileText className="size-4" />;
}

export default function CourseImporter() {
  const analyze = useAction(api.ai.analyzeImportedSources);
  const saveLesson = useMutation(api.lessons.save);
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<ImportedSource[]>([]);
  const [pasted, setPasted] = useState("");
  const [manualSubject, setManualSubject] = useState(SUBJECTS[0].key);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [date, setDate] = useState(todayISO());
  const [publishing, setPublishing] = useState(false);

  const hasOnlyText = useMemo(() => sources.length > 0 && sources.every((source) => source.kind === "text"), [sources]);

  const reset = () => {
    setSources([]);
    setPasted("");
    setAnalysis(null);
    setStatus("");
    setDate(todayISO());
  };

  const addText = () => {
    if (pasted.trim().length < 3) return toast.error("Colle ou écris d'abord ton texte.");
    setSources((current) => [...current, textSource(pasted)]);
    setPasted("");
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setProcessing(true);
    try {
      for (const file of Array.from(files)) {
        setStatus(file.type.startsWith("audio/") ? `Transcription locale de ${file.name}…` : `Lecture de ${file.name}…`);
        const source = await extractImportedFile(file);
        setSources((current) => [...current, source]);
      }
      toast.success("Sources importées.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de lire ce fichier.");
    } finally {
      setProcessing(false);
      setStatus("");
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const runAnalysis = async () => {
    if (!sources.length) return toast.error("Ajoute au moins une source.");
    setProcessing(true);
    setStatus("Détection de la matière et création du récapitulatif…");
    try {
      const result = await analyze({
        sources: sources.map(({ name, kind, text }) => ({ name, kind, text })),
        subjectHint: hasOnlyText ? subjectOf(manualSubject).label : undefined,
      });
      setAnalysis(result as Analysis);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analyse impossible.");
    } finally {
      setProcessing(false);
      setStatus("");
    }
  };

  const save = async (publish: boolean) => {
    if (!analysis) return;
    setPublishing(true);
    try {
      await saveLesson({
        subjectKey: analysis.subjectKey,
        date,
        title: analysis.title,
        summary: analysis.summary,
        keyPoints: analysis.keyPoints,
        notes: undefined,
        publish,
      });
      toast.success(publish ? "Récap publié pour la classe 🎉" : "Récap enregistré en brouillon.");
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 gap-2 rounded-full px-5 shadow-lg"
      >
        <Upload className="size-4" /> Importer
      </Button>

      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Importer un cours</DialogTitle>
            <DialogDescription>
              Ajoute des documents, photos, audio ou du texte. Pour les fichiers et l'audio, la matière et le sujet sont détectés automatiquement.
            </DialogDescription>
          </DialogHeader>

          {!analysis ? (
            <div className="space-y-5">
              <input ref={fileInput} type="file" accept={ACCEPT} multiple className="hidden" onChange={(event) => void addFiles(event.target.files)} />

              <div className="grid gap-3 sm:grid-cols-3">
                <button onClick={() => fileInput.current?.click()} className="rounded-2xl border p-4 text-left hover:bg-muted/50">
                  <FileText className="mb-3 size-5" /><p className="font-bold">Document</p><p className="text-xs text-muted-foreground">PDF, Word, PowerPoint, TXT</p>
                </button>
                <button onClick={() => fileInput.current?.click()} className="rounded-2xl border p-4 text-left hover:bg-muted/50">
                  <Image className="mb-3 size-5" /><p className="font-bold">Photo</p><p className="text-xs text-muted-foreground">OCR local puis détection auto</p>
                </button>
                <button onClick={() => fileInput.current?.click()} className="rounded-2xl border p-4 text-left hover:bg-muted/50">
                  <FileAudio className="mb-3 size-5" /><p className="font-bold">Audio</p><p className="text-xs text-muted-foreground">Transcription locale, audio non conservé</p>
                </button>
              </div>

              <div className="rounded-2xl border p-4">
                <Label>Ou colle du texte</Label>
                <Textarea value={pasted} onChange={(event) => setPasted(event.target.value)} className="mt-2 min-h-28" placeholder="Notes de cours, texte dicté, copier-coller…" />
                <div className="mt-2 flex justify-end"><Button variant="outline" size="sm" onClick={addText}><Plus className="mr-1 size-4" />Ajouter ce texte</Button></div>
              </div>

              {sources.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-bold">Sources ajoutées</p>
                  {sources.map((source) => (
                    <div key={source.id} className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm">
                      {iconFor(source.kind)}<span className="min-w-0 flex-1 truncate">{source.name}</span>
                      <button aria-label={`Retirer ${source.name}`} onClick={() => setSources((current) => current.filter((item) => item.id !== source.id))}><X className="size-4 text-muted-foreground" /></button>
                    </div>
                  ))}
                </div>
              )}

              {hasOnlyText && (
                <div>
                  <Label>Matière</Label>
                  <select value={manualSubject} onChange={(event) => setManualSubject(event.target.value)} className="mt-1 h-10 w-full rounded-xl border bg-card px-3">
                    {SUBJECTS.map((subject) => <option key={subject.key} value={subject.key}>{subject.emoji} {subject.label}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">Demandé uniquement lorsque tu importes du texte seul.</p>
                </div>
              )}

              {processing && <div className="flex items-center gap-2 rounded-xl bg-muted p-3 text-sm"><Loader2 className="size-4 animate-spin" />{status || "Analyse…"}</div>}

              <Button className="w-full gap-2 rounded-full" disabled={!sources.length || processing} onClick={() => void runAnalysis()}>
                <Sparkles className="size-4" /> Détecter et créer le récap
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border bg-muted/40 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Détection automatique</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-background px-3 py-1 text-sm font-bold">{subjectOf(analysis.subjectKey).emoji} {analysis.subjectLabel}</span>
                  <span className="rounded-full bg-background px-3 py-1 text-sm">{analysis.topic}</span>
                  <span className="text-xs text-muted-foreground">{Math.round(analysis.confidence * 100)}% de confiance</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label>Matière</Label><select value={analysis.subjectKey} onChange={(event) => { const subject = subjectOf(event.target.value); setAnalysis({ ...analysis, subjectKey: subject.key, subjectLabel: subject.label }); }} className="mt-1 h-10 w-full rounded-xl border bg-card px-3">{SUBJECTS.map((subject) => <option key={subject.key} value={subject.key}>{subject.emoji} {subject.label}</option>)}</select></div>
                <div><Label>Date du cours</Label><Input className="mt-1" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
              </div>

              <div><Label>Titre</Label><Input className="mt-1" value={analysis.title} onChange={(event) => setAnalysis({ ...analysis, title: event.target.value })} /></div>
              <div><Label>Résumé</Label><Textarea className="mt-1 min-h-48" value={analysis.summary} onChange={(event) => setAnalysis({ ...analysis, summary: event.target.value })} /></div>
              <div><Label>Points clés</Label><Textarea className="mt-1 min-h-32" value={analysis.keyPoints.join("\n")} onChange={(event) => setAnalysis({ ...analysis, keyPoints: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} /></div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setAnalysis(null)}>Retour</Button>
                <Button variant="secondary" disabled={publishing} onClick={() => void save(false)}>Brouillon</Button>
                <Button disabled={publishing} onClick={() => void save(true)}>{publishing ? "Enregistrement…" : "Publier pour la classe"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
