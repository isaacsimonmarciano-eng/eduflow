import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  ecoleDirecteFetchHomework,
  ecoleDirecteFetchTimetable,
} from "./auth/ecoleDirecte";

function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

const SUBJECT_MATCHERS: { key: string; emoji: string; test: RegExp }[] = [
  { key: "maths", emoji: "📐", test: /MATH|ALGEBRE|GEOMETRIE|CALCUL/ },
  { key: "francais", emoji: "📚", test: /FRANCAIS|LETTRES|LITTERATURE|ORAL/ },
  { key: "histoire-geo", emoji: "🌍", test: /HISTOIRE|GEOGRAPHIE|GEO\b|EMC|CIVIQUE/ },
  { key: "svt", emoji: "🧬", test: /SVT|SCIENCES DE LA VIE|BIOLOGIE|GEOLOGIE/ },
  { key: "physique-chimie", emoji: "⚗️", test: /PHYSIQUE|CHIMIE/ },
  { key: "anglais", emoji: "🇬🇧", test: /ANGLAIS|ANGLO/ },
  { key: "espagnol", emoji: "🇪🇸", test: /ESPAGNOL/ },
  { key: "allemand", emoji: "🇩🇪", test: /ALLEMAND/ },
  { key: "italien", emoji: "🇮🇹", test: /ITALIEN/ },
  { key: "latin", emoji: "🏛️", test: /LATIN|GREC/ },
  { key: "techno", emoji: "🛠️", test: /TECHNO|INFORMATIQUE|NUMERIQUE/ },
  { key: "arts", emoji: "🎨", test: /ART|MUSIQUE|DESSIN|THEATRE/ },
  { key: "eps", emoji: "⚽", test: /EPS|SPORT|EDUCATION PHYSIQUE/ },
];

function subjectKeyFor(label: string): string {
  const normalized = normalizeLabel(label);
  for (const m of SUBJECT_MATCHERS) {
    if (m.test.test(normalized)) return m.key;
  }
  return (
    normalized
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "autre"
  );
}

function subjectFor(label: string): { key: string; emoji: string } {
  const k = subjectKeyFor(label);
  const m = SUBJECT_MATCHERS.find((x) => x.key === k);
  return { key: k, emoji: m?.emoji ?? "📘" };
}

const entryValidator = v.object({
  sourceId: v.string(),
  dueDate: v.string(),
  subjectLabel: v.string(),
  subjectCode: v.optional(v.string()),
  teacher: v.optional(v.string()),
  text: v.string(),
  isTest: v.boolean(),
  edDone: v.boolean(),
  assignedOn: v.optional(v.string()),
});

const slotValidator = v.object({
  date: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  subjectLabel: v.string(),
  subjectCode: v.optional(v.string()),
  teacher: v.optional(v.string()),
  room: v.optional(v.string()),
});

// Dashboard banner: tomorrow's subjects + the most recent published lesson for each
export const tomorrowSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const me = await ctx.db.get(userId);
    if (!me?.className) return null;
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const slots = await ctx.db
      .query("timetableSlots")
      .withIndex("by_class_date", (q) => q.eq("className", me.className!).eq("date", tomorrow))
      .collect();
    const subjectKeys = [...new Set(slots.map((s) => s.subjectKey))];
    const lessons = await ctx.db.query("lessons").collect();
    const recentBySubject = new Map<string, (typeof lessons)[number]>();
    for (const l of lessons) {
      if (l.className !== me.className || l.status !== "published") continue;
      if (!subjectKeys.includes(l.subjectKey)) continue;
      const prev = recentBySubject.get(l.subjectKey);
      if (!prev || l.date > prev.date) recentBySubject.set(l.subjectKey, l);
    }
    return {
      date: tomorrow,
      slots: slots.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      recentBySubject: Object.fromEntries(recentBySubject),
    };
  },
});

export const viewerContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewer = await ctx.db.get(userId);
    if (!viewer) return null;
    if (!viewer.className) return null;
    const edUserId = viewer.edUserId;
    if (!edUserId || edUserId.startsWith("email:")) return null;
    const session = await ctx.db
      .query("edSessions")
      .withIndex("by_ed_user", (q) => q.eq("edUserId", edUserId))
      .first();
    return { edUserId, className: viewer.className!, sessionJson: session?.sessionJson ?? null };
  },
});

export const whoAmI = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    return u ? { className: u.className, classRole: u.classRole, edUserId: u.edUserId } : null;
  },
});

export const storeDelegueSession = internalMutation({
  args: {
    edUserId: v.string(),
    className: v.optional(v.string()),
    sessionJson: v.string(),
    delegueUserId: v.id("users"),
  },
  handler: async (ctx, { edUserId, className, sessionJson, delegueUserId }) => {
    const existing = await ctx.db
      .query("edSessions")
      .withIndex("by_ed_user", (q) => q.eq("edUserId", edUserId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        sessionJson,
        ...(className ? { className } : {}),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("edSessions", {
        edUserId,
        studentId: edUserId,
        className,
        sessionJson,
        updatedAt: Date.now(),
      });
    }
    await ctx.db.patch(delegueUserId, { timetableSyncedAt: Date.now() } as any);
    // Also set edUserId on the delegue user so viewerContext finds the session
    await ctx.db.patch(delegueUserId, { edUserId } as any);
  },
});

export const applyHomeworkSync = internalMutation({
  args: {
    userId: v.id("users"),
    className: v.string(),
    entries: v.array(entryValidator),
    sessionJson: v.optional(v.string()),
  },
  handler: async (ctx, { userId, className, entries, sessionJson }) => {
    const now = Date.now();
    if (sessionJson) {
      const viewer = await ctx.db.get(userId);
      if (viewer?.edUserId) {
        const stored = await ctx.db
          .query("edSessions")
          .withIndex("by_ed_user", (q) => q.eq("edUserId", viewer.edUserId!))
          .first();
        if (stored) await ctx.db.patch(stored._id, { sessionJson, updatedAt: now });
      }
    }
    let added = 0;
    let updated = 0;
    for (const entry of entries) {
      const subject = subjectFor(entry.subjectLabel);
      const existing = await ctx.db
        .query("homework")
        .withIndex("by_class_source", (q) => q.eq("className", className).eq("sourceId", entry.sourceId))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          subjectKey: subject.key,
          subjectLabel: entry.subjectLabel,
          emoji: subject.emoji,
          dueDate: entry.dueDate,
          text: entry.text,
          teacher: entry.teacher,
          isTest: entry.isTest,
          edDone: entry.edDone,
          syncedAt: now,
        });
        updated += 1;
        continue;
      }
      await ctx.db.insert("homework", {
        subjectKey: subject.key,
        subjectLabel: entry.subjectLabel,
        dueDate: entry.dueDate,
        text: entry.text,
        emoji: subject.emoji,
        className,
        doneBy: [],
        createdBy: userId,
        createdAt: now,
        source: "ecoledirecte",
        sourceId: entry.sourceId,
        teacher: entry.teacher,
        isTest: entry.isTest,
        edDone: entry.edDone,
        syncedAt: now,
      });
      added += 1;
    }
    await ctx.db.patch(userId, { hwSyncedAt: now });
    return { added, updated, total: entries.length, syncedAt: now };
  },
});

export const applyTimetableSync = internalMutation({
  args: {
    className: v.string(),
    slots: v.array(slotValidator),
    delegueId: v.id("users"),
  },
  handler: async (ctx, { className, slots, delegueId }) => {
    const today = new Date().toISOString().slice(0, 10);
    const inWindow = await ctx.db
      .query("timetableSlots")
      .withIndex("by_class", (q) => q.eq("className", className))
      .collect();
    for (const s of inWindow) {
      if (s.date >= today) await ctx.db.delete(s._id);
    }
    for (const s of slots) {
      await ctx.db.insert("timetableSlots", {
        className,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        subjectKey: subjectKeyFor(s.subjectLabel),
        subjectLabel: s.subjectLabel,
        teacher: s.teacher,
        room: s.room,
      });
    }
    await ctx.db.patch(delegueId, { timetableSyncedAt: Date.now() } as any);
    return { count: slots.length };
  },
});

// ── Delegue EcoleDirecte 2FA-aware ─────────────────────────────────
function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const PENDING_TTL_MS = 10 * 60 * 1000;

// Étape 1 : le délégué entre identifiant + mot de passe.
// Si EcoleDirecte demande la question secrète, on renvoie la question au lieu de throw.
export const saveDelegueSession = action({
  args: { identifiant: v.string(), motdepasse: v.string() },
  handler: async (
    ctx,
    { identifiant, motdepasse },
  ): Promise<
    | { ok: true; className: string }
    | { ok: false; twoFa: true; handle: string; question: string; choices: { label: string; value: string }[] }
    | { ok: false; twoFa: false; message: string }
  > => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connecte-toi d'abord.");
    const me = (await ctx.runQuery(internal.delegueEcoleDirecte.whoAmI, { userId })) as
      | { className?: string; classRole?: string }
      | null;
    if (!me?.className) {
      throw new Error("Rejoins d'abord une classe avant de connecter EcoleDirecte.");
    }
    const { ecoleDirecteStart } = await import("./auth/ecoleDirecte");
    const res = await ecoleDirecteStart(identifiant, motdepasse);
    if (!res.ok && "twoFa" in res && (res as any).twoFa) {
      const handle = randomToken();
      await ctx.runMutation(internal.authEd.storePending, {
        handle,
        cookiesJson: (res as any).pending,
        expiresAt: Date.now() + PENDING_TTL_MS,
      });
      return {
        ok: false,
        twoFa: true,
        handle,
        question: (res as any).question,
        choices: (res as any).choices,
      };
    }
    if (!res.ok) {
      return { ok: false, twoFa: false, message: (res as any).message };
    }
    await ctx.runMutation(internal.delegueEcoleDirecte.storeDelegueSession, {
      edUserId: (res as any).profile.edUserId,
      className: (res as any).profile.className,
      sessionJson: (res as any).session ?? "",
      delegueUserId: userId,
    });
    return { ok: true as const, className: (res as any).profile.className };
  },
});

// Étape 2 : le délégué a répondu à la question secrète
export const finishDelegueSession = action({
  args: {
    handle: v.string(),
    choixValue: v.string(),
    identifiant: v.string(),
    motdepasse: v.string(),
  },
  handler: async (
    ctx,
    { handle, choixValue, identifiant, motdepasse },
  ): Promise<
    | { ok: true; className: string }
    | { ok: false; twoFa: true; handle: string; question: string; choices: { label: string; value: string }[]; message?: string }
    | { ok: false; message: string }
  > => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connecte-toi d'abord.");
    const me = (await ctx.runQuery(internal.delegueEcoleDirecte.whoAmI, { userId })) as
      | { className?: string; classRole?: string }
      | null;
    if (!me?.className) {
      throw new Error("Rejoins d'abord une classe avant de connecter EcoleDirecte.");
    }
    const pending = await ctx.runQuery(internal.authEd.getPending, { handle });
    if (!pending) {
      return {
        ok: false,
        message: "Session de vérification expirée. Reprends la connexion depuis le début.",
      };
    }
    const { ecoleDirecteFinish } = await import("./auth/ecoleDirecte");
    const result = await ecoleDirecteFinish(identifiant, motdepasse, pending.cookiesJson, choixValue);

    // Question chaînée : EcoleDirecte en demande une autre
    if (!result.ok && "pending" in result && (result as any).pending) {
      await ctx.runMutation(internal.authEd.updatePending, {
        handle,
        cookiesJson: (result as any).pending,
        expiresAt: Date.now() + PENDING_TTL_MS,
      });
      return {
        ok: false,
        twoFa: true,
        handle,
        question: (result as any).question,
        choices: (result as any).choices,
        message: (result as any).message,
      };
    }

    if (!result.ok) {
      // Garde la session vivante pour retenter la bonne réponse sans retaper les identifiants
      await ctx.runMutation(internal.authEd.updatePending, {
        handle,
        cookiesJson: pending.cookiesJson,
        expiresAt: Date.now() + PENDING_TTL_MS,
      });
      return { ok: false, message: (result as any).message ?? "Échec de la vérification." };
    }

    // Succès : on supprime le pending et on stocke la session délégué
    await ctx.runMutation(internal.authEd.deletePending, { handle });
    await ctx.runMutation(internal.delegueEcoleDirecte.storeDelegueSession, {
      edUserId: (result as any).profile.edUserId,
      className: (result as any).profile.className,
      sessionJson: (result as any).session ?? "",
      delegueUserId: userId,
    });
    return { ok: true, className: (result as any).profile.className };
  },
});

export const syncFromDelegue = action({
  args: {},
  handler: async (ctx): Promise<{ ok: true; added: number; updated: number; total: number; syncedAt: number; timetable: number } | { ok: false; message: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connecte-toi d'abord.");
    const viewer = (await ctx.runQuery(internal.delegueEcoleDirecte.viewerContext, {
      userId,
    })) as { edUserId: string; className: string; sessionJson: string | null } | null;
    if (!viewer) {
      throw new Error(
        "Seul le délégué connecté à EcoleDirecte peut synchroniser. Connecte EcoleDirecte d'abord.",
      );
    }
    if (!viewer.sessionJson) {
      throw new Error("Session EcoleDirecte manquante. Reconnecte EcoleDirecte.");
    }
    const hw = await ecoleDirecteFetchHomework(viewer.sessionJson, viewer.edUserId);
    if (!hw.ok) return { ok: false as const, message: hw.message };
    const hwStats = (await ctx.runMutation(internal.delegueEcoleDirecte.applyHomeworkSync, {
      userId,
      className: viewer.className,
      entries: hw.entries,
      sessionJson: hw.sessionJson,
    })) as { added: number; updated: number; total: number; syncedAt: number };
    const tt = await ecoleDirecteFetchTimetable(viewer.sessionJson, viewer.edUserId);
    if (tt.ok) {
      await ctx.runMutation(internal.delegueEcoleDirecte.applyTimetableSync, {
        className: viewer.className,
        slots: tt.slots,
        delegueId: userId,
      });
    }
    return { ok: true as const, ...hwStats, timetable: tt.ok ? tt.slots.length : 0 };
  },
});
