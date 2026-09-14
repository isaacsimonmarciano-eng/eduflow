import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Upcoming homework for the current user, grouped by due date.
 *  Past-due items that the user hasn't done are kept ("en retard");
 *  past items already done are hidden. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const viewerId = await getAuthUserId(ctx);
    if (viewerId === null) return [];

    const viewer = await ctx.db.get(viewerId);
    const className = viewer?.className;

    const today = new Date();
    const todayStr = [
      today.getFullYear(),
      `${today.getMonth() + 1}`.padStart(2, "0"),
      `${today.getDate()}`.padStart(2, "0"),
    ].join("-");

    // A month back, so late homework still surfaces ("en retard"); anything
    // older than that, or already done, is noise.
    const since = new Date(today.getTime() - 31 * 86_400_000).toISOString().slice(0, 10);

    const rows = (
      await ctx.db
        .query("homework")
        .withIndex("by_due_date", (q) => q.gte("dueDate", since))
        .collect()
    ).filter(
      (h) =>
        h.className === className &&
        (h.dueDate >= todayStr ||
          !h.doneBy.some((id) => id === viewerId) ||
          h.source === "ecoledirecte"),
    );

    rows.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.createdAt - b.createdAt));

    return rows.map((h) => ({
      _id: h._id,
      subjectKey: h.subjectKey,
      dueDate: h.dueDate,
      text: h.text,
      emoji: h.emoji,
      source: h.source ?? "manuel",
      subjectLabel: h.subjectLabel,
      teacher: h.teacher,
      isTest: h.isTest ?? false,
      edDone: h.edDone ?? false,
      done: h.doneBy.some((id) => id === viewerId),
      doneCount: h.doneBy.length,
      mine: h.createdBy === viewerId,
      // Homework synced from EcoleDirecte isn't ours to delete.
      canDelete: (h.source ?? "manuel") !== "ecoledirecte" && h.createdBy === viewerId,
    }));
  },
});

/** Add a homework entry. `everyone` publishes it to the whole class. */
export const add = mutation({
  args: {
    subjectKey: v.string(),
    dueDate: v.string(),
    text: v.string(),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Connecte-toi pour ajouter un devoir.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.dueDate)) {
      throw new Error("Date d'échéance invalide.");
    }
    const text = args.text.trim().slice(0, 300);
    if (!text) throw new Error("Écris d'abord le devoir.");

    const author = await ctx.db.get(userId);

    return ctx.db.insert("homework", {
      subjectKey: args.subjectKey,
      dueDate: args.dueDate,
      text,
      emoji: args.emoji.slice(0, 8) || "📝",
      className: author?.className,
      doneBy: [],
      createdBy: userId,
      createdAt: Date.now(),
      source: "manuel",
    });
  },
});

/** Toggle "done" for the current user on one homework entry. */
export const toggleDone = mutation({
  args: { id: v.id("homework") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Connecte-toi d'abord.");
    const h = await ctx.db.get(id);
    if (!h) throw new Error("Ce devoir n'existe plus.");

    const done = h.doneBy.some((uid) => uid === userId);
    await ctx.db.patch(id, {
      doneBy: done
        ? h.doneBy.filter((uid) => uid !== userId)
        : [...h.doneBy, userId],
    });
  },
});

export const remove = mutation({
  args: { id: v.id("homework") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Connecte-toi d'abord.");
    const h = await ctx.db.get(id);
    if (!h) return;
    if ((h.source ?? "manuel") === "ecoledirecte") {
      throw new Error(
        "Ce devoir vient d'EcoleDirecte : il disparaîtra tout seul de la liste.",
      );
    }
    if (h.createdBy !== userId) {
      throw new Error("Tu ne peux supprimer que les devoirs que tu as ajoutés.");
    }
    await ctx.db.delete(id);
  },
});
