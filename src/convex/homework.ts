import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const importanceValidator = v.union(
  v.literal("normal"),
  v.literal("a_rendre"),
  v.literal("note"),
  v.literal("interro"),
  v.literal("controle"),
  v.literal("oral"),
);

function importanceRank(importance?: string, isTest?: boolean) {
  if (importance === "controle") return 5;
  if (importance === "interro" || isTest) return 4;
  if (importance === "note" || importance === "oral") return 3;
  if (importance === "a_rendre") return 2;
  return 1;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const viewerId = await getAuthUserId(ctx);
    if (!viewerId) return [];
    const viewer = await ctx.db.get(viewerId);
    const className = viewer?.className;
    if (!className) return [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const rows = (await ctx.db.query("homework").withIndex("by_due_date", (q) => q.gte("dueDate", todayStr)).collect())
      .filter((homework) => homework.className === className);
    rows.sort((a, b) => a.dueDate === b.dueDate
      ? importanceRank(b.importance, b.isTest) - importanceRank(a.importance, a.isTest)
      : a.dueDate.localeCompare(b.dueDate));
    return rows.map((homework) => ({
      _id: homework._id,
      subjectKey: homework.subjectKey,
      dueDate: homework.dueDate,
      text: homework.text,
      emoji: homework.emoji,
      done: homework.doneBy.some((id) => id === viewerId),
      doneCount: homework.doneBy.length,
      mine: homework.createdBy === viewerId,
      source: (homework.source ?? "manuel") as "ecoledirecte" | "manuel",
      subjectLabel: homework.subjectLabel,
      teacher: homework.teacher,
      isTest: homework.isTest,
      importance: homework.importance ?? (homework.isTest ? "interro" : "normal"),
      edDone: homework.edDone,
    }));
  },
});

export const add = mutation({
  args: { subjectKey: v.string(), dueDate: v.string(), text: v.string(), emoji: v.string(), importance: v.optional(importanceValidator) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connecte-toi pour ajouter un devoir.");
    const author = await ctx.db.get(userId);
    if (!author?.className) throw new Error("Tu dois appartenir à une classe.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.dueDate)) throw new Error("Date d'échéance invalide.");
    const text = args.text.trim().slice(0, 900);
    if (!text) throw new Error("Écris d'abord le devoir.");
    const importance = args.importance ?? "normal";
    return ctx.db.insert("homework", {
      subjectKey: args.subjectKey,
      dueDate: args.dueDate,
      text,
      emoji: args.emoji.slice(0, 8) || "📝",
      className: author.className,
      doneBy: [],
      createdBy: userId,
      createdAt: Date.now(),
      source: "manuel",
      importance,
      isTest: ["note", "interro", "controle", "oral"].includes(importance),
    });
  },
});

export const toggleDone = mutation({
  args: { id: v.id("homework") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connecte-toi d'abord.");
    const [homework, viewer] = await Promise.all([ctx.db.get(id), ctx.db.get(userId)]);
    if (!homework || !viewer?.className || homework.className !== viewer.className) throw new Error("Ce devoir n'existe plus.");
    const done = homework.doneBy.some((uid) => uid === userId);
    await ctx.db.patch(id, { doneBy: done ? homework.doneBy.filter((uid) => uid !== userId) : [...homework.doneBy, userId] });
  },
});

export const remove = mutation({
  args: { id: v.id("homework") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Connecte-toi d'abord.");
    const [homework, viewer] = await Promise.all([ctx.db.get(id), ctx.db.get(userId)]);
    if (!homework) return;
    if (!viewer?.className || homework.className !== viewer.className) throw new Error("Devoir introuvable.");
    if (homework.source === "ecoledirecte") throw new Error("Ce devoir vient d'EcoleDirecte — il se met à jour tout seul.");
    if (homework.createdBy !== userId) throw new Error("Tu ne peux supprimer que les devoirs que tu as ajoutés.");
    await ctx.db.delete(id);
  },
});
