// fix: EcoleDirecte pour tout le monde - build sync
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
  GraduationCap,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Mic,
  PenLine,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
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

const JOVIAL_PHRASES = [
  "Un petit coup d'œil ce soir et demain tu brilles ✨ — 5 minutes suffisent !",
  "Révise léger ce soir, assure en classe demain 😎",
  "10 minutes ce soir = zéro stress demain 💪",
  "Un résumé relu = un cours déjà à moitié appris 🌟",
  "Ce soir tu relis, demain tu régales ✨",
];

function pickJovial(dateISO: string): string {
  const n = [...dateISO].reduce((a, c) => a + c.charCodeAt(0), 0);
  return JOVIAL_PHRASES[n % JOVIAL_PHRASES.length];
}

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

  const [selected, setSelected] = useState<string>(SUBJECTS[0].key);
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
        keyPoints: result.keyPoints.length ? result.keyPoints.join("\n") : f.keyPoints,
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
      toast.success(publish ? "Résumé publié ! Toute la classe peut le lire. 🎉" : "Brouillon enregistré.");
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

  const handleAddHomework = async (data: { subjectKey: string; dueDate: string; text: string; emoji: string }) => {
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
              <p className="text-xs text-muted-foreground">Salut{user?.name ? ` ${user.name}` : ""} — on est au bon endroit ✨</p>
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
        <DemainBanner
          onSelectSubject={(key) => {
            setSelected(key);
            setView("cours");
            window.scrollTo({ top: 380, behavior: "smooth" });
          }}
        />

        <div className="mb-6 mt-6 inline-flex flex-wrap rounded-full border border-border bg-card p-1 shadow-sm">
          {(
            [
              { key: "cours", label: "Les cours", icon: BookOpen },
              { key: "devoirs", label: "Les devoirs", icon: ClipboardList },
              { key: "classe", label: "Ma classe", icon: Users },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
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
          />
        ) : view === "classe" ? (
          <MaClasse
            classmates={classmates as any}
            className={user?.className ?? undefined}
            myRole={(user?.classRole as any) ?? "eleve"}
          />
        ) : (
          <>
            <section aria-label="Matières">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">📚 Les matières</h2>
                <span className="text-sm text-muted-foreground">
                  {lessons === undefined ? "…" : `${lessons.length} résumé${lessons.length > 1 ? "s" : ""} au total`}
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
                          className={`rounded-full px-1.5 text-[11px] font-extrabold ${active ? "bg-white/25" : "bg-muted text-muted-foreground"}`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

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
                      {current.label} <span className="text-muted-foreground/60">· jour par jour</span>
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
                          <article className={`pop-card pop-card-hover overflow-hidden ${draft ? "border-dashed" : ""}`}>
                            <div className="h-1.5 w-full" style={{ backgroundColor: s.color }} />
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
                                  <Badge variant="outline" className="gap-1 rounded-full border-dashed text-muted-foreground">
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

                              <h3 className="mt-3 font-display text-lg font-bold leading-snug">{l.title}</h3>
                              <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{l.summary}</p>

                              {l.keyPoints.length > 0 && (
                                <ul className="mt-4 grid gap-1.5">
                                  {l.keyPoints.map((k, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
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

            <section className="mt-12">
              <div className="dot-grid pop-card p-6 sm:p-8">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <Sparkles className="size-5 text-amber-500" />
                  Le rituel du délégué, en 3 étapes
                </h2>
                <ol className="mt-4 grid gap-3 sm:grid-cols-3">
                  {WEEK_STEPS.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-sm">
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

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold">
              <Mic className="size-5 text-primary" />
              {editingId ? "Modifier le résumé" : "Nouveau résumé de cours"}
            </DialogTitle>
            <DialogDescription>
              Écris ce que tu as entendu en classe — mots-clés, phrases courtes, peu importe. L'IA en fait un résumé
              clair pour la classe.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="subject">Matière</Label>
                <select
                  id="subject"
                  value={form.subjectKey}
                  onChange={(e) => setForm((f) => ({ ...f, subjectKey: e.target.value }))}
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
                <Input id="date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
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
              <Button type="button" variant="outline" onClick={() => void handleGenerate()} disabled={generating} className="gap-2 rounded-full font-bold">
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> L'IA rédige le résumé…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Regénérer avec l'IA (remplace titre, résumé et points)
                  </>
                )}
              </Button>
            ) : (
              <Button type="button" onClick={() => void handleGenerate()} disabled={generating} className="gap-2 rounded-full font-bold">
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> L'IA rédige le résumé…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" /> Générer le résumé avec l'IA
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
                placeholder={"Thalès s'applique aux triangles semblables\nAttention au sens des proportions\nContrôle la semaine prochaine"}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="rounded-full font-bold" onClick={() => void handleSave(false)}>
              Enregistrer en brouillon
            </Button>
            <Button className="gap-2 rounded-full font-bold" onClick={() => void handleSave(true)}>
              <Send className="size-4" />
              Enregistrer et publier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DemainBanner({ onSelectSubject }: { onSelectSubject: (key: string) => void }) {
  const data = useQuery(api.delegueEcoleDirecte.tomorrowSummary) as
    | { date: string; slots: { date: string; startTime: string; endTime: string; subjectLabel: string; subjectKey: string; teacher?: string; room?: string }[]; recentBySubject: Record<string, any> }
    | null
    | undefined;

  if (data === undefined) {
    return <div className="pop-card h-28 animate-pulse" />;
  }
  if (data === null) return null;

  const hasSlots = data.slots.length > 0;
  const jovial = pickJovial(data.date);
  const humanDate = formatDateFR(data.date);

  if (!hasSlots) {
    return (
      <div className="pop-card flex items-center gap-4 bg-gradient-to-br from-violet-50 to-indigo-50 p-5 shadow-sm dark:from-violet-950/30 dark:to-indigo-950/30">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">🎉</span>
        <div>
          <p className="font-display text-sm font-bold">Demain · {humanDate} — pas de cours !</p>
          <p className="text-sm text-muted-foreground">Profite bien, et reviens revoir les résumés quand tu veux ✨</p>
        </div>
      </div>
    );
  }

  const subjectKeys = [...new Set(data.slots.map((s) => s.subjectKey))];
  const ordered = subjectKeys
    .map((k) => ({ key: k, subj: subjectOf(k) }))
    .sort((a, b) => a.subj.label.localeCompare(b.subj.label, "fr"));

  return (
    <div className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-indigo-50 shadow-sm dark:from-amber-950/20 dark:via-card dark:to-indigo-950/20">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">
              📅 Demain · {humanDate}
            </p>
            <h2 className="mt-2 font-display text-xl font-bold leading-tight">
              Demain tu as{" "}
              <span className="text-primary">
                {ordered.map((o, i) => (
                  <span key={o.key}>
                    {i > 0 ? (i === ordered.length - 1 ? " et " : ", ") : ""}
                    {o.subj.label.toLowerCase()}
                  </span>
                ))}
              </span>{" "}
              — on révise ensemble ?
            </h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-foreground/70">
              💡 {jovial} Tes anciens résumés sont juste en dessous — clique pour les relire vite fait.
            </p>
          </div>
          <span className="hidden shrink-0 items-center justify-center rounded-2xl bg-white px-3 py-2 text-2xl shadow-sm sm:flex">📚</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ordered.map(({ key, subj }) => (
            <button
              key={key}
              onClick={() => onSelectSubject(key)}
              className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-bold shadow-sm transition hover:-translate-y-0.5"
              style={{ borderColor: subj.color, color: subj.color }}
            >
              <span>{subj.emoji}</span> {subj.label}
            </button>
          ))}
        </div>

        {ordered.some((o) => data.recentBySubject[o.key]) && (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {ordered
              .map((o) => ({ subj: o.subj, lesson: data.recentBySubject[o.key] as Lesson | undefined }))
              .filter((x) => x.lesson)
              .map(({ subj, lesson }) => (
                <button
                  key={subj.key}
                  onClick={() => onSelectSubject(subj.key)}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-white p-3 text-left shadow-sm transition hover:shadow-md dark:bg-card"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-base" style={{ backgroundColor: subj.soft }}>
                    {subj.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-xs font-bold" style={{ color: subj.color }}>
                      Dernier cours : {lesson!.title}
                    </span>
                    <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{lesson!.summary}</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                      Relire le résumé <BookOpen className="size-3" />
                    </span>
                  </span>
                </button>
              ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {data.slots.map((s) => `${s.startTime} ${s.subjectLabel}`).join(" · ")}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptySubject({ label, onNew }: { label: string; onNew: () => void }) {
  return (
    <div className="dot-grid pop-card flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="animate-float-y text-5xl">🗒️</div>
      <h3 className="mt-4 font-display text-lg font-bold">Pas encore de résumé en {label}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Après le prochain cours, dicte tout ce que tu as retenu — l'IA le transforme en fiche claire pour toute la classe.
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
  isEmail?: boolean;
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
  const isDelegue = myRole === "delegue";
  const invites = useQuery(api.invites.list, {}) as
    | { _id: Id<"invites">; email: string; status: string; createdAt: number }[]
    | undefined;
  const inviteByEmail = useMutation(api.invites.inviteByEmail);
  const revoke = useMutation(api.invites.revoke);
  const saveDelegueSession = useAction(api.delegueEcoleDirecte.saveDelegueSession);
  const finishDelegueSession = useAction(api.delegueEcoleDirecte.finishDelegueSession);
  const syncFromDelegue = useAction(api.delegueEcoleDirecte.syncFromDelegue);

  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [edIdent, setEdIdent] = useState("");
  const [edPass, setEdPass] = useState("");
  const [edLoading, setEdLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [edTwoFa, setEdTwoFa] = useState<{ handle: string; question: string; choices: { label: string; value: string }[] } | null>(null);
  const [edAnswering, setEdAnswering] = useState(false);

  const handleInvite = async () => {
    if (!className) return;
    const v = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      toast.error("E-mail invalide.");
      return;
    }
    setInviting(true);
    try {
      await inviteByEmail({ email: v, className });
      toast.success(`Invitation envoyée à ${v} ✨ — il pourra rejoindre avec son e-mail.`);
      setEmail("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible d'inviter.");
    } finally {
      setInviting(false);
    }
  };

  const handleConnectEd = async () => {
    if (!edIdent.trim() || !edPass) {
      toast.error("Renseigne ton identifiant et ton mot de passe EcoleDirecte.");
      return;
    }
    setEdLoading(true);
    try {
      const res = (await saveDelegueSession({ identifiant: edIdent.trim(), motdepasse: edPass })) as any;
      if (res?.ok === true) {
        toast.success("EcoleDirecte connecté ! Tu peux maintenant synchroniser.");
        setEdPass("");
        setEdTwoFa(null);
      } else if (res?.twoFa) {
        setEdTwoFa({ handle: res.handle, question: res.question, choices: res.choices });
        toast.info("Vérification demandée par EcoleDirecte — choisis ta réponse ci-dessous.");
      } else if (res?.ok === false) {
        toast.error(res.message ?? "Connexion EcoleDirecte échouée.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connexion EcoleDirecte échouée.");
    } finally {
      setEdLoading(false);
    }
  };

  const handleAnswerTwoFa = async (choixValue: string) => {
    if (!edTwoFa) return;
    setEdAnswering(true);
    try {
      const res = (await finishDelegueSession({
        handle: edTwoFa.handle,
        choixValue,
        identifiant: edIdent.trim(),
        motdepasse: edPass,
      })) as any;
      if (res?.ok === true) {
        toast.success("Vérification réussie — EcoleDirecte connecté ! Tu peux synchroniser.");
        setEdTwoFa(null);
        setEdPass("");
      } else if (res?.twoFa) {
        setEdTwoFa({ handle: res.handle, question: res.question, choices: res.choices });
        toast.info(res.message ?? "EcoleDirecte demande une autre vérification.");
      } else {
        toast.error(res?.message ?? "Réponse refusée — réessaie.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vérification échouée.");
    } finally {
      setEdAnswering(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncFromDelegue({}) as any;
      if (!res.ok) {
        toast.error(res.message ?? "Synchronisation échouée.");
      } else {
        toast.success(`Synchronisé ! ${res.added} ajoutés, ${res.updated} mis à jour, ${res.timetable} créneaux d'emploi du temps.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Synchronisation échouée.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section aria-label="Ma classe" className="space-y-5">
      <div className="dot-grid pop-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="animate-float-y flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl shadow-sm">🎓</div>
          <div>
            <h2 className="font-display text-xl font-bold">Ma classe{className ? ` · ${className}` : ""}</h2>
            <p className="text-sm text-muted-foreground">
              {classmates === undefined
                ? "…"
                : `${classmates.length} élève${classmates.length > 1 ? "s" : ""} connecté${classmates.length > 1 ? "s" : ""} dans l'espace de la classe`}
            </p>
          </div>
        </div>
        {isDelegue && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-bold text-amber-800 shadow-sm">
            ⭐ Tu es le délégué — tes publications sont visibles par toute la classe
          </span>
        )}
      </div>

      {/* Inviter = réservé délégué, EcoleDirecte = pour tout le monde */}
      <div className="grid gap-4 lg:grid-cols-2">
        {isDelegue && (
          <div className="pop-card p-5 sm:p-6">
            <h3 className="flex items-center gap-2 font-display text-base font-bold">
              <Mail className="size-4 text-primary" />
              Inviter par e-mail
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Envoie le lien du site à tes camarades : tu les invites ici par e-mail, ils rejoignent directement avec
              la connexion par e-mail.
            </p>
            <div className="mt-4 flex gap-2">
              <Input placeholder="camarade@exemple.fr" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void handleInvite()} />
              <Button onClick={() => void handleInvite()} disabled={inviting} className="shrink-0 gap-1.5 rounded-full font-bold">
                {inviting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Inviter
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Le camarade s'inscrit ensuite sur la page de connexion avec le même e-mail — il arrive direct dans ta
              classe.
            </p>

            {invites !== undefined && invites.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground">Invitations</p>
                <ul className="grid gap-1.5">
                  {invites.slice(0, 8).map((inv) => (
                    <li key={inv._id} className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 truncate">
                        <Mail className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{inv.email}</span>
                        <Badge variant={inv.status === "pending" ? "secondary" : inv.status === "accepted" ? "default" : "outline"} className="rounded-full text-[10px]">
                          {inv.status === "pending" ? "en attente" : inv.status === "accepted" ? "acceptée" : "révoquée"}
                        </Badge>
                      </span>
                      {inv.status === "pending" && (
                        <Button size="sm" variant="ghost" className="h-7 shrink-0 rounded-full text-xs" onClick={() => void revoke({ inviteId: inv._id })}>
                          Révoquer
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="pop-card p-5 sm:p-6">
            <h3 className="flex items-center gap-2 font-display text-base font-bold">
              <ShieldCheck className="size-4 text-emerald-600" />
              EcoleDirecte — synchronisation
            </h3>
            {!isDelegue && (
              <p className="mt-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                ✨ Connecte ton EcoleDirecte : tes devoirs + ton emploi du temps alimentent toute la classe.
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              Connecte ton EcoleDirecte une fois : tu synchronises les devoirs et l'emploi du temps pour toute la
              classe en un clic.
            </p>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ed-ident" className="flex items-center gap-1.5 text-xs">
                  <GraduationCap className="size-3.5" /> Identifiant EcoleDirecte
                </Label>
                <Input id="ed-ident" value={edIdent} onChange={(e) => setEdIdent(e.target.value)} placeholder="ton identifiant" autoComplete="username" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ed-pass" className="flex items-center gap-1.5 text-xs">
                  Mot de passe
                </Label>
                <Input id="ed-pass" type="password" value={edPass} onChange={(e) => setEdPass(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void handleConnectEd()} disabled={edLoading} variant="outline" className="gap-1.5 rounded-full font-bold">
                  {edLoading ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
                  Connecter EcoleDirecte
                </Button>
                <Button onClick={() => void handleSync()} disabled={syncing} className="gap-1.5 rounded-full font-bold">
                  {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Synchroniser devoirs + EDT
                </Button>
              </div>
              {edTwoFa && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-900">🔐 Vérification EcoleDirecte</p>
                  <p className="mt-1 text-sm text-amber-800">{edTwoFa.question}</p>
                  <div className="mt-3 grid gap-2">
                    {edTwoFa.choices.map((c) => (
                      <Button
                        key={c.value}
                        variant="outline"
                        disabled={edAnswering}
                        onClick={() => void handleAnswerTwoFa(c.value)}
                        className="justify-start rounded-xl bg-white text-left font-medium hover:bg-amber-100"
                      >
                        {edAnswering ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        {c.label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 rounded-full text-xs"
                    onClick={() => setEdTwoFa(null)}
                  >
                    Annuler
                  </Button>
                </div>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                Tes identifiants ne sont jamais montrés aux élèves — seule la session chiffrée est conservée côté
                serveur pour la synchronisation.
              </p>
            </div>
          </div>
        </div>

      {classmates === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pop-card h-20 animate-pulse" />
          ))}
        </div>
      ) : classmates.length === 0 ? (
        <div className="dot-grid pop-card flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="animate-float-y text-5xl">🫂</div>
          <h3 className="mt-4 font-display text-lg font-bold">Tu es le premier de ta classe !</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Partage le site avec tes camarades : dès qu'ils se connectent avec leur e-mail, ils apparaissent ici.
            {isDelegue ? " Invite-les juste au-dessus par e-mail." : ""}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {classmates.map((m) => (
            <motion.li key={m._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <div className={`pop-card pop-card-hover flex items-center gap-3.5 p-4 ${m.isMe ? "ring-2 ring-primary/40" : ""}`}>
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-white shadow-sm ${m.classRole === "delegue" ? "bg-amber-500" : "bg-primary"}`}
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
                    {m.isMe && <span className="ml-1.5 text-xs font-bold text-primary">· toi</span>}
                  </p>
                  <p className={`text-xs font-bold ${m.classRole === "delegue" ? "text-amber-600" : "text-muted-foreground"}`}>
                    {m.classRole === "delegue" ? "⭐ Délégué de la classe" : "🎓 Élève"}
                    {m.isEmail ? " · ✉️ e-mail" : ""}
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
