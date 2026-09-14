import { SUBJECTS } from "@/lib/subjects";
import { useDemo } from "@/demo/store";
import { useState } from "react";
import { MessageCircleQuestion, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function QuestionsDemo() {
  const demo = useDemo();
  const meId = demo.currentUser?._id;
  const className = demo.currentUser?.className;
  const questions = demo.state.questions.filter((q) => q.className === className).sort((a, b) => b.createdAt - a.createdAt);
  const add = (data: { subjectKey: string; subjectLabel: string; title: string; body: string }) => demo.addQuestion(data);
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [unanswered, setUnanswered] = useState(false);
  const [form, setForm] = useState({ subjectKey: SUBJECTS[0].key, title: "", body: "" });
  const [editing, setEditing] = useState<{ id: string; title: string; body: string } | null>(null);

  const visible = questions.filter((q) => {
    const answered = demo.state.answers.some((a) => a.questionId === q._id);
    return (filter === "all" || q.subjectKey === filter) && (!unanswered || !answered);
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">💬 Questions de la classe <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">DÉMO</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">En démo tout est stocké sur cet appareil.</p>
        </div>
        <Button onClick={() => setOpen((v) => !v)} className="gap-2 rounded-full font-bold"><Plus className="size-4" /> Poser une question</Button>
      </div>
      {open && (
        <div className="mt-5 rounded-3xl border bg-card p-5 shadow-sm">
          <div className="grid gap-3">
            <select value={form.subjectKey} onChange={(e) => setForm({ ...form, subjectKey: e.target.value })} className="h-10 rounded-xl border bg-background px-3 text-sm font-medium">
              {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}
            </select>
            <Input placeholder="Titre de ta question" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Explique ce que tu ne comprends pas…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="min-h-28" />
            <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={() => { const sub = SUBJECTS.find((x) => x.key === form.subjectKey)!; add({ subjectKey: sub.key, subjectLabel: sub.label, title: form.title, body: form.body }); setForm({ subjectKey: SUBJECTS[0].key, title: "", body: "" }); setOpen(false); toast.success("Question publiée (démo) !"); }} className="gap-2"><Send className="size-4" /> Publier</Button></div>
          </div>
        </div>
      )}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setFilter("all")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-card"}`}>Toutes</button>
        {SUBJECTS.map((s) => <button key={s.key} onClick={() => setFilter(s.key)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${filter === s.key ? "bg-primary text-primary-foreground" : "bg-card"}`}>{s.emoji} {s.label}</button>)}
        <button onClick={() => setUnanswered((v) => !v)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${unanswered ? "bg-orange-100 text-orange-800" : "bg-card"}`}>Sans réponse</button>
      </div>
      <div className="mt-4 space-y-3">
        {visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed p-10 text-center"><MessageCircleQuestion className="mx-auto mb-3 size-9 text-muted-foreground" /><p className="font-bold">Aucune question ici pour l'instant.</p></div>
        ) : (
          visible.map((question) => {
            const subject = SUBJECTS.find((x) => x.key === question.subjectKey);
            const answers = demo.state.answers.filter((a) => a.questionId === question._id).sort((a, b) => a.createdAt - b.createdAt);
            const answered = answers.length > 0;
            const isEditing = editing?.id === question._id;
            return (
              <article key={question._id} className="rounded-3xl border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setThread(thread === question._id ? null : question._id)}>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{subject?.emoji} {question.subjectLabel}</span>
                    <h2 className="mt-3 font-display text-lg font-bold">{question.title}</h2>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{question.body}</p>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>Par {question.authorName}</span><span className={`font-bold ${answered ? "text-emerald-600" : "text-orange-600"}`}>{answered ? `🟢 ${answers.length} réponse${answers.length > 1 ? "s" : ""}` : "🟠 Sans réponse"}</span></div>
                  </button>
                  {question.authorId === meId && (
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => setEditing({ id: question._id, title: question.title, body: question.body })} className="text-muted-foreground hover:text-foreground" aria-label="Modifier"><Pencil className="size-4" /></button>
                      <button onClick={() => { if (!confirm("Supprimer cette question ?")) return; demo.removeQuestion(question._id); if (thread === question._id) setThread(null); toast.success("Question supprimée (démo)."); }} className="text-muted-foreground hover:text-destructive" aria-label="Supprimer"><Trash2 className="size-4" /></button>
                    </div>
                  )}
                </div>
                {isEditing && editing && (
                  <div className="mt-4 grid gap-2 rounded-2xl bg-muted/40 p-3">
                    <Input value={editing.title} onChange={(e) => setEditing((c) => (c ? { ...c, title: e.target.value } : c))} />
                    <Textarea value={editing.body} onChange={(e) => setEditing((c) => (c ? { ...c, body: e.target.value } : c))} />
                    <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Annuler</Button><Button size="sm" onClick={() => { demo.editQuestion(editing.id, editing.title, editing.body); setEditing(null); toast.success("Question modifiée (démo)."); }}>Enregistrer</Button></div>
                  </div>
                )}
                {thread === question._id && <ThreadDemo questionId={question._id} />}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function ThreadDemo({ questionId }: { questionId: string }) {
  const demo = useDemo();
  const meId = demo.currentUser?._id;
  const answers = demo.state.answers.filter((a) => a.questionId === questionId).sort((a, b) => a.createdAt - b.createdAt);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  return (
    <div className="mt-4 border-t border-border/70 pt-4">
      <p className="mb-3 font-bold">Réponses de la classe</p>
      <div className="space-y-3">
        {answers.map((item) => (
          <div key={item._id} className="rounded-2xl bg-muted/60 p-3">
            <div className="flex justify-between gap-3">
              <p className="text-xs font-bold text-muted-foreground">{item.authorName}</p>
              {item.authorId === meId && (
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(item._id); setEditingBody(item.body); }} className="text-muted-foreground hover:text-foreground" aria-label="Modifier"><Pencil className="size-3.5" /></button>
                  <button onClick={() => { demo.removeAnswer(item._id); toast.success("Réponse supprimée (démo)."); }} className="text-muted-foreground hover:text-destructive" aria-label="Supprimer"><Trash2 className="size-3.5" /></button>
                </div>
              )}
            </div>
            {editingId === item._id ? (
              <div className="mt-2 flex gap-2"><Textarea value={editingBody} onChange={(e) => setEditingBody(e.target.value)} className="min-h-20" /><div className="flex flex-col gap-2"><Button size="sm" onClick={() => { demo.editAnswer(item._id, editingBody); setEditingId(null); toast.success("Réponse modifiée (démo)."); }}>Enregistrer</Button><Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Annuler</Button></div></div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-sm">{item.body}</p>
            )}
          </div>
        ))}
        {answers.length === 0 && <p className="text-sm text-muted-foreground">Pas encore de réponse. Tu peux être le premier à aider 🙂</p>}
      </div>
      <div className="mt-4 flex gap-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Écris ta réponse…" className="min-h-20 rounded-2xl" />
        <Button size="icon" className="shrink-0 rounded-full" onClick={() => { if (!body.trim()) return; demo.answerQuestion(questionId, body); setBody(""); toast.success("Réponse envoyée (démo) !"); }} aria-label="Envoyer la réponse"><Send className="size-4" /></Button>
      </div>
    </div>
  );
}
