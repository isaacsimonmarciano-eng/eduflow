import { useDemo } from "@/demo/store";
import { OfflineBanner } from "@/components/OfflineBanner";
import { localDetectSubjectAndFormat, localSummarize } from "@/lib/offline-summary";
import { SUBJECTS, subjectOf } from "@/lib/subjects";
import { formatDateFR, todayISO } from "@/lib/dates";
import Devoirs, { type Homework, type Importance } from "@/components/Devoirs";
import Questions from "@/components/QuestionsDemo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CalendarDays, ClipboardList, GraduationCap, Link2, Loader2, LogOut, Mail, MessageCircleQuestion, Mic, PenLine, Plus, RefreshCw, Send, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router";

type Lesson = {
  _id: string;
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

export default function DashboardDemo() {
  const demo = useDemo();
  const navigate = useNavigate();
  const { state, currentUser } = demo;

  const lessons = useMemo(() => {
    const className = currentUser?.className;
    const meId = currentUser?._id;
    return (state.lessons as unknown as Lesson[])
      .filter((l: any) => l.className === className)
      .filter((l: any) => l.status === "published" || l.createdBy === meId)
      .sort((a: any, b: any) => (a.date === b.date ? (b.createdAt as number) - (a.createdAt as number) : a.date < b.date ? 1 : -1))
      .map((l: any) => ({ ...l, canEdit: l.createdBy === meId, authorName: l.authorName }));
  }, [state.lessons, currentUser]);

  const homework = useMemo(() => {
    const className = currentUser?.className;
    const meId = currentUser?._id;
    const rows = (state.homework as any[]).filter((h: any) => h.className === className);
    // keep all for demo (not only gte today) so the demo looks populated offline
    rows.sort((a: any, b: any) => a.dueDate.localeCompare(b.dueDate));
    return rows.map((h: any) => ({
      _id: h._id, subjectKey: h.subjectKey, dueDate: h.dueDate, text: h.text, emoji: h.emoji, done: meId ? h.doneBy.includes(meId) : false, doneCount: h.doneBy.length, mine: h.createdBy === meId, source: h.source as "ecoledirecte" | "manuel", subjectLabel: h.subjectLabel, teacher: h.teacher, isTest: h.isTest, importance: h.importance as Importance | undefined, edDone: h.edDone,
    })) as unknown as Homework[];
  }, [state.homework, currentUser]);

  const classmates = useMemo(() => {
    const className = currentUser?.className;
    if (!className) return [] as { _id: string; name: string; classRole: "eleve" | "delegue"; isMe: boolean; isEmail?: boolean }[];
    return state.users
      .filter((u) => u.className === className)
      .map((u) => ({ _id: u._id, name: u.name, classRole: u.classRole, isMe: u._id === currentUser?._id, isEmail: (u.edUserId ?? "").startsWith("email:") }))
      .sort((a, b) => (a.classRole !== b.classRole ? (a.classRole === "delegue" ? -1 : 1) : a.name.localeCompare(b.name, "fr")));
  }, [state.users, currentUser]);

  const bySubject = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const l of lessons) {
      const list = map.get(l.subjectKey) ?? [];
      list.push(l);
      map.set(l.subjectKey, list);
    }
    return map;
  }, [lessons]);

  const [selected, setSelected] = useState(SUBJECTS[0].key);
  const [view, setView] = useState<DashboardView>("cours");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ subjectKey: SUBJECTS[0].key, date: todayISO(), notes: "", title: "", summary: "", keyPoints: "" });
  const [generating, setGenerating] = useState(false);

  const current = subjectOf(selected);
  const subjectLessons = bySubject.get(selected) ?? [];

  const openNew = () => {
    setEditingId(null);
    setForm({ subjectKey: selected, date: todayISO(), notes: "", title: "", summary: "", keyPoints: "" });
    setEditorOpen(true);
  };
  const openEdit = (l: Lesson) => {
    setEditingId(l._id);
    setForm({ subjectKey: l.subjectKey, date: l.date, notes: l.notes ?? "", title: l.title, summary: l.summary, keyPoints: l.keyPoints.join("\n") });
    setEditorOpen(true);
  };

  const handleGenerate = async () => {
    if (form.notes.trim().length < 10) { toast.error("Écris d'abord quelques mots de ton cours."); return; }
    setGenerating(true);
    try {
      const res = localSummarize(form.notes, subjectOf(form.subjectKey).label);
      setForm((f) => ({ ...f, title: res.title || f.title, summary: res.summary || f.summary, keyPoints: res.keyPoints.length ? res.keyPoints.join("\n") : f.keyPoints }));
      toast.success("Résumé généré hors-ligne ✨ — aucune connexion nécessaire.");
    } finally { setGenerating(false); }
  };

  const handleSave = async (publish: boolean) => {
    if (!form.title.trim() || !form.summary.trim()) { toast.error("Ajoute un titre et un résumé."); return; }
    const keyPoints = form.keyPoints.split("\n").map((k) => k.trim()).filter(Boolean);
    if (editingId) {
      // patch via store's hidden updater exposed on createLesson.update
      const updater = (demo.createLesson as unknown as { update?: (id: string, patch: Record<string, unknown>) => void }).update;
      if (updater) {
        updater(editingId, { subjectKey: form.subjectKey, date: form.date, title: form.title, summary: form.summary, keyPoints, notes: form.notes.trim() || undefined, publish });
      } else {
        // fallback: remove + create
        demo.removeLesson(editingId);
        demo.createLesson({ subjectKey: form.subjectKey, date: form.date, title: form.title, summary: form.summary, keyPoints, notes: form.notes.trim() || undefined, publish });
      }
      toast.success(publish ? "Résumé publié pour la classe 🎉" : "Brouillon enregistré.");
    } else {
      demo.createLesson({ subjectKey: form.subjectKey, date: form.date, title: form.title, summary: form.summary, keyPoints, notes: form.notes.trim() || undefined, publish });
      toast.success(publish ? "Résumé publié pour la classe 🎉" : "Brouillon enregistré.");
    }
    setEditorOpen(false);
  };

  const handleSignOut = () => {
    demo.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-lg text-primary-foreground shadow-sm">🎒</div>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-display text-lg font-bold">Cartable Vivant <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">DÉMO</span></p>
              <p className="truncate text-xs text-muted-foreground">Salut{currentUser?.name ? ` ${currentUser.name}` : ""}{currentUser?.className ? ` · ${currentUser.className}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === "cours" && <Button onClick={openNew} className="gap-2 rounded-full font-bold"><Plus className="size-4" /><span className="hidden sm:inline">Nouveau résumé</span></Button>}
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => void handleSignOut()} aria-label="Se déconnecter"><LogOut className="size-4" /></Button>
          </div>
        </div>
      </header>
      <OfflineBanner />

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-7 sm:px-6">
        <TomorrowDemo onSelectSubject={(k) => { setSelected(k); setView("cours"); }} />

        <nav className="my-6 flex w-full gap-1 overflow-x-auto rounded-2xl border bg-card p-1 shadow-sm sm:w-fit">
          {[
            { key: "cours" as const, label: "Cours", icon: BookOpen },
            { key: "devoirs" as const, label: "Devoirs", icon: ClipboardList },
            { key: "questions" as const, label: "Questions", icon: MessageCircleQuestion },
            { key: "classe" as const, label: "Ma classe", icon: Users },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setView(key)} className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${view === key ? "text-primary-foreground" : "text-foreground/70 hover:text-foreground"}`}>
              {view === key && <motion.span layoutId="demo-nav" className="absolute inset-0 rounded-xl bg-primary" />}
              <span className="relative z-10 flex items-center gap-2"><Icon className="size-4" /> {label}</span>
            </button>
          ))}
        </nav>

        {view === "devoirs" && (
          <Devoirs
            homework={homework}
            onAdd={async (data) => { demo.addHomework(data); }}
            onToggle={async (id) => { demo.toggleHomework(id as unknown as string); }}
            onRemove={async (id) => { demo.removeHomework(id as unknown as string); }}
          />
        )}
        {view === "questions" && <Questions />}
        {view === "classe" && <ClassSpaceDemo classmates={classmates as any} className={currentUser?.className} isDelegue={currentUser?.classRole === "delegue"} />}
        {view === "cours" && (
          <>
            <section aria-label="Matières">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold">📚 Les matières</h2>
                <span className="text-sm text-muted-foreground">{lessons.length} résumé{lessons.length > 1 ? "s" : ""}</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {SUBJECTS.map((s) => {
                  const active = s.key === selected;
                  const count = bySubject.get(s.key)?.length ?? 0;
                  return (
                    <button key={s.key} onClick={() => setSelected(s.key)} className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold ${active ? "border-transparent text-white shadow-md" : "bg-card"}`} style={active ? { backgroundColor: s.color } : undefined}>
                      {s.emoji} {s.label} {count > 0 && <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{count}</span>}
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
                    <p className="text-sm text-muted-foreground">Mode démo : tout reste sur cet appareil, parfait pour la présentation.</p>
                  </div>
                </div>
                <Button variant="outline" onClick={openNew} className="gap-2 rounded-full font-bold"><Mic className="size-4" /> Ajouter un cours</Button>
              </div>
              {subjectLessons.length === 0 ? (
                <div className="pop-card p-10 text-center"><p className="text-4xl">🗒️</p><h3 className="mt-3 font-bold">Aucun résumé en {current.label}</h3><Button onClick={openNew} className="mt-5 rounded-full">Ajouter le premier</Button></div>
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
                                <span className="rounded-full px-2.5 py-1" style={{ backgroundColor: subject.soft, color: subject.color }}><CalendarDays className="mr-1 inline size-3.5" /> {formatDateFR(lesson.date)}</span>
                                <Badge variant={lesson.status === "draft" ? "outline" : "default"} className="rounded-full">{lesson.status === "draft" ? "Brouillon" : "Publié"}</Badge>
                                <span className="inline-flex items-center gap-1 text-muted-foreground"><UserRound className="size-3.5" /> {lesson.authorName}</span>
                              </div>
                              <h3 className="mt-3 font-display text-lg font-bold">{lesson.title}</h3>
                              <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{lesson.summary}</p>
                              {lesson.keyPoints.length > 0 && <ul className="mt-4 grid gap-1.5">{lesson.keyPoints.map((p, i) => <li key={i} className="flex gap-2 text-sm"><span className="font-bold text-primary">{i + 1}.</span>{p}</li>)}</ul>}
                              {lesson.canEdit && (
                                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                                  {lesson.status === "draft" && <Button size="sm" className="rounded-full" onClick={() => { demo.publishLesson(lesson._id); toast.success("Résumé publié."); }}><Send className="mr-1 size-3.5" /> Publier</Button>}
                                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(lesson)}><PenLine className="mr-1 size-3.5" /> Modifier</Button>
                                  <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => { if (!confirm("Supprimer ce résumé ?")) return; demo.removeLesson(lesson._id); toast.success("Résumé supprimé."); }}><Trash2 className="mr-1 size-3.5" /> Supprimer</Button>
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
          <DialogHeader><DialogTitle>{editingId ? "Modifier le résumé" : "Nouveau résumé de cours"}</DialogTitle><DialogDescription>Hors-ligne : le résumé est généré localement, sans envoi.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Matière</Label><select value={form.subjectKey} onChange={(e) => setForm((p) => ({ ...p, subjectKey: e.target.value }))} className="mt-1 h-9 w-full rounded-xl border bg-card px-3 text-sm">{SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}</select></div>
              <div><Label>Date</Label><Input className="mt-1" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></div>
            </div>
            <div><Label>Notes du cours</Label><Textarea className="mt-1 min-h-32" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Écris ce que tu as retenu…" /></div>
            <Button type="button" variant={editingId ? "outline" : "default"} onClick={() => void handleGenerate()} disabled={generating} className="rounded-full">{generating ? <><Loader2 className="mr-2 size-4 animate-spin" />Création…</> : <>✨ Générer hors-ligne</>}</Button>
            <div><Label>Titre</Label><Input className="mt-1" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
            <div><Label>Résumé</Label><Textarea className="mt-1 min-h-32" value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} /></div>
            <div><Label>Points clés, un par ligne</Label><Textarea className="mt-1" value={form.keyPoints} onChange={(e) => setForm((p) => ({ ...p, keyPoints: e.target.value }))} /></div>
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => void handleSave(false)}>Brouillon</Button><Button onClick={() => void handleSave(true)}><Send className="mr-1 size-4" /> Publier</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TomorrowDemo({ onSelectSubject }: { onSelectSubject: (k: string) => void }) {
  const { state, currentUser } = useDemo();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const human = formatDateFR(tomorrow);
  const className = currentUser?.className;
  const slots = state.slots.filter((s) => s.className === className && s.date === tomorrow).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const subjectKeys = [...new Set(slots.map((s) => s.subjectKey))];
  const lessons = state.lessons.filter((l) => l.className === className && l.status === "published" && l.date <= tomorrow);
  const recent: Record<string, typeof lessons> = {};
  for (const k of subjectKeys) recent[k] = lessons.filter((l) => l.subjectKey === k).sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt).slice(0, 3);
  if (!className) return null;
  if (slots.length === 0) {
    return (
      <div className="pop-card flex items-center gap-4 p-5">
        <span className="text-3xl">🎉</span>
        <div><p className="font-bold">Demain · {human} — pas de cours (démo)</p><p className="text-sm text-muted-foreground">Ajoute des créneaux via “Synchroniser (démo)”.</p></div>
      </div>
    );
  }
  return (
    <section className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-indigo-50 p-5 shadow-sm dark:from-amber-950/20 dark:via-card dark:to-indigo-950/20 sm:p-6">
      <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">📅 Demain · {human} · démo</p>
      <h2 className="mt-2 font-display text-xl font-bold">Demain, révise ça 👇</h2>
      <p className="mt-1 text-sm text-muted-foreground">Données démo locales — pas besoin de Wi-Fi.</p>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {subjectKeys.map((key) => {
          const subject = subjectOf(key);
          const suggestions = recent[key] ?? [];
          return (
            <div key={key} className="rounded-2xl border bg-white/90 p-4 shadow-sm dark:bg-card">
              <button onClick={() => onSelectSubject(key)} className="flex items-center gap-2 font-bold" style={{ color: subject.color }}>
                <span className="flex size-9 items-center justify-center rounded-xl" style={{ backgroundColor: subject.soft }}>{subject.emoji}</span>{subject.label}
              </button>
              {suggestions.length === 0 ? <p className="mt-3 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">Aucun résumé récent.</p> : <div className="mt-3 space-y-2">{suggestions.map((lesson) => <button key={lesson._id} onClick={() => onSelectSubject(key)} className="block w-full rounded-xl border bg-background p-3 text-left"><span className="block text-sm font-bold">{lesson.title}</span><span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{lesson.summary}</span></button>)}</div>}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground"><CalendarDays className="mr-1 inline size-3.5" /> {slots.map((s) => `${s.startTime} ${s.subjectLabel}`).join(" · ")}</p>
    </section>
  );
}

function ClassSpaceDemo({ classmates, className, isDelegue }: { classmates: { _id: string; name: string; classRole: "eleve" | "delegue"; isMe: boolean }[]; className?: string; isDelegue: boolean }) {
  const demo = useDemo();
  const [email, setEmail] = useState("");
  const [ident, setIdent] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [twoFa, setTwoFa] = useState<{ question: string; choices: string[] } | null>(null);
  const invites = demo.state.invites;

  return (
    <section className="space-y-5">
      <div className="pop-card p-5 sm:p-6"><h2 className="font-display text-xl font-bold">🎓 Ma classe{className ? ` · ${className}` : ""} <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">DÉMO</span></h2><p className="text-sm text-muted-foreground">Toutes les actions restent sur cet appareil.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">
        {isDelegue && (
          <div className="pop-card p-5">
            <h3 className="flex items-center gap-2 font-bold"><Mail className="size-4" /> Inviter un élève</h3>
            <div className="mt-3 flex gap-2"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="camarade@exemple.fr" /><Button onClick={() => { if (!email.trim()) return; demo.invite(email); setEmail(""); toast.success("Invitation créée (démo)."); }}>Inviter</Button></div>
            {invites.length > 0 && <div className="mt-3 space-y-1">{invites.slice(0, 8).map((inv) => <div key={inv._id} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm"><span>{inv.email} · {inv.status}</span>{inv.status === "pending" && <button className="text-xs text-destructive" onClick={() => demo.revokeInvite(inv._id)}>Révoquer</button>}</div>)}</div>}
          </div>
        )}
        <div className="pop-card p-5">
          <h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="size-4 text-emerald-600" /> EcoleDirecte — démo</h3>
          <div className="mt-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">🔒 En mode démo, la connexion est simulée : identifiant + mot de passe quelconques fonctionnent, et “Synchroniser” ajoute des devoirs d'exemple. Aucun appel à api.ecoledirecte.com.</div>
          <div className="mt-4 grid gap-2">
            <Label>Identifiant</Label><Input value={ident} onChange={(e) => setIdent(e.target.value)} placeholder="n'importe quoi (démo)" />
            <Label>Mot de passe</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="•••• (démo)" />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" disabled={loading} onClick={() => {
                if (!ident.trim() || !password) { toast.error("Renseigne identifiant + mot de passe (démo : n'importe quoi)."); return; }
                // For demo we randomly ask a 2FA question 1 time out of 3 to show it works offline
                if (!twoFa && Math.random() < 0.33) {
                  setTwoFa({ question: "Quel est le nom de votre premier animal de compagnie ? (démo)", choices: ["Milou", "Rex", "Félix"] });
                  toast.message("🔐 Vérification (simulée) — choisis une réponse.");
                  return;
                }
                setTwoFa(null);
                toast.success("EcoleDirecte connecté (démo).");
              }}>{loading ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Link2 className="mr-1 size-4" />} Connecter (démo)</Button>
              <Button disabled={syncing} onClick={() => {
                setSyncing(true);
                setTimeout(() => {
                  const r = demo.syncDemo();
                  if (r.ok) toast.success(`Synchronisé (démo) : ${r.added} ajouté${r.added > 1 ? "s" : ""}, ${r.timetable} créneaux EDT.`);
                  setSyncing(false);
                }, 600);
              }}>{syncing ? <Loader2 className="mr-1 size-4 animate-spin" /> : <RefreshCw className="mr-1 size-4" />} Synchroniser (démo)</Button>
            </div>
            {twoFa && <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="font-bold text-amber-900">🔐 {twoFa.question}</p><div className="mt-3 grid gap-2">{twoFa.choices.map((c) => <Button key={c} variant="outline" onClick={() => { setTwoFa(null); toast.success("Vérification réussie (démo)."); }}>{c}</Button>)}</div><Button variant="ghost" size="sm" className="mt-2" onClick={() => setTwoFa(null)}>Annuler</Button></div>}
          </div>
        </div>
      </div>
      <div>
        <h3 className="mb-3 font-bold">Élèves connectés (démo)</h3>
        {classmates.length === 0 ? <p className="pop-card p-8 text-center text-sm text-muted-foreground">Aucun élève.</p> : <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{classmates.map((s) => <li key={s._id} className="pop-card flex items-center gap-3 p-4"><span className="flex size-10 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{s.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span><div className="min-w-0"><p className="truncate font-bold">{s.name}{s.isMe ? " · toi" : ""}</p><p className="text-xs text-muted-foreground">{s.classRole === "delegue" ? "⭐ Délégué" : "🎓 Élève"}</p></div></li>)}</ul>}
      </div>
      <div className="rounded-2xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">Astuce présentation : coupe ton Wi-Fi maintenant, recharge la page (⌘+R) et enchaîne : <span className="font-bold text-foreground">Importer → Générer hors-ligne → Publier → Devoirs → Questions</span>. Tout doit fonctionner sans écran d'erreur.</div>
    </section>
  );
}

// Tiny helper so Demo also has Questions section local (reuses same UI as convex but powered by demo store)
import QuestionsDemo from "@/components/QuestionsDemo";
