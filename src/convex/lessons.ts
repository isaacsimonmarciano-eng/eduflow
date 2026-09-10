import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/** All lessons visible to the current user: published ones for everyone,
 *  drafts only for their author. Sorted by date (newest first). */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const viewerId = await getAuthUserId(ctx);
    const rows = await ctx.db.query("lessons").collect();

    const visible = rows
      .filter(
        (l) =>
          l.status === "published" ||
          (viewerId !== null && l.createdBy === viewerId),
      )
      .sort((a, b) =>
        a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
      );

    const authorNames = new Map<Id<"users">, string>();
    for (const l of visible) {
      if (!authorNames.has(l.createdBy)) {
        const author = await ctx.db.get(l.createdBy);
        authorNames.set(l.createdBy, author?.name ?? "Un élève");
      }
    }

    return visible.map((l) => ({
      _id: l._id,
      subjectKey: l.subjectKey,
      date: l.date,
      title: l.title,
      summary: l.summary,
      keyPoints: l.keyPoints,
      notes: l.notes,
      status: l.status,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      authorName: authorNames.get(l.createdBy) ?? "Un élève",
      canEdit: viewerId !== null && l.createdBy === viewerId,
    }));
  },
});

/** Create or update a lesson. `publish: true` publishes immediately;
 *  otherwise new lessons are saved as drafts (published ones stay published). */
export const save = mutation({
  args: {
    id: v.optional(v.id("lessons")),
    subjectKey: v.string(),
    date: v.string(),
    title: v.string(),
    summary: v.string(),
    keyPoints: v.array(v.string()),
    notes: v.optional(v.string()),
    publish: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Connecte-toi pour enregistrer un résumé.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
      throw new Error("Date du cours invalide.");
    }

    const fields = {
      subjectKey: args.subjectKey,
      date: args.date,
      title: args.title.trim().slice(0, 120),
      summary: args.summary.trim().slice(0, 2000),
      keyPoints: args.keyPoints
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 8),
      notes: args.notes?.trim() ? args.notes.trim().slice(0, 2000) : undefined,
    };

    const now = Date.now();

    if (args.id !== undefined) {
      const existing = await ctx.db.get(args.id);
      if (!existing) throw new Error("Ce résumé n'existe plus.");
      if (existing.createdBy !== userId) {
        throw new Error("Tu ne peux modifier que tes propres résumés.");
      }
      await ctx.db.patch(args.id, {
        ...fields,
        status:
          args.publish || existing.status === "published"
            ? "published"
            : "draft",
        updatedAt: now,
      });
      return args.id;
    }

    return ctx.db.insert("lessons", {
      ...fields,
      status: args.publish ? "published" : "draft",
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const publish = mutation({
  args: { id: v.id("lessons") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Connecte-toi d'abord.");
    const lesson = await ctx.db.get(id);
    if (!lesson) throw new Error("Ce résumé n'existe plus.");
    if (lesson.createdBy !== userId) {
      throw new Error("Tu ne peux publier que tes propres résumés.");
    }
    await ctx.db.patch(id, { status: "published", updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("lessons") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Connecte-toi d'abord.");
    const lesson = await ctx.db.get(id);
    if (!lesson) return;
    if (lesson.createdBy !== userId) {
      throw new Error("Tu ne peux supprimer que tes propres résumés.");
    }
    await ctx.db.delete(id);
  },
});
