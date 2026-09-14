import { SUBJECTS, subjectOf } from "@/lib/subjects";
import { dueLabel, daysUntil } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CalendarClock,
  Check,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

export type Homework = {
  _id: Id<"homework">;
  subjectKey: string;
  dueDate: string;
  text: string;
  emoji: string;
  source: "ecoledirecte" | "manuel";
  subjectLabel?: string;
  teacher?: string;
  isTest: boolean;
  edDone: boolean;
  done: boolean;
  doneCount: number;
  mine: boolean;
  canDelete: boolean;
};

const EMOJI_CHOICES = ["📝", "✏️", "📖", "📐", "🧪", "🌍", "🎤", "🎨", "💻", "⚽", "🧬", "🗺️"];

const DONE_STATS = [
  { min: 2, label: "2 camarades l'ont fait" },
  { min: 1, label: "1 camarade l'a fait" },
];

/** "il y a 4 min" — the UI stays honest about how fresh the sync is. */
function sinceLabel(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

function daysLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days <= 0) return "⚠️ à faire pour aujourd'hui !";
  if (days === 1) return "pour demain";
  return `dans ${days} jours`;
}

export default function Devoirs({
  homework,
  onAdd,
  onToggle,
  onRemove,
  onSync,
  syncing,
  lastSyncedAt,
  syncError,
}: {
  homework: Homework[] | undefined;
  onAdd: (data: { subjectKey: string; dueDate: string; text: string; emoji: string }) => Promise<void>;
  onToggle: (id: Id<"homework">) => Promise<void>;
  onRemove: (id: Id<"homework">) => Promise<void>;
  onSync: () => Promise<void>;
  syncing: boolean;
  lastSyncedAt?: number;
  syncError?: string | null;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    subjectKey: SUBJECTS[0].key,
    dueDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    text: "",
    emoji: "📝",
  });
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, Homework[]>();
    for (const h of homework ?? []) {
      const list = map.get(h.dueDate) ?? [];
      list.push(h);
      map.set(h.dueDate, list);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  }, [homework]);

  const pendingCount = (homework ?? []).filter((h) => !h.done).length;
  const doneCount = (homework ?? []).length - pendingCount;

  const handleAdd = async () => {
    if (form.text.trim().length < 3) {
      toast.error("Écris d'abord le devoir (3 caractères minimum).");
      return;
    }
    setSaving(true);
    try {
      await onAdd(form);
      toast.success("Devoir ajouté au récap ! 🎉");
      setForm((f) => ({ ...f, text: "", emoji: "📝" }));
      setAddOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Récap des devoirs">
      {/* Progress banner */}
      <div className="dot-grid pop-card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="animate-float-y flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl shadow-sm">
            🗂️
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">📋 Le récap des devoirs</h2>
            <p className="text-sm text-muted-foreground">
              {pendingCount === 0
                ? doneCount > 0
                  ? "Tout est fait, bravo ! 🎉"
                  : "Rien à faire pour le moment. Profite !"
                : `${pendingCount} devoir${pendingCount > 1 ? "s" : ""} à faire`}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {syncError ? (
                <span className="text-amber-700">⚠️ {syncError}</span>
              ) : lastSyncedAt ? (
                <>🎒 EcoleDirecte synchronisé {sinceLabel(lastSyncedAt)}</>
              ) : (
                <>🎒 Les devoirs EcoleDirecte arrivent automatiquement</>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void onSync()}
            disabled={syncing}
            className="gap-2 rounded-full font-bold"
          >
            <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
            {syncing ? "Synchronisation…" : "Synchroniser"}
          </Button>
          <Button onClick={() => setAddOpen(true)} className="gap-2 rounded-full font-bold shadow-sm">
            <Plus className="size-4" />
            Ajouter un devoir
          </Button>
        </div>
      </div>

      {/* Grouped by due date */}
      {homework === undefined ? (
        <div className="mt-5 grid gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pop-card h-20 animate-pulse" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="dot-grid pop-card mt-5 flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="animate-float-y text-5xl">🎈</div>
          <h3 className="mt-4 font-display text-lg font-bold">
            Aucun devoir en vue !
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Ajoute les devoirs donnés en classe pour ne rien oublier — et coche-les
            quand c'est fait.
          </p>
          <Button onClick={() => setAddOpen(true)} className="mt-5 gap-2 rounded-full font-bold shadow-sm">
            <Plus className="size-4" />
            Ajouter le premier devoir
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1 text-xs font-bold text-foreground/75">
                  <CalendarClock className="size-3.5" />
                  {dueLabel(date)}
                </span>
                <span className="text-xs text-muted-foreground">{daysLabel(date)}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <ul className="grid gap-2.5">
                <AnimatePresence initial={false}>
                  {items.map((h) => {
                    const s = subjectOf(h.subjectKey);
                    const late = h.dueDate < new Date().toISOString().slice(0, 10);
                    return (
                      <motion.li
                        key={h._id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.22 }}
                      >
                        <div
                          className={`pop-card pop-card-hover flex items-center gap-3.5 p-4 ${
                            h.done ? "opacity-60" : ""
                          }`}
                        >
                          {/* Toggle done */}
                          <button
                            onClick={() => void onToggle(h._id)}
                            aria-label={h.done ? "Marquer comme à faire" : "Marquer comme fait"}
                            className={`flex size-9 shrink-0 items-center justify-center rounded-xl border-2 text-base transition-all active:scale-90 ${
                              h.done
                                ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                                : "border-border bg-card hover:border-emerald-400"
                            }`}
                          >
                            {h.done ? <Check className="size-5" /> : h.emoji}
                          </button>

                          <div className="min-w-0 flex-1">
                            <p
                              className={`whitespace-pre-line text-sm font-bold leading-snug ${
                                h.done ? "line-through decoration-2" : ""
                              }`}
                            >
                              {h.text}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-bold">
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                                style={{ backgroundColor: s.soft, color: s.color }}
                              >
                                {s.emoji} {h.subjectLabel ?? s.label}
                              </span>
                              {h.source === "ecoledirecte" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                                  🎒 EcoleDirecte
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                                  ✍️ ajouté en classe
                                </span>
                              )}
                              {h.isTest && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">
                                  ⚠️ interro
                                </span>
                              )}
                              {h.teacher && (
                                <span className="text-muted-foreground">
                                  👩‍🏫 {h.teacher}
                                </span>
                              )}
                              {late && !h.done && h.source === "ecoledirecte" && (
                                <Badge variant="outline" className="rounded-full border-dashed border-destructive/40 text-destructive">
                                  en retard
                                </Badge>
                                )}
                              {h.edDone && !h.done && (
                                <span className="text-emerald-600">
                                  ✅ déjà fait sur EcoleDirecte
                                </span>
                              )}
                              {h.doneCount > 0 && (
                                <span className="text-muted-foreground">
                                  ✅{" "}
                                  {DONE_STATS.find((d) => h.doneCount >= d.min)?.label ??
                                    `${h.doneCount} l'ont fait`}
                                </span>
                              )}
                            </div>
                          </div>

                          {h.canDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                if (window.confirm("Supprimer ce devoir ?")) {
                                  void onRemove(h._id);
                                }
                              }}
                              aria-label="Supprimer le devoir"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold">
              <span className="text-xl">📝</span> Nouveau devoir
            </DialogTitle>
            <DialogDescription>
              Note-le pour toute la classe : matière, échéance, et ce qu'il faut faire.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="hw-subject">Matière</Label>
                <select
                  id="hw-subject"
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
                <Label htmlFor="hw-date">Pour le…</Label>
                <Input
                  id="hw-date"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="hw-text">Le devoir</Label>
              <Input
                id="hw-text"
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                placeholder="Ex : exercices 12 à 15 page 84"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !saving) void handleAdd();
                }}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Un dessin pour le repérer</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_CHOICES.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                    aria-label={`Choisir ${e}`}
                    className={`flex size-10 items-center justify-center rounded-xl border-2 text-lg transition-all active:scale-90 ${
                      form.emoji === e
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-transparent bg-muted/60 hover:border-border"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => void handleAdd()}
              disabled={saving}
              className="gap-2 rounded-full font-bold"
            >
              {saving ? "Ajout…" : "Ajouter au récap 🎉"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
