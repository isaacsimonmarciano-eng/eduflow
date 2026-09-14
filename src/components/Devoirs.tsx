import { SUBJECTS, subjectOf } from "@/lib/subjects";
import { dueLabel, daysUntil } from "@/lib/dates";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, Check, File, Link2, MessageSquarePlus, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

export type Importance = "normal" | "a_rendre" | "note" | "interro" | "controle" | "oral";
export type Homework = {
  _id: Id<"homework">;
  subjectKey: string;
  dueDate: string;
  text: string;
  emoji: string;
  done: boolean;
  doneCount: number;
  mine: boolean;
  source?: "ecoledirecte" | "manuel";
  subjectLabel?: string;
  teacher?: string;
  isTest?: boolean;
  importance?: Importance;
  edDone?: boolean;
};

type Attachment = {
  name: string;
  type: string;
  url?: string;
  storageId?: Id<"_storage">;
};

type Note = {
  _id: Id<"homeworkNotes">;
  text?: string;
  attachments?: Attachment[];
  authorName: string;
  mine: boolean;
  createdAt: number;
  updatedAt: number;
};

const TYPES: { key: Importance; label: string; emoji: string }[] = [
  { key: "normal", label: "Devoir classique", emoji: "📝" },
  { key: "a_rendre", label: "À rendre", emoji: "📥" },
  { key: "note", label: "Travail noté", emoji: "⭐" },
  { key: "interro", label: "Interrogation", emoji: "⚠️" },
  { key: "controle", label: "Contrôle / DS", emoji: "🚨" },
  { key: "oral", label: "Oral / exposé", emoji: "🎤" },
];
const EMOJIS = ["📝", "✏️", "📖", "📐", "🧪", "🌍", "🎤", "🎨", "💻", "⚽", "🧬", "🗺️"];

function daysLabel(iso: string) {
  const days = daysUntil(iso);
  return days <= 0 ? "⚠️ aujourd'hui" : days === 1 ? "pour demain" : `dans ${days} jours`;
}
function typeOf(homework: Homework) {
  return TYPES.find((type) => type.key === (homework.importance ?? (homework.isTest ? "interro" : "normal"))) ?? TYPES[0];
}
function cleanUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function Attachments({ items, editable, onRemove }: { items: Attachment[]; editable?: boolean; onRemove?: (index: number) => void }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={`${item.name}-${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-semibold">
          {item.type === "link" ? <Link2 className="size-3.5 shrink-0" /> : <File className="size-3.5 shrink-0" />}
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="max-w-52 truncate underline-offset-2 hover:underline">
              {item.name}
            </a>
          ) : (
            <span className="max-w-52 truncate">{item.name}</span>
          )}
          {editable && onRemove && (
            <button type="button" onClick={() => onRemove(index)} aria-label={`Retirer ${item.name}`} className="ml-0.5 text-muted-foreground hover:text-destructive">
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function HomeworkDetail({ homework, onClose }: { homework: Homework; onClose: () => void }) {
  const notes = useQuery(api.homeworkNotes.list, { homeworkId: homework._id }) as Note[] | undefined;
  const add = useMutation(api.homeworkNotes.add);
  const edit = useMutation(api.homeworkNotes.edit);
  const remove = useMutation(api.homeworkNotes.remove);
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: Id<"homeworkNotes">; text: string; attachments: Attachment[] } | null>(null);
  const subject = subjectOf(homework.subjectKey);
  const type = typeOf(homework);

  const uploadFiles = async (files: FileList | null, target: "new" | "edit") => {
    if (!files?.length) return;
    const selected = [...files].slice(0, 8);
    if (selected.some((file) => file.size > 15 * 1024 * 1024)) {
      toast.error("Chaque fichier doit faire 15 Mo maximum.");
      return;
    }
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of selected) {
        const uploadUrl = await generateUploadUrl({}) as string;
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!response.ok) throw new Error(`Envoi impossible pour ${file.name}.`);
        const result = await response.json() as { storageId: Id<"_storage"> };
        uploaded.push({ name: file.name, type: file.type || "application/octet-stream", storageId: result.storageId });
      }
      if (target === "new") setAttachments((current) => [...current, ...uploaded].slice(0, 8));
      else setEditing((current) => current ? { ...current, attachments: [...current.attachments, ...uploaded].slice(0, 8) } : current);
      toast.success(`${uploaded.length} fichier${uploaded.length > 1 ? "s" : ""} ajouté${uploaded.length > 1 ? "s" : ""}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'envoyer le fichier.");
    } finally {
      setUploading(false);
    }
  };

  const addLink = () => {
    const url = cleanUrl(link);
    if (!url) return;
    try {
      new URL(url);
    } catch {
      toast.error("Ce lien n'est pas valide.");
      return;
    }
    setAttachments((current) => [...current, { name: url.replace(/^https?:\/\//, ""), type: "link", url }].slice(0, 8));
    setLink("");
  };

  const submitNote = async () => {
    if (!text.trim() && attachments.length === 0) return toast.error("Ajoute une note, un lien ou un fichier.");
    setSaving(true);
    try {
      await add({ homeworkId: homework._id, text, attachments });
      setText("");
      setAttachments([]);
      setLink("");
      toast.success("Note ajoutée pour la classe.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'ajouter la note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{type.emoji} {homework.text}</DialogTitle>
          <DialogDescription>
            {subject.emoji} {homework.subjectLabel ?? subject.label} · {dueLabel(homework.dueDate)} {homework.teacher ? `· ${homework.teacher}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl bg-muted/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold">Notes et précisions de la classe</p>
              <p className="text-xs text-muted-foreground">Texte, photos, PDF, autres fichiers ou liens. Chacun modifie uniquement ses propres notes.</p>
            </div>
            {type.key !== "normal" && <Badge className={type.key === "controle" ? "bg-red-600 text-white" : "bg-amber-100 text-amber-800"}>{type.emoji} {type.label}</Badge>}
          </div>

          <div className="mt-3 space-y-2">
            {notes?.map((note) => (
              <div key={note._id} className="rounded-2xl bg-background p-3 text-sm shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-muted-foreground">{note.authorName}</span>
                    {editing?.id === note._id ? (
                      <div className="mt-2 space-y-2">
                        <Textarea value={editing.text} onChange={(event) => setEditing((current) => current ? { ...current, text: event.target.value } : current)} className="min-h-20" />
                        <Attachments items={editing.attachments} editable onRemove={(index) => setEditing((current) => current ? { ...current, attachments: current.attachments.filter((_, i) => i !== index) } : current)} />
                        <div className="flex flex-wrap gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-bold">
                            <Paperclip className="size-3.5" /> Ajouter un fichier
                            <input type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt" onChange={(event) => void uploadFiles(event.target.files, "edit")} />
                          </label>
                          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setEditing(null)}>Annuler</Button>
                          <Button size="sm" className="rounded-full" onClick={async () => {
                            if (!editing) return;
                            try {
                              await edit({ id: editing.id, text: editing.text, attachments: editing.attachments });
                              setEditing(null);
                              toast.success("Note modifiée.");
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Modification impossible.");
                            }
                          }}>Enregistrer</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {note.text && <p className="mt-1 whitespace-pre-wrap">{note.text}</p>}
                        <Attachments items={note.attachments ?? []} />
                      </>
                    )}
                  </div>
                  {note.mine && editing?.id !== note._id && (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => setEditing({ id: note._id, text: note.text ?? "", attachments: note.attachments ?? [] })} aria-label="Modifier cette note" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="size-3.5" /></button>
                      <button type="button" onClick={async () => {
                        if (!window.confirm("Supprimer cette note ?")) return;
                        try { await remove({ id: note._id }); toast.success("Note supprimée."); }
                        catch (error) { toast.error(error instanceof Error ? error.message : "Suppression impossible."); }
                      }} aria-label="Supprimer cette note" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="size-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {notes?.length === 0 && <p className="text-sm text-muted-foreground">Aucune précision pour l'instant.</p>}
          </div>

          <div className="mt-4 rounded-2xl border bg-background p-3">
            <Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Ex : le prof a précisé qu'il faut aussi apprendre la définition…" className="min-h-20" />
            <Attachments items={attachments} editable onRemove={(index) => setAttachments((current) => current.filter((_, i) => i !== index))} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border bg-card px-3 py-2 text-xs font-bold transition hover:bg-muted">
                <Paperclip className="size-3.5" /> {uploading ? "Envoi…" : "Photo / PDF / fichier"}
                <input type="file" multiple disabled={uploading} className="hidden" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt" onChange={(event) => void uploadFiles(event.target.files, "new")} />
              </label>
              <div className="flex min-w-52 flex-1 gap-2">
                <Input value={link} onChange={(event) => setLink(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addLink(); } }} placeholder="Ajouter un lien…" className="h-9" />
                <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={addLink}><Link2 className="size-3.5" /></Button>
              </div>
              <Button type="button" disabled={saving || uploading} className="ml-auto gap-1.5 rounded-full" onClick={() => void submitNote()}>
                <MessageSquarePlus className="size-4" /> {saving ? "Ajout…" : "Ajouter"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Devoirs({
  homework,
  onAdd: _onAdd,
  onToggle,
  onRemove,
}: {
  homework: Homework[] | undefined;
  onAdd: (data: { subjectKey: string; dueDate: string; text: string; emoji: string; importance?: Importance }) => Promise<void>;
  onToggle: (id: Id<"homework">) => Promise<void>;
  onRemove: (id: Id<"homework">) => Promise<void>;
}) {
  const addHomework = useMutation(api.homework.add);
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<Homework | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    subjectKey: SUBJECTS[0].key,
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    text: "",
    emoji: "📝",
    importance: "normal" as Importance,
  });
  const grouped = useMemo(() => {
    const map = new Map<string, Homework[]>();
    for (const item of homework ?? []) {
      const values = map.get(item.dueDate) ?? [];
      values.push(item);
      map.set(item.dueDate, values);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [homework]);
  const pending = (homework ?? []).filter((item) => !item.done).length;

  const handleAdd = async () => {
    if (form.text.trim().length < 3) return toast.error("Écris d'abord le devoir.");
    setSaving(true);
    try {
      await addHomework(form);
      setAddOpen(false);
      setForm((current) => ({ ...current, text: "", emoji: "📝", importance: "normal" }));
      toast.success("Devoir ajouté !");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible d'ajouter le devoir.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="dot-grid pop-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <h2 className="font-display text-xl font-bold">📋 Le récap des devoirs</h2>
          <p className="text-sm text-muted-foreground">{pending ? `${pending} devoir${pending > 1 ? "s" : ""} à faire` : "Tout est à jour 🎉"}</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2 rounded-full font-bold"><Plus className="size-4" />Ajouter un devoir</Button>
      </div>

      {homework === undefined ? (
        <p className="mt-5 text-muted-foreground">Chargement…</p>
      ) : grouped.length === 0 ? (
        <div className="pop-card mt-5 p-12 text-center"><p className="text-4xl">🎈</p><h3 className="mt-3 font-bold">Aucun devoir en vue !</h3><p className="text-sm text-muted-foreground">Les devoirs EcoleDirecte et ceux ajoutés par la classe apparaîtront ici.</p></div>
      ) : (
        <div className="mt-5 space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="mb-2 flex items-center gap-2"><span className="rounded-full bg-foreground/5 px-3 py-1 text-xs font-bold"><CalendarClock className="mr-1 inline size-3.5" />{dueLabel(date)}</span><span className="text-xs text-muted-foreground">{daysLabel(date)}</span><div className="h-px flex-1 bg-border" /></div>
              <div className="grid gap-2.5">
                <AnimatePresence>
                  {items.map((item) => {
                    const subject = subjectOf(item.subjectKey);
                    const type = typeOf(item);
                    const important = type.key !== "normal";
                    return (
                      <motion.div layout key={item._id} className={`pop-card flex items-center gap-3.5 p-4 ${item.done ? "opacity-60" : ""} ${important ? "border-amber-300 shadow-md" : ""}`}>
                        <button type="button" aria-label={item.done ? "Marquer comme à faire" : "Marquer comme fait"} onClick={() => void onToggle(item._id)} className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 ${item.done ? "border-emerald-500 bg-emerald-500 text-white" : "bg-card"}`}>{item.done ? <Check className="size-5" /> : item.emoji}</button>
                        <button type="button" onClick={() => setDetail(item)} className="min-w-0 flex-1 text-left">
                          <p className={`text-sm font-bold ${item.done ? "line-through" : ""}`}>{item.text}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-bold">
                            <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: subject.soft, color: subject.color }}>{subject.emoji} {item.subjectLabel ?? subject.label}</span>
                            {important && <Badge className={type.key === "controle" ? "bg-red-600 text-white" : "bg-amber-100 text-amber-800"}>{type.emoji} {type.label}</Badge>}
                            {item.teacher && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{item.teacher}</span>}
                            {item.source === "ecoledirecte" && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">🎒 EcoleDirecte</span>}
                          </div>
                        </button>
                        {item.source !== "ecoledirecte" && item.mine && <Button size="icon" variant="ghost" aria-label="Supprimer ce devoir" onClick={() => window.confirm("Supprimer ce devoir ?") && void onRemove(item._id)}><Trash2 className="size-4" /></Button>}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && <HomeworkDetail homework={detail} onClose={() => setDetail(null)} />}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader><DialogTitle>Nouveau devoir</DialogTitle><DialogDescription>Visible par toute la classe. Le statut « fait » reste personnel.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Matière</Label><select value={form.subjectKey} onChange={(event) => setForm({ ...form, subjectKey: event.target.value })} className="mt-1 h-9 w-full rounded-xl border bg-card px-2">{SUBJECTS.map((subject) => <option key={subject.key} value={subject.key}>{subject.emoji} {subject.label}</option>)}</select></div>
              <div><Label>Pour le…</Label><Input className="mt-1" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></div>
            </div>
            <div><Label>Type</Label><select value={form.importance} onChange={(event) => setForm({ ...form, importance: event.target.value as Importance })} className="mt-1 h-9 w-full rounded-xl border bg-card px-2">{TYPES.map((type) => <option key={type.key} value={type.key}>{type.emoji} {type.label}</option>)}</select></div>
            <div><Label>Le devoir</Label><Input className="mt-1" value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} placeholder="Ex : exercices 12 à 15 page 84" /></div>
            <div className="flex flex-wrap gap-1">{EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => setForm({ ...form, emoji })} className={`size-9 rounded-xl ${form.emoji === emoji ? "bg-primary/15 ring-2 ring-primary" : "bg-muted"}`}>{emoji}</button>)}</div>
          </div>
          <DialogFooter><Button disabled={saving} onClick={() => void handleAdd()}>{saving ? "Ajout…" : "Ajouter"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
