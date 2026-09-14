import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SUBJECTS } from "@/lib/subjects";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { MessageCircleQuestion, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function QuestionThread({ id, onClose }: { id: Id<"questions">; onClose: () => void }) {
  const answers = useQuery(api.questions.answers, { questionId: id });
  const answer = useMutation(api.questions.answer);
  const editAnswer = useMutation(api.questions.editAnswer);
  const removeAnswer = useMutation(api.questions.removeAnswer);
  const [body, setBody] = useState("");
  const [editingId,setEditingId]=useState<Id<"questionAnswers">|null>(null);
  const [editingBody,setEditingBody]=useState("");
  return <div className="mt-4 border-t border-border/70 pt-4">
    <div className="mb-3 flex items-center justify-between"><p className="font-bold">Réponses de la classe</p><button onClick={onClose} aria-label="Fermer"><X className="size-4" /></button></div>
    <div className="space-y-3">
      {answers?.map((a:any)=><div key={a._id} className="rounded-2xl bg-muted/60 p-3">
        <div className="flex justify-between gap-3"><p className="text-xs font-bold text-muted-foreground">{a.authorName}</p>{a.mine&&<div className="flex gap-2"><button onClick={()=>{setEditingId(a._id);setEditingBody(a.body)}} className="text-muted-foreground hover:text-foreground" aria-label="Modifier"><Pencil className="size-3.5"/></button><button onClick={()=>removeAnswer({id:a._id})} className="text-muted-foreground hover:text-destructive" aria-label="Supprimer"><Trash2 className="size-3.5"/></button></div>}</div>
        {editingId===a._id?<div className="mt-2 flex gap-2"><Textarea value={editingBody} onChange={e=>setEditingBody(e.target.value)} className="min-h-20"/><div className="flex flex-col gap-2"><Button size="sm" onClick={async()=>{await editAnswer({id:a._id,body:editingBody});setEditingId(null);toast.success("Réponse modifiée.")}}>Enregistrer</Button><Button size="sm" variant="ghost" onClick={()=>setEditingId(null)}>Annuler</Button></div></div>:<p className="mt-1 whitespace-pre-wrap text-sm">{a.body}</p>}
      </div>)}
      {answers?.length===0&&<p className="text-sm text-muted-foreground">Pas encore de réponse. Tu peux être le premier à aider 🙂</p>}
    </div>
    <div className="mt-4 flex gap-2"><Textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Écris ta réponse…" className="min-h-20 rounded-2xl"/><Button size="icon" className="shrink-0 rounded-full" onClick={async()=>{if(!body.trim())return;try{await answer({questionId:id,body});setBody("");toast.success("Réponse envoyée !");}catch(e){toast.error(e instanceof Error?e.message:"Impossible d'envoyer.");}}}><Send className="size-4"/></Button></div>
  </div>;
}

export default function Questions() {
  const questions = useQuery(api.questions.list, {});
  const add = useMutation(api.questions.add);
  const edit = useMutation(api.questions.edit);
  const remove = useMutation(api.questions.remove);
  const [open,setOpen]=useState(false); const [thread,setThread]=useState<Id<"questions">|null>(null);
  const [filter,setFilter]=useState("all"); const [unanswered,setUnanswered]=useState(false);
  const [form,setForm]=useState({subjectKey:SUBJECTS[0].key,title:"",body:""});
  const [editing,setEditing]=useState<{id:Id<"questions">;title:string;body:string}|null>(null);
  const visible=(questions??[]).filter((q:any)=>(filter==="all"||q.subjectKey===filter)&&(!unanswered||!q.answered));
  const submit=async()=>{const subject=SUBJECTS.find(s=>s.key===form.subjectKey)!;try{await add({subjectKey:subject.key,subjectLabel:subject.label,title:form.title,body:form.body});setForm({subjectKey:SUBJECTS[0].key,title:"",body:""});setOpen(false);toast.success("Question publiée pour toute la classe !");}catch(e){toast.error(e instanceof Error?e.message:"Impossible de publier.");}};
  return <section>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-2xl font-bold">💬 Questions de la classe</h1><p className="mt-1 text-sm text-muted-foreground">Une question ? Pose-la ici. Toute la classe peut aider.</p></div><Button onClick={()=>setOpen(v=>!v)} className="gap-2 rounded-full font-bold"><Plus className="size-4"/>Poser une question</Button></div>
    {open&&<div className="mt-5 rounded-3xl border bg-card p-5 shadow-sm"><div className="grid gap-3"><select value={form.subjectKey} onChange={e=>setForm({...form,subjectKey:e.target.value})} className="h-10 rounded-xl border bg-background px-3 text-sm font-medium">{SUBJECTS.map(s=><option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}</select><Input placeholder="Titre de ta question" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><Textarea placeholder="Explique ce que tu ne comprends pas…" value={form.body} onChange={e=>setForm({...form,body:e.target.value})} className="min-h-28"/><div className="flex justify-end gap-2"><Button variant="ghost" onClick={()=>setOpen(false)}>Annuler</Button><Button onClick={submit} className="gap-2"><Send className="size-4"/>Publier</Button></div></div></div>}
    <div className="mt-5 flex gap-2 overflow-x-auto pb-2"><button onClick={()=>setFilter("all")} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${filter==="all"?"bg-primary text-primary-foreground":"bg-card"}`}>Toutes</button>{SUBJECTS.map(s=><button key={s.key} onClick={()=>setFilter(s.key)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${filter===s.key?"bg-primary text-primary-foreground":"bg-card"}`}>{s.emoji} {s.label}</button>)}<button onClick={()=>setUnanswered(v=>!v)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${unanswered?"bg-orange-100 text-orange-800":"bg-card"}`}>Sans réponse</button></div>
    <div className="mt-4 space-y-3">{questions===undefined?<p className="text-muted-foreground">Chargement…</p>:visible.length===0?<div className="rounded-3xl border border-dashed p-10 text-center"><MessageCircleQuestion className="mx-auto mb-3 size-9 text-muted-foreground"/><p className="font-bold">Aucune question ici pour l'instant.</p></div>:visible.map((q:any)=>{const subject=SUBJECTS.find(s=>s.key===q.subjectKey);return <article key={q._id} className="rounded-3xl border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><button className="min-w-0 flex-1 text-left" onClick={()=>setThread(thread===q._id?null:q._id)}><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{subject?.emoji} {q.subjectLabel}</span><h2 className="mt-3 font-display text-lg font-bold">{q.title}</h2><p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{q.body}</p><div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>Par {q.authorName}</span><span className={`font-bold ${q.answered?"text-emerald-600":"text-orange-600"}`}>{q.answered?`🟢 ${q.answerCount} réponse${q.answerCount>1?"s":""}`:"🟠 Sans réponse"}</span></div></button>{q.mine&&<div className="flex shrink-0 gap-2"><button onClick={()=>setEditing({id:q._id,title:q.title,body:q.body})} className="text-muted-foreground hover:text-foreground" aria-label="Modifier"><Pencil className="size-4"/></button><button onClick={async()=>{if(confirm("Supprimer cette question ?"))await remove({id:q._id});}} className="text-muted-foreground hover:text-destructive" aria-label="Supprimer"><Trash2 className="size-4"/></button></div>}</div>{editing?.id===q._id&&<div className="mt-4 grid gap-2 rounded-2xl bg-muted/40 p-3"><Input value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/><Textarea value={editing.body} onChange={e=>setEditing({...editing,body:e.target.value})}/><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={()=>setEditing(null)}>Annuler</Button><Button size="sm" onClick={async()=>{await edit({id:editing.id,title:editing.title,body:editing.body});setEditing(null);toast.success("Question modifiée.")}}>Enregistrer</Button></div></div>}{thread===q._id&&<QuestionThread id={q._id} onClose={()=>setThread(null)}/>}</article>})}</div>
  </section>;
}
