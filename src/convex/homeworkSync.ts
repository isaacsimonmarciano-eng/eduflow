import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { ecoleDirecteFetchHomework } from "./auth/ecoleDirecte";

/**
 * Sync the class's homework with EcoleDirecte's "cahier de textes".
 *
 * The synced entries live in the same `homework` table as the ones added by
 * hand, tagged with `source: "ecoledirecte"` and a stable `sourceId` so the
 * whole class shares one de-duplicated list. Homework added by students for
 * teachers who don't use EcoleDirecte keeps `source: "manuel"`.
 */

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

type ViewerContext = {
  edUserId: string;
  className: string | undefined;
  sessionJson: string | null;
} | null;

type SyncStats = {
  added: number;
  updated: number;
  total: number;
  syncedAt: number;
};

/** EcoleDirecte writes subject names in caps, with their own diacritics. */
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
  {
    key: "histoire-geo",
    emoji: "🌍",
    test: /HISTOIRE|GEOGRAPHIE|GEO\b|EMC|CIVIQUE/,
  },
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

/** Map an EcoleDirecte subject name onto a subject key + emoji. */
function subjectFor(label: string): { key: string; emoji: string } {
  const normalized = normalizeLabel(label);
  const match = SUBJECT_MATCHERS.find((m) => m.test.test(normalized));
  if (match) return { key: match.key, emoji: match.emoji };
  const slug =
    normalized
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "autre";
  return { key: slug, emoji: "📘" };
}

/** Looking up what we need to reach EcoleDirecte for the signed-in student. */
export const viewerContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const viewer = await ctx.db.get(userId);
    if (!viewer?.edUserId) return null;

    const session = await ctx.db
      .query("edSessions")
      .withIndex("by_ed_user", (q) => q.eq("edUserId", viewer.edUserId!))
      .first();

    return {
      edUserId: viewer.edUserId,
      className: viewer.className ?? session?.className,
      sessionJson: session?.sessionJson ?? null,
    };
  },
});

/** Upsert the fetched assignments into the class's homework list. */
export const applySync = internalMutation({
  args: {
    userId: v.id("users"),
    className: v.string(),
    entries: v.array(entryValidator),
    sessionJson: v.optional(v.string()),
  },
  handler: async (ctx, { userId, className, entries, sessionJson }) => {
    const now = Date.now();

    // Keep the refreshed EcoleDirecte session (the token it renews mid-sync).
    if (sessionJson) {
      const viewer = await ctx.db.get(userId);
      if (viewer?.edUserId) {
        const stored = await ctx.db
          .query("edSessions")
          .withIndex("by_ed_user", (q) => q.eq("edUserId", viewer.edUserId!))
          .first();
        if (stored) {
          await ctx.db.patch(stored._id, { sessionJson, updatedAt: now });
        }
      }
    }
    let added = 0;
    let updated = 0;

    for (const entry of entries) {
      const subject = subjectFor(entry.subjectLabel);
      const existing = await ctx.db
        .query("homework")
        .withIndex("by_class_source", (q) =>
          q.eq("className", className).eq("sourceId", entry.sourceId),
        )
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

/**
 * Pull the student's EcoleDirecte homework into the class list.
 * Called automatically when the dashboard opens (if the last sync is old) and
 * from the "Synchroniser" button.
 */
export const sync = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Connecte-toi d'abord pour synchroniser tes devoirs.");
    }

    // Explicit types: these calls reference this very module, which TS cannot
    // infer through ("implicitly has type any" circularity).
    const viewer: ViewerContext = await ctx.runQuery(
      internal.homeworkSync.viewerContext,
      { userId },
    );
    if (!viewer) {
      throw new Error("Profil élève introuvable. Reconnecte-toi.");
    }
    if (!viewer.className) {
      throw new Error(
        "Ta classe n'a pas encore été détectée. Reconnecte-toi pour la récupérer depuis EcoleDirecte.",
      );
    }
    if (!viewer.sessionJson) {
      throw new Error(
        "Reconnecte-toi à EcoleDirecte pour autoriser la synchronisation des devoirs.",
      );
    }

    const result = await ecoleDirecteFetchHomework(
      viewer.sessionJson,
      viewer.edUserId,
    );
    if (!result.ok) {
      return { ok: false as const, message: result.message };
    }

    const stats: SyncStats = await ctx.runMutation(
      internal.homeworkSync.applySync,
      {
        userId,
        className: viewer.className,
        entries: result.entries,
        sessionJson: result.sessionJson,
      },
    );

    return { ok: true as const, ...stats };
  },
});
