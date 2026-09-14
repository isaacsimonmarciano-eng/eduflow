import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SUBJECTS, subjectOf } from "@/lib/subjects";
import { todayISO, formatDateFR } from "@/lib/dates";
import Devoirs, { type Homework } from "@/components/Devoirs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Loader2,
  LogOut,
  Mic,
  PenLine,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";

type Lesson = {
  _id: Id<"lessons">;
  subjectKey: string;
  date: string;
  title: string;
  summary: string;
  keyPoints: string[];
  notes?: string;
  status: "draft" | "published";
  authorName: string;
  canEdit: boolean;
};

const WEEK_STEPS = [
  "Écris ce que tu as retenu du cours, même en vrac",
  "L'IA rédige un résumé propre",
  "Vérifie, ajuste, puis publie pour la classe",
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const lessons = useQuery(api.lessons.listAll, {}) as Lesson[] | undefined;
  const homework = useQuery(api.homework.list, {}) as Homework[] | undefined;
  const classmates = useQuery(api.users.listClassmates, {});
  const saveLesson = useMutation(api.lessons.save);
  const publishLesson = useMutation(api.lessons.publish);
  const removeLesson = useMutation(api.lessons.remove);
  const addHomework = useMutation(api.homework.add);
  const toggleHomework = useMutation(api.homework.toggleDone);
  const removeHomework = useMutation(api.homework.remove);
  const summarizeNotes = useAction(api.ai.summarizeNotes);
  const syncHomework = useAction(api.homeworkSync.sync);

  const [selected, setSelected] = useState<string>(SUBJECTS[0].key);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const autoSynced = useRef(false);
  const [view, setView] = useState<"cours" | "devoirs" | "classe">("cours");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"lessons"> | null>(null);
  const [form, setForm] = useState({
    subjectKey: SUBJECTS[0].key,
    date: todayISO(),
    notes: "",
    title: "",
    summary: "",
    keyPoints: "",
  });
  const [generating, setGenerating] = useState(false);

  const bySubject = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const l of lessons ?? []) {
      const list = map.get(l.subjectKey) ?? [];
      list.push(l);
      map.set(l.subjectKey, list);
    }
    return map;
  }, [lessons]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const [key, list] of bySubject) map.set(key, list.length);
    return map;
  }, [bySubject]);

  const openNew = () => {
    setEditingId(null);
    setForm({
      subjectKey: selected,
      date: todayISO(),
      notes: "",
      title: "",
      summary: "",
      keyPoints: "",
    });
    setEditorOpen(true);
  };

  const openEdit = (l: Lesson) => {
    setEditingId(l._id);
    setForm({
      subjectKey: l.subjectKey,
      date: l.date,
      notes: l.notes ?? "",
      title: l.title,
      summary: l.summary,
      keyPoints: l.keyPoints.join("\n"),
    });
    setEditorOpen(true);
  };

  const handleGenerate = async () => {
    if (form.notes.trim().length < 10) {
      toast.error("Écris d'abord quelques mots de ton cours (10 caractères minimum).");
      return;
    }
    setGenerating(true);
    try {
      const subject = subjectOf(form.subjectKey);
      const result = await summarizeNotes({
        notes: form.notes,
        subjectLabel: subject.label,
        date: form.date,
      });
      setForm((f) => ({
        ...f,
        title: result.title || f.title,
        summary: result.summary || f.summary,
        keyPoints: result.keyPoints.length
          ? result.keyPoints.join("\n")
          : f.keyPoints,
      }));
      toast.success("Résumé généré ! Vérifie-le, ajuste-le si besoin, puis publie.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'IA n'a pas répondu.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (publish: boolean) => {
    if (!form.title.trim() || !form.summary.trim()) {
      toast.error("Le résumé a besoin d'un titre et d'un texte avant d'être enregistré.");
      return;
    }
    try {
      await saveLesson({
        id: editingId ?? undefined,
        subjectKey: form.subjectKey,
        date: form.date,
        title: form.title,
        summary: form.summary,
        keyPoints: form.keyPoints
          .split("\n")
          .map((k) => k.trim())
          .filter(Boolean),
        notes: form.notes.trim() ? form.notes : undefined,
        publish,
      });
      toast.success(
        publish
          ? "Résumé publié ! Toute la classe peut le lire. 🎉"
          : "Brouillon enregistré.",
      );
      setEditorOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  };

  const handlePublish = async (l: Lesson) => {
    try {
      await publishLesson({ id: l._id });
      toast.success("Résumé publié ! Toute la classe peut le lire. 🎉");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publication impossible.");
    }
  };

  const handleDelete = async (l: Lesson) => {
    if (!window.confirm("Supprimer ce résumé ? Cette action est définitive.")) return;
    try {
      await removeLesson({ id: l._id });
      toast.success("Résumé supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  /** Pull the class's homework from EcoleDirecte. `manual` = button click. */
  const runSync = async (manual: boolean) => {
    if (syncing) return;
    setSyncing(true);
    try {
      const result = await syncHomework({});
      if (!result.ok) {
        setSyncError(result.message);
        if (manual) toast.error(result.message);
        return;
      }
      setSyncError(null);
      if (result.added > 0) {
        toast.success(
          `🎒 ${result.added} nouveau${result.added > 1 ? "x" : ""} devoir${
            result.added > 1 ? "s" : ""
          } récupéré${result.added > 1 ? "s" : ""} depuis EcoleDirecte !`,
        );
      } else if (manual) {
        toast.success("Devoirs déjà à jour ✅");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Synchronisation impossible.";
      setSyncError(message);
      if (manual) toast.error(message);
    } finally {
      setSyncing(false);
    }
  };

  // Keep the homework fresh without the student having to think about it:
  // one automatic sync per visit when the last one is getting stale.
  useEffect(() => {
    if (autoSynced.current || !user) return;
    if (homework === undefined) return;
    if (Date.now() - (user.hwSyncedAt ?? 0) < 30 * 60 * 1000) return;
    autoSynced.current = true;
    void runSync(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, homework]);

  const handleAddHomework = async (data: {
    subjectKey: string;
    dueDate: string;
    text: string;
    emoji: string;
  }) => {
    await addHomework(data);
  };

  const handleToggleHomework = async (id: Id<"homework">) => {
    try {
      await toggleHomework({ id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  };

  const handleRemoveHomework = async (id: Id<"homework">) => {
    try {
      await removeHomework({ id });
      toast.success("Devoir supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    }
  };

  const current = subjectOf(selected);
  const subjectLessons = bySubject.get(selected) ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-lg text-primary-foreground shadow-sm">
              🎒
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <p className="font-display text-lg font-bold">Cartable Vivant</p>
                {user?.className && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700">
                    {user.classRole === "delegue" ? "⭐ Délégué · " : "🎓 "}
                    {user.className}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Salut{user?.name ? ` ${user.name}` : ""} — on est au bon endroit ✨
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === "cours" && (
              <Button onClick={openNew} className="gap-2 rounded-full font-bold shadow-sm">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Nouveau résumé</span>
                <span className="sm:hidden">Ajouter</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full text-muted-foreground"
              onClick={handleSignOut}
              aria-label="Se déconnecter"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        {/* View switcher: Cours / Devoirs / Classe */}
        <div className="mb-6 inline-flex flex-wrap rounded-full border border-border bg-card p-1 shadow-sm">
          {([
            { key: "cours", label: "Les cours", icon: BookOpen },
            { key: "devoirs", label: "Les devoirs", icon: ClipboardList },
            { key: "classe", label: "Ma classe", icon: Users },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                view === key ? "text-primary-foreground" : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {view === key && (
                <motion.span
                  layoutId="view-pill"
                  className="absolute inset-0 rounded-full bg-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="size-4" />
                {label}
              </span>
            </button>
          ))}
        </div>

        {view === "devoirs" ? (
          <Devoirs
            homework={homework}
            onAdd={handleAddHomework}
            onToggle={handleToggleHomework}
            onRemove={handleRemoveHomework}
            onSync={() => runSync(true)}
            syncing={syncing}
            lastSyncedAt={user?.hwSyncedAt}
            syncError={syncError}
          />
        ) : view === "classe" ? (
          <MaClasse
            classmates={classmates}
            className={user?.className ?? undefined}
            myRole={user?.classRole ?? "eleve"}
          />
        ) : (
        <>
        {/* Subject rail */}
        <section aria-label="Matières">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">📚 Les matières</h2>
            <span className="text-sm text-muted-foreground">
              {lessons === undefined
                ? "…"
                : `${lessons.length} résumé${lessons.length > 1 ? "s" : ""} au total`}
            </span>
          </div>
          <div className="flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SUBJECTS.map((s) => {
              const active = s.key === selected;
              const count = counts.get(s.key) ?? 0;
              return (
                <button
                  key={s.key}
                  onClick={() => setSelected(s.key)}
                  className={`flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-all ${
                    active
                      ? "border-transparent text-white shadow-md"
                      : "border-border bg-card text-foreground/80 hover:border-foreground/20 hover:shadow-sm"
                  }`}
                  style={active ? { backgroundColor: s.color } : undefined}
                >
                  <span className="text-base">{s.emoji}</span>
                  {s.label}
                  {count > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[11px] font-extrabold ${
                        active ? "bg-white/25" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Timeline */}
        <section className="mt-8" aria-label={`Résumés de ${current.label}`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex size-11 items-center justify-center rounded-2xl text-xl shadow-sm"
                style={{ backgroundColor: current.soft }}
              >
                {current.emoji}
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">
                  {current.label}{" "}
                  <span className="text-muted-foreground/60">· jour par jour</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  {subjectLessons.length === 0
                    ? "Aucun résumé pour le moment."
                    : `${subjectLessons.length} séance${subjectLessons.length > 1 ? "s" : ""} résumée${subjectLessons.length > 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <Button
              onClick={openNew}
              variant="outline"
              className="gap-2 rounded-full font-bold"
              style={{ borderColor: current.color, color: current.color }}
            >
              <Mic className="size-4" />
              Dicter un cours
            </Button>
          </div>

          {lessons === undefined ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="pop-card h-44 animate-pulse" />
              ))}
            </div>
          ) : subjectLessons.length === 0 ? (
            <EmptySubject onNew={openNew} label={current.label} />
          ) : (
            <ol className="relative space-y-5 border-l-2 border-dashed border-border pl-6 sm:pl-8">
              <AnimatePresence initial={false}>
                {subjectLessons.map((l) => {
                  const s = subjectOf(l.subjectKey);
                  const draft = l.status === "draft";
                  return (
                    <motion.li
                      key={l._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.25 }}
                      className="relative"
                    >
                      <span
                        className="absolute -left-[35px] top-6 flex size-5 items-center justify-center rounded-full border-2 border-background text-[9px] shadow-sm sm:-left-[43px]"
                        style={{ backgroundColor: s.color }}
                      >
                        {s.emoji}
                      </span>
                      <article
                        className={`pop-card pop-card-hover overflow-hidden ${draft ? "border-dashed" : ""}`}
                      >
                        <div
                          className="h-1.5 w-full"
                          style={{ backgroundColor: s.color }}
                        />
                        <div className="p-5 sm:p-6">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                              style={{ backgroundColor: s.soft, color: s.color }}
                            >
                              <CalendarDays className="size-3.5" />
                              {formatDateFR(l.date)}
                            </span>
                            {draft ? (
                              <Badge
                                variant="outline"
                                className="gap-1 rounded-full border-dashed text-muted-foreground"
                              >
                                <PenLine className="size-3" />
                                Brouillon — visible par toi seul
                              </Badge>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                                <Send className="size-3.5" />
                                Publié
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <UserRound className="size-3.5" />
                              {l.authorName}
                            </span>
                          </div>

                          <h3 className="mt-3 font-display text-lg font-bold leading-snug">
                            {l.title}
                          </h3>
                          <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">
                            {l.summary}
                          </p>

                          {l.keyPoints.length > 0 && (
                            <ul className="mt-4 grid gap-1.5">
                              {l.keyPoints.map((k, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-sm text-foreground/85"
                                >
                                  <span
                                    className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white"
                                    style={{ backgroundColor: s.color }}
                                  >
                                    {i + 1}
                                  </span>
                                  {k}
                                </li>
                              ))}
                            </ul>
                          )}

                          {l.canEdit && (
                            <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
                              {draft && (
                                <Button
                                  size="sm"
                                  className="gap-1.5 rounded-full font-bold text-white"
                                  style={{ backgroundColor: s.color }}
                                  onClick={() => void handlePublish(l)}
                                >
                                  <Send className="size-3.5" />
                                  Publier pour la classe
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 rounded-full font-bold"
                                onClick={() => openEdit(l)}
                              >
                                <PenLine className="size-3.5" />
                                Modifier
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1.5 rounded-full text-destructive hover:text-destructive"
                                onClick={() => void handleDelete(l)}
                              >
                                <Trash2 className="size-3.5" />
                                Supprimer
                              </Button>
                            </div>
                          )}
                        </div>
                      </article>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
          )}
        </section>

        {/* Delegate tips */}
        <section className="mt-12">
          <div className="dot-grid pop-card p-6 sm:p-8">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Sparkles className="size-5 text-amber-500" />
              Le rituel du délégué, en 3 étapes
            </h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-3">
              {WEEK_STEPS.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-sm"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-foreground/80">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        </>
        )}
      </main>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold">
              <Mic className="size-5 text-primary" />
              {editingId ? "Modifier le résumé" : "Nouveau résumé de cours"}
            </DialogTitle>
            <DialogDescription>
              Écris ce que tu as entendu en classe — mots-clés, phrases courtes, peu
              importe. L'IA en fait un résumé clair pour la classe.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="subject">Matière</Label>
                <select
                  id="subject"
                  value={form.subjectKey}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, subjectKey: e.target.value }))
                  }
                  className="h-9 rounded-xl border border-input bg-card px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring/40"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.emoji} {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="date">Date du cours</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="notes" className="flex items-center gap-1.5">
                <Mic className="size-3.5 text-primary" />
                Notes du dictaphone / ce que tu as retenu
              </Label>
              <Textarea
                id="notes"
                placeholder="Ex : today maths — théorème de Thalès, triangles semblables, exemples exercice 34, contrôle la semaine prochaine…"
                rows={5}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="resize-none"
              />
            </div>

            {editingId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleGenerate()}
                disabled={generating}
                className="gap-2 rounded-full font-bold"
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    L'IA rédige le résumé…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Regénérer avec l'IA (remplace titre, résumé et points)
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating}
                className="gap-2 rounded-full font-bold"
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    L'IA rédige le résumé…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Générer le résumé avec l'IA
                  </>
                )}
              </Button>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="title">Titre</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex : Le théorème de Thalès"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="summary">Résumé</Label>
              <Textarea
                id="summary"
                rows={5}
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="3 à 6 phrases claires, comme si tu expliquais le cours à un camarade."
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="keyPoints">Points clés (un par ligne)</Label>
              <Textarea
                id="keyPoints"
                rows={3}
                value={form.keyPoints}
                onChange={(e) => setForm((f) => ({ ...f, keyPoints: e.target.value }))}
                placeholder={
                  "Thalès s'applique aux triangles semblables\nAttention au sens des proportions\nContrôle la semaine prochaine"
                }
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="rounded-full font-bold"
              onClick={() => void handleSave(false)}
            >
              Enregistrer en brouillon
            </Button>
            <Button
              className="gap-2 rounded-full font-bold"
              onClick={() => void handleSave(true)}
            >
              <Send className="size-4" />
              Enregistrer et publier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptySubject({ label, onNew }: { label: string; onNew: () => void }) {
  return (
    <div className="dot-grid pop-card flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="animate-float-y text-5xl">🗒️</div>
      <h3 className="mt-4 font-display text-lg font-bold">
        Pas encore de résumé en {label}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Après le prochain cours, dicte tout ce que tu as retenu — l'IA le transforme
        en fiche claire pour toute la classe.
      </p>
      <Button onClick={onNew} className="mt-5 gap-2 rounded-full font-bold shadow-sm">
        <BookOpen className="size-4" />
        Résumer le premier cours
      </Button>
    </div>
  );
}

type Classmate = {
  _id: string;
  name: string;
  classRole: "eleve" | "delegue";
  isMe: boolean;
};

function MaClasse({
  classmates,
  className,
  myRole,
}: {
  classmates: Classmate[] | undefined;
  className?: string;
  myRole: "eleve" | "delegue";
}) {
  return (
    <section aria-label="Ma classe">
      <div className="dot-grid pop-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="animate-float-y flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl shadow-sm">
            🎓
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">
              Ma classe{className ? ` · ${className}` : ""}
            </h2>
            <p className="text-sm text-muted-foreground">
              {classmates === undefined
                ? "…"
                : `${classmates.length} élève${classmates.length > 1 ? "s" : ""} connecté${classmates.length > 1 ? "s" : ""} dans l'espace de la classe`}
            </p>
          </div>
        </div>
        {myRole === "delegue" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-bold text-amber-800 shadow-sm">
            ⭐ Tu es le délégué — tes publications sont visibles par toute la classe
          </span>
        )}
      </div>

      {classmates === undefined ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pop-card h-20 animate-pulse" />
          ))}
        </div>
      ) : classmates.length === 0 ? (
        <div className="dot-grid pop-card mt-5 flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="animate-float-y text-5xl">🫂</div>
          <h3 className="mt-4 font-display text-lg font-bold">
            Tu es le premier de ta classe !
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Partage le site avec tes camarades : dès qu'ils se connectent avec
            leur compte EcoleDirecte, ils apparaissent ici et rejoignent
            l'espace de la classe.
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classmates.map((m) => (
            <motion.li
              key={m._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div
                className={`pop-card pop-card-hover flex items-center gap-3.5 p-4 ${
                  m.isMe ? "ring-2 ring-primary/40" : ""
                }`}
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white shadow-sm ${
                    m.classRole === "delegue" ? "bg-amber-500" : "bg-primary"
                  }`}
                >
                  {m.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold">
                    {m.name}
                    {m.isMe && (
                      <span className="ml-1.5 text-xs font-bold text-primary">· toi</span>
                    )}
                  </p>
                  <p
                    className={`text-xs font-bold ${
                      m.classRole === "delegue" ? "text-amber-600" : "text-muted-foreground"
                    }`}
                  >
                    {m.classRole === "delegue" ? "⭐ Délégué de la classe" : "🎓 Élève"}
                  </p>
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
