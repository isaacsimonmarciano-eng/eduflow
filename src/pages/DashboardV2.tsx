import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SUBJECTS, subjectOf } from "@/lib/subjects";
import { formatDateFR, todayISO } from "@/lib/dates";
import Devoirs, { type Homework, type Importance } from "@/components/Devoirs";
import Questions from "@/components/Questions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { summarizeNotesOfflineAware } from "@/lib/ai-offline-guard";
import { isDemoMode } from "@/demo/mode";
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
  MessageCircleQuestion,
  Mic,
  PenLine,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
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

type DashboardView = "cours" | "devoirs" | "questions" | "classe";

type Classmate = {
  _id: string;
  name: string;
  classRole: "eleve" | "delegue";
  isMe: boolean;
  isEmail?: boolean;
};

type TomorrowData = {
  date: string;
  slots: {
    date: string;
    startTime: string;
    endTime: string;
    subjectLabel: string;
    subjectKey: string;
    teacher?: string;
    room?: string;
  }[];
  recentBySubject: Record<string, Lesson[]>;
};

const JOVIAL_PHRASES = [
  "Un petit coup d'œil ce soir et demain tu brilles ✨",
  "Révise léger ce soir, assure en classe demain 😎",
  "10 minutes ce soir = zéro stress demain 💪",
  "Un résumé relu = un cours déjà à moitié appris 🌟",
];

function pickJovial(dateISO: string) {
  const total = [...dateISO].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return JOVIAL_PHRASES[total % JOVIAL_PHRASES.length];
}

export default function DashboardV2() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const lessons = useQuery(api.lessons.listAll, {}) as Lesson[] | undefined;
  const homework = useQuery(api.homework.list, {}) as Homework[] | undefined;
  const classmates = useQuery(api.users.listClassmates, {}) as Classmate[] | undefined;
  const saveLesson = useMutation(api.lessons.save);
  const publishLesson = useMutation(api.lessons.publish);
  const removeLesson = useMutation(api.lessons.remove);
  const addHomework = useMutation(api.homework.add);
  const toggleHomework = useMutation(api.homework.toggleDone);
  const removeHomework = useMutation(api.homework.remove);
  const summarizeNotes = useAction(api.ai.summarizeNotes);

  const [selected, setSelected] = useState(SUBJECTS[0].key);
  const [view, setView] = useState<DashboardView>("cours");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"lessons"> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    subjectKey: SUBJECTS[0].key,
    date: todayISO(),
    notes: "",
    title: "",
    summary: "",
    keyPoints: "",
  });

  const bySubject = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const lesson of lessons ?? []) {
      const list = map.get(lesson.subjectKey) ?? [];
      list.push(lesson);
      map.set(lesson.subjectKey, list);
    }
    return map;
  }, [lessons]);

  const current = subjectOf(selected);
  const subjectLessons = bySubject.get(selected) ?? [];

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

  const openEdit = (lesson: Lesson) => {
    setEditingId(lesson._id);
    setForm({
      subjectKey: lesson.subjectKey,
      date: lesson.date,
      notes: lesson.notes ?? "",
      title: lesson.title,
      summary: lesson.summary,
      keyPoints: lesson.keyPoints.join("\n"),
    });
    setEditorOpen(true);
  };

  const handleGenerate = async () => {
    if (form.notes.trim().length < 10) {
      toast.error("Écris d'abord quelques mots de ton cours.");
      return;
    }
    setGenerating(true);
    try {
      const result = await summarizeNotesOfflineAware(
        summarizeNotes as unknown as (args: { notes: string; subjectLabel: string; date: string }) => Promise<{ title: string; summary: string; keyPoints: string[] }>,
        { notes: form.notes, subjectLabel: subjectOf(form.subjectKey).label, date: form.date },
      );
      setForm((previous) => ({
        ...previous,
        title: result.title || previous.title,
        summary: result.summary || previous.summary,
        keyPoints: result.keyPoints.length ? result.keyPoints.join("\n") : previous.keyPoints,
      }));
      if (isDemoMode() || !navigator.onLine) toast.success("Résumé généré hors-ligne ✨ — aucune connexion nécessaire.");
      else toast.success("Résumé généré. Vérifie-le avant de publier.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'IA n'a pas répondu.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (publish: boolean) => {
    if (!form.title.trim() || !form.summary.trim()) {
      toast.error("Ajoute un titre et un résumé.");
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
          .map((item) => item.trim())
          .filter(Boolean),
        notes: form.notes.trim() ? form.notes : undefined,
        publish,
      });
      setEditorOpen(false);
      toast.success(publish ? "Résumé publié pour la classe 🎉" : "Brouillon enregistré.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
    }
  };

  const handleAddHomework = async (data: {
    subjectKey: string;
    dueDate: string;
    text: string;
    emoji: string;
    importance?: Importance;
  }) => {
    await addHomework(data);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const nav = [
    { key: "cours" as const, label: "Cours", icon: BookOpen },
    { key: "devoirs" as const, label: "Devoirs", icon: ClipboardList },
    { key: "questions" as const, label: "Questions", icon: MessageCircleQuestion },
    { key: "classe" as const, label: "Ma classe", icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg text-primary-foreground shadow-sm">🎒</div>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-lg font-bold">Cartable Vivant</p>
              <p className="truncate text-xs text-muted-foreground">
                Salut{user?.name ? ` ${user.name}` : ""}{user?.className ? ` · ${user.className}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === "cours" && (
              <Button onClick={openNew} className="gap-2 rounded-full font-bold">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Nouveau résumé</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => void handleSignOut()} aria-label="Se déconnecter">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-7 sm:px-6">
        <TomorrowRevision
          onSelectSubject={(key) => {
            setSelected(key);
            setView("cours");
          }}
        />

        <nav className="my-6 flex w-full gap-1 overflow-x-auto rounded-2xl border bg-card p-1 shadow-sm sm:w-fit" aria-label="Navigation principale">
          {nav.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                view === key ? "text-primary-foreground" : "text-foreground/70 hover:text-foreground"
              }`}
            >
              {view === key && (
                <motion.span layoutId="dashboard-nav" className="absolute inset-0 rounded-xl bg-primary" />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="size-4" /> {label}
              </span>
            </button>
          ))}
        </nav>

        {view === "devoirs" && (
          <Devoirs
            homework={homework}
            onAdd={handleAddHomework}
            onToggle={async (id) => {
              try {
                await toggleHomework({ id });
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Impossible de modifier ce devoir.");
              }
            }}
            onRemove={async (id) => {
              try {
                await removeHomework({ id });
                toast.success("Devoir supprimé.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Impossible de supprimer ce devoir.");
              }
            }}
          />
        )}

        {view === "questions" && <Questions />}

        {view === "classe" && (
          <ClassSpace
            classmates={classmates}
            className={user?.className ?? undefined}
            isDelegue={user?.classRole === "delegue"}
          />
        )}

        {view === "cours" && (
          <>
            <section aria-label="Matières">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold">📚 Les matières</h2>
                <span className="text-sm text-muted-foreground">
                  {lessons === undefined ? "…" : `${lessons.length} résumé${lessons.length > 1 ? "s" : ""}`}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {SUBJECTS.map((subject) => {
                  const active = subject.key === selected;
                  const count = bySubject.get(subject.key)?.length ?? 0;
                  return (
                    <button
                      key={subject.key}
                      onClick={() => setSelected(subject.key)}
                      className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold ${active ? "border-transparent text-white shadow-md" : "bg-card"}`}
                      style={active ? { backgroundColor: subject.color } : undefined}
                    >
                      {subject.emoji} {subject.label}
                      {count > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{count}</span>}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl text-xl" style={{ backgroundColor: current.soft }}>{current.emoji}</span>
                  <div>
                    <h1 className="font-display text-2xl font-bold">{current.label}</h1>
                    <p className="text-sm text-muted-foreground">Tous les élèves peuvent contribuer aux résumés de la classe.</p>
                  </div>
                </div>
                <Button variant="outline" onClick={openNew} className="gap-2 rounded-full font-bold">
                  <Mic className="size-4" /> Ajouter un cours
                </Button>
              </div>

              {lessons === undefined ? (
                <div className="grid gap-4 md:grid-cols-2"><div className="pop-card h-40 animate-pulse" /><div className="pop-card h-40 animate-pulse" /></div>
              ) : subjectLessons.length === 0 ? (
                <div className="pop-card p-10 text-center">
                  <p className="text-4xl">🗒️</p>
                  <h3 className="mt-3 font-bold">Aucun résumé en {current.label}</h3>
                  <Button onClick={openNew} className="mt-5 rounded-full">Ajouter le premier</Button>
                </div>
              ) : (
                <ol className="space-y-4">
                  <AnimatePresence initial={false}>
                    {subjectLessons.map((lesson) => {
                      const subject = subjectOf(lesson.subjectKey);
                      return (
                        <motion.li key={lesson._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                          <article className={`pop-card overflow-hidden ${lesson.status === "draft" ? "border-dashed" : ""}`}>
                            <div className="h-1.5" style={{ backgroundColor: subject.color }} />
                            <div className="p-5 sm:p-6">
                              <div className="flex flex-wrap gap-2 text-xs font-bold">
                                <span className="rounded-full px-2.5 py-1" style={{ backgroundColor: subject.soft, color: subject.color }}>
                                  <CalendarDays className="mr-1 inline size-3.5" /> {formatDateFR(lesson.date)}
                                </span>
                                <Badge variant={lesson.status === "draft" ? "outline" : "default"} className="rounded-full">
                                  {lesson.status === "draft" ? "Brouillon" : "Publié"}
                                </Badge>
                                <span className="inline-flex items-center gap-1 text-muted-foreground"><UserRound className="size-3.5" /> {lesson.authorName}</span>
                              </div>
                              <h3 className="mt-3 font-display text-lg font-bold">{lesson.title}</h3>
                              <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{lesson.summary}</p>
                              {lesson.keyPoints.length > 0 && (
                                <ul className="mt-4 grid gap-1.5">
                                  {lesson.keyPoints.map((point, index) => (
                                    <li key={`${lesson._id}-${index}`} className="flex gap-2 text-sm"><span className="font-bold text-primary">{index + 1}.</span>{point}</li>
                                  ))}
                                </ul>
                              )}
                              {lesson.canEdit && (
                                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                                  {lesson.status === "draft" && (
                                    <Button size="sm" className="rounded-full" onClick={async () => {
                                      try { await publishLesson({ id: lesson._id }); toast.success("Résumé publié."); }
                                      catch (error) { toast.error(error instanceof Error ? error.message : "Publication impossible."); }
                                    }}><Send className="mr-1 size-3.5" /> Publier</Button>
                                  )}
                                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(lesson)}><PenLine className="mr-1 size-3.5" /> Modifier</Button>
                                  <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={async () => {
                                    if (!confirm("Supprimer ce résumé ?")) return;
                                    try { await removeLesson({ id: lesson._id }); toast.success("Résumé supprimé."); }
                                    catch (error) { toast.error(error instanceof Error ? error.message : "Suppression impossible."); }
                                  }}><Trash2 className="mr-1 size-3.5" /> Supprimer</Button>
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
          </>
        )}
      </main>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifier le résumé" : "Nouveau résumé de cours"}</DialogTitle>
            <DialogDescription>Ajoute tes notes, laisse l'IA préparer le résumé, puis vérifie avant de publier.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Matière</Label><select value={form.subjectKey} onChange={(event) => setForm((previous) => ({ ...previous, subjectKey: event.target.value }))} className="mt-1 h-9 w-full rounded-xl border bg-card px-3 text-sm">{SUBJECTS.map((subject) => <option key={subject.key} value={subject.key}>{subject.emoji} {subject.label}</option>)}</select></div>
              <div><Label>Date</Label><Input className="mt-1" type="date" value={form.date} onChange={(event) => setForm((previous) => ({ ...previous, date: event.target.value }))} /></div>
            </div>
            <div><Label>Notes du cours</Label><Textarea className="mt-1 min-h-32" value={form.notes} onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))} placeholder="Écris ce que tu as retenu du cours…" /></div>
            <Button type="button" variant={editingId ? "outline" : "default"} onClick={() => void handleGenerate()} disabled={generating} className="rounded-full">
              {generating ? <><Loader2 className="mr-2 size-4 animate-spin" />Création du résumé…</> : <>✨ Générer avec l'IA</>}
            </Button>
            <div><Label>Titre</Label><Input className="mt-1" value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} /></div>
            <div><Label>Résumé</Label><Textarea className="mt-1 min-h-32" value={form.summary} onChange={(event) => setForm((previous) => ({ ...previous, summary: event.target.value }))} /></div>
            <div><Label>Points clés, un par ligne</Label><Textarea className="mt-1" value={form.keyPoints} onChange={(event) => setForm((previous) => ({ ...previous, keyPoints: event.target.value }))} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => void handleSave(false)}>Brouillon</Button>
            <Button onClick={() => void handleSave(true)}><Send className="mr-1 size-4" /> Publier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TomorrowRevision({ onSelectSubject }: { onSelectSubject: (key: string) => void }) {
  const data = useQuery(api.tomorrow.summary, {}) as TomorrowData | null | undefined;
  if (data === undefined) return <div className="pop-card h-28 animate-pulse" />;
  if (data === null) return null;

  const humanDate = formatDateFR(data.date);
  if (data.slots.length === 0) {
    return (
      <div className="pop-card flex items-center gap-4 p-5">
        <span className="text-3xl">🎉</span>
        <div><p className="font-bold">Demain · {humanDate} — pas de cours</p><p className="text-sm text-muted-foreground">Aucune matière à préparer dans l'emploi du temps synchronisé.</p></div>
      </div>
    );
  }

  const subjectKeys = [...new Set(data.slots.map((slot) => slot.subjectKey))];
  return (
    <section className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-indigo-50 p-5 shadow-sm dark:from-amber-950/20 dark:via-card dark:to-indigo-950/20 sm:p-6">
      <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">📅 Demain · {humanDate}</p>
      <h2 className="mt-2 font-display text-xl font-bold">Demain, révise ça 👇</h2>
      <p className="mt-1 text-sm text-muted-foreground">{pickJovial(data.date)} On te montre uniquement des résumés réellement présents dans la classe.</p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {subjectKeys.map((key) => {
          const subject = subjectOf(key);
          const suggestions = data.recentBySubject[key] ?? [];
          return (
            <div key={key} className="rounded-2xl border bg-white/90 p-4 shadow-sm dark:bg-card">
              <button onClick={() => onSelectSubject(key)} className="flex items-center gap-2 font-bold" style={{ color: subject.color }}>
                <span className="flex size-9 items-center justify-center rounded-xl" style={{ backgroundColor: subject.soft }}>{subject.emoji}</span>
                {subject.label}
              </button>
              {suggestions.length === 0 ? (
                <p className="mt-3 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">Aucun résumé récent disponible.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {suggestions.map((lesson) => (
                    <button key={lesson._id} onClick={() => onSelectSubject(key)} className="block w-full rounded-xl border bg-background p-3 text-left transition hover:shadow-sm">
                      <span className="block text-sm font-bold">{lesson.title}</span>
                      <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{lesson.summary}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        <CalendarDays className="mr-1 inline size-3.5" /> {data.slots.map((slot) => `${slot.startTime} ${slot.subjectLabel}`).join(" · ")}
      </p>
    </section>
  );
}

function ClassSpace({ classmates, className, isDelegue }: { classmates: Classmate[] | undefined; className?: string; isDelegue: boolean }) {
  const invites = useQuery(api.invites.list, {}) as { _id: Id<"invites">; email: string; status: string }[] | undefined;
  const inviteByEmail = useMutation(api.invites.inviteByEmail);
  const revoke = useMutation(api.invites.revoke);
  const saveSession = useAction(api.delegueEcoleDirecte.saveDelegueSession);
  const finishSession = useAction(api.delegueEcoleDirecte.finishDelegueSession);
  const sync = useAction(api.delegueEcoleDirecte.syncFromDelegue);
  const [email, setEmail] = useState("");
  const [ident, setIdent] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [twoFa, setTwoFa] = useState<{ handle: string; question: string; choices: { label: string; value: string }[] } | null>(null);

  const connectEd = async () => {
    if (!ident.trim() || !password) return toast.error("Renseigne ton identifiant et ton mot de passe EcoleDirecte.");
    setLoading(true);
    try {
      const result = await saveSession({ identifiant: ident.trim(), motdepasse: password });
      if (result.ok) {
        setPassword("");
        setTwoFa(null);
        toast.success("EcoleDirecte connecté.");
      } else if ("twoFa" in result && result.twoFa) {
        setTwoFa({ handle: result.handle, question: result.question, choices: result.choices });
      } else {
        toast.error("message" in result ? result.message : "Connexion EcoleDirecte impossible.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connexion EcoleDirecte impossible.");
    } finally {
      setLoading(false);
    }
  };

  const answerTwoFa = async (value: string) => {
    if (!twoFa) return;
    setLoading(true);
    try {
      const result = await finishSession({ handle: twoFa.handle, choixValue: value, identifiant: ident.trim(), motdepasse: password });
      if (result.ok) {
        setTwoFa(null);
        setPassword("");
        toast.success("EcoleDirecte connecté.");
      } else if ("twoFa" in result && result.twoFa) {
        setTwoFa({ handle: result.handle, question: result.question, choices: result.choices });
      } else {
        toast.error("message" in result ? result.message : "Vérification refusée.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Vérification impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="pop-card p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">🎓 Ma classe{className ? ` · ${className}` : ""}</h2>
        <p className="text-sm text-muted-foreground">Cours, devoirs, questions et synchronisation sont partagés avec la classe.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {isDelegue && (
          <div className="pop-card p-5">
            <h3 className="flex items-center gap-2 font-bold"><Mail className="size-4" /> Inviter un élève</h3>
            <div className="mt-3 flex gap-2"><Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="camarade@exemple.fr" /><Button onClick={async () => {
              if (!className || !email.trim()) return;
              try { await inviteByEmail({ email: email.trim().toLowerCase(), className }); setEmail(""); toast.success("Invitation créée."); }
              catch (error) { toast.error(error instanceof Error ? error.message : "Invitation impossible."); }
            }}>Inviter</Button></div>
            {invites && invites.length > 0 && <div className="mt-3 space-y-1">{invites.slice(0, 8).map((invite) => <div key={invite._id} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm"><span>{invite.email} · {invite.status}</span>{invite.status === "pending" && <button className="text-xs text-destructive" onClick={() => void revoke({ inviteId: invite._id })}>Révoquer</button>}</div>)}</div>}
          </div>
        )}

        <div className="pop-card p-5">
          <h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="size-4 text-emerald-600" /> EcoleDirecte</h3>
          <p className="mt-1 text-sm text-muted-foreground">Chaque élève peut connecter son compte pour synchroniser devoirs et emploi du temps de la classe.</p>
          <div className="mt-4 grid gap-2">
            <Label>Identifiant</Label><Input value={ident} onChange={(event) => setIdent(event.target.value)} />
            <Label>Mot de passe</Label><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" disabled={loading} onClick={() => void connectEd()}>{loading ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Link2 className="mr-1 size-4" />}Connecter</Button>
              <Button disabled={syncing} onClick={async () => {
                setSyncing(true);
                try {
                  const result = await sync({});
                  if (result.ok) toast.success(`Synchronisé : ${result.added} ajoutés, ${result.updated} mis à jour, ${result.timetable} créneaux EDT.`);
                  else toast.error(result.message ?? "Synchronisation impossible.");
                } catch (error) { toast.error(error instanceof Error ? error.message : "Synchronisation impossible."); }
                finally { setSyncing(false); }
              }}>{syncing ? <Loader2 className="mr-1 size-4 animate-spin" /> : <RefreshCw className="mr-1 size-4" />}Synchroniser</Button>
            </div>
            {twoFa && <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="font-bold text-amber-900">🔐 {twoFa.question}</p><div className="mt-3 grid gap-2">{twoFa.choices.map((choice) => <Button key={choice.value} variant="outline" onClick={() => void answerTwoFa(choice.value)}>{choice.label}</Button>)}</div></div>}
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 font-bold">Élèves connectés</h3>
        {classmates === undefined ? <p className="text-sm text-muted-foreground">Chargement…</p> : classmates.length === 0 ? <p className="pop-card p-8 text-center text-sm text-muted-foreground">Aucun autre élève connecté pour le moment.</p> : <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{classmates.map((student) => <li key={student._id} className="pop-card flex items-center gap-3 p-4"><span className="flex size-10 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{student.name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase()}</span><div className="min-w-0"><p className="truncate font-bold">{student.name}{student.isMe ? " · toi" : ""}</p><p className="text-xs text-muted-foreground">{student.classRole === "delegue" ? "⭐ Délégué" : "🎓 Élève"}</p></div></li>)}</ul>}
      </div>
    </section>
  );
}
