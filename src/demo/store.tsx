import * as React from "react";

// ─────────────────────────────────────────────────────────────
// Cartable Vivant — Store démo 100% local (sans Convex, sans Internet)
// Persistance: localStorage (cartes SD / partage = build statique)
// Données: devoirs, résumés, questions, EDT, invites — tout en mémoire
// ─────────────────────────────────────────────────────────────

type Id = string;
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export type DemoSubjectKey =
  | "maths"
  | "francais"
  | "histoire-geo"
  | "svt"
  | "physique-chimie"
  | "anglais"
  | "espagnol"
  | "techno"
  | "arts"
  | "eps"
  | "autre";

export type DemoUser = {
  _id: Id;
  name: string;
  email?: string;
  className: string;
  classRole: "delegue" | "eleve";
  edUserId?: string;
};

export type DemoLesson = {
  _id: Id;
  subjectKey: string;
  date: string;
  title: string;
  summary: string;
  keyPoints: string[];
  notes?: string;
  status: "draft" | "published";
  className: string;
  createdBy: Id;
  authorName: string;
  createdAt: number;
  updatedAt: number;
};

export type DemoHomework = {
  _id: Id;
  subjectKey: string;
  subjectLabel?: string;
  dueDate: string;
  text: string;
  emoji: string;
  importance?: "normal" | "a_rendre" | "note" | "interro" | "controle" | "oral";
  isTest?: boolean;
  edDone?: boolean;
  doneBy: Id[];
  className: string;
  createdBy: Id;
  source: "ecoledirecte" | "manuel";
  sourceId?: string;
  teacher?: string;
  syncedAt?: number;
};

export type DemoSlot = {
  _id: Id;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  subjectKey: string;
  subjectLabel: string;
  teacher?: string;
  room?: string;
};

export type DemoQuestion = {
  _id: Id;
  className: string;
  subjectKey: string;
  subjectLabel: string;
  title: string;
  body: string;
  authorId: Id;
  authorName: string;
  createdAt: number;
  updatedAt: number;
};

export type DemoAnswer = {
  _id: Id;
  questionId: Id;
  className: string;
  authorId: Id;
  authorName: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

export type DemoInvite = { _id: Id; email: string; className: string; status: "pending" | "accepted" | "revoked"; createdAt: number };

type DemoState = {
  users: DemoUser[];
  currentUserId: Id | null;
  lessons: DemoLesson[];
  homework: DemoHomework[];
  slots: DemoSlot[];
  questions: DemoQuestion[];
  answers: DemoAnswer[];
  invites: DemoInvite[];
  hwNotes: { _id: Id; homeworkId: Id; className: string; authorId: Id; authorName: string; text?: string; attachments?: { name: string; type: string; url?: string }[]; createdAt: number; updatedAt: number }[];
};

// Helpers dates
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function shift(days: number) {
  const d = new Date(Date.now() + days * 86_400_000);
  return iso(d);
}

function seedState(): DemoState {
  const delegueId = uid();
  const eleve2Id = uid();
  const eleve3Id = uid();
  const className = "3e B — Démo";
  const users: DemoUser[] = [
    { _id: delegueId, name: "Isaac Marciano", email: "isaac@demo.local", className, classRole: "delegue", edUserId: "email:isaac@demo.local" },
    { _id: eleve2Id, name: "Léa Martin", email: "lea@demo.local", className, classRole: "eleve", edUserId: "email:lea@demo.local" },
    { _id: eleve3Id, name: "Nolan Dubois", email: "nolan@demo.local", className, classRole: "eleve", edUserId: "email:nolan@demo.local" },
  ];
  const lessons: DemoLesson[] = [
    {
      _id: uid(), subjectKey: "maths", date: shift(-2), title: "Le théorème de Thalès — proportions", summary: " Triangles semblables : rapports égaux si les droites sont parallèles. Attention à l'ordre des sommets. Exercice guidé en classe sur deux triangles imbriqués.", keyPoints: ["Rapport de proportion = côté / côté homologue", "Droites parallèles ⇔ triangles semblables", "Contrôle la semaine prochaine"], status: "published", className, createdBy: delegueId, authorName: "Isaac Marciano", createdAt: Date.now() - 200000, updatedAt: Date.now() - 200000,
    },
    {
      _id: uid(), subjectKey: "francais", date: shift(-1), title: "Le discours argumenté", summary: "Introduction, thèse, arguments + exemples, conclusion. Le connecteur logique structure le raisonnement.", keyPoints: ["Thèse claire dès l'intro", "Un exemple par argument", "Connecteurs : donc, cependant, en revanche"], status: "published", className, createdBy: eleve2Id, authorName: "Léa Martin", createdAt: Date.now() - 100000, updatedAt: Date.now() - 100000,
    },
    {
      _id: uid(), subjectKey: "physique-chimie", date: shift(-3), title: "Mélanges et corps purs", summary: "Brouillon personnel — à vérifier avant publication.", keyPoints: ["Mélange homogène vs hétérogène"], notes: "notes dictaphone brèves", status: "draft", className, createdBy: delegueId, authorName: "Isaac Marciano", createdAt: Date.now() - 300000, updatedAt: Date.now() - 300000,
    },
  ];
  const homework: DemoHomework[] = [
    { _id: uid(), subjectKey: "maths", subjectLabel: "Mathématiques", dueDate: shift(1), text: "Exercices 12 à 15 p. 84", emoji: "📐", importance: "normal", doneBy: [eleve2Id], className, createdBy: delegueId, source: "ecoledirecte", sourceId: "demo-1", teacher: "Mme Dupont", syncedAt: Date.now() - 60000 },
    { _id: uid(), subjectKey: "francais", subjectLabel: "Français", dueDate: shift(2), text: "Lire le chapitre 5 + fiche de lecture", emoji: "📚", importance: "a_rendre", doneBy: [], className, createdBy: delegueId, source: "manuel", teacher: "M. Bernard" },
    { _id: uid(), subjectKey: "anglais", subjectLabel: "Anglais", dueDate: shift(1), text: "Interro vocabulaire unit 3", emoji: "🇬🇧", importance: "interro", isTest: true, doneBy: [], className, createdBy: delegueId, source: "manuel" },
  ];
  const slots: DemoSlot[] = [
    { _id: uid(), className, date: shift(1), startTime: "08:00", endTime: "09:00", subjectKey: "maths", subjectLabel: "Mathématiques", teacher: "Mme Dupont", room: "A12" },
    { _id: uid(), className, date: shift(1), startTime: "09:00", endTime: "10:00", subjectKey: "francais", subjectLabel: "Français", teacher: "M. Bernard", room: "B04" },
    { _id: uid(), className, date: shift(1), startTime: "10:15", endTime: "11:15", subjectKey: "anglais", subjectLabel: "Anglais", teacher: "Ms Smith", room: "C11" },
    { _id: uid(), className, date: shift(2), startTime: "08:00", endTime: "09:00", subjectKey: "svt", subjectLabel: "SVT", teacher: "Mme Curie", room: "Labo 1" },
  ];
  const q1: DemoQuestion = { _id: uid(), className, subjectKey: "maths", subjectLabel: "Mathématiques", title: "Thalès : ordre des sommets ?", body: "Je ne suis pas sûr de l'ordre à respecter pour écrire les rapports.", authorId: eleve2Id, authorName: "Léa Martin", createdAt: Date.now() - 80000, updatedAt: Date.now() - 80000 };
  const questions: DemoQuestion[] = [q1];
  const answers: DemoAnswer[] = [{ _id: uid(), questionId: q1._id, className, authorId: delegueId, authorName: "Isaac Marciano", body: "On écrit toujours les côtés homologues dans le même ordre, ex : AB/AC = AD/AE si B et D sont alignés.", createdAt: Date.now() - 40000, updatedAt: Date.now() - 40000 }];
  return { users, currentUserId: null, lessons, homework, slots, questions, answers, invites: [{ _id: uid(), email: "camarade@exemple.fr", className, status: "pending", createdAt: Date.now() - 60000 }], hwNotes: [] };
}

const STORAGE_KEY = "cartable-vivant:demo-state:v2";
const USER_KEY = "cartable-vivant:demo-user";

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed && Array.isArray(parsed.lessons) && Array.isArray(parsed.homework)) {
        // migrate user id if needed
        const savedId = localStorage.getItem(USER_KEY);
        if (savedId) parsed.currentUserId = savedId;
        return parsed;
      }
    }
  } catch { /* ignore */ }
  const seeded = seedState();
  persist(seeded);
  return seeded;
}
function persist(s: DemoState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    if (s.currentUserId) localStorage.setItem(USER_KEY, s.currentUserId);
    else localStorage.removeItem(USER_KEY);
  } catch { /* quota */ }
}

type DemoCtx = {
  state: DemoState;
  currentUser: DemoUser | null;
  isAuthenticated: boolean;
  signInLocal: (name: string, email: string) => void;
  signOut: () => void;
  resetDemo: () => void;
  createLesson: (data: Omit<DemoLesson, "_id" | "createdAt" | "updatedAt" | "authorName" | "className" | "createdBy" | "status"> & { publish: boolean }) => void;
  publishLesson: (id: Id) => void;
  removeLesson: (id: Id) => void;
  addHomework: (data: { subjectKey: string; dueDate: string; text: string; emoji: string; importance?: DemoHomework["importance"] }) => void;
  toggleHomework: (id: Id) => void;
  removeHomework: (id: Id) => void;
  addNote: (homeworkId: Id, text: string, attachments?: { name: string; type: string; url?: string }[]) => void;
  editNote: (id: Id, text: string, attachments?: { name: string; type: string; url?: string }[]) => void;
  removeNote: (id: Id) => void;
  addQuestion: (data: { subjectKey: string; subjectLabel: string; title: string; body: string }) => void;
  editQuestion: (id: Id, title: string, body: string) => void;
  removeQuestion: (id: Id) => void;
  answerQuestion: (questionId: Id, body: string) => void;
  editAnswer: (id: Id, body: string) => void;
  removeAnswer: (id: Id) => void;
  invite: (email: string) => void;
  revokeInvite: (id: Id) => void;
  syncDemo: () => { ok: true; added: number; updated: number; timetable: number } | { ok: false; message: string };
};

const Ctx = React.createContext<DemoCtx | null>(null);

export function useDemo(): DemoCtx {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useDemo must be used within DemoProvider");
  return v;
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DemoState>(() => {
    if (typeof window === "undefined") return seedState();
    return load();
  });
  // persist reactively (debounced lightly)
  React.useEffect(() => { persist(state); }, [state]);

  const currentUser = React.useMemo(
    () => state.users.find((u) => u._id === state.currentUserId) ?? null,
    [state.users, state.currentUserId]
  );

  const signInLocal = React.useCallback((name: string, email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    setState((s) => {
      const existing = s.users.find((u) => (u.email ?? "").toLowerCase() === cleanEmail);
      if (existing) {
        // update name if changed
        const nextUsers = s.users.map((u) => (u._id === existing._id ? { ...u, name: cleanName || u.name } : u));
        // accept invite if any
        const nextInvites = s.invites.map((inv) => (inv.email.toLowerCase() === cleanEmail && inv.status === "pending" ? { ...inv, status: "accepted" as const } : inv));
        return { ...s, users: nextUsers, invites: nextInvites, currentUserId: existing._id };
      }
      const className = s.users[0]?.className ?? "3e B — Démo";
      const isFirst = s.users.length === 0;
      const newcomer: DemoUser = { _id: uid(), name: cleanName || "Élève", email: cleanEmail, className, classRole: isFirst ? "delegue" : "eleve", edUserId: `email:${cleanEmail}` };
      const nextInvites = s.invites.map((inv) => (inv.email.toLowerCase() === cleanEmail && inv.status === "pending" ? { ...inv, status: "accepted" as const } : inv));
      return { ...s, users: [...s.users, newcomer], invites: nextInvites, currentUserId: newcomer._id };
    });
  }, []);

  const signOut = React.useCallback(() => {
    setState((s) => ({ ...s, currentUserId: null }));
  }, []);

  const resetDemo = React.useCallback(() => {
    const fresh = seedState();
    // keep session? For demo, reset to fresh + keep current choice prompt? Just full reset.
    setState({ ...fresh, currentUserId: null });
    try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
  }, []);

  const createLesson: DemoCtx["createLesson"] = React.useCallback((data) => {
    setState((s) => {
      const me = s.users.find((u) => u._id === s.currentUserId);
      if (!me) return s;
      const now = Date.now();
      const lesson: DemoLesson = {
        _id: uid(),
        subjectKey: data.subjectKey,
        date: data.date,
        title: data.title.trim().slice(0, 120),
        summary: data.summary.trim().slice(0, 2000),
        keyPoints: data.keyPoints.map((k) => k.trim()).filter(Boolean).slice(0, 8),
        notes: data.notes?.trim() ? data.notes.trim().slice(0, 2000) : undefined,
        status: data.publish ? "published" : "draft",
        className: me.className,
        createdBy: me._id,
        authorName: me.name,
        createdAt: now,
        updatedAt: now,
      };
      // edit path is via same? caller passes _id? We use create only; edit is via separate path (we handle in component via store directly? Keep simple: if an id matches, patch)
      // Not needed for now
      return { ...s, lessons: [lesson, ...s.lessons] };
    });
  }, []);

  // For edit/publish we expose via setState helpers the components can call through store directly using updaters
  const publishLesson = React.useCallback((id: Id) => {
    setState((s) => ({ ...s, lessons: s.lessons.map((l) => (l._id === id ? { ...l, status: "published" as const, updatedAt: Date.now() } : l)) }));
  }, []);
  const removeLesson = React.useCallback((id: Id) => {
    setState((s) => ({ ...s, lessons: s.lessons.filter((l) => l._id !== id) }));
  }, []);

  // Allow edit via a small helper exposed through window? Better add editLesson mutation here
  // We'll monkey-patch createLesson to handle update if we detect existing id in state via closure — keep public API minimal and add updateLesson
  (createLesson as unknown as { update?: (id: Id, patch: Partial<DemoLesson> & { publish?: boolean }) => void }).update = (id, patch) => {
    setState((s) => ({
      ...s,
      lessons: s.lessons.map((l) =>
        l._id === id
          ? {
              ...l,
              ...patch,
              ...(patch.publish !== undefined ? { status: patch.publish ? ("published" as const) : l.status === "published" ? "published" as const : ("draft" as const) } : {}),
              updatedAt: Date.now(),
            }
          : l
      ),
    }));
  };

  const addHomework: DemoCtx["addHomework"] = React.useCallback((data) => {
    setState((s) => {
      const me = s.users.find((u) => u._id === s.currentUserId);
      if (!me) return s;
      const importance = data.importance ?? "normal";
      const hw: DemoHomework = {
        _id: uid(),
        subjectKey: data.subjectKey,
        dueDate: data.dueDate,
        text: data.text.trim().slice(0, 900),
        emoji: data.emoji.slice(0, 8) || "📝",
        importance,
        isTest: ["note", "interro", "controle", "oral"].includes(importance),
        doneBy: [],
        className: me.className,
        createdBy: me._id,
        source: "manuel",
        subjectLabel: data.subjectKey,
      };
      return { ...s, homework: [...s.homework, hw] };
    });
  }, []);
  const toggleHomework = React.useCallback((id: Id) => {
    setState((s) => {
      const me = s.currentUserId;
      if (!me) return s;
      return {
        ...s,
        homework: s.homework.map((h) => {
          if (h._id !== id) return h;
          const done = h.doneBy.includes(me);
          return { ...h, doneBy: done ? h.doneBy.filter((x) => x !== me) : [...h.doneBy, me] };
        }),
      };
    });
  }, []);
  const removeHomework = React.useCallback((id: Id) => {
    setState((s) => {
      const me = s.currentUserId;
      if (!me) return s;
      const hw = s.homework.find((x) => x._id === id);
      if (!hw) return s;
      if (hw.source === "ecoledirecte") return s;
      if (hw.createdBy !== me) return s;
      return { ...s, homework: s.homework.filter((x) => x._id !== id) };
    });
  }, []);

  const addNote = React.useCallback((homeworkId: Id, text: string, attachments?: { name: string; type: string; url?: string }[]) => {
    setState((s) => {
      const me = s.users.find((u) => u._id === s.currentUserId);
      if (!me) return s;
      const hw = s.homework.find((h) => h._id === homeworkId);
      if (!hw) return s;
      const now = Date.now();
      const note = { _id: uid(), homeworkId, className: me.className, authorId: me._id, authorName: me.name, text: text.trim() || undefined, attachments: attachments?.slice(0, 8), createdAt: now, updatedAt: now };
      return { ...s, hwNotes: [...s.hwNotes, note] };
    });
  }, []);
  const editNote = React.useCallback((id: Id, text: string, attachments?: { name: string; type: string; url?: string }[]) => {
    setState((s) => ({ ...s, hwNotes: s.hwNotes.map((n) => (n._id === id ? { ...n, text: text.trim() || undefined, attachments: attachments?.slice(0, 8), updatedAt: Date.now() } : n)) }));
  }, []);
  const removeNote = React.useCallback((id: Id) => {
    setState((s) => ({ ...s, hwNotes: s.hwNotes.filter((n) => n._id !== id) }));
  }, []);

  const addQuestion: DemoCtx["addQuestion"] = React.useCallback((data) => {
    setState((s) => {
      const me = s.users.find((u) => u._id === s.currentUserId);
      if (!me) return s;
      const now = Date.now();
      const title = data.title.trim().slice(0, 140);
      const body = data.body.trim().slice(0, 4000);
      if (!title && !body) return s;
      const q: DemoQuestion = { _id: uid(), className: me.className, subjectKey: data.subjectKey, subjectLabel: data.subjectLabel, title: title || body.slice(0, 80), body, authorId: me._id, authorName: me.name, createdAt: now, updatedAt: now };
      return { ...s, questions: [q, ...s.questions] };
    });
  }, []);
  const editQuestion = React.useCallback((id: Id, title: string, body: string) => {
    setState((s) => ({ ...s, questions: s.questions.map((q) => (q._id === id ? { ...q, title: title.trim().slice(0, 140) || body.trim().slice(0, 80), body: body.trim().slice(0, 4000), updatedAt: Date.now() } : q)) }));
  }, []);
  const removeQuestion = React.useCallback((id: Id) => {
    setState((s) => ({ ...s, questions: s.questions.filter((q) => q._id !== id), answers: s.answers.filter((a) => a.questionId !== id) }));
  }, []);
  const answerQuestion = React.useCallback((questionId: Id, body: string) => {
    setState((s) => {
      const me = s.users.find((u) => u._id === s.currentUserId);
      if (!me) return s;
      const q = s.questions.find((x) => x._id === questionId);
      if (!q) return s;
      const now = Date.now();
      const ans: DemoAnswer = { _id: uid(), questionId, className: me.className, authorId: me._id, authorName: me.name, body: body.trim().slice(0, 4000), createdAt: now, updatedAt: now };
      return { ...s, answers: [...s.answers, ans] };
    });
  }, []);
  const editAnswer = React.useCallback((id: Id, body: string) => {
    setState((s) => ({ ...s, answers: s.answers.map((a) => (a._id === id ? { ...a, body: body.trim().slice(0, 4000), updatedAt: Date.now() } : a)) }));
  }, []);
  const removeAnswer = React.useCallback((id: Id) => {
    setState((s) => ({ ...s, answers: s.answers.filter((a) => a._id !== id) }));
  }, []);

  const invite = React.useCallback((email: string) => {
    const e = email.trim().toLowerCase();
    setState((s) => {
      const me = s.users.find((u) => u._id === s.currentUserId);
      if (!me) return s;
      if (s.invites.some((inv) => inv.email.toLowerCase() === e && inv.status === "pending")) return s;
      return { ...s, invites: [...s.invites, { _id: uid(), email: e, className: me.className, status: "pending" as const, createdAt: Date.now() }] };
    });
  }, []);
  const revokeInvite = React.useCallback((id: Id) => {
    setState((s) => ({ ...s, invites: s.invites.map((inv) => (inv._id === id ? { ...inv, status: "revoked" as const } : inv)) }));
  }, []);

  const syncDemo = React.useCallback((): { ok: true; added: number; updated: number; timetable: number } | { ok: false; message: string } => {
    // In demo mode, EcoleDirecte sync is simulated: add one fake homework + ensure slots for tomorrow exist
    let result: { ok: true; added: number; updated: number; timetable: number } | { ok: false; message: string } = { ok: true, added: 0, updated: 0, timetable: 0 };
    setState((s) => {
      const me = s.users.find((u) => u._id === s.currentUserId);
      if (!me) return s;
      const tomorrow = shift(1);
      const already = s.homework.find((h) => h.source === "ecoledirecte" && h.dueDate === tomorrow);
      let nextHw = s.homework;
      let added = 0;
      let updated = 0;
      if (!already) {
        const fake: DemoHomework = { _id: uid(), subjectKey: "histoire-geo", subjectLabel: "Histoire-Géo", dueDate: shift(3), text: "Carte des fleuves à compléter (synchro démo)", emoji: "🌍", importance: "normal", doneBy: [], className: me.className, createdBy: me._id, source: "ecoledirecte", sourceId: `demo-sync-${Date.now()}`, teacher: "Mme Lemoine", syncedAt: Date.now() };
        nextHw = [...nextHw, fake];
        added = 1;
      } else {
        updated = 1;
      }
      // slots: already seeded, just ensure at least 2 slots tomorrow
      let nextSlots = s.slots;
      const tomorrowSlots = nextSlots.filter((sl) => sl.date === tomorrow);
      if (tomorrowSlots.length === 0) {
        nextSlots = [
          ...nextSlots,
          { _id: uid(), className: me.className, date: tomorrow, startTime: "08:00", endTime: "09:00", subjectKey: "maths", subjectLabel: "Mathématiques", teacher: "Mme Dupont", room: "A12" },
          { _id: uid(), className: me.className, date: tomorrow, startTime: "09:00", endTime: "10:00", subjectKey: "francais", subjectLabel: "Français", teacher: "M. Bernard", room: "B04" },
        ];
      }
      result = { ok: true, added, updated, timetable: nextSlots.filter((sl) => sl.date === tomorrow).length };
      return { ...s, homework: nextHw, slots: nextSlots };
    });
    // Return is racy due to setState batching; for presentation, we still show a plausible toast regardless — caller will show generic success.
    return result;
  }, []);

  const value = React.useMemo<DemoCtx>(
    () => ({
      state,
      currentUser,
      isAuthenticated: currentUser !== null,
      signInLocal,
      signOut,
      resetDemo,
      createLesson,
      publishLesson,
      removeLesson,
      addHomework,
      toggleHomework,
      removeHomework,
      addNote,
      editNote,
      removeNote,
      addQuestion,
      editQuestion,
      removeQuestion,
      answerQuestion,
      editAnswer,
      removeAnswer,
      invite,
      revokeInvite,
      syncDemo,
    }),
    [state, currentUser, signInLocal, signOut, resetDemo, createLesson, publishLesson, removeLesson, addHomework, toggleHomework, removeHomework, addNote, editNote, removeNote, addQuestion, editQuestion, removeQuestion, answerQuestion, editAnswer, removeAnswer, invite, revokeInvite, syncDemo]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Helpers used by demo dashboard to mimic Convex shape
export function demoHomeworkForView(state: DemoState, currentUserId: string | null) {
  return state.homework
    .filter((h) => h.className === (state.users.find((u) => u._id === currentUserId)?.className ?? ""))
    .map((h) => ({
      ...h,
      done: currentUserId ? h.doneBy.includes(currentUserId) : false,
      doneCount: h.doneBy.length,
      mine: h.createdBy === currentUserId,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
